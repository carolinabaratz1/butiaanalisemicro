import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CvmImportDiagnostic, CvmFidcRow } from "@/lib/fidc/cvm-mapping";

export function useCvmDiagnose() {
  return useMutation({
    mutationFn: async (params: { referenceMonth: string; targetCnpjs: string[]; positionCnpjs: string[] }) => {
      const { data, error } = await supabase.functions.invoke("cvm-fidc-import", { body: params });
      if (error) throw error;
      return data as CvmImportDiagnostic;
    },
  });
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
