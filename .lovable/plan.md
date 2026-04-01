

## Plano: Dividir "Vencida" em "Vencida c/ Alocação" e "Vencida s/ Alocação"

### Arquivo: `src/pages/PipelineResearchPage.tsx`

**1. Expandir tipo e colunas**
- `AnaliseStatus` passa a incluir `'Vencida c/ Alocação' | 'Vencida s/ Alocação'`
- Array `columns`: substituir a entrada `Vencida` por duas:
  - `{ key: 'Vencida c/ Alocação', label: 'Vencida c/ Alocação', color: 'text-red-400' }`
  - `{ key: 'Vencida s/ Alocação', label: 'Vencida s/ Alocação', color: 'text-orange-400' }`
- Grid: `grid-cols-6` → `grid-cols-7`

**2. Ajustar `getDisplayStatus`**
- A função precisa receber o `empresa_id` e a função `temPosicaoAtiva` para decidir:
  - Se vencida + `temPosicaoAtiva(empresa_id)` → `'Vencida c/ Alocação'`
  - Se vencida + sem posição → `'Vencida s/ Alocação'`
- `analisesComStatus` useMemo passa a chamar a versão atualizada

**3. Atualizar todas as referências a `'Vencida'`**
- Quick actions "Reabrir" (linha ~539): verificar ambos os status
- Drawer "Reabrir" (linha ~673): verificar ambos
- Histórico no drawer (linha ~381): incluir ambos
- Drag-and-drop: ambos são colunas de exibição apenas (não são targets de drop válidos, como já é o caso de "Vencida")

**Resultado esperado**: 7 colunas no Kanban. Baseado na análise anterior: ~42 cards em "Vencida c/ Alocação" e ~23 em "Vencida s/ Alocação".

