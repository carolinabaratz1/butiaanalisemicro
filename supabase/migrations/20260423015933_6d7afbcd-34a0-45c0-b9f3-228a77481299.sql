UPDATE profiles
SET nome = regexp_replace(regexp_replace(nome, '^[\s\u00A0]+', ''), '[\s\u00A0]+$', '')
WHERE nome ~ '^[\s\u00A0]+' OR nome ~ '[\s\u00A0]+$';

UPDATE analises a
SET analista_responsavel = p.id::text
FROM profiles p
WHERE a.analista_responsavel = p.nome
  AND a.analista_responsavel NOT LIKE '%-%-%-%-%';