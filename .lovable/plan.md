## Objetivo
Corrigir a classificação de ativos DPGE como rating AAA, estendendo a regra para também inspecionar o campo `ticker` (além de `product`/`product_class`), já que a palavra "DPGE" só aparece no ticker dessas posições.

## Diagnóstico confirmado
- `isForcedAAAProduct(product, productClass)` em `src/components/alocacao/allocationUtils.ts` só verifica `product` e `product_class`.
- Posições DPGE reais vêm com `product`/`product_class` genéricos (ex: "CDB DI Spread") e o identificador "DPGE" apenas no `ticker`.
- Por isso a regra nunca dispara e o DPGE exibe o rating real do banco emissor, em vez de AAA.

## Escopo das alterações

### 1. `src/components/alocacao/allocationUtils.ts`
- Adicionar terceiro parâmetro opcional `ticker?: string | null` em `isForcedAAAProduct`.
- Incluir checagem case-insensitive por `"dpge"` no ticker, junto com as já existentes em `product` e `product_class`.
- Manter o comportamento atual para Compromissada (ainda detectada por texto de product/product_class).

### 2. `src/lib/ratings/resolvePositionRating.ts`
- Adicionar `ticker?: string | null` na interface `PositionLike`.
- Passar `row.ticker` para `isForcedAAAProduct(row.product, row.product_class, row.ticker)`.
- Isso mantém a fonte única de verdade centralizada; as demais telas que já usam `resolvePositionRating` herdam a correção automaticamente.

### 3. `src/hooks/useFundoDashboard.ts`
- Atualizar as duas chamadas existentes de `isForcedAAAProduct` para passar `r.ticker`:
  - Linha ~212 (classificação principal).
  - Linha ~283 (rótulo de "Top Posições").

### 4. `src/components/posicoes/useExposicaoData.ts`
- Atualizar a chamada em ~linha 313 para passar `em?.ticker ?? null`.

### 5. `src/components/alocacao/useAllocationData.ts`
- A lógica de rating já usa `resolvePositionRating`. Ajustar a chamada para incluir `ticker: emissao?.ticker ?? null` no objeto `PositionLike`, garantindo que a nova regra de ticker seja avaliada.

### 6. `src/pages/PosicoesPage.tsx`
- Atualizar a chamada em ~linha 250 para passar `p.ticker` (ou equivalente disponível na posição), mantendo a tela de Posições alinhada.

## Verificação
- Typecheck (`bunx tsc --noEmit` / `tsgo`).
- Revisar visualmente na aba de Alocação / Dashboard / Posições se DPGE do Mercantil (ou outro emissor) agora aparece no bucket AAA.

## Fora de escopo
- Não alterar a lógica de Compromissada/Overnight/LFT (já funciona por product/product_class).
- Não mudar regras de cache do React Query nem forçar invalidações — a correção é puramente de cálculo.