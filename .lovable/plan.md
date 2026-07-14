
# Roadmap — Rating System 3 Níveis + Dashboards (8 Fases)

Plano macro/referência. Cada fase será executada como um prompt separado depois — aqui fica o "esqueleto" com decisões já tomadas.

**Decisões travadas:**
- Opção **B + backfill** do `issuer_ratings` atual.
- Nova RPC com **nome novo** (`get_resolved_rating_v2`). A `get_resolved_rating(p_cnpj, p_ticker)` atual **fica intocada** — RatingBadge, `useResolvedRating`, `useEmissoresGestao`, `get_emissores_gestao` continuam funcionando.
- Convivência: UI antiga = função antiga; componentes novos = v2.

---

## Fase 1 — Schema base de ratings (migration)

Criar 3 tabelas em `public`, todas com `id uuid PK`, `rating_value text`, `rating_date date`, `source text` (agência), `created_at`, `updated_at`, trigger `set_updated_at`, GRANT `authenticated`/`service_role`, RLS habilitado.

- `rating_issuer_history (cnpj text)` — índice `(cnpj, rating_date DESC)`
- `rating_emission_history (isin text, cnpj_emissor text)` — índice `(isin, rating_date DESC)`
- `rating_fidc_class_history (isin text, class_code text)` — índice `(isin, class_code, rating_date DESC)`

**RLS**: leitura para `authenticated`; escrita restrita a Gestor + Coordenação/Especialista via `has_role`.

## Fase 2 — RPC `get_resolved_rating_v2`

```
get_resolved_rating_v2(p_cnpj text, p_isin text DEFAULT NULL, p_class_code text DEFAULT NULL)
returns (rating_value text, source_level text, rating_date date, rating_id uuid)
```

Precedência (mais específico → mais genérico):
1. `rating_fidc_class_history` por `(isin, class_code)` — `source_level='fidc_class'`
2. `rating_emission_history` por `isin` — `source_level='emission'`
3. `rating_issuer_history` por `cnpj` — `source_level='issuer'`

Cada nível ordena por `rating_date DESC, created_at DESC LIMIT 1`. `SECURITY DEFINER`, `search_path=public`.

## Fase 3 — Backfill dos ratings legados

Popular `rating_issuer_history` a partir de `public.issuer_ratings` (todos os registros históricos, não só o corrente): `cnpj → cnpj`, `rating → rating_value`, `data_rating → rating_date`, `agencia → source`. Uma migration idempotente (com `ON CONFLICT`/dedupe).

Opcional (documentado, não implementado nesta fase): popular `rating_emission_history` a partir de `trade_ativos.rating` quando houver ISIN em `emissoes` — deixar como follow-up para não acoplar demais.

## Fase 4 — Componente `RatingResolver` (35h)

Página/componente autônomo em `src/components/ratings/RatingResolver.tsx`:
- Form: CNPJ (14 dígitos, validado), ISIN opcional (12 alfa-num), Class Code opcional.
- `useQuery` → `supabase.rpc('get_resolved_rating_v2', …)`.
- Card grande com `rating_value`, badge de `source_level` (cor por nível), data.
- Histórico: últimas 5 linhas da tabela correspondente ao nível resolvido.
- Estados: loading, erro, "sem rating".
- Botão "Exportar JSON".

Não substitui `RatingBadge` — vive em paralelo, acessível por rota nova (ex.: `/ratings/resolver`).

## Fase 5 — Positions Dashboard (40h)

Novo dashboard em `src/pages/PositionsMonitorPage.tsx` sobre `posicoes` + `emissoes` + `trade_ativos`, resolvendo rating por linha via `get_resolved_rating_v2(cnpj_emissor, isin, null)` em batch (padrão `resolveRatingsBatch`).

- Grid paginado (50/pág): Asset, Qty, Unit Price, Total, Rating (badge v2), Data, ações.
- Filtros laterais: asset, rating, data range, valor.
- KPIs topo + pie por rating.
- Export CSV.

Não mexe na `PosicoesPage` existente — página nova.

## Fase 6 — Trade Monitor Dashboard (30h)

Consolidar/estender `TradeMonitorPage`:
- LineChart 30d de taxa/volume/rendimento por ativo (Recharts).
- Últimas 20 operações com cores por tipo/status.
- Cards resumo (ops, volume, taxa média, top ativo).
- Filtros: ativo multi, data, tipo, status.
- Export CSV do período.

Fontes: `trade_taxas`, `trade_metricas`, `trade_ativos`.

## Fase 7 — FIDC Alert Rules Engine (45h)

Nova tabela `fidc_alert_rules` (nome, isin, class_code, condição JSON, ação, ativo, criado_por, last_triggered_at) + `fidc_alert_events` (log).
Trigger de disparo: edge function `fidc-rating-alert-check` acionada por cron (pg_cron + pg_net) após atualizações de `rating_fidc_class_history`.

UI (`src/pages/fidc/AlertasEnginePage.tsx`):
- CRUD de regras.
- Dashboard de alertas 30d + filtros.
- Simulador ("testar regra" sem persistir).
- Histórico + gráfico de frequência.

RLS: Gestor/Risco escrevem; Analista lê.

## Fase 8 — Analytics Dashboard + Excel Export (35h)

`src/pages/AnalyticsPage.tsx` com 4 tabs (Ratings / Positions / Emissões / Compliance):
- Recharts: pie, line, heatmap, stacked bar, scatter, timeline.
- Filtros globais (data, rating, empresas) propagados a todas as tabs.
- Export XLSX multi-aba com SheetJS (`xlsx`), incluindo resumo executivo.
- Agregações no backend via RPCs `analytics_*` para evitar puxar linhas cruas.

---

## Coexistência com o código atual

```text
UI antiga (Emissores, RatingBadge, useResolvedRating, useEmissoresGestao)
   └── continua usando get_resolved_rating(p_cnpj, p_ticker) + issuer_ratings/trade_ativos.rating

UI nova (Fases 4–8)
   └── usa get_resolved_rating_v2 + rating_*_history
```

Após Fase 8 estabilizar, decisão futura (não neste plano): migrar UI antiga para v2 e depreciar a v1.

## Detalhes técnicos importantes

- Todas as migrations seguem o padrão do projeto: `CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY`, trigger `set_updated_at`, `search_path=public` em funções.
- Nenhuma alteração em `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `config.toml`.
- Backfill roda via `supabase--insert` (dados), migrations só para DDL.
- Edge function da Fase 7 usa CORS padrão + validação Zod, agendada via `pg_cron`+`pg_net`.
- Sem dados mock — tudo lê `posicoes`, `emissoes`, `trade_*`, `rating_*_history` reais.

## Ordem de execução sugerida

1. Fases 1 + 2 + 3 numa mesma rodada (migration única + insert de backfill).
2. Fase 4 (valida a RPC v2 ponta-a-ponta).
3. Fases 5 → 6 → 7 → 8 uma a uma, cada uma com seu próprio plano detalhado.

Quando quiser iniciar, me diga "toca Fase 1-3" (ou a fase alvo) e eu abro um plano específico já com SQL/arquivos.
