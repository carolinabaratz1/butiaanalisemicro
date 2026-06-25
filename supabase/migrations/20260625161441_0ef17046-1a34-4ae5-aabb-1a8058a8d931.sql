
ALTER TABLE public.fidc_monthly_reports
  ADD COLUMN IF NOT EXISTS overdue_existing_credit_rights_value numeric,
  ADD COLUMN IF NOT EXISTS defaulted_credit_rights_value numeric,
  ADD COLUMN IF NOT EXISTS overdue_installments_value numeric,
  ADD COLUMN IF NOT EXISTS overdue_value_tab_i numeric,
  ADD COLUMN IF NOT EXISTS overdue_value_tab_v_vi numeric,
  ADD COLUMN IF NOT EXISTS overdue_source text,
  ADD COLUMN IF NOT EXISTS overdue_bucket_coverage_status text,
  ADD COLUMN IF NOT EXISTS delinquency_unbucketed_value numeric,
  ADD COLUMN IF NOT EXISTS overdue_to_credit_rights_ratio numeric,
  ADD COLUMN IF NOT EXISTS pdd_to_overdue_ratio numeric;

INSERT INTO public.cvm_fidc_field_mapping (metric_name, source_file_pattern, source_column, composite_rule, transformation, is_required)
VALUES
  ('overdue_existing_credit_rights_value', '_tab_i_', NULL, 'sum:TAB_I2A2_VL_CRED_VENC_INAD,TAB_I2B2_VL_CRED_VENC_INAD', NULL, false),
  ('defaulted_credit_rights_value',        '_tab_i_', NULL, 'sum:TAB_I2A3_VL_CRED_INAD,TAB_I2B3_VL_CRED_INAD',               NULL, false),
  ('overdue_installments_value',           '_tab_i_', NULL, 'sum:TAB_I2A21_VL_TOTAL_PARCELA_INAD,TAB_I2B21_VL_TOTAL_PARCELA_INAD', NULL, false),
  ('overdue_value_tab_i',                  '_tab_i_', NULL, 'sum:TAB_I2A2_VL_CRED_VENC_INAD,TAB_I2A3_VL_CRED_INAD,TAB_I2B2_VL_CRED_VENC_INAD,TAB_I2B3_VL_CRED_INAD', NULL, false)
ON CONFLICT (metric_name) DO UPDATE SET
  source_file_pattern = EXCLUDED.source_file_pattern,
  source_column       = EXCLUDED.source_column,
  composite_rule      = EXCLUDED.composite_rule,
  transformation      = EXCLUDED.transformation,
  is_required         = EXCLUDED.is_required;
