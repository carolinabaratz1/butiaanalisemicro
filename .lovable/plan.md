
# Sincronizar com o Supabase externo (`wicveoufijvtqebuxxaj`)

Objetivo: garantir que o projeto externo tenha o mesmo schema do Lovable Cloud (Fases 1, 2, 3, 7) e, opcionalmente, os mesmos dados de rating já migrados. O app **continua** apontando para o Lovable Cloud — nada em `.env`, `client.ts` ou `types.ts` muda.

## Situação atual

- Arquivo `supabase-external-schema.sql` já existe na raiz do projeto e contém, em versão idempotente:
  - Extensão `pgcrypto` e função `set_updated_at`.
  - Bloco opcional para criar `app_role`, `user_roles` e `has_role` (comentado).
  - Tabelas `rating_issuer_history`, `rating_emission_history`, `rating_fidc_class_history` com índices, GRANTs, RLS, policies e triggers.
  - RPC `get_resolved_rating_v2` (fidc_class → emission → issuer).
  - Tabelas `fidc_alert_rules` e `fidc_alert_events` com índices, GRANTs, RLS, policies e trigger.
  - Bloco opcional de backfill de `rating_issuer_history` a partir de `issuer_ratings` (comentado).
  - Bloco alternativo de policies permissivas para authenticated (sem `has_role`).

Nada precisa ser reescrito para o schema em si. A sincronização é operacional (executar) + opcional (dados).

## Etapas do plano

### 1. Preparar o projeto externo
Escolher, antes de rodar o SQL:
- **A.** Manter policies com `has_role` (mais seguro). Requer que o projeto externo já tenha `app_role` + `user_roles` + `has_role`, ou descomentar o bloco 2 do script para criá-los.
- **B.** Usar o bloco alternativo permissivo (todo `authenticated` lê/escreve). Mais simples, menos seguro. Usar só se for um projeto sandbox.

### 2. Aplicar o schema
1. Abrir o SQL Editor do projeto externo `wicveoufijvtqebuxxaj`.
2. Colar o conteúdo de `supabase-external-schema.sql`.
3. Descomentar o bloco 2 (app_role/has_role) se necessário — passo 1A.
4. Executar. Como é idempotente, pode ser rodado várias vezes.
5. Verificar no dashboard do projeto externo:
   - Tabelas criadas em `public`.
   - Policies ativas.
   - Função `get_resolved_rating_v2` presente.

### 3. (Opcional) Sincronizar dados de rating
Se você quiser levar as 610 linhas já populadas de `rating_issuer_history` (Fase 3) e demais históricos para o projeto externo, temos duas opções:

- **3a. Backfill a partir de `issuer_ratings` do próprio projeto externo** (se essa tabela existir lá): descomentar o bloco 6 do script.
- **3b. Exportar do Lovable Cloud e importar no externo** (novo trabalho, não coberto pelo arquivo atual):
  1. Eu exporto CSVs de `rating_issuer_history`, `rating_emission_history`, `rating_fidc_class_history`, `fidc_alert_rules`, `fidc_alert_events` do Lovable Cloud para `/mnt/documents/`.
  2. Você baixa os CSVs e usa `Table Editor → Import CSV` no dashboard do projeto externo, ou eu gero um segundo arquivo `supabase-external-data.sql` com `INSERT`s prontos.

### 4. (Opcional) Ampliar o escopo
Se quiser replicar também outras tabelas do app (`empresas`, `posicoes`, `trade_*`, `fidc_monthly_reports`, etc.) e suas funções (`get_emissores_gestao`, `get_posicoes_dashboard_fundo`, `recalc_trade_metricas_*`), eu gero um segundo arquivo `supabase-external-schema-full.sql` cobrindo todo o schema `public`. Não faz parte do script atual.

## Perguntas antes de rodar

Para eu ajustar o entregável e/ou gerar o export de dados, preciso confirmar três pontos:

1. **Policies:** manter `has_role` (opção A) ou usar policies permissivas (opção B)?
2. **Dados:** só schema, backfill local (3a) ou export do Lovable Cloud (3b)?
3. **Escopo:** parar nas Fases 1/2/3/7 (arquivo atual) ou incluir o schema completo do app (etapa 4)?

## O que muda no repositório

- Se a resposta for "só schema atual": nenhuma alteração de arquivo — basta rodar o SQL existente.
- Se for "export de dados (3b)": criar `supabase-external-data.sql` (ou CSVs em `/mnt/documents/`).
- Se for "schema completo (4)": criar `supabase-external-schema-full.sql`.

Em nenhum caso o app é alterado.
