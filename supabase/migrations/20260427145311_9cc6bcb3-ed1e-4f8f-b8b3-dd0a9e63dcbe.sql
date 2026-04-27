CREATE POLICY "Authenticated can read active analyst profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  status = 'Ativo'
  AND funcao IN ('Analista', 'Coordenação/Especialista')
);