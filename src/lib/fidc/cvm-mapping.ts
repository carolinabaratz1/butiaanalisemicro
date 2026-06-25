// Constantes/helpers compartilhados entre cliente e função para importação CVM.
export const CVM_BASE_URL = "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS";
export const cvmZipUrl = (yyyymm: string) => `${CVM_BASE_URL}/inf_mensal_fidc_${yyyymm}.zip`;

export type CvmFidcStatus = "completo" | "parcial" | "cotas_ausentes" | "validacao_critica" | "nao_encontrado";

export type CvmFidcRow = {
  cnpj: string;
  name: string;
  referenceMonth: string;       // YYYY-MM-DD
  pl: number | null;
  creditRights: number | null;
  caixaAmpliado: number | null;
  cash: number | null;
  pdd: number | null;
  overdueTotal: number | null;
  overdue30: number | null; overdue60: number | null; overdue90: number | null; overdue120: number | null;
  repurchase: number | null;
  investors: number | null;
  classes: Array<{ name: string; type?: string; pl?: number | null; quotaValue?: number | null; numberOfQuotas?: number | null; monthlyYieldPct?: number | null }>;
  sumClassesPL: number;
  plDiff: number | null;
  plDiffPct: number | null;
  flags: string[];
  status: CvmFidcStatus;
  hasPositionInButia: boolean;
};

export type CvmImportDiagnostic = {
  referenceMonth: string;
  url: string;
  fileSizeBytes: number;
  fileHash: string;
  status: string;
  filesInZip: string[];
  rowsByFile: Record<string, number>;
  totalCnpjs: number;
  mestreFound: string[]; mestreMissing: string[];
  posFound: string[]; posMissing: string[];
  readErrors: string[];
  alerts: string[];
  fidcs: CvmFidcRow[];
  elapsedMs: number;
};

export const STATUS_LABELS: Record<CvmFidcStatus, string> = {
  completo: "Completo",
  parcial: "Parcial",
  cotas_ausentes: "Cotas ausentes",
  validacao_critica: "Validação crítica",
  nao_encontrado: "Não encontrado",
};

export const STATUS_CLASSES: Record<CvmFidcStatus, string> = {
  completo: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  parcial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  cotas_ausentes: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  validacao_critica: "bg-red-500/15 text-red-600 border-red-500/30",
  nao_encontrado: "bg-muted text-muted-foreground border-border",
};

export const defaultMonth = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1); // mês anterior por padrão
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
};
