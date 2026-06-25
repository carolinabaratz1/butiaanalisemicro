
# POC: Importar Informes via CVM (Dados Abertos)

Adiciona um caminho alternativo de importação ao FIDC Monitor, baixando o ZIP oficial mensal da CVM, filtrando os CNPJs do Cadastro Mestre e mostrando diagnóstico antes de gravar. O upload manual atual permanece intacto e funciona em paralelo.

## Escopo

**Mantém:** sidebar, upload manual, Cadastro Mestre, base de posições, dados existentes.
**Não faz:** PDF, IA, gravação automática sem confirmação, alteração de schema das tabelas existentes (apenas adiciona colunas em `fidc_monthly_reports`).

## Arquitetura

O ZIP da CVM tem ~50 MB e é hospedado em `dados.cvm.gov.br` (sem CORS para origens externas). Não dá para baixar direto do browser. Solução:

```text
Browser (modal POC) ──► Edge Function `cvm-fidc-import`
                           │
                           ├─ baixa ZIP da CVM
                           ├─ descompacta (CSVs ; latin1)
                           ├─ filtra por CNPJs do Cadastro Mestre + posições
                           ├─ agrega métricas por FIDC e por classe de cota
                           └─ devolve JSON de diagnóstico
Browser ──► (usuário confirma) ──► Edge Function `cvm-fidc-commit`
                           │
                           └─ grava em fidc_monthly_reports + fidc_monthly_quota_classes
                              com source='cvm_open_data', is_current_version, versionamento
```

Cache do ZIP em memória da função por execução (sem storage). O usuário pode reabrir o diagnóstico sem re-baixar dentro da mesma sessão da função (chave: AAAAMM + hash).

## Estrutura dos CSVs da CVM

O ZIP `inf_mensal_fidc_AAAAMM.zip` contém ~10 CSVs separados por `;`, encoding latin1:

- `inf_mensal_fidc_tab_I_AAAAMM.csv` — Ativos (I.1, I.2.a..i, subitens .10 para PDD)
- `inf_mensal_fidc_tab_II_AAAAMM.csv` — Carteira por segmento
- `inf_mensal_fidc_tab_IV_AAAAMM.csv` — PL (IV.a)
- `inf_mensal_fidc_tab_V_AAAAMM.csv` — Inadimplência DC (V.a prazos, V.b atrasos por faixa)
- `inf_mensal_fidc_tab_VI_AAAAMM.csv` — Inadimplência outros (VI.b)
- `inf_mensal_fidc_tab_VII_AAAAMM.csv` — Negócios do mês (VII.d.2 recompras)
- `inf_mensal_fidc_tab_X_1_AAAAMM.csv` — Cotistas
- `inf_mensal_fidc_tab_X_2_AAAAMM.csv` — Classes de cota (PL, qtd, valor)
- `inf_mensal_fidc_tab_X_3_AAAAMM.csv` — Rentabilidade mensal por classe
- `inf_mensal_fidc_tab_X_4_AAAAMM.csv` — Subscrições/resgates/amortizações

Chave de join: `CNPJ_FUNDO_CLASSE` (ou `CNPJ_FUNDO` em meses antigos). Para classes, `CNPJ_FUNDO_CLASSE` + `DENOM_CLASSE`/`TP_CLASSE`.

## Entregáveis

### 1. Edge functions

**`supabase/functions/cvm-fidc-import/index.ts`** (POC, diagnóstico):

- Input: `{ referenceMonth: 'YYYYMM' }`
- Baixa ZIP, descompacta com `jsr:@zip-js/zip-js` (Deno), faz streaming dos CSVs com parser próprio leve (split por `;` respeitando aspas).
- Recebe lista de CNPJs alvo no request body (enviada pelo cliente — Cadastro Mestre + posições) para evitar chamadas extras de DB.
- Para cada FIDC alvo, agrega: PL (IV.a), DC (I.2.a+I.2.b), Caixa Ampliado (I.1 + I.2.c..i), PDD (|I.2.a.10|+|I.2.b.10|), Atraso (V.b+VI.b), Inad 30/60/90/120 (V.b.1-4 + VI.b.1-4), Recompras (VII.d.2), Cotistas (X.1), Classes (X.2 + X.3).
- Valida PL ≈ soma PL das classes; classifica status.
- Retorna `{ url, fileSizeBytes, fileHash, filesInZip[], rowsByFile{}, totalCnpjs, mestreFound[], mestreMissing[], posFound[], posMissing[], readErrors[], alerts[], fidcs[] }`.

**`supabase/functions/cvm-fidc-commit/index.ts`** (gravação após confirmação):

- Input: `{ referenceMonth, fileHash, sourceUrl, mode: 'replace'|'new_version', items: [...] }`
- Para cada FIDC: marca `is_current_version=false` nos informes prévios desse mês (modo `new_version`) ou faz UPDATE in-place (modo `replace`), insere `fidc_monthly_reports` com `source='cvm_open_data'`, `source_url`, `imported_at`, `file_hash`, `is_current_version=true`, `raw_data` com linhas originais resumidas.
- Insere `fidc_monthly_quota_classes`.
- Verifica JWT (usa anon key + RLS via service_role após validar role Gestor/Coordenação via `has_role`).

### 2. Migração mínima

Adicionar a `fidc_monthly_reports`:
- `source TEXT NOT NULL DEFAULT 'manual_upload'`
- `source_url TEXT`
- `file_hash TEXT`
- `imported_at TIMESTAMPTZ DEFAULT now()`
- `is_current_version BOOLEAN NOT NULL DEFAULT true`
- `version INTEGER NOT NULL DEFAULT 1`
- índice parcial em `(fidc_id, reference_month) WHERE is_current_version`

Mesmas colunas (source, is_current_version) em `fidc_monthly_quota_classes` para coerência. Sem mudanças de RLS — políticas atuais já cobrem.

### 3. Frontend

**`src/components/fidc/CvmImportDialog.tsx`** — modal grande com:
- Input mês `AAAAMM` (default mês anterior).
- Painel de diagnóstico com cards (URL, status, hash, tamanho, arquivos, contagens) e seções:
  - "Cadastro Mestre — encontrados / não encontrados"
  - "FIDCs com posição — encontrados / não encontrados"
  - "Erros de leitura" / "Alertas"
- Tabela por FIDC com todas as colunas solicitadas (CNPJ, Nome, Mês, PL, DC, Caixa Ampliado, PDD, Atraso, Inad 30/60/90/120, Recompras, Cotistas, Classes, Soma PL Classes, Δ PL, Status com badge).
- Drawer por linha mostrando as classes (X.2/X.3) e validação subordinação.
- Botão **"Confirmar e gravar informes CVM"** (rotulado claramente como POC). Antes de gravar, para FIDCs com informe existente do mesmo mês: dialog inline com 3 opções (Substituir / Nova versão / Cancelar) — aplicável por linha ou em massa.
- Comparativo CVM vs upload manual: coluna extra "Δ vs manual" usando o `latestReportFor(fidcId)` quando `source='manual_upload'`.

**`src/pages/fidc/MonitorPage.tsx`** — adicionar botão "Importar Informes via CVM" no header (ao lado do contador de informes), abrindo o `CvmImportDialog`. Permissão: `fidc_can_write`.

**`src/lib/fidc/cvm-mapping.ts`** — constantes do de/para de campos CVM → métricas (fonte única, espelhada client+server). Lista de status, regras de validação, formatador de URL.

**`src/hooks/useCvmImport.ts`** — `useMutation` para `diagnose` e `commit` via `supabase.functions.invoke`.

### 4. Permissões e UX

- Apenas Gestor/Coordenação/Especialista veem o botão (mesmo gate do upload manual).
- Loading com progresso por etapa (download → unzip → parse → agregação).
- Toasts de sucesso/erro; rollback transacional na função de commit (`BEGIN…COMMIT` via RPC ou múltiplos upserts idempotentes).

## Riscos e mitigações

- **Tamanho do ZIP (~50 MB) e timeout de Edge Function**: parsing por streaming linha-a-linha; só guardar em memória CNPJs alvo. Em meses recentes ~15k FIDCs ⇒ filtragem reduz drasticamente.
- **Layout muda entre meses**: parser detecta colunas por nome de header, com fallback documentado. Linhas com header inesperado entram em `readErrors`.
- **Encoding latin1 / decimais com vírgula**: TextDecoder('latin1') + `parseNumberBR`.
- **Sem CORS pra browser**: tudo pela Edge Function.
- **Idempotência do commit**: chave `(fidc_id, reference_month, version)` única; `is_current_version` único parcial.

## Critérios de aceite (mapeados)

Todos os 10 itens da seção "Critérios de aceite" do pedido ficam cobertos pelos componentes acima. Upload manual intacto. Comparativo CVM × manual disponível na tabela.

## Fora de escopo

Re-processar meses passados em lote, agendar download recorrente, parser de PDF, IA, mudanças no Cadastro Mestre e nas posições.
