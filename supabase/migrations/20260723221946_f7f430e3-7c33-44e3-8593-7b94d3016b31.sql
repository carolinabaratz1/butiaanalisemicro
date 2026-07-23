CREATE OR REPLACE FUNCTION public.bulk_upsert_ofertas_cvm_sre(p_rows jsonb)
 RETURNS TABLE(inseridas integer, atualizadas integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb;
  v_inseridas integer := 0;
  v_atualizadas integer := 0;
  v_guard integer := 0;
  v_existing_id bigint;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows deve ser um array JSONB';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 200000 THEN
      RAISE EXCEPTION 'guard de seguranca atingido';
    END IF;

    IF v_row->>'id_requerimento_cvm' IS NULL OR v_row->>'tipo_ativo' IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.ofertas_publicas_cvm
    WHERE id_requerimento_cvm = v_row->>'id_requerimento_cvm'
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.ofertas_publicas_cvm (
        tipo_ativo,
        cnpj_emissor,
        nome_emissor,
        numero_registro_cvm,
        situacao,
        data_referencia,
        data_encerramento,
        valor_total,
        id_requerimento_cvm,
        numero_processo_cvm,
        coordenador_lider,
        cnpj_coordenador_lider,
        gestora,
        publico_alvo,
        nome_tipo_requerimento,
        raw_data,
        source_dataset,
        hash_linha,
        last_seen_at
      ) VALUES (
        v_row->>'tipo_ativo',
        v_row->>'cnpj_emissor',
        v_row->>'nome_emissor',
        v_row->>'numero_registro_cvm',
        v_row->>'situacao',
        NULLIF(v_row->>'data_referencia','')::date,
        NULLIF(v_row->>'data_encerramento','')::date,
        NULLIF(v_row->>'valor_total','')::numeric,
        v_row->>'id_requerimento_cvm',
        v_row->>'numero_processo_cvm',
        v_row->>'coordenador_lider',
        v_row->>'cnpj_coordenador_lider',
        v_row->>'gestora',
        v_row->>'publico_alvo',
        v_row->>'nome_tipo_requerimento',
        COALESCE(v_row->'raw_data', '{}'::jsonb),
        'sre_api',
        'sre:' || (v_row->>'id_requerimento_cvm'),
        now()
      );
      v_inseridas := v_inseridas + 1;
    ELSE
      UPDATE public.ofertas_publicas_cvm SET
        tipo_ativo = v_row->>'tipo_ativo',
        cnpj_emissor = v_row->>'cnpj_emissor',
        nome_emissor = v_row->>'nome_emissor',
        numero_registro_cvm = v_row->>'numero_registro_cvm',
        situacao = v_row->>'situacao',
        data_referencia = NULLIF(v_row->>'data_referencia','')::date,
        data_encerramento = NULLIF(v_row->>'data_encerramento','')::date,
        valor_total = NULLIF(v_row->>'valor_total','')::numeric,
        numero_processo_cvm = v_row->>'numero_processo_cvm',
        coordenador_lider = v_row->>'coordenador_lider',
        cnpj_coordenador_lider = v_row->>'cnpj_coordenador_lider',
        gestora = COALESCE(v_row->>'gestora', gestora),
        publico_alvo = v_row->>'publico_alvo',
        nome_tipo_requerimento = v_row->>'nome_tipo_requerimento',
        raw_data = COALESCE(v_row->'raw_data', raw_data),
        source_dataset = 'sre_api',
        last_seen_at = now()
      WHERE id = v_existing_id;
      v_atualizadas := v_atualizadas + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_inseridas, v_atualizadas;
END;
$function$;