
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Gestor can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role));

CREATE OR REPLACE VIEW public.profiles_public AS SELECT id, nome, funcao, status FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can insert posicoes" ON public.posicoes;
DROP POLICY IF EXISTS "Authenticated users can update posicoes" ON public.posicoes;
DROP POLICY IF EXISTS "Authenticated users can delete posicoes" ON public.posicoes;
CREATE POLICY "Writers can insert posicoes" ON public.posicoes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));
CREATE POLICY "Writers can update posicoes" ON public.posicoes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)) WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));
CREATE POLICY "Writers can delete posicoes" ON public.posicoes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Gestor can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role));

DROP POLICY IF EXISTS "Authenticated users can insert emissoes" ON public.emissoes;
DROP POLICY IF EXISTS "Authenticated users can update emissoes" ON public.emissoes;
DROP POLICY IF EXISTS "Authenticated users can delete emissoes" ON public.emissoes;
CREATE POLICY "Writers can insert emissoes" ON public.emissoes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));
CREATE POLICY "Writers can update emissoes" ON public.emissoes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role)) WITH CHECK (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));
CREATE POLICY "Writers can delete emissoes" ON public.emissoes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'Gestor'::app_role) OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role) OR has_role(auth.uid(), 'Analista'::app_role));
