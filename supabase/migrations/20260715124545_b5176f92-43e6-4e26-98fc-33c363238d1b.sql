CREATE TABLE public.sync_external_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source text NOT NULL CHECK (trigger_source IN ('cron','manual')),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  tables_total integer,
  tables_ok integer,
  tables_failed integer,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sync_external_log TO authenticated;
GRANT ALL ON public.sync_external_log TO service_role;

ALTER TABLE public.sync_external_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor lê log de sync externo"
  ON public.sync_external_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Gestor'::public.app_role));

CREATE INDEX idx_sync_external_log_started_at ON public.sync_external_log (started_at DESC);