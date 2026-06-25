
-- Fase A.1: colunas de subordina\u00e7\u00e3o por senioridade em fidc_monthly_reports
ALTER TABLE public.fidc_monthly_reports
  ADD COLUMN IF NOT EXISTS senior_nav_value numeric,
  ADD COLUMN IF NOT EXISTS senior_nav_pct numeric,
  ADD COLUMN IF NOT EXISTS mezzanine_nav_value numeric,
  ADD COLUMN IF NOT EXISTS mezzanine_nav_pct numeric,
  ADD COLUMN IF NOT EXISTS subordinated_nav_value numeric,
  ADD COLUMN IF NOT EXISTS subordinated_nav_pct numeric,
  ADD COLUMN IF NOT EXISTS unique_nav_value numeric,
  ADD COLUMN IF NOT EXISTS unknown_quota_nav_value numeric,
  ADD COLUMN IF NOT EXISTS senior_subordination_ratio numeric,
  ADD COLUMN IF NOT EXISTS mezzanine_subordination_ratio numeric,
  ADD COLUMN IF NOT EXISTS senior_subordination_limit numeric,
  ADD COLUMN IF NOT EXISTS mezzanine_subordination_limit numeric,
  ADD COLUMN IF NOT EXISTS senior_subordination_excess numeric,
  ADD COLUMN IF NOT EXISTS mezzanine_subordination_excess numeric,
  ADD COLUMN IF NOT EXISTS senior_subordination_status text,
  ADD COLUMN IF NOT EXISTS mezzanine_subordination_status text,
  ADD COLUMN IF NOT EXISTS senior_subordination_status_quality text,
  ADD COLUMN IF NOT EXISTS quota_classes_nav_sum numeric,
  ADD COLUMN IF NOT EXISTS quota_classes_nav_diff numeric,
  ADD COLUMN IF NOT EXISTS quota_classes_nav_diff_pct numeric;

-- Fase A.2: campos auxiliares em fidc_monthly_quota_classes
ALTER TABLE public.fidc_monthly_quota_classes
  ADD COLUMN IF NOT EXISTS class_series_name text,
  ADD COLUMN IF NOT EXISTS quota_nav_value numeric,
  ADD COLUMN IF NOT EXISTS nav_pct numeric;

-- Fase A.3: tabela de limites manuais
CREATE TABLE IF NOT EXISTS public.fidc_subordination_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id uuid NOT NULL REFERENCES public.fidcs(id) ON DELETE CASCADE,
  cnpj_fundo_classe text,
  senior_min_subordination_pct numeric,
  mezzanine_min_subordination_pct numeric,
  effective_from date NOT NULL,
  effective_to date,
  source text NOT NULL DEFAULT 'manual',
  regulation_reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_subordination_limits TO authenticated;
GRANT ALL ON public.fidc_subordination_limits TO service_role;

ALTER TABLE public.fidc_subordination_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fidc_sublim_select_auth"
  ON public.fidc_subordination_limits FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "fidc_sublim_write_roles"
  ON public.fidc_subordination_limits FOR ALL
  TO authenticated
  USING (public.fidc_can_write(auth.uid()))
  WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_fidc_sublim_fidc ON public.fidc_subordination_limits(fidc_id);
CREATE INDEX IF NOT EXISTS idx_fidc_sublim_eff  ON public.fidc_subordination_limits(fidc_id, effective_from DESC);

CREATE TRIGGER fidc_sublim_set_updated_at
  BEFORE UPDATE ON public.fidc_subordination_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
