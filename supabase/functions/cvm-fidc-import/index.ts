// POC: baixa o ZIP mensal de Informe Mensal FIDC dos Dados Abertos da CVM,
// processa os CSVs em STREAMING (linha a linha por entry) — só faz parse
// completo da linha quando o CNPJ está na lista-alvo, evitando estouro de CPU.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import * as zip from "npm:@zip.js/zip.js@2.7.45";

type ImportRequest = {
  referenceMonth: string;       // YYYYMM
  targetCnpjs: string[];        // dígitos apenas (Cadastro Mestre)
  positionCnpjs?: string[];     // subset com posição na Butiá
};

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const parseBR = (v: string | undefined | null): number | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s.toUpperCase() === "NA") return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};

// Split rápido — usa split(";") direto quando não há aspas (caso geral).
function splitFast(line: string): string[] {
  if (line.indexOf('"') < 0) return line.split(";");
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ";") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function cnpjColIndex(header: string[]): number {
  const cands = ["CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO", "CNPJ_FUNDO_COND", "CNPJ"];
  for (const c of cands) { const i = header.indexOf(c); if (i >= 0) return i; }
  return -1;
}

type FidcAgg = {
  cnpj: string;
  denomFundo?: string;
  pl?: number | null;
  creditRights?: number | null;
  pdd?: number | null;
  caixaAmpliado?: number | null;
  cash?: number | null;
  vbTotal?: number | null;
  viBTotal?: number | null;
  vb1?: number; vb2?: number; vb3?: number; vb4?: number;
  vib1?: number; vib2?: number; vib3?: number; vib4?: number;
  repurchase?: number | null;
  investors?: number | null;
  classes: Array<{ name: string; type?: string; pl?: number | null; quotaValue?: number | null; numberOfQuotas?: number | null; monthlyYieldPct?: number | null }>;
};

function ensureAgg(map: Map<string, FidcAgg>, cnpj: string): FidcAgg {
  let a = map.get(cnpj);
  if (!a) { a = { cnpj, classes: [] }; map.set(cnpj, a); }
  return a;
}

const upper = (s: string | undefined) => (s ?? "").toUpperCase();
const includesAny = (text: string, keys: string[]) => { for (const k of keys) if (text.includes(k)) return true; return false; };

// Dispatcher por tabela — recebe linha já parseada com CNPJ alvo confirmado.
function dispatch(tabKind: string, row: Record<string, string>, a: FidcAgg) {
  // metadado
  if (!a.denomFundo) a.denomFundo = row["DENOM_SOCIAL"] || row["DENOM_FUNDO"] || row["DENOM_FUNDO_CLASSE"] || "";

  const num = (names: string[]) => {
    for (const n of names) { const v = row[n]; if (v !== undefined && v !== "") return parseBR(v); }
    return null;
  };
  const txtAtivo = upper(row["TP_ATIVO"] || row["TP_APLIC"] || row["DS_TP_ATIVO"] || row["TP_TITULO"] || row["TP_INSTR"] || row["CD_ATIVO"] || "");

  if (tabKind === "I") {
    const v = num(["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL", "VL"]);
    if (v == null) return;
    if (includesAny(txtAtivo, ["DISPONIBILIDADE"])) a.cash = (a.cash ?? 0) + v;
    else if (includesAny(txtAtivo, ["PROVISAO", "PROVISÃO", "PDD"])) a.pdd = (a.pdd ?? 0) + Math.abs(v);
    else if (includesAny(txtAtivo, ["DIREITOS CREDITORIOS", "DIREITO CREDITORIO", "DIREITOS CREDITÓRIOS"])) a.creditRights = (a.creditRights ?? 0) + v;
    else if (includesAny(txtAtivo, ["VALORES MOBILIARIOS", "TITULOS PUBLICOS", "CERTIFICADO DE DEPOSITO", "COMPROMISSADAS", "RENDA FIXA", "COTAS DE FIDC", "COTAS DE FUNDOS", "WARRANT"])) {
      a.caixaAmpliado = (a.caixaAmpliado ?? 0) + v;
    }
  } else if (tabKind === "IV") {
    const v = num(["VL_PATRIM_LIQ", "VL_PL", "VL_TOTAL", "PATRIM_LIQ"]);
    if (v != null) a.pl = a.pl == null ? v : Math.max(a.pl, v);
  } else if (tabKind === "V" || tabKind === "VI") {
    if (!includesAny(txtAtivo + upper(row["FAIXA_PRAZO"] || row["TP_PRAZO"] || ""), ["VENCID", "INADIMPL"])) return;
    const v = num(["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]); if (v == null) return;
    const txt = upper(row["TP_PRAZO"] || row["FAIXA_PRAZO"]);
    if (tabKind === "V") {
      a.vbTotal = (a.vbTotal ?? 0) + v;
      if (/30/.test(txt)) a.vb1 = (a.vb1 ?? 0) + v;
      else if (/60/.test(txt)) a.vb2 = (a.vb2 ?? 0) + v;
      else if (/90/.test(txt)) a.vb3 = (a.vb3 ?? 0) + v;
      else if (/120/.test(txt)) a.vb4 = (a.vb4 ?? 0) + v;
    } else {
      a.viBTotal = (a.viBTotal ?? 0) + v;
      if (/30/.test(txt)) a.vib1 = (a.vib1 ?? 0) + v;
      else if (/60/.test(txt)) a.vib2 = (a.vib2 ?? 0) + v;
      else if (/90/.test(txt)) a.vib3 = (a.vib3 ?? 0) + v;
      else if (/120/.test(txt)) a.vib4 = (a.vib4 ?? 0) + v;
    }
  } else if (tabKind === "VII") {
    if (!includesAny(txtAtivo + upper(row["TP_OPER"] || row["TP_NEG"] || ""), ["RECOMPRA"])) return;
    const v = num(["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]);
    if (v != null) a.repurchase = (a.repurchase ?? 0) + v;
  } else if (tabKind === "X1") {
    const v = num(["NR_COTST", "QT_COTST", "NR_INVEST"]);
    if (v != null) a.investors = Math.max(a.investors ?? 0, Math.round(v));
  } else if (tabKind === "X2") {
    const name = row["DENOM_CLASSE"] || row["DENOM_CLASSE_COTA"] || row["TP_CLASSE"] || row["CLASSE"] || "Classe única";
    a.classes.push({
      name,
      type: row["TP_CLASSE"] || row["TP_SERIE"] || "",
      pl: num(["VL_PATRIM_LIQ", "VL_PL", "PATRIM_LIQ", "VL_TOTAL"]),
      quotaValue: num(["VL_COTA", "VL_QUOTA"]),
      numberOfQuotas: num(["QT_COTA", "QT_QUOTA"]),
    });
  } else if (tabKind === "X3") {
    const name = row["DENOM_CLASSE"] || row["DENOM_CLASSE_COTA"] || row["TP_CLASSE"] || "";
    const yld = num(["RENTAB_MES", "RENTAB_MENSAL", "RENTAB", "PERC_RENTAB"]);
    const target = a.classes.find((c) => c.name === name) ?? a.classes[a.classes.length - 1];
    if (target && yld != null) target.monthlyYieldPct = yld;
  }
}

// Identifica que tabela é, pelo nome do arquivo.
function classifyTab(lower: string): string | null {
  if (/_tab_x[_.]?1[_.]/.test(lower)) return "X1";
  if (/_tab_x[_.]?2[_.]/.test(lower)) return "X2";
  if (/_tab_x[_.]?3[_.]/.test(lower)) return "X3";
  if (/_tab_vii[_.]/.test(lower)) return "VII";
  if (/_tab_vi[_.]/.test(lower)) return "VI";
  if (/_tab_v[_.]/.test(lower)) return "V";
  if (/_tab_iv[_.]/.test(lower)) return "IV";
  if (/_tab_i[_.]/.test(lower)) return "I";
  return null;
}

// Lê um entry em streaming, processando linha a linha sem materializar todo o CSV.
async function streamCsvEntry(entry: zip.Entry, tabKind: string, targetSet: Set<string>, agg: Map<string, FidcAgg>, allCnpjs: Set<string>): Promise<number> {
  const decoder = new TextDecoder("iso-8859-1");
  let buffer = "";
  let header: string[] = [];
  let idxCnpj = -1;
  let total = 0;

  const handleLine = (line: string) => {
    if (!line) return;
    if (!header.length) {
      header = line.split(";").map((h) => h.trim().toUpperCase());
      idxCnpj = cnpjColIndex(header);
      return;
    }
    total++;
    if (idxCnpj < 0) return;
    const fields = splitFast(line);
    const cnpj = onlyDigits(fields[idxCnpj]);
    if (!cnpj) return;
    if (allCnpjs.size < 30000) allCnpjs.add(cnpj); // amostragem para diagnóstico
    if (!targetSet.has(cnpj)) return;
    // Monta dict só para os alvos
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (fields[i] ?? "").trim();
    const a = ensureAgg(agg, cnpj);
    dispatch(tabKind, row, a);
  };

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, nl);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        buffer = buffer.slice(nl + 1);
        handleLine(line);
      }
    },
    close() {
      buffer += decoder.decode();
      if (buffer.endsWith("\r")) buffer = buffer.slice(0, -1);
      if (buffer) handleLine(buffer);
    },
  });

  // zip.js v2 aceita um WritableStream em getData
  await (entry as any).getData(writable);
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as ImportRequest;
    const ref = String(body.referenceMonth || "").trim();
    if (!/^\d{6}$/.test(ref)) {
      return new Response(JSON.stringify({ error: "referenceMonth deve ser AAAAMM" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const url = `https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_${ref}.zip`;
    const targetSet = new Set((body.targetCnpjs || []).map(onlyDigits).filter(Boolean));
    const positionSet = new Set((body.positionCnpjs || []).map(onlyDigits).filter(Boolean));

    const readErrors: string[] = [];
    const alerts: string[] = [];
    const t0 = Date.now();

    const resp = await fetch(url);
    if (!resp.ok) {
      return new Response(JSON.stringify({
        referenceMonth: ref, url, fileSizeBytes: 0, fileHash: "", status: `HTTP ${resp.status}`,
        filesInZip: [], rowsByFile: {}, totalCnpjs: 0,
        mestreFound: [], mestreMissing: Array.from(targetSet),
        posFound: [], posMissing: Array.from(positionSet),
        readErrors: [`Falha no download (HTTP ${resp.status})`], alerts: [], fidcs: [],
        elapsedMs: Date.now() - t0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ab = await resp.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
    const fileHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const reader = new zip.ZipReader(new zip.BlobReader(new Blob([bytes])));
    const entries = await reader.getEntries();
    const filesInZip = entries.map((e) => e.filename);

    const agg = new Map<string, FidcAgg>();
    const rowsByFile: Record<string, number> = {};
    const allCnpjs = new Set<string>();

    for (const entry of entries) {
      if (!/\.csv$/i.test(entry.filename)) continue;
      const lower = entry.filename.toLowerCase();
      const kind = classifyTab(lower);
      if (!kind) { rowsByFile[entry.filename] = 0; continue; }
      try {
        rowsByFile[entry.filename] = await streamCsvEntry(entry, kind, targetSet, agg, allCnpjs);
      } catch (e) {
        readErrors.push(`${entry.filename}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await reader.close();

    // 3) Consolidação
    const referenceISO = `${ref.slice(0, 4)}-${ref.slice(4, 6)}-01`;
    const fidcs = Array.from(agg.values()).map((a) => {
      const overdueTotal = (a.vbTotal ?? 0) + (a.viBTotal ?? 0);
      const ovd30 = (a.vb1 ?? 0) + (a.vib1 ?? 0);
      const ovd60 = (a.vb2 ?? 0) + (a.vib2 ?? 0);
      const ovd90 = (a.vb3 ?? 0) + (a.vib3 ?? 0);
      const ovd120 = (a.vb4 ?? 0) + (a.vib4 ?? 0);
      const caixaAmpliado = (a.cash ?? 0) + (a.caixaAmpliado ?? 0);
      const sumClassesPL = a.classes.reduce((s, c) => s + (c.pl ?? 0), 0);
      const diff = (a.pl ?? 0) - sumClassesPL;
      const diffPct = a.pl ? Math.abs(diff) / a.pl : null;

      const flags: string[] = [];
      let status: "completo" | "parcial" | "cotas_ausentes" | "validacao_critica" | "nao_encontrado" = "completo";
      if (a.pl == null) flags.push("PL ausente");
      if (a.creditRights == null) flags.push("DC ausente");
      if (caixaAmpliado <= 0) flags.push("Caixa Ampliado = 0");
      if (a.pdd == null) flags.push("PDD ausente");
      if (overdueTotal <= 0) flags.push("Atrasos não detectados");
      if (!a.classes.length) { flags.push("Sem cotas/classes"); status = "cotas_ausentes"; }
      if (diffPct != null && diffPct > 0.05) { flags.push(`PL x cotas divergente (${(diffPct * 100).toFixed(2)}%)`); status = "validacao_critica"; }
      if (flags.length && status === "completo") status = "parcial";

      return {
        cnpj: a.cnpj, name: a.denomFundo ?? "", referenceMonth: referenceISO,
        pl: a.pl ?? null, creditRights: a.creditRights ?? null,
        caixaAmpliado, cash: a.cash ?? null, pdd: a.pdd ?? null,
        overdueTotal, overdue30: ovd30, overdue60: ovd60, overdue90: ovd90, overdue120: ovd120,
        repurchase: a.repurchase ?? null, investors: a.investors ?? null,
        classes: a.classes, sumClassesPL,
        plDiff: diff, plDiffPct: diffPct, flags, status,
        hasPositionInButia: positionSet.has(a.cnpj),
      };
    });

    const foundCnpjs = new Set(fidcs.map((f) => f.cnpj));
    const mestreFound: string[] = []; const mestreMissing: string[] = [];
    for (const c of targetSet) (foundCnpjs.has(c) ? mestreFound : mestreMissing).push(c);
    const posFound: string[] = []; const posMissing: string[] = [];
    for (const c of positionSet) (foundCnpjs.has(c) ? posFound : posMissing).push(c);

    if (mestreMissing.length) alerts.push(`${mestreMissing.length} CNPJ(s) do Cadastro Mestre ausentes no informe CVM.`);
    if (!Object.keys(rowsByFile).length) alerts.push("Nenhum CSV foi lido do ZIP — possível mudança de layout.");

    const payload = {
      referenceMonth: ref, url, fileSizeBytes: bytes.byteLength, fileHash, status: "ok",
      filesInZip, rowsByFile, totalCnpjs: allCnpjs.size,
      mestreFound, mestreMissing, posFound, posMissing,
      readErrors, alerts,
      fidcs: fidcs.sort((a, b) => (b.pl ?? 0) - (a.pl ?? 0)),
      elapsedMs: Date.now() - t0,
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
