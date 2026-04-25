-- ============================================================
-- SQL RPC: get_ipca_history
-- Retorna série histórica de spreads capitalizados IPCA+NTN-B
-- Chamado pelo hook useTradeData.ts
-- ============================================================

CREATE OR REPLACE FUNCTION get_ipca_history(p_cutoff DATE DEFAULT (CURRENT_DATE - INTERVAL '90 days'))
RETURNS TABLE (
  ticker          TEXT,
  data            DATE,
  spread          NUMERIC,
  pu_curva        NUMERIC,
  pu_indicativo   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    tx.ticker,
    tx.data,
    ROUND(((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100, 6) AS spread,
    tx.pu_curva,
    tx.pu_indicativo
  FROM trade_taxas tx
  JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
  JOIN trade_ntnb nb      ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
  WHERE tx.data >= p_cutoff
  ORDER BY tx.ticker, tx.data;
$$;

GRANT EXECUTE ON FUNCTION get_ipca_history(DATE) TO authenticated;
