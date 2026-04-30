CREATE TABLE IF NOT EXISTS public._emissor_codigo_map (
  cnpj_d text PRIMARY KEY,
  codigo text NOT NULL
);
ALTER TABLE public._emissor_codigo_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public._emissor_codigo_map FOR ALL TO authenticated USING (false) WITH CHECK (false);