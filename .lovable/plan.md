

## Plano: Migrar Pipeline para usar tabela `empresas` do banco de dados

### Problema
O Pipeline de Research usa o arquivo estático `src/data/emissores.ts` para resolver nomes de empresas. Isso causa:
- Empresas sem nome (mostra apenas CNPJ) — quando o CNPJ existe no banco mas não no arquivo estático
- Nomes antigos/abreviados — o arquivo estático nunca foi atualizado com os nomes completos da base atualizada
- A lista "Nova Análise" mostra empresas do arquivo estático, não do banco

### Causa raiz
A função `getEmissorNome(cnpj)` na linha 38 busca no array `emissores` importado de `src/data/emissores.ts`. O campo `analises.empresa_id` armazena o **CNPJ** da empresa. A resolução do nome precisa ser feita contra a tabela `empresas` do banco.

### Mudanças em `src/pages/PipelineResearchPage.tsx`

**1. Substituir import estático por query ao banco**
- Remover `import { emissores, emissoes } from '@/data/emissores'`
- Adicionar query: `supabase.from('empresas').select('id, nome, cnpj, tipo, setor, rating, grupo_economico')`
- Criar um `Map<cnpj, nome>` a partir dos resultados para lookup rápido

**2. Reescrever `getEmissorNome`**
- Receber o Map como parâmetro (ou usar via closure)
- Buscar nome pelo CNPJ no Map do banco em vez do array estático

**3. Atualizar formulário "Nova Análise"**
- Listar empresas do banco (query `empresas`) em vez de `emissores.filter(...)`
- Manter o CNPJ como valor do select (para compatibilidade com `empresa_id`)

**4. Atualizar busca por ISIN/ticker**
- A função `getEmissaoTicker` (linha 41-43) usa `emissoes` estático — substituir por query à tabela `emissoes` do banco

### Mudanças em `src/pages/EmpresaDetailPage.tsx`
- Mesmo tratamento: remover import estático e usar dados do banco

### Arquivos modificados
- `src/pages/PipelineResearchPage.tsx`
- `src/pages/EmpresaDetailPage.tsx`

