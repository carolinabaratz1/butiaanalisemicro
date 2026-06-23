// Parser do Informe Mensal de FIDC (CVM/Quantum).
// O arquivo NÃO tem ISIN: identificação por CNPJ no header e cotas/classes
// extraídas da seção final "X - Outras Informações" (coluna A).
import * as XLSX from "xlsx";

export type RawMatrix = (string | number | Date | null)[][];

export type ParsedQuotaClass = {
  className: string;
  classNameNormalized: string;
  quotaType: string | null;       // "Sênior" | "Subordinada" | "Mezanino" | "Única" | null
  seniorityLevel: number | null;  // 1 = Sênior, 2 = Mezanino, 3 = Subordinada
  navValue: number | null;
  quotaValue: number | null;
  numberOfQuotas: number | null;
  rating: string | null;
};

export type ParsedMonthlyReport = {
  fileName: string;
  cnpj: string | null;            // 14 dígitos
  fidcNameInFile: string | null;
  referenceMonth: string;         // YYYY-MM-01 (último mês da planilha)
  referenceLabel: string;         // "Maio/2026"
  availableMonths: { label: string; iso: string; columnIndex: number }[];
  metrics: {
    navValue: number | null;             // PL informado (IV.a)
    quotaValue: number | null;           // primeira cota (média ponderada)
    creditRightsValue: number | null;    // I.2.a + I.2.b
    overdueValue: number | null;         // a.3) Créditos Existentes Inadimplentes
    pddValue: number | null;             // a.10) Provisão
    cashValue: number | null;            // I.1 Disponibilidades
    repurchaseValue: number | null;      // IX d.2) Recompras Valor
    assetsTotal: number | null;          // I - Ativo
    liabilitiesTotal: number | null;     // III - Passivo
  };
  quotaClasses: ParsedQuotaClass[];
  rawSnapshot: Record<string, unknown>;
};

const MONTH_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

function cleanCNPJ(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

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
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Indentation count = leading spaces in coluna A. Usada para detectar hierarquia das classes.
function indent(label: string): number {
  const m = label.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function detectQuotaType(label: string): { quotaType: string; seniority: number } | null {
  const n = norm(label);
  if (n.includes("classe senior") || n.includes("senior")) return { quotaType: "Sênior", seniority: 1 };
  if (n.includes("mezanino")) return { quotaType: "Mezanino", seniority: 2 };
  if (n.includes("subordinad")) return { quotaType: "Subordinada", seniority: 3 };
  if (n.startsWith("classe unica") || n === "unica") return { quotaType: "Única", seniority: 1 };
  return null;
}

function findRowByLabel(matrix: RawMatrix, target: string): number {
  const t = norm(target);
  for (let i = 0; i < matrix.length; i++) {
    const v = matrix[i]?.[0];
    if (v != null && norm(String(v)) === t) return i;
  }
  return -1;
}

function findRowStartsWith(matrix: RawMatrix, target: string): number {
  const t = norm(target);
  for (let i = 0; i < matrix.length; i++) {
    const v = matrix[i]?.[0];
    if (v != null && norm(String(v)).startsWith(t)) return i;
  }
  return -1;
}

export async function parseMonthlyReportFile(file: File): Promise<ParsedMonthlyReport> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Planilha vazia.");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<RawMatrix[number]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as RawMatrix;

  if (!matrix.length) throw new Error("Planilha sem dados.");

  // Header: A1 = "NOME\nCNPJ"; colunas seguintes = meses
  const headerRow = matrix[0] ?? [];
  const a1 = headerRow[0] != null ? String(headerRow[0]) : "";
  const cnpjMatch = a1.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  const cnpj = cleanCNPJ(cnpjMatch?.[0] ?? null);
  const fidcNameInFile =
    a1.split(/\r?\n/)[0]?.trim() || sheetName.trim() || null;

  const months: { label: string; iso: string; columnIndex: number }[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const lbl = headerRow[c];
    if (lbl == null) continue;
    const iso = parseMonthLabel(String(lbl));
    if (iso) months.push({ label: String(lbl), iso, columnIndex: c });
  }
  if (!months.length) throw new Error("Não foi possível identificar meses no cabeçalho do informe.");

  const last = months[months.length - 1];
  const col = last.columnIndex;

  const valueAt = (rowIdx: number): number | null =>
    rowIdx >= 0 ? asNumber(matrix[rowIdx]?.[col]) : null;

  // Métricas consolidadas — labels exatos do informe CVM/Quantum
  const rAtivo = findRowStartsWith(matrix, "I - Ativo");
  const rDisp = findRowStartsWith(matrix, "1 - Disponibilidades".trim()); // pode ter indentação
  const rDispIndented = findRowStartsWith(matrix, "   1 - Disponibilidades");
  const rDcA = findRowStartsWith(matrix, "      a) Direitos Creditórios com Aquisição Substancial");
  const rDcB = findRowStartsWith(matrix, "      b) Direitos Creditórios sem Aquisição Substancial");
  const rOverdueA = findRowStartsWith(matrix, "         a.3) Créditos Existentes Inadimplentes");
  const rPddA = findRowStartsWith(matrix, "         a.10) Provisão");
  const rPassivo = findRowStartsWith(matrix, "III - Passivo");
  const rPL = findRowStartsWith(matrix, "   a) Valor do Patrimônio Líquido");
  const rRecompraValor = findRowStartsWith(matrix, "      d.2) Valor");

  const dcA = valueAt(rDcA);
  const dcB = valueAt(rDcB);
  const creditRightsValue =
    dcA != null || dcB != null ? (dcA ?? 0) + (dcB ?? 0) : null;

  const metrics = {
    navValue: valueAt(rPL),
    quotaValue: null as number | null, // preenchido depois com a 1ª classe (média ponderada)
    creditRightsValue,
    overdueValue: valueAt(rOverdueA),
    pddValue: valueAt(rPddA),
    cashValue: valueAt(rDispIndented >= 0 ? rDispIndented : rDisp),
    repurchaseValue: valueAt(rRecompraValor),
    assetsTotal: valueAt(rAtivo),
    liabilitiesTotal: valueAt(rPassivo),
  };

  // ---- Parser de cotas/classes a partir de "X - Outras Informações" ----
  const rX = findRowStartsWith(matrix, "X - Outras Informações");
  const classes: ParsedQuotaClass[] = [];

  if (rX >= 0) {
    let currentType: { quotaType: string; seniority: number } | null = null;
    let currentClass: ParsedQuotaClass | null = null;

    const pushCurrent = () => {
      if (currentClass) {
        classes.push(currentClass);
        currentClass = null;
      }
    };

    for (let i = rX + 1; i < matrix.length; i++) {
      const row = matrix[i] ?? [];
      const label = row[0];
      if (label == null || String(label).trim() === "") continue;
      const raw = String(label);
      const n = norm(raw);
      const ind = indent(raw);

      // Linhas de rodapé/disclaimer
      if (/^(as informa|os valores|fonte:|^\s*$)/i.test(raw.trim())) continue;

      // Cabeçalho do tipo (Classe Sênior, Classe Subordinada júnior, Classe Mezanino, Classe Única)
      const t = detectQuotaType(raw);
      if (t && ind <= 8 && !n.includes("fidc") && !/\d/.test(raw)) {
        pushCurrent();
        currentType = t;
        continue;
      }

      // Linhas filhas da classe atual
      const isField = ["cota", "patrimônio líquido", "patrimonio liquido", "quantidade de cotas", "amortização", "amortizacao", "rating"]
        .includes(n);

      if (isField && currentClass) {
        const v = asNumber(row[col]);
        if (n === "cota") currentClass.quotaValue = v;
        else if (n === "patrimônio líquido" || n === "patrimonio liquido") currentClass.navValue = v;
        else if (n === "quantidade de cotas") currentClass.numberOfQuotas = v;
        else if (n === "rating") currentClass.rating = row[col] != null ? String(row[col]).trim() : null;
        continue;
      }

      // Nome da classe (linha mais indentada que o cabeçalho do tipo, com texto sem caractere "%" e não é campo)
      if (currentType && !isField && ind >= 6) {
        pushCurrent();
        const t2 = detectQuotaType(raw);
        currentClass = {
          className: raw.trim(),
          classNameNormalized: norm(raw),
          quotaType: (t2 ?? currentType).quotaType,
          seniorityLevel: (t2 ?? currentType).seniority,
          navValue: null,
          quotaValue: null,
          numberOfQuotas: null,
          rating: null,
        };
      }
    }
    pushCurrent();
  }

  if (classes.length > 0 && classes[0].quotaValue != null) {
    metrics.quotaValue = classes[0].quotaValue;
  }

  return {
    fileName: file.name,
    cnpj,
    fidcNameInFile,
    referenceMonth: last.iso,
    referenceLabel: last.label,
    availableMonths: months,
    metrics,
    quotaClasses: classes,
    rawSnapshot: {
      sheetName,
      monthCount: months.length,
      assetsTotal: metrics.assetsTotal,
      liabilitiesTotal: metrics.liabilitiesTotal,
    },
  };
}

// ---------- Validação PL × Cotas ----------

export type QuotaValidationStatus = "valid" | "warning" | "invalid" | "cotas_ausentes";

export type QuotaValidation = {
  status: QuotaValidationStatus;
  declaredNav: number | null;     // PL informado (IV.a)
  quotasNavSum: number | null;    // soma do PL das cotas/classes
  differenceAbs: number | null;
  differencePct: number | null;   // 0..1
  quotaClassesFoundCount: number;
  subordinatedStatus: "ok" | "unreliable" | "missing";
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
      subordinatedStatus: "missing",
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
  let subStatus: "ok" | "unreliable" | "missing" = "ok";
  let subNotes: string | null = null;
  let message = "PL total bate com a soma das cotas/classes.";

  if (pct > 0.002) {
    status = "invalid";
    subStatus = "unreliable";
    subNotes = "Diferença > 0,20% entre PL informado e soma das cotas.";
    message = "PL total do FIDC difere da soma do PL das cotas/classes. A métrica de subordinação pode estar incorreta.";
  } else if (pct > 0.0005) {
    status = "warning";
    subStatus = "unreliable";
    subNotes = "Diferença entre 0,05% e 0,20% entre PL informado e soma das cotas.";
    message = "Pequena divergência entre PL total e soma das cotas/classes.";
  }

  return {
    status,
    declaredNav: declared,
    quotasNavSum: sum,
    differenceAbs: diff,
    differencePct: pct,
    quotaClassesFoundCount: count,
    subordinatedStatus: subStatus,
    subordinatedNotes: subNotes,
    message,
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
  parsed: ParsedQuotaClass[],
  master: MasterQuota[],
): QuotaMatch[] {
  return parsed.map((p) => {
    // 1) Nome exato (class_name / internal / cvm)
    const exact = master.find((m) =>
      [m.class_name, m.internal_quota_name, m.cvm_quota_name]
        .filter(Boolean)
        .some((name) => norm(String(name)) === p.classNameNormalized),
    );
    if (exact) {
      return { parsed: p, matchedId: exact.id, matchingStatus: "matched_by_name" };
    }
    // 2) Match por tipo/senioridade quando só existe 1 classe daquele tipo
    if (p.quotaType) {
      const byType = master.filter((m) => m.quota_type === p.quotaType);
      if (byType.length === 1) {
        return { parsed: p, matchedId: byType[0].id, matchingStatus: "matched_by_name" };
      }
      if (byType.length > 1) {
        return { parsed: p, matchedId: null, matchingStatus: "manual_match_required" };
      }
    }
    // 3) Sem ISIN nenhum no cadastro
    if (master.every((m) => !m.isin)) {
      return { parsed: p, matchedId: null, matchingStatus: "no_isin_available" };
    }
    return { parsed: p, matchedId: null, matchingStatus: "unmatched" };
  });
}
