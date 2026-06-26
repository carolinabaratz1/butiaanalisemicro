
ALTER VIEW public.v_issuer_rating_current SET (security_invoker = true);
REVOKE EXECUTE ON FUNCTION public.get_resolved_rating(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_issuer_ratings_normalize() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_issuer_ratings_mirror_empresas() FROM PUBLIC, anon;
