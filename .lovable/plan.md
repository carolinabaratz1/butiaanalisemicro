## Backfill do histórico — Aprovadas como Crédito Privado

### Diagnóstico
Levantamento na tabela `analises` mostra que o histórico legado tem a recomendação armazenada na coluna `status` (`Buy` / `Hold` / `Sell`), mas a coluna `recomendacao_rf` está vazia:

| tipo            | status     | qtd | recomendacao_rf |
|-----------------|------------|-----|-----------------|
| Crédito Privado | Buy        | 166 | null            |
| Crédito Privado | Sell       | 2   | null            |
| Crédito Privado | Concluída  | 1   | Hold (ok)       |
| Crédito Privado | Em Análise | 12  | —               |
| Crédito Privado | Pendente   | 19  | —               |
| Ações           | Em Análise | 1   | —               |

Como o histórico anterior era 100% de Crédito Privado, todas as aprovações antigas devem aparecer como "Aprovada — Crédito: Buy/Hold/Sell" no novo card unificado.

### Ação (data migration via tool `supabase--insert`)
Um único `UPDATE`:

```sql
UPDATE analises
SET recomendacao_rf = status
WHERE recomendacao_rf IS NULL
  AND status IN ('Buy', 'Hold', 'Sell');
```

- Não altera `status` (mantém o card na coluna correta do Kanban antigo enquanto a UI nova não está implementada).
- Não toca em `recomendacao` (campo de Ações) — histórico não tinha Ações aprovadas.
- Não altera registros em `Em Análise` / `Pendente` / `Concluída`.

### Fora de escopo
- Schema (já permite `tipo` opcional na migration anterior).
- Lógica de exibição/Kanban (já será tratada na implementação do card unificado).
- Registro único em `Ações / Em Análise` — segue o fluxo normal.

Após sua aprovação, executo o UPDATE e seguimos com a implementação do card unificado pendente (PipelineResearchPage, PosicoesPage, useTradeIntegration, EmpresaDetailPage).