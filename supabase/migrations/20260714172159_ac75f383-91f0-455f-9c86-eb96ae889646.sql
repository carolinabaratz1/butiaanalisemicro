
-- fidc_alert_rules
CREATE TABLE public.fidc_alert_rules (
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
CREATE INDEX idx_fidc_alert_rules_isin_class ON public.fidc_alert_rules (isin, class_code);
CREATE INDEX idx_fidc_alert_rules_active ON public.fidc_alert_rules (active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidc_alert_rules TO authenticated;
GRANT ALL ON public.fidc_alert_rules TO service_role;

ALTER TABLE public.fidc_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem regras de alerta"
  ON public.fidc_alert_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestor/Coordenação criam regras"
  ON public.fidc_alert_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'Gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'Coordenação/Especialista'::public.app_role)
  );

CREATE POLICY "Gestor/Coordenação atualizam regras"
  ON public.fidc_alert_rules FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'Gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'Coordenação/Especialista'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'Gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'Coordenação/Especialista'::public.app_role)
  );

CREATE POLICY "Gestor/Coordenação apagam regras"
  ON public.fidc_alert_rules FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'Gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'Coordenação/Especialista'::public.app_role)
  );

CREATE TRIGGER trg_fidc_alert_rules_updated_at
  BEFORE UPDATE ON public.fidc_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- fidc_alert_events
CREATE TABLE public.fidc_alert_events (
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
CREATE INDEX idx_fidc_alert_events_rule ON public.fidc_alert_events (rule_id, triggered_at DESC);
CREATE INDEX idx_fidc_alert_events_triggered ON public.fidc_alert_events (triggered_at DESC);

GRANT SELECT ON public.fidc_alert_events TO authenticated;
GRANT ALL ON public.fidc_alert_events TO service_role;

ALTER TABLE public.fidc_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem eventos de alerta"
  ON public.fidc_alert_events FOR SELECT
  TO authenticated
  USING (true);
