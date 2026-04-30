ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS codigo_emissor text;
CREATE INDEX IF NOT EXISTS idx_empresas_codigo_emissor ON public.empresas(codigo_emissor);