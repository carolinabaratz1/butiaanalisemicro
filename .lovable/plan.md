
# Replicar schema no Supabase externo (wicveoufijvtqebuxxaj)

Objetivo: reproduzir no seu projeto Supabase pessoal a mesma estrutura que já existe no backend do Lovable Cloud, **sem trocar o backend do app**. O app continua apontando para o Lovable Cloud; o outro projeto fica como cópia paralela do schema.

## Escopo do que será replicado

Fases já aplicadas no Lovable Cloud, que iremos empacotar num único script SQL:

- **Fase 1** — Tabelas de histórico de rating:
  - `rating_issuer_history (cnpj, rating_value, rating_date, source, ...)`
  - `rating_emission_history (isin, cnpj_emissor, rating_value, rating_date, source, ...)`
  - `rating_fidc_class_history (isin, class_code, rating_value, rating_date, source, ...)`
  - Índices, `updated_at` trigger, GRANTs, RLS + policies (leitura autenticada; escrita para Gestor/Coordenação via `has_role`).
- **Fase 2** — RPC `get_resolved_rating_v2(p_cnpj, p_isin, p_class_code)` com precedência fidc_class → emission → issuer.
- **Fase 7** — Motor de alertas FIDC:
  - `fidc_alert_rules` (nome, isin, class_code, condition jsonb, action jsonb, active, last_triggered_at, created_by, …)
  - `fidc_alert_events` (rule_id, isin, class_code, severity, message, payload, …)
  - Índices, GRANTs, RLS, policies e trigger `set_updated_at`.

Não incluído (por dependerem de tabelas específicas do projeto): a Fase 3 (backfill de 610 linhas de `issuer_ratings`) e a função `has_role` — ver seção de pré-requisitos.

## Pré-requisitos no seu Supabase externo

Para o script rodar sem erros, o projeto de destino precisa ter:

1. Extensão `pgcrypto` (para `gen_random_uuid()`) — normalmente já habilitada.
2. Função `public.has_role(_user_id uuid, _role public.app_role)` **ou** as policies serão criadas em versão simplificada (só `authenticated` lê/escreve, sem checagem de papel).
3. Se quiser o backfill da Fase 3, o destino também precisa da tabela `issuer_ratings` populada. Sem ela, o script cria as tabelas vazias e você popula depois.

Vou perguntar isso na hora da execução (não preciso decidir agora).

## Entregável

Um único arquivo `supabase-external-schema.sql` na raiz do projeto contendo, em ordem:

1. `CREATE TABLE` das 5 tabelas novas + índices.
2. `GRANT` para `authenticated` / `service_role` em cada tabela.
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
4. `CREATE POLICY` (versão com `has_role` **e** versão comentada sem `has_role`, para você escolher).
5. Trigger `set_updated_at` (função criada se não existir).
6. `CREATE OR REPLACE FUNCTION public.get_resolved_rating_v2(...)` idêntico ao Lovable Cloud.
7. Bloco opcional de backfill de `rating_issuer_history` a partir de `issuer_ratings` (comentado por padrão).

Nenhum arquivo do app é alterado. O SQL é 100% idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS` onde suportado, `CREATE OR REPLACE FUNCTION`).

## Como você aplica

1. Abrir o SQL Editor do projeto `wicveoufijvtqebuxxaj` no dashboard do Supabase.
2. Colar o conteúdo de `supabase-external-schema.sql`.
3. Decidir se mantém as policies com `has_role` (precisa existir) ou usa o bloco simplificado.
4. Executar.
5. Opcional: rodar o bloco de backfill se `issuer_ratings` existir por lá.

## Observações

- O app aqui no Lovable **continua** usando o backend do Lovable Cloud (`oxgbtbdkvxyraxbtpdjt`). Nada muda em `.env`, `client.ts` ou `types.ts`.
- Se depois você quiser sincronizar dados entre os dois projetos, é outro trabalho (ETL / dump-restore) — não faz parte deste plano.
- Se quiser que eu já inclua também as demais tabelas do app (empresas, posicoes, trade_*, fidc_*, etc.), me avise antes que eu implemento — o plano atual cobre só o que foi entregue nas Fases 1–3 e 7.

Quando aprovar, eu gero o arquivo `supabase-external-schema.sql`.
