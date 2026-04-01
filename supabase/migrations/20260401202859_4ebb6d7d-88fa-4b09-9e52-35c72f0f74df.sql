
-- 1. Fix user_roles: restrict write operations to Gestor only
DROP POLICY IF EXISTS "Authenticated users can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can delete roles" ON public.user_roles;

CREATE POLICY "Only Gestor can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'Gestor'));

CREATE POLICY "Only Gestor can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'Gestor'))
WITH CHECK (public.has_role(auth.uid(), 'Gestor'));

CREATE POLICY "Only Gestor can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'Gestor'));

-- 2. Fix empresas: remove anon access, restrict to authenticated only
DROP POLICY IF EXISTS "Allow public read on empresas" ON public.empresas;

CREATE POLICY "Authenticated users can read empresas"
ON public.empresas FOR SELECT TO authenticated
USING (true);

-- 3. Fix analises: restrict DELETE to Gestor only
DROP POLICY IF EXISTS "Authenticated users can delete analises" ON public.analises;

CREATE POLICY "Only Gestor can delete analises"
ON public.analises FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'Gestor'));

-- 4. Restrict analises INSERT to users with write roles
DROP POLICY IF EXISTS "Authenticated users can insert analises" ON public.analises;

CREATE POLICY "Writers can insert analises"
ON public.analises FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'Gestor')
  OR public.has_role(auth.uid(), 'Coordenação/Especialista')
  OR public.has_role(auth.uid(), 'Analista')
);

-- 5. Restrict analises UPDATE similarly
DROP POLICY IF EXISTS "Authenticated users can update analises" ON public.analises;

CREATE POLICY "Writers can update analises"
ON public.analises FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'Gestor')
  OR public.has_role(auth.uid(), 'Coordenação/Especialista')
  OR public.has_role(auth.uid(), 'Analista')
)
WITH CHECK (
  public.has_role(auth.uid(), 'Gestor')
  OR public.has_role(auth.uid(), 'Coordenação/Especialista')
  OR public.has_role(auth.uid(), 'Analista')
);
