
CREATE OR REPLACE FUNCTION public.get_posicoes_val_dates_by_source(p_source text)
 RETURNS TABLE(val_date_text text, val_date_parsed date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    p.val_date AS val_date_text,
    CASE
      WHEN p.val_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p.val_date, 'MM/DD/YYYY')
      WHEN p.val_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(p.val_date, 'YYYY-MM-DD')
      ELSE NULL
    END AS val_date_parsed
  FROM public.posicoes p
  WHERE p.trading_desk_share_source = p_source
    AND p.val_date IS NOT NULL
    AND p.val_date <> ''
  ORDER BY val_date_parsed DESC NULLS LAST;
$function$;
