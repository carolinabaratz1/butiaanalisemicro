

## Plano: Corrigir gráficos + Drill-down para Vencidas/Sem Análise

### Problema 1: Gráficos ignoram filtros
Os gráficos "Distribuição por Tipo" e "Posição por Fundo" (linhas 243-252) usam `posicoes` e `allProductClasses`/`allFunds` em vez de `biFiltered`.

### Problema 2: Sem drill-down nos KPIs de research
Os KPIs "Análise Vencida" e "Sem Análise" mostram apenas o número, sem forma de ver quais posições são.

### Solução combinada em `src/pages/PosicoesPage.tsx`

**1. Gráficos respeitarem filtros (linhas 239-252):**
- Substituir `byClass` para agrupar por `biFiltered` em vez de `posicoes`
- Substituir `byFund` para agrupar por `biFiltered` em vez de `posicoes`
- Remover as variáveis `totalAtivos`, `totalFundos`, `totalTipos` que já não são usadas (os KPIs da linha 712 já usam `biFiltered` inline)

**2. Drill-down nos KPIs:**
- Novo state: `const [drillStatus, setDrillStatus] = useState<string | null>(null)`
- `useMemo` para filtrar `biFiltered` pelo status selecionado
- KPIs "Aprovada", "Vencida" e "Sem Análise" ficam clicáveis com `cursor-pointer` e `onClick`
- Dialog/modal com tabela mostrando: Produto, ISIN, Fundo, Tipo, Emissor, Rating, Data Conclusão
- Botão de exportar a lista do drill-down em .xlsx

### Detalhes técnicos

**Gráficos (byClass / byFund):**
```typescript
const biClasses = [...new Set(biFiltered.map(p => p.product_class))];
const byClass = biClasses.map(pc => ({
  name: pc,
  value: biFiltered.filter(p => p.product_class === pc).length,
}));
// Mesmo padrão para byFund
```

**Drill-down modal:**
- Título dinâmico: "Posições com Análise Vencida" / "Posições sem Análise" / "Posições com Análise Aprovada"
- Tabela com scroll horizontal em mobile
- Botão "Exportar .xlsx" usando SheetJS (já importado)

### Arquivo modificado
- `src/pages/PosicoesPage.tsx`

