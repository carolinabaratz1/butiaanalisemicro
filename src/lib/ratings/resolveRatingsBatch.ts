// Batch helper for resolving ratings via the get_resolved_rating RPC.
// Useful when many ratings need to be resolved inside an async data hook
// (e.g. useAllocationData), where calling React hooks per row is not possible.
//
// IMPORTANTE: o rating de FIDC vem sempre pela COTA (ISIN), pois classes
// diferentes (Sênior/Mezanino/Subordinada) do mesmo FIDC têm ratings
// diferentes. Por isso a chave de deduplicação e a chamada à RPC agora
// incluem o ISIN — resolver só por CNPJ (como antes) faria todas as cotas
// de um mesmo FIDC compartilharem o mesmo rating incorretamente.

import { supabase } from "@/integrations/supabase/client";
import type { ResolvedRating, RatingSource } from "./useResolvedRating";

const NR: ResolvedRating = { rating: null, source: "nr", agencia: null, data_rating: null };

function normCnpj(cnpj?: string | null): string {
  return (cnpj ?? "").replace(/[^0-9]/g, "");
}

export function ratingKey(cnpj?: string | null, ticker?: string | null, isin?: string | null): string {
  return `${normCnpj(cnpj)}||${ticker ?? ""}||${isin ?? ""}`;
}

export async function resolveRatingsBatch(
  items: Array<{ cnpj?: string | null; ticker?: string | null; isin?: string | null }>,
): Promise<Map<string, ResolvedRating>> {
  const out = new Map<string, ResolvedRating>();
  const unique = new Map<string, { cnpj: string; ticker: string | null; isin: string | null }>();
  for (const it of items) {
    const cnpj = normCnpj(it.cnpj);
    const ticker = it.ticker ?? null;
    const isin = it.isin ?? null;
    const key = ratingKey(cnpj, ticker, isin);
    if (!unique.has(key)) unique.set(key, { cnpj, ticker, isin });
  }

  await Promise.all(
    Array.from(unique.entries()).map(async ([key, { cnpj, ticker, isin }]) => {
      if (!cnpj && !isin) {
        out.set(key, NR);
        return;
      }
      const { data, error } = await supabase.rpc("get_resolved_rating", {
        p_cnpj: cnpj,
        p_ticker: ticker ?? undefined,
        p_isin: isin ?? undefined,
      });
      if (error || !data || (data as any[]).length === 0) {
        out.set(key, NR);
        return;
      }
      const row = (data as any[])[0];
      out.set(key, {
        rating: row.rating ?? null,
        source: (row.source as RatingSource) ?? "nr",
        agencia: row.agencia ?? null,
        data_rating: row.data_rating ?? null,
      });
    }),
  );

  return out;
}
