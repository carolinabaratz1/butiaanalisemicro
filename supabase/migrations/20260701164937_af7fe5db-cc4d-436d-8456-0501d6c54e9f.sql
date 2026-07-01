
DROP FUNCTION IF EXISTS public.get_posicoes_dashboard_fundo(text);

CREATE FUNCTION public.get_posicoes_dashboard_fundo(p_fundo text)
 RETURNS TABLE(ticker text, isin text, product_class text, financial_price numeric, amount numeric, duration_du numeric, vencimento date, fundo text, rating text, indexador text, sub_indexador text, setor text, grupo_economico text, nome_emissor text, codigo_emissor text, cnpj_emissor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH last_dt AS (
    SELECT MAX(val_date) AS v FROM public.posicoes WHERE trading_desk_share_source = p_fundo
  )
  SELECT
    em.ticker, p.isin, p.product_class,
    p.financial_price, p.amount, p.duration_du,
    ta.venc_date AS vencimento,
    p.trading_desk_share_source AS fundo,
    emp.rating AS rating,
    COALESCE(ta.indexador, 'Outros') AS indexador,
    COALESCE(ta.sub_indexador, 'Outros') AS sub_indexador,
    emp.setor, emp.grupo_economico,
    emp.nome AS nome_emissor, emp.codigo_emissor,
    regexp_replace(COALESCE(em.cnpj_emissor, ''), '[^0-9]', '', 'g') AS cnpj_emissor
  FROM public.posicoes p
  LEFT JOIN public.emissoes em      ON em.isin = p.isin
  LEFT JOIN public.trade_ativos ta  ON ta.ticker = em.ticker
  LEFT JOIN public.empresas emp     ON regexp_replace(COALESCE(emp.cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(em.cnpj_emissor, ''), '[^0-9]', '', 'g')
  WHERE p.trading_desk_share_source = p_fundo
    AND p.financial_price > 0
    AND p.val_date = (SELECT v FROM last_dt);
$function$;
