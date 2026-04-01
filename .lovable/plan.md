

## Plano: Criar função "Coordenação/Especialista"

### O que muda

Nova função com permissões quase idênticas ao Gestor, mas **sem acesso a Configurações** e **sem gestão de usuários**. Pode receber análises (como Analista) e também atribuir análises a outros analistas.

### 1. Migration SQL -- Adicionar valor ao enum `app_role`

```sql
ALTER TYPE public.app_role ADD VALUE 'Coordenação/Especialista';
```

### 2. `src/data/users.ts` -- Expandir tipo e permissões

- Adicionar `'Coordenação/Especialista'` ao type `UserRole`
- Adicionar entrada em `rolePermissions`:

```text
'Coordenação/Especialista': {
  sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', 
             '/credito/corporativo', '/credito/estruturado', '/acoes', '/analistas'],
  canWrite: true,
  canManageUsers: false,        // diferença do Gestor
  canViewAllDashboards: true,
  canApproveAnalyses: true,
  canCreateAnalyses: true,
  canEditOthersAnalyses: true,  // pode atribuir análises
}
```

Sem `/configuracoes` nas sections e `canManageUsers: false`.

### 3. `src/pages/ConfiguracoesPage.tsx` -- Incluir opção no dropdown de funções

Adicionar "Coordenação/Especialista" na lista de funções disponíveis ao criar ou alterar usuários.

### 4. `supabase/functions/create-user/index.ts` e `manage-user/index.ts`

Incluir `'Coordenação/Especialista'` na validação de funções aceitas. No `manage-user`, permitir que Coordenação/Especialista também execute ações de atribuição (já que `canEditOthersAnalyses: true` governa isso no frontend).

### 5. `src/pages/PipelineResearchPage.tsx` -- Permissões de ações

Verificar que a lógica de ações (criar análise, atribuir analista, aprovar) use as flags de `permissions` e não compare diretamente com `funcao === 'Gestor'`. Se houver comparações hardcoded, substituir pelas flags corretas.

### Arquivos modificados
- 1 migration SQL (ALTER TYPE)
- `src/data/users.ts`
- `src/pages/ConfiguracoesPage.tsx`
- `supabase/functions/create-user/index.ts`
- `supabase/functions/manage-user/index.ts`
- `src/pages/PipelineResearchPage.tsx` (se necessário)

### Resultado
Gestores poderão atribuir a função "Coordenação/Especialista" a usuários. Esses usuários terão acesso completo ao sistema exceto Configurações, poderão receber e atribuir análises, e aprovar/reprovar análises.

