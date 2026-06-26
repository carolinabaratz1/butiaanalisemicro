
-- Fix: normalize empresas.cnpj when joining to issuer_ratings (which stores digits only)
CREATE OR REPLACE FUNCTION public.get_resolved_rating(p_cnpj text, p_ticker text DEFAULT NULL::text)
 RETURNS TABLE(rating text, source text, agencia text, data_rating date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cnpj text;
  v_rating text;
  v_agencia text;
  v_data date;
  v_grupo text;
BEGIN
  v_cnpj := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');

  IF p_ticker IS NOT NULL AND TRIM(p_ticker) <> '' THEN
    SELECT ta.rating, ta.data_rating INTO v_rating, v_data
    FROM public.trade_ativos ta
    WHERE ta.ticker = p_ticker
      AND ta.rating IS NOT NULL AND ta.rating <> ''
    LIMIT 1;
    IF v_rating IS NOT NULL THEN
      RETURN QUERY SELECT v_rating, 'ticker'::text, NULL::text, v_data;
      RETURN;
    END IF;
  END IF;

  IF v_cnpj <> '' THEN
    SELECT v.rating, v.agencia, v.data_rating
      INTO v_rating, v_agencia, v_data
    FROM public.v_issuer_rating_current v
    WHERE v.cnpj = v_cnpj
    LIMIT 1;
    IF v_rating IS NOT NULL THEN
      RETURN QUERY SELECT v_rating, 'emissor'::text, v_agencia, v_data;
      RETURN;
    END IF;

    SELECT grupo_economico INTO v_grupo
    FROM public.empresas
    WHERE regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g') = v_cnpj
      AND grupo_economico IS NOT NULL AND grupo_economico <> ''
    LIMIT 1;

    IF v_grupo IS NOT NULL THEN
      SELECT vi.rating INTO v_rating
      FROM public.empresas e
      JOIN public.v_issuer_rating_current vi
        ON vi.cnpj = regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g')
      WHERE e.grupo_economico = v_grupo
        AND regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g') <> v_cnpj
      GROUP BY vi.rating
      ORDER BY COUNT(*) DESC, vi.rating ASC
      LIMIT 1;

      IF v_rating IS NOT NULL THEN
        RETURN QUERY SELECT v_rating, 'grupo'::text, NULL::text, NULL::date;
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT NULL::text, 'nr'::text, NULL::text, NULL::date;
END;
$function$;

-- Cleanup the temporary test row
DELETE FROM public.empresas WHERE cnpj = '99999999000199';
