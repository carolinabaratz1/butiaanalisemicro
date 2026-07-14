
-- =========================================
-- FASE 1: 3 tabelas de histórico de ratings
-- =========================================

-- rating_issuer_history
CREATE TABLE public.rating_issuer_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj text NOT NULL,
  rating_value text NOT NULL,
  rating_date date,
  source text,
  outlook text,
  observacao text,
  report_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rating_issuer_history_cnpj_date ON public.rating_issuer_history (cnpj, rating_date DESC NULLS LAST, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_issuer_history TO authenticated;
GRANT ALL ON public.rating_issuer_history TO service_role;
ALTER TABLE public.rating_issuer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rating_issuer_history_read_authenticated"
  ON public.rating_issuer_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "rating_issuer_history_write_managers"
  ON public.rating_issuer_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "rating_issuer_history_update_managers"
  ON public.rating_issuer_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "rating_issuer_history_delete_managers"
  ON public.rating_issuer_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE TRIGGER trg_rating_issuer_history_updated_at
  BEFORE UPDATE ON public.rating_issuer_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- rating_emission_history
CREATE TABLE public.rating_emission_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  isin text NOT NULL,
  cnpj_emissor text,
  rating_value text NOT NULL,
  rating_date date,
  source text,
  outlook text,
  observacao text,
  report_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rating_emission_history_isin_date ON public.rating_emission_history (isin, rating_date DESC NULLS LAST, created_at DESC);
CREATE INDEX idx_rating_emission_history_cnpj ON public.rating_emission_history (cnpj_emissor);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_emission_history TO authenticated;
GRANT ALL ON public.rating_emission_history TO service_role;
ALTER TABLE public.rating_emission_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rating_emission_history_read_authenticated"
  ON public.rating_emission_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "rating_emission_history_write_managers"
  ON public.rating_emission_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "rating_emission_history_update_managers"
  ON public.rating_emission_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "rating_emission_history_delete_managers"
  ON public.rating_emission_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE TRIGGER trg_rating_emission_history_updated_at
  BEFORE UPDATE ON public.rating_emission_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- rating_fidc_class_history
CREATE TABLE public.rating_fidc_class_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  isin text NOT NULL,
  class_code text NOT NULL,
  rating_value text NOT NULL,
  rating_date date,
  source text,
  outlook text,
  observacao text,
  report_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rating_fidc_class_history_key_date ON public.rating_fidc_class_history (isin, class_code, rating_date DESC NULLS LAST, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_fidc_class_history TO authenticated;
GRANT ALL ON public.rating_fidc_class_history TO service_role;
ALTER TABLE public.rating_fidc_class_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rating_fidc_class_history_read_authenticated"
  ON public.rating_fidc_class_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "rating_fidc_class_history_write_managers"
  ON public.rating_fidc_class_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "rating_fidc_class_history_update_managers"
  ON public.rating_fidc_class_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE POLICY "rating_fidc_class_history_delete_managers"
  ON public.rating_fidc_class_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::app_role) OR public.has_role(auth.uid(), 'Coordenação/Especialista'::app_role));
CREATE TRIGGER trg_rating_fidc_class_history_updated_at
  BEFORE UPDATE ON public.rating_fidc_class_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- FASE 2: RPC get_resolved_rating_v2
-- =========================================
CREATE OR REPLACE FUNCTION public.get_resolved_rating_v2(
  p_cnpj text,
  p_isin text DEFAULT NULL,
  p_class_code text DEFAULT NULL
)
RETURNS TABLE (
  rating_value text,
  source_level text,
  rating_date date,
  rating_id uuid,
  source text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj text;
BEGIN
  v_cnpj := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');

  -- Nível 1: FIDC class
  IF p_isin IS NOT NULL AND TRIM(p_isin) <> '' AND p_class_code IS NOT NULL AND TRIM(p_class_code) <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'fidc_class'::text, r.rating_date, r.id, r.source
    FROM public.rating_fidc_class_history r
    WHERE r.isin = p_isin AND r.class_code = p_class_code
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Nível 2: emissão
  IF p_isin IS NOT NULL AND TRIM(p_isin) <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'emission'::text, r.rating_date, r.id, r.source
    FROM public.rating_emission_history r
    WHERE r.isin = p_isin
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Nível 3: emissor
  IF v_cnpj <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'issuer'::text, r.rating_date, r.id, r.source
    FROM public.rating_issuer_history r
    WHERE r.cnpj = v_cnpj
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN QUERY SELECT NULL::text, 'nr'::text, NULL::date, NULL::uuid, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_resolved_rating_v2(text, text, text) TO authenticated, anon, service_role;

-- =========================================
-- FASE 3: Backfill de issuer_ratings -> rating_issuer_history
-- =========================================
INSERT INTO public.rating_issuer_history (
  cnpj, rating_value, rating_date, source, outlook, observacao, report_url, created_by, created_at, updated_at
)
SELECT
  regexp_replace(COALESCE(cnpj,''), '[^0-9]', '', 'g'),
  rating,
  data_rating,
  agencia,
  outlook,
  observacao,
  report_url,
  created_by,
  created_at,
  updated_at
FROM public.issuer_ratings
WHERE rating IS NOT NULL AND TRIM(rating) <> ''
  AND regexp_replace(COALESCE(cnpj,''), '[^0-9]', '', 'g') <> '';
