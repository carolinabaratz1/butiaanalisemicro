# PLAN — Histórico Canônico de Ratings de Emissores (v2)

## Ajustes incorporados

1. **UNIQUE constraint** — Postgres do projeto é **17.6**, suporta `NULLS NOT DISTINCT` (PG ≥ 15). Vamos usar a forma nativa, sem `COALESCE`:
   ```sql
   UNIQUE NULLS NOT DISTINCT (cnpj, agencia, data_rating)
   ```
2. **Seed sem data enganosa** — `data_rating = NULL` para os ~611 registros legados. `observacao = 'Importação legada do cadastro de empresas (data original desconhecida)'`. Badge mostrará "sem data" em vez de fingir oficialidade.

## Confirmações prévias mantidas

- `trade_ativos` **não tem `agencia`** → resolução por ticker devolve `agencia=NULL`. OK por ora; adicionar coluna fica fora desta migration.
- Trigger espelho `empresas.rating` marcado **temporário** via `COMMENT ON TRIGGER`.
- `RatingBadge` com `source='grupo'` recebe visual diferenciado (outline tracejada + ícone Sparkles + sufixo "≈") indicando estimativa.

## Migration (única, sequencial)

### 1. Tabela `issuer_ratings`

```text
id              uuid PK default gen_random_uuid()
cnpj            text NOT NULL          -- normalizado (só dígitos) via trigger
rating          text NOT NULL
agencia         text NULL
data_rating     date NULL
outlook         text NULL
observacao      text NULL
report_url      text NULL
created_by      uuid NULL              -- profiles.id (sem FK rígida)
created_at      timestamptz NOT NULL default now()
updated_at      timestamptz NOT NULL default now()

CONSTRAINT issuer_ratings_unique UNIQUE NULLS NOT DISTINCT (cnpj, agencia, data_rating)
INDEX (cnpj, data_rating DESC NULLS LAST, created_at DESC)
```

- GRANTs: `SELECT/INSERT/UPDATE/DELETE` → `authenticated`; `ALL` → `service_role`. Sem `anon`.
- RLS habilitado.
- Policies:
  - `SELECT` para todo `authenticated`.
  - `INSERT/UPDATE/DELETE` apenas via `fidc_can_write(auth.uid())` (Gestor + Coordenação/Especialista).
- Trigger `BEFORE INSERT/UPDATE`: normaliza CNPJ (`regexp_replace(cnpj,'[^0-9]','','g')`) e atualiza `updated_at`.

### 2. View `v_issuer_rating_current`

`SELECT DISTINCT ON (cnpj) ...` ordenando por `data_rating DESC NULLS LAST, created_at DESC` — 1 linha por CNPJ com `rating, agencia, data_rating, outlook, source_id`.

### 3. Trigger temporário de espelho

`AFTER INSERT OR UPDATE ON issuer_ratings`: aplica `UPDATE empresas SET rating = NEW.rating WHERE cnpj = NEW.cnpj` quando `NEW` é o registro corrente da view. `COMMENT ON TRIGGER` deixa explícito: temporário, remover após telas migrarem para `v_issuer_rating_current` / RPC.

### 4. RPC `get_resolved_rating(p_cnpj text, p_ticker text DEFAULT NULL)`

`SECURITY DEFINER`, `STABLE`, `search_path = public`. Retorna `(rating text, source text, agencia text, data_rating date)`:

1. `trade_ativos.rating` se `p_ticker` informado → `source='ticker'`, `agencia=NULL`.
2. `v_issuer_rating_current` por `cnpj` → `source='emissor'`.
3. Rating modal entre empresas do mesmo `grupo_economico` → `source='grupo'`.
4. `NULL, 'nr', NULL, NULL`.

### 5. Seed inicial

```sql
INSERT INTO issuer_ratings (cnpj, rating, agencia, data_rating, observacao)
SELECT cnpj, rating, NULL, NULL,
       'Importação legada do cadastro de empresas (data original desconhecida)'
FROM empresas
WHERE rating IS NOT NULL AND TRIM(rating) <> '';
```

Esperado ~611 linhas. Cobertura do `UNIQUE NULLS NOT DISTINCT` garante idempotência se a migration for re-rodada.

## Frontend (após migration aprovada e tipos regenerados)

1. **`src/lib/ratings/useResolvedRating.ts`** — hook que chama o RPC com cache por `(cnpj, ticker)`.
2. **`src/components/ratings/RatingBadge.tsx`** — props `{rating, source, agencia, data}`:
   - `ticker` → badge sólido neutro, tooltip "Rating do ativo · agência · data".
   - `emissor` → badge sólido azul (semantic), tooltip "Rating do emissor · agência · data".
   - `grupo` → outline tracejada + ícone `Sparkles` + sufixo "≈", tooltip "Estimativa pelo grupo econômico — não é rating oficial".
   - `nr` → "N/R" muted.
   - Quando `data_rating IS NULL` exibe "sem data" no tooltip.
3. **Trocas de leitura direta por `<RatingBadge />`**:
   - `EmpresasPage` (lista + detail).
   - `TradeSectorDashboard`, `TradeMonitorPage`.
   - `IssuerExposurePanel`, `TargetsPanel` (via `useAllocationData`).
   - `DashboardPage` (cobertura de rating).
   - FIDC mantém `fidc_quota_classes.current_rating` (escopo separado).
4. **Gestão em `EmpresasPage`**: modal "Histórico de Rating" listando `issuer_ratings` do CNPJ + form "Adicionar rating" (agência, rating, data, outlook, observação, URL). Escrita restrita via RLS.

## Roadmap pós-migration

- Migrar telas para `v_issuer_rating_current` / RPC.
- Após migração, dropar trigger espelho e considerar `empresas.rating` cache derivado (ou remover).
- Avaliar adicionar `trade_ativos.agencia`.
- Remover `src/data/emissores.ts` (sem imports ativos).

## Critérios de aceite

- `issuer_ratings` com ~611 linhas após seed, todas com `data_rating IS NULL` e observação de legado.
- `v_issuer_rating_current` devolve 1 linha por CNPJ.
- `get_resolved_rating` cobre os 4 casos (`ticker | emissor | grupo | nr`).
- Telas listadas exibem `RatingBadge`; `source='grupo'` visualmente distinto como estimativa.
- RLS bloqueia escrita para perfis fora de Gestor/Coordenação.
