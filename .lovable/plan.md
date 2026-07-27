
# Sync Incremental + Revisita de Status — Radar de Ofertas

Evoluir `supabase/functions/sync-cvm-ofertas/index.ts` para reduzir drasticamente o trabalho por rodada, mantendo a base 100% atualizada.

## Escopo (a→e)

### (a) Correção de status "sucesso" após listagem
Ao final da Fase 0 (listagem), marcar o log como `sucesso` mesmo com `pendentes_enrich > 0`. A Fase 1 (enrich) passa a rodar em rodadas subsequentes, sem prender o log em `em_andamento`.

### (b) Listagem incremental de 30 dias (ofertas NOVAS)
- Nova função `getListingWindow()`:
  - Consulta `max(data_referencia)` em `ofertas_publicas_cvm`.
  - Se **vazio** → fallback histórico (1990-01-01).
  - Se **existe** → janela = `max(data_referencia) - 30 dias` até hoje.
- Passar `dataInicio`/`dataFim` para o endpoint SRE de listagem.
- Idempotência preservada (upsert por `hash_linha`).

### (c) Revisita de status para não-terminais
Nova fase intermediária entre listagem e enrich:
- Constante:
  ```ts
  const NON_TERMINAL_SITUACOES = [
    'Registro Concedido',
    'Aguardando Bookbuilding',
    'Oferta Suspensa',
    'Em cumprimento de exigências',
  ];
  ```
- Seleciona rows com `situacao IN (NON_TERMINAL_SITUACOES)` **e** `id_requerimento_cvm IS NOT NULL`, ordenadas por `last_seen_at ASC` (mais antigas primeiro).
- Para cada uma, chama `/infOferta/{id_requerimento_cvm}` e atualiza: `situacao`, `historico_status`, `data_encerramento`, `last_seen_at`.
- Lote: `REVISIT_BATCH_SIZE = 40`, `REVISIT_CONCURRENCY = 2`, respeitando `INVOCATION_SOFT_DEADLINE_MS`.
- Linhas com `situacao` nula/vazia ou sem `id_requerimento_cvm` são ignoradas (legadas).

### (d) Timeouts e throughput
- `FETCH_TIMEOUT_MS_SEARCH = 45000` (endpoint de listagem).
- `FETCH_TIMEOUT_MS_DETAIL = 20000` (endpoints de detalhe — inalterado).
- `ENRICH_BATCH_SIZE = 40` (era 20).

### (e) UI — polling por status
Em `src/pages/RadarDeOfertasPage.tsx`:
- Substituir o loop de até 80 chamadas por: invocar `sync-cvm-ofertas` uma vez, depois **polling** em `cvm_ofertas_sync_log` a cada 3s até `status IN ('sucesso','erro','parcial')`.
- Enquanto o log estiver `sucesso` mas o backend ainda tiver `pendentes_enrich`, re-invocar em background (máx 20 rodadas encadeadas por sessão do usuário).
- Manter a barra de progresso baseada nos contadores do log.

## Máquina de estados por invocação

```text
Fase 0: Listagem incremental (30d)         → marca log como "sucesso"
Fase 1: Revisita de não-terminais (lote)   → atualiza situacao/histórico
Fase 2: Enrich de novos (lote)             → detalhe/documentos/histórico

Cada invocação executa até o deadline e retorna:
{ done: bool, pending_revisit: n, pending_enrich: n, ... }
```

## Fora de escopo
- Nenhuma mudança de schema.
- Sem alterações no dialog de detalhes já implementado.
- Sem mudança na classificação de terminais confirmada pelo usuário.

## Validação
1. Rodar sync do zero em ambiente com dados atuais → listagem usa janela de 30d, log fica `sucesso` em ≤2 rodadas.
2. Alterar manualmente uma row para `situacao='Registro Concedido'` com `last_seen_at` antigo → confirmar que a próxima rodada a revisita.
3. Confirmar que rows terminais nunca aparecem no SELECT de revisita (query plan / logs).
4. UI: verificar que o botão "Sincronizar" mostra progresso via polling e finaliza sem loop travado.
