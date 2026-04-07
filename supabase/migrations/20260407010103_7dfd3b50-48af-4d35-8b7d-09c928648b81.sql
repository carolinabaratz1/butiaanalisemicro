
-- 1. Add UPDATE policy for Gestor on profiles
CREATE POLICY "Gestor can update any profile"
ON profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'Gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));

-- 2. Create BEFORE UPDATE trigger to prevent non-Gestors from changing funcao/status
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If funcao or status is being changed, only allow if caller is Gestor
  IF (NEW.funcao IS DISTINCT FROM OLD.funcao OR NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NOT has_role(auth.uid(), 'Gestor'::app_role) THEN
      NEW.funcao := OLD.funcao;
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_profile_field_protection
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_role_escalation();
