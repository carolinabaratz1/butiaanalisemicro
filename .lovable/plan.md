# Dashboard de Rating — Fase 1 (aprovado, com trigger auditada)

## Trigger `tg_issuer_ratings_mirror_empresas` — auditada, sem alteração

Caso **(a)**: a trigger consulta `v_issuer_rating_current` DEPOIS do INSERT e só espelha para `empresas.rating` se `NEW.id = source_id`. Para inserção retroativa, `source_id` continua sendo o do registro mais recente → o `UPDATE empresas.rating` é pulado. Sem vazamento para outras telas.

Nenhuma correção necessária. Ficará coberta explicitamente pelo smoke test (item novo abaixo).

## Confirmações prévias já validadas

- SELECT em `empresas` e `issuer_ratings`: `USING (true)` para `authenticated` → views sem `security_invoker`.
- `source_id` em `v_issuer_rating_current` é consumido pela trigger acima → mantido.
- `observacao` (611/611 com marcador de importação legada) → intocada no DB, escondida na UI.
- `agencia` (611/611 vazia) → renomeada para `rating_agency`.
- INSERT em `issuer_ratings` já protegido por `fidc_can_write` (Gestor + Coordenação-Especialista).

## Migração

```sql
-- 1. Rename
ALTER TABLE public.issuer_ratings RENAME COLUMN agencia TO rating_agency;

-- 2. Recriar v_issuer_rating_current (alias `agencia` mantido, source_id mantido)
CREATE OR REPLACE VIEW public.v_issuer_rating_current AS
SELECT DISTINCT ON (cnpj)
  cnpj, rating, rating_agency AS agencia, data_rating, outlook,
  id AS source_id
FROM public.issuer_ratings
ORDER BY cnpj, data_rating DESC NULLS LAST, created_at DESC;

-- 3. Recriar get_resolved_rating se referenciar `agencia` internamente,
--    mantendo alias de saída `agencia`.

-- 4. View nova dedicada ao dashboard
CREATE OR REPLACE VIEW public.v_empresa_rating_resolved AS
WITH base AS (
  SELECT
    regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g') AS cnpj,
    e.nome, e.grupo_economico
  FROM public.empresas e
  WHERE COALESCE(e.cnpj, '') <> ''
),
own_r AS (
  SELECT cnpj, rating, agencia AS rating_agency, data_rating
  FROM public.v_issuer_rating_current
),
group_ranked AS (
  SELECT
    b.cnpj, o2.rating,
    ROW_NUMBER() OVER (
      PARTITION BY b.cnpj
      ORDER BY COUNT(*) DESC,
               public.rating_bucket_severity(o2.rating) DESC NULLS LAST
    ) AS rn
  FROM base b
  JOIN base peer
    ON peer.grupo_economico = b.grupo_economico
   AND peer.cnpj <> b.cnpj
  JOIN own_r o2 ON o2.cnpj = peer.cnpj
  WHERE b.grupo_economico IS NOT NULL AND b.grupo_economico <> ''
  GROUP BY b.cnpj, o2.rating
),
group_r AS (SELECT cnpj, rating FROM group_ranked WHERE rn = 1)
SELECT
  b.cnpj, b.nome, b.grupo_economico,
  COALESCE(o.rating, g.rating) AS rating,
  o.rating_agency, o.data_rating,
  CASE
    WHEN o.rating IS NOT NULL THEN 'emissor'
    WHEN g.rating IS NOT NULL THEN 'grupo'
    ELSE 'nr'
  END AS source_level
FROM base b
LEFT JOIN own_r   o ON o.cnpj = b.cnpj
LEFT JOIN group_r g ON g.cnpj = b.cnpj;
```

## Restrições

- Sem novas tabelas.
- Sem tocar em `resolvePositionRating.ts`, `allocationUtils.ts`, tratamento de LFT/LTN/NTN/DPGE/Termo/Compromissada/FIDC.
- Hierarquia `get_resolved_rating` preservada.
- `v_issuer_rating_current` sem colunas novas.
- Trigger `tg_issuer_ratings_mirror_empresas` intocada (comportamento já correto).

## Componentes

### Novos
- `src/components/ratings/RatingDistributionCard.tsx` — KPIs + donut Recharts sobre `v_empresa_rating_resolved`.
- `src/components/ratings/IssuerRatingSelector.tsx` — combobox de busca em `empresas`.
- `src/components/ratings/IssuerRatingTimelineChart.tsx` — stepped-line via severidade, séries "Emissor" + "Grupo".
- `src/components/ratings/IssuerRatingTimelinePanel.tsx` — inline: badge atual + timeline + tabela + form RBAC.

### Modificados
- `src/pages/RatingResolverPage.tsx` — cabeçalho + Distribution + Selector + Timeline; bloco atual de resolução por ISIN/classe abaixo.
- `src/components/ratings/IssuerRatingHistoryDialog.tsx` — embute TimelineChart; payload passa a usar `rating_agency`; remove input "Observação"; esconde coluna "Observação"; `AlertDialog` retroativo.

### Reaproveitados
- `useResolvedRating`, `RatingBadge`, `resolveRatingsBatch`, `rating_bucket_severity`.

## Atualização manual

- INSERT em `issuer_ratings` (`cnpj`, `rating`, `rating_agency`, `data_rating`, `outlook`, `report_url`, `created_by = auth.uid()`).
- `data_rating < MAX(data_rating)` do mesmo CNPJ → `AlertDialog` de confirmação.
- Invalidar `["issuer_ratings"]`, `["resolvedRating"]`, `["empresas"]`, `["ratingDistribution"]`.
- Botão só para Gestor / Coordenação-Especialista.

## Ordem de execução

1. Migração: rename + recriar `v_issuer_rating_current` + criar `v_empresa_rating_resolved` + recriar `get_resolved_rating` se necessário.
2. `IssuerRatingHistoryDialog.tsx`: `rating_agency` + remover observação + `AlertDialog` retroativo.
3. Novos componentes.
4. Reestruturar `RatingResolverPage.tsx`.
5. `bunx tsc --noEmit` + smoke test completo.

## Smoke test obrigatório

- [ ] KPIs batem com `SELECT source_level, count(*) FROM v_empresa_rating_resolved GROUP BY source_level`.
- [ ] Timeline renderiza histórico existente.
- [ ] Inserção normal (data ≥ MAX): current no dashboard e no dialog atualizados; `empresas.rating` espelhado pela trigger.
- [ ] **Inserção retroativa** (data < MAX): `AlertDialog` dispara; após confirmação, insere; current no `RatingDistributionCard` e no `IssuerRatingHistoryDialog` **continua sendo o de data mais recente**; **`SELECT rating FROM empresas WHERE cnpj = ...` também continua igual ao pré-insert** (trigger não vaza retroativo).
- [ ] Emissor sem rating próprio mas com pares no grupo → `source_level = 'grupo'`, rating = moda por severidade.

## Fora de escopo

- Regras de LFT/LTN/NTN/DPGE/Termo/Compromissada/FIDC.
- Integração automática com agências.
- Drop / rename de `observacao`.
- Fonte `ticker` no dashboard.
- Badges "Geral" residuais no Kanban.
