CREATE OR REPLACE FUNCTION public.get_posicoes_dashboard_fundo(p_fundo text)
RETURNS TABLE (
  ticker text, isin text, product_class text,
  financial_price numeric, amount numeric, duration_du numeric,
  vencimento date, fundo text, rating text,
  indexador text, sub_indexador text,
  setor text, grupo_economico text,
  nome_emissor text, codigo_emissor text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH last_dt AS (
    SELECT MAX(val_date) AS v FROM public.posicoes WHERE trading_desk_share_source = p_fundo
  )
  SELECT
    em.ticker, p.isin, p.product_class,
    p.financial_price, p.amount, p.duration_du,
    ta.venc_date AS vencimento,
    p.trading_desk_share_source AS fundo,
    COALESCE(ta.rating, emp.rating) AS rating,
    COALESCE(ta.indexador, 'Outros') AS indexador,
    COALESCE(ta.sub_indexador, 'Outros') AS sub_indexador,
    emp.setor, emp.grupo_economico,
    emp.nome AS nome_emissor, emp.codigo_emissor
  FROM public.posicoes p
  LEFT JOIN public.emissoes em      ON em.isin = p.isin
  LEFT JOIN public.trade_ativos ta  ON ta.ticker = em.ticker
  LEFT JOIN public.empresas emp     ON emp.cnpj = em.cnpj_emissor
  WHERE p.trading_desk_share_source = p_fundo
    AND p.financial_price > 0
    AND p.val_date = (SELECT v FROM last_dt);
$$;

GRANT EXECUTE ON FUNCTION public.get_posicoes_dashboard_fundo(text) TO authenticated;