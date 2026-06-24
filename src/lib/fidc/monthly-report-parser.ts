// Parser do Informe Mensal de FIDC (CVM/Quantum).
// Extração por âncoras seccionais e de/para textual — nunca por número de linha.
// O arquivo NÃO tem ISIN — identificação por CNPJ no cabeçalho.
import * as XLSX from "xlsx";

export type RawMatrix = (string | number | Date | null)[][];

export type ParsedQuotaClass = {
  className: string;
  classNameNormalized: string;
  quotaType: string | null;
  seniorityLevel: number | null;
  navValue: number | null;
  quotaValue: number | null;
  numberOfQuotas: number | null;
  rating: string | null;
  monthlyYieldPct: number | null;
  subscriptionValue: number | null;
  redemptionValue: number | null;
  amortizationValue: number | null;
};

export type BreakdownItem = { bucket: string; value: number };

export type ChecklistRow = {
  metric: string;
  section: string;
  foundLabel: string | null;
  value: number | string | null;
  status: "found" | "missing" | "inconsistent" | "validated";
};

export type MonthlyMetrics = {
  navValue: number | null;
  monthlyAverageNavValue: number | null;
  quotaValue: number | null;
  creditRightsValue: number | null;
  creditRightsAValue: number | null;
  creditRightsBValue: number | null;
  overdueValue: number | null;
  overdueSource: "V_VI" | "fallback_I" | null;
  overdue30dValue: number | null;
  overdue60dValue: number | null;
  overdue90dValue: number | null;
  overdue120dValue: number | null;
  pddValue: number | null;
  cashValue: number | null;         // Caixa Ampliado (I.1 + I.2.c..i)
  cashStrictValue: number | null;   // I.1 isolado
  repurchaseValue: number | null;
  acquisitionsValue: number | null;
  substitutionsValue: number | null;
  disposalsValue: number | null;
  guaranteesValue: number | null;
  guaranteesPctDc: number | null;
  scrStatus: string | null;
  scrValue: number | null;
  assetsTotal: number | null;
  liabilitiesTotal: number | null;
  segmentCarteiraTotal: number | null;
  investorsCount: number | null;
  segmentBreakdown: BreakdownItem[];
  maturityBreakdown: BreakdownItem[];
  overdueBreakdown: BreakdownItem[];
  assignorsBreakdown: BreakdownItem[];
  // Conteúdo adicional persistido em raw_data (extras)
  rawExtras: Record<string, unknown>;
};

export type ParsedMonthSlice = {
  iso: string;
  label: string;
  columnIndex: number;
  metrics: MonthlyMetrics;
  quotaClasses: ParsedQuotaClass[];
};

export type ParsedMonthlyReport = {
  fileName: string;
  cnpj: string | null;
  fidcNameInFile: string | null;
  referenceMonth: string;
  referenceLabel: string;
  availableMonths: { label: string; iso: string; columnIndex: number }[];
  months: ParsedMonthSlice[];
  metrics: MonthlyMetrics;
  quotaClasses: ParsedQuotaClass[];
  checklist: ChecklistRow[];
  rawSnapshot: Record<string, unknown>;
};

const MONTH_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

const cleanCNPJ = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  return d.length === 14 ? d : null;
};

function parseMonthLabel(label: string): string | null {
  const m = String(label).trim().match(/^([A-Za-zçÇãÃéÉ]+)\/(\d{4})$/);
  if (!m) return null;
  const mm = MONTH_PT[norm(m[1])];
  if (!mm) return null;
  return `${m[2]}-${String(mm).padStart(2, "0")}-01`;
}

function asNumber(v: unknown): number | null {
  if (v == null || v === "" || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/R\$\s*/gi, "").replace(/\s+/g, "");
  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  if (/,/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  // Remove '%' trailing (handled by caller for context-specific scaling)
  const pctTrail = /%$/.test(s);
  if (pctTrail) s = s.slice(0, -1);
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

const indent = (s: string): number => (s.match(/^(\s*)/)?.[1].length ?? 0);

function detectQuotaType(label: string): { quotaType: string; seniority: number } | null {
  const n = norm(label);
  if (/\bmezanino\b|\bmz\b/.test(n)) return { quotaType: "Mezanino", seniority: 2 };
  if (/\bsubordinad/.test(n) || /\bsub\b/.test(n)) return { quotaType: "Subordinada", seniority: 3 };
  if (/\bsenior\b|\bsr\b/.test(n))   return { quotaType: "Sênior", seniority: 1 };
  if (/\bunica\b|monoclasse/.test(n))   return { quotaType: "Única", seniority: 1 };
  return null;
}

function rowText(matrix: RawMatrix, i: number): string {
  return String(matrix[i]?.[0] ?? "");
}

function findRow(
  matrix: RawMatrix,
  predicate: (n: string, raw: string) => boolean,
  from = 0,
  to = -1,
): number {
  const end = to < 0 ? matrix.length : to;
  for (let i = from; i < end; i++) {
    const raw = rowText(matrix, i);
    if (!raw) continue;
    const n = norm(raw);
    if (predicate(n, raw)) return i;
  }
  return -1;
}

function findRowStartsWith(matrix: RawMatrix, target: string, from = 0, to = -1): number {
  const t = norm(target);
  return findRow(matrix, (n) => n.startsWith(t), from, to);
}
function findRowContains(matrix: RawMatrix, target: string, from = 0, to = -1): number {
  const t = norm(target);
  return findRow(matrix, (n) => n.includes(t), from, to);
}

// Pega o valor da coluna do mês; se vazio, pega o último valor numérico da linha.
function valueInRow(matrix: RawMatrix, row: number, col: number): number | null {
  if (row < 0) return null;
  const r = matrix[row] ?? [];
  const direct = asNumber(r[col]);
  if (direct != null) return direct;
  // fallback: rightmost numeric
  for (let c = r.length - 1; c > 0; c--) {
    const v = asNumber(r[c]);
    if (v != null) return v;
  }
  return null;
}

// Texto da coluna do mês (string crua); se vazio, último não-vazio à direita.
function textInRow(matrix: RawMatrix, row: number, col: number): string | null {
  if (row < 0) return null;
  const r = matrix[row] ?? [];
  const cell = r[col];
  if (cell != null && String(cell).trim() !== "") return String(cell).trim();
  for (let c = r.length - 1; c > 0; c--) {
    const v = r[c];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

// ---------- Parser principal ----------
export async function parseMonthlyReportFile(file: File): Promise<ParsedMonthlyReport> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Planilha vazia.");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<RawMatrix[number]>(sheet, {
    header: 1, defval: null, raw: true,
  }) as RawMatrix;
  if (!matrix.length) throw new Error("Planilha sem dados.");

  // Cabeçalho
  const headerRow = matrix[0] ?? [];
  const a1 = headerRow[0] != null ? String(headerRow[0]) : "";

  let cnpj = cleanCNPJ(a1.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)?.[0] ?? null);
  if (!cnpj) {
    const r = findRowContains(matrix, "cnpj do fundo");
    if (r >= 0) {
      for (const cell of matrix[r] ?? []) {
        const m = String(cell ?? "").match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
        if (m) { cnpj = cleanCNPJ(m[0]); break; }
      }
    }
  }

  const fidcNameInFile = a1.split(/\r?\n/)[0]?.trim() || sheetName.trim() || null;

  // Meses
  const months: { label: string; iso: string; columnIndex: number }[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const lbl = headerRow[c];
    if (lbl == null) continue;
    const iso = parseMonthLabel(String(lbl));
    if (iso) months.push({ label: String(lbl), iso, columnIndex: c });
  }
  if (!months.length) throw new Error("Não foi possível identificar meses no cabeçalho do informe.");

  const last = months[months.length - 1];

  // ---------- Âncoras de seção (uma vez por arquivo) ----------
  const rAtivo    = findRowStartsWith(matrix, "i - ativo");
  const rCarteira = findRowStartsWith(matrix, "ii - carteira por segmento");
  const rPassivo  = findRowStartsWith(matrix, "iii - passivo");
  const rPL       = findRowStartsWith(matrix, "iv - patrimonio liquido");
  const rV        = findRowStartsWith(matrix, "v - comportamento da carteira de direitos cred");
  const rVI       = findRowStartsWith(matrix, "vi - comportamento da carteira de direitos cred");
  const rVII      = findRowStartsWith(matrix, "vii - negocios com direitos creditorios");
  const rIX       = findRowStartsWith(matrix, "ix - taxas");
  const rX        = findRowStartsWith(matrix, "x - outras informacoes");

  // I - subseções
  const iEnd = rCarteira > 0 ? rCarteira : (rPassivo > 0 ? rPassivo : matrix.length);
  const rDisp = findRow(matrix, (n) => /^1\s*[-)]\s*disponibilidades/.test(n) || n.startsWith("1 - disponibilidades"),
    rAtivo >= 0 ? rAtivo : 0, iEnd);

  // I.2 a..i — janela = depois do rótulo "2 - Carteira" / "2) Carteira" até rPassivo
  const r2Carteira = findRow(matrix, (n) => /^2\s*[-)]\s*carteira/.test(n),
    rAtivo >= 0 ? rAtivo : 0, rPassivo > 0 ? rPassivo : matrix.length);
  const i2End = rCarteira > 0 ? rCarteira : (rPassivo > 0 ? rPassivo : matrix.length);
  const findCarteiraLetter = (letter: string, contains: string): number =>
    findRow(matrix, (n) => new RegExp(`^${letter}\\)`).test(n) && n.includes(contains),
      r2Carteira >= 0 ? r2Carteira + 1 : (rAtivo + 1), i2End);

  const rDcA = findCarteiraLetter("a", "direitos creditorios com aquisicao substancial");
  const rDcB = findCarteiraLetter("b", "direitos creditorios sem aquisicao substancial");
  const rValMob   = findCarteiraLetter("c", "valores mobiliarios");
  const rTPF      = findCarteiraLetter("d", "titulos publicos federais");
  const rCDB      = findCarteiraLetter("e", "certificados de depositos bancarios");
  const rCompr    = findCarteiraLetter("f", "operacoes compromissadas");
  const rOutrosRF = findCarteiraLetter("g", "outros ativos financeiros de renda fixa");
  const rCotasFIDC= findCarteiraLetter("h", "classes de cotas dos fundos de investimento em direitos creditorios");
  const rWarrants = findCarteiraLetter("i", "warrants");

  const rPddA = rDcA >= 0 ? findRow(matrix, (n) => /^a\.10\)/.test(n) && n.includes("provisao"),
    rDcA, rDcB > 0 ? rDcB + 40 : rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rPddB = rDcB >= 0 ? findRow(matrix, (n) => /^b\.10\)/.test(n) && n.includes("provisao"),
    rDcB, rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rA3 = rDcA >= 0 ? findRow(matrix, (n) => /^a\.3\)/.test(n) && n.includes("creditos existentes inadimplentes"),
    rDcA, rDcB > 0 ? rDcB : rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rB3 = rDcB >= 0 ? findRow(matrix, (n) => /^b\.3\)/.test(n) && n.includes("creditos existentes inadimplentes"),
    rDcB, rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rA21 = rDcA >= 0 ? findRow(matrix, (n) => /^a\.2\.1\)/.test(n),
    rDcA, rDcB > 0 ? rDcB : rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rB21 = rDcB >= 0 ? findRow(matrix, (n) => /^b\.2\.1\)/.test(n),
    rDcB, rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rA11 = rDcA >= 0 ? findRow(matrix, (n) => /^a\.11\)/.test(n),
    rDcA, rDcB > 0 ? rDcB : rPassivo > 0 ? rPassivo : matrix.length) : -1;
  const rB11 = rDcB >= 0 ? findRow(matrix, (n) => /^b\.11\)/.test(n),
    rDcB, rPassivo > 0 ? rPassivo : matrix.length) : -1;

  // IV - PL
  const rPLa = rPL >= 0 ? findRow(matrix, (n) => /^a\)/.test(n) && n.includes("valor do patrimonio liquido") && !n.includes("medio"),
    rPL, rV > 0 ? rV : matrix.length) : -1;
  const rPLb = rPL >= 0 ? findRow(matrix, (n) => /^b\)/.test(n) && n.includes("patrimonio liquido medio"),
    rPL, rV > 0 ? rV : matrix.length) : -1;

  // V / VI subseções
  const vEnd  = rVI  > 0 ? rVI  : (rVII > 0 ? rVII : matrix.length);
  const viEnd = rVII > 0 ? rVII : (rIX > 0 ? rIX  : matrix.length);
  const rVa = rV  >= 0 ? findRow(matrix, (n) => /^a\)/.test(n) && n.includes("prazo de vencimento"), rV,  vEnd)  : -1;
  const rVb = rV  >= 0 ? findRow(matrix, (n) => /^b\)/.test(n) && n.includes("inadimplentes"),      rV,  vEnd)  : -1;
  const rVIa= rVI >= 0 ? findRow(matrix, (n) => /^a\)/.test(n) && n.includes("prazo de vencimento"), rVI, viEnd) : -1;
  const rVIb= rVI >= 0 ? findRow(matrix, (n) => /^b\)/.test(n) && n.includes("inadimplentes"),      rVI, viEnd) : -1;

  // Buckets inadimplência por rótulo textual exato
  const bucketRow = (parent: number, end: number, key: string): number =>
    parent >= 0 ? findRow(matrix, (n) => n.includes(key), parent + 1, end > 0 ? end : matrix.length) : -1;
  const vbEnd  = vEnd;
  const vibEnd = viEnd;
  // "entre 1 e 30", "entre 31 e 60", "entre 61 e 90", "entre 91 e 120",
  // "entre 121 e 150", "entre 151 e 180", "entre 181 e 360",
  // "entre 361 e 720", "entre 721 e 1080", "acima de 1080"
  const VB = [
    bucketRow(rVb, vbEnd, "entre 1 e 30"),
    bucketRow(rVb, vbEnd, "entre 31 e 60"),
    bucketRow(rVb, vbEnd, "entre 61 e 90"),
    bucketRow(rVb, vbEnd, "entre 91 e 120"),
    bucketRow(rVb, vbEnd, "entre 121 e 150"),
    bucketRow(rVb, vbEnd, "entre 151 e 180"),
    bucketRow(rVb, vbEnd, "entre 181 e 360"),
    bucketRow(rVb, vbEnd, "entre 361 e 720"),
    bucketRow(rVb, vbEnd, "entre 721 e 1080"),
    bucketRow(rVb, vbEnd, "acima de 1080"),
  ];
  const VIB = [
    bucketRow(rVIb, vibEnd, "entre 1 e 30"),
    bucketRow(rVIb, vibEnd, "entre 31 e 60"),
    bucketRow(rVIb, vibEnd, "entre 61 e 90"),
    bucketRow(rVIb, vibEnd, "entre 91 e 120"),
    bucketRow(rVIb, vibEnd, "entre 121 e 150"),
    bucketRow(rVIb, vibEnd, "entre 151 e 180"),
    bucketRow(rVIb, vibEnd, "entre 181 e 360"),
    bucketRow(rVIb, vibEnd, "entre 361 e 720"),
    bucketRow(rVIb, vibEnd, "entre 721 e 1080"),
    bucketRow(rVIb, vibEnd, "acima de 1080"),
  ];
  const BUCKET_LABELS = [
    "Até 30 dias", "31 a 60 dias", "61 a 90 dias", "91 a 120 dias",
    "121 a 150 dias", "151 a 180 dias", "181 a 360 dias",
    "361 a 720 dias", "721 a 1080 dias", "Acima de 1080 dias",
  ];
  // Maturity buckets V.a / VI.a (mesmo padrão textual)
  const matRow = (parent: number, end: number, key: string): number =>
    parent >= 0 ? findRow(matrix, (n) => n.includes(key), parent + 1, end > 0 ? end : matrix.length) : -1;
  const vaEnd = rVb > 0 ? rVb : vbEnd;
  const viaEnd = rVIb > 0 ? rVIb : vibEnd;
  const MAT_KEYS = ["ate 30", "31 a 60", "61 a 90", "91 a 120", "121 a 150", "151 a 180", "181 a 360", "361 a 720", "721 a 1080", "acima de 1080"];
  const VA  = MAT_KEYS.map((k) => matRow(rVa,  vaEnd,  k));
  const VIA = MAT_KEYS.map((k) => matRow(rVIa, viaEnd, k));

  // VII - fluxo
  const viiEnd = rIX > 0 ? rIX : (rX > 0 ? rX : matrix.length);
  const findVIILetter = (letter: string, contains: string): number =>
    rVII >= 0 ? findRow(matrix, (n) => new RegExp(`^${letter}\\)`).test(n) && n.includes(contains), rVII, viiEnd) : -1;
  const rAcqA = findVIILetter("a", "aquisi");
  const rDisB = findVIILetter("b", "alienac");
  const rSubC = findVIILetter("c", "substituic");
  const rRecD = findVIILetter("d", "recompras");
  const subValueRow = (parent: number, key: RegExp): number =>
    parent >= 0 ? findRow(matrix, (n) => key.test(n), parent + 1, parent + 12) : -1;
  const rAcqQ = subValueRow(rAcqA, /^a\.1\)/);
  const rAcqV = subValueRow(rAcqA, /^a\.2\)/);
  const rDisQ = subValueRow(rDisB, /^b\.1\)/);
  const rDisV = subValueRow(rDisB, /^b\.2\)/);
  const rDisBk= subValueRow(rDisB, /^b\.3\)/);
  const rSubQ = subValueRow(rSubC, /^c\.1\)/);
  const rSubV = subValueRow(rSubC, /^c\.2\)/);
  const rSubBk= subValueRow(rSubC, /^c\.3\)/);
  const rRecQ = subValueRow(rRecD, /^d\.1\)/);
  const rRecV = subValueRow(rRecD, /^d\.2\)/);
  const rRecBk= subValueRow(rRecD, /^d\.3\)/);

  // X subsections
  const xEnd = matrix.length;
  const findXSub = (key: string): number =>
    rX >= 0 ? findRow(matrix, (n) => n.includes(key), rX + 1, xEnd) : -1;
  const rX1 = findXSub("numero de cotistas");
  const rX2 = findXSub("descricao da serie") >= 0 ? findXSub("descricao da serie") : findXSub("descricao da classe");
  const rX3 = findXSub("rentabilidade apurada no mes");
  const rX4 = findXSub("captacoes, resgates");
  const rX7 = findXSub("7) garantias") >= 0 ? findXSub("7) garantias") : findXSub("garantias vinculadas");
  const rX8 = findXSub("sistema de informacoes de credito") >= 0
    ? findXSub("sistema de informacoes de credito") : findXSub(" scr");

  // 7) Garantias subitens
  const rGuarV = rX7 >= 0 ? findRow(matrix, (n) => n.includes("valor total das garantias"), rX7 + 1, rX7 + 10) : -1;
  const rGuarP = rX7 >= 0 ? findRow(matrix, (n) => n.includes("percentual dos direitos creditorios com garantias"), rX7 + 1, rX7 + 10) : -1;

  // 8) SCR subitens
  const rSCR1 = rX8 >= 0 ? findRow(matrix, (n) => n.includes("classificacoes de riscos dos devedores"), rX8 + 1, rX8 + 12) : -1;
  const rSCR2 = rX8 >= 0 ? findRow(matrix, (n) => n.includes("classificacoes de risco das operacoes"), rX8 + 1, rX8 + 12) : -1;

  // Enumera filhos por indent (parent < indent <= end, mesma profundidade ou maior)
  function enumerateChildren(parentRow: number, parentEnd: number): { row: number; label: string }[] {
    if (parentRow < 0) return [];
    const out: { row: number; label: string }[] = [];
    const end = parentEnd > 0 ? parentEnd : matrix.length;
    const parentInd = indent(rowText(matrix, parentRow));
    for (let i = parentRow + 1; i < end; i++) {
      const raw = rowText(matrix, i);
      if (!raw || raw.trim() === "") continue;
      const ind = indent(raw);
      if (ind <= parentInd) break;
      out.push({ row: i, label: raw.trim() });
    }
    return out;
  }

  const segmentChildren = enumerateChildren(rCarteira, rPassivo);
  const assignorsAChildren = enumerateChildren(rA11, rDcB > 0 ? rDcB : rPassivo);
  const assignorsBChildren = enumerateChildren(rB11, rPassivo);

  const labelAt = (row: number): string | null =>
    row >= 0 ? String(matrix[row]?.[0] ?? "").trim() : null;

  // -------- Métricas por coluna (mês) --------
  const metricsForColumn = (col: number): MonthlyMetrics => {
    const v = (r: number) => valueInRow(matrix, r, col);

    const dcA = v(rDcA);
    const dcB = v(rDcB);
    const creditRightsValue = dcA != null || dcB != null ? (dcA ?? 0) + (dcB ?? 0) : null;

    const pddA = v(rPddA);
    const pddB = v(rPddB);
    const pddValue = pddA != null || pddB != null
      ? Math.abs(pddA ?? 0) + Math.abs(pddB ?? 0) : null;

    // Caixa Estrito e Caixa Ampliado
    const disp     = v(rDisp);
    const valMob   = v(rValMob);
    const tpf      = v(rTPF);
    const cdb      = v(rCDB);
    const compr    = v(rCompr);
    const outrosRF = v(rOutrosRF);
    const cotasFIDC= v(rCotasFIDC);
    const warrants = v(rWarrants);
    const cashComponents = [disp, valMob, tpf, cdb, compr, outrosRF, cotasFIDC, warrants];
    const anyCash = cashComponents.some((x) => x != null);
    const cashAmpliado = anyCash ? cashComponents.reduce((a, x) => a + (x ?? 0), 0) : null;

    // Overdue: preferencial soma dos buckets V.b + VI.b. Fallback: total V.b/VI.b, depois fallback I.
    const sumBuckets = (rows: number[]): number | null => {
      const vals = rows.map((r) => (r >= 0 ? v(r) : null)).filter((x): x is number => x != null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };
    let overdueValue: number | null = null;
    let overdueSource: "V_VI" | "fallback_I" | null = null;
    const vbBucketSum  = sumBuckets(VB);
    const vibBucketSum = sumBuckets(VIB);
    if (vbBucketSum != null || vibBucketSum != null) {
      overdueValue = (vbBucketSum ?? 0) + (vibBucketSum ?? 0);
      overdueSource = "V_VI";
    } else {
      const vbVal = v(rVb); const vibVal = v(rVIb);
      if (vbVal != null || vibVal != null) {
        overdueValue = (vbVal ?? 0) + (vibVal ?? 0);
        overdueSource = "V_VI";
      } else {
        const a3 = v(rA3); const b3 = v(rB3); const a21 = v(rA21); const b21 = v(rB21);
        if ([a3, b3, a21, b21].some((x) => x != null)) {
          overdueValue = (a3 ?? 0) + (b3 ?? 0) + (a21 ?? 0) + (b21 ?? 0);
          overdueSource = "fallback_I";
        }
      }
    }

    const sumPair = (a: number, b: number): number | null => {
      const va = v(a); const vb = v(b);
      if (va == null && vb == null) return null;
      return (va ?? 0) + (vb ?? 0);
    };
    const o30  = sumPair(VB[0], VIB[0]);
    const o60  = sumPair(VB[1], VIB[1]);
    const o90  = sumPair(VB[2], VIB[2]);
    const o120 = sumPair(VB[3], VIB[3]);

    const overdueBreakdown: BreakdownItem[] = [];
    for (let i = 0; i < 10; i++) {
      const val = sumPair(VB[i], VIB[i]);
      if (val != null && val !== 0) overdueBreakdown.push({ bucket: BUCKET_LABELS[i], value: val });
    }
    // Acumulados
    const buckets10 = Array.from({ length: 10 }, (_, i) => sumPair(VB[i], VIB[i]) ?? 0);
    const acumFrom = (start: number) =>
      buckets10.slice(start).some((x) => x !== 0) ? buckets10.slice(start).reduce((a, b) => a + b, 0) : null;
    const d30plus = acumFrom(1);
    const d60plus = acumFrom(2);
    const d90plus = acumFrom(3);

    // Maturity breakdown
    const maturityBreakdown: BreakdownItem[] = [];
    for (let i = 0; i < 10; i++) {
      const val = sumPair(VA[i], VIA[i]);
      if (val != null && val !== 0) maturityBreakdown.push({ bucket: BUCKET_LABELS[i], value: val });
    }

    // Segment II
    const segmentBreakdown: BreakdownItem[] = segmentChildren
      .map((c) => ({ bucket: c.label, value: valueInRow(matrix, c.row, col) }))
      .filter((b): b is BreakdownItem => b.value != null && b.value !== 0);

    // Cedentes (a.11 + b.11)
    const assignorsBreakdown: BreakdownItem[] = [...assignorsAChildren, ...assignorsBChildren]
      .map((c) => ({ bucket: c.label, value: valueInRow(matrix, c.row, col) }))
      .filter((b): b is BreakdownItem => b.value != null);

    // Garantias
    const guaranteesValue = v(rGuarV);
    let guaranteesPctDc: number | null = null;
    const guarRawPct = v(rGuarP);
    if (guarRawPct != null) {
      guaranteesPctDc = Math.abs(guarRawPct) > 1 ? guarRawPct / 100 : guarRawPct;
    } else if (guaranteesValue != null && creditRightsValue && creditRightsValue > 0) {
      guaranteesPctDc = guaranteesValue / creditRightsValue;
    }

    // SCR
    const scr1 = v(rSCR1);
    const scr2 = v(rSCR2);
    const scrText = textInRow(matrix, rSCR1 >= 0 ? rSCR1 : rX8, col);
    let scrStatus: string | null = null;
    let scrValue: number | null = null;
    if (scr1 != null || scr2 != null) {
      scrValue = (scr1 ?? 0) + (scr2 ?? 0) || (scr1 ?? scr2 ?? null);
      scrStatus = "Informado";
    } else if (scrText && /nao possui|sem informacao|nao apresentad/i.test(norm(scrText))) {
      scrStatus = "Não possui informação apresentada";
    } else if (rX8 >= 0) {
      scrStatus = "N/D";
    }

    const investorsRaw = v(rX1);

    const rawExtras: Record<string, unknown> = {
      cash_strict_value: disp,
      cash_ampliado_components: {
        disponibilidades: disp,
        valoresMobiliarios: valMob,
        titulosPublicosFederais: tpf,
        cdb,
        compromissadas: compr,
        outrosRendaFixa: outrosRF,
        cotasFIDC,
        warrants,
      },
      total_assets: v(rAtivo),
      total_liabilities: v(rPassivo),
      delinquency_30_plus_value: d30plus,
      delinquency_60_plus_value: d60plus,
      delinquency_90_plus_value: d90plus,
      delinquency_30_plus_ratio: d30plus != null && creditRightsValue && creditRightsValue > 0 ? d30plus / creditRightsValue : null,
      delinquency_60_plus_ratio: d60plus != null && creditRightsValue && creditRightsValue > 0 ? d60plus / creditRightsValue : null,
      delinquency_90_plus_ratio: d90plus != null && creditRightsValue && creditRightsValue > 0 ? d90plus / creditRightsValue : null,
      maturity_buckets: maturityBreakdown,
      portfolio_by_segment: segmentBreakdown,
      monthly_credit_rights_transactions: {
        acquisitions:   { qty: v(rAcqQ), value: v(rAcqV) },
        disposals:      { qty: v(rDisQ), value: v(rDisV), book: v(rDisBk) },
        substitutions:  { qty: v(rSubQ), value: v(rSubV), book: v(rSubBk) },
        repurchases:    { qty: v(rRecQ), value: v(rRecV), book: v(rRecBk) },
      },
      guarantees: { valor: guaranteesValue, pct_dc: guaranteesPctDc },
      scr: { status: scrStatus, valor_devedores: scr1, valor_operacoes: scr2 },
    };

    return {
      navValue: v(rPLa),
      monthlyAverageNavValue: v(rPLb),
      quotaValue: null,
      creditRightsValue,
      creditRightsAValue: dcA,
      creditRightsBValue: dcB,
      overdueValue,
      overdueSource,
      overdue30dValue: o30,
      overdue60dValue: o60,
      overdue90dValue: o90,
      overdue120dValue: o120,
      pddValue,
      cashValue: cashAmpliado,
      cashStrictValue: disp,
      repurchaseValue: v(rRecV),
      acquisitionsValue: v(rAcqV),
      substitutionsValue: v(rSubV),
      disposalsValue: v(rDisV),
      guaranteesValue,
      guaranteesPctDc,
      scrStatus,
      scrValue,
      assetsTotal: v(rAtivo),
      liabilitiesTotal: v(rPassivo),
      segmentCarteiraTotal: v(rCarteira),
      investorsCount: investorsRaw != null ? Math.round(investorsRaw) : null,
      segmentBreakdown,
      maturityBreakdown,
      overdueBreakdown,
      assignorsBreakdown,
      rawExtras,
    };
  };

  // -------- Cotas/classes (X.2) --------
  const quotasForColumn = (col: number): ParsedQuotaClass[] => {
    const list: ParsedQuotaClass[] = [];
    const startRow = rX2 >= 0 ? rX2 : rX;
    if (startRow < 0) return list;
    const endRow = rX3 > startRow ? rX3 : (rX4 > startRow ? rX4 : matrix.length);

    let currentType: { quotaType: string; seniority: number } | null = null;
    let currentClass: ParsedQuotaClass | null = null;
    let awaitingName = false;
    const pushCurrent = () => {
      if (currentClass) { list.push(currentClass); currentClass = null; }
    };

    for (let i = startRow + 1; i < endRow; i++) {
      const raw = rowText(matrix, i);
      if (!raw || raw.trim() === "") continue;
      const n = norm(raw);
      const ind = indent(raw);
      if (n.startsWith("as informacoes") || n.startsWith("os valores") || n.startsWith("fonte:")) break;
      if (/^x[iv]+\s*-\s/.test(n)) break;

      const t = detectQuotaType(raw);
      if (t && ind <= 8 && !/\d/.test(raw)) {
        pushCurrent();
        currentType = t;
        awaitingName = true;
        continue;
      }

      const isCotaField   = n === "cota" || n.startsWith("cota ");
      const isPLField     = n.startsWith("patrimonio liquido");
      const isQtdField    = n.startsWith("quantidade de cotas");
      const isRatingField = n === "rating" || n.startsWith("rating ");
      const isField = isCotaField || isPLField || isQtdField || isRatingField;

      if (isField && currentClass) {
        const val = valueInRow(matrix, i, col);
        if (isCotaField) currentClass.quotaValue = val;
        else if (isPLField) currentClass.navValue = val;
        else if (isQtdField) currentClass.numberOfQuotas = val;
        else if (isRatingField) currentClass.rating = textInRow(matrix, i, col);
        continue;
      }

      if (awaitingName && currentType && !isField && ind >= 6) {
        pushCurrent();
        const sub = detectQuotaType(raw) ?? currentType;
        currentClass = {
          className: raw.trim(),
          classNameNormalized: norm(raw),
          quotaType: sub.quotaType,
          seniorityLevel: sub.seniority,
          navValue: null, quotaValue: null, numberOfQuotas: null, rating: null,
          monthlyYieldPct: null, subscriptionValue: null, redemptionValue: null, amortizationValue: null,
        };
        awaitingName = false;
        continue;
      }

      if (!currentType && !isField && ind >= 4) {
        const tt = detectQuotaType(raw);
        if (tt) {
          pushCurrent();
          currentClass = {
            className: raw.trim(),
            classNameNormalized: norm(raw),
            quotaType: tt.quotaType,
            seniorityLevel: tt.seniority,
            navValue: null, quotaValue: null, numberOfQuotas: null, rating: null,
            monthlyYieldPct: null, subscriptionValue: null, redemptionValue: null, amortizationValue: null,
          };
        }
      }
    }
    pushCurrent();

    // Enriquecer com X.3 (rentabilidade) e X.4 (captação/resgate/amortização) por match de nome
    const findClassRow = (rows: ParsedQuotaClass[], nameNorm: string): ParsedQuotaClass | null => {
      // match exato; senão, includes
      const exact = rows.find((r) => r.classNameNormalized === nameNorm);
      if (exact) return exact;
      return rows.find((r) => r.classNameNormalized.includes(nameNorm) || nameNorm.includes(r.classNameNormalized)) ?? null;
    };

    // X.3 Rentabilidade
    if (rX3 >= 0) {
      const xEnd3 = rX4 > rX3 ? rX4 : (rX7 > rX3 ? rX7 : matrix.length);
      let currentClassRow: ParsedQuotaClass | null = null;
      for (let i = rX3 + 1; i < xEnd3; i++) {
        const raw = rowText(matrix, i);
        if (!raw) continue;
        const n = norm(raw);
        if (/^[0-9]+\)/.test(n) && !/rentabilidade/.test(n)) break;
        // Linha que parece nome de classe
        const match = findClassRow(list, n);
        if (match) { currentClassRow = match; continue; }
        if (currentClassRow && (n.startsWith("rentabilidade") || n.startsWith("rentab"))) {
          const raw3 = valueInRow(matrix, i, col);
          if (raw3 != null) {
            currentClassRow.monthlyYieldPct = Math.abs(raw3) > 1 ? raw3 / 100 : raw3;
          }
        }
      }
    }

    // X.4 Captações/Resgates/Amortizações
    if (rX4 >= 0) {
      const xEnd4 = rX7 > rX4 ? rX7 : (rX8 > rX4 ? rX8 : matrix.length);
      let currentClassRow: ParsedQuotaClass | null = null;
      for (let i = rX4 + 1; i < xEnd4; i++) {
        const raw = rowText(matrix, i);
        if (!raw) continue;
        const n = norm(raw);
        if (/^[0-9]+\)/.test(n) && !/(captac|resgat|amortiz)/.test(n)) break;
        const match = findClassRow(list, n);
        if (match) { currentClassRow = match; continue; }
        if (!currentClassRow) continue;
        const val = valueInRow(matrix, i, col);
        if (val == null) continue;
        if (n.includes("valor total captado") || n.startsWith("captacao") || n.startsWith("subscricao")) {
          currentClassRow.subscriptionValue = (currentClassRow.subscriptionValue ?? 0) + val;
        } else if (n.includes("valor total dos resgates") || n.startsWith("resgate")) {
          currentClassRow.redemptionValue = (currentClassRow.redemptionValue ?? 0) + val;
        } else if (n.includes("valor total das amortizac") || n.startsWith("amortizacao") || n.includes("valor amortizado")) {
          currentClassRow.amortizationValue = (currentClassRow.amortizationValue ?? 0) + val;
        }
      }
    }

    return list;
  };

  // Slices por mês
  const slices: ParsedMonthSlice[] = months.map((m) => {
    const met = metricsForColumn(m.columnIndex);
    const quotas = quotasForColumn(m.columnIndex);
    if (quotas.length > 0 && quotas[0].quotaValue != null) met.quotaValue = quotas[0].quotaValue;
    return { iso: m.iso, label: m.label, columnIndex: m.columnIndex, metrics: met, quotaClasses: quotas };
  });

  const lastSlice = slices[slices.length - 1];
  const metrics = lastSlice.metrics;
  const quotaClasses = lastSlice.quotaClasses;
  const col = last.columnIndex;
  const valueAt = (rowIdx: number): number | null => valueInRow(matrix, rowIdx, col);
  const dcA = valueAt(rDcA); const dcB = valueAt(rDcB);
  const creditRightsValue = metrics.creditRightsValue;
  const pddValue = metrics.pddValue;
  const overdueValue = metrics.overdueValue;
  const overdueSource = metrics.overdueSource;

  // -------- Checklist --------
  const declared = metrics.navValue;
  const sumQuotas = quotaClasses.length > 0
    ? quotaClasses.reduce((a, q) => a + (q.navValue ?? 0), 0)
    : null;

  const mkStatus = (v: unknown): ChecklistRow["status"] =>
    v == null ? "missing" : "found";

  const checklist: ChecklistRow[] = [
    { metric: "CNPJ", section: "Cabeçalho", foundLabel: cnpj ? null : "—", value: cnpj, status: cnpj ? "found" : "missing" },
    { metric: "Competência", section: "Cabeçalho", foundLabel: last.label, value: last.label, status: "found" },
    { metric: "PL (IV.a)", section: "IV - PL", foundLabel: labelAt(rPLa), value: declared, status: mkStatus(declared) },
    { metric: "PL médio (IV.b)", section: "IV - PL", foundLabel: labelAt(rPLb), value: metrics.monthlyAverageNavValue, status: mkStatus(metrics.monthlyAverageNavValue) },
    { metric: "Ativo total (I)", section: "I - Ativo", foundLabel: labelAt(rAtivo), value: metrics.assetsTotal, status: mkStatus(metrics.assetsTotal) },
    { metric: "Passivo total (III)", section: "III - Passivo", foundLabel: labelAt(rPassivo), value: metrics.liabilitiesTotal, status: mkStatus(metrics.liabilitiesTotal) },
    { metric: "Caixa Estrito (I.1)", section: "I.1", foundLabel: labelAt(rDisp), value: metrics.cashStrictValue, status: mkStatus(metrics.cashStrictValue) },
    { metric: "Caixa Ampliado (I.1+I.2.c..i)", section: "I.1 + I.2.c..i", foundLabel: "Calc.", value: metrics.cashValue, status: mkStatus(metrics.cashValue) },
    { metric: "Direitos Cred. I.2.a", section: "I.2.a", foundLabel: labelAt(rDcA), value: dcA, status: mkStatus(dcA) },
    { metric: "Direitos Cred. I.2.b", section: "I.2.b", foundLabel: labelAt(rDcB), value: dcB, status: mkStatus(dcB) },
    { metric: "Direitos Cred. total (a+b)", section: "I.2", foundLabel: "Calc.", value: creditRightsValue, status: mkStatus(creditRightsValue) },
    { metric: "PDD (|a.10|+|b.10|)", section: "I.2.a.10 + I.2.b.10", foundLabel: rPddA >= 0 || rPddB >= 0 ? "Provisão a/b" : null, value: pddValue, status: mkStatus(pddValue) },
    { metric: "Atrasos total", section: overdueSource === "V_VI" ? "V.b + VI.b" : overdueSource === "fallback_I" ? "Fallback I.2" : "—", foundLabel: overdueSource, value: overdueValue, status: mkStatus(overdueValue) },
    { metric: "Inad. 30d (V.b.1 + VI.b.1)", section: "V.b + VI.b", foundLabel: "entre 1 e 30", value: metrics.overdue30dValue, status: mkStatus(metrics.overdue30dValue) },
    { metric: "Inad. 60d (V.b.2 + VI.b.2)", section: "V.b + VI.b", foundLabel: "entre 31 e 60", value: metrics.overdue60dValue, status: mkStatus(metrics.overdue60dValue) },
    { metric: "Inad. 90d (V.b.3 + VI.b.3)", section: "V.b + VI.b", foundLabel: "entre 61 e 90", value: metrics.overdue90dValue, status: mkStatus(metrics.overdue90dValue) },
    { metric: "Inad. 120d (V.b.4 + VI.b.4)", section: "V.b + VI.b", foundLabel: "entre 91 e 120", value: metrics.overdue120dValue, status: mkStatus(metrics.overdue120dValue) },
    { metric: "Aquisições (VII.a.2)", section: "VII.a", foundLabel: labelAt(rAcqV), value: metrics.acquisitionsValue, status: mkStatus(metrics.acquisitionsValue) },
    { metric: "Alienações (VII.b.2)", section: "VII.b", foundLabel: labelAt(rDisV), value: metrics.disposalsValue, status: mkStatus(metrics.disposalsValue) },
    { metric: "Substituições (VII.c.2)", section: "VII.c", foundLabel: labelAt(rSubV), value: metrics.substitutionsValue, status: mkStatus(metrics.substitutionsValue) },
    { metric: "Recompras (VII.d.2)", section: "VII.d", foundLabel: labelAt(rRecV), value: metrics.repurchaseValue, status: mkStatus(metrics.repurchaseValue) },
    { metric: "Garantias (7.1)", section: "X.7", foundLabel: labelAt(rGuarV), value: metrics.guaranteesValue, status: mkStatus(metrics.guaranteesValue) },
    { metric: "SCR (8)", section: "X.8", foundLabel: metrics.scrStatus, value: metrics.scrValue ?? metrics.scrStatus, status: metrics.scrStatus ? "found" : "missing" },
    { metric: "Cotistas (X.1)", section: "X.1", foundLabel: labelAt(rX1), value: metrics.investorsCount, status: mkStatus(metrics.investorsCount) },
    { metric: "Cotas/classes encontradas (X.2)", section: "X.2", foundLabel: labelAt(rX2), value: quotaClasses.length, status: quotaClasses.length > 0 ? "found" : "missing" },
    { metric: "Soma PL cotas", section: "X.2", foundLabel: null, value: sumQuotas, status: mkStatus(sumQuotas) },
  ];

  // Validações
  if (metrics.assetsTotal != null && metrics.liabilitiesTotal != null && declared != null) {
    const diff = Math.abs((metrics.assetsTotal - metrics.liabilitiesTotal) - declared);
    const ok = diff / Math.max(Math.abs(declared), 1) < 0.005;
    checklist.push({
      metric: "Ativo − Passivo ≈ PL", section: "Validação",
      foundLabel: null, value: diff, status: ok ? "validated" : "inconsistent",
    });
  }
  if (metrics.segmentCarteiraTotal != null && creditRightsValue != null) {
    const diff = Math.abs(metrics.segmentCarteiraTotal - creditRightsValue);
    const ok = diff / Math.max(Math.abs(creditRightsValue), 1) < 0.005;
    checklist.push({
      metric: "II ≈ I.2.a + I.2.b", section: "Validação",
      foundLabel: null, value: diff, status: ok ? "validated" : "inconsistent",
    });
  }
  if (metrics.cashStrictValue != null && metrics.cashValue != null) {
    const ok = metrics.cashValue + 1e-6 >= metrics.cashStrictValue;
    checklist.push({
      metric: "Caixa Ampliado ≥ Caixa Estrito", section: "Validação",
      foundLabel: null, value: metrics.cashValue - metrics.cashStrictValue,
      status: ok ? "validated" : "inconsistent",
    });
  }

  return {
    fileName: file.name,
    cnpj, fidcNameInFile,
    referenceMonth: last.iso,
    referenceLabel: last.label,
    availableMonths: months,
    months: slices,
    metrics, quotaClasses,
    checklist,
    rawSnapshot: {
      sheetName,
      monthCount: months.length,
      assetsTotal: metrics.assetsTotal,
      liabilitiesTotal: metrics.liabilitiesTotal,
      segmentCarteiraTotal: metrics.segmentCarteiraTotal,
      monthlyAverageNavValue: metrics.monthlyAverageNavValue,
      creditRightsAValue: metrics.creditRightsAValue,
      creditRightsBValue: metrics.creditRightsBValue,
      overdueSource: metrics.overdueSource,
    },
  };
}

// ---------- Validação PL × Cotas ----------
export type QuotaValidationStatus = "valid" | "warning" | "invalid" | "cotas_ausentes";

export type QuotaValidation = {
  status: QuotaValidationStatus;
  declaredNav: number | null;
  quotasNavSum: number | null;
  differenceAbs: number | null;
  differencePct: number | null;
  quotaClassesFoundCount: number;
  subordinatedStatus: "ok" | "unreliable" | "missing" | "invalid" | "quota_data_missing";
  subordinatedNotes: string | null;
  message: string;
};

export function validateQuotas(
  input: ParsedMonthlyReport | { metrics: MonthlyMetrics; quotaClasses: ParsedQuotaClass[] },
): QuotaValidation {
  const count = input.quotaClasses.length;
  const declared = input.metrics.navValue;
  const sum = count > 0
    ? input.quotaClasses.reduce((acc, q) => acc + (q.navValue ?? 0), 0)
    : null;

  if (count === 0) {
    return {
      status: "cotas_ausentes",
      declaredNav: declared, quotasNavSum: null,
      differenceAbs: null, differencePct: null, quotaClassesFoundCount: 0,
      subordinatedStatus: "quota_data_missing",
      subordinatedNotes: "Cotas/classes não encontradas no informe mensal.",
      message: "Cotas/classes não encontradas no informe mensal. Não é possível validar PL por cotas nem calcular subordinação com confiança.",
    };
  }

  if (declared == null || sum == null || declared === 0) {
    return {
      status: "warning",
      declaredNav: declared, quotasNavSum: sum,
      differenceAbs: null, differencePct: null, quotaClassesFoundCount: count,
      subordinatedStatus: "unreliable",
      subordinatedNotes: "PL informado ausente ou zero — não é possível comparar com a soma das cotas.",
      message: "PL total ausente. Subordinação pode estar incorreta.",
    };
  }

  const diff = sum - declared;
  const pct = Math.abs(diff) / Math.abs(declared);

  let status: QuotaValidationStatus = "valid";
  let subStatus: QuotaValidation["subordinatedStatus"] = "ok";
  let subNotes: string | null = null;
  let message = "PL total bate com a soma das cotas/classes.";

  if (pct > 0.002) {
    status = "invalid"; subStatus = "invalid";
    subNotes = "Diferença > 0,20% entre PL informado e soma das cotas.";
    message = "PL total do FIDC difere da soma do PL das cotas/classes. A métrica de subordinação pode estar incorreta.";
  } else if (pct > 0.0005) {
    status = "warning"; subStatus = "unreliable";
    subNotes = "Diferença entre 0,05% e 0,20% entre PL informado e soma das cotas.";
    message = "Pequena divergência entre PL total e soma das cotas/classes.";
  }

  return {
    status, declaredNav: declared, quotasNavSum: sum,
    differenceAbs: diff, differencePct: pct, quotaClassesFoundCount: count,
    subordinatedStatus: subStatus, subordinatedNotes: subNotes, message,
  };
}

// ---------- Matching contra Cadastro Mestre ----------
export type MasterQuota = {
  id: string;
  isin: string | null;
  class_name: string | null;
  internal_quota_name: string | null;
  cvm_quota_name: string | null;
  quota_type: string | null;
  seniority_level: number | null;
};

export type QuotaMatch = {
  parsed: ParsedQuotaClass;
  matchedId: string | null;
  matchingStatus: "matched_by_name" | "manual_match_required" | "unmatched" | "no_isin_available";
};

export function matchQuotaClasses(
  parsed: ParsedQuotaClass[], master: MasterQuota[],
): QuotaMatch[] {
  return parsed.map((p) => {
    const exact = master.find((m) =>
      [m.class_name, m.internal_quota_name, m.cvm_quota_name]
        .filter(Boolean)
        .some((name) => norm(String(name)) === p.classNameNormalized),
    );
    if (exact) return { parsed: p, matchedId: exact.id, matchingStatus: "matched_by_name" };
    if (p.quotaType) {
      const byType = master.filter((m) => m.quota_type === p.quotaType);
      if (byType.length === 1) return { parsed: p, matchedId: byType[0].id, matchingStatus: "matched_by_name" };
      if (byType.length > 1) return { parsed: p, matchedId: null, matchingStatus: "manual_match_required" };
    }
    if (master.every((m) => !m.isin)) {
      return { parsed: p, matchedId: null, matchingStatus: "no_isin_available" };
    }
    return { parsed: p, matchedId: null, matchingStatus: "unmatched" };
  });
}
