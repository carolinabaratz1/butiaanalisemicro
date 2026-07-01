
# Plano — Dashboard do Fundo como Lâmina Consolidada

Refatorar `src/components/posicoes/FundoDashboard.tsx` e `src/hooks/useFundoDashboard.ts` para separar **Universo Total** de **Universo de Crédito**, eliminar o `N/D` poluído em rating/setor/grupo para ativos não elegíveis, e adicionar seção de Qualidade dos Dados. Sem tocar em importação, sidebar, FIDC Monitor ou dados existentes.

## 1. Classificador de elegibilidade (novo)

Criar `src/lib/posicoes/credit-eligibility.ts`:

```ts
export type DataQualityStatus =
  | 'ok' | 'sem_rating' | 'sem_setor' | 'sem_mapeamento' | 'nao_aplicavel';

export interface CreditClassification {
  credit_analytics_eligible: boolean;
  non_credit_reason: string | null;
  data_quality_status: DataQualityStatus;
}

export function classifyCreditEligibility(row): CreditClassification
```

Regra baseada em `product_class` (normalizado, upper, sem acento):

- **Elegíveis**: Debênture, CRI, CRA, Letra Financeira/LF, CDB, DPGE, FIDC, Nota Comercial/NC/Commercial Paper, LCA/LCI (privados com emissor identificável).
- **Não elegíveis** (`non_credit_reason = "Não aplicável para análise de crédito"`): LFT, LTN, NTN-B/F, Tesouro, Título Público, Termo, DAP, DI Future, Futuro, Compromissada, Caixa, Fundo/Cotas de Fundo (exceto FIDC), Derivativos, Opções, Swap.
- Regra de segurança: se `product_class` desconhecido mas há `cnpj_emissor` + `rating` ou `setor` → elegível. Caso contrário não elegível com razão "Tipo de ativo não classificado".

`data_quality_status` para elegíveis: `sem_rating` se rating vazio/S/R, `sem_setor` se setor vazio, `sem_mapeamento` se sem grupo/emissor, senão `ok`. Para não elegíveis: sempre `nao_aplicavel`.

## 2. Hook `useFundoDashboard` — dois universos

Adicionar ao retorno:

- `total.*` (universo total): `byTipo`, `byIndexador`, `byDuration`, `byVencimento`, `topPosicoes`, `totalPL`, `totalAtivos`, `durationMedia`.
- `credito.*` (só elegíveis): `byRating`, `bySetor`, `byGrupo`, `byEmissor`, `plCredito`, `pctCredito`, `qualidadeMedia` (rating ponderado).
- `qualidade.*`: contadores e valores por `data_quality_status` + `elegivel/nao_elegivel`, mais linhas do diagnóstico.
- `rowsClassified`: cada `DashboardRow` enriquecida com a classificação (para tabela Top Posições e filtros).

Categorias de fallback nos gráficos de crédito: `"Sem rating"`, `"Sem setor"`, `"Grupo não mapeado"` — usadas apenas quando o ativo é elegível e o campo falta. Ativos não elegíveis **não entram** nesses três gráficos.

`byTipo` e `byIndexador` continuam somando todos os ativos.

## 3. Novo layout de `FundoDashboard.tsx`

Estrutura estilo lâmina (parecido com FIDC Monitor):

```text
[ Header do fundo ]
  Nome · Data ref · Fonte BASE LOTE 45
  PL · #Ativos · Duration · Taxa média pond. · Maior posição · Rating médio (crédito)

[ Cards principais (8) ]
  PL total | #Ativos | Duration | Taxa média
  Maior concentração | Exposição crédito privado (R$) | % PL em crédito | Análises vencidas

[ Filtros globais ]
  Visão: Total / Crédito / Não aplicável
  Tipo · Indexador · Rating · Setor · Status análise · Elegível (Todos/Sim/Não)

[ Seção A — Composição Total da Carteira ]
  Subtítulo: "Base: todos os ativos da posição importada."
  - Distribuição por Tipo de Ativo (pie)
  - Distribuição por Indexador (pie)
  - Distribuição por Duration (bar)
  - Top 10 Posições (bar horizontal)

[ Seção B — Análise de Crédito ]
  Subtítulo: "Base: apenas ativos elegíveis para análise de emissor..."
  - Distribuição por Rating (bar) — só elegíveis
  - Distribuição por Setor Top 10 (bar) — só elegíveis
  - Top 10 Grupos Econômicos (bar)
  - Top 10 Emissores (bar)
  - Status das análises (donut) + Análises vencidas por exposição (bar)
  Empty state: "Este fundo não possui ativos elegíveis para análise de crédito/emissor nesta data."

[ Seção C — Qualidade dos Dados ]
  Cards: % elegível · % não aplicável · % crédito c/ rating · c/ setor · c/ grupo · s/ mapeamento
  Tabela "Diagnóstico de Cobertura": Categoria | Valor R$ | % PL | Observação
    Linhas: Elegível crédito · Não aplicável · Elegível s/ rating · s/ setor · s/ grupo · Mapeado OK

[ Tabela Top Posições do Fundo ]
  Ativo · Ticker · Tipo · Emissor · Grupo · Valor · %PL · Rating · Setor
  · Status análise · Elegível crédito? (Sim/Não) · Observação
  Para não elegíveis: Elegível=Não, Observação="Não aplicável para análise de crédito"
  Para elegíveis com faltas: badges "Sem rating"/"Sem setor"/"Grupo não mapeado"
```

Cada gráfico ganha subtítulo com a base de cálculo. Badges suaves; tooltips explicando universo. Sem `N/D` em rating/setor/grupo.

## 4. Filtros

Filtros locais controlam cards, gráficos e tabela. `Visão` alterna qual universo entra nas tabelas/Top Posições (gráficos das seções A/B mantêm seus universos fixos por definição).

## 5. Fora de escopo

- Sem mudanças em `get_posicoes_dashboard_fundo`, importadores, sidebar, FIDC Monitor.
- Sem alterar `useResolvedRating`/`resolveRatingsBatch` — usar rating já vindo da RPC. Se quiser, adicionamos `resolveRatingsBatch` para emissores elegíveis em fase 2.
- Sem persistência nova; toda classificação é derivada em runtime.

## Critérios de aceite

Todos os 13 itens da especificação (separação total/crédito, Termo/LFT/Compromissada/DAP/Fundos BR fora dos gráficos de rating/setor/grupo, seção Qualidade, tabela Top Posições com coluna Elegível, empty states, visual de lâmina).

## Arquivos afetados

- `src/lib/posicoes/credit-eligibility.ts` (novo)
- `src/hooks/useFundoDashboard.ts` (expandido)
- `src/components/posicoes/FundoDashboard.tsx` (reescrito por seções)
- possivelmente `src/components/posicoes/FundoDashboardFilters.tsx` e `TopPosicoesTable.tsx` (extração para manter arquivos focados)
