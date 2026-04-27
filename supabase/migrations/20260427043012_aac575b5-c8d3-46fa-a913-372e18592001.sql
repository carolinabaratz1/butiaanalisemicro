CREATE OR REPLACE FUNCTION public.apply_forward_fill()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  SET LOCAL statement_timeout = '300s';

  -- Identifica tickers elegíveis (>= 90% de preenchimento) em uma temp table
  DROP TABLE IF EXISTS pg_temp.tmp_ff_eligible;
  CREATE TEMP TABLE tmp_ff_eligible (ticker text PRIMARY KEY) ON COMMIT DROP;

  INSERT INTO tmp_ff_eligible (ticker)
  SELECT ticker
  FROM trade_taxas
  GROUP BY ticker
  HAVING COUNT(*) > 0
     AND COUNT(taxa_indicativa)::float / COUNT(*)::float >= 0.9;

  -- Forward fill usando window function (last value not null por ticker, ordenado por data)
  WITH filled AS (
    SELECT
      tx.id,
      tx.ticker,
      tx.data,
      tx.taxa_indicativa,
      (
        SELECT t2.taxa_indicativa
        FROM trade_taxas t2
        WHERE t2.ticker = tx.ticker
          AND t2.data < tx.data
          AND t2.taxa_indicativa IS NOT NULL
        ORDER BY t2.data DESC
        LIMIT 1
      ) AS prev_val
    FROM trade_taxas tx
    JOIN tmp_ff_eligible e ON e.ticker = tx.ticker
    WHERE tx.taxa_indicativa IS NULL
  )
  UPDATE trade_taxas t
  SET taxa_indicativa = f.prev_val
  FROM filled f
  WHERE t.id = f.id
    AND f.prev_val IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;