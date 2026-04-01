

## Plano: Implementar Autenticação com Login e Senha

### Objetivo
Proteger o sistema com login obrigatório. Apenas os usuários cadastrados em "Configurações > Usuários do Sistema" poderão acessar o ResearchDesk.

### Estrutura do Banco de Dados

**1. Tabela `profiles`** (vincula auth.users aos perfis do sistema)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  funcao TEXT NOT NULL DEFAULT 'Consulta',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- RLS: usuários autenticados podem ler todos os perfis, mas só editar o próprio
- Trigger: cria perfil automaticamente no signup

**2. Tabela `user_roles`** (segurança de roles conforme boas práticas)
```sql
CREATE TYPE app_role AS ENUM ('Gestor', 'Analista', 'Risco e Compliance', 'Consulta');
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
```
- Função `has_role()` SECURITY DEFINER para verificações em RLS

**3. Edge Function `create-user`** (para o Gestor cadastrar novos usuários)
- Recebe email, nome, senha, função
- Usa `supabase.auth.admin.createUser()` com auto-confirm
- Insere na `profiles` e `user_roles`
- Apenas Gestores podem chamar

### Front-End

**4. Página de Login** (`src/pages/LoginPage.tsx`)
- Formulário de email + senha no estilo dark mode do sistema
- Logo/branding "ResearchDesk" + "Butia Investimentos"
- Mensagens de erro claras
- Sem opção de cadastro público (apenas admin cria contas)

**5. Refatorar `AuthContext.tsx`**
- Integrar com Supabase Auth (`onAuthStateChange` + `getSession`)
- Ao autenticar, buscar perfil na tabela `profiles` para obter nome e função
- Manter a mesma interface `useAuth()` (currentUser, permissions, hasAccess)
- Estado de loading enquanto verifica sessão

**6. Proteger rotas em `App.tsx`**
- Se não autenticado → redireciona para `/login`
- Rota `/login` pública, todas as demais protegidas
- Remover o seletor de usuário do header (substituir por nome do usuário logado + botão logout)

**7. Atualizar `AppLayout.tsx`**
- Remover o dropdown de troca de usuário
- Exibir nome e função do usuário logado
- Adicionar botão de logout

**8. Atualizar `ConfiguracoesPage.tsx`**
- Buscar usuários da tabela `profiles` (não mais do arquivo estático)
- Gestor pode criar novo usuário (chama edge function `create-user`)
- Gestor pode alterar função de usuários existentes

**9. Seed inicial dos 14 usuários**
- Script via edge function para criar os 14 usuários com senha padrão temporária
- Cada usuário deverá trocar a senha no primeiro acesso (ou o Gestor define as senhas)

### Arquivos criados/modificados
- **Criados**: `src/pages/LoginPage.tsx`, `supabase/functions/create-user/index.ts`
- **Modificados**: `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/pages/ConfiguracoesPage.tsx`
- **2 migrations SQL**: tabelas `profiles`, `user_roles` + triggers + RLS

### Fluxo do usuário
1. Acessa o sistema → vê tela de login
2. Insere email e senha → autenticado → redirecionado ao Dashboard
3. Vê apenas as seções permitidas pelo seu perfil (RBAC existente mantido)
4. Gestor pode criar/gerenciar usuários em Configurações

