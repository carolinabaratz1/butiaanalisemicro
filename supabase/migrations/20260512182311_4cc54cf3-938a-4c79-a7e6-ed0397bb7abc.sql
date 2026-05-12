CREATE OR REPLACE FUNCTION public.get_posicoes_val_dates()
RETURNS TABLE(val_date_text text, val_date_parsed date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    val_date,
    CASE
      WHEN val_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(val_date, 'MM/DD/YYYY')
      WHEN val_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(val_date, 'YYYY-MM-DD')
      ELSE NULL
    END AS parsed
  FROM posicoes
  WHERE val_date IS NOT NULL AND val_date <> ''
  ORDER BY parsed DESC NULLS LAST;
$$;