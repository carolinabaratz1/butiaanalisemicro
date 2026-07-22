## Investigação — Regra "DPGE/Compromissada = AAA"

### 1. Dados reais no banco
Query em `posicoes` mostrou apenas **1 variante** hoje: `product = "Compromissada"`, `product_class = "Compromissada"`. Nenhum DPGE em carteira no momento. O texto bate perfeitamente com o regex `isForcedAAAProduct` (que casa "dpge" ou "compromiss"). Portanto **o problema não é de dados / variação de texto** — é de código: existem telas que não passam pelo funil da regra.

### 2. Mapa de onde o rating de posição é lido / exibido

| # | Arquivo | Fonte do rating exibido | Aplica `isForcedAAAProduct`? | Aplica `synthesizeIssuerFromProduct` (que já cobre Compromissada via Tesouro/Soberano)? | Situação |
|---|---|---|---|---|---|
| 1 | `src/pages/PosicoesPage.tsx` (linha 250) | `empresa?.rating` | ✅ Sim | ✅ Sim | OK |
| 2 | `src/components/posicoes/useExposicaoData.ts` (linhas 289–320) | `get_resolved_rating` | ✅ Sim | ✅ Sim | OK |
| 3 | `src/components/posicoes/exposicaoExport.ts` | herda de (2) | via dado | via dado | OK (segue #2) |
| 4 | `src/components/posicoes/ExposicaoGrupoEmissorTab.tsx` (linhas 778+) | herda de (2) | via dado | via dado | OK |
| 5 | `src/hooks/useFundoDashboard.ts` (linhas 162–235) | `resolveRatingsBatch` + override | ✅ Sim | ✅ Sim | OK |
| 6 | `src/components/posicoes/FundoDashboard.tsx` | herda de (5) | via dado | via dado | OK |
| 7 | `src/components/alocacao/useAllocationData.ts` (linhas 315–478) | `get_resolved_rating` + override | ✅ Sim | via `isTermo` + `isForcedAAAProduct` | OK |
| 8 | `src/components/alocacao/IssuerExposurePanel.tsx` | herda de (7) | via dado | via dado | OK |
| 9 | `src/components/alocacao/FundLimitsPanel.tsx` | herda de (7) | via dado | via dado | OK |
| 10 | **`src/pages/PositionsMonitorPage.tsx`** (linhas 140–163, 415–426, 291) | `resolveRatingsBatch` puro | ❌ **NÃO** | ❌ **NÃO** | 🔴 **BUG — tabela, export CSV, ordenação, filtro por bucket, e KPI de distribuição usam rating "cru" do banco emissor** |
| 11 | **`src/pages/AnalyticsPage.tsx`** (linhas 87–107, 178, 383) | `resolveRatingsBatch` puro | ❌ **NÃO** | ❌ **NÃO** | 🔴 **BUG — Distribuição por rating, KPI "% Sem rating", aba Compliance e export XLSX usam rating do banco** |
| 12 | `src/components/alocacao/TargetsPanel.tsx` (linhas 381–495) | `empresas.rating` + `get_resolved_rating` por CNPJ | ❌ Não | ❌ Não | ⚠️ Rating a nível de **emissor** (não posição). Correto não aplicar a regra aqui — o override AAA só faz sentido no contexto de uma posição de DPGE/Compromissada. |
| 13 | `src/pages/RatingResolverPage.tsx` | RPC `get_resolved_rating_v2` (ferramenta de consulta) | ❌ Não | ❌ Não | ⚠️ Consulta ad-hoc por CNPJ/ISIN — regra de produto não se aplica sem contexto de posição. OK deixar como está. |
| 14 | RPC SQL `get_resolved_rating` / `get_resolved_rating_v2` | tabelas de histórico | — | — | Não conhece `product`; a regra é frontend-only por design. OK. |

### 3. Diagnóstico

O rating de **Compromissada** (e futuramente DPGE) continua aparecendo como o rating do banco emissor em duas telas:

1. **`PositionsMonitorPage.tsx`** (rota Trade → Positions Monitor)
2. **`AnalyticsPage.tsx`** (rota Analytics — todas as visões de distribuição, KPI de "% Sem rating" e export XLSX)

Ambas chamam `resolveRatingsBatch` direto e nunca consultam `synthesizeIssuerFromProduct` nem `isForcedAAAProduct`. Como o RPC `get_resolved_rating` resolve o CNPJ do banco por trás da compromissada, o resultado é o rating "AA+" / "A" do banco em vez de "AAA".

Bônus: também não há verificação de `isExcludedFromPL` em PositionsMonitorPage / AnalyticsPage, então DAP/Futuros vazam para os KPIs — fora do escopo deste ticket mas cabe registrar.

### 4. Verificações adicionais solicitadas

- **Sobrescrita posterior do rating**: nenhuma encontrada. Em `useAllocationData.ts` linha 321 (`if (r?.rating) e.rating = r.rating`) o override só ocorre se `r.rating` estiver preenchido — o valor forçado 'AAA' já foi injetado antes e é preservado.
- **Cache do React Query**: as queries afetadas usam `staleTime` de 60s (FundoDashboard) e 5 min (`useResolvedRating`). Nada de `Infinity`. Não é a causa.
- **Deploy dos commits 1f999ec / 7233e32**: as linhas 250 (`PosicoesPage.tsx`) e 313 (`useExposicaoData.ts`) já contêm `isForcedAAAProduct`. Está deployado.

### 5. Proposta — centralizar em `resolvePositionRating()`

Criar `src/lib/ratings/resolvePositionRating.ts` com uma única função (e um helper batch) que encapsule TODA a hierarquia de decisão de rating de posição, na ordem correta:

```text
resolvePositionRating(row, ratingResolved, butiaRfCpCnpjs) →
  1. isCaixaIntragrupo(cnpj, butiaRfCp)   → { rating: 'AAA', source: 'regra_produto', label: 'AAA' }
  2. synthesizeIssuerFromProduct(product, class) presente
     → { rating: synth.rating (Soberano/AAA), bucket: 'AAA', source: 'regra_produto', synthIssuer }
  3. isForcedAAAProduct(product, class)    → { rating: 'AAA', source: 'regra_produto' }
  4. ratingResolved (get_resolved_rating)  → passthrough
  5. fallback                              → { rating: null, source: 'nr' }
```

E um `resolvePositionRatingsBatch(rows)` que já embute a chamada a `resolveRatingsBatch` para não duplicar código.

**Migrar as 5 telas de posição** (`PosicoesPage`, `useExposicaoData`, `useFundoDashboard`, `useAllocationData`, **`PositionsMonitorPage`**, **`AnalyticsPage`**) para consumir esse helper. Isso:

- Corrige de imediato PositionsMonitor e Analytics (raiz do bug atual).
- Elimina a duplicação atual (cada tela reimplementa a mesma ordem: caixa → synth → forçado → resolved).
- Garante que qualquer nova regra futura (novo produto forçado AAA, novo emissor sintético) vire uma edição em 1 arquivo, não em 6.

### 6. Fora de escopo (registrado para acompanhamento)

- Adicionar filtro `isExcludedFromPL` em PositionsMonitor e Analytics (DAP/Futuros vazando para KPIs).
- Considerar mover a regra de produto para o RPC SQL, se no futuro os relatórios/edge functions também precisarem — hoje só o frontend consome.

---

**Próximo passo:** aprovar este plano para que eu implemente `resolvePositionRating()` e migre as 6 telas listadas. Nenhum código foi alterado nesta rodada.