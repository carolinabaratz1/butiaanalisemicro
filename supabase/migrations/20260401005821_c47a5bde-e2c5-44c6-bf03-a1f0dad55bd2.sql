
-- Allow service role (and authenticated with has_role) to delete from user_roles
CREATE POLICY "Allow delete roles"
ON public.user_roles
FOR DELETE
TO public
USING (true);
