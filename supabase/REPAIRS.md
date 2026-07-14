# Schema Repairs — external-schema-full.sql

Auditoria completa de sintaxe SQL executada com o parser oficial do Postgres
(`libpg_query` via `pglast`). Após as correções abaixo, o arquivo inteiro
(`supabase/external-schema-full.sql`, 758 statements) faz parse limpo.

## Erros corrigidos

1. **Linha ~1550 — policy `Users can update own safe fields` em `public.profiles`**
   - Sintoma: subquery incompleta `(funcao = ( SELECT p.funcao);` — faltava `FROM ... WHERE ...`, `)` de fechamento e o restante das colunas comparadas.
   - Correção:
     ```sql
     WITH CHECK (((auth.uid() = id)
       AND (funcao = (SELECT p.funcao FROM public.profiles p WHERE p.id = auth.uid()))
       AND (status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()))));
     ```

2. **Linhas 1620–1697 — 18 policies das tabelas `trade_*` com `TO` vazio**
   - Sintoma: `AS PERMISSIVE FOR SELECT TO \n  USING (...)` → `syntax error at or near "USING"`.
   - Causa: o exportador omitiu o role padrão `public` do `pg_policies.roles`.
   - Correção: substituído `TO` vazio por `TO public` (role original das policies em `pg_policies`). Tabelas afetadas:
     `trade_ativos`, `trade_ipca_ref`, `trade_metricas`, `trade_ntnb`,
     `trade_spread_agg_diario`, `trade_spread_historico`, `trade_taxas`,
     `trade_ticker_snapshot`, `trade_upload_log` (2 policies cada = 18 total).

## Verificações realizadas

- Parênteses balanceados em **todos os 758 statements** (checagem por statement respeitando dollar-quoting `$$...$$`).
- Nenhuma policy `FOR INSERT` usa `USING` (todas usam `WITH CHECK`).
- Nenhuma subquery com `);` truncado remanescente.
- `pglast.parse_sql(<arquivo inteiro>)` → OK.

## Arquivos atualizados

- `supabase/external-schema-full.sql` (canônico)
- `supabase-external-schema-full.sql` (cópia raiz)

Execução recomendada no projeto externo: SQL Editor → colar arquivo → Run.
