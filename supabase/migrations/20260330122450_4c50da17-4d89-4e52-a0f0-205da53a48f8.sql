
ALTER TABLE public.analises
  ADD COLUMN IF NOT EXISTS isin text DEFAULT '',
  ADD COLUMN IF NOT EXISTS prazo text,
  ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS relatorio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS solicitante_id text DEFAULT '';
