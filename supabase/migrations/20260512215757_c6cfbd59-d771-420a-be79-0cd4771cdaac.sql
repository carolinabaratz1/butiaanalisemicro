
-- 1. Períodos de target
CREATE TABLE public.allocation_target_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundo text NOT NULL,
  nome text NOT NULL,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_target_period_active
  ON public.allocation_target_periods(fundo) WHERE ativo;

ALTER TABLE public.allocation_target_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read target_periods"
  ON public.allocation_target_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Writers insert target_periods"
  ON public.allocation_target_periods FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "Writers update target_periods"
  ON public.allocation_target_periods FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "Gestor delete target_periods"
  ON public.allocation_target_periods FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));

CREATE TRIGGER trg_target_periods_updated
  BEFORE UPDATE ON public.allocation_target_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. period_id em allocation_targets
ALTER TABLE public.allocation_targets
  ADD COLUMN period_id uuid REFERENCES public.allocation_target_periods(id) ON DELETE CASCADE;

-- Backfill: 1 período "Política vigente" por fundo distinto
INSERT INTO public.allocation_target_periods (fundo, nome, data_inicio, ativo)
SELECT DISTINCT fundo, 'Política vigente', CURRENT_DATE, true
FROM public.allocation_targets;

-- Para fundos com targets já existentes, vincular ao período recém-criado
UPDATE public.allocation_targets t
SET period_id = p.id
FROM public.allocation_target_periods p
WHERE p.fundo = t.fundo AND p.ativo = true AND t.period_id IS NULL;

-- 3. Targets por emissor
CREATE TABLE public.allocation_targets_emissor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.allocation_target_periods(id) ON DELETE CASCADE,
  fundo text NOT NULL,
  cnpj_emissor text NOT NULL,
  target_pct numeric,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, fundo, cnpj_emissor)
);

ALTER TABLE public.allocation_targets_emissor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read targets_emissor"
  ON public.allocation_targets_emissor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Writers insert targets_emissor"
  ON public.allocation_targets_emissor FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "Writers update targets_emissor"
  ON public.allocation_targets_emissor FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "Gestor delete targets_emissor"
  ON public.allocation_targets_emissor FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));

CREATE TRIGGER trg_targets_emissor_updated
  BEFORE UPDATE ON public.allocation_targets_emissor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Limite "Soberano" 100% para todos os fundos
INSERT INTO public.allocation_limits (fundo, categoria, subcategoria, limite_pct)
SELECT DISTINCT fundo, 'emissor', 'Soberano', 100
FROM public.allocation_limits
WHERE NOT EXISTS (
  SELECT 1 FROM public.allocation_limits l2
  WHERE l2.fundo = allocation_limits.fundo
    AND l2.categoria = 'emissor' AND l2.subcategoria = 'Soberano'
);

-- 5. Categoria "Crédito Privado" 100% (agregadora) para todos os fundos
INSERT INTO public.allocation_limits (fundo, categoria, subcategoria, limite_pct)
SELECT DISTINCT fundo, 'tipo_ativo', 'Crédito Privado', 100
FROM public.allocation_limits
WHERE NOT EXISTS (
  SELECT 1 FROM public.allocation_limits l2
  WHERE l2.fundo = allocation_limits.fundo
    AND l2.categoria = 'tipo_ativo' AND l2.subcategoria = 'Crédito Privado'
);
