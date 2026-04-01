

## Plano: Dashboard com Dados Reais do Supabase

### Problema atual
O Dashboard usa dados mockados (`mockData.ts`, `users.ts`, `emissores.ts`) e lógica de matching frágil. Os números não refletem o que está no Pipeline Research.

### Correção 1: Erro de runtime (PipelinePage)
O erro `PipelinePage is not defined` vem de cache. O App.tsx já está correto sem referência ao PipelinePage. Será resolvido com o rebuild.

### Correção 2: KPIs superiores — todos via Supabase

**Cards que precisam ser corrigidos:**

| Card | Atual | Correto |
|------|-------|---------|
| Análises em andamento | mockData.analises | `analises` tabela: status = 'Pendente' ou 'Em Análise' |
| Aprovadas (mês) | mockData.analises | `analises` tabela: status = 'Aprovada' com data_conclusao no mês atual |
| Alertas pendentes | hardcoded `3` | Contar análises vencidas (Aprovada com data > 1 ano) |
| Cobertura ativa | fuzzy match por nome | Cadeia correta: `posicoes.isin` → `emissoes.cnpj_emissor` → distinct CNPJs |
| Ativos na carteira | count total posicoes | Distinct CNPJs via `posicoes.isin` → `emissoes.cnpj_emissor` (latest val_date) |
| Sem análise vinculada | fuzzy match | CNPJs com posição ativa que NÃO têm análise válida (< 1 ano) |

### Correção 3: Pipeline Geral — dividir Vencida

Atualizar o widget "Pipeline Geral" para exibir 7 contadores (igual ao Kanban):
- Pendente, Em Análise, Concluída, Aprovada, Reprovada, **Vencida c/ Alocação**, **Vencida s/ Alocação**

Usa a mesma lógica do PipelineResearchPage: buscar CNPJs com posição ativa via `emissoes` e classificar as vencidas.

### Correção 4: Tabelas inferiores — dados reais

- **"Pipeline da Semana"**: Substituir `pipelineItems` por query nas análises com status 'Pendente' ou 'Em Análise', ordenadas por prazo
- **"Últimas Análises Aprovadas"**: Query `analises` com status 'Aprovada', ordenadas por data_conclusao DESC, limit 5. Join com `empresas` para nome
- **"Alertas"**: Gerar dinamicamente a partir de análises vencidas com posição ativa (prioridade) + próximas do vencimento

### Correção 5: Remover dependências de dados mock

Eliminar imports de `mockData.ts`, `users.ts`, `emissores.ts` do DashboardPage. Tudo vem do Supabase.

### Arquivo modificado
- `src/pages/DashboardPage.tsx` (reescrita significativa das queries e renderização)

### Resultado esperado
Dashboard refletindo exatamente os números do Pipeline Research: 78 aprovadas, 2 reprovadas, 42 vencidas c/ alocação, 23 vencidas s/ alocação, e contagem correta de ativos na carteira por CNPJ.

