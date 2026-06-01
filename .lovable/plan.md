# Decisão do Comitê — Crédito e Ações separadamente

## Problema identificado

Na análise da Brisanet, o analista entregou duas recomendações na mesma análise:
- **Crédito Privado (RF):** Buy
- **Ações:** Sell

Hoje, ao abrir o modal **"Decisão do Comitê"** em `PipelineResearchPage.tsx`, o usuário só pode escolher **um** valor (Buy / Hold / Sell). Esse único valor é salvo em `analises.status` e os campos `recomendacao` (Ações) e `recomendacao_rf` (Crédito) **não são atualizados** — então o comitê acaba sobrescrevendo o "status geral" com apenas um lado da decisão (no caso, Sell), e a recomendação Buy do analista para Crédito fica perdida visualmente (cartão mostra Sell).

Causa raiz (linhas 443-469 de `PipelineResearchPage.tsx` e modal nas linhas 1293-1350): o `handleComite` grava apenas `status: comiteDecisao` + `data_comite` e ignora a coexistência de Ações + Crédito na mesma análise.

## Solução proposta

Tornar o modal do Comitê **ciente das duas trilhas** quando a análise contempla ambas (`recomendacao` e `recomendacao_rf` preenchidos pelo analista):

1. **Modal "Decisão do Comitê"**
   - Se a análise tem **apenas uma trilha**: comportamento atual (um único select Buy/Hold/Sell).
   - Se a análise tem **as duas trilhas** (Ações + Crédito):
     - Exibir **dois selects** lado a lado, pré-preenchidos com a recomendação do analista:
       - "Decisão Crédito Privado" → default = `recomendacao_rf`
       - "Decisão Ações" → default = `recomendacao`
     - Mensagem do header: "Recomendação do analista — CP: Buy / AÇ: Sell. Confirme ou altere."
   - Campo **Data do Comitê** continua obrigatório.
   - Campo **Justificativa** passa a ser obrigatório quando **qualquer uma** das decisões for `Sell` (rótulo: "Justificativa (obrigatória para Sell)").

2. **`handleComite` (gravação)**
   - Atualizar `analises.recomendacao` e `analises.recomendacao_rf` com a decisão final do comitê (sobrescrevendo a do analista quando o comitê alterar).
   - `analises.status` passa a refletir a **decisão consolidada**:
     - Se ambas existem → usar a **mais restritiva** para o badge geral (Sell > Hold > Buy). O status detalhado por trilha continua disponível via os dois campos.
     - Se só uma trilha → `status` = a decisão dessa trilha (comportamento atual).
   - Gravar `data_comite` e, quando houver Sell em alguma trilha, `justificativa_rejeicao`.

3. **Audit trail (`pipeline_eventos`)**
   - Registrar **um evento por trilha** quando houver duas decisões, com `comentario` indicando a trilha (ex.: `"CP: Buy"`, `"AÇ: Sell — <justificativa>"`), `acao = aprovado|reprovado` conforme cada decisão, e a mesma `data_comite`.

4. **Exibição nos cartões/Kanban e drawer**
   - As badges `CP: ...` e `AÇ: ...` (linhas 671-679, 834-836) já leem `recomendacao` / `recomendacao_rf`, então passarão a mostrar a decisão final do comitê automaticamente após o ajuste no `handleComite`.
   - O badge principal de status do cartão continuará usando a regra "mais restritiva" definida acima.

5. **Botão "Comitê" verde no cartão (linhas 734, 887)**
   - Hoje ele já abre o modal pré-selecionando `Buy`. Passará a abrir o novo modal de 2 selects quando a análise tiver as duas trilhas, ambos pré-selecionados com a recomendação do analista (que é o caso da Brisanet → vem CP=Buy, AÇ=Sell).
   - O botão "Reprovar" (linhas 741, 1041) continuará forçando Sell em todas as trilhas presentes, com justificativa obrigatória.

## Arquivos a alterar

- `src/pages/PipelineResearchPage.tsx`
  - Estado: substituir `comiteDecisao` por `comiteDecisaoRf` e `comiteDecisaoAcoes` (ambos opcionais; usados conforme trilhas presentes na análise).
  - Modal (≈1293-1350): renderização condicional 1 vs 2 selects.
  - `handleComite` (443-469): persistir as recomendações por trilha + status consolidado + eventos por trilha.
  - Handlers dos botões "Comitê" e "Reprovar" (734, 741, 887, 1036, 1041): inicializar os novos estados a partir das recomendações do analista.

## Fora de escopo

- Não altera schema do banco — `recomendacao` e `recomendacao_rf` já existem em `analises`.
- Não muda o fluxo do analista ao entregar a análise (modal de entrega já permite as duas trilhas).
- Não altera regras de "Vencida" / 1 ano.
