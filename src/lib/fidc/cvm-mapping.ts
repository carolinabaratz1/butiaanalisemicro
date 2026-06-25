// Tipos e constantes compartilhados entre cliente e edge function (POC CVM v2).
export const CVM_BASE_URL = "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS";
export const cvmZipUrl = (yyyymm: string) => `${CVM_BASE_URL}/inf_mensal_fidc_${yyyymm}.zip`;
export const CVM_META_URL = "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/META/meta_inf_mensal_fidc_txt.zip";

export type CvmFidcStatus = "completo" | "parcial" | "mapping_error" | "validacao_critica" | "nao_encontrado";

export type MetricStatus =
  | "found_value" | "found_zero" | "missing_column"
  | "missing_row" | "mapping_not_defined" | "parse_error";

export type MetricResult = {
  metric: string;
  value: number | string | null;
  status: MetricStatus;
  sourceFile?: string;
  sourceColumn?: string;
  rule?: string;
  rawValues?: Record<string, unknown>;
  error?: string;
};

export type CvmFileDiagnostic = {
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
  tableKind: string | null;
};

export type CvmQuotaFlow = {
  subscription_value?: number; subscription_quota_quantity?: number;
  redemption_value?: number; redemption_quota_quantity?: number;
  requested_redemption_value?: number; requested_redemption_quota_quantity?: number;
  amortization_value?: number; amortization_quota_quantity?: number;
};

export type CvmFidcRow = {
  cnpj: string;
  name: string;
  referenceMonth: string;
  metrics: Record<string, MetricResult>;
  classes: Array<{
    name: string; type?: string;
    pl?: number | null; quotaValue?: number | null; numberOfQuotas?: number | null;
    monthlyYieldPct?: number | null;
    rawQuotaQuantity?: string; rawQuotaValue?: string; rawMonthlyReturn?: string;
    parseStatus?: string; idSubclasse?: string;
    investorsCount?: number | null;
    flows?: CvmQuotaFlow; netFlow?: number; grossFlow?: number;
  }>;
  segments?: Array<{ code: string; name: string; level: number; parent?: string; value: number }>;
  segmentTotal?: number | null;
  mainSegment?: string | null; mainSegmentValue?: number | null; mainSegmentPct?: number | null;
  segmentValidationStatus?: string | null;
  subSegmentsCount?: number;
  flows?: {
    totalSubscriptionValue?: number; totalRedemptionValue?: number;
    totalRequestedRedemptionValue?: number; totalAmortizationValue?: number;
    netInvestorFlowValue?: number; grossInvestorFlowValue?: number;
  };
  rowsByFile: Record<string, Array<Record<string, string>>>;
  pl: number | null; creditRights: number | null; caixaAmpliado: number | null;
  creditRightsGross?: number | null;
  totalAssets?: number | null; totalLiabilities?: number | null;
  avgNav?: number | null; cashStrict?: number | null;
  pdd: number | null; overdueTotal: number | null;
  overdue30: number | null; overdue60: number | null; overdue90: number | null; overdue120: number | null;
  prepaid?: number | null;
  repurchase: number | null; substitution?: number | null;
  acquisitionWithRisk?: number | null; acquisitionWithoutRisk?: number | null;
  investors: number | null;
  sumClassesPL: number; plDiff: number | null; plDiffPct: number | null;
  missingMetrics: string[];
  status: CvmFidcStatus;
  hasPositionInButia: boolean;
};

export type CvmMappingRow = {
  metric_name: string;
  source_file_pattern: string;
  source_column: string | null;
  composite_rule: string | null;
  transformation: string | null;
  is_required: boolean;
};

export type CvmImportDiagnostic = {
  referenceMonth: string;
  url: string;
  fileSizeBytes: number;
  fileHash: string;
  status: string;
  files: CvmFileDiagnostic[];
  totalCnpjs: number;
  mestreFound: string[]; mestreMissing: string[];
  posFound: string[]; posMissing: string[];
  readErrors: string[];
  alerts: string[];
  fidcs: CvmFidcRow[];
  mappingsUsed: CvmMappingRow[];
  elapsedMs: number;
};

export type CvmDictionaryEntry = {
  table_name: string; column_name: string;
  expected_type: string | null; description: string | null;
  source_meta_file: string;
};

export type CvmDictionaryResponse = {
  url: string; fileSizeBytes: number;
  filesInZip: Array<{ filename: string; sizeBytes: number; columns: number; entries: number }>;
  tables: Array<{ table_name: string; columnCount: number; columns: CvmDictionaryEntry[] }>;
  totalColumns: number; persisted: number; elapsedMs: number;
};

export const STATUS_LABELS: Record<CvmFidcStatus, string> = {
  completo: "Completo", parcial: "Parcial",
  mapping_error: "Erro mapeamento", validacao_critica: "Validação crítica",
  nao_encontrado: "Não encontrado",
};

export const STATUS_CLASSES: Record<CvmFidcStatus, string> = {
  completo: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  parcial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  mapping_error: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  validacao_critica: "bg-red-500/15 text-red-600 border-red-500/30",
  nao_encontrado: "bg-muted text-muted-foreground border-border",
};

export const METRIC_STATUS_LABELS: Record<MetricStatus, string> = {
  found_value: "Encontrado",
  found_zero: "Zero real",
  missing_column: "Coluna não encontrada",
  missing_row: "Linha não encontrada",
  mapping_not_defined: "Mapeamento não definido",
  parse_error: "Erro de parse",
};

export const METRIC_STATUS_CLASSES: Record<MetricStatus, string> = {
  found_value: "text-emerald-600",
  found_zero: "text-blue-600",
  missing_column: "text-red-600",
  missing_row: "text-amber-600",
  mapping_not_defined: "text-purple-600",
  parse_error: "text-red-700",
};

export const defaultMonth = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
};
