-- Renomear "Subordinado" -> "Mezanino" nas tabelas de configuração
UPDATE public.allocation_limits SET subcategoria = 'FIDC Mezanino' WHERE subcategoria = 'FIDC Subordinado';
UPDATE public.allocation_targets SET tipo_ativo = 'FIDC Mezanino' WHERE tipo_ativo = 'FIDC Subordinado';

-- Unificar Termo: remover linha "> 60 dias" (todos serão tratados como ≤ 60 dias)
DELETE FROM public.allocation_limits WHERE subcategoria = 'Termo > 60 dias';
DELETE FROM public.allocation_targets WHERE tipo_ativo = 'Termo > 60 dias';

-- Tabela de classificação manual de cotas de FIDC por ISIN
CREATE TABLE IF NOT EXISTS public.fidc_classes (
  isin text PRIMARY KEY,
  classe text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fidc_classes_classe_chk CHECK (classe IN ('Sênior','Mezanino','NP'))
);

ALTER TABLE public.fidc_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read fidc_classes"
  ON public.fidc_classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Writers insert fidc_classes"
  ON public.fidc_classes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

CREATE POLICY "Writers update fidc_classes"
  ON public.fidc_classes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role))
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

CREATE POLICY "Gestor delete fidc_classes"
  ON public.fidc_classes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role));

CREATE TRIGGER trg_fidc_classes_updated
  BEFORE UPDATE ON public.fidc_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();