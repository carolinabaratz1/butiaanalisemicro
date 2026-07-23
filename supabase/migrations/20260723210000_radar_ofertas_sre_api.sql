-- ============================================================================
-- Radar de Ofertas: migração de fonte de dados CSV/ZIP → API SRE da CVM
-- (web.cvm.gov.br/sre-publico-cvm) — 2026-07-23
--
-- Contexto: o pipeline CSV (oferta_distribuicao.zip) nunca populou situacao,
-- valor_total e numero_registro_cvm (100% NULL nas 16.210 linhas existentes,
-- mismatch de cabeçalho) e não tem Coordenador Líder/Gestora em nenhuma coluna.
-- A API pública (não documentada, mas aberta) do próprio site de consulta da
-- CVM devolve esses campos diretamente. Esta migração adiciona as colunas
-- que faltam e MANTÉM a estrutura existente (mesma tabela, mesma função de
-- upsert), trocando apenas a fonte/identidade da linha.
--
-- Decisão de reprocessamento: como numero_registro_cvm está 100% NULL nas
-- linhas antigas (fonte CSV), não existe chave confiável para casar uma linha
-- antiga com o registro correspondente na API nova. As linhas antigas (fonte
-- CSV, source_dataset = 'oferta_distribuicao.csv'/'oferta_resolucao_160.csv')
-- são mantidas como estão — esta migração NÃO apaga dados. As novas linhas da
-- API SRE entram com source_dataset = 'sre_api' e id_requerimento_cvm
-- preenchido, então dá para distinguir as duas origens numa mesma tabela.
-- Se você quiser um dataset "limpo" só com a fonte nova, isso exige apagar as
-- ~16.210 linhas antigas — uma ação permanente que não executo por conta
-- própria; o comando ficaria pronto abaixo para você rodar manualmente
-- (Lovable Cloud → SQL editor) se e quando decidir:
--   DELETE FROM public.ofertas_publicas_cvm WHERE source_dataset <> 'sre_api';
-- ============================================================================

ALTER TABLE public.ofertas_publicas_cvm
  ADD COLUMN IF NOT EXISTS id_requerimento_cvm text,
  ADD COLUMN IF NOT EXISTS numero_processo_cvm text,
  ADD COLUMN IF NOT EXISTS coordenador_lider text,
  ADD COLUMN IF NOT EXISTS cnpj_coordenador_lider text,
  ADD COLUMN IF NOT EXISTS gestora text,
  ADD COLUMN IF NOT EXISTS publico_alvo text,
  ADD COLUMN IF NOT EXISTS nome_tipo_requerimento text;

COMMENT ON COLUMN public.ofertas_publicas_cvm.id_requerimento_cvm IS
  'idRequerimento da API SRE da CVM — identidade estável da oferta na fonte nova (substitui a dependência de hash_linha para dedupe quando source_dataset = sre_api).';
COMMENT ON COLUMN public.ofertas_publicas_cvm.gestora IS
  'Só populado para ofertas de Cotas de FIDC / FIAGRO-FIDC (via infOferta/{id}, campo "Gestor"). NULL para outros tipos de ativo — não existe nessa granularidade na API para os demais.';
COMMENT ON COLUMN public.ofertas_publicas_cvm.publico_alvo IS
  'Inferido por regra a partir de nome_tipo_requerimento (não existe campo dedicado na API) — ex.: presença de "Profissional" no texto do requerimento.';

CREATE UNIQUE INDEX IF NOT EXISTS ofertas_publicas_cvm_id_requerimento_cvm_key
  ON public.ofertas_publicas_cvm (id_requerimento_cvm)
  WHERE id_requerimento_cvm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofertas_publicas_cvm_situacao ON public.ofertas_publicas_cvm (situacao);
CREATE INDEX IF NOT EXISTS idx_ofertas_publicas_cvm_coordenador_lider ON public.ofertas_publicas_cvm (coordenador_lider);

-- ----------------------------------------------------------------------------
-- FUNÇÃO: bulk_upsert_ofertas_cvm_sre
-- Mesmo padrão de bulk_upsert_ofertas_cvm (SECURITY DEFINER, search_path fixo,
-- guard de 200k linhas), mas identidade por id_requerimento_cvm em vez de
-- hash_linha, e grava os campos novos vindos da API SRE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_upsert_ofertas_cvm_sre(p_rows jsonb)
RETURNS TABLE(inseridas integer, atualizadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_inseridas integer := 0;
  v_atualizadas integer := 0;
  v_guard integer := 0;
  v_existing_id uuid;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows deve ser um array JSONB';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 200000 THEN
      RAISE EXCEPTION 'bulk_upsert_ofertas_cvm_sre: guard de segurança atingido (200000 linhas)';
    END IF;

    IF v_row->>'id_requerimento_cvm' IS NULL OR v_row->>'tipo_ativo' IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.ofertas_publicas_cvm
    WHERE id_requerimento_cvm = v_row->>'id_requerimento_cvm';

    IF v_existing_id IS NULL THEN
      INSERT INTO public.ofertas_publicas_cvm (
              tipo_ativo, cnpj_emissor, nome_emissor, numero_registro_cvm,
              situacao, data_referencia, data_encerramento, valor_total,
              id_requerimento_cvm, numero_processo_cvm, coordenador_lider,
              cnpj_coordenador_lider, gestora, publico_alvo, nome_tipo_requerimento,
              raw_data, source_dataset, hash_linha, synced_at
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
        synced_at = now()
      WHERE id = v_existing_id;
      v_atualizadas := v_atualizadas + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_inseridas, v_atualizadas;
END;
$$;
