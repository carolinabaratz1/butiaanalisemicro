
-- Drop the overly permissive self-update policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create a restricted policy: users can update their own row,
-- but funcao and status must remain unchanged
CREATE POLICY "Users can update own safe fields"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND funcao = (SELECT p.funcao FROM profiles p WHERE p.id = auth.uid())
  AND status = (SELECT p.status FROM profiles p WHERE p.id = auth.uid())
);
