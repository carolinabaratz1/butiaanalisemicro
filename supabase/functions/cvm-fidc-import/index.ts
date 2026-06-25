// POC: baixa o ZIP mensal de Informe Mensal FIDC dos Dados Abertos da CVM,
// descompacta os CSVs em memória, filtra os CNPJs-alvo (Cadastro Mestre + posições)
// e devolve um diagnóstico estruturado. NÃO grava no banco.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import * as zip from "npm:@zip.js/zip.js@2.7.45";

type ImportRequest = {
  referenceMonth: string; // YYYYMM
  targetCnpjs: string[];  // dígitos apenas (Cadastro Mestre + posições)
  positionCnpjs?: string[]; // subset com posição na Butiá
};

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const parseBR = (v: string | undefined | null): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s.toUpperCase() === "NA") return null;
  // CVM usa "," como decimal e "." como milhar (às vezes); pode vir já em ponto
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};

function splitCsvLine(line: string): string[] {
  // CVM usa ; como separador, sem aspas em geral. Aceita aspas por segurança.
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function readCsv(text: string): Promise<{ header: string[]; rows: string[][]; total: number }> {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) return { header: [], rows: [], total: 0 };
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase());
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows, total: rows.length };
}

// Resolve qual coluna usar como CNPJ — varia entre meses (CNPJ_FUNDO vs CNPJ_FUNDO_CLASSE).
function cnpjColIndex(header: string[]): number {
  const candidates = ["CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO", "CNPJ_FUNDO_COND", "CNPJ"];
  for (const c of candidates) {
    const i = header.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}
function colIndex(header: string[], names: string[]): number {
  for (const n of names) { const i = header.indexOf(n.toUpperCase()); if (i >= 0) return i; }
  return -1;
}

// Métricas a serem agregadas por FIDC
type FidcAgg = {
  cnpj: string;
  denomFundo?: string;
  pl?: number | null;            // IV.a
  creditRights?: number | null;  // I.2.a + I.2.b (campo bruto)
  pdd?: number | null;           // |I.2.a.10| + |I.2.b.10|
  caixaAmpliado?: number | null; // I.1 + I.2.c..i
  cash?: number | null;          // I.1
  vbTotal?: number | null;       // V.b total (DC vencidos)
  viBTotal?: number | null;      // VI.b total (outros vencidos)
  vb1?: number | null; vb2?: number | null; vb3?: number | null; vb4?: number | null;
  vib1?: number | null; vib2?: number | null; vib3?: number | null; vib4?: number | null;
  repurchase?: number | null;    // VII.d.2
  investors?: number | null;     // X.1 NR_COTST
  classes: Array<{
    name: string;
    type?: string;
    pl?: number | null;
    quotaValue?: number | null;
    monthlyYieldPct?: number | null;
    numberOfQuotas?: number | null;
  }>;
};

function ensureAgg(map: Map<string, FidcAgg>, cnpj: string): FidcAgg {
  let a = map.get(cnpj);
  if (!a) { a = { cnpj, classes: [] }; map.set(cnpj, a); }
  return a;
}

// Mapeamento textual leve para reconhecer linhas das tabelas I, IV, V, VI, VII, X
// CVM publica os valores em coluna(s) "VL_*"; usamos o nome do item ou um código quando disponível.
function processGenericTab(opts: {
  rows: string[][]; header: string[]; targets: Set<string>; agg: Map<string, FidcAgg>;
  matchers: Array<{
    when: (row: Record<string, string>) => boolean;
    apply: (a: FidcAgg, row: Record<string, string>) => void;
  }>;
}) {
  const idxCnpj = cnpjColIndex(opts.header);
  if (idxCnpj < 0) return;
  for (const r of opts.rows) {
    const cnpj = onlyDigits(r[idxCnpj]);
    if (!cnpj || !opts.targets.has(cnpj)) continue;
    const row: Record<string, string> = {};
    opts.header.forEach((h, i) => (row[h] = (r[i] ?? "").trim()));
    const a = ensureAgg(opts.agg, cnpj);
    if (!a.denomFundo) {
      a.denomFundo = row["DENOM_SOCIAL"] || row["DENOM_FUNDO"] || row["DENOM_FUNDO_CLASSE"] || a.denomFundo;
    }
    for (const m of opts.matchers) if (m.when(row)) m.apply(a, row);
  }
}

const HAS_KEYWORDS = (row: Record<string, string>, keys: string[]): string | null => {
  const text = (row["DENOM_FUNDO"] || row["TP_ATIVO"] || row["TP_APLIC"] || row["TP_CARTEIRA"] || row["TP_TITULO"] || row["TP_INSTR"] || row["CD_PASS"] || row["CD_ATIVO"] || row["DS_TP_ATIVO"] || row["TP_DOC"] || "").toUpperCase();
  for (const k of keys) if (text.includes(k.toUpperCase())) return k;
  return null;
};

function getNum(row: Record<string, string>, names: string[]): number | null {
  for (const n of names) { const v = row[n.toUpperCase()]; if (v !== undefined && v !== "") return parseBR(v); }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as ImportRequest;
    const ref = String(body.referenceMonth || "").trim();
    if (!/^\d{6}$/.test(ref)) {
      return new Response(JSON.stringify({ error: "referenceMonth deve ser AAAAMM" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const url = `https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_${ref}.zip`;
    const targetSet = new Set((body.targetCnpjs || []).map(onlyDigits).filter(Boolean));
    const positionSet = new Set((body.positionCnpjs || []).map(onlyDigits).filter(Boolean));

    const readErrors: string[] = [];
    const alerts: string[] = [];
    const t0 = Date.now();

    // 1) Download
    let bytes: Uint8Array;
    let fileHash = "";
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        return new Response(JSON.stringify({
          referenceMonth: ref, url, fileSizeBytes: 0,
          status: `HTTP ${resp.status}`, filesInZip: [], rowsByFile: {},
          totalCnpjs: 0, mestreFound: [], mestreMissing: Array.from(targetSet),
          posFound: [], posMissing: Array.from(positionSet),
          readErrors: [`Falha no download (HTTP ${resp.status})`], alerts: [], fidcs: [],
          elapsedMs: Date.now() - t0,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ab = await resp.arrayBuffer();
      bytes = new Uint8Array(ab);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      fileHash = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    } catch (e) {
      return new Response(JSON.stringify({ error: `Falha no download: ${e instanceof Error ? e.message : String(e)}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Descompactar
    const blob = new Blob([bytes]);
    const reader = new zip.ZipReader(new zip.BlobReader(blob));
    const entries = await reader.getEntries();
    const filesInZip = entries.map((e) => e.filename);
    const csvFiles = entries.filter((e) => /\.csv$/i.test(e.filename));

    const agg = new Map<string, FidcAgg>();
    const rowsByFile: Record<string, number> = {};
    const allCnpjs = new Set<string>();

    for (const entry of csvFiles) {
      try {
        const writer = new zip.TextWriter("iso-8859-1");
        const text = await entry.getData!(writer);
        const { header, rows, total } = await readCsv(text);
        rowsByFile[entry.filename] = total;

        // Coletar todos CNPJs presentes
        const idxCnpjGlobal = cnpjColIndex(header);
        if (idxCnpjGlobal >= 0) {
          for (const r of rows) {
            const c = onlyDigits(r[idxCnpjGlobal]);
            if (c) allCnpjs.add(c);
          }
        }

        const lower = entry.filename.toLowerCase();

        // ----- Tabela I — Ativos -----
        if (/_tab_i_|_tab_i\.|tab_i_/.test(lower) && !/_tab_ii_|_tab_iii_|_tab_iv_/.test(lower)) {
          processGenericTab({
            rows, header, targets: targetSet, agg,
            matchers: [
              // I.1 - Disponibilidades / Caixa
              {
                when: (row) => HAS_KEYWORDS(row, ["DISPONIBILIDADES", "DISPONIBILIDADE"]) != null,
                apply: (a, row) => {
                  const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL", "VL"]);
                  if (v != null) a.cash = (a.cash ?? 0) + v;
                },
              },
              // I.2.a + I.2.b — Direitos Creditórios
              {
                when: (row) => HAS_KEYWORDS(row, ["DIREITOS CREDITORIOS", "DIREITO CREDITORIO", "DIREITOS CREDITÓRIOS"]) != null,
                apply: (a, row) => {
                  const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]);
                  if (v != null) a.creditRights = (a.creditRights ?? 0) + v;
                },
              },
              // I.2.a.10 / I.2.b.10 — PDD (provisão); valores em geral negativos
              {
                when: (row) => HAS_KEYWORDS(row, ["PROVISAO", "PROVISÃO", "PDD"]) != null,
                apply: (a, row) => {
                  const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]);
                  if (v != null) a.pdd = (a.pdd ?? 0) + Math.abs(v);
                },
              },
              // I.2.c..i — Caixa Ampliado (renda fixa, TPF, CDBs, compromissadas, outros RF, cotas de FIDC, warrants)
              {
                when: (row) => HAS_KEYWORDS(row, [
                  "VALORES MOBILIARIOS", "TITULOS PUBLICOS FEDERAIS", "CERTIFICADO DE DEPOSITO",
                  "OPERACOES COMPROMISSADAS", "RENDA FIXA", "COTAS DE FIDC", "COTAS DE FUNDOS DE INVEST",
                  "WARRANTS", "CONTRATOS DE COMPRA E VENDA",
                ]) != null,
                apply: (a, row) => {
                  const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]);
                  if (v != null) a.caixaAmpliado = (a.caixaAmpliado ?? 0) + v;
                },
              },
            ],
          });
        }

        // ----- Tabela IV — Patrimônio Líquido -----
        if (/_tab_iv_/.test(lower)) {
          const idxCnpj = cnpjColIndex(header);
          for (const r of rows) {
            const cnpj = onlyDigits(r[idxCnpj]); if (!cnpj || !targetSet.has(cnpj)) continue;
            const row: Record<string, string> = {}; header.forEach((h, i) => (row[h] = (r[i] ?? "").trim()));
            const a = ensureAgg(agg, cnpj);
            const v = getNum(row, ["VL_PATRIM_LIQ", "VL_PL", "VL_TOTAL", "PATRIM_LIQ"]);
            if (v != null) a.pl = (a.pl == null ? v : Math.max(a.pl, v));
          }
        }

        // ----- Tabela V — Atrasos em DC -----
        if (/_tab_v_/.test(lower) && !/_tab_vi_|_tab_vii_/.test(lower)) {
          processGenericTab({
            rows, header, targets: targetSet, agg,
            matchers: [{
              when: (row) => HAS_KEYWORDS(row, ["VENCID", "INADIMPL"]) != null,
              apply: (a, row) => {
                const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]); if (v == null) return;
                const txt = (row["TP_PRAZO"] || row["FAIXA_PRAZO"] || row["DENOM_FUNDO"] || "").toUpperCase();
                a.vbTotal = (a.vbTotal ?? 0) + v;
                if (/30/.test(txt)) a.vb1 = (a.vb1 ?? 0) + v;
                else if (/60/.test(txt)) a.vb2 = (a.vb2 ?? 0) + v;
                else if (/90/.test(txt)) a.vb3 = (a.vb3 ?? 0) + v;
                else if (/120/.test(txt)) a.vb4 = (a.vb4 ?? 0) + v;
              },
            }],
          });
        }

        // ----- Tabela VI — Atrasos em outros ativos -----
        if (/_tab_vi_/.test(lower)) {
          processGenericTab({
            rows, header, targets: targetSet, agg,
            matchers: [{
              when: (row) => HAS_KEYWORDS(row, ["VENCID", "INADIMPL"]) != null,
              apply: (a, row) => {
                const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]); if (v == null) return;
                const txt = (row["TP_PRAZO"] || row["FAIXA_PRAZO"] || row["DENOM_FUNDO"] || "").toUpperCase();
                a.viBTotal = (a.viBTotal ?? 0) + v;
                if (/30/.test(txt)) a.vib1 = (a.vib1 ?? 0) + v;
                else if (/60/.test(txt)) a.vib2 = (a.vib2 ?? 0) + v;
                else if (/90/.test(txt)) a.vib3 = (a.vib3 ?? 0) + v;
                else if (/120/.test(txt)) a.vib4 = (a.vib4 ?? 0) + v;
              },
            }],
          });
        }

        // ----- Tabela VII — Negócios; VII.d.2 recompras -----
        if (/_tab_vii_/.test(lower)) {
          processGenericTab({
            rows, header, targets: targetSet, agg,
            matchers: [{
              when: (row) => HAS_KEYWORDS(row, ["RECOMPRA"]) != null,
              apply: (a, row) => {
                const v = getNum(row, ["VL_MERC_POS_FINAL", "VL_TOTAL", "VL_ATUAL"]);
                if (v != null) a.repurchase = (a.repurchase ?? 0) + v;
              },
            }],
          });
        }

        // ----- Tabela X.1 — Cotistas -----
        if (/_tab_x_1_|_tab_x1_/.test(lower)) {
          const idxCnpj = cnpjColIndex(header);
          for (const r of rows) {
            const cnpj = onlyDigits(r[idxCnpj]); if (!cnpj || !targetSet.has(cnpj)) continue;
            const row: Record<string, string> = {}; header.forEach((h, i) => (row[h] = (r[i] ?? "").trim()));
            const a = ensureAgg(agg, cnpj);
            const v = getNum(row, ["NR_COTST", "QT_COTST", "NR_INVEST"]);
            if (v != null) a.investors = Math.max(a.investors ?? 0, Math.round(v));
          }
        }

        // ----- Tabela X.2 — Classes de cota -----
        if (/_tab_x_2_|_tab_x2_/.test(lower)) {
          const idxCnpj = cnpjColIndex(header);
          for (const r of rows) {
            const cnpj = onlyDigits(r[idxCnpj]); if (!cnpj || !targetSet.has(cnpj)) continue;
            const row: Record<string, string> = {}; header.forEach((h, i) => (row[h] = (r[i] ?? "").trim()));
            const a = ensureAgg(agg, cnpj);
            const name = row["DENOM_CLASSE"] || row["DENOM_CLASSE_COTA"] || row["TP_CLASSE"] || row["CLASSE"] || "Classe única";
            const tipo = row["TP_CLASSE"] || row["TP_SERIE"] || "";
            const pl = getNum(row, ["VL_PATRIM_LIQ", "VL_PL", "PATRIM_LIQ", "VL_TOTAL"]);
            const vquota = getNum(row, ["VL_COTA", "VL_QUOTA"]);
            const qt = getNum(row, ["QT_COTA", "QT_QUOTA"]);
            a.classes.push({ name, type: tipo, pl, quotaValue: vquota, numberOfQuotas: qt });
          }
        }

        // ----- Tabela X.3 — Rentabilidade -----
        if (/_tab_x_3_|_tab_x3_/.test(lower)) {
          const idxCnpj = cnpjColIndex(header);
          for (const r of rows) {
            const cnpj = onlyDigits(r[idxCnpj]); if (!cnpj || !targetSet.has(cnpj)) continue;
            const row: Record<string, string> = {}; header.forEach((h, i) => (row[h] = (r[i] ?? "").trim()));
            const a = ensureAgg(agg, cnpj);
            const name = row["DENOM_CLASSE"] || row["DENOM_CLASSE_COTA"] || row["TP_CLASSE"] || "";
            const yield_ = getNum(row, ["RENTAB_MES", "RENTAB_MENSAL", "RENTAB", "PERC_RENTAB"]);
            const target = a.classes.find((c) => c.name === name) ?? a.classes[a.classes.length - 1];
            if (target && yield_ != null) target.monthlyYieldPct = yield_;
          }
        }
      } catch (e) {
        readErrors.push(`${entry.filename}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await reader.close();

    // 3) Consolidação por FIDC + status
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
        cnpj: a.cnpj,
        name: a.denomFundo ?? "",
        referenceMonth: referenceISO,
        pl: a.pl ?? null,
        creditRights: a.creditRights ?? null,
        caixaAmpliado,
        cash: a.cash ?? null,
        pdd: a.pdd ?? null,
        overdueTotal,
        overdue30: ovd30, overdue60: ovd60, overdue90: ovd90, overdue120: ovd120,
        repurchase: a.repurchase ?? null,
        investors: a.investors ?? null,
        classes: a.classes,
        sumClassesPL,
        plDiff: diff,
        plDiffPct: diffPct,
        flags,
        status,
        hasPositionInButia: positionSet.has(a.cnpj),
      };
    });

    const foundCnpjs = new Set(fidcs.map((f) => f.cnpj));
    const mestreFound: string[] = [];
    const mestreMissing: string[] = [];
    for (const c of targetSet) (foundCnpjs.has(c) ? mestreFound : mestreMissing).push(c);
    const posFound: string[] = [];
    const posMissing: string[] = [];
    for (const c of positionSet) (foundCnpjs.has(c) ? posFound : posMissing).push(c);

    if (mestreMissing.length) alerts.push(`${mestreMissing.length} CNPJ(s) do Cadastro Mestre ausentes no informe CVM.`);
    if (!Object.keys(rowsByFile).length) alerts.push("Nenhum CSV foi lido do ZIP — possível mudança de layout.");

    const payload = {
      referenceMonth: ref,
      url,
      fileSizeBytes: bytes.byteLength,
      fileHash,
      status: "ok",
      filesInZip,
      rowsByFile,
      totalCnpjs: allCnpjs.size,
      mestreFound, mestreMissing,
      posFound, posMissing,
      readErrors, alerts,
      fidcs: fidcs.sort((a, b) => (b.pl ?? 0) - (a.pl ?? 0)),
      elapsedMs: Date.now() - t0,
    };

    return new Response(JSON.stringify(payload), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
