ALTER TABLE public.analises ADD COLUMN IF NOT EXISTS link_analise TEXT;
ALTER TABLE public.analises ADD COLUMN IF NOT EXISTS recomendacao_rf TEXT;
ALTER TABLE public.analises DROP CONSTRAINT IF EXISTS analises_recomendacao_rf_check;
ALTER TABLE public.analises ADD CONSTRAINT analises_recomendacao_rf_check CHECK (recomendacao_rf IS NULL OR recomendacao_rf IN ('Buy','Hold','Sell'));