CREATE OR REPLACE FUNCTION public.get_trade_summary(p_indexador text)
RETURNS TABLE(
  total_count       integer,
  hot_count         integer,
  median_last_val   numeric,
  median_avg_5d     numeric,
  median_avg_10d    numeric,
  median_avg_21d    numeric,
  median_avg_30d    numeric,
  median_avg_90d    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int AS total_count,
    COUNT(*) FILTER (WHERE z_score IS NOT NULL AND ABS(z_score) > 2)::int AS hot_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY last_val) FILTER (WHERE last_val IS NOT NULL AND last_val > 0) AS median_last_val,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_5d)   FILTER (WHERE avg_5d   IS NOT NULL AND avg_5d   > 0) AS median_avg_5d,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_10d)  FILTER (WHERE avg_10d  IS NOT NULL AND avg_10d  > 0) AS median_avg_10d,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_21d)  FILTER (WHERE avg_21d  IS NOT NULL AND avg_21d  > 0) AS median_avg_21d,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_30d)  FILTER (WHERE avg_30d  IS NOT NULL AND avg_30d  > 0) AS median_avg_30d,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY avg_90d)  FILTER (WHERE avg_90d  IS NOT NULL AND avg_90d  > 0) AS median_avg_90d
  FROM public.trade_metricas
  WHERE indexador = p_indexador;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_summary(text) TO authenticated;