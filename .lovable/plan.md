

## Plano: Atualizar base de empresas + adicionar Grupo Econômico

### Contexto
O arquivo Excel contém 164 empresas com dados completos incluindo **Grupo Econômico** — coluna que não existe ainda no banco. Vários nomes estão diferentes (abreviados no banco vs. completos no Excel). Preciso sincronizar tudo.

### Mudanças

**1. Migration: adicionar coluna `grupo_economico`**

```sql
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS grupo_economico text;
```

**2. Atualizar dados via script SQL (insert tool)**

Para cada uma das 164 empresas do Excel, executar UPDATE por CNPJ atualizando: `nome`, `grupo_economico`, `tipo`, `setor`, `rating`. Empresas que não existem no banco serão inseridas.

Isso corrige nomes abreviados (ex: "COSMGA" → "COMPANHIA DE SANEAMENTO DE MINAS GERAIS COPASA MG") e popula o grupo econômico para todas.

**3. Atualizar `EmpresasPage.tsx`**

- Adicionar coluna "Grupo Econômico" na tabela
- Adicionar campo "Grupo Econômico" no formulário de criação
- Adicionar filtro por Grupo Econômico
- Exibir grupo econômico na listagem

### Arquivos modificados
- 1 migration SQL (adicionar coluna `grupo_economico`)
- Dados atualizados via insert tool (UPDATE/INSERT por CNPJ)
- `src/pages/EmpresasPage.tsx` (coluna + filtro + form)

