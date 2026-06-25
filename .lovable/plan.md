# POC CVM v2 — Schema Discovery + Mapeamento Configurável

Reformular a POC `cvm-fidc-import` para diagnosticar corretamente o ZIP da CVM, carregar o Dicionário de Dados oficial e usar uma camada de mapeamento configurável — sem nunca tratar métrica ausente como zero, e sem mexer em upload manual, posições ou dados já gravados.

## Estrutura geral

```text
┌─────────────────────────────────────────────────────────────┐
│  Modal "Importar Informes via CVM" (CvmImportDialog v2)     │
│                                                             │
│  [Resumo] [Arquivos ZIP] [Dicionário] [Mapeamento]          │
│  [Pré-val. FIDC] [Diagnóstico FIDC] [Comparar Manual]       │
└─────────────────────────────────────────────────────────────┘
        │                    │                  │
        ▼                    ▼                  ▼
   cvm-fidc-import     cvm-fidc-dictionary   cvm-fidc-commit
   (diagnóstico)       (META .zip)           (gravação final)
        │                    │                  │
        └────────► cvm_fidc_field_mapping ◄─────┘
                          (DB)
                          │
                          ▼
              cvm_monthly_import_staging
                          │
                          ▼
              fidc_monthly_reports (somente após confirmação)
```

## Banco — novas tabelas

1. `cvm_fidc_field_mapping`
   - `metric_name`, `source_file_pattern`, `source_column`, `transformation`, `is_required`, `fallback_rule`, `notes`
   - Seed inicial com as 15 métricas pedidas (PL, Ativo, Passivo, DC, Caixa Ampliado, PDD, Atraso, Inad 30/60/90/120, Recompras, Cotistas, Classes, Rentabilidade)
   - RLS: leitura para `authenticated`; escrita somente Gestor + Coordenação/Especialista
2. `cvm_data_dictionary`
   - `table_name`, `column_name`, `description`, `expected_type`, `source_meta_file`, `loaded_at`
   - Populada pelo `cvm-fidc-dictionary`
3. `cvm_monthly_import_staging`
   - `reference_month`, `cnpj`, `fidc_id`, `raw_rows_by_file` (jsonb), `extracted_metrics` (jsonb), `extraction_status`, `missing_metrics` (text[]), `validation_summary` (jsonb), `source_url`, `imported_at`
   - Unique `(reference_month, cnpj)`

## Edge Functions

### `cvm-fidc-import` (refatorado)
- Faz streaming entry-a-entry do ZIP mensal.
- Para CADA CSV: detecta separador (`;` / `,` / `\t`), encoding (`iso-8859-1` vs `utf-8` via heurística BOM/bytes inválidos), conta linhas/colunas, captura lista de colunas, 3 primeiras linhas, set de CNPJs únicos, exemplos.
- Retorna bloco `files_diagnostics[]`.
- Para cada FIDC do Cadastro Mestre: localiza linhas em cada arquivo (por CNPJ) e aplica mapeamento da tabela `cvm_fidc_field_mapping` para extrair as métricas:
  - status por métrica: `found_value | found_zero | missing_column | missing_row | mapping_not_defined | parse_error`
  - nunca substitui ausência por 0
  - regras compostas (Caixa Ampliado, DC, PDD, Atraso, Inad 30/60/90/120) são executadas no servidor combinando colunas configuradas no mapping
- Retorna `per_fidc_diagnostics[]` com raw_rows_by_file, extracted_metrics, missing, parse_errors.

### `cvm-fidc-dictionary` (novo)
- Baixa `meta_inf_mensal_fidc_txt.zip`, lê metadados (.txt/.csv), faz upsert em `cvm_data_dictionary`.
- Retorna estrutura para a aba "Dicionário".

### `cvm-fidc-commit` (ajustado)
- Recebe lista de FIDCs aprovados, lê do staging, grava em `fidc_monthly_reports` somente quem tem PL e CNPJ válidos.
- Quem tem CNPJ na CVM mas sem PL → marca `mapping_error` (não grava).

## Parser de Mapeamentos
Helpers no edge function:
- `resolveColumn(headers, source_column)` — case/accents-insensitive, suporta múltiplos candidatos separados por `|`
- `applyTransformation(value, transformation)` — `abs`, `number_br`, `int`
- `applyCompositeRule(rule, columns_resolved)` — `sum(a,b,...)`, `abs(a)+abs(b)`, etc.

## Frontend

- `src/hooks/useCvmDictionary.ts` — carrega/atualiza dicionário
- `src/hooks/useCvmFieldMapping.ts` — CRUD mapeamento (Admin/Coord)
- `src/components/fidc/cvm/` — split do dialog:
  - `CvmImportDialog.tsx` (tabs container)
  - `tabs/ResumoTab.tsx`
  - `tabs/ArquivosZipTab.tsx`
  - `tabs/DicionarioTab.tsx`
  - `tabs/MapeamentoTab.tsx` (editável p/ Admin/Coord)
  - `tabs/PreValidacaoTab.tsx` (lista FIDCs + botão "Ver diagnóstico")
  - `tabs/DiagnosticoFidcTab.tsx` (drill-down por FIDC)
  - `tabs/CompararManualTab.tsx`

### Aba Resumo mostra
mês, URL, tamanho do ZIP, # arquivos, CNPJs CVM, CNPJs mestre encontrados, CNPJs com posição, FIDCs com PL/DC, completos, parciais, com erro de mapeamento.

## Regras críticas (não-negociáveis)
- Métrica ausente nunca vira 0.
- Distinguir `missing_column` (mapeamento aponta coluna inexistente) de `mapping_not_defined` (nenhum mapping para a métrica) de `missing_row` (CNPJ não está no arquivo correto).
- Se PL ausente para CNPJ presente na CVM → classificação `mapping_error`.
- Importação definitiva só roda após o usuário clicar "Confirmar" na aba Resumo.
- POC atual continua coexistindo (mesmo botão no Monitor abre a nova versão; o velho fluxo é substituído pela aba "Pré-validação", mas nenhum dado anterior é apagado).

## Entregáveis
1. Migration: 3 tabelas novas + seed do mapping + RLS/GRANT.
2. Edge functions: `cvm-fidc-import` (refatorado), `cvm-fidc-dictionary` (novo), `cvm-fidc-commit` (ajustado).
3. Frontend: dialog com 7 abas + 2 hooks + componentes de tabs.
4. Sem alterações em upload manual, posições ou dados gravados.