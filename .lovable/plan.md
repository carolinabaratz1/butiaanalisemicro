## Diagnóstico

O log mostra `issuer_ratings 0 linhas, 0 chunks, 0ms — duplicate key value violates unique constraint "issuer_ratings_unique"`. As demais 46 tabelas passaram.

Confirmado no banco de origem:
- `issuer_ratings` tem 1.408 linhas, das quais **611 têm `data_rating` e `rating_agency` simultaneamente `NULL`**.
- A constraint no destino é `UNIQUE NULLS NOT DISTINCT (cnpj, rating_agency, data_rating)`.

Sob `NULLS NOT DISTINCT`, dois registros do mesmo CNPJ com `(NULL, NULL)` colidem — a origem tolera isso apenas se a constraint de lá for diferente/inexistente ou se o mesmo CNPJ não se repetir com nulos. Ao inserir no destino em bloco (`jsonb_populate_recordset` → `INSERT`), qualquer par colide e o batch inteiro aborta — daí `0 linhas` mesmo após o `TRUNCATE`.

O `syncOneTable` faz `TRUNCATE ... RESTART IDENTITY CASCADE` corretamente; o problema é que o `INSERT` subsequente não tolera as duplicatas semânticas do próprio dataset de origem.

## Escopo

Ajustar apenas `supabase/functions/sync-external-supabase/index.ts`. Sem migração no destino (a constraint `NULLS NOT DISTINCT` é intencional para deduplicar ratings). Sem mudar UI.

## Mudança

Tornar o `INSERT` do sync tolerante a colisões de unique constraint, em **todas** as tabelas — não só `issuer_ratings`, para blindar futuras ocorrências (`emissoes`, `empresas`, etc. têm uniques equivalentes).

Substituir no `syncOneTable` (e no bloco chunk equivalente) o SQL:

```sql
INSERT INTO <t> (<cols>)
SELECT <cols> FROM jsonb_populate_recordset(NULL::<t>, $rows)
ON CONFLICT DO NOTHING
```

Adicional para transparência no relatório: capturar `result.rowCount` do driver para contar quantas linhas foram efetivamente inseridas vs. ignoradas por conflito, e expor `skipped` no `TableDetail` (opcional, apenas se trivial — caso contrário mantém só `rows` = linhas lidas da origem).

## Validação

1. Redeploy da função.
2. Disparar sync manual pela UI (Configurações → Sincronizar agora).
3. Checar log: `issuer_ratings` deve reportar ~1.408 linhas lidas, status OK. Confirmar no destino via `SELECT COUNT(*) FROM issuer_ratings`.
4. Confirmar que as demais 46 tabelas continuam OK.

## Arquivos tocados

- `supabase/functions/sync-external-supabase/index.ts` (2 blocos de INSERT: `syncOneTable` e o loop do modo chunk).
