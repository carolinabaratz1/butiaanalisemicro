CREATE OR REPLACE FUNCTION public.get_posicoes_val_dates_by_source(p_source text)
RETURNS TABLE(val_date_text text, val_date_parsed date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.val_date AS val_date_text,
    to_date(p.val_date, 'MM/DD/YYYY') AS val_date_parsed
  FROM public.posicoes p
  WHERE p.trading_desk_share_source = p_source
    AND p.val_date IS NOT NULL
  ORDER BY val_date_parsed DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_posicoes_val_dates_by_source(text) TO authenticated;