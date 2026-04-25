-- ============================================================
-- BUTIA · Trade Monitor — Database Migration
-- Aplica em: Supabase SQL Editor ou supabase db push
-- ============================================================

-- ------------------------------------------------------------
-- 1. TAXAS DIÁRIAS DOS TÍTULOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_taxas (
  id              BIGSERIAL PRIMARY KEY,
  ticker          TEXT        NOT NULL,
  data            DATE        NOT NULL,
  taxa_indicativa NUMERIC(12,8),
  qtd_negociada   NUMERIC(18,4),
  pu_curva        NUMERIC(14,6),
  pu_indicativo   NUMERIC(14,6),
  vol_financeiro  NUMERIC(20,4)   -- qtd * pu_indicativo, calculado no insert
    GENERATED ALWAYS AS (qtd_negociada * pu_indicativo) STORED,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ticker, data)
);

CREATE INDEX idx_trade_taxas_ticker      ON trade_taxas (ticker);
CREATE INDEX idx_trade_taxas_data        ON trade_taxas (data DESC);
CREATE INDEX idx_trade_taxas_ticker_data ON trade_taxas (ticker, data DESC);

-- ------------------------------------------------------------
-- 2. METADADOS DOS ATIVOS (parse do Nome do Ativo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_ativos (
  ticker          TEXT PRIMARY KEY,
  nome_completo   TEXT,
  emissor_nome    TEXT,
  emissor_cnpj    TEXT,
  venc_date       DATE,
  anos_venc       NUMERIC(6,2),
  indexador       TEXT CHECK (indexador IN ('DI','IPCA','PRE','OUTRO')),
  taxa_emissao    TEXT,
  spread_emissao  NUMERIC(8,4),
  rating          TEXT,
  data_rating     DATE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trade_ativos_indexador ON trade_ativos (indexador);
CREATE INDEX idx_trade_ativos_emissor   ON trade_ativos (emissor_cnpj);

-- ------------------------------------------------------------
-- 3. TAXAS NTN-B DIÁRIAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_ntnb (
  id              BIGSERIAL PRIMARY KEY,
  bond_name       TEXT        NOT NULL,  -- ex: "NTN-B 760199 20450515"
  data            DATE        NOT NULL,
  taxa_indicativa NUMERIC(12,8),
  pu_indicativo   NUMERIC(14,6),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bond_name, data)
);

CREATE INDEX idx_trade_ntnb_bond ON trade_ntnb (bond_name, data DESC);

-- ------------------------------------------------------------
-- 4. MAPEAMENTO ATIVO → NTN-B REFERÊNCIA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_ipca_ref (
  ticker          TEXT PRIMARY KEY,
  emissao         TEXT,
  ntnb_ref        TEXT        NOT NULL,  -- ex: "NTN-B 760199 20450515"
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. MÉTRICAS PRÉ-CALCULADAS (atualizado a cada upload)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_metricas (
  ticker          TEXT PRIMARY KEY,
  indexador       TEXT,
  last_date       DATE,
  last_val        NUMERIC(12,6),   -- taxa (DI) ou spread cap. (IPCA)
  last_qtd        NUMERIC(18,4),
  last_vol_fin    NUMERIC(20,4),
  pu_curva        NUMERIC(14,6),
  pu_indicativo   NUMERIC(14,6),
  pu_ratio        NUMERIC(10,6),
  avg_5d          NUMERIC(12,6),
  avg_10d         NUMERIC(12,6),
  avg_21d         NUMERIC(12,6),
  avg_30d         NUMERIC(12,6),
  avg_90d         NUMERIC(12,6),
  std_90d         NUMERIC(12,6),
  z_score         NUMERIC(10,4),
  z_score_5d      NUMERIC(10,4),
  z_score_10d     NUMERIC(10,4),
  z_score_21d     NUMERIC(10,4),
  change_bps      NUMERIC(10,2),
  total_qtd       NUMERIC(20,4),
  total_vol_fin   NUMERIC(20,4),
  ntnb_ref        TEXT,
  ntnb_taxa       NUMERIC(12,6),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trade_metricas_indexador ON trade_metricas (indexador);
CREATE INDEX idx_trade_metricas_zscore    ON trade_metricas (z_score DESC);

-- ------------------------------------------------------------
-- 6. LOG DE UPLOADS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_upload_log (
  id              BIGSERIAL PRIMARY KEY,
  filename        TEXT        NOT NULL,
  uploaded_by     UUID        REFERENCES auth.users(id),
  data_inicio     DATE,
  data_fim        DATE,
  ativos_di       INTEGER,
  ativos_ipca     INTEGER,
  linhas_inseridas INTEGER,
  linhas_atualizadas INTEGER,
  status          TEXT DEFAULT 'processing' CHECK (status IN ('processing','success','error')),
  erro_msg        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- Ajuste conforme as políticas do seu projeto Lovable.
-- Aqui: leitura pública para usuários autenticados, escrita
-- apenas via service_role (Edge Function).
-- ------------------------------------------------------------
ALTER TABLE trade_taxas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_ativos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_ntnb         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_ipca_ref     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_metricas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_upload_log   ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY "read_authenticated" ON trade_taxas
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_authenticated" ON trade_ativos
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_authenticated" ON trade_ntnb
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_authenticated" ON trade_ipca_ref
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_authenticated" ON trade_metricas
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_authenticated" ON trade_upload_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita: somente service_role (Edge Function usa SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY "write_service_role" ON trade_taxas
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "write_service_role" ON trade_ativos
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "write_service_role" ON trade_ntnb
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "write_service_role" ON trade_ipca_ref
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "write_service_role" ON trade_metricas
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "write_service_role" ON trade_upload_log
  FOR ALL USING (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 8. VIEW ÚTIL: últimas métricas com dados do emissor
-- (join com tabela de emissores do sistema de crédito,
--  ajuste "public.emissores" para o nome real da sua tabela)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW trade_monitor_view AS
SELECT
  m.*,
  a.nome_completo,
  a.emissor_nome,
  a.emissor_cnpj,
  a.venc_date,
  a.anos_venc,
  a.indexador      AS indexador_ativo,
  a.taxa_emissao,
  a.spread_emissao,
  a.rating,
  a.data_rating
FROM trade_metricas m
LEFT JOIN trade_ativos a ON a.ticker = m.ticker;

COMMENT ON VIEW trade_monitor_view IS
  'Métricas de mercado combinadas com metadados das emissões. Use esta view nos componentes React.';
