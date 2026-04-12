
-- Drop the overly permissive INSERT policy on pipeline_eventos
DROP POLICY IF EXISTS "Inserção autenticados" ON pipeline_eventos;

-- Create a scoped INSERT policy: only users who can write analyses can log events
CREATE POLICY "Writers can insert pipeline_eventos"
ON pipeline_eventos FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Gestor'::app_role)
  OR has_role(auth.uid(), 'Coordenação/Especialista'::app_role)
  OR has_role(auth.uid(), 'Analista'::app_role)
);
