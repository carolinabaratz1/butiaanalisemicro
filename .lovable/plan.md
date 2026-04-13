

## Diagnóstico

Existem 3 registros para MINERVA (empresa_id `67.620.377/0001-14`):

| versao | tipo | status |
|--------|------|--------|
| 1 | Crédito Privado | Aprovada |
| 2 | Crédito Privado | Em Análise |
| 1 | Ações | Pendente |

A deduplicação no Pipeline (linha 283) agrupa por `empresa_id` e mantém apenas a versão mais alta. A v2 (Crédito Privado, Em Análise) ganha, e a análise de Ações (v1) é descartada.

**Causa raiz**: O agrupamento ignora o `tipo` da análise. Crédito Privado e Ações são pipelines independentes para a mesma empresa e devem coexistir.

## Correção

### 1. Alterar deduplicação para agrupar por `empresa_id + tipo`

Na linha 283 de `PipelineResearchPage.tsx`, trocar a chave do `Map` de `a.empresa_id` para `${a.empresa_id}::${a.tipo}`. Isso garante que análises de tipos diferentes não se sobrescrevem.

### 2. Corrigir `handleCriar` — auto-incrementar versão por empresa+tipo

No handler de criação (linha 344), antes de inserir, buscar `MAX(versao)` filtrando por `empresa_id` **e** `tipo`, e definir `versao = max + 1`.

### 3. Corrigir handler "Reabrir" — mesma lógica de versão

Nos botões "Reabrir" (linhas ~706 e ~854), calcular `novaVersao` com base no max existente para aquele `empresa_id + tipo`, em vez de apenas `item.versao + 1`.

### 4. Corrigir dado existente (data fix)

Atualizar a análise Pendente de Ações (`0c80ab06...`) para `versao = 1` (já está correta neste caso, pois é a primeira de Ações). Nenhuma correção de dados é necessária — o problema é puramente de lógica de exibição.

### Arquivos modificados
- `src/pages/PipelineResearchPage.tsx` (deduplicação + handleCriar + reabrir)

