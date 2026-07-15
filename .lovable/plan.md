## Objetivo

Na aba **Atualizar Dados**, o upload da planilha deixará de sobrescrever a linha inteira de `trade_ativos`. Passará a atualizar apenas os campos que vierem preenchidos na planilha, mantendo os valores anteriores nos campos que a planilha não trouxer (ex.: rating manual, data_rating, spread_emissao já cadastrados).

As demais tabelas (`trade_taxas`, `trade_ntnb`, `trade_ipca_ref`) continuam com o upsert atual — o comportamento delas já é o esperado.

## Mudanças

### 1. Edge Function `supabase/functions/process-upload/index.ts`

Adicionar tratamento especial para `trade_ativos` na função `batchUpsert`:

- Para as outras tabelas: continua `upsert` normal (comportamento atual).
- Para `trade_ativos`:
  1. Buscar as linhas existentes desses tickers (`select * where ticker in (...)`).
  2. Para cada linha nova, fazer merge: para cada campo, se o valor vindo da planilha for `null`/`undefined`/`""`, manter o valor antigo; caso contrário usar o novo.
  3. Fazer `upsert` do resultado mesclado (mantém idempotência e insere tickers realmente novos).

Isso garante que:
- Tickers novos entram normalmente.
- Tickers existentes têm somente os campos preenchidos da planilha atualizados.
- Nenhum registro é excluído.

### 2. Cliente `src/components/trade/UploadPage.tsx`

Ajuste mínimo no parser `parseTradeWorkbook`: antes de enviar cada linha de `trade_ativos`, remover chaves cujo valor seja `null`/`undefined`/`""`. Assim o payload já chega enxuto na Edge Function e o merge do lado do servidor decide o que preservar.

## Detalhes técnicos

- Chave de conflito de `trade_ativos` continua `ticker` (não muda).
- O merge é feito em lotes (usar os mesmos tickers do batch atual — sem query extra por linha).
- Fluxo `start` / `upsert` / `finish` e o recálculo de métricas permanecem iguais.
- Nada muda em `trade_taxas`, `trade_ntnb`, `trade_ipca_ref` nem nas tabelas derivadas.

## Fora de escopo

- Preservação de histórico de `trade_taxas` (upsert já é aditivo por `ticker,data`).
- Alterações em tabelas derivadas (`trade_spread_historico` etc.) — continuam sendo recalculadas.
