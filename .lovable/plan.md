

## Plano: Excluir produto "Termo" dos KPIs de análise

### Problema
Posições com `product` = "Termo" são operações que não requerem análise de crédito. Atualmente, elas entram no cálculo dos KPIs (Análise Aprovada, Análise Vencida, Sem Análise, % Cobertura), inflando os números incorretamente.

### Mudança

**Filtrar "Termo" no cálculo de métricas BI (`src/pages/PosicoesPage.tsx`)**

- No `biMetrics` (linha ~271), filtrar `biFiltered` excluindo posições onde `product === 'Termo'` antes de calcular aprovadas, vencidas, semAnalise e cobertura
- Aplicar o mesmo filtro nos dados de:
  - `coverageByFund` (gráfico cobertura por fundo)
  - `statusDistribution` (gráfico distribuição por status)
  - `drillPositions` (drill-down dos KPIs)
- Os KPIs de "Total de Ativos", "Fundos com Posição" e "Tipos Distintos" continuam contando todas as posições (inclusive Termo), pois são métricas de carteira e não de research

### Arquivo modificado
- `src/pages/PosicoesPage.tsx`

