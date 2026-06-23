
-- Adicionar valor 'cotas_ausentes' ao enum de validação
ALTER TYPE public.fidc_validation_status ADD VALUE IF NOT EXISTS 'cotas_ausentes';

-- Novos campos no informe mensal para suportar parser sem ISIN
ALTER TABLE public.fidc_monthly_reports
  ADD COLUMN IF NOT EXISTS quota_classes_found_count INT,
  ADD COLUMN IF NOT EXISTS subordinated_calculation_status TEXT,
  ADD COLUMN IF NOT EXISTS subordinated_calculation_notes TEXT,
  ADD COLUMN IF NOT EXISTS source_file_name TEXT,
  ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Garantir unicidade por FIDC + mês (apenas a versão corrente)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fidc_report_current
  ON public.fidc_monthly_reports (fidc_id, reference_month)
  WHERE is_current_version = TRUE;
