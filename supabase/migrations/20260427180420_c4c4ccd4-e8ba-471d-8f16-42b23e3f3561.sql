-- ============================================================
-- Trade Monitor: pré-cálculo no upload
-- Cria tabelas materializadas e funções de refresh
-- ============================================================

-- 1. Tabela: série histórica de spread IPCA por ticker
CREATE TABLE IF NOT EXISTS public.trade_spread_historico (
  ticker text NOT NULL,
  data date NOT NULL,
  spread numeric,
  pu_curva numeric,
  pu_indicativo numeric,
  indexador text,
  rating text,
  PRIMARY KEY (ticker, data)
);

CREATE INDEX IF NOT EXISTS idx_trade_spread_hist_data ON public.trade_spread_historico (data);
CREATE INDEX IF NOT EXISTS idx_trade_spread_hist_rating ON public.trade_spread_historico (rating);

ALTER TABLE public.trade_spread_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_authenticated" ON public.trade_spread_historico
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "write_service_role" ON public.trade_spread_historico
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Tabela: agregados diários (mediana/p25/p75) AAA vs Universo
CREATE TABLE IF NOT EXISTS public.trade_spread_agg_diario (
  data date NOT NULL,
  grupo text NOT NULL, -- 'AAA' ou 'UNIVERSO'
  spread_mediano numeric,
  spread_p25 numeric,
  spread_p75 numeric,
  n_ativos integer,
  PRIMARY KEY (data, grupo)
);

CREATE INDEX IF NOT EXISTS idx_trade_spread_agg_data ON public.trade_spread_agg_diario (data);

ALTER TABLE public.trade_spread_agg_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_authenticated" ON public.trade_spread_agg_diario
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "write_service_role" ON public.trade_spread_agg_diario
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Tabela: snapshot completo por ticker (tela de detalhe)
CREATE TABLE IF NOT EXISTS public.trade_ticker_snapshot (
  ticker text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_ticker_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_authenticated" ON public.trade_ticker_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "write_service_role" ON public.trade_ticker_snapshot
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Funções de refresh
-- ============================================================

-- 1. Atualiza série histórica de spread (últimos 90 dias)
CREATE OR REPLACE FUNCTION public.refresh_spread_historico()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff date;
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '300s';

  v_cutoff := CURRENT_DATE - INTERVAL '90 days';

  -- Trunca tudo (recalculado a cada upload)
  TRUNCATE TABLE trade_spread_historico;

  INSERT INTO trade_spread_historico (ticker, data, spread, pu_curva, pu_indicativo, indexador, rating)
  SELECT
    tx.ticker,
    tx.data,
    ROUND(((1 + tx.taxa_indicativa) / (1 + nb.taxa_indicativa) - 1) * 100, 6) AS spread,
    tx.pu_curva,
    tx.pu_indicativo,
    'IPCA' AS indexador,
    a.rating
  FROM trade_taxas tx
  JOIN trade_ipca_ref ref ON ref.ticker = tx.ticker
  JOIN trade_ntnb nb      ON nb.bond_name = ref.ntnb_ref AND nb.data = tx.data
  LEFT JOIN trade_ativos a ON a.ticker = tx.ticker
  WHERE tx.data >= v_cutoff
    AND tx.taxa_indicativa IS NOT NULL
    AND nb.taxa_indicativa IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. Atualiza agregados diários AAA vs Universo
CREATE OR REPLACE FUNCTION public.refresh_spread_agg_diario()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '300s';

  TRUNCATE TABLE trade_spread_agg_diario;

  -- Universo (todos os tickers IPCA com spread)
  INSERT INTO trade_spread_agg_diario (data, grupo, spread_mediano, spread_p25, spread_p75, n_ativos)
  SELECT
    data,
    'UNIVERSO',
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY spread),
    COUNT(*)::int
  FROM trade_spread_historico
  WHERE spread IS NOT NULL
  GROUP BY data;

  -- AAA (rating começa com 'AAA' / 'brAAA' / 'AAA(bra)' etc.)
  INSERT INTO trade_spread_agg_diario (data, grupo, spread_mediano, spread_p25, spread_p75, n_ativos)
  SELECT
    data,
    'AAA',
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY spread),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY spread),
    COUNT(*)::int
  FROM trade_spread_historico
  WHERE spread IS NOT NULL
    AND rating IS NOT NULL
    AND UPPER(rating) ~ 'AAA'
  GROUP BY data;

  SELECT COUNT(*) INTO v_count FROM trade_spread_agg_diario;
  RETURN v_count;
END;
$$;

-- 3. Atualiza snapshots por ticker (tela de detalhe)
CREATE OR REPLACE FUNCTION public.refresh_ticker_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '300s';

  TRUNCATE TABLE trade_ticker_snapshot;

  INSERT INTO trade_ticker_snapshot (ticker, payload, updated_at)
  SELECT
    h.ticker,
    jsonb_build_object(
      'ticker', h.ticker,
      'serie', jsonb_agg(
        jsonb_build_object(
          'data', h.data,
          'spread', h.spread,
          'pu_curva', h.pu_curva,
          'pu_indicativo', h.pu_indicativo
        ) ORDER BY h.data
      ),
      'n_pontos', COUNT(*)::int,
      'rating', MAX(h.rating)
    ),
    NOW()
  FROM trade_spread_historico h
  GROUP BY h.ticker;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;