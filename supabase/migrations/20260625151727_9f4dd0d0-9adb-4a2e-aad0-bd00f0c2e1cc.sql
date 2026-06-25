
-- 1) Nova tabela: fidc_monthly_segments (carteira por segmento da TAB II)
CREATE TABLE IF NOT EXISTS public.fidc_monthly_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id UUID REFERENCES public.fidcs(id) ON DELETE CASCADE,
  cnpj_fundo_classe TEXT NOT NULL,
  reference_month DATE NOT NULL,
  segment_group TEXT NOT NULL,        -- "main" | "sub"
  segment_name TEXT NOT NULL,
  segment_code TEXT,                  -- ex: "A", "B", "C1"
  segment_level INTEGER NOT NULL DEFAULT 1,
  parent_segment TEXT,
  value NUMERIC,
  pct_of_segment_portfolio NUMERIC,
  source TEXT NOT NULL DEFAULT 'cvm_open_data',
  source_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fidc_monthly_segments TO authenticated;
GRANT ALL ON public.fidc_monthly_segments TO service_role;

ALTER TABLE public.fidc_monthly_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fidc_monthly_segments_select" ON public.fidc_monthly_segments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_monthly_segments_write" ON public.fidc_monthly_segments
  FOR ALL TO authenticated USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_fidc_monthly_segments_lookup
  ON public.fidc_monthly_segments (cnpj_fundo_classe, reference_month, segment_group);
CREATE INDEX IF NOT EXISTS idx_fidc_monthly_segments_fidc
  ON public.fidc_monthly_segments (fidc_id, reference_month);

-- 2) Colunas adicionais em fidc_monthly_reports
ALTER TABLE public.fidc_monthly_reports
  ADD COLUMN IF NOT EXISTS total_assets NUMERIC,
  ADD COLUMN IF NOT EXISTS total_liabilities NUMERIC,
  ADD COLUMN IF NOT EXISTS payables_value NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_nav_value NUMERIC,
  ADD COLUMN IF NOT EXISTS cash_strict_value NUMERIC,
  ADD COLUMN IF NOT EXISTS portfolio_book_value NUMERIC,
  ADD COLUMN IF NOT EXISTS credit_rights_with_risk_transfer NUMERIC,
  ADD COLUMN IF NOT EXISTS credit_rights_without_risk_transfer NUMERIC,
  ADD COLUMN IF NOT EXISTS credit_rights_gross_value NUMERIC,
  ADD COLUMN IF NOT EXISTS prepaid_value NUMERIC,
  -- TAB II
  ADD COLUMN IF NOT EXISTS segment_portfolio_value NUMERIC,
  ADD COLUMN IF NOT EXISTS main_segment TEXT,
  ADD COLUMN IF NOT EXISTS main_segment_value NUMERIC,
  ADD COLUMN IF NOT EXISTS main_segment_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS segment_validation_status TEXT,
  -- Faixas de vencimento (consolidado V+VI)
  ADD COLUMN IF NOT EXISTS maturity_0_30_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_31_60_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_61_90_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_91_120_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_121_150_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_151_180_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_181_360_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_361_720_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_721_1080_value NUMERIC,
  ADD COLUMN IF NOT EXISTS maturity_over_1080_value NUMERIC,
  -- Inadimplência por bucket (consolidado)
  ADD COLUMN IF NOT EXISTS delinquency_0_30_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_31_60_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_61_90_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_91_120_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_121_150_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_151_180_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_181_360_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_361_720_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_721_1080_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_over_1080_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_30_plus_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_60_plus_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_90_plus_value NUMERIC,
  ADD COLUMN IF NOT EXISTS delinquency_120_plus_value NUMERIC,
  -- TAB VII (negócios no mês)
  ADD COLUMN IF NOT EXISTS acquisition_with_risk_value NUMERIC,
  ADD COLUMN IF NOT EXISTS acquisition_without_risk_value NUMERIC,
  ADD COLUMN IF NOT EXISTS acquisition_value NUMERIC,
  ADD COLUMN IF NOT EXISTS sale_value NUMERIC,
  ADD COLUMN IF NOT EXISTS substitution_value NUMERIC,
  -- TAB X_4 (fluxos consolidados de cotas)
  ADD COLUMN IF NOT EXISTS total_subscription_value NUMERIC,
  ADD COLUMN IF NOT EXISTS total_redemption_value NUMERIC,
  ADD COLUMN IF NOT EXISTS total_requested_redemption_value NUMERIC,
  ADD COLUMN IF NOT EXISTS total_amortization_value NUMERIC,
  ADD COLUMN IF NOT EXISTS net_investor_flow_value NUMERIC,
  ADD COLUMN IF NOT EXISTS gross_investor_flow_value NUMERIC;

-- 3) Colunas adicionais em fidc_monthly_quota_classes
ALTER TABLE public.fidc_monthly_quota_classes
  ADD COLUMN IF NOT EXISTS cnpj_fundo_classe TEXT,
  ADD COLUMN IF NOT EXISTS reference_month DATE,
  ADD COLUMN IF NOT EXISTS id_subclasse TEXT,
  -- Rentabilidade (TAB X_3)
  ADD COLUMN IF NOT EXISTS monthly_return_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_return_decimal NUMERIC,
  ADD COLUMN IF NOT EXISTS raw_monthly_return TEXT,
  ADD COLUMN IF NOT EXISTS return_source_file TEXT,
  -- Quantidades/valores brutos (X_2)
  ADD COLUMN IF NOT EXISTS raw_quota_quantity TEXT,
  ADD COLUMN IF NOT EXISTS raw_quota_value TEXT,
  ADD COLUMN IF NOT EXISTS parse_status TEXT,
  -- Fluxos por classe (TAB X_4)
  ADD COLUMN IF NOT EXISTS subscription_quota_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS redemption_quota_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS requested_redemption_value NUMERIC,
  ADD COLUMN IF NOT EXISTS requested_redemption_quota_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS amortization_quota_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS net_quota_flow_value NUMERIC,
  ADD COLUMN IF NOT EXISTS gross_quota_flow_value NUMERIC,
  ADD COLUMN IF NOT EXISTS quota_flow_source_file TEXT,
  -- Cotistas por classe (TAB X_1)
  ADD COLUMN IF NOT EXISTS investors_count INTEGER,
  ADD COLUMN IF NOT EXISTS investors_source_file TEXT;

CREATE INDEX IF NOT EXISTS idx_fidc_monthly_quota_classes_cnpj
  ON public.fidc_monthly_quota_classes (cnpj_fundo_classe, reference_month);
