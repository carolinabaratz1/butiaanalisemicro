# Sync Checklist — Supabase Externo

**Projeto:** `wicveoufijvtqebuxxaj`
**Última sincronização:** 14 de julho de 2026
**Próxima planejada:** _a definir_

## Status atual

- [x] Schema exportado do Lovable Cloud (`20260714_000000_external_schema_full.sql`)
- [x] 50 tabelas, 31 funções, 7 enums, RLS + policies incluídos
- [x] 610 registros de `rating_issuer_history` exportados
- [x] CSVs header-only gerados para 46 tabelas restantes
- [ ] Schema aplicado no Supabase externo (`wicveoufijvtqebuxxaj`)
- [ ] CSVs importados via Table Editor
- [ ] Verificação final (checklist do README)

## Histórico

| Data       | Ação                                                  | Autor                |
| ---------- | ----------------------------------------------------- | -------------------- |
| 2026-07-14 | Export inicial: schema completo + `rating_issuer_history` | vandeirgontijo@butia |

## Pendências conhecidas

- Dados de tabelas grandes (`posicoes` 16k, `trade_taxas` 375k, `trade_spread_historico` 30k, `fidc_monthly_quota_classes` 2k, `empresas` 1.3k) ainda não exportados — requerem `COPY ... TO STDOUT` direto no SQL Editor.
- Automatizar exports via GitHub Actions (backlog).

## Contato

vandeirgontijo@butiainvestimentos.com.br
