import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CvmImportDiagnostic, CvmFidcRow, CvmDictionaryResponse, CvmMappingRow } from "@/lib/fidc/cvm-mapping";

export function useCvmDiagnose() {
  return useMutation({
    mutationFn: async (params: { referenceMonth: string; targetCnpjs: string[]; positionCnpjs: string[] }) => {
      const { data, error } = await supabase.functions.invoke("cvm-fidc-import", { body: params });
      if (error) throw error;
      return data as CvmImportDiagnostic;
    },
  });
}

export function useCvmDictionary() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cvm-fidc-dictionary", { body: {} });
      if (error) throw error;
      return data as CvmDictionaryResponse;
    },
  });
}

export function useCvmMapping() {
  return useQuery({
    queryKey: ["cvm-field-mapping"],
    queryFn: async (): Promise<CvmMappingRow[]> => {
      const { data, error } = await supabase
        .from("cvm_fidc_field_mapping")
        .select("metric_name, source_file_pattern, source_column, composite_rule, transformation, is_required")
        .order("metric_name");
      if (error) throw error;
      return data as CvmMappingRow[];
    },
  });
}

export async function updateCvmMapping(metric: string, patch: Partial<CvmMappingRow>) {
  const { error } = await supabase.from("cvm_fidc_field_mapping").update(patch).eq("metric_name", metric);
  if (error) throw error;
}

export type CommitItem = CvmFidcRow & { fidcId: string; mode: "replace" | "new_version" };

export function useCvmCommit() {
  return useMutation({
    mutationFn: async (params: { referenceMonth: string; sourceUrl: string; fileHash: string; items: CommitItem[] }) => {
      const { data, error } = await supabase.functions.invoke("cvm-fidc-commit", { body: params });
      if (error) throw error;
      return data as { ok: boolean; total: number; success: number; failed: number; results: Array<{ fidcId: string; ok: boolean; error?: string }> };
    },
  });
}
