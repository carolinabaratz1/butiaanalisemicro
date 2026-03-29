
CREATE TABLE public.analises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Crédito', 'Ação')),
  analista_responsavel TEXT NOT NULL,
  analista_secundario TEXT,
  data_inicio TEXT NOT NULL,
  data_conclusao TEXT,
  status TEXT NOT NULL CHECK (status IN ('Em análise', 'Em revisão', 'Aprovado', 'Reprovado')),
  decisao TEXT CHECK (decisao IN ('Investir', 'Não investir', 'Monitorar')),
  conviccao TEXT CHECK (conviccao IN ('Alta', 'Média', 'Baixa')),
  riscos TEXT DEFAULT '',
  gatilhos TEXT DEFAULT '',
  justificativa TEXT DEFAULT '',
  versao INTEGER NOT NULL DEFAULT 1,
  aprovado_por TEXT,
  data_aprovacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on analises"
  ON public.analises FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on analises"
  ON public.analises FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on analises"
  ON public.analises FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
