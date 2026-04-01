

## Plano: Criar usuário Gestor para vandeirgontijo@butiainvestimentos.com.br

### O que será feito
Executar um script que cria o usuário `vandeirgontijo@butiainvestimentos.com.br` no sistema de autenticação com perfil **Gestor**, usando a API admin do backend. O trigger existente (`handle_new_user`) criará automaticamente o registro nas tabelas `profiles` e `user_roles`.

### Detalhes
- **Email**: vandeirgontijo@butiainvestimentos.com.br
- **Nome**: Vandeir Gontijo (extraído da lista de analistas existente)
- **Função**: Gestor
- **Senha temporária**: `Butia@2025` (mesma padrão — pode ser alterada depois)
- O trigger `handle_new_user` já cria automaticamente o perfil e o role

### Execução
1. Script Python usando a API admin do backend para criar o usuário com `email_confirm: true`
2. Verificar que o perfil foi criado corretamente na tabela `profiles`

### Resultado
Você poderá fazer login imediatamente com:
- **Email**: vandeirgontijo@butiainvestimentos.com.br
- **Senha**: Butia@2025

