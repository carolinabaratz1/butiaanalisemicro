
-- =============================================
-- 1. FIX: empresas - restrict write to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow public insert on empresas" ON empresas;
DROP POLICY IF EXISTS "Allow public update on empresas" ON empresas;

CREATE POLICY "Authenticated users can insert empresas" ON empresas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update empresas" ON empresas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 2. FIX: emissoes - restrict write to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow public insert on emissoes" ON emissoes;
DROP POLICY IF EXISTS "Allow public update on emissoes" ON emissoes;
DROP POLICY IF EXISTS "Allow public delete on emissoes" ON emissoes;
DROP POLICY IF EXISTS "Allow public read on emissoes" ON emissoes;

CREATE POLICY "Authenticated users can read emissoes" ON emissoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert emissoes" ON emissoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update emissoes" ON emissoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete emissoes" ON emissoes
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- 3. FIX: analises - restrict write to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow public insert on analises" ON analises;
DROP POLICY IF EXISTS "Allow public read access on analises" ON analises;
DROP POLICY IF EXISTS "Allow public update on analises" ON analises;

CREATE POLICY "Authenticated users can read analises" ON analises
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert analises" ON analises
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update analises" ON analises
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 4. FIX: posicoes - restrict write to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow public insert on posicoes" ON posicoes;
DROP POLICY IF EXISTS "Allow public update on posicoes" ON posicoes;
DROP POLICY IF EXISTS "Allow public delete on posicoes" ON posicoes;
DROP POLICY IF EXISTS "Allow public read on posicoes" ON posicoes;

CREATE POLICY "Authenticated users can read posicoes" ON posicoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert posicoes" ON posicoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update posicoes" ON posicoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete posicoes" ON posicoes
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- 5. FIX: user_roles - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow insert roles" ON user_roles;
DROP POLICY IF EXISTS "Allow update roles" ON user_roles;
DROP POLICY IF EXISTS "Allow delete roles" ON user_roles;

CREATE POLICY "Authenticated users can insert roles" ON user_roles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update roles" ON user_roles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete roles" ON user_roles
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- 6. FIX: profiles - restrict insert to authenticated/service
-- =============================================
DROP POLICY IF EXISTS "Allow insert for service role and triggers" ON profiles;

CREATE POLICY "Service and triggers can insert profiles" ON profiles
  FOR INSERT TO authenticated WITH CHECK (true);

-- Keep the public insert for the trigger (runs as service role)
CREATE POLICY "Triggers can insert profiles" ON profiles
  FOR INSERT TO anon WITH CHECK (false);

-- =============================================
-- 7. FIX: function search_path mutable
-- =============================================
CREATE OR REPLACE FUNCTION trim_profile_nome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.nome := TRIM(NEW.nome);
  RETURN NEW;
END;
$$;
