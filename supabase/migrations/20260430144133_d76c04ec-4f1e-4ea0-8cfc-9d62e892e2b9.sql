UPDATE public.empresas e
SET codigo_emissor = m.codigo
FROM public._emissor_codigo_map m
WHERE regexp_replace(e.cnpj, '\D', '', 'g') = m.cnpj_d;

DROP TABLE public._emissor_codigo_map;