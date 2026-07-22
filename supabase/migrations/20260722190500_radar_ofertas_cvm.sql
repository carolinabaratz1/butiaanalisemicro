-- ============================================================================
-- Radar de Ofertas: ofertas públicas de valores mobiliários (CVM)
-- Fonte: dados.cvm.gov.br (CSV diário) | Idempotente
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELA: ofertas_publicas_cvm
-- Guarda todas as ofertas do universo CVM (Debênture, CRI, CRA, FIDC, LF etc.)
-- Nunca filtra por emissor: o app decide o que exibir/destacar.
-- raw_data preserva a linha bruta do CSV inteira (JSONB) para nunca perder
-- campos que a Edge Function ainda não mapeou/normalizou.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ofertas_publicas_cvm (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_ativo text NOT NULL,
    cnpj_emissor text,
    nome_emissor text,
    numero_registro_cvm text,
    numero_emissao text,
    numero_serie text,
    situacao text,
    modalidade text,
    data_referencia date,
    data_encerramento date,
    valor_total numeric,
    raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_dataset text,
    hash_linha text NOT NULL,
    first_seen_at timestamptz DEFAULT now() NOT NULL,
    synced_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ofertas_publicas_cvm_hash_linha_key ON public.ofertas_publicas_cvm (hash_linha);
CREATE INDEX IF NOT EXISTS idx_ofertas_publicas_cvm_cnpj_emissor ON public.ofertas_publicas_cvm (cnpj_emissor);
CREATE INDEX IF NOT EXISTS idx_ofertas_publicas_cvm_tipo_ativo ON public.ofertas_publicas_cvm (tipo_ativo);
CREATE INDEX IF NOT EXISTS idx_ofertas_publicas_cvm_data_referencia ON public.ofertas_publicas_cvm (data_referencia);
CREATE INDEX IF NOT EXISTS idx_ofertas_publicas_cvm_synced_at ON public.ofertas_publicas_cvm (synced_at);

DROP TRIGGER IF EXISTS trg_ofertas_publicas_cvm_updated_at ON public.ofertas_publicas_cvm;
CREATE TRIGGER trg_ofertas_publicas_cvm_updated_at
  BEFORE UPDATE ON public.ofertas_publicas_cvm
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ofertas_publicas_cvm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ofertas_publicas_cvm" ON public.ofertas_publicas_cvm;
CREATE POLICY "Authenticated users can read ofertas_publicas_cvm" ON public.ofertas_publicas_cvm
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
-- Sem policy de INSERT/UPDATE/DELETE para usuários autenticados: a tabela só é
-- escrita pela Edge Function sync-cvm-ofertas via service role (bypassa RLS).

-- ----------------------------------------------------------------------------
-- TABELA: cvm_ofertas_sync_log
-- Histórico de execuções da sincronização diária (para o card "última sincronização").
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cvm_ofertas_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamptz DEFAULT now() NOT NULL,
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'em_andamento',
    total_linhas_processadas integer DEFAULT 0,
    total_inseridas integer DEFAULT 0,
    total_atualizadas integer DEFAULT 0,
    mensagem_erro text,
    dataset_url text,
    created_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
  );

CREATE INDEX IF NOT EXISTS idx_cvm_ofertas_sync_log_started_at ON public.cvm_ofertas_sync_log (started_at DESC);

ALTER TABLE public.cvm_ofertas_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cvm_ofertas_sync_log" ON public.cvm_ofertas_sync_log;
CREATE POLICY "Authenticated users can read cvm_ofertas_sync_log" ON public.cvm_ofertas_sync_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- COLUNA: analises.oferta_cvm_id
-- Liga uma análise do Pipeline de volta à oferta CVM que a originou (botão "Analisar").
-- ----------------------------------------------------------------------------
ALTER TABLE public.analises ADD COLUMN IF NOT EXISTS oferta_cvm_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'analises_oferta_cvm_id_fkey'
    ) THEN
    ALTER TABLE public.analises
      ADD CONSTRAINT analises_oferta_cvm_id_fkey
      FOREIGN KEY (oferta_cvm_id) REFERENCES public.ofertas_publicas_cvm(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analises_oferta_cvm_id ON public.analises (oferta_cvm_id);

-- ----------------------------------------------------------------------------
-- VIEW: v_ofertas_publicas_cvm_enriquecida
-- Junta a oferta com o cadastro de emissores (empresas) por CNPJ normalizado,
-- para sinalizar visualmente se o emissor já existe na plataforma, e já
-- expõe se já existe alguma análise vinculada a essa oferta.
-- security_invoker=true para respeitar RLS do usuário chamador (mesmo padrão
-- das views mais recentes do projeto).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ofertas_publicas_cvm_enriquecida
WITH (security_invoker = true) AS
SELECT
  o.*,
  e.id AS empresa_id_existente,
  e.nome AS empresa_nome_cadastrado,
  e.rating AS empresa_rating_atual,
  (e.id IS NOT NULL) AS emissor_ja_cadastrado,
  a.id AS analise_id_existente,
  a.status AS analise_status_existente
FROM public.ofertas_publicas_cvm o
LEFT JOIN public.empresas e
  ON regexp_replace(e.cnpj, '\D', '', 'g') = regexp_replace(o.cnpj_emissor, '\D', '', 'g')
  AND o.cnpj_emissor IS NOT NULL AND o.cnpj_emissor <> ''
LEFT JOIN public.analises a
  ON a.oferta_cvm_id = o.id;

-- ----------------------------------------------------------------------------
-- FUNÇÃO: bulk_upsert_ofertas_cvm
-- Recebe um array JSONB de ofertas (cada item já mapeado pela Edge Function
-- a partir do CSV da CVM) e faz upsert em lote via hash_linha.
-- SECURITY DEFINER pois é chamada pela Edge Function com o client de service role,
-- mas mesmo assim mantemos search_path fixo por segurança.
-- Retorna contagem de inseridas/atualizadas para alimentar o sync_log.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_upsert_ofertas_cvm(p_rows jsonb)
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
      RAISE EXCEPTION 'bulk_upsert_ofertas_cvm: guard de segurança atingido (200000 linhas)';
    END IF;

    IF v_row->>'hash_linha' IS NULL OR v_row->>'tipo_ativo' IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.ofertas_publicas_cvm
    WHERE hash_linha = v_row->>'hash_linha';

    IF v_existing_id IS NULL THEN
      INSERT INTO public.ofertas_publicas_cvm (
              tipo_ativo, cnpj_emissor, nome_emissor, numero_registro_cvm,
              numero_emissao, numero_serie, situacao, modalidade,
              data_referencia, data_encerramento, valor_total,
              raw_data, source_dataset, hash_linha, synced_at
            ) VALUES (
              v_row->>'tipo_ativo',
              v_row->>'cnpj_emissor',
              v_row->>'nome_emissor',
              v_row->>'numero_registro_cvm',
              v_row->>'numero_emissao',
              v_row->>'numero_serie',
              v_row->>'situacao',
              v_row->>'modalidade',
              NULLIF(v_row->>'data_referencia','')::date,
              NULLIF(v_row->>'data_encerramento','')::date,
              NULLIF(v_row->>'valor_total','')::numeric,
              COALESCE(v_row->'raw_data', '{}'::jsonb),
              v_row->>'source_dataset',
              v_row->>'hash_linha',
              now()
            );
      v_inseridas := v_inseridas + 1;
    ELSE
      UPDATE public.ofertas_publicas_cvm SET
        tipo_ativo = v_row->>'tipo_ativo',
        cnpj_emissor = v_row->>'cnpj_emissor',
        nome_emissor = v_row->>'nome_emissor',
        numero_registro_cvm = v_row->>'numero_registro_cvm',
        numero_emissao = v_row->>'numero_emissao',
        numero_serie = v_row->>'numero_serie',
        situacao = v_row->>'situacao',
        modalidade = v_row->>'modalidade',
        data_referencia = NULLIF(v_row->>'data_referencia','')::date,
        data_encerramento = NULLIF(v_row->>'data_encerramento','')::date,
        valor_total = NULLIF(v_row->>'valor_total','')::numeric,
        raw_data = COALESCE(v_row->'raw_data', raw_data),
        source_dataset = v_row->>'source_dataset',
        synced_at = now()
      WHERE id = v_existing_id;
      v_atualizadas := v_atualizadas + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_inseridas, v_atualizadas;
END;
$$;
