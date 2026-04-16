CREATE TABLE IF NOT EXISTS public.assembleias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cnpj_empresa text REFERENCES public.empresas(cnpj) ON DELETE CASCADE,
  isin text REFERENCES public.emissoes(isin) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('AGO','AGE','Reunião de Debenturistas','Assembleia de Cotistas','Fato Relevante')),
  titulo text NOT NULL,
  descricao text,
  data_evento date NOT NULL,
  hora_evento time,
  data_limite_voto date,
  modalidade text CHECK (modalidade IN ('Presencial','Híbrida','Digital')),
  local_link text,
  status text NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado','Realizado','Cancelado','Adiado')),
  voto_butia text CHECK (voto_butia IN ('A favor','Contra','Abstenção','Não votou')),
  justificativa_voto text,
  resultado text,
  quorum_atingido boolean,
  observacoes text,
  responsavel_id text,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT chk_vinculo_exclusivo CHECK (
    (cnpj_empresa IS NOT NULL AND isin IS NULL) OR (cnpj_empresa IS NULL AND isin IS NOT NULL)
  ),
  CONSTRAINT chk_tipo_vinculo CHECK (
    (tipo IN ('AGO','AGE','Fato Relevante') AND cnpj_empresa IS NOT NULL) OR
    (tipo IN ('Reunião de Debenturistas','Assembleia de Cotistas') AND isin IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_assembleias_cnpj ON public.assembleias(cnpj_empresa);
CREATE INDEX IF NOT EXISTS idx_assembleias_isin ON public.assembleias(isin);
CREATE INDEX IF NOT EXISTS idx_assembleias_data ON public.assembleias(data_evento);
CREATE INDEX IF NOT EXISTS idx_assembleias_status ON public.assembleias(status);
CREATE INDEX IF NOT EXISTS idx_assembleias_tipo ON public.assembleias(tipo);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_assembleias_updated_at ON public.assembleias;
CREATE TRIGGER trg_assembleias_updated_at BEFORE UPDATE ON public.assembleias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assembleias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read assembleias" ON public.assembleias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Writers can insert assembleias" ON public.assembleias FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

CREATE POLICY "Writers can update assembleias" ON public.assembleias FOR UPDATE TO authenticated USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role)) WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

CREATE POLICY "Gestor can delete assembleias" ON public.assembleias FOR DELETE TO authenticated USING (has_role(auth.uid(),'Gestor'::app_role));