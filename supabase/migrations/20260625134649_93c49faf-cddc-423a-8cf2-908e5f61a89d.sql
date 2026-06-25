
ALTER TABLE public.fidc_monthly_reports
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_upload',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS fidc_monthly_reports_current_idx
  ON public.fidc_monthly_reports (fidc_id, reference_month)
  WHERE is_current_version = true;

ALTER TABLE public.fidc_monthly_quota_classes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_upload';
