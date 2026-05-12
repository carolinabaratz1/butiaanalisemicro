
-- Remove possíveis duplicatas antes de criar a unique
DELETE FROM public.allocation_targets a
USING public.allocation_targets b
WHERE a.ctid < b.ctid
  AND a.period_id IS NOT DISTINCT FROM b.period_id
  AND a.fundo = b.fundo
  AND a.tipo_ativo = b.tipo_ativo;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alloc_targets_period_fundo_tipo
  ON public.allocation_targets (period_id, fundo, tipo_ativo);
