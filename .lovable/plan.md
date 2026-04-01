

## Plano: Senha de primeiro acesso + Reset pelo Gestor

### Contexto
Hoje o Gestor cria o usuário com uma senha definitiva. O pedido é:
1. A senha criada pelo Gestor ser **temporária** — o usuário é obrigado a trocá-la no primeiro login
2. O Gestor poder **resetar a senha** de qualquer usuário (criar nova senha temporária), funcionando como "desbloqueio"

### Como funciona

**Flag `must_change_password`**: adicionar coluna na tabela `profiles` (default `true`). Quando o Gestor cria um usuário ou reseta a senha, o valor é `true`. Quando o usuário troca a senha, o valor passa para `false`.

### Mudanças

**1. Migration: adicionar coluna `must_change_password` em `profiles`**

```sql
ALTER TABLE public.profiles 
ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;

-- Usuários existentes já trocaram senha, marcar como false
UPDATE public.profiles SET must_change_password = false;
```

**2. Atualizar Edge Function `create-user`**

Após criar o usuário, garantir que `must_change_password = true` já está setado (o default da coluna cuida disso, sem mudança necessária na função).

**3. Adicionar ação "Resetar Senha" na Edge Function `manage-user`**

Nova action `reset-password`:
- Recebe `userId` e `newPassword`
- Usa `adminClient.auth.admin.updateUserById(userId, { password: newPassword })`
- Atualiza `profiles.must_change_password = true`
- Retorna sucesso

**4. Tela de troca de senha obrigatória (`src/pages/ChangePasswordPage.tsx`)**

- Formulário simples: nova senha + confirmação
- Chama `supabase.auth.updateUser({ password: novaSenha })`
- Após sucesso, atualiza `profiles.must_change_password = false` e redireciona para o dashboard

**5. Interceptar login no `AuthContext.tsx`**

- O `fetchProfile` já traz os dados do perfil. Adicionar `must_change_password` ao estado
- No `App.tsx`, se o usuário está logado e `must_change_password === true`, redirecionar para `/trocar-senha` independente da rota

**6. Botão "Resetar Senha" na página Configurações**

- Na tabela de usuários, adicionar botão (ícone de chave) visível apenas para Gestor
- Ao clicar, abre dialog pedindo a nova senha temporária
- Chama `manage-user` com action `reset-password`
- Toast confirma: "Senha resetada. O usuário deverá trocá-la no próximo login."

### Arquivos modificados
- 1 migration SQL (coluna `must_change_password`)
- `supabase/functions/manage-user/index.ts` (nova action `reset-password`)
- `src/pages/ChangePasswordPage.tsx` (novo)
- `src/contexts/AuthContext.tsx` (expor `must_change_password`)
- `src/App.tsx` (rota `/trocar-senha` + redirect guard)
- `src/pages/ConfiguracoesPage.tsx` (botão resetar senha)

