
-- =====================================================
-- 1. cvm_data_dictionary
-- =====================================================
CREATE TABLE public.cvm_data_dictionary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  description TEXT,
  expected_type TEXT,
  source_meta_file TEXT,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_name, column_name)
);

GRANT SELECT ON public.cvm_data_dictionary TO authenticated;
GRANT ALL ON public.cvm_data_dictionary TO service_role;

ALTER TABLE public.cvm_data_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cvm_dict_read_auth"
  ON public.cvm_data_dictionary FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "cvm_dict_write_admin"
  ON public.cvm_data_dictionary FOR ALL
  TO authenticated
  USING (public.fidc_can_write(auth.uid()))
  WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE TRIGGER trg_cvm_dict_updated
  BEFORE UPDATE ON public.cvm_data_dictionary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 2. cvm_fidc_field_mapping
-- =====================================================
CREATE TABLE public.cvm_fidc_field_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name TEXT NOT NULL UNIQUE,
  source_file_pattern TEXT NOT NULL,
  source_column TEXT,
  transformation TEXT,
  composite_rule TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  fallback_rule TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cvm_fidc_field_mapping TO authenticated;
GRANT ALL ON public.cvm_fidc_field_mapping TO service_role;

ALTER TABLE public.cvm_fidc_field_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cvm_map_read_auth"
  ON public.cvm_fidc_field_mapping FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "cvm_map_write_admin"
  ON public.cvm_fidc_field_mapping FOR ALL
  TO authenticated
  USING (public.fidc_can_write(auth.uid()))
  WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE TRIGGER trg_cvm_map_updated
  BEFORE UPDATE ON public.cvm_fidc_field_mapping
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial. source_file_pattern usa substring case-insensitive sobre o nome do CSV.
-- source_column aceita múltiplos candidatos separados por '|'.
-- composite_rule (quando preenchido) sobrepõe source_column: ex 'sum:I.1,I.2.c,...' ou 'abs_sum:I.2.a.10,I.2.b.10'.
INSERT INTO public.cvm_fidc_field_mapping
  (metric_name, source_file_pattern, source_column, composite_rule, transformation, is_required, notes)
VALUES
  ('nav_value',              'inf_mensal_fidc_tab_iv', 'VL_PATRIM_LIQ|IV_A_VL_PATRIM_LIQ', NULL, 'number_br', true,  'IV.a Valor do Patrimônio Líquido'),
  ('total_assets',           'inf_mensal_fidc_tab_i',  'VL_TOTAL|I_VL_TOTAL',               NULL, 'number_br', false, 'I - Ativo total'),
  ('total_liabilities',      'inf_mensal_fidc_tab_iii','VL_TOTAL|III_VL_TOTAL',             NULL, 'number_br', false, 'III - Passivo total'),
  ('credit_rights_value',    'inf_mensal_fidc_tab_i',  NULL, 'sum:I_2_A_VL,I_2_B_VL|VL_DIR_CRED_VENCER,VL_DIR_CRED_VENCIDOS', 'number_br', false, 'I.2.a + I.2.b'),
  ('cash_value',             'inf_mensal_fidc_tab_i',  NULL, 'sum:I_1_VL,I_2_C_VL,I_2_D_VL,I_2_E_VL,I_2_F_VL,I_2_G_VL,I_2_H_VL,I_2_I_VL', 'number_br', false, 'Caixa Ampliado'),
  ('pdd_value',              'inf_mensal_fidc_tab_i',  NULL, 'abs_sum:I_2_A_10_VL,I_2_B_10_VL', 'number_br', false, 'abs(I.2.a.10)+abs(I.2.b.10)'),
  ('overdue_value',          'inf_mensal_fidc_tab_v',  NULL, 'sum:V_B_VL+VI_B_VL', 'number_br', false, 'V.b + VI.b (joins por CNPJ)'),
  ('delinquency_30_value',   'inf_mensal_fidc_tab_v',  NULL, 'sum:V_B_1_VL+VI_B_1_VL', 'number_br', false, 'V.b.1 + VI.b.1'),
  ('delinquency_60_value',   'inf_mensal_fidc_tab_v',  NULL, 'sum:V_B_2_VL+VI_B_2_VL', 'number_br', false, 'V.b.2 + VI.b.2'),
  ('delinquency_90_value',   'inf_mensal_fidc_tab_v',  NULL, 'sum:V_B_3_VL+VI_B_3_VL', 'number_br', false, 'V.b.3 + VI.b.3'),
  ('delinquency_120_value',  'inf_mensal_fidc_tab_v',  NULL, 'sum:V_B_4_VL+VI_B_4_VL', 'number_br', false, 'V.b.4 + VI.b.4'),
  ('repurchase_value',       'inf_mensal_fidc_tab_vii','VII_D_2_VL|VL_RECOMPRA',           NULL, 'number_br', false, 'VII.d.2'),
  ('investors_count',        'inf_mensal_fidc_tab_x',  'X_1_QT|QT_COTST',                  NULL, 'int',       false, 'X.1 Número de Cotistas'),
  ('quota_class_desc',       'inf_mensal_fidc_tab_x',  'X_2_DESC_SERIE|DENOM_CLASSE',      NULL, 'text',      false, 'X.2 Descrição da Série/Classe'),
  ('quota_return',           'inf_mensal_fidc_tab_x',  'X_3_RENTAB|VL_RENTAB_MES',         NULL, 'number_br', false, 'X.3 Rentabilidade Mês');

-- =====================================================
-- 3. cvm_monthly_import_staging
-- =====================================================
CREATE TABLE public.cvm_monthly_import_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_month DATE NOT NULL,
  cnpj TEXT NOT NULL,
  fidc_id UUID REFERENCES public.fidcs(id) ON DELETE SET NULL,
  raw_rows_by_file JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  missing_metrics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reference_month, cnpj)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cvm_monthly_import_staging TO authenticated;
GRANT ALL ON public.cvm_monthly_import_staging TO service_role;

ALTER TABLE public.cvm_monthly_import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cvm_stg_read_auth"
  ON public.cvm_monthly_import_staging FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "cvm_stg_write_admin"
  ON public.cvm_monthly_import_staging FOR ALL
  TO authenticated
  USING (public.fidc_can_write(auth.uid()))
  WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE TRIGGER trg_cvm_stg_updated
  BEFORE UPDATE ON public.cvm_monthly_import_staging
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cvm_stg_month ON public.cvm_monthly_import_staging (reference_month);
CREATE INDEX idx_cvm_stg_cnpj ON public.cvm_monthly_import_staging (cnpj);
CREATE INDEX idx_cvm_stg_status ON public.cvm_monthly_import_staging (extraction_status);
