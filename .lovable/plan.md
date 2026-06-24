## Lâmina institucional de crédito — Página individual do FIDC

Reestruturar `src/pages/fidc/FidcDetailPage.tsx` em uma lâmina institucional, sem mexer em sidebar, upload de posições, cadastro mestre, nem botão de importar informe.

---

### Fase 1 — Backend: enriquecer o informe mensal

O parser atual extrai apenas o **somatório** de atrasos e não capta inadimplência por faixa, carteira por segmento, prazos de vencimento, garantias, SCR ou rentabilidade/captação/resgate/amortização por cota. Para alimentar a lâmina, vou:

**1.1 — Migration** em `fidc_monthly_reports` adicionando colunas (todas nullable):
- `overdue_30d_value`, `overdue_60d_value`, `overdue_90d_value`, `overdue_120d_value`
- `segment_breakdown jsonb` — `[{ segment, value, pct_dc }]` (seção II)
- `maturity_breakdown jsonb` — `[{ bucket, value, pct_dc }]` (V.a + VI.a)
- `overdue_breakdown jsonb` — `[{ bucket, value, pct_dc }]` (V.b + VI.b)
- `assignors_breakdown jsonb` — cedentes relevantes (I.2.a.11 / I.2.b.11)
- `guarantees_value`, `guarantees_pct_dc` (seção 7)
- `scr_status text`, `scr_value numeric` (seção 8)

**1.2 — Migration** em `fidc_monthly_quota_classes` adicionando:
- `monthly_yield_pct`, `subscription_value`, `redemption_value`, `amortization_value`

**1.3 — Parser** (`monthly-report-parser.ts`):
- Extrair V.b.1/V.b.2/V.b.3/V.b.4 + VI.b.1..4 (faixas de atraso)
- Extrair seção II por segmento (linhas com indent abaixo do header)
- Extrair V.a + VI.a (prazo de vencimento, buckets 30/60/90/120/150/180/360/720/1080/>1080)
- Extrair "d) recompras", "a) aquisições", "b) substituições", "c) alienações" da seção VII
- Extrair garantias (rótulo "7) garantias") e SCR (rótulo "8) ... SCR")
- Para cada cota: ler "rentabilidade", "captacao", "resgate", "amortizacao", "valor da subscrição/aplicação"
- Persistir os novos campos via `MonthlyReportImportDialog` no upsert

### Fase 2 — Frontend: lâmina

Refatorar `FidcDetailPage.tsx` em **componentes** dentro de `src/components/fidc/laminate/`:
- `LaminateHeader.tsx` — header executivo com status (informe/crédito/recomendação) e 2 botões (Importar Informe, Exportar PDF). Recomendação vem de `credit_opinions` (última do FIDC). Status do informe derivado de `quota_validation_status` + idade do informe. Status de crédito derivado dos limites de alertas (mesma lógica do `useFidcMonitorData`).
- `RiskSummary.tsx` — texto base por template (não-IA) usando placeholders das métricas do mês.
- `ButiaPositionTable.tsx` — adiciona colunas “% do PL do FIDC” e “% da carteira”.
- `KeyMetricsGrid.tsx` — cards com PL, Var. PL, Cota, Rent. mensal cota, DC, DC/PL, Caixa/PL, Atraso/DC, 30d/60d/90d/120d/DC, PDD/DC, PDD/Atrasos, Recompras/DC, Subordinação, Cotistas, Aquisições/DC. `NoDataChip` para faltantes.
- `LaminateCharts.tsx` — reorganiza `FidcHistoryCharts` em 10 painéis (PL+Var, Cota+Rent, DC+DC/PL, Inadimplência por faixa, Atraso/DC vs PDD/DC, PDD/Atrasos, Caixa/PL + Recompras/DC, Subordinação (com flag inconsistente), Cotistas, Fluxo VII).
- `CreditPortfolio.tsx` — 6 sub-blocos: Segmento (pizza), Prazo de vencimento (barras), Inadimplência por faixa (tabela), Cedentes relevantes (tabela), Garantias (cards), SCR (chip status). Cada um exibe “Sem dados no informe” se vazio.
- `QuotasAndValidation.tsx` — cards de PL informado, soma cotas, dif. absoluta/%, status, subordinação. **Tabela nova** “Cotas/classes importadas do informe” usando `fidc_monthly_quota_classes` (Classe, Tipo, Qtd cotas, Valor cota, PL classe, % PL, Rent. mês, Captação, Resgate, Amortização, Status matching). Mantém a tabela atual “Cotas/classes cadastradas”.
- `QualityChecks.tsx` — 4 validações (contábil A−P≈PL, DC vs II, PL×cotas, métricas ausentes) com status OK/Atenção/Crítico.
- `AlertsPanel.tsx` — separa em 3 colunas: Crédito, Qualidade, Posição. Limites usam os mesmos thresholds já presentes em `useFidcMonitorData` (e novos para 30/60/90/120d).
- `CreditOpinionPanel.tsx` — busca `credit_opinions` para `(fidc_id, latest reference_month)`. Mostra recomendação, resumo, motivo, pontos +/−, riscos, responsável, data. Botões “Editar Parecer” (link para `/fidc-monitor/pareceres?fidc=...`) e “Usar dados do informe no resumo” (preenche textarea via template e salva via upsert).

### Fase 3 — Exportação PDF

- Adiciona `src/styles/fidc-print.css` importado em `FidcDetailPage`:
  - `@media print`: oculta `[data-app-sidebar]`, header global, botões marcados `data-print="hide"`; força fundo branco; `page-break-inside: avoid` em cards; `@page { size: A4; margin: 14mm }`.
  - Adiciona `data-print-section` em cada bloco e cabeçalho com logo Butiá visível só na impressão.
- Botão “Exportar Lâmina PDF” = `window.print()`. Menu dropdown com “Completo” (default) e “Resumido” (adiciona classe `print-summary` que oculta seções de Carteira de Crédito e Histórico secundário).
- Não adiciona dependências; usa o diálogo nativo de impressão do navegador (salvar como PDF).

### Critério de aceite

Todos os itens da especificação do usuário ficam atendidos. Métricas inexistentes aparecem como `N/D` via `NoDataChip` com tooltip — nunca zero. Subordinação só é exibida como métrica confiável quando `subordinated_calculation_status === 'ok'`; caso contrário aparece como "Inconsistente" e fica de fora dos alertas de crédito.

### Ordem de execução

1. Migration (Fase 1.1 + 1.2) — uma única chamada `supabase--migration`.
2. Após aprovação: parser + dialog + componentes + print CSS, em paralelo onde possível.
3. Smoke test: rebuild + abrir a página de um FIDC com informe importado.

### Fora de escopo (confirmado)

- Sidebar, upload de posições, cadastro mestre — não tocados.
- IA generativa no resumo de risco — usa apenas template.
- Backend de geração de PDF server-side — apenas print do navegador.
