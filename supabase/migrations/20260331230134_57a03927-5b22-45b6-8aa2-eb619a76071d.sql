ALTER TABLE analises
  ADD COLUMN IF NOT EXISTS recomendacao text,
  ADD COLUMN IF NOT EXISTS preco_min numeric,
  ADD COLUMN IF NOT EXISTS preco_medio numeric,
  ADD COLUMN IF NOT EXISTS preco_maximo numeric,
  ADD COLUMN IF NOT EXISTS data_alvo text,
  ADD COLUMN IF NOT EXISTS justificativa_rejeicao text,
  ADD COLUMN IF NOT EXISTS data_comite text;