

## Plano: Corrigir nomes com espaços extras nos profiles

### Causa raiz
Os nomes "Carolina Baratz Weinberg" e "Diogo Vilaça Teixeira" foram cadastrados na tabela `profiles` com **espaço em branco no final** do nome. O campo `analista_responsavel` na tabela `analises` não tem esse espaço. A comparação exata (`analisesCounts[nome]`) falha por causa desse espaço invisível.

### Solução

**1. Migration SQL** -- Limpar espaços extras nos nomes existentes:
```sql
UPDATE profiles SET nome = TRIM(nome) WHERE nome != TRIM(nome);
```

**2. `src/pages/AnalistasPage.tsx`** -- Adicionar `.trim()` no matching como proteção futura:
```typescript
function getQtdAnalises(nome: string) {
  return analisesCounts[nome.trim()] || 0;
}
```

### Arquivos modificados
- 1 migration SQL (TRIM nos profiles)
- `src/pages/AnalistasPage.tsx` (trim defensivo)

### Resultado
As análises de Carolina (e Diogo) serão contabilizadas corretamente na aba Analistas.

