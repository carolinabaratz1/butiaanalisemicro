// Front-only replacement for the FIDC Navigator's master-data.functions.ts
// (que rodava como server function via TanStack Start). Aqui chamamos o Supabase
// diretamente; RLS já restringe escrita a Gestor / Coordenação.
import { supabase } from "@/integrations/supabase/client";

type RowPayload = { rowNumber: number; data: Record<string, string | null | undefined> };

export type CommitInput = {
  fileName: string;
  rows: RowPayload[];
  replaceMode?: boolean;
  summary: { totalRows: number; validRows: number; warningRows: number; errorRows: number };
};

export type CommitResult = {
  createdFidcs: number; updatedFidcs: number;
  createdQuotas: number; updatedQuotas: number; deletedFidcs: number;
};

const sb = () => supabase as unknown as {
  from: (t: string) => {
    select: (cols: string) => any;
    insert: (rows: any) => any;
    update: (vals: any) => any;
    upsert: (vals: any, opts?: any) => any;
    delete: () => any;
    in: (...args: any[]) => any;
    eq: (...args: any[]) => any;
    order: (...args: any[]) => any;
    not: (...args: any[]) => any;
    gte: (...args: any[]) => any;
    single: () => any;
  };
};

export async function commitMasterDataImport(input: CommitInput): Promise<CommitResult> {
  if (!input?.fileName) throw new Error("Nome do arquivo ausente");
  if (!Array.isArray(input.rows)) throw new Error("Linhas ausentes");

  const cnpjs = Array.from(new Set(input.rows.map((r) => r.data.cnpj).filter(Boolean) as string[]));
  const isins = Array.from(new Set(input.rows.map((r) => r.data.isin).filter(Boolean) as string[]));

  const { data: existingFidcs } = await sb().from("fidcs")
    .select("id, cnpj").in("cnpj", cnpjs.length ? cnpjs : ["__none__"]);
  const cnpjToId = new Map(((existingFidcs ?? []) as any[]).map((f) => [f.cnpj, f.id]));

  const { data: existingQuotas } = await sb().from("fidc_quota_classes")
    .select("id, isin, fidc_id").in("isin", isins.length ? isins : ["__none__"]);
  const isinToQuota = new Map(((existingQuotas ?? []) as any[]).map((q) => [q.isin, q]));

  let createdFidcs = 0, updatedFidcs = 0, createdQuotas = 0, updatedQuotas = 0;
  const ratingsToInsert: Array<Record<string, unknown>> = [];

  const byCnpj = new Map<string, RowPayload[]>();
  for (const r of input.rows) {
    const c = r.data.cnpj; if (!c) continue;
    const arr = byCnpj.get(c) ?? []; arr.push(r); byCnpj.set(c, arr);
  }

  for (const [cnpj, group] of byCnpj.entries()) {
    const merged: Record<string, string | null> = {};
    const fidcFields = ["fidc_name","legal_name","administrator","manager","custodian",
      "specialized_consultant","auditor","collection_agent","main_originator","main_assignor",
      "sector","strategy","fidc_type","condominium_type","status","start_date","maturity_date","notes"];
    for (const f of fidcFields) {
      for (const r of group) {
        const v = r.data[f]; if (v != null && v !== "") { merged[f] = String(v); break; }
      }
    }
    const fidcRow: any = {
      cnpj,
      name: merged.fidc_name ?? "—",
      legal_name: merged.legal_name ?? null,
      administrator: merged.administrator ?? null,
      manager: merged.manager ?? null,
      custodian: merged.custodian ?? null,
      specialized_consultant: merged.specialized_consultant ?? null,
      auditor: merged.auditor ?? null,
      collection_agent: merged.collection_agent ?? null,
      main_originator: merged.main_originator ?? null,
      main_assignor: merged.main_assignor ?? null,
      sector: merged.sector ?? null,
      strategy: merged.strategy ?? null,
      fidc_type: merged.fidc_type ?? null,
      condominium_type: merged.condominium_type ?? null,
      status: merged.status ?? "active",
      start_date: merged.start_date ?? null,
      maturity_date: merged.maturity_date ?? null,
      notes: merged.notes ?? null,
    };

    const existingId = cnpjToId.get(cnpj);
    const { data: upserted, error } = await sb().from("fidcs")
      .upsert(fidcRow, { onConflict: "cnpj" }).select("id").single();
    if (error) throw new Error(`Erro ao gravar FIDC ${cnpj}: ${(error as any).message}`);
    const fidcId = (upserted as any).id;
    if (existingId) updatedFidcs++; else createdFidcs++;

    for (const r of group) {
      const isin = r.data.isin; if (!isin) continue;
      const existingQuota = isinToQuota.get(isin);
      if (existingQuota && (existingQuota as any).fidc_id !== fidcId) {
        throw new Error(`ISIN ${isin} já existe em outro FIDC — importação bloqueada.`);
      }
      const seniority = r.data.seniority_level ? parseInt(String(r.data.seniority_level), 10) || null : null;
      const quotaRow: any = {
        fidc_id: fidcId, isin,
        internal_quota_name: r.data.internal_quota_name ?? null,
        cvm_quota_name: r.data.cvm_quota_name ?? null,
        class_name: r.data.class_name ?? null,
        series_name: r.data.series_name ?? null,
        quota_type: r.data.quota_type ?? null,
        seniority_level: seniority,
        benchmark: r.data.benchmark ?? null,
        target_spread: r.data.target_spread ?? null,
        remuneration_description: r.data.remuneration_description ?? null,
        amortization_type: r.data.amortization_type ?? null,
        current_rating: r.data.current_rating ?? null,
        current_rating_agency: r.data.current_rating_agency ?? null,
        current_rating_date: r.data.current_rating_date ?? null,
        notes: r.data.notes ?? null,
      };
      const { data: q, error: qe } = await sb().from("fidc_quota_classes")
        .upsert(quotaRow, { onConflict: "isin" }).select("id").single();
      if (qe) throw new Error(`Erro ao gravar ISIN ${isin}: ${(qe as any).message}`);
      if (existingQuota) updatedQuotas++; else createdQuotas++;

      if (r.data.current_rating) {
        ratingsToInsert.push({
          fidc_id: fidcId,
          fidc_quota_class_id: (q as any).id,
          rating_agency: r.data.current_rating_agency ?? null,
          rating: r.data.current_rating,
          rating_date: r.data.current_rating_date ?? null,
        });
      }
    }
  }

  let deletedFidcs = 0;
  if (input.replaceMode) {
    const keepCnpjs = Array.from(byCnpj.keys());
    if (keepCnpjs.length) {
      const { data: del, error: de } = await sb().from("fidcs").delete()
        .not("cnpj", "in", `(${keepCnpjs.map((c) => `"${c}"`).join(",")})`).select("id");
      if (de) throw new Error(`Erro ao remover FIDCs antigos: ${(de as any).message}`);
      deletedFidcs = ((del ?? []) as any[]).length;
    } else {
      const { data: del, error: de } = await sb().from("fidcs").delete()
        .gte("created_at", "1900-01-01").select("id");
      if (de) throw new Error(`Erro ao remover FIDCs antigos: ${(de as any).message}`);
      deletedFidcs = ((del ?? []) as any[]).length;
    }
  }

  if (ratingsToInsert.length > 0) {
    const { error: re } = await sb().from("fidc_rating_history").insert(ratingsToInsert);
    if (re) console.error("rating history insert error", (re as any).message);
  }

  return { createdFidcs, updatedFidcs, createdQuotas, updatedQuotas, deletedFidcs };
}

export async function fetchExistingRefs() {
  const [{ data: fidcs }, { data: quotas }] = await Promise.all([
    sb().from("fidcs").select("cnpj, name"),
    sb().from("fidc_quota_classes").select("isin, fidc_id, fidcs(cnpj)"),
  ]);
  return {
    fidcs: ((fidcs ?? []) as any[]).map((f) => ({ cnpj: f.cnpj as string, name: f.name as string })),
    quotas: ((quotas ?? []) as any[]).map((q) => ({
      isin: q.isin as string,
      cnpj: (q.fidcs?.cnpj ?? "") as string,
    })),
  };
}

export async function listFidcsAll() {
  const { data, error } = await sb().from("fidcs").select("*").order("name", { ascending: true });
  if (error) throw new Error((error as any).message);
  return (data ?? []) as any[];
}

export async function listQuotasAll() {
  const { data, error } = await sb().from("fidc_quota_classes")
    .select("*, fidcs(id, name, cnpj)").order("isin", { ascending: true });
  if (error) throw new Error((error as any).message);
  return (data ?? []) as any[];
}

export async function upsertFidcManual(input: { id?: string; row: Record<string, string | null> }) {
  if (!input.row.cnpj) throw new Error("CNPJ obrigatório");
  if (!input.row.name) throw new Error("Nome do FIDC obrigatório");
  const payload: any = { ...input.row, cnpj: String(input.row.cnpj).replace(/\D/g, "") };
  const q = input.id
    ? sb().from("fidcs").update(payload).eq("id", input.id).select("id").single()
    : sb().from("fidcs").upsert(payload, { onConflict: "cnpj" }).select("id").single();
  const { data: r, error } = await q;
  if (error) throw new Error((error as any).message);
  return { id: (r as any).id as string };
}

export async function upsertQuotaManual(input: { id?: string; row: Record<string, string | number | null> }) {
  if (!input.row.fidc_id) throw new Error("FIDC obrigatório");
  if (!input.row.isin) throw new Error("ISIN obrigatório");
  const payload: any = { ...input.row, isin: String(input.row.isin).trim().toUpperCase() };
  const q = input.id
    ? sb().from("fidc_quota_classes").update(payload).eq("id", input.id).select("id").single()
    : sb().from("fidc_quota_classes").upsert(payload, { onConflict: "isin" }).select("id").single();
  const { data: r, error } = await q;
  if (error) throw new Error((error as any).message);
  return { id: (r as any).id as string };
}

export async function deleteFidcManual(input: { id: string }) {
  const { error } = await sb().from("fidcs").delete().eq("id", input.id);
  if (error) throw new Error((error as any).message);
  return { ok: true };
}

export async function deleteQuotaManual(input: { id: string }) {
  const { error } = await sb().from("fidc_quota_classes").delete().eq("id", input.id);
  if (error) throw new Error((error as any).message);
  return { ok: true };
}
