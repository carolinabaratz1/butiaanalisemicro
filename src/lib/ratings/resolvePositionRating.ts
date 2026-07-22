// Centralized rating resolution for a single position row.
//
// Aplica, nesta ordem, TODAS as regras de rating específicas de posição
// (Caixa intragrupo, emissor sintético via Termo/Overnight/LFT, produtos
// com garantia/estrutura que forçam AAA — DPGE/Compromissada), e só
// então recorre ao rating resolvido pelo RPC `get_resolved_rating`
// (que enxerga apenas CNPJ/ISIN/Ticker do emissor real).
//
// Sempre que uma nova regra de rating por produto for criada, ela deve
// ser adicionada AQUI — não em cada tela — para evitar divergências
// entre Posições, Exposição, Alocação, Dashboard, Analytics e Positions
// Monitor.

import {
  isCaixaIntragrupo,
  isForcedAAAProduct,
  synthesizeIssuerFromProduct,
  type CnpjSet,
  type SyntheticIssuer,
} from "@/components/alocacao/allocationUtils";
import type { ResolvedRating, RatingSource } from "./useResolvedRating";
import { resolveRatingsBatch, ratingKey } from "./resolveRatingsBatch";

export interface PositionLike {
  product?: string | null;
  product_class?: string | null;
  cnpj?: string | null;
  ticker?: string | null;
  isin?: string | null;
}

export interface PositionRating {
  /** Label pronto para exibir (ex: "AAA", "Soberano", "AA-", "N/R"). */
  rating: string | null;
  /** Origem/motivo do rating (usado por RatingBadge para pintar tooltip). */
  source: RatingSource;
  agencia: string | null;
  data_rating: string | null;
  /** Emissor sintético, quando aplicável (Termo → B3, Overnight/LFT → Tesouro). */
  synthIssuer: SyntheticIssuer | null;
  /** true quando o rating veio de uma regra de produto (caixa, synth, DPGE/Compromissada). */
  forcedByRule: boolean;
}

const NR: PositionRating = {
  rating: null,
  source: "nr",
  agencia: null,
  data_rating: null,
  synthIssuer: null,
  forcedByRule: false,
};

/**
 * Resolve o rating final de uma posição individual.
 *
 * @param row       Posição (precisa de product/product_class; cnpj/ticker/isin opcionais).
 * @param resolved  Rating já resolvido pelo RPC (get_resolved_rating). Pode ser null/undefined.
 * @param butiaRfCpCnpjs  CNPJs de fundos Butiá RF CP para detectar cota intragrupo. Opcional.
 */
export function resolvePositionRating(
  row: PositionLike,
  resolved?: ResolvedRating | null,
  butiaRfCpCnpjs?: CnpjSet,
): PositionRating {
  // 1) Caixa intragrupo (fundo Butiá RF CP investindo em outro Butiá RF CP)
  if (isCaixaIntragrupo(row.cnpj, butiaRfCpCnpjs)) {
    return {
      rating: "AAA",
      source: "regra_produto",
      agencia: null,
      data_rating: null,
      synthIssuer: null,
      forcedByRule: true,
    };
  }

  // 2) Emissor sintético (Termo → B3/AAA, Overnight/LFT → Tesouro/Soberano)
  const synth = synthesizeIssuerFromProduct(row.product, row.product_class);
  if (synth) {
    return {
      rating: synth.rating,
      source: "regra_produto",
      agencia: null,
      data_rating: null,
      synthIssuer: synth,
      forcedByRule: true,
    };
  }

  // 3) Produto com garantia/estrutura que força AAA (DPGE, Compromissada)
  if (isForcedAAAProduct(row.product, row.product_class, row.ticker)) {
    return {
      rating: "AAA",
      source: "regra_produto",
      agencia: null,
      data_rating: null,
      synthIssuer: null,
      forcedByRule: true,
    };
  }

  // 4) Rating resolvido pelo RPC (emissor / grupo / cota FIDC)
  if (resolved && resolved.rating) {
    return {
      rating: resolved.rating,
      source: resolved.source,
      agencia: resolved.agencia,
      data_rating: resolved.data_rating,
      synthIssuer: null,
      forcedByRule: false,
    };
  }

  return NR;
}

/**
 * Versão batch: recebe as posições, chama `resolveRatingsBatch` internamente e
 * devolve um Map indexado pela mesma chave da posição (id ou índice) com o
 * `PositionRating` já pronto.
 */
export async function resolvePositionRatingsBatch<T extends PositionLike & { id?: string }>(
  rows: T[],
  butiaRfCpCnpjs?: CnpjSet,
): Promise<Map<string, PositionRating>> {
  const items = rows.map((r) => ({ cnpj: r.cnpj, ticker: r.ticker, isin: r.isin }));
  const rmap = await resolveRatingsBatch(items);

  const out = new Map<string, PositionRating>();
  rows.forEach((r, idx) => {
    const key = r.id ?? String(idx);
    const resolved = rmap.get(ratingKey(r.cnpj, r.ticker, r.isin));
    out.set(key, resolvePositionRating(r, resolved, butiaRfCpCnpjs));
  });
  return out;
}
