DROP FUNCTION IF EXISTS public.get_profile_names();
CREATE FUNCTION public.get_profile_names()
RETURNS TABLE(id uuid, nome text, funcao text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, funcao, status FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profile_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_names() TO authenticated;