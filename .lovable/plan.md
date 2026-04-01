

## Plano: Corrigir espaços extras nos nomes (profiles) -- segunda tentativa

### Causa raiz
Os nomes "Carolina Baratz Weinberg" e "Diogo Vilaça Teixeira" na tabela `profiles` ainda possuem espaço em branco no final (comprimentos 25 e 22, respectivamente, quando deveriam ser 24 e 21). O dropdown do Pipeline usa `profiles.nome` (com espaço) como valor do filtro, mas `analises.analista_responsavel` armazena o nome sem espaço. A comparação exata falha.

### Solução

**1. Migration SQL** -- Limpar espaços e prevenir recorrência:
```sql
-- Limpar espaços existentes
UPDATE profiles SET nome = TRIM(nome);

-- Adicionar trigger para prevenir espaços futuros
CREATE OR REPLACE FUNCTION trim_profile_nome()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.nome := TRIM(NEW.nome);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trim_profile_nome
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION trim_profile_nome();
```

**2. `src/pages/PipelineResearchPage.tsx`** -- Trim defensivo no filtro (linha 244):
```typescript
items = items.filter(a => a.analista_responsavel.trim() === analistaFilter.trim());
```

E na linha 241 (filtro de analista logado):
```typescript
items = items.filter(a => a.analista_responsavel.trim() === currentUser?.id);
```

### Arquivos modificados
- 1 migration SQL (TRIM + trigger preventivo)
- `src/pages/PipelineResearchPage.tsx` (trim defensivo nos filtros)

### Resultado
Filtrar por Carolina ou Diogo no Pipeline mostrará todas as análises vinculadas.

