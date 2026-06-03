## Problema

No card **"Últimas Análises Aprovadas"** (DashboardPage), a análise da Brisanet aparece como uma única linha "Crédito Privado · Sell". O analista entregou **Buy para Crédito Privado** e **Sell para Ações**, e o comitê confirmou as duas trilhas — mas o card ignora isso porque:

1. A query de `analises` (linha 75) não busca `recomendacao` nem `recomendacao_rf`.
2. A coluna **Tipo** mostra `analises.tipo` (um único valor), e a **Decisão** usa `computedStatus`, que reflete a decisão **consolidada mais restritiva** (Sell). A trilha Buy de Crédito fica invisível.

## Solução

Tornar o card ciente das duas trilhas, sem mexer em backend nem em outras telas.

### 1. Query
Em `dashboard-analises` (linha 70-78), adicionar `recomendacao, recomendacao_rf` ao `select`.

### 2. Expandir linhas no `ultimasAprovadas`
Antes do `.map` do `<TableBody>` (≈ linhas 239-245 e 383), transformar cada análise em **uma ou duas linhas** conforme as trilhas presentes:

- Se `recomendacao_rf` ∈ {Buy, Hold, Sell} → linha com `tipo = "Crédito Privado"`, `decisao = recomendacao_rf`.
- Se `recomendacao` ∈ {Buy, Hold, Sell} → linha com `tipo = "Ações"`, `decisao = recomendacao`.
- Se nenhum dos dois estiver preenchido → fallback atual (`a.tipo` + `computedStatus`), preservando análises antigas.

A ordenação por `data_comite/data_conclusao` continua sendo aplicada **antes** da expansão; o `slice(0, 5)` passa a ser aplicado **depois** da expansão (para não cortar a segunda linha de uma mesma análise).

### 3. Vencimento por trilha
A regra de "Vencida" no `computedStatus` (linhas 153-167) é por análise inteira. Ao expandir, manter o mesmo `computedStatus` por linha quando o status original já é "Vencida …"; para Buy/Hold/Sell vindos das trilhas, exibir o valor da trilha diretamente (o badge usa `STATUS_BADGE_CLASS` já existente). Não há mudança na lógica de KPIs nem em outras seções.

### 4. Chave de React
Usar `key={`${a.id}-${trilha}`}` para evitar colisão quando uma mesma análise gera duas linhas.

## Fora de escopo

- KPIs (Buys/Holds/Sells, Cobertura ativa, Aprovadas no mês) — não alterados nesta passada.
- Pipeline da semana e Alertas — sem mudança.
- Schema do banco — `recomendacao` e `recomendacao_rf` já existem.
