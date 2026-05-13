
-- 1) Fix Security Definer View: enable security_invoker on trade_monitor_view
ALTER VIEW public.trade_monitor_view SET (security_invoker = on);

-- 2) Restrict profiles email exposure: drop the broad analyst SELECT policy
DROP POLICY IF EXISTS "Authenticated can read active analyst profiles" ON public.profiles;

-- Provide a safe RPC that returns analyst profiles WITHOUT email
CREATE OR REPLACE FUNCTION public.get_active_analysts()
RETURNS TABLE(id uuid, nome text, funcao text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, funcao, status
  FROM public.profiles
  WHERE status = 'Ativo'
    AND funcao IN ('Analista', 'Coordenação/Especialista');
$$;

REVOKE ALL ON FUNCTION public.get_active_analysts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_analysts() TO authenticated;

-- Also expose a function variant that returns ALL profiles (id, nome) for resolving analyst names
CREATE OR REPLACE FUNCTION public.get_profile_names()
RETURNS TABLE(id uuid, nome text, funcao text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, funcao FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profile_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_names() TO authenticated;

-- 3) Lock down SECURITY DEFINER functions: revoke EXECUTE from anon (and PUBLIC) on all of them.
--    Keep authenticated access on the ones the app actually calls; revoke from authenticated for admin-only ones.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.get_posicoes_val_dates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_posicoes_val_dates() TO authenticated;

REVOKE ALL ON FUNCTION public.get_ipca_history(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ipca_history(date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_ipca_history(date, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ipca_history(date, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_trade_summary(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trade_summary(text, text) TO authenticated;

-- Admin-only / cron functions: revoke from anon AND authenticated (only service_role can run)
REVOKE ALL ON FUNCTION public.refresh_spread_historico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_ticker_snapshots() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_spread_agg_diario() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_trade_metricas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_trade_metricas_di() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_trade_metricas_ipca() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_trade_metricas_ipca_batch(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_forward_fill() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_sub_indexador(text, text) FROM PUBLIC, anon;
