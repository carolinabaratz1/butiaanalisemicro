CREATE OR REPLACE FUNCTION public.get_emissores_gestao()
 RETURNS TABLE(cnpj text, cnpj_norm text, nome text, grupo_economico text, setor text, tipo text, rating text, rating_source text, rating_agencia text, rating_data date, analise_id uuid, analise_status text, analise_recomendacao text, analise_data_conclusao date, analise_data_validade date, analise_vencida boolean, analista_id text, exposure_total numeric, funds_count integer, funds_list jsonb, largest_fund text, largest_fund_value numeric, largest_fund_pct numeric, consolidated_pct numeric, limit_value numeric, limit_pct_nav numeric, limit_type text, usage_ratio numeric, limit_status text, alerts jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH pos_parsed AS (
    SELECT
      p.trading_desk_share_source AS fundo,
      p.isin,
      (COALESCE(p.amount,0) * COALESCE(p.financial_price,0))::numeric AS valor,
      CASE
        WHEN p.val_date ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p.val_date, 'MM/DD/YYYY')
        WHEN p.val_date ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(p.val_date, 'YYYY-MM-DD')
        ELSE NULL
      END AS d
    FROM posicoes p
    WHERE p.financial_price IS NOT NULL AND p.financial_price > 0
      AND p.amount IS NOT NULL AND p.amount > 0
      AND p.trading_desk_share_source IS NOT NULL
      AND p.trading_desk_share_source <> ''
  ),
  last_by_fund AS (
    SELECT fundo, MAX(d) AS last_d
    FROM pos_parsed
    WHERE d IS NOT NULL
    GROUP BY fundo
  ),
  pos_last AS (
    SELECT pp.fundo, pp.isin, pp.valor
    FROM pos_parsed pp
    JOIN last_by_fund lf ON lf.fundo = pp.fundo AND lf.last_d = pp.d
  ),
  fund_pl AS (
    SELECT fundo, SUM(valor) AS pl
    FROM pos_last
    GROUP BY fundo
  ),
  pos_issuer AS (
    SELECT
      regexp_replace(COALESCE(em.cnpj_emissor,''), '[^0-9]', '', 'g') AS cnpj_norm,
      pl.fundo,
      SUM(pl.valor) AS valor
    FROM pos_last pl
    JOIN emissoes em ON em.isin = pl.isin
    WHERE em.cnpj_emissor IS NOT NULL AND em.cnpj_emissor <> ''
    GROUP BY 1, 2
  ),
  issuer_agg AS (
    SELECT
      pi.cnpj_norm,
      SUM(pi.valor) AS exposure_total,
      COUNT(DISTINCT pi.fundo)::int AS funds_count,
      jsonb_agg(jsonb_build_object(
        'fundo', pi.fundo,
        'valor', pi.valor,
        'pct_fund', CASE WHEN fp.pl > 0 THEN pi.valor / fp.pl ELSE NULL END
      ) ORDER BY pi.valor DESC) AS funds_list,
      SUM(fp.pl) AS pl_denominador
    FROM pos_issuer pi
    LEFT JOIN fund_pl fp ON fp.fundo = pi.fundo
    GROUP BY pi.cnpj_norm
  ),
  issuer_top AS (
    SELECT DISTINCT ON (pi.cnpj_norm)
      pi.cnpj_norm,
      pi.fundo AS largest_fund,
      pi.valor AS largest_value,
      CASE WHEN fp.pl > 0 THEN pi.valor / fp.pl ELSE NULL END AS largest_pct
    FROM pos_issuer pi
    LEFT JOIN fund_pl fp ON fp.fundo = pi.fundo
    ORDER BY pi.cnpj_norm, pi.valor DESC
  ),
  latest_analise AS (
    SELECT DISTINCT ON (regexp_replace(COALESCE(a.empresa_id,''), '[^0-9]', '', 'g'))
      regexp_replace(COALESCE(a.empresa_id,''), '[^0-9]', '', 'g') AS cnpj_norm,
      a.id AS analise_id,
      a.status AS analise_status,
      a.recomendacao AS analise_recomendacao,
      CASE
        WHEN a.data_conclusao ~ '^\d{4}-\d{2}-\d{2}' THEN a.data_conclusao::date
        ELSE NULL
      END AS analise_data_conclusao,
      a.analista_responsavel AS analista_id,
      a.versao
    FROM analises a
    ORDER BY regexp_replace(COALESCE(a.empresa_id,''), '[^0-9]', '', 'g'), a.versao DESC, a.created_at DESC
  ),
  active_limit AS (
    SELECT DISTINCT ON (l.cnpj_emissor)
      l.cnpj_emissor AS cnpj_norm,
      l.limit_value,
      l.limit_pct_nav,
      l.limit_type
    FROM issuer_limits l
    WHERE (l.effective_from IS NULL OR l.effective_from <= CURRENT_DATE)
      AND (l.effective_to IS NULL OR l.effective_to >= CURRENT_DATE)
    ORDER BY l.cnpj_emissor, l.created_at DESC
  )
  SELECT
    e.cnpj,
    regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g') AS cnpj_norm,
    e.nome,
    e.grupo_economico,
    e.setor,
    e.tipo,
    r.rating,
    r.source AS rating_source,
    r.agencia AS rating_agencia,
    r.data_rating AS rating_data,
    la.analise_id,
    la.analise_status,
    la.analise_recomendacao,
    la.analise_data_conclusao,
    CASE
      WHEN la.analise_data_conclusao IS NOT NULL
      THEN (la.analise_data_conclusao + INTERVAL '1 year')::date
      ELSE NULL
    END AS analise_data_validade,
    CASE
      WHEN la.analise_status = 'Vencida c/ Alocação' THEN TRUE
      WHEN la.analise_data_conclusao IS NOT NULL
        AND (la.analise_data_conclusao + INTERVAL '1 year')::date < CURRENT_DATE
        AND la.analise_status NOT IN ('Pendente','Em Análise') THEN TRUE
      ELSE FALSE
    END AS analise_vencida,
    la.analista_id,
    COALESCE(ia.exposure_total, 0) AS exposure_total,
    COALESCE(ia.funds_count, 0) AS funds_count,
    COALESCE(ia.funds_list, '[]'::jsonb) AS funds_list,
    it.largest_fund,
    it.largest_value AS largest_fund_value,
    it.largest_pct AS largest_fund_pct,
    CASE
      WHEN COALESCE(ia.pl_denominador, 0) > 0
      THEN ia.exposure_total / ia.pl_denominador
      ELSE NULL
    END AS consolidated_pct,
    al.limit_value,
    al.limit_pct_nav,
    al.limit_type,
    CASE
      WHEN al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total IS NOT NULL
        THEN ia.exposure_total / al.limit_value
      WHEN al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
        AND COALESCE(ia.pl_denominador,0) > 0 AND ia.exposure_total IS NOT NULL
        THEN (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav
      ELSE NULL
    END AS usage_ratio,
    CASE
      WHEN al.limit_value IS NULL AND al.limit_pct_nav IS NULL THEN 'nao_cadastrado'
      WHEN (
        CASE
          WHEN al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total IS NOT NULL
            THEN ia.exposure_total / al.limit_value
          WHEN al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
            AND COALESCE(ia.pl_denominador,0) > 0 AND ia.exposure_total IS NOT NULL
            THEN (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav
          ELSE 0
        END
      ) > 1 THEN 'acima'
      WHEN (
        CASE
          WHEN al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total IS NOT NULL
            THEN ia.exposure_total / al.limit_value
          WHEN al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
            AND COALESCE(ia.pl_denominador,0) > 0 AND ia.exposure_total IS NOT NULL
            THEN (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav
          ELSE 0
        END
      ) >= 0.8 THEN 'proximo'
      ELSE 'dentro'
    END AS limit_status,
    (
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('type','analise_vencida_posicao','severity','high','label','Análise vencida com posição') AS x
          WHERE COALESCE(ia.exposure_total,0) > 0 AND (
            la.analise_status = 'Vencida c/ Alocação'
            OR (la.analise_data_conclusao IS NOT NULL
                AND (la.analise_data_conclusao + INTERVAL '1 year')::date < CURRENT_DATE
                AND la.analise_status NOT IN ('Pendente','Em Análise'))
          )
        UNION ALL
        SELECT jsonb_build_object('type','sem_analise_posicao','severity','high','label','Sem análise com posição')
          WHERE COALESCE(ia.exposure_total,0) > 0 AND la.analise_id IS NULL
        UNION ALL
        SELECT jsonb_build_object('type','acima_limite','severity','high','label','Acima do limite')
          WHERE (al.limit_value IS NOT NULL OR al.limit_pct_nav IS NOT NULL)
            AND COALESCE(ia.exposure_total,0) > 0
            AND (
              (al.limit_value IS NOT NULL AND al.limit_value > 0 AND ia.exposure_total / al.limit_value > 1)
              OR (al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
                  AND COALESCE(ia.pl_denominador,0) > 0
                  AND (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav > 1)
            )
        UNION ALL
        SELECT jsonb_build_object('type','proximo_limite','severity','medium','label','Próximo do limite')
          WHERE (al.limit_value IS NOT NULL OR al.limit_pct_nav IS NOT NULL)
            AND COALESCE(ia.exposure_total,0) > 0
            AND (
              (al.limit_value IS NOT NULL AND al.limit_value > 0
                AND ia.exposure_total / al.limit_value BETWEEN 0.8 AND 1)
              OR (al.limit_pct_nav IS NOT NULL AND al.limit_pct_nav > 0
                  AND COALESCE(ia.pl_denominador,0) > 0
                  AND (ia.exposure_total / ia.pl_denominador) / al.limit_pct_nav BETWEEN 0.8 AND 1)
            )
        UNION ALL
        SELECT jsonb_build_object('type','sem_limite','severity','medium','label','Limite não cadastrado')
          WHERE COALESCE(ia.exposure_total,0) > 0
            AND al.limit_value IS NULL AND al.limit_pct_nav IS NULL
        UNION ALL
        SELECT jsonb_build_object('type','sem_rating','severity','medium','label','Rating ausente')
          WHERE r.rating IS NULL
        UNION ALL
        SELECT jsonb_build_object('type','cadastro_incompleto','severity','low','label','Cadastro incompleto')
          WHERE e.setor IS NULL OR e.grupo_economico IS NULL
      ) s
    ) AS alerts
  FROM empresas e
  LEFT JOIN LATERAL public.get_resolved_rating(e.cnpj, NULL) r ON TRUE
  LEFT JOIN latest_analise la
    ON la.cnpj_norm = regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g')
  LEFT JOIN issuer_agg ia
    ON ia.cnpj_norm = regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g')
  LEFT JOIN issuer_top it
    ON it.cnpj_norm = regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g')
  LEFT JOIN active_limit al
    ON al.cnpj_norm = regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g');
END;
$function$;