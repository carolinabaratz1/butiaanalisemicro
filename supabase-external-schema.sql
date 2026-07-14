-- =====================================================================
-- Replicação do schema (Fases 1, 2, 3, 7) para Supabase externo
-- Projeto de destino: wicveoufijvtqebuxxaj
-- Origem: backend do Lovable Cloud
--
-- Ordem de execução:
--   1) Extensões e função utilitária set_updated_at
--   2) (Opcional) app_role + has_role — apenas se você quiser as policies
--      restritivas por papel. Se já tiver, pule este bloco.
--   3) Tabelas rating_*_history + índices + GRANTs + RLS + policies
--   4) RPC get_resolved_rating_v2
--   5) Tabelas fidc_alert_rules / fidc_alert_events + policies
--   6) (Opcional) Backfill de rating_issuer_history a partir de issuer_ratings
--
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Extensões e utilitário
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) (OPCIONAL) app_role + has_role
--    Descomente este bloco se o projeto de destino AINDA não tem
--    esses objetos. As policies das seções seguintes usam has_role().
--    Se preferir policies mais simples (todo authenticated escreve),
--    veja o bloco alternativo no final.
-- ---------------------------------------------------------------------
/*
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'Gestor',
      'Coordenação/Especialista',
      'Analista',
      'Risco',
      'Consulta'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
*/

-- ---------------------------------------------------------------------
-- 3) Tabelas de histórico de rating (Fase 1)
-- ---------------------------------------------------------------------

-- rating_issuer_history --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rating_issuer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_rating_issuer_history_cnpj_date
  ON public.rating_issuer_history (cnpj, rating_date DESC NULLS LAST, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_issuer_history TO authenticated;
GRANT ALL ON public.rating_issuer_history TO service_role;
ALTER TABLE public.rating_issuer_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rating_issuer_history_read_authenticated" ON public.rating_issuer_history;
CREATE POLICY "rating_issuer_history_read_authenticated"
  ON public.rating_issuer_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rating_issuer_history_write_managers" ON public.rating_issuer_history;
CREATE POLICY "rating_issuer_history_write_managers"
  ON public.rating_issuer_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "rating_issuer_history_update_managers" ON public.rating_issuer_history;
CREATE POLICY "rating_issuer_history_update_managers"
  ON public.rating_issuer_history FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "rating_issuer_history_delete_managers" ON public.rating_issuer_history;
CREATE POLICY "rating_issuer_history_delete_managers"
  ON public.rating_issuer_history FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP TRIGGER IF EXISTS trg_rating_issuer_history_updated_at ON public.rating_issuer_history;
CREATE TRIGGER trg_rating_issuer_history_updated_at
  BEFORE UPDATE ON public.rating_issuer_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- rating_emission_history ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rating_emission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_rating_emission_history_isin_date
  ON public.rating_emission_history (isin, rating_date DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_emission_history_cnpj
  ON public.rating_emission_history (cnpj_emissor);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_emission_history TO authenticated;
GRANT ALL ON public.rating_emission_history TO service_role;
ALTER TABLE public.rating_emission_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rating_emission_history_read_authenticated" ON public.rating_emission_history;
CREATE POLICY "rating_emission_history_read_authenticated"
  ON public.rating_emission_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rating_emission_history_write_managers" ON public.rating_emission_history;
CREATE POLICY "rating_emission_history_write_managers"
  ON public.rating_emission_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "rating_emission_history_update_managers" ON public.rating_emission_history;
CREATE POLICY "rating_emission_history_update_managers"
  ON public.rating_emission_history FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "rating_emission_history_delete_managers" ON public.rating_emission_history;
CREATE POLICY "rating_emission_history_delete_managers"
  ON public.rating_emission_history FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP TRIGGER IF EXISTS trg_rating_emission_history_updated_at ON public.rating_emission_history;
CREATE TRIGGER trg_rating_emission_history_updated_at
  BEFORE UPDATE ON public.rating_emission_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- rating_fidc_class_history ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.rating_fidc_class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_rating_fidc_class_history_key_date
  ON public.rating_fidc_class_history (isin, class_code, rating_date DESC NULLS LAST, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rating_fidc_class_history TO authenticated;
GRANT ALL ON public.rating_fidc_class_history TO service_role;
ALTER TABLE public.rating_fidc_class_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rating_fidc_class_history_read_authenticated" ON public.rating_fidc_class_history;
CREATE POLICY "rating_fidc_class_history_read_authenticated"
  ON public.rating_fidc_class_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rating_fidc_class_history_write_managers" ON public.rating_fidc_class_history;
CREATE POLICY "rating_fidc_class_history_write_managers"
  ON public.rating_fidc_class_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "rating_fidc_class_history_update_managers" ON public.rating_fidc_class_history;
CREATE POLICY "rating_fidc_class_history_update_managers"
  ON public.rating_fidc_class_history FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "rating_fidc_class_history_delete_managers" ON public.rating_fidc_class_history;
CREATE POLICY "rating_fidc_class_history_delete_managers"
  ON public.rating_fidc_class_history FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP TRIGGER IF EXISTS trg_rating_fidc_class_history_updated_at ON public.rating_fidc_class_history;
CREATE TRIGGER trg_rating_fidc_class_history_updated_at
  BEFORE UPDATE ON public.rating_fidc_class_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------
-- 4) RPC get_resolved_rating_v2 (Fase 2)
--    Precedência: fidc_class -> emission -> issuer
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_resolved_rating_v2(
  p_cnpj text,
  p_isin text DEFAULT NULL,
  p_class_code text DEFAULT NULL
)
RETURNS TABLE(
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

  IF p_isin IS NOT NULL AND TRIM(p_isin) <> '' AND p_class_code IS NOT NULL AND TRIM(p_class_code) <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'fidc_class'::text, r.rating_date, r.id, r.source
    FROM public.rating_fidc_class_history r
    WHERE r.isin = p_isin AND r.class_code = p_class_code
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF p_isin IS NOT NULL AND TRIM(p_isin) <> '' THEN
    RETURN QUERY
    SELECT r.rating_value, 'emission'::text, r.rating_date, r.id, r.source
    FROM public.rating_emission_history r
    WHERE r.isin = p_isin
    ORDER BY r.rating_date DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

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


-- ---------------------------------------------------------------------
-- 5) FIDC Alert Engine (Fase 7)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fidc_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  isin text,
  class_code text,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_rules_active ON public.fidc_alert_rules (active);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_rules_isin_class ON public.fidc_alert_rules (isin, class_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_alert_rules TO authenticated;
GRANT ALL ON public.fidc_alert_rules TO service_role;
ALTER TABLE public.fidc_alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem regras de alerta" ON public.fidc_alert_rules;
CREATE POLICY "Autenticados leem regras de alerta"
  ON public.fidc_alert_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestor/Coordenação criam regras" ON public.fidc_alert_rules;
CREATE POLICY "Gestor/Coordenação criam regras"
  ON public.fidc_alert_rules FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "Gestor/Coordenação atualizam regras" ON public.fidc_alert_rules;
CREATE POLICY "Gestor/Coordenação atualizam regras"
  ON public.fidc_alert_rules FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role))
  WITH CHECK (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP POLICY IF EXISTS "Gestor/Coordenação apagam regras" ON public.fidc_alert_rules;
CREATE POLICY "Gestor/Coordenação apagam regras"
  ON public.fidc_alert_rules FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'Gestor'::app_role) OR has_role(auth.uid(),'Coordenação/Especialista'::app_role));

DROP TRIGGER IF EXISTS trg_fidc_alert_rules_updated_at ON public.fidc_alert_rules;
CREATE TRIGGER trg_fidc_alert_rules_updated_at
  BEFORE UPDATE ON public.fidc_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.fidc_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.fidc_alert_rules(id) ON DELETE CASCADE,
  isin text,
  class_code text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_events_rule ON public.fidc_alert_events (rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_fidc_alert_events_triggered ON public.fidc_alert_events (triggered_at DESC);

GRANT SELECT ON public.fidc_alert_events TO authenticated;
GRANT ALL ON public.fidc_alert_events TO service_role;
ALTER TABLE public.fidc_alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem eventos de alerta" ON public.fidc_alert_events;
CREATE POLICY "Autenticados leem eventos de alerta"
  ON public.fidc_alert_events FOR SELECT TO authenticated USING (true);

-- Eventos são gravados apenas pelo service_role (edge function). Sem policies de INSERT.


-- ---------------------------------------------------------------------
-- 6) (OPCIONAL) Backfill da Fase 3
--     Popula rating_issuer_history a partir de issuer_ratings, se existir.
--     Descomente para executar.
-- ---------------------------------------------------------------------
/*
INSERT INTO public.rating_issuer_history (cnpj, rating_value, rating_date, source, observacao, created_at)
SELECT
  regexp_replace(COALESCE(cnpj,''), '[^0-9]', '', 'g') AS cnpj,
  rating AS rating_value,
  data_rating AS rating_date,
  agencia AS source,
  NULL::text AS observacao,
  COALESCE(created_at, now())
FROM public.issuer_ratings ir
WHERE rating IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.rating_issuer_history h
    WHERE h.cnpj = regexp_replace(COALESCE(ir.cnpj,''), '[^0-9]', '', 'g')
      AND h.rating_value = ir.rating
      AND h.rating_date IS NOT DISTINCT FROM ir.data_rating
      AND h.source IS NOT DISTINCT FROM ir.agencia
  );
*/


-- ---------------------------------------------------------------------
-- BLOCO ALTERNATIVO: policies SEM has_role (permissivas para authenticated)
-- Use apenas se o projeto de destino NÃO tem app_role/has_role e você
-- não quiser instalá-los agora. Rode este bloco DEPOIS de dropar as
-- policies criadas acima.
-- ---------------------------------------------------------------------
/*
-- Exemplo para rating_issuer_history — replique o padrão para as demais.
DROP POLICY IF EXISTS "rating_issuer_history_write_managers"  ON public.rating_issuer_history;
DROP POLICY IF EXISTS "rating_issuer_history_update_managers" ON public.rating_issuer_history;
DROP POLICY IF EXISTS "rating_issuer_history_delete_managers" ON public.rating_issuer_history;

CREATE POLICY "rating_issuer_history_all_authenticated"
  ON public.rating_issuer_history FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
*/
