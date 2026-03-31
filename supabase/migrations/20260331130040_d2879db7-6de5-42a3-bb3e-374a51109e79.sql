ALTER TABLE public.analises DROP CONSTRAINT IF EXISTS analises_tipo_check;
ALTER TABLE public.analises ADD CONSTRAINT analises_tipo_check CHECK (tipo IN ('Crédito Privado', 'Ações'));