

## Plano: CRUD de Empresas com banco de dados + edição de Rating

### Problema atual
A página Empresas lê dados estáticos de `src/data/emissores.ts`. A tabela `empresas` já existe no banco com 141 registros, mas não é usada na listagem. Não há funcionalidade para criar empresa nem editar rating.

### Mudanças

**1. Migrar listagem para o banco de dados**

Em `src/pages/EmpresasPage.tsx`:
- Substituir `import { emissores }` por query ao Supabase: `supabase.from('empresas').select('*')`
- Adaptar os campos: `nome` (era `nomeAbreviado`), `cnpj`, `setor` (era `setorButia`), `rating` (era `ratingAtual`)
- O campo `tipo` não existe na tabela `empresas` -- será necessário adicionar via migration

**2. Migration: adicionar campo `tipo` à tabela empresas**

```sql
ALTER TABLE empresas ADD COLUMN tipo text DEFAULT 'CORPORATIVO';
```

Depois popular os tipos a partir dos dados estáticos existentes (UPDATE por CNPJ).

**3. Botão "+ Nova Empresa" com Dialog/formulário**

Campos do formulário:
- Nome (obrigatório)
- CNPJ (obrigatório, único)
- Tipo (select: FINANCEIRO, CORPORATIVO, FIDC, CRA, CDB, Fundo)
- Setor (input texto)
- Rating (input texto)

Ao salvar: `supabase.from('empresas').insert(...)` + invalidar query + toast de sucesso.

**4. Edição inline de Rating**

Na tabela, a célula de Rating terá um botão de edição (ícone lápis). Ao clicar, abre um pequeno popover/input para digitar o novo rating. Ao confirmar: `supabase.from('empresas').update({ rating }).eq('id', empresa.id)` + invalidar query.

**5. Permissões**

- Criar empresa: apenas Gestor e Coordenação/Especialista
- Editar rating: apenas Gestor e Coordenação/Especialista

### Arquivos modificados
- 1 migration SQL (adicionar coluna `tipo` + popular dados)
- `src/pages/EmpresasPage.tsx` (reescrever para usar DB + adicionar criar/editar)

