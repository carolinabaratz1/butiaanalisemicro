

## Plano: Dropdown de analistas dinâmico (do banco de dados)

### Problema
O dropdown "Analista Responsável" no formulário "Nova Análise" usa dados estáticos de `src/data/analistas.ts`. Deveria buscar os usuários reais cadastrados no banco com função Analista ou Coordenação/Especialista.

### Solução

**No `src/pages/PipelineResearchPage.tsx`:**

1. Adicionar query ao Supabase para buscar profiles com `funcao IN ('Analista', 'Coordenação/Especialista')` e `status = 'Ativo'`
2. Remover import de `analistas as catalogoAnalistas` de `src/data/analistas.ts`
3. Substituir `catalogoAnalistas` e `analistasAtivos` pelos dados do Supabase
4. Atualizar `getAnalistaNome` para usar os profiles do banco (já que a tabela `analises` armazena o nome do analista em `analista_responsavel` como texto, fazer lookup por nome ou id)

**No `src/pages/EmpresaDetailPage.tsx`:**

1. Mesma abordagem: buscar profiles do Supabase em vez de usar `users` estático
2. Incluir Coordenação/Especialista no filtro

### Detalhes técnicos
- Query: `supabase.from('profiles').select('id, nome, email, funcao').in('funcao', ['Analista', 'Coordenação/Especialista']).eq('status', 'Ativo')`
- O campo `analista_responsavel` nas análises armazena o nome do analista como texto; o dropdown passará o nome ao criar análise (mantendo compatibilidade)
- Funções `getAnalistaNome` e `getAnalistaInitials` usarão os profiles do banco

### Arquivos modificados
- `src/pages/PipelineResearchPage.tsx`
- `src/pages/EmpresaDetailPage.tsx`

