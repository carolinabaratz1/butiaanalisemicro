
-- 1. Rename column
ALTER TABLE public.issuer_ratings RENAME COLUMN agencia TO rating_agency;

-- 2. Recreate v_issuer_rating_current (alias `agencia` preserved for consumers)
CREATE OR REPLACE VIEW public.v_issuer_rating_current AS
SELECT DISTINCT ON (cnpj)
  cnpj,
  rating,
  rating_agency AS agencia,
  data_rating,
  outlook,
  id AS source_id
FROM public.issuer_ratings
ORDER BY cnpj, data_rating DESC NULLS LAST, created_at DESC;

-- 3. Dashboard view — resolves emissor -> grupo (mode by severity) -> nr
CREATE OR REPLACE VIEW public.v_empresa_rating_resolved AS
WITH base AS (
  SELECT
    regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g') AS cnpj,
    e.nome,
    e.grupo_economico
  FROM public.empresas e
  WHERE COALESCE(e.cnpj, '') <> ''
),
own_r AS (
  SELECT cnpj, rating, agencia AS rating_agency, data_rating
  FROM public.v_issuer_rating_current
),
group_ranked AS (
  SELECT
    b.cnpj,
    o2.rating,
    ROW_NUMBER() OVER (
      PARTITION BY b.cnpj
      ORDER BY COUNT(*) DESC,
               public.rating_bucket_severity(o2.rating) DESC NULLS LAST
    ) AS rn
  FROM base b
  JOIN base peer
    ON peer.grupo_economico = b.grupo_economico
   AND peer.cnpj <> b.cnpj
  JOIN own_r o2 ON o2.cnpj = peer.cnpj
  WHERE b.grupo_economico IS NOT NULL AND b.grupo_economico <> ''
  GROUP BY b.cnpj, o2.rating
),
group_r AS (SELECT cnpj, rating FROM group_ranked WHERE rn = 1)
SELECT
  b.cnpj,
  b.nome,
  b.grupo_economico,
  COALESCE(o.rating, g.rating) AS rating,
  o.rating_agency,
  o.data_rating,
  CASE
    WHEN o.rating IS NOT NULL THEN 'emissor'
    WHEN g.rating IS NOT NULL THEN 'grupo'
    ELSE 'nr'
  END AS source_level
FROM base b
LEFT JOIN own_r   o ON o.cnpj = b.cnpj
LEFT JOIN group_r g ON g.cnpj = b.cnpj;

GRANT SELECT ON public.v_empresa_rating_resolved TO authenticated;
GRANT ALL    ON public.v_empresa_rating_resolved TO service_role;
