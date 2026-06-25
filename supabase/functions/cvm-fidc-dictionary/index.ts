// Baixa o ZIP do Dicionário de Dados da CVM (META) e popula cvm_data_dictionary.
// Endpoint: https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/META/meta_inf_mensal_fidc_txt.zip
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as zip from "npm:@zip.js/zip.js@2.7.45";

const META_URL = "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/META/meta_inf_mensal_fidc_txt.zip";

type DictEntry = { table_name: string; column_name: string; description: string | null; expected_type: string | null; source_meta_file: string };

function detectSeparator(line: string): string {
  const counts = { ";": (line.match(/;/g) || []).length, "\t": (line.match(/\t/g) || []).length, ",": (line.match(/,/g) || []).length };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ";";
}

function splitLine(line: string, sep: string): string[] {
  if (line.indexOf('"') < 0) return line.split(sep);
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function readEntryText(entry: zip.Entry): Promise<string> {
  const decoder = new TextDecoder("iso-8859-1");
  let out = "";
  const writable = new WritableStream<Uint8Array>({
    write(chunk) { out += decoder.decode(chunk, { stream: true }); },
    close() { out += decoder.decode(); },
  });
  await (entry as unknown as { getData: (w: WritableStream) => Promise<unknown> }).getData(writable);
  return out;
}

// Parse genérico do dicionário: cada arquivo .txt costuma trazer header com
// CAMPO/TIPO/DOMINIO/DESCRIÇÃO. Tabela é inferida do nome do arquivo.
function parseDictionaryText(filename: string, text: string): DictEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const sep = detectSeparator(lines[0]);
  const header = splitLine(lines[0], sep).map((h) => h.trim().toUpperCase());
  const idxCampo = header.findIndex((h) => /CAMP|COLU|NOME/.test(h));
  const idxTipo = header.findIndex((h) => /TIPO|TYPE/.test(h));
  const idxDesc = header.findIndex((h) => /DESCR|SIGN/.test(h));
  if (idxCampo < 0) return [];

  // Tabela vem do nome do arquivo: meta_inf_mensal_fidc_tab_iv_xxx.txt → tab_iv
  const tableMatch = filename.toLowerCase().match(/(tab_[a-z0-9]+)/);
  const tableName = tableMatch ? `inf_mensal_fidc_${tableMatch[1]}` : filename.replace(/^meta_/i, "").replace(/\.[a-z]+$/i, "");

  const out: DictEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], sep);
    const col = (fields[idxCampo] ?? "").trim();
    if (!col) continue;
    out.push({
      table_name: tableName,
      column_name: col.toUpperCase(),
      expected_type: idxTipo >= 0 ? (fields[idxTipo] ?? "").trim() || null : null,
      description: idxDesc >= 0 ? (fields[idxDesc] ?? "").trim() || null : null,
      source_meta_file: filename,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();
  try {
    const persist = new URL(req.url).searchParams.get("persist") !== "0";
    const resp = await fetch(META_URL);
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Falha no download (HTTP ${resp.status})`, url: META_URL }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ab = await resp.arrayBuffer();
    const reader = new zip.ZipReader(new zip.BlobReader(new Blob([new Uint8Array(ab)])));
    const entries = await reader.getEntries();

    const filesInZip: Array<{ filename: string; sizeBytes: number; columns: number; entries: number }> = [];
    const allEntries: DictEntry[] = [];

    for (const entry of entries) {
      if (!/\.(txt|csv)$/i.test(entry.filename)) {
        filesInZip.push({ filename: entry.filename, sizeBytes: (entry as unknown as { uncompressedSize?: number }).uncompressedSize ?? 0, columns: 0, entries: 0 });
        continue;
      }
      try {
        const text = await readEntryText(entry);
        const parsed = parseDictionaryText(entry.filename, text);
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
        const cols = lines.length ? splitLine(lines[0], detectSeparator(lines[0])).length : 0;
        filesInZip.push({ filename: entry.filename, sizeBytes: (entry as unknown as { uncompressedSize?: number }).uncompressedSize ?? 0, columns: cols, entries: parsed.length });
        allEntries.push(...parsed);
      } catch (e) {
        filesInZip.push({ filename: entry.filename, sizeBytes: 0, columns: 0, entries: 0 });
      }
    }
    await reader.close();

    let persisted = 0;
    if (persist && allEntries.length) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // upsert em lotes
      const batchSize = 500;
      for (let i = 0; i < allEntries.length; i += batchSize) {
        const batch = allEntries.slice(i, i + batchSize);
        const { error } = await admin.from("cvm_data_dictionary").upsert(batch, { onConflict: "table_name,column_name" });
        if (!error) persisted += batch.length;
      }
    }

    // agrupa por tabela para resposta
    const byTable = new Map<string, DictEntry[]>();
    for (const e of allEntries) {
      const k = e.table_name;
      const arr = byTable.get(k) ?? [];
      arr.push(e);
      byTable.set(k, arr);
    }
    const tables = Array.from(byTable.entries()).map(([table_name, columns]) => ({
      table_name, columnCount: columns.length, columns,
    }));

    return new Response(JSON.stringify({
      url: META_URL, fileSizeBytes: ab.byteLength,
      filesInZip, tables, totalColumns: allEntries.length, persisted,
      elapsedMs: Date.now() - t0,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
