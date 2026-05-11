ALTER TABLE analises DROP CONSTRAINT IF EXISTS analises_status_check;
ALTER TABLE analises ADD CONSTRAINT analises_status_check
  CHECK (status IN ('Pendente','Em Análise','Concluída','Aprovada','Reprovada','Buy','Hold','Sell','Vencida c/ Alocação','Vencida s/ Alocação'));
UPDATE analises SET status = 'Buy' WHERE status = 'Aprovada';
UPDATE analises SET status = 'Sell' WHERE status = 'Reprovada';