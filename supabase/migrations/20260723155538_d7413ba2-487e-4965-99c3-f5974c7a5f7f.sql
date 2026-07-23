CREATE OR REPLACE FUNCTION public.bulk_upsert_ofertas_cvm(p_rows jsonb)
RETURNS TABLE(inseridas integer, atualizadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows deve ser um array JSONB';
  END IF;

  RETURN QUERY
  WITH input_rows AS (
    SELECT
      r.source_dataset,
      COALESCE(NULLIF(r.hash_linha, ''), encode(extensions.digest(COALESCE(r.hash_source, '')::text, 'sha256'), 'hex')) AS hash_linha,
      r.tipo_ativo,
      r.nome_emissor,
      r.cnpj_emissor,
      r.situacao,
      r.modalidade,
      r.numero_registro_cvm,
      r.numero_emissao,
      r.numero_serie,
      r.coordenador_lider,
      r.taxa_emissao,
      r.data_referencia,
      r.data_encerramento,
      r.valor_total,
      r.raw_data
    FROM jsonb_to_recordset(p_rows) AS r(
      source_dataset text,
      hash_linha text,
      hash_source text,
      tipo_ativo text,
      nome_emissor text,
      cnpj_emissor text,
      situacao text,
      modalidade text,
      numero_registro_cvm text,
      numero_emissao text,
      numero_serie text,
      coordenador_lider text,
      taxa_emissao text,
      data_referencia text,
      data_encerramento text,
      valor_total text,
      raw_data jsonb
    )
    WHERE r.tipo_ativo IS NOT NULL
      AND r.source_dataset IS NOT NULL
      AND (NULLIF(r.hash_linha, '') IS NOT NULL OR NULLIF(r.hash_source, '') IS NOT NULL)
  ),
  upserted AS (
    INSERT INTO public.ofertas_publicas_cvm (
      source_dataset,
      hash_linha,
      tipo_ativo,
      nome_emissor,
      cnpj_emissor,
      situacao,
      modalidade,
      numero_registro_cvm,
      numero_emissao,
      numero_serie,
      coordenador_lider,
      taxa_emissao,
      data_referencia,
      data_encerramento,
      valor_total,
      raw_data,
      last_seen_at
    )
    SELECT
      source_dataset,
      hash_linha,
      tipo_ativo,
      nome_emissor,
      cnpj_emissor,
      situacao,
      modalidade,
      numero_registro_cvm,
      numero_emissao,
      numero_serie,
      coordenador_lider,
      taxa_emissao,
      NULLIF(data_referencia, '')::date,
      NULLIF(data_encerramento, '')::date,
      NULLIF(valor_total, '')::numeric,
      COALESCE(raw_data, '{}'::jsonb),
      now()
    FROM input_rows
    ON CONFLICT (source_dataset, hash_linha) DO UPDATE SET
      tipo_ativo = EXCLUDED.tipo_ativo,
      nome_emissor = EXCLUDED.nome_emissor,
      cnpj_emissor = EXCLUDED.cnpj_emissor,
      situacao = EXCLUDED.situacao,
      modalidade = EXCLUDED.modalidade,
      numero_registro_cvm = EXCLUDED.numero_registro_cvm,
      numero_emissao = EXCLUDED.numero_emissao,
      numero_serie = EXCLUDED.numero_serie,
      coordenador_lider = EXCLUDED.coordenador_lider,
      taxa_emissao = EXCLUDED.taxa_emissao,
      data_referencia = EXCLUDED.data_referencia,
      data_encerramento = EXCLUDED.data_encerramento,
      valor_total = EXCLUDED.valor_total,
      raw_data = EXCLUDED.raw_data,
      last_seen_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COALESCE(count(*) FILTER (WHERE inserted), 0)::integer AS inseridas,
    COALESCE(count(*) FILTER (WHERE NOT inserted), 0)::integer AS atualizadas
  FROM upserted;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_upsert_ofertas_cvm(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_ofertas_cvm(jsonb) TO service_role;