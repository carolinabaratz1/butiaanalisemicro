

## Plano: Validade de Análises (1 ano) e Distinção Aprovada vs Concluída

### Contexto Atual
- Status no banco: `Pendente`, `Em Análise`, `Concluído`, `Rejeitado`
- Constraint `analises_status_check` valida apenas esses 4 valores
- Não há conceito de validade/vencimento nem distinção entre "Concluída" e "Aprovada"

### Mudanças Propostas

**1. Novos status no banco de dados**
- Adicionar `Vencida` à constraint de status
- Adicionar `Aprovada` e `Reprovada` como status distintos de `Concluído`
- Novo fluxo: `Pendente → Em Análise → Concluída → Aprovada/Reprovada`
- Após 1 ano da `data_conclusao`, análises com status `Aprovada` passam a ser `Vencida`

**Migration SQL:**
```sql
ALTER TABLE analises DROP CONSTRAINT IF EXISTS analises_status_check;
ALTER TABLE analises ADD CONSTRAINT analises_status_check 
  CHECK (status IN ('Pendente', 'Em Análise', 'Concluída', 'Aprovada', 'Reprovada', 'Vencida'));
-- Migrar dados existentes
UPDATE analises SET status = 'Concluída' WHERE status = 'Concluído';
```

**2. Lógica de vencimento (front-end)**
- Ao carregar análises, calcular se `data_conclusao` é anterior a 1 ano
- Análises `Aprovada` com mais de 1 ano → exibir como `Vencida` (pode opcionalmente atualizar no banco)
- Badge `Vencida` em vermelho/laranja com ícone de alerta

**3. Atualizar AnalisesPage.tsx**
- `statusClass`: adicionar estilos para `Concluída`, `Aprovada`, `Reprovada`, `Vencida`
- Filtros: atualizar dropdown com os novos status
- Formatar datas com `fmtDateBR`
- Buscar nomes de empresas da tabela `empresas` do Supabase (não mais do arquivo estático)

**4. Atualizar PipelineResearchPage.tsx**
- Colunas do kanban: ajustar `Concluído` → `Concluída`, adicionar `Aprovada`, `Reprovada`
- Ou manter kanban com 4 colunas agrupando logicamente

**5. Atualizar DashboardPage.tsx**
- Pipeline Geral: incluir contagem dos novos status
- Considerar `Vencida` nas métricas

### Detalhes Técnicos
- Migration: drop + recreate constraint, UPDATE dados existentes para novo valor
- Front-end: helper `isVencida(analise)` que verifica `data_conclusao < 1 ano atrás && status === 'Aprovada'`
- Arquivos modificados: `AnalisesPage.tsx`, `PipelineResearchPage.tsx`, `DashboardPage.tsx`
- 1 migration SQL

