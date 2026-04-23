UPDATE profiles
SET nome = TRIM(nome)
WHERE nome <> TRIM(nome);

UPDATE analises a
SET analista_responsavel = p.id::text
FROM profiles p
WHERE a.analista_responsavel = p.nome
  AND a.analista_responsavel NOT LIKE '%-%-%-%-%';