-- Atualiza recalc_trade_metricas_di para não inserir ativos com last_val zero/nulo
-- e limpa registros já existentes com last_val zerado.

CREATE OR REPLACE FUNCTION public.recalc_trade_metricas_di()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_date DATE;
  v_d5  DATE; v_d10 DATE; v_d21 DATE; v_d30 DATE; v_d90 DATE;
BEGIN
  SET LOCAL statement_timeout = '120s';

  SELECT MAX(data) INTO v_last_date FROM trade_taxas;

  SELECT data INTO v_d5  FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 5)  t ORDER BY data LIMIT 1;
  SELECT data INTO v_d10 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 10) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d21 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 21) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d30 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 30) t ORDER BY data LIMIT 1;
  SELECT data INTO v_d90 FROM (SELECT DISTINCT data FROM trade_taxas ORDER BY data DESC LIMIT 90) t ORDER BY data LIMIT 1;

  INSERT INTO trade_metricas (
    ticker, indexador, last_date, last_val,
    last_qtd, last_vol_fin, pu_curva, pu_indicativo, pu_ratio,
    avg_5d, avg_10d, avg_21d, avg_30d, avg_90d, std_90d,
    z_score, z_score_5d, z_score_10d, z_score_21d,
    change_bps, total_qtd, total_vol_fin,
    updated_at
  )
  SELECT
    t.ticker, a.indexador, t.last_date, t.last_val,
    t.last_qtd, t.last_vol_fin, t.pu_curva, t.pu_indicativo,
    CASE WHEN t.pu_curva > 0 THEN t.pu_indicativo / t.pu_curva END,
    w.avg_5d, w.avg_10d, w.avg_21d, w.avg_30d, w.avg_90d, w.std_90d,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_90d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_5d)  / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_10d) / w.std_90d END,
    CASE WHEN w.std_90d > 0 THEN (t.last_val - w.avg_21d) / w.std_90d END,
    (t.last_val - w.first_val) * 100,
    v.total_qtd, v.total_vol_fin, NOW()
  FROM (
    SELECT DISTINCT ON (ticker) ticker,
      data AS last_date, taxa_indicativa * 100 AS last_val,
      qtd_negociada AS last_qtd, vol_financeiro AS last_vol_fin,
      pu_curva, pu_indicativo
    FROM trade_taxas
    WHERE data >= v_last_date - INTERVAL '7 days'
      AND taxa_indicativa IS NOT NULL
      AND taxa_indicativa <> 0
    ORDER BY ticker, data DESC
  ) t
  JOIN trade_ativos a ON a.ticker = t.ticker AND a.indexador IN ('DI','PRE','OUTRO')
  JOIN LATERAL (
    SELECT
      AVG(CASE WHEN data >= v_d5  THEN taxa_indicativa * 100 END) AS avg_5d,
      AVG(CASE WHEN data >= v_d10 THEN taxa_indicativa * 100 END) AS avg_10d,
      AVG(CASE WHEN data >= v_d21 THEN taxa_indicativa * 100 END) AS avg_21d,
      AVG(CASE WHEN data >= v_d30 THEN taxa_indicativa * 100 END) AS avg_30d,
      AVG(CASE WHEN data >= v_d90 THEN taxa_indicativa * 100 END) AS avg_90d,
      STDDEV(CASE WHEN data >= v_d90 THEN taxa_indicativa * 100 END) AS std_90d,
      MIN(CASE WHEN data = (SELECT MIN(data) FROM trade_taxas tt2 WHERE tt2.ticker = t.ticker)
            THEN taxa_indicativa * 100 END) AS first_val
    FROM trade_taxas tt WHERE tt.ticker = t.ticker
  ) w ON true
  JOIN LATERAL (
    SELECT SUM(qtd_negociada) AS total_qtd, SUM(vol_financeiro) AS total_vol_fin
    FROM trade_taxas tv WHERE tv.ticker = t.ticker AND tv.data >= v_d90
  ) v ON true
  WHERE t.last_val IS NOT NULL AND t.last_val <> 0
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
    total_vol_fin = EXCLUDED.total_vol_fin, updated_at = NOW();

  -- Limpa registros existentes com last_val zerado/nulo (DI/PRE/OUTRO)
  DELETE FROM trade_metricas
  WHERE indexador IN ('DI','PRE','OUTRO')
    AND (last_val IS NULL OR last_val = 0);
END;
$function$;

-- Limpeza imediata dos registros já existentes (DI e IPCA)
DELETE FROM trade_metricas
WHERE last_val IS NULL OR last_val = 0;