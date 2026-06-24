
ALTER TABLE public.fidc_monthly_reports
  ADD COLUMN IF NOT EXISTS overdue_30d_value numeric,
  ADD COLUMN IF NOT EXISTS overdue_60d_value numeric,
  ADD COLUMN IF NOT EXISTS overdue_90d_value numeric,
  ADD COLUMN IF NOT EXISTS overdue_120d_value numeric,
  ADD COLUMN IF NOT EXISTS acquisitions_value numeric,
  ADD COLUMN IF NOT EXISTS substitutions_value numeric,
  ADD COLUMN IF NOT EXISTS disposals_value numeric,
  ADD COLUMN IF NOT EXISTS guarantees_value numeric,
  ADD COLUMN IF NOT EXISTS guarantees_pct_dc numeric,
  ADD COLUMN IF NOT EXISTS scr_status text,
  ADD COLUMN IF NOT EXISTS scr_value numeric,
  ADD COLUMN IF NOT EXISTS segment_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS maturity_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS overdue_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS assignors_breakdown jsonb;

ALTER TABLE public.fidc_monthly_quota_classes
  ADD COLUMN IF NOT EXISTS monthly_yield_pct numeric,
  ADD COLUMN IF NOT EXISTS subscription_value numeric,
  ADD COLUMN IF NOT EXISTS redemption_value numeric,
  ADD COLUMN IF NOT EXISTS amortization_value numeric;
