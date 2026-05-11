
-- Adiciona colunas a assembleias para suportar upload e triagem
ALTER TABLE public.assembleias
  ADD COLUMN IF NOT EXISTS ticker TEXT,
  ADD COLUMN IF NOT EXISTS url_b3 TEXT,
  ADD COLUMN IF NOT EXISTS data_assembleia DATE,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cnpj_emissor TEXT,
  ADD COLUMN IF NOT EXISTS triagem TEXT DEFAULT 'sem_posicao',
  ADD COLUMN IF NOT EXISTS isins_vinculados TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Índice para deduplicação eficiente
CREATE INDEX IF NOT EXISTS idx_assembleias_dedupe
  ON public.assembleias (ticker, data_assembleia, tipo, url_b3);

-- Tabela de participações (voto por fundo/ISIN)
CREATE TABLE IF NOT EXISTS public.assembleia_participacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembleia_id UUID NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
  isin TEXT,
  fundo TEXT NOT NULL,
  voto TEXT CHECK (voto IN ('A favor','Contra','Abstenção','Não votou')),
  representante TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_part_assembleia ON public.assembleia_participacoes (assembleia_id);

ALTER TABLE public.assembleia_participacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read participacoes"
  ON public.assembleia_participacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Writers insert participacoes"
  ON public.assembleia_participacoes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

CREATE POLICY "Writers update participacoes"
  ON public.assembleia_participacoes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role))
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

CREATE POLICY "Writers delete participacoes"
  ON public.assembleia_participacoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));

-- Log de uploads
CREATE TABLE IF NOT EXISTS public.assembleia_upload_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  total_linhas INTEGER,
  novas INTEGER,
  duplicadas INTEGER,
  com_posicao INTEGER,
  sem_posicao INTEGER,
  pendente_vinculo INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID
);

ALTER TABLE public.assembleia_upload_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read upload log"
  ON public.assembleia_upload_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Writers insert upload log"
  ON public.assembleia_upload_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role) OR has_role(auth.uid(),'Analista'::app_role));
