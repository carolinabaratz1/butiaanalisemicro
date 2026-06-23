
-- ========= ENUMS (prefixados com fidc_ para evitar colisão) =========
CREATE TYPE public.fidc_alert_severity AS ENUM ('normal', 'warning', 'critical');
CREATE TYPE public.fidc_alert_status AS ENUM ('new', 'in_analysis', 'resolved');
CREATE TYPE public.fidc_recommendation AS ENUM ('manter', 'acompanhar', 'reduzir', 'zerar');
CREATE TYPE public.fidc_validation_status AS ENUM ('valid', 'warning', 'invalid');
CREATE TYPE public.fidc_threshold_direction AS ENUM ('above_is_worse', 'below_is_worse');
CREATE TYPE public.fidc_threshold_scope AS ENUM ('global', 'per_fidc', 'per_portfolio');

-- ========= helper: can_write_fidc (Gestor / Coordenação) =========
CREATE OR REPLACE FUNCTION public.fidc_can_write(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'Gestor'::public.app_role)
      OR public.has_role(_user_id, 'Coordenação/Especialista'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.fidc_can_write_opinion(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'Gestor'::public.app_role)
      OR public.has_role(_user_id, 'Coordenação/Especialista'::public.app_role)
      OR public.has_role(_user_id, 'Analista'::public.app_role)
$$;

REVOKE EXECUTE ON FUNCTION public.fidc_can_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fidc_can_write(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fidc_can_write_opinion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fidc_can_write_opinion(uuid) TO authenticated, service_role;

-- ========= TABELAS =========
CREATE TABLE public.fidcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  administrator TEXT,
  manager TEXT,
  custodian TEXT,
  specialized_consultant TEXT,
  auditor TEXT,
  collection_agent TEXT,
  main_originator TEXT,
  main_assignor TEXT,
  sector TEXT,
  strategy TEXT,
  fidc_type TEXT,
  condominium_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  maturity_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidcs TO authenticated;
GRANT ALL ON public.fidcs TO service_role;
ALTER TABLE public.fidcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc read" ON public.fidcs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc write" ON public.fidcs FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));
CREATE TRIGGER t_fidcs_updated BEFORE UPDATE ON public.fidcs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fidc_quota_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id UUID NOT NULL REFERENCES public.fidcs(id) ON DELETE CASCADE,
  isin TEXT NOT NULL UNIQUE,
  internal_quota_name TEXT,
  cvm_quota_name TEXT,
  class_name TEXT,
  series_name TEXT,
  quota_type TEXT,
  seniority_level INT,
  benchmark TEXT,
  target_spread TEXT,
  remuneration_description TEXT,
  amortization_type TEXT,
  current_rating TEXT,
  current_rating_agency TEXT,
  current_rating_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fidc_quota_classes_fidc ON public.fidc_quota_classes(fidc_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_quota_classes TO authenticated;
GRANT ALL ON public.fidc_quota_classes TO service_role;
ALTER TABLE public.fidc_quota_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_qc read" ON public.fidc_quota_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_qc write" ON public.fidc_quota_classes FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));
CREATE TRIGGER t_fidc_qc_updated BEFORE UPDATE ON public.fidc_quota_classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fidc_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id UUID NOT NULL REFERENCES public.fidcs(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  nav_value NUMERIC(20,2),
  quota_total_nav_value NUMERIC(20,2),
  quota_validation_status public.fidc_validation_status,
  quota_validation_difference NUMERIC(20,2),
  quota_validation_difference_percentage NUMERIC(8,4),
  quota_value NUMERIC(20,8),
  credit_rights_value NUMERIC(20,2),
  overdue_value NUMERIC(20,2),
  pdd_value NUMERIC(20,2),
  cash_value NUMERIC(20,2),
  repurchase_value NUMERIC(20,2),
  subordinated_value NUMERIC(20,2),
  investors_count INT,
  raw_data JSONB,
  version INT NOT NULL DEFAULT 1,
  is_current_version BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fidc_reports_fidc_month ON public.fidc_monthly_reports(fidc_id, reference_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_monthly_reports TO authenticated;
GRANT ALL ON public.fidc_monthly_reports TO service_role;
ALTER TABLE public.fidc_monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_rep read" ON public.fidc_monthly_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_rep write" ON public.fidc_monthly_reports FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));
CREATE TRIGGER t_fidc_rep_updated BEFORE UPDATE ON public.fidc_monthly_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fidc_monthly_quota_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_monthly_report_id UUID NOT NULL REFERENCES public.fidc_monthly_reports(id) ON DELETE CASCADE,
  fidc_quota_class_id UUID REFERENCES public.fidc_quota_classes(id) ON DELETE SET NULL,
  isin TEXT,
  class_name TEXT,
  quota_type TEXT,
  nav_value NUMERIC(20,2),
  quota_value NUMERIC(20,8),
  number_of_quotas NUMERIC(20,4),
  seniority_level INT,
  rating TEXT,
  matching_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_monthly_quota_classes TO authenticated;
GRANT ALL ON public.fidc_monthly_quota_classes TO service_role;
ALTER TABLE public.fidc_monthly_quota_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_mqc read" ON public.fidc_monthly_quota_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_mqc write" ON public.fidc_monthly_quota_classes FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE TABLE public.fidc_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id UUID NOT NULL REFERENCES public.fidcs(id) ON DELETE CASCADE,
  fidc_quota_class_id UUID REFERENCES public.fidc_quota_classes(id) ON DELETE SET NULL,
  rating_agency TEXT,
  rating TEXT,
  rating_outlook TEXT,
  rating_date DATE,
  report_date DATE,
  report_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fidc_ratings_fidc ON public.fidc_rating_history(fidc_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_rating_history TO authenticated;
GRANT ALL ON public.fidc_rating_history TO service_role;
ALTER TABLE public.fidc_rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_rat read" ON public.fidc_rating_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_rat write" ON public.fidc_rating_history FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));

CREATE TABLE public.credit_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id UUID NOT NULL REFERENCES public.fidcs(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  recommendation public.fidc_recommendation NOT NULL,
  summary TEXT,
  recommendation_reason TEXT,
  positive_points TEXT,
  attention_points TEXT,
  main_risks TEXT,
  recent_evolution TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_opinions_fidc_month ON public.credit_opinions(fidc_id, reference_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_opinions TO authenticated;
GRANT ALL ON public.credit_opinions TO service_role;
ALTER TABLE public.credit_opinions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_op read" ON public.credit_opinions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_op write" ON public.credit_opinions FOR ALL TO authenticated
  USING (public.fidc_can_write_opinion(auth.uid())) WITH CHECK (public.fidc_can_write_opinion(auth.uid()));
CREATE TRIGGER t_fidc_op_updated BEFORE UPDATE ON public.credit_opinions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  warning_threshold NUMERIC(20,6),
  critical_threshold NUMERIC(20,6),
  direction public.fidc_threshold_direction NOT NULL,
  scope public.fidc_threshold_scope NOT NULL DEFAULT 'global',
  fidc_id UUID REFERENCES public.fidcs(id) ON DELETE CASCADE,
  portfolio_source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_ar read" ON public.alert_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_ar write" ON public.alert_rules FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));
CREATE TRIGGER t_fidc_ar_updated BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fidc_id UUID NOT NULL REFERENCES public.fidcs(id) ON DELETE CASCADE,
  portfolio_source TEXT,
  reference_month DATE,
  metric_name TEXT NOT NULL,
  current_value NUMERIC(20,6),
  threshold_value NUMERIC(20,6),
  severity public.fidc_alert_severity NOT NULL,
  status public.fidc_alert_status NOT NULL DEFAULT 'new',
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_fidc_month ON public.alerts(fidc_id, reference_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fidc_al read" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "fidc_al write" ON public.alerts FOR ALL TO authenticated
  USING (public.fidc_can_write(auth.uid())) WITH CHECK (public.fidc_can_write(auth.uid()));
CREATE TRIGGER t_fidc_al_updated BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
