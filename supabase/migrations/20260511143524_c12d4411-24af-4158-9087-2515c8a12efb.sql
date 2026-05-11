
ALTER TABLE public.assembleias DROP CONSTRAINT IF EXISTS chk_tipo_vinculo;
ALTER TABLE public.assembleias DROP CONSTRAINT IF EXISTS chk_vinculo_exclusivo;
ALTER TABLE public.assembleias DROP CONSTRAINT IF EXISTS assembleias_tipo_check;
ALTER TABLE public.assembleias ADD CONSTRAINT assembleias_tipo_check
  CHECK (tipo = ANY (ARRAY['AGO','AGE','AGO/E','AGDEB','Reunião de Debenturistas','Assembleia de Cotistas','Fato Relevante']));
