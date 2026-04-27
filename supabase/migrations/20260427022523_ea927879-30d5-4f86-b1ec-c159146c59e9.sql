CREATE OR REPLACE FUNCTION public.get_ipca_history(
  p_cutoff date DEFAULT (CURRENT_DATE - INTERVAL '90 days'),
  p_ticker text DEFAULT NULL
)
RETURNS TABLE(
  ticker text,
  data date,
  spread numeric,
  pu_curva numeric,
  pu_indicativo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
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
    AND (p_ticker IS NULL OR tx.ticker = p_ticker)
  ORDER BY tx.ticker, tx.data;
$function$;