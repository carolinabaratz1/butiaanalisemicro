

## Plano: Corrigir lógica de `temPosicaoAtiva` para usar tabela `emissoes`

### Problema
A função `temPosicaoAtiva` usa correspondência por nome (`posicoes.product` vs `emissores.nomeAbreviado`) que é frágil e só encontra ~2 matches. O correto é usar a cadeia: `posicoes.isin` → `emissoes.isin` → `emissoes.cnpj_emissor` → `analises.empresa_id`.

### Solução em `src/pages/PipelineResearchPage.tsx`

**1. Buscar CNPJs com posição ativa via emissões**
Substituir a query `posicoes-empresas-ativas` que busca `posicoes.product` por uma que:
1. Busca todos os ISINs distintos da tabela `posicoes`
2. Cruza com a tabela `emissoes` para obter os `cnpj_emissor` correspondentes
3. Retorna o set de CNPJs com posição ativa

**2. Simplificar `temPosicaoAtiva`**
A função passa a simplesmente verificar se o CNPJ da empresa está no set de CNPJs com posição ativa:
```
temPosicaoAtiva(cnpj) → cnpjsComPosicao.includes(cnpj)
```

Sem fuzzy matching, sem dependência do arquivo estático `emissores.ts`.

### Resultado esperado
~42 análises em "Vencida c/ Alocação" e ~23 em "Vencida s/ Alocação", conforme a análise prévia.

