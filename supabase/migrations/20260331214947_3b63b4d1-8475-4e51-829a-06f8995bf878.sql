
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  setor TEXT,
  rating TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on empresas" ON public.empresas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert on empresas" ON public.empresas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update on empresas" ON public.empresas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
