import { useQuery, useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RatingSource = "ticker" | "emissor" | "grupo" | "nr";

export interface ResolvedRating {
  rating: string | null;
  source: RatingSource;
  agencia: string | null;
  data_rating: string | null;
}

const NR: ResolvedRating = { rating: null, source: "nr", agencia: null, data_rating: null };

function normalizeCnpj(cnpj?: string | null): string {
  return (cnpj ?? "").replace(/[^0-9]/g, "");
}

async function fetchResolved(cnpj: string, ticker?: string | null): Promise<ResolvedRating> {
  const { data, error } = await supabase.rpc("get_resolved_rating", {
    p_cnpj: cnpj,
    p_ticker: ticker ?? undefined,
  });
  if (error || !data || data.length === 0) return NR;
  const row = data[0];
  return {
    rating: row.rating ?? null,
    source: (row.source as RatingSource) ?? "nr",
    agencia: row.agencia ?? null,
    data_rating: row.data_rating ?? null,
  };
}

export function useResolvedRating(cnpj?: string | null, ticker?: string | null) {
  const normCnpj = normalizeCnpj(cnpj);
  const enabled = Boolean(normCnpj || (ticker && ticker.trim().length > 0));
  return useQuery({
    queryKey: ["resolvedRating", normCnpj, ticker ?? ""],
    queryFn: () => fetchResolved(normCnpj, ticker),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useResolvedRatings(items: Array<{ cnpj?: string | null; ticker?: string | null }>) {
  return useQueries({
    queries: items.map((it) => {
      const normCnpj = normalizeCnpj(it.cnpj);
      return {
        queryKey: ["resolvedRating", normCnpj, it.ticker ?? ""],
        queryFn: () => fetchResolved(normCnpj, it.ticker),
        enabled: Boolean(normCnpj || (it.ticker && it.ticker.trim().length > 0)),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });
}
