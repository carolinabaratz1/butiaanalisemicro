

## Plano: Adicionar Data do Comitê de Investimentos + Novos Campos por Status

### Resumo
Consolidar todas as mudanças pendentes: novos campos no banco (recomendação, preços, justificativa de rejeição, **data do comitê**) e comportamentos por status.

### 1. Migration — novos campos na tabela `analises`

```sql
ALTER TABLE analises
  ADD COLUMN IF NOT EXISTS recomendacao text,
  ADD COLUMN IF NOT EXISTS preco_min numeric,
  ADD COLUMN IF NOT EXISTS preco_medio numeric,
  ADD COLUMN IF NOT EXISTS preco_maximo numeric,
  ADD COLUMN IF NOT EXISTS data_alvo text,
  ADD COLUMN IF NOT EXISTS justificativa_rejeicao text,
  ADD COLUMN IF NOT EXISTS data_comite text;
```

- `data_comite`: data em que o Comitê de Investimentos tomou a decisão de Aprovar ou Reprovar (formato YYYY-MM-DD, exibido DD/MM/YYYY)

### 2. Lógica por status

| Status | Campos obrigatórios |
|--------|-------------------|
| **Pendente** | Sem alteração |
| **Em Análise** | `data_inicio` registrada; analista pode rejeitar com `justificativa_rejeicao` → volta para Pendente |
| **Concluída** | Relatório resumo + Recomendação (Buy/Hold/Sell) + Preço mín/méd/máx + Data-alvo |
| **Aprovada** | `data_comite` (data do Comitê de Investimentos) |
| **Reprovada** | `data_comite` (data do Comitê de Investimentos) |
| **Vencida** | Calculada automaticamente (Aprovada + >1 ano) |

### 3. PipelineResearchPage.tsx

- **Modal de conclusão**: adicionar campos Recomendação, Preço mín/méd/máx, Data-alvo
- **Modal de rejeição (Em Análise → Pendente)**: campo justificativa obrigatória
- **Transição para Aprovada/Reprovada**: abrir modal pedindo `data_comite` (datepicker DD/MM/YYYY)
- **Drawer lateral**: exibir data do comitê, recomendação com badge colorido, faixa de preços

### 4. AnalisesPage.tsx

- Exibir coluna "Recomendação" com badge Buy/Hold/Sell
- No modal de detalhes: mostrar data do comitê, preços, data-alvo

### Detalhes Técnicos
- 1 migration SQL (7 colunas novas)
- Arquivos modificados: `PipelineResearchPage.tsx`, `AnalisesPage.tsx`
- Datepicker do comitê usa Shadcn Calendar/Popover com `pointer-events-auto`

