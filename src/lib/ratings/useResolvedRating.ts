import { useQuery, useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// "fidc_isin": rating resolvido pela cota do FIDC (ISIN), sempre com precedência
//   máxima quando um ISIN de cota é informado — classes diferentes (Sênior,
//   Mezanino, Subordinada) do mesmo FIDC podem ter ratings diferentes.
// "emissor" / "grupo": rating do CNPJ do emissor ou do grupo econômico, quando
//   só um dos dois está disponível.
// "emissor_conservador" / "grupo_conservador": emissor e grupo têm rating
//   cadastrado e DIVERGEM — o valor retornado é o mais conservador (pior) dos
//   dois, e o sufixo indica de qual nível ele veio.
// "ticker": mantido no tipo por compatibilidade histórica, mas a função não
//   usa mais o ticker para decidir rating (debênture sempre resolve por CNPJ).
export type RatingSource =
  | "ticker"
  | "emissor"
  | "grupo"
  | "emissor_conservador"
  | "grupo_conservador"
  | "fidc_isin"
  | "nr";

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

async function fetchResolved(cnpj: string, ticker?: string | null, isin?: string | null): Promise<ResolvedRating> {
  const { data, error } = await supabase.rpc("get_resolved_rating", {
    p_cnpj: cnpj,
    p_ticker: ticker ?? undefined,
    p_isin: isin ?? undefined,
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

export function useResolvedRating(cnpj?: string | null, ticker?: string | null, isin?: string | null) {
  const normCnpj = normalizeCnpj(cnpj);
  const enabled = Boolean(normCnpj || (ticker && ticker.trim().length > 0) || (isin && isin.trim().length > 0));
  return useQuery({
    queryKey: ["resolvedRating", normCnpj, ticker ?? "", isin ?? ""],
    queryFn: () => fetchResolved(normCnpj, ticker, isin),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useResolvedRatings(items: Array<{ cnpj?: string | null; ticker?: string | null; isin?: string | null }>) {
  return useQueries({
    queries: items.map((it) => {
      const normCnpj = normalizeCnpj(it.cnpj);
      return {
        queryKey: ["resolvedRating", normCnpj, it.ticker ?? "", it.isin ?? ""],
        queryFn: () => fetchResolved(normCnpj, it.ticker, it.isin),
        enabled: Boolean(normCnpj || (it.ticker && it.ticker.trim().length > 0) || (it.isin && it.isin.trim().length > 0)),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });
}
