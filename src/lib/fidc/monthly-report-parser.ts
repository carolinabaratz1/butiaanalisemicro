// Parser do Informe Mensal de FIDC (CVM/Quantum).
// O arquivo NÃO tem ISIN — identificação por CNPJ no cabeçalho e cotas/classes
// extraídas da seção "X - Outras Informações" via âncoras textuais.
import * as XLSX from "xlsx";

export type RawMatrix = (string | number | Date | null)[][];

export type ParsedQuotaClass = {
  className: string;
  classNameNormalized: string;
  quotaType: string | null;       // "Sênior" | "Subordinada" | "Mezanino" | "Única" | null
  seniorityLevel: number | null;  // 1 sênior, 2 mezanino, 3 subordinada
  navValue: number | null;
  quotaValue: number | null;
  numberOfQuotas: number | null;
  rating: string | null;
};

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
  pddValue: number | null;
  cashValue: number | null;
  repurchaseValue: number | null;
  assetsTotal: number | null;
  liabilitiesTotal: number | null;
  segmentCarteiraTotal: number | null;
  investorsCount: number | null;
};

export type ParsedMonthSlice = {
  iso: string;             // YYYY-MM-01
  label: string;           // e.g. "set/2025"
  columnIndex: number;
  metrics: MonthlyMetrics;
  quotaClasses: ParsedQuotaClass[];
};

export type ParsedMonthlyReport = {
  fileName: string;
  cnpj: string | null;            // 14 dígitos
  fidcNameInFile: string | null;
  referenceMonth: string;         // YYYY-MM-01 (último mês)
  referenceLabel: string;
  availableMonths: { label: string; iso: string; columnIndex: number }[];
  months: ParsedMonthSlice[];     // todos os meses do arquivo
  metrics: MonthlyMetrics;        // do mês mais recente (compat)
  quotaClasses: ParsedQuotaClass[]; // do mês mais recente (compat)
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
  // remove R$ e espaços
  s = s.replace(/R\$\s*/gi, "").replace(/\s+/g, "");
  // negativo entre parênteses
  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  // formato BR: pontos como milhar, vírgula como decimal
  if (/,/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

const indent = (s: string): number => (s.match(/^(\s*)/)?.[1].length ?? 0);

function detectQuotaType(label: string): { quotaType: string; seniority: number } | null {
  const n = norm(label);
  if (/\bmezanino\b/.test(n)) return { quotaType: "Mezanino", seniority: 2 };
  if (/\bsubordinad/.test(n)) return { quotaType: "Subordinada", seniority: 3 };
  if (/\bsenior\b/.test(n))   return { quotaType: "Sênior", seniority: 1 };
  if (/\bunica\b/.test(n))    return { quotaType: "Única", seniority: 1 };
  return null;
}

function findRowStartsWith(matrix: RawMatrix, target: string, from = 0, to = -1): number {
  const t = norm(target);
  const end = to < 0 ? matrix.length : to;
  for (let i = from; i < end; i++) {
    const v = matrix[i]?.[0];
    if (v != null && norm(String(v)).startsWith(t)) return i;
  }
  return -1;
}

function findRowContains(matrix: RawMatrix, target: string, from = 0, to = -1): number {
  const t = norm(target);
  const end = to < 0 ? matrix.length : to;
  for (let i = from; i < end; i++) {
    const v = matrix[i]?.[0];
    if (v != null && norm(String(v)).includes(t)) return i;
  }
  return -1;
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

  // Header: A1 normalmente é "NOME\nCNPJ"; colunas subsequentes = meses
  const headerRow = matrix[0] ?? [];
  const a1 = headerRow[0] != null ? String(headerRow[0]) : "";

  // CNPJ: A1 OU procurar rótulo "CNPJ do Fundo" em qualquer linha
  let cnpj = cleanCNPJ(a1.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)?.[0] ?? null);
  if (!cnpj) {
    const cnpjRow = findRowContains(matrix, "cnpj do fundo");
    if (cnpjRow >= 0) {
      const row = matrix[cnpjRow] ?? [];
      for (let c = 0; c < row.length; c++) {
        const m = String(row[c] ?? "").match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
        if (m) { cnpj = cleanCNPJ(m[0]); break; }
      }
    }
  }

  const fidcNameInFile = a1.split(/\r?\n/)[0]?.trim() || sheetName.trim() || null;

  // Meses no cabeçalho
  const months: { label: string; iso: string; columnIndex: number }[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const lbl = headerRow[c];
    if (lbl == null) continue;
    const iso = parseMonthLabel(String(lbl));
    if (iso) months.push({ label: String(lbl), iso, columnIndex: c });
  }
  if (!months.length) throw new Error("Não foi possível identificar meses no cabeçalho do informe.");

  const last = months[months.length - 1];

  // ---- Âncoras seccionais (uma vez para o arquivo todo) ----
  const rAtivo     = findRowStartsWith(matrix, "I - Ativo");
  const rCarteira  = findRowStartsWith(matrix, "II - Carteira por Segmento");
  const rPassivo   = findRowStartsWith(matrix, "III - Passivo");
  const rPL        = findRowStartsWith(matrix, "IV - Patrimônio Líquido");
  const rV         = findRowStartsWith(matrix, "V - Comportamento da Carteira de Direitos Cred");
  const rVI        = findRowStartsWith(matrix, "VI - Comportamento da Carteira de Direitos Cred");
  const rVII       = findRowStartsWith(matrix, "VII - Negócios com Direitos Creditórios");
  const rIX        = findRowStartsWith(matrix, "IX - Taxas Praticadas");
  const rX         = findRowStartsWith(matrix, "X - Outras Informações");

  const rDisp = findRowStartsWith(matrix, "1 - Disponibilidades",
    rAtivo >= 0 ? rAtivo : 0,
    rCarteira > 0 ? rCarteira : (rPassivo > 0 ? rPassivo : -1));
  const rDcA = findRowContains(matrix, "a) direitos creditorios com aquisicao substancial",
    rAtivo >= 0 ? rAtivo : 0, rPassivo > 0 ? rPassivo : -1);
  const rDcB = findRowContains(matrix, "b) direitos creditorios sem aquisicao substancial",
    rAtivo >= 0 ? rAtivo : 0, rPassivo > 0 ? rPassivo : -1);
  const rPddA = rDcA >= 0 ? findRowContains(matrix, "a.10) provisao",
    rDcA, rDcB > 0 ? rDcB + 30 : rPassivo > 0 ? rPassivo : -1) : -1;
  const rPddB = rDcB >= 0 ? findRowContains(matrix, "b.10) provisao",
    rDcB, rPassivo > 0 ? rPassivo : -1) : -1;
  const rA3 = rDcA >= 0 ? findRowContains(matrix, "a.3) creditos existentes inadimplentes",
    rDcA, rDcB > 0 ? rDcB : (rPassivo > 0 ? rPassivo : -1)) : -1;
  const rB3 = rDcB >= 0 ? findRowContains(matrix, "b.3) creditos existentes inadimplentes",
    rDcB, rPassivo > 0 ? rPassivo : -1) : -1;
  const rA21 = rDcA >= 0 ? findRowContains(matrix, "a.2.1) valor total das parcelas inadimplentes",
    rDcA, rDcB > 0 ? rDcB : (rPassivo > 0 ? rPassivo : -1)) : -1;
  const rB21 = rDcB >= 0 ? findRowContains(matrix, "b.2.1) valor total das parcelas inadimplentes",
    rDcB, rPassivo > 0 ? rPassivo : -1) : -1;
  const rVb = rV >= 0 ? findRowStartsWith(matrix, "b) Inadimplentes",
    rV, rVI > 0 ? rVI : (rVII > 0 ? rVII : -1)) : -1;
  const rVIb = rVI >= 0 ? findRowStartsWith(matrix, "b) Inadimplentes",
    rVI, rVII > 0 ? rVII : (rIX > 0 ? rIX : -1)) : -1;
  const rRecD = rVII >= 0 ? findRowContains(matrix, "d) recompras",
    rVII, rIX > 0 ? rIX : (rX > 0 ? rX : -1)) : -1;
  const rRecD2 = rRecD >= 0 ? findRowContains(matrix, "d.2) valor",
    rRecD, rRecD + 10) : -1;
  const rPLa = rPL >= 0 ? findRowContains(matrix, "a) valor do patrimonio liquido",
    rPL, rV > 0 ? rV : -1) : -1;
  const rPLb = rPL >= 0 ? findRowContains(matrix, "b) valor do patrimonio liquido medio",
    rPL, rV > 0 ? rV : -1) : -1;
  const rInvestors = rX >= 0 ? findRowContains(matrix, "numero de cotistas",
    rX, Math.min(matrix.length, rX + 60)) : -1;

  const labelAt = (rowIdx: number): string | null =>
    rowIdx >= 0 ? String(matrix[rowIdx]?.[0] ?? "").trim() : null;

  // Builder de métricas por coluna (mês)
  const metricsForColumn = (col: number): MonthlyMetrics => {
    const v = (r: number) => (r >= 0 ? asNumber(matrix[r]?.[col]) : null);
    const dcA = v(rDcA);
    const dcB = v(rDcB);
    const creditRightsValue = dcA != null || dcB != null ? (dcA ?? 0) + (dcB ?? 0) : null;
    const pddA = v(rPddA);
    const pddB = v(rPddB);
    const pddValue = pddA != null || pddB != null
      ? Math.abs(pddA ?? 0) + Math.abs(pddB ?? 0) : null;

    let overdueValue: number | null = null;
    let overdueSource: "V_VI" | "fallback_I" | null = null;
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
    const investorsRaw = v(rInvestors);
    return {
      navValue: v(rPLa),
      monthlyAverageNavValue: v(rPLb),
      quotaValue: null,
      creditRightsValue,
      creditRightsAValue: dcA,
      creditRightsBValue: dcB,
      overdueValue,
      overdueSource,
      pddValue,
      cashValue: v(rDisp),
      repurchaseValue: v(rRecD2),
      assetsTotal: v(rAtivo),
      liabilitiesTotal: v(rPassivo),
      segmentCarteiraTotal: v(rCarteira),
      investorsCount: investorsRaw != null ? Math.round(investorsRaw) : null,
    };
  };

  // Builder de cotas/classes por coluna
  const quotasForColumn = (col: number): ParsedQuotaClass[] => {
    const list: ParsedQuotaClass[] = [];
    if (rX < 0) return list;

    let currentType: { quotaType: string; seniority: number } | null = null;
    let currentClass: ParsedQuotaClass | null = null;
    let awaitingName = false;

    const pushCurrent = () => {
      if (currentClass) { list.push(currentClass); currentClass = null; }
    };

    for (let i = rX + 1; i < matrix.length; i++) {
      const row = matrix[i] ?? [];
      const label = row[0];
      if (label == null || String(label).trim() === "") continue;
      const raw = String(label);
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
      const isAmortField  = n.startsWith("amortizacao");
      const isField = isCotaField || isPLField || isQtdField || isRatingField || isAmortField;

      if (isField && currentClass) {
        if (isAmortField) continue;
        const val = asNumber(row[col]);
        if (isCotaField) currentClass.quotaValue = val;
        else if (isPLField) currentClass.navValue = val;
        else if (isQtdField) currentClass.numberOfQuotas = val;
        else if (isRatingField) currentClass.rating = row[col] != null ? String(row[col]).trim() : null;
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
          };
        }
      }
    }
    pushCurrent();
    return list;
  };

  // Constrói slice para cada mês disponível
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
  const valueAt = (rowIdx: number): number | null =>
    rowIdx >= 0 ? asNumber(matrix[rowIdx]?.[col]) : null;
  // (creditRightsValue/dcA/dcB/etc. recomputados para o checklist)
  const dcA = valueAt(rDcA); const dcB = valueAt(rDcB);
  const creditRightsValue = metrics.creditRightsValue;
  const pddValue = metrics.pddValue;
  const overdueValue = metrics.overdueValue;
  const overdueSource = metrics.overdueSource;

  // ---- Checklist ----
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
    { metric: "Ativo total (I)", section: "I - Ativo", foundLabel: labelAt(rAtivo), value: metrics.assetsTotal, status: mkStatus(metrics.assetsTotal) },
    { metric: "Passivo total (III)", section: "III - Passivo", foundLabel: labelAt(rPassivo), value: metrics.liabilitiesTotal, status: mkStatus(metrics.liabilitiesTotal) },
    { metric: "Caixa (I.1)", section: "I - Ativo", foundLabel: labelAt(rDisp), value: metrics.cashValue, status: mkStatus(metrics.cashValue) },
    { metric: "Direitos Cred. I.2.a", section: "I.2", foundLabel: labelAt(rDcA), value: dcA, status: mkStatus(dcA) },
    { metric: "Direitos Cred. I.2.b", section: "I.2", foundLabel: labelAt(rDcB), value: dcB, status: mkStatus(dcB) },
    { metric: "Direitos Cred. total (a+b)", section: "I.2", foundLabel: "Calc.", value: creditRightsValue, status: mkStatus(creditRightsValue) },
    { metric: "PDD (|a.10|+|b.10|)", section: "I.2", foundLabel: rPddA >= 0 || rPddB >= 0 ? "Provisão a/b" : null, value: pddValue, status: mkStatus(pddValue) },
    { metric: "Atrasos", section: overdueSource === "V_VI" ? "V.b + VI.b" : overdueSource === "fallback_I" ? "Fallback I.2" : "—", foundLabel: overdueSource, value: overdueValue, status: mkStatus(overdueValue) },
    { metric: "Recompras (VII.d.2)", section: "VII", foundLabel: labelAt(rRecD2), value: metrics.repurchaseValue, status: mkStatus(metrics.repurchaseValue) },
    { metric: "Investidores (X.1)", section: "X", foundLabel: labelAt(rInvestors), value: metrics.investorsCount, status: mkStatus(metrics.investorsCount) },
    { metric: "Cotas/classes", section: "X", foundLabel: null, value: quotaClasses.length, status: quotaClasses.length > 0 ? "found" : "missing" },
    { metric: "Soma PL cotas", section: "X", foundLabel: null, value: sumQuotas, status: mkStatus(sumQuotas) },
  ];

  // Validação contábil
  if (metrics.assetsTotal != null && metrics.liabilitiesTotal != null && declared != null) {
    const diff = Math.abs((metrics.assetsTotal - metrics.liabilitiesTotal) - declared);
    const ok = diff / Math.max(Math.abs(declared), 1) < 0.005;
    checklist.push({
      metric: "Ativo − Passivo ≈ PL",
      section: "Validação",
      foundLabel: null,
      value: diff,
      status: ok ? "validated" : "inconsistent",
    });
  }
  // Validação II ≈ I.2.a + I.2.b
  if (metrics.segmentCarteiraTotal != null && creditRightsValue != null) {
    const diff = Math.abs(metrics.segmentCarteiraTotal - creditRightsValue);
    const ok = diff / Math.max(Math.abs(creditRightsValue), 1) < 0.005;
    checklist.push({
      metric: "II ≈ I.2.a + I.2.b",
      section: "Validação",
      foundLabel: null,
      value: diff,
      status: ok ? "validated" : "inconsistent",
    });
  }

  return {
    fileName: file.name,
    cnpj,
    fidcNameInFile,
    referenceMonth: last.iso,
    referenceLabel: last.label,
    availableMonths: months,
    months: slices,
    metrics,
    quotaClasses,
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

export function validateQuotas(parsed: ParsedMonthlyReport): QuotaValidation {
  const count = parsed.quotaClasses.length;
  const declared = parsed.metrics.navValue;
  const sum = count > 0
    ? parsed.quotaClasses.reduce((acc, q) => acc + (q.navValue ?? 0), 0)
    : null;

  if (count === 0) {
    return {
      status: "cotas_ausentes",
      declaredNav: declared,
      quotasNavSum: null,
      differenceAbs: null,
      differencePct: null,
      quotaClassesFoundCount: 0,
      subordinatedStatus: "quota_data_missing",
      subordinatedNotes: "Cotas/classes não encontradas no informe mensal.",
      message:
        "Cotas/classes não encontradas no informe mensal. Não é possível validar PL por cotas nem calcular subordinação com confiança.",
    };
  }

  if (declared == null || sum == null || declared === 0) {
    return {
      status: "warning",
      declaredNav: declared,
      quotasNavSum: sum,
      differenceAbs: null,
      differencePct: null,
      quotaClassesFoundCount: count,
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
    status = "invalid";
    subStatus = "invalid";
    subNotes = "Diferença > 0,20% entre PL informado e soma das cotas.";
    message = "PL total do FIDC difere da soma do PL das cotas/classes. A métrica de subordinação pode estar incorreta.";
  } else if (pct > 0.0005) {
    status = "warning";
    subStatus = "unreliable";
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
