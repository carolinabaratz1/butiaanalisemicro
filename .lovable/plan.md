

## Plano: Corrigir Pipeline versionado + Histórico de análises no detalhe da empresa

### Problemas identificados

**1. Pipeline mostra versão antiga como "Vencida" mesmo com v2 existente**

A função `isVencida()` avalia cada análise independentemente. Quando o usuário cria uma v2 via "Reabrir", a v1 original (status "Aprovada" com data antiga) continua aparecendo como "Vencida c/ Alocação". O correto é: se existe uma versão mais recente para a mesma `empresa_id`, a versão anterior não deve aparecer como vencida — deve ser tratada como registro histórico e ocultada do pipeline ativo.

**2. Histórico de análises usa dados estáticos**

A aba "Histórico de Análises" em `EmpresaDetailPage.tsx` (linha 105) lê de `historicoAnalises` importado de `src/data/historicoAnalises.ts` — um arquivo estático com 145+ registros. Análises criadas no sistema (tabela `analises`) não aparecem neste histórico. Por isso a v2 do FIDC Chemical XIV não é exibida.

**3. Contagem de "Análises Ativas" inclui versões antigas**

A query em `EmpresasPage.tsx` (linha 54-68) conta todas as análises que não são "Concluído/Rejeitado/Reprovado" por `empresa_id`. Análises "Aprovada" antigas (que são vencidas) entram na contagem porque o status no banco ainda é "Aprovada". Isso infla o número.

### Mudanças

**1. Filtrar versões supersedidas no Pipeline (`PipelineResearchPage.tsx`)**

No `useMemo` que calcula `analisesComStatus` (linha 272), após mapear os display statuses, filtrar análises que foram supersedidas: para cada `empresa_id`, se existem múltiplas versões, manter apenas a de maior `versao` no pipeline ativo. As versões anteriores ficam acessíveis apenas no histórico da empresa.

```text
Lógica:
- Agrupar por empresa_id
- Para cada grupo, manter apenas a análise com maior versao
- Exceção: se a versão mais recente está em status terminal
  (Reprovada) e a anterior é Aprovada/Vencida, ambas aparecem
```

**2. Migrar histórico para tabela `analises` do banco (`EmpresaDetailPage.tsx`)**

- Remover import de `historicoAnalises` e `useAnaliseEmissao`
- Adicionar query: `supabase.from('analises').select('*').eq('empresa_id', decodedCnpj).order('versao', { ascending: false })`
- Renderizar TODAS as versões no histórico (v1, v2, etc.) com data, status, analista, versão
- O histórico agora inclui tanto os registros importados da base histórica quanto as novas análises criadas no sistema

**3. Corrigir contagem de análises ativas (`EmpresasPage.tsx`)**

Ajustar a query para excluir também status "Aprovada" com `data_conclusao` mais antiga que 1 ano (vencidas), ou filtrar apenas versões mais recentes por empresa.

### Arquivos modificados
- `src/pages/PipelineResearchPage.tsx` (filtrar versões supersedidas)
- `src/pages/EmpresaDetailPage.tsx` (migrar histórico para DB)
- `src/pages/EmpresasPage.tsx` (corrigir contagem)

