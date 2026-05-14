-- Limpa uploads de posições corrompidos (sem ISIN, layout incorreto)
-- que sobrescreveram a referência de posições no Trade Monitor.
-- Mantém os registros antigos com ISIN preenchido (formato MM/DD/YYYY).
DELETE FROM public.posicoes
WHERE isin IS NULL
  AND val_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';