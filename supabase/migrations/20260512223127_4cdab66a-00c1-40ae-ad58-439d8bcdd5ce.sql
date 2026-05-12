
ALTER TABLE public.emissoes 
  ADD COLUMN IF NOT EXISTS fidc_classe text,
  ADD COLUMN IF NOT EXISTS fidc_tipo text;

ALTER TABLE public.emissoes
  DROP CONSTRAINT IF EXISTS emissoes_fidc_classe_chk,
  ADD CONSTRAINT emissoes_fidc_classe_chk CHECK (fidc_classe IS NULL OR fidc_classe IN ('Sênior','Mezanino'));

ALTER TABLE public.emissoes
  DROP CONSTRAINT IF EXISTS emissoes_fidc_tipo_chk,
  ADD CONSTRAINT emissoes_fidc_tipo_chk CHECK (fidc_tipo IS NULL OR fidc_tipo IN ('Padronizado','Não Padronizado'));

-- Migrar dados existentes de fidc_classes para emissoes.fidc_classe
UPDATE public.emissoes e
SET fidc_classe = fc.classe
FROM public.fidc_classes fc
WHERE fc.isin = e.isin
  AND e.fidc_classe IS NULL
  AND fc.classe IN ('Sênior','Mezanino');

-- Para classe NP no fidc_classes legado, considerar Não Padronizado (sem classe sênior/mez definida)
UPDATE public.emissoes e
SET fidc_tipo = 'Não Padronizado'
FROM public.fidc_classes fc
WHERE fc.isin = e.isin
  AND e.fidc_tipo IS NULL
  AND fc.classe = 'NP';
