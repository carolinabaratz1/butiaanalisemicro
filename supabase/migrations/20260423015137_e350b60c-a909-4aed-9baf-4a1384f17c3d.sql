DO $$
DECLARE
  v_updated INTEGER;
  v_com_uuid INTEGER;
  v_ainda_com_nome INTEGER;
  v_sem_analista INTEGER;
  v_total INTEGER;
BEGIN
  UPDATE analises a
  SET analista_responsavel = p.id::text
  FROM profiles p
  WHERE a.analista_responsavel = p.nome
    AND a.analista_responsavel NOT LIKE '%-%-%-%-%';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT
    COUNT(*) FILTER (WHERE analista_responsavel LIKE '%-%-%-%-%'),
    COUNT(*) FILTER (WHERE analista_responsavel NOT LIKE '%-%-%-%-%' AND analista_responsavel IS NOT NULL),
    COUNT(*) FILTER (WHERE analista_responsavel IS NULL),
    COUNT(*)
  INTO v_com_uuid, v_ainda_com_nome, v_sem_analista, v_total
  FROM analises;

  RAISE NOTICE 'UPDATE atualizou: % linhas', v_updated;
  RAISE NOTICE 'com_uuid: %, ainda_com_nome: %, sem_analista: %, total: %',
    v_com_uuid, v_ainda_com_nome, v_sem_analista, v_total;
END $$;