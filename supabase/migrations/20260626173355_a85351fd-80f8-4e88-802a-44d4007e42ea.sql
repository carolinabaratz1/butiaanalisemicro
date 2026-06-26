
-- 1. Table
CREATE TABLE public.issuer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  rating text NOT NULL,
  agencia text NULL,
  data_rating date NULL,
  outlook text NULL,
  observacao text NULL,
  report_url text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issuer_ratings_unique UNIQUE NULLS NOT DISTINCT (cnpj, agencia, data_rating)
);

CREATE INDEX issuer_ratings_cnpj_date_idx
  ON public.issuer_ratings (cnpj, data_rating DESC NULLS LAST, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.issuer_ratings TO authenticated;
GRANT ALL ON public.issuer_ratings TO service_role;

ALTER TABLE public.issuer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issuer_ratings_select_authenticated"
  ON public.issuer_ratings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "issuer_ratings_insert_writers"
  ON public.issuer_ratings FOR INSERT
  TO authenticated WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE POLICY "issuer_ratings_update_writers"
  ON public.issuer_ratings FOR UPDATE
  TO authenticated
  USING (public.fidc_can_write(auth.uid()))
  WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE POLICY "issuer_ratings_delete_writers"
  ON public.issuer_ratings FOR DELETE
  TO authenticated USING (public.fidc_can_write(auth.uid()));

-- Normalization + updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_issuer_ratings_normalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cnpj IS NOT NULL THEN
    NEW.cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER issuer_ratings_normalize
  BEFORE INSERT OR UPDATE ON public.issuer_ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_issuer_ratings_normalize();

-- View
CREATE OR REPLACE VIEW public.v_issuer_rating_current AS
SELECT DISTINCT ON (cnpj)
  cnpj,
  rating,
  agencia,
  data_rating,
  outlook,
  id AS source_id
FROM public.issuer_ratings
ORDER BY cnpj, data_rating DESC NULLS LAST, created_at DESC;

GRANT SELECT ON public.v_issuer_rating_current TO authenticated;
GRANT ALL ON public.v_issuer_rating_current TO service_role;

-- Temporary mirror trigger
CREATE OR REPLACE FUNCTION public.tg_issuer_ratings_mirror_empresas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_id uuid;
BEGIN
  SELECT source_id INTO v_current_id
  FROM public.v_issuer_rating_current
  WHERE cnpj = NEW.cnpj;

  IF v_current_id = NEW.id THEN
    UPDATE public.empresas SET rating = NEW.rating WHERE cnpj = NEW.cnpj;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER issuer_ratings_mirror_empresas
  AFTER INSERT OR UPDATE ON public.issuer_ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_issuer_ratings_mirror_empresas();

COMMENT ON TRIGGER issuer_ratings_mirror_empresas ON public.issuer_ratings IS
  'TEMPORARY: espelha rating corrente em empresas.rating para compatibilidade com telas legadas. Remover após migração completa para v_issuer_rating_current / get_resolved_rating.';

-- Resolver RPC
CREATE OR REPLACE FUNCTION public.get_resolved_rating(
  p_cnpj text,
  p_ticker text DEFAULT NULL
)
RETURNS TABLE(rating text, source text, agencia text, data_rating date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    WHERE cnpj = v_cnpj
      AND grupo_economico IS NOT NULL AND grupo_economico <> ''
    LIMIT 1;

    IF v_grupo IS NOT NULL THEN
      SELECT vi.rating INTO v_rating
      FROM public.empresas e
      JOIN public.v_issuer_rating_current vi ON vi.cnpj = e.cnpj
      WHERE e.grupo_economico = v_grupo
        AND e.cnpj <> v_cnpj
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
$$;

GRANT EXECUTE ON FUNCTION public.get_resolved_rating(text, text) TO authenticated, service_role;

-- Seed
INSERT INTO public.issuer_ratings (cnpj, rating, agencia, data_rating, observacao)
SELECT
  regexp_replace(cnpj, '[^0-9]', '', 'g'),
  TRIM(rating),
  NULL,
  NULL,
  'Importação legada do cadastro de empresas (data original desconhecida)'
FROM public.empresas
WHERE rating IS NOT NULL AND TRIM(rating) <> ''
  AND cnpj IS NOT NULL AND TRIM(cnpj) <> ''
ON CONFLICT ON CONSTRAINT issuer_ratings_unique DO NOTHING;
