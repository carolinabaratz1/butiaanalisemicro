// POC v2 — Schema Discovery + Mapeamento Configurável.
// Baixa o ZIP mensal da CVM, gera diagnóstico por arquivo (encoding, separador,
// colunas, amostra, CNPJs únicos) e diagnóstico por FIDC com status por métrica
// (found_value / found_zero / missing_column / missing_row / mapping_not_defined / parse_error).
// Nunca converte métrica ausente para zero.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as zip from "npm:@zip.js/zip.js@2.7.45";

type Req = {
  referenceMonth: string;            // AAAAMM
  targetCnpjs: string[];             // Cadastro Mestre
  positionCnpjs?: string[];          // CNPJs com posição
};

type MetricStatus =
  | "found_value" | "found_zero" | "missing_column"
  | "missing_row" | "mapping_not_defined" | "parse_error";

type MetricResult = {
  metric: string;
  value: number | string | null;
  status: MetricStatus;
  sourceFile?: string;
  sourceColumn?: string;
  rule?: string;
  rawValues?: Record<string, unknown>;
  error?: string;
};

type FileDiagnostic = {
  filename: string;
  extension: string;
  sizeBytes: number;
  rows: number;
  columns: number;
  separator: string;
  encoding: string;
  headers: string[];
  firstRows: string[][];
  uniqueCnpjsCount: number;
  exampleCnpjs: string[];
  containsMasterCnpj: boolean;
  matchedMasterCount: number;
  tableKind: string | null;          // I, IV, V, VI, VII, X1, X2, X3
};

type MappingRow = {
  metric_name: string;
  source_file_pattern: string;
  source_column: string | null;
  composite_rule: string | null;
  transformation: string | null;
  is_required: boolean;
};

const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const parseBR = (v: unknown): number | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s.toUpperCase() === "NA") return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};
const upper = (s: unknown) => String(s ?? "").toUpperCase();

function detectSeparator(line: string): string {
  const counts = { ";": (line.match(/;/g) || []).length, ",": (line.match(/,/g) || []).length, "\t": (line.match(/\t/g) || []).length };
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

function cnpjColIndex(header: string[]): number {
  const cands = ["CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO", "CNPJ_FUNDO_COND", "CNPJ"];
  for (const c of cands) { const i = header.indexOf(c); if (i >= 0) return i; }
  return header.findIndex((h) => /CNPJ/.test(h));
}

function classifyTab(lower: string): string | null {
  if (/_tab_x[_.]?1[_.]/.test(lower)) return "X1";
  if (/_tab_x[_.]?2[_.]/.test(lower)) return "X2";
  if (/_tab_x[_.]?3[_.]/.test(lower)) return "X3";
  if (/_tab_x[_.]?4[_.]/.test(lower)) return "X4";
  if (/_tab_vii[_.]/.test(lower)) return "VII";
  if (/_tab_vi[_.]/.test(lower)) return "VI";
  if (/_tab_v[_.]/.test(lower)) return "V";
  if (/_tab_iv[_.]/.test(lower)) return "IV";
  if (/_tab_iii[_.]/.test(lower)) return "III";
  if (/_tab_ii[_.]/.test(lower)) return "II";
  if (/_tab_i[_.]/.test(lower)) return "I";
  return null;
}

// Resolve um nome de coluna (com candidatos separados por '|') contra headers reais
function resolveColumn(headers: string[], cands: string | null): string | null {
  if (!cands) return null;
  const upH = headers.map((h) => h.toUpperCase().trim());
  for (const c of cands.split("|").map((s) => s.trim().toUpperCase())) {
    const idx = upH.indexOf(c);
    if (idx >= 0) return headers[idx];
    // fuzzy: contains
    const fz = upH.findIndex((h) => h.includes(c));
    if (fz >= 0) return headers[fz];
  }
  return null;
}

// Per-CNPJ collected data, by file. Acts as the staging buffer.
type SegmentItem = { code: string; name: string; level: number; parent?: string; value: number };
type QuotaFlowItem = {
  subscription_value?: number; subscription_quota_quantity?: number;
  redemption_value?: number; redemption_quota_quantity?: number;
  requested_redemption_value?: number; requested_redemption_quota_quantity?: number;
  amortization_value?: number; amortization_quota_quantity?: number;
};
type ClassRow = {
  name: string; normalizedName: string; type?: string;
  pl?: number | null; quotaValue?: number | null; numberOfQuotas?: number | null;
  rawQuotaQuantity?: string; rawQuotaValue?: string;
  parseStatus?: string; idSubclasse?: string;
  monthlyYieldPct?: number | null; rawMonthlyReturn?: string;
  investorsCount?: number | null;
  flows?: QuotaFlowItem;
};
type FidcBuffer = {
  cnpj: string;
  name?: string;
  rowsByFile: Record<string, Array<Record<string, string>>>;
  metrics: Record<string, MetricResult>;
  classes: ClassRow[];
  segments: SegmentItem[];
  segmentTotal: number | null;
};

const normalizeName = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/\|/g, " ").replace(/\s+/g, " ").trim();

async function streamEntry(
  entry: zip.Entry,
  diag: FileDiagnostic,
  targetSet: Set<string>,
  buffer: Map<string, FidcBuffer>,
  allCnpjs: Set<string>,
): Promise<void> {
  const decoder = new TextDecoder("iso-8859-1"); // CVM padrão
  diag.encoding = "iso-8859-1";
  let leftover = "";
  let header: string[] = [];
  let sep = ";";
  let idxCnpj = -1;

  const handle = (line: string) => {
    if (!line) return;
    if (!header.length) {
      sep = detectSeparator(line);
      diag.separator = sep;
      header = splitLine(line, sep).map((h) => h.trim().toUpperCase());
      diag.headers = header;
      diag.columns = header.length;
      idxCnpj = cnpjColIndex(header);
      return;
    }
    diag.rows++;
    const fields = splitLine(line, sep);
    if (diag.firstRows.length < 3) diag.firstRows.push(fields.slice(0, Math.min(fields.length, 20)));
    if (idxCnpj < 0) return;
    const cnpj = onlyDigits(fields[idxCnpj]);
    if (!cnpj) return;
    if (allCnpjs.size < 100000) allCnpjs.add(cnpj);
    if (diag.exampleCnpjs.length < 5 && !diag.exampleCnpjs.includes(cnpj)) diag.exampleCnpjs.push(cnpj);
    diag.uniqueCnpjsCount++; // contagem aproximada (linhas com CNPJ)
    if (!targetSet.has(cnpj)) return;
    diag.matchedMasterCount++;
    diag.containsMasterCnpj = true;

    // monta row dict
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (fields[i] ?? "").trim();

    let buf = buffer.get(cnpj);
    if (!buf) { buf = { cnpj, rowsByFile: {}, metrics: {}, classes: [], segments: [], segmentTotal: null }; buffer.set(cnpj, buf); }
    if (!buf.name) buf.name = row["DENOM_SOCIAL"] || row["DENOM_FUNDO"] || row["DENOM_FUNDO_CLASSE"] || "";
    const arr = (buf.rowsByFile[entry.filename] ??= []);
    if (arr.length < 100) arr.push(row);
  };

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      leftover += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = leftover.indexOf("\n")) >= 0) {
        let line = leftover.slice(0, nl);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        leftover = leftover.slice(nl + 1);
        handle(line);
      }
    },
    close() {
      leftover += decoder.decode();
      if (leftover.endsWith("\r")) leftover = leftover.slice(0, -1);
      if (leftover) handle(leftover);
    },
  });

  await (entry as unknown as { getData: (w: WritableStream) => Promise<unknown> }).getData(writable);
  diag.uniqueCnpjsCount = Math.min(diag.uniqueCnpjsCount, diag.rows);
}

// Aplica mappings sobre o conjunto coletado de linhas do FIDC.
// rule format suportadas em composite_rule:
//   sum:COL1,COL2,...                  → soma valores na MESMA linha
//   abs_sum:COL1,COL2,...              → soma de |val|
//   row_sum:filterCol=A,B|valueCol=VL  → soma de todas as linhas onde filterCol ∈ {A,B}
function extractMetrics(buf: FidcBuffer, mappings: MappingRow[], filesIndex: Map<string, FileDiagnostic>) {
  for (const m of mappings) {
    // localiza arquivo(s) cuja key contém o pattern
    const fileKey = [...Object.keys(buf.rowsByFile)].find((fn) => fn.toLowerCase().includes(m.source_file_pattern.toLowerCase()));
    if (!fileKey) {
      // fallback: arquivo existe no ZIP mas o CNPJ não apareceu nele
      const inZip = [...filesIndex.keys()].find((fn) => fn.toLowerCase().includes(m.source_file_pattern.toLowerCase()));
      buf.metrics[m.metric_name] = {
        metric: m.metric_name,
        value: null,
        status: inZip ? "missing_row" : "missing_column",
        sourceFile: inZip ?? undefined,
        sourceColumn: m.source_column ?? m.composite_rule ?? undefined,
        rule: m.composite_rule ?? undefined,
      };
      continue;
    }
    const rows = buf.rowsByFile[fileKey];
    const fileDiag = filesIndex.get(fileKey);
    const headers = fileDiag?.headers ?? Object.keys(rows[0] ?? {});

    try {
      let value: number | string | null = null;
      let status: MetricStatus = "mapping_not_defined";
      const rawValues: Record<string, unknown> = {};
      let resolvedCol: string | null = null;

      if (m.composite_rule) {
        const [kind, args] = m.composite_rule.split(":");
        const cols = (args ?? "").split(/[,+]/).map((s) => s.trim()).filter(Boolean);
        const resolved = cols.map((c) => ({ candidate: c, resolved: resolveColumn(headers, c) }));
        const missing = resolved.filter((r) => !r.resolved).map((r) => r.candidate);
        if (resolved.every((r) => !r.resolved)) {
          status = "missing_column";
          buf.metrics[m.metric_name] = { metric: m.metric_name, value: null, status, sourceFile: fileKey, rule: m.composite_rule, error: `colunas não encontradas: ${missing.join(",")}` };
          continue;
        }
        let total = 0; let anyFound = false;
        for (const r of resolved) {
          if (!r.resolved) continue;
          for (const row of rows) {
            const raw = row[r.resolved];
            const n = parseBR(raw);
            rawValues[r.resolved] = raw;
            if (n != null) {
              total += kind === "abs_sum" ? Math.abs(n) : n;
              anyFound = true;
            }
          }
        }
        value = anyFound ? total : null;
        status = !anyFound ? "missing_row" : total === 0 ? "found_zero" : "found_value";
        buf.metrics[m.metric_name] = { metric: m.metric_name, value, status, sourceFile: fileKey, rule: m.composite_rule, rawValues };
        continue;
      }

      if (!m.source_column) {
        buf.metrics[m.metric_name] = { metric: m.metric_name, value: null, status: "mapping_not_defined", sourceFile: fileKey };
        continue;
      }
      resolvedCol = resolveColumn(headers, m.source_column);
      if (!resolvedCol) {
        buf.metrics[m.metric_name] = { metric: m.metric_name, value: null, status: "missing_column", sourceFile: fileKey, sourceColumn: m.source_column };
        continue;
      }
      // pega valor da primeira linha não vazia
      let raw: string | undefined;
      for (const row of rows) {
        const v = row[resolvedCol];
        if (v !== undefined && v !== "") { raw = v; break; }
      }
      rawValues[resolvedCol] = raw;
      if (raw === undefined || raw === "") {
        status = "missing_row";
        value = null;
      } else if (m.transformation === "int") {
        const n = parseBR(raw);
        value = n == null ? null : Math.round(n);
        status = n == null ? "parse_error" : n === 0 ? "found_zero" : "found_value";
      } else if (m.transformation === "text") {
        value = String(raw);
        status = "found_value";
      } else {
        const n = parseBR(raw);
        if (n == null) { status = "parse_error"; value = null; }
        else if (m.transformation === "abs") { value = Math.abs(n); status = n === 0 ? "found_zero" : "found_value"; }
        else { value = n; status = n === 0 ? "found_zero" : "found_value"; }
      }
      buf.metrics[m.metric_name] = { metric: m.metric_name, value, status, sourceFile: fileKey, sourceColumn: resolvedCol, rawValues };
    } catch (e) {
      buf.metrics[m.metric_name] = { metric: m.metric_name, value: null, status: "parse_error", sourceFile: fileKey, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Classes (X2): coleta lista (não é mapeamento simples)
  const x2Key = Object.keys(buf.rowsByFile).find((fn) => /_tab_x[_.]?2[_.]/.test(fn.toLowerCase()));
  if (x2Key) {
    for (const row of buf.rowsByFile[x2Key]) {
      const name = row["DENOM_CLASSE"] || row["DENOM_CLASSE_COTA"] || row["TP_CLASSE"] || row["CLASSE"] || "Classe única";
      buf.classes.push({
        name,
        type: row["TP_CLASSE"] || row["TP_SERIE"] || "",
        pl: parseBR(row["VL_PATRIM_LIQ"] || row["VL_PL"] || row["VL_TOTAL"]),
        quotaValue: parseBR(row["VL_COTA"] || row["VL_QUOTA"]),
        numberOfQuotas: parseBR(row["QT_COTA"] || row["QT_QUOTA"]),
      });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();
  try {
    const body = (await req.json()) as Req;
    const ref = String(body.referenceMonth || "").trim();
    if (!/^\d{6}$/.test(ref)) {
      return new Response(JSON.stringify({ error: "referenceMonth deve ser AAAAMM" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const url = `https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_${ref}.zip`;
    const targetSet = new Set((body.targetCnpjs || []).map(onlyDigits).filter(Boolean));
    const positionSet = new Set((body.positionCnpjs || []).map(onlyDigits).filter(Boolean));

    // Carrega mapeamento atual
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: mappings = [] } = await admin
      .from("cvm_fidc_field_mapping")
      .select("metric_name, source_file_pattern, source_column, composite_rule, transformation, is_required");

    const resp = await fetch(url);
    if (!resp.ok) {
      return new Response(JSON.stringify({
        referenceMonth: ref, url, fileSizeBytes: 0, fileHash: "",
        status: `HTTP ${resp.status}`, files: [], totalCnpjs: 0,
        mestreFound: [], mestreMissing: Array.from(targetSet),
        posFound: [], posMissing: Array.from(positionSet),
        readErrors: [`Falha no download (HTTP ${resp.status})`], alerts: [],
        fidcs: [], mappingsUsed: mappings, elapsedMs: Date.now() - t0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ab = await resp.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
    const fileHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const reader = new zip.ZipReader(new zip.BlobReader(new Blob([bytes])));
    const entries = await reader.getEntries();

    const filesIndex = new Map<string, FileDiagnostic>();
    const buffer = new Map<string, FidcBuffer>();
    const allCnpjs = new Set<string>();
    const readErrors: string[] = [];

    for (const entry of entries) {
      const filename = entry.filename;
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const diag: FileDiagnostic = {
        filename, extension: ext,
        sizeBytes: (entry as unknown as { uncompressedSize?: number }).uncompressedSize ?? 0,
        rows: 0, columns: 0, separator: "?", encoding: "?",
        headers: [], firstRows: [], uniqueCnpjsCount: 0, exampleCnpjs: [],
        containsMasterCnpj: false, matchedMasterCount: 0,
        tableKind: classifyTab(filename.toLowerCase()),
      };
      filesIndex.set(filename, diag);
      if (ext !== "csv") continue;
      try {
        await streamEntry(entry, diag, targetSet, buffer, allCnpjs);
      } catch (e) {
        readErrors.push(`${filename}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await reader.close();

    // Aplica mappings sobre cada FIDC do alvo
    for (const buf of buffer.values()) {
      extractMetrics(buf, mappings as MappingRow[], filesIndex);
    }

    // === Derivações cross-file (TAB V + TAB VI) ===
    // overdue_value, delinquency_30_plus, ..., 120_plus, prepaid_value
    const derive = (buf: FidcBuffer, name: string, parts: string[], sourceFiles: string[]) => {
      let total = 0; let anyFound = false; let anyMissingCol = false;
      const rawValues: Record<string, unknown> = {};
      for (const p of parts) {
        const m = buf.metrics[p];
        if (!m) { anyMissingCol = true; continue; }
        rawValues[p] = m.value;
        if (m.status === "found_value" || m.status === "found_zero") {
          if (typeof m.value === "number") { total += m.value; anyFound = true; }
        } else if (m.status === "missing_column") {
          anyMissingCol = true;
        }
      }
      buf.metrics[name] = {
        metric: name,
        value: anyFound ? total : null,
        status: anyFound ? (total === 0 ? "found_zero" : "found_value") : (anyMissingCol ? "missing_column" : "missing_row"),
        sourceFile: sourceFiles.join("+"),
        rule: `derived:sum(${parts.join(",")})`,
        rawValues,
      };
    };
    for (const buf of buffer.values()) {
      // totais
      derive(buf, "overdue_value", ["tab_v_overdue_total", "tab_vi_overdue_total"], ["TAB_V", "TAB_VI"]);
      derive(buf, "prepaid_value", ["tab_v_prepaid_total", "tab_vi_prepaid_total"], ["TAB_V", "TAB_VI"]);
      // buckets consolidados
      const bks = ["30","60","90","120","150","180","360","720","1080","1080p"];
      for (const b of bks) {
        derive(buf, `delinquency_${b}_value`, [`tab_v_overdue_${b}`, `tab_vi_overdue_${b}`], ["TAB_V","TAB_VI"]);
      }
      // 30+, 60+, 90+, 120+
      derive(buf, "delinquency_30_plus_value",  bks.slice(1).map((b) => `delinquency_${b}_value`), ["derived"]);
      derive(buf, "delinquency_60_plus_value",  bks.slice(2).map((b) => `delinquency_${b}_value`), ["derived"]);
      derive(buf, "delinquency_90_plus_value",  bks.slice(3).map((b) => `delinquency_${b}_value`), ["derived"]);
      derive(buf, "delinquency_120_plus_value", bks.slice(4).map((b) => `delinquency_${b}_value`), ["derived"]);
      // DC bruto = DC + PDD
      const dc = buf.metrics["credit_rights_value"];
      const pdd = buf.metrics["pdd_value"];
      if (dc && pdd && (dc.status === "found_value" || dc.status === "found_zero") &&
          (pdd.status === "found_value" || pdd.status === "found_zero")) {
        const gross = (dc.value as number) + (pdd.value as number);
        buf.metrics["credit_rights_gross_value"] = {
          metric: "credit_rights_gross_value", value: gross,
          status: gross === 0 ? "found_zero" : "found_value",
          rule: "derived:DC+PDD", sourceFile: "TAB_I",
        };
      }
    }

    // Resumo final por FIDC
    const referenceISO = `${ref.slice(0, 4)}-${ref.slice(4, 6)}-01`;
    const fidcs = Array.from(buffer.values()).map((buf) => {
      const get = (k: string) => buf.metrics[k];
      const value = (k: string) => {
        const m = get(k); return m && (m.status === "found_value" || m.status === "found_zero") ? (m.value as number) : null;
      };
      const pl = value("nav_value");
      const dc = value("credit_rights_value");
      const sumClassesPL = buf.classes.reduce((s, c) => s + (c.pl ?? 0), 0);
      const diff = pl != null ? pl - sumClassesPL : null;
      const diffPct = pl ? Math.abs(diff! / pl) : null;
      const missing: string[] = [];
      for (const m of mappings) {
        const r = buf.metrics[m.metric_name];
        if (!r || r.status === "missing_column" || r.status === "missing_row" || r.status === "mapping_not_defined" || r.status === "parse_error") {
          missing.push(m.metric_name);
        }
      }
      let status: "completo" | "parcial" | "mapping_error" | "validacao_critica" = "completo";
      const plMeta = buf.metrics["nav_value"];
      if (!plMeta || plMeta.status === "missing_column" || plMeta.status === "missing_row" || plMeta.status === "mapping_not_defined") {
        status = "mapping_error";
      } else if (missing.length) status = "parcial";
      if (diffPct != null && diffPct > 0.05) status = "validacao_critica";

      return {
        cnpj: buf.cnpj, name: buf.name ?? "", referenceMonth: referenceISO,
        metrics: buf.metrics,
        classes: buf.classes,
        rowsByFile: Object.fromEntries(Object.entries(buf.rowsByFile).map(([k, v]) => [k, v.slice(0, 5)])),
        pl, creditRights: dc,
        creditRightsGross: value("credit_rights_gross_value"),
        totalAssets: value("total_assets"),
        totalLiabilities: value("total_liabilities"),
        avgNav: value("avg_nav_value"),
        caixaAmpliado: value("cash_value"),
        cashStrict: value("cash_strict_value"),
        pdd: value("pdd_value"),
        overdueTotal: value("overdue_value"),
        overdue30: value("delinquency_30_plus_value"),
        overdue60: value("delinquency_60_plus_value"),
        overdue90: value("delinquency_90_plus_value"),
        overdue120: value("delinquency_120_plus_value"),
        prepaid: value("prepaid_value"),
        repurchase: value("repurchase_value"),
        substitution: value("substitution_value"),
        acquisitionWithRisk: value("acquisition_with_risk_value"),
        acquisitionWithoutRisk: value("acquisition_without_risk_value"),
        investors: value("investors_count"),
        sumClassesPL, plDiff: diff, plDiffPct: diffPct,
        missingMetrics: missing,
        status,
        hasPositionInButia: positionSet.has(buf.cnpj),
      };
    });

    const foundSet = new Set(fidcs.map((f) => f.cnpj));
    const mestreFound: string[] = []; const mestreMissing: string[] = [];
    for (const c of targetSet) (foundSet.has(c) ? mestreFound : mestreMissing).push(c);
    const posFound: string[] = []; const posMissing: string[] = [];
    for (const c of positionSet) (foundSet.has(c) ? posFound : posMissing).push(c);

    const alerts: string[] = [];
    if (!filesIndex.size) alerts.push("ZIP sem arquivos.");
    if (mestreMissing.length) alerts.push(`${mestreMissing.length} CNPJ(s) do Cadastro Mestre ausentes no informe CVM.`);
    const mappingErrors = fidcs.filter((f) => f.status === "mapping_error").length;
    if (mappingErrors) alerts.push(`${mappingErrors} FIDC(s) com erro de mapeamento (CNPJ presente na CVM mas PL não encontrado).`);

    const payload = {
      referenceMonth: ref, url, fileSizeBytes: bytes.byteLength, fileHash, status: "ok",
      files: Array.from(filesIndex.values()),
      totalCnpjs: allCnpjs.size,
      mestreFound, mestreMissing, posFound, posMissing,
      readErrors, alerts,
      fidcs: fidcs.sort((a, b) => (b.pl ?? 0) - (a.pl ?? 0)),
      mappingsUsed: mappings,
      elapsedMs: Date.now() - t0,
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
