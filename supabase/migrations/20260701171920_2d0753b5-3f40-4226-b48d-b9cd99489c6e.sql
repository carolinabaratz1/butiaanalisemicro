
CREATE TABLE public.mfa_reset_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_user_email text,
  target_user_nome text,
  performed_by uuid NOT NULL,
  performed_by_email text,
  performed_by_nome text,
  factors_removed int NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mfa_reset_log TO authenticated;
GRANT ALL ON public.mfa_reset_log TO service_role;

ALTER TABLE public.mfa_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor e Risco veem logs de MFA"
  ON public.mfa_reset_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'Gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'Risco e Compliance'::public.app_role)
  );
