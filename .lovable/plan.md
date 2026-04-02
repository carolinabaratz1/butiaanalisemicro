

## Plano: Corrigir flag `must_change_password` para funcionar corretamente

### Causa raiz

A migration que adicionou a coluna `must_change_password` executou `UPDATE public.profiles SET must_change_password = false` para não afetar usuários existentes. Porém, a Laura e outros usuários foram criados **antes** da migration rodar, então foram incluídos nesse UPDATE em massa — mesmo sem nunca terem feito login.

Novos usuários criados **após** a migration devem receber `true` pelo default da coluna. Mas para garantia extra, devemos tornar isso explícito.

### Mudanças

**1. Data fix: resetar `must_change_password = true` para usuários que nunca logaram**

Usar o insert tool para atualizar a Laura (e qualquer outro usuário que o Gestor criou com senha temporária e que ainda não trocou):

```sql
UPDATE profiles SET must_change_password = true 
WHERE id = 'a7b5cdac-8d8f-487a-a2e1-2c725bf9756d';
```

Perguntar ao usuário se há outros que precisam ser resetados ou se quer resetar todos de uma vez.

**2. Tornar explícito no `create-user` edge function**

Após criar o usuário via `admin.createUser`, adicionar um update explícito garantindo que `must_change_password = true`:

```typescript
await adminClient.from('profiles').update({ must_change_password: true }).eq('id', newUser.user.id);
```

Isso protege contra cenários onde o trigger já inseriu o registro mas o default não foi respeitado por alguma razão.

**3. Tornar explícito no `handle_new_user` trigger (migration)**

Alterar o trigger para incluir `must_change_password` explicitamente na inserção:

```sql
INSERT INTO public.profiles (id, nome, email, funcao, must_change_password)
VALUES (..., true);
```

### Arquivos modificados
- 1 data update (via insert tool) — corrigir Laura
- `supabase/functions/create-user/index.ts` — update explícito
- 1 migration SQL — atualizar trigger `handle_new_user`

