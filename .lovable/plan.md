## Plano final (execução 1 → 8)

### 1. Migração `rating_bucket_severity` — tratar "Retirado"

```sql
CREATE OR REPLACE FUNCTION public.rating_bucket_severity(p_rating text)
RETURNS integer LANGUAGE sql IMMUTABLE
SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN p_rating IS NULL OR trim(p_rating) = '' THEN NULL
    WHEN upper(trim(p_rating)) IN ('RETIRADO','N/R','NR','WITHDRAWN','WD') THEN NULL
    WHEN p_rating ILIKE '%soberano%' THEN 5
    WHEN regexp_replace(upper(regexp_replace(p_rating,'\(.*?\)','','g')),'^BR','') LIKE 'AAA%' THEN 5
    WHEN regexp_replace(upper(regexp_replace(p_rating,'\(.*?\)','','g')),'^BR','') LIKE 'AA%'  THEN 4
    WHEN regexp_replace(upper(regexp_replace(p_rating,'\(.*?\)','','g')),'^BR','') LIKE 'A%'   THEN 3
    WHEN regexp_replace(upper(regexp_replace(p_rating,'\(.*?\)','','g')),'^BR','') LIKE 'BBB%' THEN 2
    WHEN regexp_replace(upper(regexp_replace(p_rating,'\(.*?\)','','g')),'^BR','') ~ '^(BB|B|CCC|CC|C|D)' THEN 1
    ELSE NULL
  END;
$$;
```

### 2. `parseRating1` + mapa canônico de agência (`UploadPage.tsx`)

Novo helper `normalizeAgencia(raw)` — trim/upper/remove pontuação, com mapa: FITCH→Fitch, SP/S&P/STANDARD&POORS→S&P, MOODYS/MOODY'S→Moody's, AUSTIN→Austin, LIBERUM→Liberum, LF/LFRATING→LF Rating. Fora do mapa: mantém `trim` original.

### 3. Filtro "sem `data_rating` → pular" no builder de candidatos.

### 4. Dedup determinístico com `conflitos[]`
Regra: menor severidade vence; empate → `localeCompare` ascendente. Retorna `{ winners, conflitos }`.

### 5. `importIssuerRatings` — idempotente
Troca por `.upsert(payload, { onConflict: 'cnpj,rating_agency,data_rating', ignoreDuplicates: true }).select('id')`. Retorna `{ importados, ignorados, conflitos }`.

### 6. UI de conflitos
Bloco `bg-warning/10 border-warning/40` no card de resultado com `<details>` colapsável (CNPJ · Agência · Data · Escolhido · Descartados).

### 7. `src/lib/ratings/ratingSeverity.ts`
Adiciona `RETIRADO_TOKENS` retornando null, alinhando ao banco.

### 8. Smoke test
1. Upload → 794 importados, 0 ignorados, 5 conflitos no banner.
2. Verificar caso âncora CNPJ 12.104.241/0004-02, Fitch, 2026-04-07: vencedor 'C', descartado 'RD'.
3. Reupload → 0 novos, 794 ignorados, 5 conflitos ainda listados.
4. "Retirado" mantém texto na tabela, ausente da severidade.

### Arquivos tocados
1. Migração SQL.
2. `src/lib/ratings/ratingSeverity.ts`.
3. `src/components/trade/UploadPage.tsx`.
