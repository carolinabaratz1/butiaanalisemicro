CREATE OR REPLACE FUNCTION public.rating_bucket_severity(p_rating text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_rating IS NULL OR trim(p_rating) = '' THEN NULL
    WHEN upper(trim(p_rating)) IN ('RETIRADO','N/R','NR','WITHDRAWN','WD') THEN NULL
    WHEN p_rating ILIKE '%soberano%' THEN 5
    WHEN regexp_replace(upper(regexp_replace(p_rating, '\(.*?\)', '', 'g')), '^BR', '') LIKE 'AAA%' THEN 5
    WHEN regexp_replace(upper(regexp_replace(p_rating, '\(.*?\)', '', 'g')), '^BR', '') LIKE 'AA%'  THEN 4
    WHEN regexp_replace(upper(regexp_replace(p_rating, '\(.*?\)', '', 'g')), '^BR', '') LIKE 'A%'   THEN 3
    WHEN regexp_replace(upper(regexp_replace(p_rating, '\(.*?\)', '', 'g')), '^BR', '') LIKE 'BBB%' THEN 2
    WHEN regexp_replace(upper(regexp_replace(p_rating, '\(.*?\)', '', 'g')), '^BR', '') ~ '^(BB|B|CCC|CC|C|D)' THEN 1
    ELSE NULL
  END;
$$;