
## Avaliação do fix proposto

O diagnóstico do usuário está correto e verificado:
- `useAllocationData.ts` mantinha síntese própria do "Tesouro Nacional" com CNPJ `00.000.000/0001-91`, que é literalmente o CNPJ real do **Banco do Brasil**. Como esse CNPJ existe no cadastro `empresas`, o `cnpjToEmpresa.get(...)` casava e rotulava toda posição Overnight/Compromissada/LFT sem emissor como "Banco do Brasil S.A.".
- O CNPJ correto do Tesouro (`00.394.460/0001-41`) já está em `allocationUtils.ts` dentro de `synthesizeIssuerFromProduct`, que também é usado por Posições/Exposição/Dashboard/PositionsMonitor via `resolvePositionRating`.

A troca por `synthesizeIssuerFromProduct` é a decisão certa (fonte única de verdade, mesma lógica do restante do app). Aplicar como está **já resolve o bug do card "Banco do Brasil" inflado**.

## Gaps a corrigir junto (para não abrir regressão nem deixar duplicação)

1. **LTN/NTN param de ser sintetizados.** O regex antigo incluía `lft || ltn || ntn`; o novo `synthesizeIssuerFromProduct` só reconhece `lft`, `overnight` e `compromiss`. Posições de LTN/NTN-B/NTN-F sem emissor cadastrado voltariam a cair no fallback "sem emissor" (não somam no grupo CAIXA nem no setor "Título Público"). Ampliar a função central para reconhecer também `ltn` e `ntn` (tratados como Tesouro/Soberano, mesmo bucket AAA), em vez de deixar a regra desincronizada entre os módulos.

2. **Branch `else` do arquivo do usuário ainda duplica regex.** Quando `empresa` existe, o código refaz o teste `overnight|compromiss|lft|ltn|ntn` só para marcar `isSoberanoEff`. Substituir por uma checagem única baseada em `synthesizeIssuerFromProduct(...)?.isSoberano` — assim toda a definição de "o que é soberano por produto" fica num único lugar.

3. **Aproveitar `resolvePositionRating` para o rating do bucket (linha 478).** Hoje a alocação ainda faz `isTermo(...) || isForcedAAAProduct(...) ? "AAA" : ratingBucket(posResolved?.rating ?? empresa?.rating)`. Isso funciona, mas é mais uma cópia paralela da hierarquia. Trocar por `resolvePositionRating(row, posResolved)` + `ratingBucket(res.rating)` mantém a alocação alinhada às demais telas automaticamente se uma nova regra de produto surgir.

## Plano de implementação

1. `src/components/alocacao/allocationUtils.ts`
   - Em `synthesizeIssuerFromProduct` / helpers internos: incluir `ltn` e `ntn` no mesmo grupo do Tesouro (retornando o mesmo `SyntheticIssuer` de Overnight/LFT — Tesouro Nacional, grupo CAIXA, Soberano, bucket AAA).
   - Nenhuma mudança em Termo/DPGE/Compromissada.

2. `src/components/alocacao/useAllocationData.ts` (aplicar a base do arquivo enviado, com 2 ajustes)
   - Manter a troca por `synthesizeIssuerFromProduct` para o caso `!empresaEff` (como no upload).
   - Simplificar o `else`: `const synth = synthesizeIssuerFromProduct(p.product, p.product_class); if (synth?.isSoberano) isSoberanoEff = true;` — remove o regex duplicado.
   - Substituir o cálculo de `ratingB` (linha 478) por `resolvePositionRating({ product: p.product, product_class: p.product_class, cnpj: emissao?.cnpj_emissor, isin: p.isin }, posResolved)` e derivar `ratingBucket(res.rating)`. Preserva o comportamento atual (Termo/DPGE/Compromissada → AAA, Soberano → AAA) e passa a herdar automaticamente futuras regras.

3. Verificação
   - Typecheck.
   - Query rápida em `posicoes` do fundo TOP CP na `val_date` mais recente para confirmar que as linhas com `product` contendo `LTN`/`NTN`/`Overnight`/`Compromissada` batem no bucket "Título Público"/grupo "CAIXA" e somem do card de Banco do Brasil.

## Fora de escopo

- Não mexer em `PosicoesPage`, `useExposicaoData`, `useFundoDashboard`, `PositionsMonitorPage`, `AnalyticsPage` — todos já consomem `synthesizeIssuerFromProduct`/`resolvePositionRating` e vão herdar automaticamente a extensão LTN/NTN feita no item 1.
- Não alterar rating de emissor real do Banco do Brasil (as posições legítimas dele — LF Subordinada, Termo — continuam somando no card BB).
