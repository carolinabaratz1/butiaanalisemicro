CREATE OR REPLACE FUNCTION public.recalc_trade_metricas_ipca_batch(
  p_after_ticker text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(processed_count integer, next_after_ticker text, has_more boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_date DATE;
  v_d5  DATE; v_d10 DATE; v_d21 DATE; v_d30 DATE; v_d90 DATE;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
  v_processed INTEGER := 0;
  v_next_after TEXT := p_after_ticker;
  v_has_more BOOLEAN := FALSE;
BEGIN
  SET LOCAL statement_timeout = '300s';

  SELECT MAX(data) INTO v_last_date FROM trade_taxas;

  IF v_last_date IS NULL THEN
    RETURN QUERY SELECT 0, p_after_ticker, FALSE;
    RETURN;
  END IF;

  SELECT data INTO v_d5  FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 5)  t ORDER BY data LIMIT 1;
  SELECT data INTO v_d10 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 10) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d21 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 21) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d30 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 30) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d90 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 90) t ORDER BY data LIMIT 1;

  DROP TABLE IF EXISTS pg_temp.tmp_ipca_batch;
  CREATE TEMP TABLE tmp_ipca_batch (ticker text PRIMARY KEY) ON COMMIT DROP;

  INSERT INTO tmp_ipca_batch (ticker)
  SELECT DISTINCT ref.ticker
  FROM trade_ipca_ref ref
  JOIN trade_taxas tx ON tx.ticker = ref.ticker
  WHERE p_after_ticker IS NULL OR ref.ticker > p_after_ticker
  ORDER BY ref.ticker
  LIMIT v_limit;

  SELECT COUNT(*), MAX(ticker) INTO v_processed, v_next_after FROM tmp_ipca_batch;

  IF v_processed = 0 THEN
    RETURN QUERY SELECT 0, p_after_ticker, FALSE;
    RETURN;
  END IF;

  INSERT INTO trade_metricas (
    ticker, indexador, last_date, last_val,
    last_qtd, last_vol_fin, pu_curva, pu_indicativo, pu_ratio,
    avg_5d, avg_10d, avg_21d, avg_30d, avg_90d, std_90d,
    z_score, z_score_5d, z_score_10d, z_score_21d,
    change_bps, total_qtd, total_vol_fin,
    ntnb_ref, ntnb_taxa, updated_at
  )
  WITH ipca_spreads AS (
    SELECT tx.ticker, tx.data,
      ((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100 AS spread,
      tx.qtd_negociada, tx.vol_financeiro, tx.pu_curva, tx.pu_indicativo
    FROM tmp_ipca_batch b
    JOIN trade_taxas tx ON tx.ticker = b.ticker
    JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
    JOIN trade_ntnb nb ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
    WHERE tx.data >= v_d90
  )
  SELECT
    t.ticker, 'IPCA', t.last_date, t.last_val,
    t.last_qtd, t.last_vol_fin, t.pu_curva, t.pu_indicativo,
    CASE WHEN t.pu_curva > 0 THEN t.pu_indicativo / t.pu_curva END,
    w.avg_5d, w.avg_10d, w.avg_21d, w.avg_30d, w.avg_90d, w.std_90d,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_90d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_5d)  / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_10d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_21d) / w.std_90d END,
    (t.last_val - w.first_val) * 100,
    v.total_qtd, v.total_vol_fin,
    ref.ntnb_ref,
    (SELECT taxa_indicativa * 100 FROM trade_ntnb
     WHERE bond_name = ref.ntnb_ref ORDER BY data DESC LIMIT 1),
    NOW()
  FROM (
    SELECT DISTINCT ON (ticker) ticker, data AS last_date,
      spread AS last_val, qtd_negociada AS last_qtd,
      vol_financeiro AS last_vol_fin, pu_curva, pu_indicativo
    FROM ipca_spreads
    WHERE data >= v_last_date - INTERVAL '7 days'
    ORDER BY ticker, data DESC
  ) t
  JOIN trade_ipca_ref ref ON ref.ticker = t.ticker
  JOIN LATERAL (
    SELECT
      AVG(CASE WHEN data >= v_d5  THEN spread END) AS avg_5d,
      AVG(CASE WHEN data >= v_d10 THEN spread END) AS avg_10d,
      AVG(CASE WHEN data >= v_d21 THEN spread END) AS avg_21d,
      AVG(CASE WHEN data >= v_d30 THEN spread END) AS avg_30d,
      AVG(CASE WHEN data >= v_d90 THEN spread END) AS avg_90d,
      STDDEV(CASE WHEN data >= v_d90 THEN spread END) AS std_90d,
      MIN(spread) AS first_val
    FROM ipca_spreads s WHERE s.ticker = t.ticker
  ) w ON true
  JOIN LATERAL (
    SELECT SUM(qtd_negociada) AS total_qtd, SUM(vol_financeiro) AS total_vol_fin
    FROM ipca_spreads s WHERE s.ticker = t.ticker
  ) v ON true
  ON CONFLICT (ticker) DO UPDATE SET
    indexador = EXCLUDED.indexador, last_date = EXCLUDED.last_date,
    last_val = EXCLUDED.last_val, last_qtd = EXCLUDED.last_qtd,
    last_vol_fin = EXCLUDED.last_vol_fin, pu_curva = EXCLUDED.pu_curva,
    pu_indicativo = EXCLUDED.pu_indicativo, pu_ratio = EXCLUDED.pu_ratio,
    avg_5d = EXCLUDED.avg_5d, avg_10d = EXCLUDED.avg_10d,
    avg_21d = EXCLUDED.avg_21d, avg_30d = EXCLUDED.avg_30d,
    avg_90d = EXCLUDED.avg_90d, std_90d = EXCLUDED.std_90d,
    z_score = EXCLUDED.z_score, z_score_5d = EXCLUDED.z_score_5d,
    z_score_10d = EXCLUDED.z_score_10d, z_score_21d = EXCLUDED.z_score_21d,
    change_bps = EXCLUDED.change_bps, total_qtd = EXCLUDED.total_qtd,
    total_vol_fin = EXCLUDED.total_vol_fin, ntnb_ref = EXCLUDED.ntnb_ref,
    ntnb_taxa = EXCLUDED.ntnb_taxa, updated_at = NOW();

  SELECT EXISTS (
    SELECT 1
    FROM trade_ipca_ref ref
    JOIN trade_taxas tx ON tx.ticker = ref.ticker
    WHERE ref.ticker > v_next_after
    LIMIT 1
  ) INTO v_has_more;

  RETURN QUERY SELECT v_processed, v_next_after, v_has_more;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_trade_metricas_ipca()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_after_ticker TEXT := NULL;
  v_result RECORD;
BEGIN
  SET LOCAL statement_timeout = '300s';

  LOOP
    SELECT * INTO v_result
    FROM public.recalc_trade_metricas_ipca_batch(v_after_ticker, 100);

    EXIT WHEN COALESCE(v_result.processed_count, 0) = 0
      OR COALESCE(v_result.has_more, FALSE) = FALSE
      OR v_result.next_after_ticker IS NULL;

    v_after_ticker := v_result.next_after_ticker;
  END LOOP;
END;
$function$;