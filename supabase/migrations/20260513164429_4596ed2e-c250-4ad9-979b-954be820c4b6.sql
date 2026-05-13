
-- 1. Add limite_pct override per period to allocation_targets
ALTER TABLE public.allocation_targets
  ADD COLUMN IF NOT EXISTS limite_pct numeric(6,2);

-- 2. Add "Compromissadas (Overnight)" subcategory in allocation_limits for every fundo
INSERT INTO public.allocation_limits (fundo, categoria, subcategoria, limite_pct)
SELECT f, 'tipo_ativo', 'Compromissadas (Overnight)', NULL
FROM (VALUES ('TOP_CP'), ('TOP_PREV'), ('PLUS_CP_RF'), ('Debentures_INFRA_RF')) AS x(f)
ON CONFLICT (fundo, categoria, subcategoria) DO NOTHING;
