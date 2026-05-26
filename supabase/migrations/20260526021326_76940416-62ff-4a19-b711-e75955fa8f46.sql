CREATE TABLE public.allocation_targets_setor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.allocation_target_periods(id) ON DELETE CASCADE,
  fundo text NOT NULL,
  setor text NOT NULL,
  target_pct numeric(6,2),
  limite_pct numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (period_id, fundo, setor)
);

ALTER TABLE public.allocation_targets_setor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read allocation_targets_setor"
  ON public.allocation_targets_setor FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestor insert allocation_targets_setor"
  ON public.allocation_targets_setor FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));

CREATE POLICY "Gestor update allocation_targets_setor"
  ON public.allocation_targets_setor FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));

CREATE POLICY "Gestor delete allocation_targets_setor"
  ON public.allocation_targets_setor FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));

CREATE TRIGGER trg_allocation_targets_setor_updated_at
  BEFORE UPDATE ON public.allocation_targets_setor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();