// Canonical field definitions for Cadastro Mestre import (portado do FIDC Navigator).
export type CanonicalField =
  | "fidc_name" | "legal_name" | "cnpj" | "isin"
  | "internal_quota_name" | "cvm_quota_name" | "class_name" | "series_name"
  | "quota_type" | "seniority_level"
  | "administrator" | "manager" | "custodian" | "specialized_consultant"
  | "auditor" | "collection_agent" | "main_originator" | "main_assignor"
  | "sector" | "strategy" | "fidc_type" | "condominium_type"
  | "benchmark" | "target_spread" | "remuneration_description" | "amortization_type"
  | "current_rating" | "current_rating_agency" | "current_rating_date"
  | "start_date" | "maturity_date" | "status" | "notes";

export type FieldDef = {
  key: CanonicalField; label: string; scope: "fidc" | "quota" | "shared";
  required?: boolean; aliases: string[];
};

export const FIELDS: FieldDef[] = [
  { key: "fidc_name", label: "Nome do FIDC", scope: "fidc", required: true, aliases: ["nome do fidc","fidc","fundo","nome fundo","nome do fundo","nome"] },
  { key: "legal_name", label: "Razão social", scope: "fidc", aliases: ["razao social","razão social","legal name","denominacao","denominação"] },
  { key: "cnpj", label: "CNPJ", scope: "fidc", required: true, aliases: ["cnpj","cnpj do fidc","cnpj fundo","cnpj_fidc","cnpj fidc"] },
  { key: "isin", label: "ISIN", scope: "quota", required: true, aliases: ["isin","codigo isin","código isin","isin ativo","cod isin"] },
  { key: "internal_quota_name", label: "Nome interno da cota", scope: "quota", aliases: ["nome interno","nome interno da cota","apelido cota"] },
  { key: "cvm_quota_name", label: "Nome da cota CVM/Quantum", scope: "quota", aliases: ["nome cvm","nome quantum","nome da cota cvm","nome da cota quantum","cota cvm","nome no informe"] },
  { key: "class_name", label: "Classe", scope: "quota", aliases: ["classe","classe cota","class"] },
  { key: "series_name", label: "Série", scope: "quota", aliases: ["serie","série"] },
  { key: "quota_type", label: "Tipo da cota", scope: "quota", aliases: ["tipo","tipo da cota","quota type","tipo cota"] },
  { key: "seniority_level", label: "Senioridade", scope: "quota", aliases: ["senioridade","seniority","sen","nivel senioridade"] },
  { key: "administrator", label: "Administrador", scope: "fidc", aliases: ["administrador","adm","admin"] },
  { key: "manager", label: "Gestor", scope: "fidc", aliases: ["gestor","manager"] },
  { key: "custodian", label: "Custodiante", scope: "fidc", aliases: ["custodiante","custodian"] },
  { key: "specialized_consultant", label: "Consultor especializado", scope: "fidc", aliases: ["consultor","consultor especializado","specialized consultant"] },
  { key: "auditor", label: "Auditor", scope: "fidc", aliases: ["auditor","auditoria"] },
  { key: "collection_agent", label: "Agente de cobrança", scope: "fidc", aliases: ["agente de cobranca","agente de cobrança","cobranca"] },
  { key: "main_originator", label: "Originador principal", scope: "fidc", aliases: ["originador","originador principal","main originator"] },
  { key: "main_assignor", label: "Cedente principal", scope: "fidc", aliases: ["cedente","cedente principal","main assignor"] },
  { key: "sector", label: "Setor", scope: "fidc", aliases: ["setor","sector","segmento"] },
  { key: "strategy", label: "Estratégia", scope: "fidc", aliases: ["estrategia","estratégia","strategy"] },
  { key: "fidc_type", label: "Tipo de FIDC", scope: "fidc", aliases: ["tipo fidc","tipo de fidc","fidc type"] },
  { key: "condominium_type", label: "Tipo de condomínio", scope: "fidc", aliases: ["condominio","condomínio","tipo condominio","tipo de condomínio"] },
  { key: "benchmark", label: "Benchmark", scope: "quota", aliases: ["benchmark","indexador","index"] },
  { key: "target_spread", label: "Spread alvo", scope: "quota", aliases: ["spread","spread alvo","target spread"] },
  { key: "remuneration_description", label: "Descrição da remuneração", scope: "quota", aliases: ["remuneracao","remuneração","descricao remuneracao","descrição remuneração"] },
  { key: "amortization_type", label: "Tipo de amortização", scope: "quota", aliases: ["amortizacao","amortização","tipo amortizacao","amortization"] },
  { key: "current_rating", label: "Rating", scope: "quota", aliases: ["rating","rating atual","nota"] },
  { key: "current_rating_agency", label: "Agência de rating", scope: "quota", aliases: ["agencia","agência","agencia de rating","agência de rating","rating agency"] },
  { key: "current_rating_date", label: "Data do rating", scope: "quota", aliases: ["data rating","data do rating","rating date"] },
  { key: "start_date", label: "Data de início", scope: "fidc", aliases: ["data inicio","data de inicio","data de início","start date","inicio"] },
  { key: "maturity_date", label: "Data de vencimento", scope: "fidc", aliases: ["data vencimento","data de vencimento","maturity","vencimento"] },
  { key: "status", label: "Status", scope: "shared", aliases: ["status","situacao","situação"] },
  { key: "notes", label: "Observações", scope: "shared", aliases: ["observacoes","observações","notes","obs"] },
];

export const FIELDS_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<CanonicalField, FieldDef>;
export const VALID_QUOTA_TYPES = ["Sênior", "Senior", "Mezanino", "Subordinada", "Subordinado", "Única"];

export function normalizeHeader(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[._\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function autoMapHeaders(headers: string[]): Record<string, CanonicalField | null> {
  const mapping: Record<string, CanonicalField | null> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    const match = FIELDS.find((f) => f.aliases.some((a) => normalizeHeader(a) === norm));
    mapping[h] = match?.key ?? null;
  }
  return mapping;
}

export function cleanCNPJ(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function isValidCNPJ(raw: string | null | undefined): boolean {
  const c = cleanCNPJ(raw);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const calc = (slice: number[]) => {
    const weights = slice.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = slice.reduce((acc, d, i) => acc + d * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const digits = c.split("").map(Number);
  return calc(digits.slice(0, 12)) === digits[12] && calc(digits.slice(0, 13)) === digits[13];
}

export function isValidISIN(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(v);
}

export function cleanISIN(v: string | null | undefined): string {
  return String(v ?? "").trim().toUpperCase();
}

export function parseDateLoose(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = v * 86400 * 1000;
    return new Date(epoch.getTime() + ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function normalizeQuotaType(v: string | null | undefined): string | null {
  if (!v) return null;
  const norm = normalizeHeader(v);
  if (norm.startsWith("sen")) return "Sênior";
  if (norm.startsWith("mez")) return "Mezanino";
  if (norm.startsWith("sub")) return "Subordinada";
  if (norm.startsWith("uni") || norm === "única") return "Única";
  return v;
}
