ALTER FUNCTION public.tg_fidc_quota_rating_history() SET search_path = public;
ALTER FUNCTION public.tg_block_delete_rating_history() SET search_path = public;
ALTER VIEW public.v_ofertas_publicas_cvm_enriquecida SET (security_invoker = true);