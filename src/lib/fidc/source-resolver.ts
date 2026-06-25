// Resolve a hierarquia de fontes da lâmina de FIDC.
// Regra principal: dados quantitativos devem vir do importador CVM (source='cvm_open_data').
// Upload manual (source='manual_upload') só é usado como fallback quando o dado da CVM:
//   - não existe;
//   - tem erro de parse (parse_status = 'error');
//   - validação crítica (quota_validation_status = 'invalid' / 'cotas_ausentes');
//   - o CNPJ/mês não foi encontrado na CVM.
// Zero da CVM é preservado (0 ≠ null).

export type DataSource =
  | "cvm_open_data"
  | "manual_upload"
  | "internal_position"
  | "master_data"
  | "credit_opinion"
  | "manual_limit"
  | "missing";

export type ExtractionStatus = "ok" | "missing" | "error" | "partial";
export type ValidationStatus = "valid" | "warning" | "critical" | "na";

export type MetricSource = {
  key: string;
  label: string;
  value: unknown;
  dataSource: DataSource;
  extractionStatus: ExtractionStatus;
  validationStatus: ValidationStatus;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  sourceFile: string | null;
};

export type ReportRow = Record<string, unknown> & {
  id?: string;
  source?: string | null;
  source_file_name?: string | null;
  source_url?: string | null;
  quota_validation_status?: string | null;
  reference_month?: string | null;
  version?: number | null;
};

const isPresent = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");

const reportValidationStatus = (r: ReportRow | null): ValidationStatus => {
  if (!r) return "na";
  const v = String(r.quota_validation_status ?? "").toLowerCase();
  if (v === "invalid" || v === "cotas_ausentes") return "critical";
  if (v === "warning") return "warning";
  if (v === "valid") return "valid";
  return "na";
};

const cvmIsUnusable = (cvm: ReportRow | null) => {
  if (!cvm) return true;
  return reportValidationStatus(cvm) === "critical";
};

const sourceFileOf = (r: ReportRow | null): string | null => {
  if (!r) return null;
  return (
    (r.source_file_name as string | null) ??
    (r.source_url as string | null) ??
    (r.source === "cvm_open_data" ? "Dados Abertos CVM" : null)
  );
};

/**
 * Resolve uma métrica com preferência por CVM. Mantém zero válido da CVM.
 */
export function resolveMetric(
  key: string,
  label: string,
  cvm: ReportRow | null,
  manual: ReportRow | null,
): MetricSource {
  const cvmVal = cvm ? cvm[key] : undefined;
  const manualVal = manual ? manual[key] : undefined;
  const cvmOk = !!cvm && !cvmIsUnusable(cvm);

  // Preferência: CVM válida e valor presente (zero é válido).
  if (cvmOk && isPresent(cvmVal)) {
    return {
      key, label,
      value: cvmVal,
      dataSource: "cvm_open_data",
      extractionStatus: "ok",
      validationStatus: reportValidationStatus(cvm),
      fallbackUsed: false,
      fallbackReason: null,
      sourceFile: sourceFileOf(cvm),
    };
  }

  // Fallback para upload manual quando houver valor.
  if (isPresent(manualVal)) {
    let reason = "Sem informe CVM para este FIDC/mês.";
    if (cvm && !cvmOk) reason = "Informe CVM com validação crítica — usando upload manual.";
    else if (cvm && !isPresent(cvmVal)) reason = "Métrica ausente no informe CVM — usando upload manual.";
    return {
      key, label,
      value: manualVal,
      dataSource: "manual_upload",
      extractionStatus: "ok",
      validationStatus: reportValidationStatus(manual),
      fallbackUsed: true,
      fallbackReason: reason,
      sourceFile: sourceFileOf(manual),
    };
  }

  // Sem dado em lugar nenhum.
  return {
    key, label,
    value: null,
    dataSource: "missing",
    extractionStatus: "missing",
    validationStatus: "na",
    fallbackUsed: false,
    fallbackReason: null,
    sourceFile: null,
  };
}

export type ResolvedReport = {
  merged: ReportRow | null;          // valores resolvidos por métrica
  cvm: ReportRow | null;
  manual: ReportRow | null;
  metrics: Record<string, MetricSource>;
  anyManualFallback: boolean;
  hasCvm: boolean;
  hasManual: boolean;
};

// Lista canônica de métricas quantitativas da lâmina (key, label).
export const LAMINATE_METRICS: Array<[string, string]> = [
  ["nav_value", "PL"],
  ["total_assets", "Ativo total"],
  ["total_liabilities", "Passivo total"],
  ["avg_nav_value", "PL médio"],
  ["credit_rights_value", "Direitos Creditórios"],
  ["cash_value", "Caixa"],
  ["cash_strict_value", "Caixa estrito"],
  ["pdd_value", "PDD"],
  ["overdue_value", "Atraso"],
  ["overdue_30d_value", "Atraso ≤30d"],
  ["overdue_60d_value", "Atraso ≤60d"],
  ["overdue_90d_value", "Atraso ≤90d"],
  ["overdue_120d_value", "Atraso ≤120d"],
  ["repurchase_value", "Recompras"],
  ["acquisitions_value", "Aquisições"],
  ["substitutions_value", "Substituições"],
  ["disposals_value", "Cessões/Saídas"],
  ["guarantees_value", "Garantias"],
  ["scr_value", "SCR"],
  ["subordinated_value", "Subordinação (PL)"],
  ["quota_value", "Valor da cota"],
  ["investors_count", "Cotistas"],
  ["total_subscription_value", "Captações (subscrições)"],
  ["total_redemption_value", "Resgates"],
  ["total_amortization_value", "Amortizações"],
  ["net_investor_flow_value", "Fluxo líquido cotistas"],
  ["main_segment", "Segmento principal"],
  ["main_segment_pct", "% segmento principal"],
];

export function resolveReport(cvm: ReportRow | null, manual: ReportRow | null): ResolvedReport {
  const metrics: Record<string, MetricSource> = {};
  const merged: ReportRow = {};
  let anyFallback = false;

  for (const [key, label] of LAMINATE_METRICS) {
    const m = resolveMetric(key, label, cvm, manual);
    metrics[key] = m;
    merged[key] = m.value as never;
    if (m.fallbackUsed) anyFallback = true;
  }

  // Campos não-métrica: preferir CVM, depois manual; copiar todos.
  const passthroughKeys = new Set<string>();
  [cvm, manual].forEach((r) => r && Object.keys(r).forEach((k) => passthroughKeys.add(k)));
  passthroughKeys.forEach((k) => {
    if (k in merged) return;
    const fromCvm = cvm ? cvm[k] : undefined;
    const fromManual = manual ? manual[k] : undefined;
    merged[k] = isPresent(fromCvm) ? fromCvm : (isPresent(fromManual) ? fromManual : (fromCvm ?? fromManual ?? null));
  });

  // Carregar identidade do "current" (preferir CVM válido).
  const base = (cvm && !cvmIsUnusable(cvm)) ? cvm : (manual ?? cvm);
  if (base) {
    merged.id = base.id;
    merged.reference_month = base.reference_month;
    merged.source = base.source;
    merged.source_file_name = base.source_file_name;
  }

  return {
    merged: base ? merged : null,
    cvm, manual, metrics,
    anyManualFallback: anyFallback,
    hasCvm: !!cvm,
    hasManual: !!manual,
  };
}

// Status global para Dashboard/Monitor.
export type ReportSourceStatus =
  | "Completo CVM"
  | "Parcial CVM"
  | "CVM + Manual"
  | "Manual"
  | "Ausente"
  | "Erro de validação";

export function classifyReportStatus(r: ResolvedReport): ReportSourceStatus {
  if (!r.cvm && !r.manual) return "Ausente";
  const cvmCritical = !!r.cvm && cvmIsUnusable(r.cvm);
  if (cvmCritical) return "Erro de validação";
  if (r.cvm && r.manual && r.anyManualFallback) return "CVM + Manual";
  if (r.cvm && !r.manual) {
    // Considera "Parcial CVM" se faltar alguma métrica core na CVM.
    const core = ["nav_value", "credit_rights_value", "cash_value"];
    const missingCore = core.some((k) => !isPresent(r.cvm![k]));
    return missingCore ? "Parcial CVM" : "Completo CVM";
  }
  if (r.cvm && r.manual && !r.anyManualFallback) return "Completo CVM";
  return "Manual";
}

export function dataSourceLabel(s: DataSource): string {
  switch (s) {
    case "cvm_open_data": return "CVM";
    case "manual_upload": return "Manual";
    case "internal_position": return "Posição Butiá";
    case "master_data": return "Cadastro Mestre";
    case "credit_opinion": return "Parecer";
    case "manual_limit": return "Limite Manual";
    case "missing": return "N/D";
  }
}
