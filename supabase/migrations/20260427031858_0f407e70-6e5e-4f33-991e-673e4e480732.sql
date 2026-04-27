
-- 1. Add sub_indexador column to trade_ativos
ALTER TABLE public.trade_ativos
  ADD COLUMN IF NOT EXISTS sub_indexador TEXT;

-- 2. Helper function to derive sub_indexador from taxa_emissao + indexador
CREATE OR REPLACE FUNCTION public.derive_sub_indexador(p_indexador TEXT, p_taxa_emissao TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_taxa_emissao IS NULL OR TRIM(p_taxa_emissao) = '' THEN
    -- fallback: use indexador
    IF p_indexador = 'IPCA' THEN RETURN 'IPCA';
    ELSIF p_indexador = 'PRE' THEN RETURN 'PRE';
    ELSE RETURN 'OUTRO';
    END IF;
  END IF;

  -- IPCA + spread (e.g. "IPCA + 5.6%")
  IF p_taxa_emissao ~* 'IPCA\s*\+' THEN RETURN 'IPCA'; END IF;

  -- % do CDI / % do DI / % CDI / %CDI  → percent of CDI
  IF p_taxa_emissao ~* '^\s*[0-9]+([.,][0-9]+)?\s*%\s*(do\s+)?(CDI|DI)\s*$' THEN
    RETURN 'CDI_PCT';
  END IF;

  -- DI + spread (e.g. "DI + 1.5%")
  IF p_taxa_emissao ~* '^\s*(DI|CDI)\s*\+' THEN RETURN 'DI_SPREAD'; END IF;

  -- Pure pre-fixed (e.g. "12.5%")
  IF p_indexador = 'PRE' THEN RETURN 'PRE'; END IF;

  -- Fallback to indexador
  IF p_indexador = 'IPCA' THEN RETURN 'IPCA'; END IF;
  IF p_indexador = 'DI' THEN RETURN 'DI_SPREAD'; END IF;
  RETURN 'OUTRO';
END;
$$;

-- 3. Backfill existing rows
UPDATE public.trade_ativos
SET sub_indexador = public.derive_sub_indexador(indexador, taxa_emissao);

-- 4. Trigger to keep sub_indexador in sync on insert/update
CREATE OR REPLACE FUNCTION public.tg_set_sub_indexador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.sub_indexador := public.derive_sub_indexador(NEW.indexador, NEW.taxa_emissao);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_ativos_sub_indexador ON public.trade_ativos;
CREATE TRIGGER trg_trade_ativos_sub_indexador
  BEFORE INSERT OR UPDATE OF indexador, taxa_emissao ON public.trade_ativos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_sub_indexador();

-- 5. Recreate trade_monitor_view to expose sub_indexador
DROP VIEW IF EXISTS public.trade_monitor_view;
CREATE VIEW public.trade_monitor_view AS
SELECT
  m.ticker,
  m.indexador,
  m.last_date,
  m.last_val,
  m.last_qtd,
  m.last_vol_fin,
  m.pu_curva,
  m.pu_indicativo,
  m.pu_ratio,
  m.avg_5d,
  m.avg_10d,
  m.avg_21d,
  m.avg_30d,
  m.avg_90d,
  m.std_90d,
  m.z_score,
  m.z_score_5d,
  m.z_score_10d,
  m.z_score_21d,
  m.change_bps,
  m.total_qtd,
  m.total_vol_fin,
  m.ntnb_ref,
  m.ntnb_taxa,
  m.updated_at,
  a.nome_completo,
  a.emissor_nome,
  a.emissor_cnpj,
  a.venc_date,
  a.anos_venc,
  a.indexador AS indexador_ativo,
  a.sub_indexador,
  a.taxa_emissao,
  a.spread_emissao,
  a.rating,
  a.data_rating
FROM trade_metricas m
LEFT JOIN trade_ativos a ON a.ticker = m.ticker;

-- 6. Update get_trade_summary to accept optional sub_indexador filter
DROP FUNCTION IF EXISTS public.get_trade_summary(text);
CREATE OR REPLACE FUNCTION public.get_trade_summary(
  p_indexador TEXT,
  p_sub_indexador TEXT DEFAULT NULL
)
RETURNS TABLE(
  total_count INTEGER,
  hot_count INTEGER,
  median_last_val NUMERIC,
  median_avg_5d NUMERIC,
  median_avg_10d NUMERIC,
  median_avg_21d NUMERIC,
  median_avg_30d NUMERIC,
  median_avg_90d NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE v.z_score IS NOT NULL AND ABS(v.z_score) > 2)::INT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.last_val) FILTER (WHERE v.last_val IS NOT NULL AND v.last_val > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_5d)   FILTER (WHERE v.avg_5d   IS NOT NULL AND v.avg_5d   > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_10d)  FILTER (WHERE v.avg_10d  IS NOT NULL AND v.avg_10d  > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_21d)  FILTER (WHERE v.avg_21d  IS NOT NULL AND v.avg_21d  > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_30d)  FILTER (WHERE v.avg_30d  IS NOT NULL AND v.avg_30d  > 0),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.avg_90d)  FILTER (WHERE v.avg_90d  IS NOT NULL AND v.avg_90d  > 0)
  FROM public.trade_monitor_view v
  WHERE v.indexador = p_indexador
    AND (p_sub_indexador IS NULL OR v.sub_indexador = p_sub_indexador);
$$;
