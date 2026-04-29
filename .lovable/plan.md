## Integrar Trade Monitor com posições e análises

Conectar o Trade Monitor às tabelas internas (`posicoes`, `emissoes`, `analises`, `empresas`) para que o usuário consiga:
1. Filtrar o Dashboard por fundo das nossas posições
2. Ver Status da análise e indicador de Posição Ativa na lista de emissões
3. Ver, ao clicar numa emissão, a alocação de cada fundo naquela emissão

---

### 1. Novo hook: `useTradeIntegration`

Criar `src/hooks/useTradeIntegration.ts` que carrega, em paralelo (TanStack Query), os dados internos necessários e expõe um `Map` por `ticker`:

- **Posições** mais recentes (`val_date` máxima): `isin → [{ fundo, amount, financial_price, val_date }]`
- **Emissões**: `ticker → { isin, cnpj_emissor }` e `isin → ticker`
- **Análises** mais recentes por `(empresa_cnpj, isin)`: `ticker → { status, recomendacao, data_conclusao, data_aprovacao, prazo, id }`
  - Status efetivo derivado: se `status='Aprovada'` e `data_aprovacao + 1 ano < hoje` → `Vencida`. Caso contrário usa `status` da tabela.
- Helpers retornados:
  - `getStatus(ticker) → 'Aprovada' | 'Reprovada' | 'Pendente' | 'Em Análise' | 'Concluída' | 'Vencida' | null`
  - `hasPosition(ticker) → boolean`
  - `getAllocations(ticker) → Array<{ fundo, val_date, amount, financial_price, pct_fundo }>`
  - `getFundsList() → string[]` lista distinta dos `trading_desk_share_source` na última `val_date`
  - `getTickersByFund(fund) → Set<string>` tickers cujo ISIN tem posição naquele fundo

Esse hook é consumido por `TradeMonitorPage`, `TradeTable`, `TradeDashboard` e `TradeDetail` via props (drilling) ou contexto leve interno do módulo Trade.

---

### 2. `TradeMonitorPage` — filtro por fundo

- Adicionar estado `selectedFund: string | null` no header.
- Novo `<Select>` ao lado dos botões Dashboard/Emissões com:
  - Opção "Todos os fundos" (default)
  - Lista de fundos retornada por `getFundsList()`
- `filteredData` passa a aplicar dois filtros: `emissorCnpj` (já existe) **e** `selectedFund` (`getTickersByFund(selectedFund).has(t.ticker)`).
- Quando um fundo é selecionado, mostrar uma `Badge` "Fundo: {nome}" (clique remove filtro).
- Como `data` filtrado alimenta tanto Dashboard quanto Tabela, **todos os KPIs, gráficos e médias do Dashboard recalculam automaticamente** restritos ao universo do fundo. Cobrindo o pedido "calcular todas as informações para o fundo".
- Adicionar 1 KPI extra ao topo do Dashboard quando há fundo selecionado: **% PL alocado** (somatório `financial_price` desses tickers no fundo / total do fundo).

---

### 3. `TradeTable` — coluna Status + indicador Posição Ativa

Após a coluna **Rating** (linha 245):

- **Coluna `Status`**: badge colorido com texto:
  - `Aprovada` → verde, `Reprovada` → vermelho, `Pendente` → roxo, `Em Análise` → azul, `Concluída` → cinza-azulado, `Vencida` → âmbar, sem análise → traço
- **Coluna `Posição`**: ícone de "ponto verde + texto Ativa" se `hasPosition(ticker)`, caso contrário traço. Tooltip mostra contagem de fundos com posição.
- Adicionar 2 chips de filtro na sidebar:
  - **Status** (multi-select dos 6 valores + "S/Análise")
  - **Posição** (toggle "Apenas com posição ativa")

Status e posição vêm via prop `integration` (do hook), evitando refetch.

---

### 4. `TradeDetail` — tabela de alocação por fundo

No corpo do painel, antes do bloco "Note" (linha 242):

- Nova seção `Posições Ativas por Fundo`:
  - Se `getAllocations(ticker)` for vazio → mensagem "Sem posição ativa nesta emissão" em texto pequeno.
  - Se houver posições, renderizar uma `<table>` (estilo dos outros blocos do detail — `bg-muted border border-border`) com colunas:

```text
Fundo | Data Pos. | Quantidade | Financeiro | % do Fundo
```

  - Linhas ordenadas por `financial_price` desc.
  - Rodapé com **TOTAL** somando `amount` e `financial_price`.

- Acima dessa tabela, mostrar dois mini-metrics:
  - **Fundos com posição**: contagem distinta
  - **Total alocado**: soma de `financial_price` formatada em R$ M/K

---

### 5. Detalhes técnicos

**Queries (TanStack Query, todas com `staleTime: 5min`):**

```ts
// Posições da última val_date
supabase.from('posicoes')
  .select('isin, trading_desk_share_source, val_date, amount, financial_price')
  .eq('val_date', latestValDate)
  .not('isin','is',null);

// Emissões (mapping isin↔ticker)
supabase.from('emissoes').select('ticker, isin, cnpj_emissor');

// Última análise por empresa (por cnpj) + por isin
supabase.from('analises')
  .select('id, empresa_id, isin, status, recomendacao, data_conclusao, data_aprovacao, prazo, versao, created_at')
  .order('versao',{ascending:false});
```

A latest `val_date` é obtida via `select('val_date').order('val_date',{ascending:false}).limit(1)` e formato é `MM/DD/YYYY` (texto) — atenção ao usar `eq` com a string exata.

**Resolução status por ticker:**
1. Buscar `emissoes` com aquele `ticker` → pega `isin` e `cnpj_emissor`.
2. Procurar análise com mesmo `isin` (versão maior). Se não houver, fallback para análise da empresa (`empresa_id` = id da empresa cujo `cnpj` bate).
3. Aplicar regra de "Vencida" descrita acima.

**% do fundo** = `financial_price` da posição ÷ `Σ financial_price` das posições daquele fundo na mesma `val_date`.

**Componentes a editar/criar:**
- novo `src/hooks/useTradeIntegration.ts`
- `src/components/trade/TradeMonitorPage.tsx` — selector de fundo, filtro
- `src/components/trade/TradeTable.tsx` — colunas Status + Posição, filtros
- `src/components/trade/TradeDetail.tsx` — tabela de alocação
- (opcional) `src/components/trade/TradeDashboard.tsx` — KPI extra "% PL alocado" quando há fundo

**O que NÃO muda:**
- Layout/estilo geral, modos DI/IPCA/CDI, lógica de Z-score e gráficos existentes.
- Estrutura das tabelas Supabase (sem migration).
