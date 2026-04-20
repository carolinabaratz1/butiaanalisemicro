-- Fix duplicate (empresa_id, tipo, versao) rows by re-numbering versions ascending by updated_at
WITH dups AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY empresa_id, tipo ORDER BY updated_at ASC, created_at ASC) AS rn
  FROM public.analises
  WHERE (empresa_id, tipo) IN (
    SELECT empresa_id, tipo
    FROM public.analises
    GROUP BY empresa_id, tipo, versao
    HAVING COUNT(*) > 1
  )
)
UPDATE public.analises a
SET versao = d.rn, updated_at = now()
FROM dups d
WHERE a.id = d.id;

-- Prevent future version collisions per (empresa, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_analises_empresa_tipo_versao
  ON public.analises (empresa_id, tipo, versao);