CREATE POLICY "Authenticated users can delete analises"
ON public.analises FOR DELETE TO authenticated USING (true);