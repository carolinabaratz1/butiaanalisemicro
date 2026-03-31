ALTER TABLE analises DROP CONSTRAINT IF EXISTS analises_status_check;
ALTER TABLE analises ADD CONSTRAINT analises_status_check CHECK (status IN ('Pendente', 'Em Análise', 'Concluída', 'Aprovada', 'Reprovada', 'Vencida'));
UPDATE analises SET status = 'Concluída' WHERE status = 'Concluído';