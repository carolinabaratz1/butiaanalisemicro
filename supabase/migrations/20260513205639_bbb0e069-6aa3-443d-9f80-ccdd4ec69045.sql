
-- 1) Tabela catálogo de setores
CREATE TABLE IF NOT EXISTS public.setores (
  nome text PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read setores"
  ON public.setores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestor insert setores"
  ON public.setores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role));

CREATE POLICY "Gestor update setores"
  ON public.setores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role))
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role));

CREATE POLICY "Gestor delete setores"
  ON public.setores FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role));

CREATE TRIGGER trg_setores_updated_at
  BEFORE UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Seed dos 18 setores aprovados
INSERT INTO public.setores (nome) VALUES
  ('Saneamento'),('Energia'),('Consumo Discricionário'),('Financeiro'),
  ('Saúde'),('Materiais'),('Consumo Básico'),('Industriais'),
  ('Transmissão de Energia'),('Imobiliário'),('Tecnologia da Informação'),
  ('Serviços de Comunicação'),('Geração de Energia'),('Energia Integrada'),
  ('Distribuição de Energia'),('FIDC'),('Fundo'),('Título Público')
ON CONFLICT (nome) DO NOTHING;

-- 3) FK em empresas.setor → setores.nome (somente após upsert dos dados)
-- Será adicionada em migração separada, depois de normalizar os dados existentes.
