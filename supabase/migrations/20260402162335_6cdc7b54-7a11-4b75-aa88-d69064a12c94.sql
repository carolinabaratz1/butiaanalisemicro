
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = on) AS SELECT id, nome, funcao, status FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can update empresas" ON public.empresas;
CREATE POLICY "Writers can insert empresas" ON public.empresas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));
CREATE POLICY "Writers can update empresas" ON public.empresas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)) WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));

DROP POLICY IF EXISTS "Service and triggers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Triggers can insert profiles" ON public.profiles;
CREATE POLICY "Gestor can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role));
