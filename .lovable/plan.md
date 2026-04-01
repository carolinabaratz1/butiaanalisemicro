

## Plano: Gestão completa de usuários + Analistas dinâmicos

### Problema 1: Gestor não consegue alterar função nem excluir usuário
- **Alterar função**: O `handleRoleChange` atualiza apenas `profiles.funcao`, mas a RLS de `profiles` só permite UPDATE onde `auth.uid() = id` (o próprio usuário). Gestor não consegue alterar outros.
- **Excluir**: Não existe funcionalidade de exclusão/desativação na UI nem no backend.
- A tabela `user_roles` também precisa ser atualizada junto com `profiles.funcao`.

### Problema 2: Aba Analistas usa dados estáticos
A `AnalistasPage` importa de `src/data/analistas.ts` (hardcoded). Deveria buscar os usuários com função "Analista" do banco (`profiles`) e contar análises da tabela `analises`.

---

### Solução

**1. Edge Function `manage-user` (nova)**
Criar edge function que permite ao Gestor:
- **Alterar função**: Atualiza `profiles.funcao` + `user_roles.role` usando service role (bypass RLS)
- **Desativar usuário**: Atualiza `profiles.status` para "Inativo" + desabilita o auth user via admin API
- **Reativar usuário**: Inverso da desativação

Valida que o caller é Gestor antes de executar.

**2. Migration: RLS para DELETE em `user_roles`**
Adicionar policy de DELETE em `user_roles` para permitir a troca de role (delete old + insert new).

**3. Atualizar `ConfiguracoesPage.tsx`**
- `handleRoleChange`: Chamar a edge function `manage-user` com action `change-role` em vez de update direto
- Adicionar botão de desativar/reativar usuário em cada linha (apenas para Gestores)
- Adicionar confirmação antes de desativar

**4. Refatorar `AnalistasPage.tsx`**
- Remover imports de `analistas.ts` e `historicoAnalises.ts`
- Buscar do Supabase: `profiles` com `funcao = 'Analista'` (ativos e inativos)
- Contar análises por analista: query em `analises` agrupando por `analista_responsavel`
- KPIs dinâmicos: total, ativos (`status = 'Ativo'`), ex-analistas (`status = 'Inativo'`)

### Arquivos
- **Novo**: `supabase/functions/manage-user/index.ts`
- **Migration**: Policy DELETE em `user_roles`
- **Modificados**: `src/pages/ConfiguracoesPage.tsx`, `src/pages/AnalistasPage.tsx`

### Resultado
- Gestor pode alterar função e desativar/reativar usuários
- Aba Analistas reflete os usuários reais cadastrados no sistema
- Contagem de análises vem do banco de dados

