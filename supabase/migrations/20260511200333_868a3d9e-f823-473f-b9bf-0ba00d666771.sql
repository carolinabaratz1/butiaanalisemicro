
-- ============ allocation_limits ============
CREATE TABLE public.allocation_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundo text NOT NULL,
  categoria text NOT NULL,
  subcategoria text NOT NULL,
  limite_pct numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fundo, categoria, subcategoria)
);

ALTER TABLE public.allocation_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read allocation_limits"
  ON public.allocation_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor insert allocation_limits"
  ON public.allocation_limits FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
CREATE POLICY "Gestor update allocation_limits"
  ON public.allocation_limits FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
CREATE POLICY "Gestor delete allocation_limits"
  ON public.allocation_limits FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));

CREATE TRIGGER trg_allocation_limits_updated_at
  BEFORE UPDATE ON public.allocation_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ allocation_targets ============
CREATE TABLE public.allocation_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundo text NOT NULL,
  tipo_ativo text NOT NULL,
  target_pct numeric(6,2),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fundo, tipo_ativo)
);

ALTER TABLE public.allocation_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read allocation_targets"
  ON public.allocation_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Writers insert allocation_targets"
  ON public.allocation_targets FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role)
           OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "Writers update allocation_targets"
  ON public.allocation_targets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role)
      OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role)
           OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "Gestor delete allocation_targets"
  ON public.allocation_targets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Gestor'::app_role));

CREATE TRIGGER trg_allocation_targets_updated_at
  BEFORE UPDATE ON public.allocation_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED allocation_limits ============
INSERT INTO public.allocation_limits (fundo, categoria, subcategoria, limite_pct) VALUES
-- TOP_CP - tipo_ativo
('TOP_CP','tipo_ativo','Crédito Privado',100),
('TOP_CP','tipo_ativo','Caixa Mínimo',15),
('TOP_CP','tipo_ativo','Crédito Corporativo',100),
('TOP_CP','tipo_ativo','Crédito Financeiro',30),
('TOP_CP','tipo_ativo','Cotas de Fundos CP',5),
('TOP_CP','tipo_ativo','FIDC Cota Sênior',15),
('TOP_CP','tipo_ativo','FIDC Subordinado',NULL),
('TOP_CP','tipo_ativo','FIDC NP',NULL),
('TOP_CP','tipo_ativo','Termo ≤ 60 dias',10),
('TOP_CP','tipo_ativo','Termo > 60 dias',2),
-- TOP_CP - indexador
('TOP_CP','indexador','CDI+',100),('TOP_CP','indexador','%Selic',100),('TOP_CP','indexador','%CDI',100),
('TOP_CP','indexador','Pré',10),('TOP_CP','indexador','IPCA',10),('TOP_CP','indexador','Cambial',NULL),
-- TOP_CP - rating
('TOP_CP','rating','AAA',100),('TOP_CP','rating','AA',80),('TOP_CP','rating','A',25),
('TOP_CP','rating','BBB',NULL),('TOP_CP','rating','<BBB',NULL),('TOP_CP','rating','Sem Rating',NULL),
-- TOP_CP - emissor
('TOP_CP','emissor','AAA',5),('TOP_CP','emissor','AA',4),('TOP_CP','emissor','A',2),
('TOP_CP','emissor','BBB',NULL),('TOP_CP','emissor','<BBB',NULL),('TOP_CP','emissor','Sem Rating',NULL),

-- TOP_PREV
('TOP_PREV','tipo_ativo','Crédito Privado',100),
('TOP_PREV','tipo_ativo','Caixa Mínimo',5),
('TOP_PREV','tipo_ativo','Crédito Corporativo',75),
('TOP_PREV','tipo_ativo','Crédito Financeiro',40),
('TOP_PREV','tipo_ativo','Cotas de Fundos CP',10),
('TOP_PREV','tipo_ativo','FIDC Cota Sênior',15),
('TOP_PREV','tipo_ativo','FIDC Subordinado',NULL),
('TOP_PREV','tipo_ativo','FIDC NP',NULL),
('TOP_PREV','tipo_ativo','Termo ≤ 60 dias',10),
('TOP_PREV','tipo_ativo','Termo > 60 dias',2),
('TOP_PREV','indexador','CDI+',100),('TOP_PREV','indexador','%Selic',100),('TOP_PREV','indexador','%CDI',100),
('TOP_PREV','indexador','Pré',10),('TOP_PREV','indexador','IPCA',10),('TOP_PREV','indexador','Cambial',NULL),
('TOP_PREV','rating','AAA',100),('TOP_PREV','rating','AA',80),('TOP_PREV','rating','A',25),
('TOP_PREV','rating','BBB',NULL),('TOP_PREV','rating','<BBB',NULL),('TOP_PREV','rating','Sem Rating',NULL),
('TOP_PREV','emissor','AAA',5),('TOP_PREV','emissor','AA',4),('TOP_PREV','emissor','A',2),
('TOP_PREV','emissor','BBB',NULL),('TOP_PREV','emissor','<BBB',NULL),('TOP_PREV','emissor','Sem Rating',NULL),

-- PLUS_CP_RF
('PLUS_CP_RF','tipo_ativo','Crédito Privado',100),
('PLUS_CP_RF','tipo_ativo','Caixa Mínimo',5),
('PLUS_CP_RF','tipo_ativo','Crédito Corporativo',120),
('PLUS_CP_RF','tipo_ativo','Crédito Financeiro',40),
('PLUS_CP_RF','tipo_ativo','Cotas de Fundos CP',10),
('PLUS_CP_RF','tipo_ativo','FIDC Cota Sênior',30),
('PLUS_CP_RF','tipo_ativo','FIDC Subordinado',10),
('PLUS_CP_RF','tipo_ativo','FIDC NP',5),
('PLUS_CP_RF','tipo_ativo','Termo ≤ 60 dias',15),
('PLUS_CP_RF','tipo_ativo','Termo > 60 dias',5),
('PLUS_CP_RF','indexador','CDI+',100),('PLUS_CP_RF','indexador','%Selic',100),('PLUS_CP_RF','indexador','%CDI',100),
('PLUS_CP_RF','indexador','Pré',20),('PLUS_CP_RF','indexador','IPCA',20),('PLUS_CP_RF','indexador','Cambial',10),
('PLUS_CP_RF','rating','AAA',100),('PLUS_CP_RF','rating','AA',80),('PLUS_CP_RF','rating','A',50),
('PLUS_CP_RF','rating','BBB',25),('PLUS_CP_RF','rating','<BBB',5),('PLUS_CP_RF','rating','Sem Rating',10),
('PLUS_CP_RF','emissor','AAA',5),('PLUS_CP_RF','emissor','AA',5),('PLUS_CP_RF','emissor','A',4),
('PLUS_CP_RF','emissor','BBB',2),('PLUS_CP_RF','emissor','<BBB',1),('PLUS_CP_RF','emissor','Sem Rating',2),

-- Debentures_INFRA_RF
('Debentures_INFRA_RF','tipo_ativo','Crédito Privado',100),
('Debentures_INFRA_RF','tipo_ativo','Caixa Mínimo',2),
('Debentures_INFRA_RF','tipo_ativo','Crédito Corporativo',100),
('Debentures_INFRA_RF','tipo_ativo','Crédito Financeiro',5),
('Debentures_INFRA_RF','tipo_ativo','Cotas de Fundos CP',2),
('Debentures_INFRA_RF','tipo_ativo','FIDC Cota Sênior',NULL),
('Debentures_INFRA_RF','tipo_ativo','FIDC Subordinado',NULL),
('Debentures_INFRA_RF','tipo_ativo','FIDC NP',NULL),
('Debentures_INFRA_RF','tipo_ativo','Termo ≤ 60 dias',NULL),
('Debentures_INFRA_RF','tipo_ativo','Termo > 60 dias',NULL),
('Debentures_INFRA_RF','indexador','CDI+',5),('Debentures_INFRA_RF','indexador','%Selic',10),('Debentures_INFRA_RF','indexador','%CDI',5),
('Debentures_INFRA_RF','indexador','Pré',5),('Debentures_INFRA_RF','indexador','IPCA',100),('Debentures_INFRA_RF','indexador','Cambial',NULL),
('Debentures_INFRA_RF','rating','AAA',100),('Debentures_INFRA_RF','rating','AA',80),('Debentures_INFRA_RF','rating','A',50),
('Debentures_INFRA_RF','rating','BBB',13),('Debentures_INFRA_RF','rating','<BBB',5),('Debentures_INFRA_RF','rating','Sem Rating',10),
('Debentures_INFRA_RF','emissor','AAA',5),('Debentures_INFRA_RF','emissor','AA',4),('Debentures_INFRA_RF','emissor','A',2),
('Debentures_INFRA_RF','emissor','BBB',1),('Debentures_INFRA_RF','emissor','<BBB',1),('Debentures_INFRA_RF','emissor','Sem Rating',1);
