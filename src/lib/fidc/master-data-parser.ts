// Client-side Excel parsing + row validation. Portado do FIDC Navigator.
import * as XLSX from "xlsx";
import {
  FIELDS_BY_KEY, autoMapHeaders, cleanCNPJ, cleanISIN, isValidCNPJ, isValidISIN,
  parseDateLoose, normalizeQuotaType, VALID_QUOTA_TYPES, type CanonicalField,
} from "./master-data-schema";

export type RawRow = Record<string, unknown>;
export type ParsedSheet = {
  fileName: string; sheetName: string; headers: string[]; rows: RawRow[];
  autoMapping: Record<string, CanonicalField | null>;
};
export type ValidatedRow = {
  rowNumber: number; data: Partial<Record<CanonicalField, string | null>>;
  errors: string[]; warnings: string[]; status: "valid" | "warning" | "error";
};
export type ExistingRefs = {
  cnpjToFidcName: Map<string, string>;
  isinToCnpj: Map<string, string>;
};
export type ValidationSummary = {
  totalRows: number; validRows: number; warningRows: number; errorRows: number;
  uniqueFidcs: number; uniqueCnpjs: number; uniqueIsins: number;
  toCreateFidcs: number; toUpdateFidcs: number;
  toCreateQuotas: number; toUpdateQuotas: number;
};

export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Planilha vazia.");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { fileName: file.name, sheetName, headers, rows, autoMapping: autoMapHeaders(headers) };
}

export function applyMapping(
  rows: RawRow[],
  mapping: Record<string, CanonicalField | null>,
): Partial<Record<CanonicalField, string | null>>[] {
  return rows.map((row) => {
    const out: Partial<Record<CanonicalField, string | null>> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const raw = row[header];
      if (raw == null || raw === "") continue;
      const def = FIELDS_BY_KEY[field];
      if (def.key === "cnpj") out.cnpj = cleanCNPJ(String(raw));
      else if (def.key === "isin") out.isin = cleanISIN(String(raw));
      else if (def.key === "quota_type") out.quota_type = normalizeQuotaType(String(raw));
      else if (def.key === "current_rating_date" || def.key === "start_date" || def.key === "maturity_date") {
        out[def.key] = parseDateLoose(raw);
      } else if (def.key === "seniority_level") {
        out.seniority_level = String(raw).replace(/\D/g, "") || null;
      } else {
        out[def.key] = String(raw).trim();
      }
    }
    return out;
  });
}

export function validateRows(
  mapped: Partial<Record<CanonicalField, string | null>>[],
  existing: ExistingRefs,
): { rows: ValidatedRow[]; summary: ValidationSummary } {
  const isinToCnpjInFile = new Map<string, Set<string>>();
  const cnpjToNameInFile = new Map<string, Set<string>>();
  mapped.forEach((d) => {
    if (d.isin && d.cnpj) {
      const set = isinToCnpjInFile.get(d.isin) ?? new Set();
      set.add(d.cnpj); isinToCnpjInFile.set(d.isin, set);
    }
    if (d.cnpj && d.fidc_name) {
      const set = cnpjToNameInFile.get(d.cnpj) ?? new Set();
      set.add(d.fidc_name); cnpjToNameInFile.set(d.cnpj, set);
    }
  });

  const rows: ValidatedRow[] = mapped.map((data, idx) => {
    const errors: string[] = []; const warnings: string[] = [];

    if (!data.cnpj && !data.fidc_name) errors.push("Linha sem FIDC e sem CNPJ");
    if (!data.cnpj) errors.push("CNPJ ausente");
    else if (!isValidCNPJ(data.cnpj)) errors.push("CNPJ inválido");
    if (!data.isin) errors.push("ISIN ausente");
    else if (!isValidISIN(data.isin)) warnings.push("Formato de ISIN suspeito");

    if (data.isin) {
      const cnpjsForIsin = isinToCnpjInFile.get(data.isin);
      if (cnpjsForIsin && cnpjsForIsin.size > 1) errors.push("ISIN duplicado em múltiplos CNPJs");
      const existingCnpj = existing.isinToCnpj.get(data.isin);
      if (existingCnpj && data.cnpj && existingCnpj !== data.cnpj) {
        errors.push(`ISIN já cadastrado em outro CNPJ (${existingCnpj.slice(0, 8)}…)`);
      }
    }
    if (data.cnpj && data.fidc_name) {
      const names = cnpjToNameInFile.get(data.cnpj);
      if (names && names.size > 1) errors.push("Mesmo CNPJ com nomes de FIDC conflitantes");
    }
    if (data.quota_type && !VALID_QUOTA_TYPES.includes(data.quota_type)) {
      errors.push(`Tipo de cota inválido: ${data.quota_type}`);
    }

    if (!data.current_rating) warnings.push("Rating ausente");
    if (!data.current_rating_agency) warnings.push("Agência ausente");
    if (!data.administrator) warnings.push("Administrador ausente");
    if (!data.manager) warnings.push("Gestor ausente");
    if (!data.custodian) warnings.push("Custodiante ausente");
    if (!data.current_rating_date) warnings.push("Data do rating ausente");
    if (!data.sector) warnings.push("Setor ausente");
    if (!data.strategy) warnings.push("Estratégia ausente");
    if (!data.internal_quota_name && !data.cvm_quota_name) warnings.push("Nome da cota ausente");

    if (data.cnpj && existing.cnpjToFidcName.has(data.cnpj)) warnings.push("CNPJ existente — será atualizado");
    if (data.isin && existing.isinToCnpj.has(data.isin)) warnings.push("ISIN existente — será atualizado");

    const status: ValidatedRow["status"] = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "valid";
    return { rowNumber: idx + 2, data, errors, warnings, status };
  });

  const uniqueCnpjs = new Set(rows.filter((r) => r.data.cnpj).map((r) => r.data.cnpj!));
  const uniqueIsins = new Set(rows.filter((r) => r.data.isin).map((r) => r.data.isin!));
  const uniqueFidcs = new Set<string>();
  rows.forEach((r) => { if (r.data.cnpj) uniqueFidcs.add(r.data.cnpj); else if (r.data.fidc_name) uniqueFidcs.add(r.data.fidc_name); });

  const validRowsArr = rows.filter((r) => r.status !== "error");
  const cnpjsToCreate = new Set<string>();
  const cnpjsToUpdate = new Set<string>();
  const isinsToCreate = new Set<string>();
  const isinsToUpdate = new Set<string>();
  validRowsArr.forEach((r) => {
    if (r.data.cnpj) (existing.cnpjToFidcName.has(r.data.cnpj) ? cnpjsToUpdate : cnpjsToCreate).add(r.data.cnpj);
    if (r.data.isin) (existing.isinToCnpj.has(r.data.isin) ? isinsToUpdate : isinsToCreate).add(r.data.isin);
  });

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((r) => r.status === "valid").length,
      warningRows: rows.filter((r) => r.status === "warning").length,
      errorRows: rows.filter((r) => r.status === "error").length,
      uniqueFidcs: uniqueFidcs.size,
      uniqueCnpjs: uniqueCnpjs.size,
      uniqueIsins: uniqueIsins.size,
      toCreateFidcs: cnpjsToCreate.size,
      toUpdateFidcs: cnpjsToUpdate.size,
      toCreateQuotas: isinsToCreate.size,
      toUpdateQuotas: isinsToUpdate.size,
    },
  };
}
