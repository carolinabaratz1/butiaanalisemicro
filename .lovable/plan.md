## Objetivo

Padronizar como quatro tipos especiais de ativo aparecem nas visões de posição (aba **Posições** e aba **Trade Monitor → Alocação**), para que Termo, Overnight, LFT e DAP Futuro deixem de "poluir" as agregações por emissor / grupo econômico / rating e sigam regras de negócio explícitas.

## Regras de negócio (o que vai passar a valer)

| Tipo (product_class) | Grupo econômico | Emissor | CNPJ usado | Rating exibido | Conta no PL? |
|---|---|---|---|---|---|
| Termo | TERMO | B3 | 09.346.601/0001-25 | Rating de B3 (hoje AAA) | Sim |
| Overnight | CAIXA | TESOURO NACIONAL | 00.000.000/0001-91 | Soberano | Sim |
| LFT | CAIXA | TESOURO NACIONAL | 00.000.000/0001-91 | Soberano | Sim |
| DAP Future | — | — | — | — | Não (excluído) |

Hoje esses ativos aparecem como "Emissor não mapeado" / "Grupo não mapeado" na aba Exposição por Grupo/Emissor, e Overnight/LFT são agrupados como "Tesouro Nacional" (não CAIXA) na Alocação. DAP Future já é excluído na Alocação, mas ainda entra em contagens da página Posições.

## O que muda na aplicação

Toda a lógica passa a viver em um único utilitário compartilhado, para que as duas telas consumam a mesma regra.

1. **Novo helper `synthesizeIssuerFromProduct(product, product_class)`** em `src/components/alocacao/allocationUtils.ts`, retornando (quando aplicável) um "emissor sintético": `{ cnpj, nome, grupoEconomico, setor, rating, ratingLabel, isSoberano, excluded }`. Reaproveita as funções `isTermo`, `isExcludedFromPL`, `isTesouroNacional` já existentes.

2. **Aba Posições – tabela e painéis BI** (`src/pages/PosicoesPage.tsx`)
   - Ao enriquecer cada posição, se o helper devolver um emissor sintético, sobrescrever `cnpj`, `empresaNome`, `empresaRating` (usando "Soberano" para Overnight/LFT e o rating real de B3 para Termo) e um novo campo `grupoEconomico`.
   - DAP Future: filtrar da lista `enriched` antes das agregações (contadores, gráficos, drill-downs, exportações). Deixa de aparecer em "Total de posições", "Distribuição por classe/fundo", "Duration", etc.
   - Termo/Overnight/LFT continuam classificados como `isNonAnalyzable` (não exigem análise de research), mas agora têm emissor/rating preenchidos.

3. **Aba Posições – Exposição por Grupo / Emissor** (`src/components/posicoes/useExposicaoData.ts`)
   - Antes de resolver `empresaByCnpj`, aplicar o helper. Quando houver emissor sintético, injetar uma empresa virtual (Termo→B3 real via CNPJ da B3; Overnight/LFT→Tesouro Nacional real via CNPJ 00.000.000/0001-91) e usar `grupoEconomico` "TERMO" ou "CAIXA".
   - Rating: para Overnight/LFT forçar rótulo "Soberano" no `ResolvedRating` (source "emissor") — não usa `ratingBucket` numérico; Termo herda o rating real da B3.
   - DAP Future: descartar já em `posicoes` (nem soma no PL do fundo nem entra em nenhum agregado).

4. **Trade Monitor → Alocação** (`src/components/alocacao/useAllocationData.ts`)
   - Substituir a lógica ad-hoc atual (que já sintetiza Tesouro Nacional e "Termo (B3)") por uma chamada ao mesmo helper.
   - Grupo econômico de Overnight/LFT passa de "Tesouro Nacional" para **CAIXA**.
   - Grupo econômico de Termo passa de "Termo (B3)" para **TERMO**, mantendo o emissor B3 e o rating real de B3.
   - Rating exibido de Overnight/LFT vira **Soberano** (com badge próprio); o bucket usado internamente para limites continua "AAA" para não quebrar `worstRating`.
   - `isExcludedFromPL` continua tratando DAP/Futuros (comportamento atual mantido).

5. **Badge de rating "Soberano"** — pequeno ajuste em `RatingBadge` para reconhecer o rótulo "Soberano" e exibi-lo com estilo neutro/positivo (não misturar com escala AAA/AA/etc.). Aplicado só onde o helper marcar `isSoberano`.

## Não-escopo

- Nenhuma alteração no importador de posições nem na tabela `posicoes` (as regras são aplicadas em runtime, sem migração).
- Nenhuma mudança em `empresas` ou `issuer_ratings` — B3 e Tesouro Nacional já existem.
- Notional de DAP Futuro fica de fora, conforme pedido.

## Verificação após implementar

- Aba Posições → tabela principal: filtrar por `product_class = Termo`, `Overnight`, `LFT` e confirmar emissor/grupo/rating conforme tabela acima; confirmar que `DAP Future` sumiu dos totais e gráficos.
- Aba Posições → Exposição por Grupo / Emissor: aparecem os grupos "TERMO" e "CAIXA"; contadores de "Emissor não mapeado" / "Grupo não mapeado" diminuem.
- Trade Monitor → Alocação → painel por grupo: Overnight/LFT aparecem sob "CAIXA" com badge "Soberano"; Termo sob "TERMO" com rating de B3; DAP Future segue fora.
