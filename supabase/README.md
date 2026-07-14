# Supabase — Sincronização com Projeto Externo

Este diretório versiona o **schema** e **exports de dados** do projeto Supabase externo (`wicveoufijvtqebuxxaj`) usado pelo sistema Butiá (Gestão de Emissores, Emissões e Análises de Crédito).

## Estrutura

```
supabase/
├── migrations/
│   └── 20260714_000000_external_schema_full.sql   # Schema completo (idempotente)
├── exports/
│   ├── rating_issuer_history.csv                  # 610 registros reais
│   └── *.csv                                      # Demais tabelas (header-only p/ referência)
├── README.md
├── SYNC-CHECKLIST.md
└── .gitignore
```

## Escopo

- **50 tabelas** públicas (ratings, emissores, análises, FIDCs, trade, alocação, assembleias)
- **7 enums** (`app_role`, tipos de status, etc.)
- **31 funções** (RPC/helpers) incluindo `has_role`, `get_resolved_rating_v2`
- **RLS habilitado** em todas as tabelas + policies com `has_role`
- **Triggers de `updated_at`** e índices otimizados
- **GRANTs** explícitos para `authenticated` e `service_role`

## Como aplicar no Supabase externo

### 1) Aplicar schema

1. Abra o projeto `wicveoufijvtqebuxxaj` no dashboard Supabase.
2. **SQL Editor → New query**.
3. Cole o conteúdo de `migrations/20260714_000000_external_schema_full.sql`.
4. **Run**. O script é idempotente (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
5. Verifique em **Table Editor** que as 50 tabelas apareceram.
6. Verifique em **Database → Functions** que `has_role`, `get_resolved_rating_v2` e demais estão presentes.

### 2) Importar dados

Para cada CSV em `exports/`:

1. **Table Editor** → selecione a tabela alvo.
2. Menu **⋯** → **Import data from CSV**.
3. Faça upload do arquivo correspondente. O header do CSV corresponde às colunas.
4. Confirme o mapeamento e importe.

> **Nota:** apenas `rating_issuer_history.csv` traz dados reais (610 registros). Os demais CSVs contêm somente o header como referência das colunas — dados dessas tabelas devem ser exportados sob demanda direto do Lovable Cloud (ver seção abaixo).

### 3) Exportar dados adicionais do Lovable Cloud

Para tabelas grandes (`posicoes`, `trade_taxas`, `trade_spread_historico`, `fidc_monthly_quota_classes`, `empresas`, etc.) rode no SQL Editor do Lovable Cloud:

```sql
COPY (SELECT * FROM public.<tabela>) TO STDOUT WITH CSV HEADER;
```

Salve o resultado em `exports/<tabela>.csv` e commite.

## Checklist de verificação

Após aplicar o schema:

- [ ] `SELECT count(*) FROM pg_tables WHERE schemaname='public'` retorna ≥ 50
- [ ] `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'` retorna ≥ 31
- [ ] `SELECT has_role('<uuid-teste>', 'Gestor'::app_role)` executa sem erro
- [ ] `SELECT * FROM public.get_resolved_rating_v2('12345678000100', NULL, NULL)` retorna 1 linha
- [ ] Todas as tabelas têm RLS habilitado: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`

## Próximos passos

- Migrations futuras: criar arquivo `migrations/YYYYMMDD_HHMMSS_<descrição>.sql`
- Exports periódicos: automatizar via workflow GitHub Actions consumindo `pg_dump` do Lovable Cloud
- Manter `SYNC-CHECKLIST.md` atualizado a cada rodada

## Contato

- **Responsável:** vandeirgontijo@butiainvestimentos.com.br
- **Projeto destino:** `wicveoufijvtqebuxxaj` (Supabase externo)
- **Projeto origem:** Lovable Cloud (`oxgbtbdkvxyraxbtpdjt`)
