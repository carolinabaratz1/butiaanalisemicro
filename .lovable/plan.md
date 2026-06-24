# Parser do Informe Mensal FIDC — extração por âncoras e de/para

Objetivo: reduzir drasticamente os N/D na lâmina individual do FIDC, lendo o informe **por seção e por rótulo textual normalizado**, nunca por linha fixa. Sem mexer em upload de posições, Cadastro Mestre, sidebar; sem IA; sem nova migration (todos os novos campos ficam dentro do `raw_data` JSON).

---

## Fase 1 — Reescrita de `src/lib/fidc/monthly-report-parser.ts`

### 1.1 Mapa de seções (âncoras textuais)

Ancorar uma vez por arquivo. Cada âncora delimita janela `[from, to)` para buscas internas — nada é por número de linha.

```
I  - Ativo
  1 - Disponibilidades                    → caixa estrito
  2 - Carteira
    a) DC com aquisição substancial
       a.2.1) Valor Total Parcelas Inadimplentes
       a.3)   Créditos Existentes Inadimplentes
       a.10)  Provisão para Redução
       a.11)  (cedentes)
    b) DC sem aquisição substancial
       b.2.1, b.3, b.10, b.11 (idem)
    c) Valores Mobiliários
    d) Títulos Públicos Federais
    e) CDB
    f) Compromissadas
    g) Outros Ativos RF
    h) Cotas de FIDCs
    i) Warrants
II - Carteira por Segmento                → segment_breakdown
III - Passivo
IV - Patrimônio Líquido
   a) Valor do PL                          → nav_value
   b) Valor do PL Médio                    → raw.monthly_average_nav_value
V  - Comportamento DC com aquisição
   a) Por Prazo de Vencimento (a.1..a.10)
   b) Inadimplentes (b.1..b.10) [entre X e Y dias / acima de 1080]
VI - Comportamento DC sem aquisição
   a) Por Prazo (mesmo padrão)
   b) Inadimplentes (mesmo padrão)
VII - Negócios no mês
   a) Aquisições  (a.1 qtd, a.2 valor)
   b) Alienações  (b.1 qtd, b.2 valor, b.3 contábil)
   c) Substituições (c.1, c.2, c.3)
   d) Recompras    (d.1, d.2, d.3)
IX - Taxas
X  - Outras Informações
   1) Nº de Cotistas                       → investors_count
   2) Descrição da Série/Classe            → cotas (campos: Cota, PL, Quantidade, Rating)
   3) Rentabilidade Apurada no Mês         → monthlyYieldPct por classe
   4) Captações, Resgates e Amortizações   → subs/red/amort por classe
   7) Garantias (7.1 valor, 7.2 %)
   8) SCR (8.1 / 8.2 / "Não possui informação apresentada")
```

### 1.2 Normalização e parsing numérico

Reaproveitar `norm()`, `asNumber()`. Adicionar `pickRightmostNumber(row, col)` que, se a célula da coluna do mês estiver vazia, pega o último valor numérico não-nulo à direita da linha — defesa contra colunas mescladas. Manter detecção de `(neg)` e `R$ x.xxx,xx`.

### 1.3 Novas extrações (vão para `MonthlyMetrics` ou `raw_data`)

**Coluna do banco já existente** (sem migration):
- `cash_value` ← **Caixa Ampliado** = I.1 + I.2.c..i (soma de presentes).
- `overdue_30/60/90/120d_value` ← V.b.1..4 + VI.b.1..4 usando rótulos "entre 1 e 30", "entre 31 e 60", "entre 61 e 90", "entre 91 e 120".
- `overdue_value` ← preferencial V.b + VI.b (totais de "b) Inadimplentes").
- `repurchase_value` ← VII.d.2.
- `acquisitions_value` ← VII.a.2.
- `substitutions_value` ← VII.c.2.
- `disposals_value` ← VII.b.2.
- `guarantees_value` ← 7.1; `guarantees_pct_dc` calculado.
- `scr_status` / `scr_value` ← seção 8.
- `segment_breakdown` ← filhos diretos de II (apenas com valor ≠ 0).
- `maturity_breakdown` ← V.a + VI.a buckets `Até 30`, `31 a 60`, …, `Acima de 1080`.
- `overdue_breakdown` ← V.b + VI.b buckets 30/60/90/120/150/180/360/720/1080/+1080.
- `assignors_breakdown` ← filhos de a.11 + b.11.
- `investors_count` ← X.1.

**Campos novos em `raw_data`** (sem migration):
- `cash_strict_value` ← I.1.
- `cash_ampliado_components` ← objeto com `{ disponibilidades, valoresMobiliarios, tpf, cdb, compromissadas, outrosRF, cotasFIDC, warrants }`.
- `total_assets`, `total_liabilities`.
- `delinquency_30_plus_value`, `delinquency_60_plus_value`, `delinquency_90_plus_value` (e seus `_ratio`).
- `maturity_buckets` (mesmo conteúdo de `maturity_breakdown`, formato `{ bucket, value }`).
- `portfolio_by_segment` (idem).
- `monthly_credit_rights_transactions` = `{ acquisitions:{qty,value}, disposals:{qty,value,book}, substitutions:{qty,value,book}, repurchases:{qty,value,book} }`.
- `quota_monthly_returns` = lista `{ class_name, monthly_return }` da seção X.3.
- `quota_flows` = lista `{ class_name, captacao_valor, captacao_qtd, resgate_valor, resgate_qtd, resgate_pendente_valor, resgate_pendente_qtd, amort_valor_cota, amort_valor_total }` da seção X.4.
- `guarantees` = `{ valor: 7.1, pct_dc: 7.2 }`.
- `scr` = `{ status, valor_devedores: 8.1, valor_operacoes: 8.2 }`.

### 1.4 Cotas/classes (seção X.2)

Mantém leitura iterativa atual, mas:
- Janela limitada a `[anchor("2) Descricao"), anchor("3) Rentabilidade"))`.
- Após o parsing das classes, ler X.3 e fazer match por `norm(className)` para preencher `monthlyYieldPct`.
- Idem X.4 para `subscriptionValue` / `redemptionValue` / `amortizationValue`.
- `seniority_level` classificado por regex: `senior|sr` → senior; `mezanino|mz` → mezzanine; `subordinad|sub` → subordinated; `unica|monoclasse` → unique; senão `unknown`.

### 1.5 Checklist expandido

Adicionar linhas: PL Médio, Caixa Estrito, Caixa Ampliado, Inadimplência 30/60/90/120, Garantias, SCR, Aquisições, Alienações, Substituições, com `section` apontando a âncora usada e `foundLabel` com o rótulo localizado.

### 1.6 Validações

Mantém atual (Ativo−Passivo≈PL, II≈I.2.a+b, PL×cotas). Adiciona:
- "Caixa Ampliado ≥ Caixa Estrito" — se não, `inconsistent`.
- "Soma V.b ≈ overdue_value" — se diferença > 1%, `inconsistent`.

---

## Fase 2 — Consumo na lâmina

Sem alterar a estrutura visual. Pequenos ajustes:

- `FidcDetailPage.tsx` → card **Caixa/PL** continua usando `cash_value` (que agora é Ampliado). Tooltip do card explica "Caixa Ampliado = Disp. + Valores Mob. + TPF + CDB + Compromissadas + Outros RF + Cotas FIDC + Warrants".
- `LaminateCharts.tsx` → painel **Inadimplência por Faixa**: adicionar séries `30+`, `60+`, `90+` lidas de `raw_data.delinquency_*_plus_ratio` quando presentes (mantém 30/60/90/120 individuais).
- `CreditPortfolio.tsx` → bloco **Garantias** lê `raw_data.guarantees`; bloco **SCR** lê `raw_data.scr`; bloco **Fluxo de negócios** lê `raw_data.monthly_credit_rights_transactions` quando disponível (fallback nas colunas dedicadas).
- `QuotasSection.tsx` → tabela "Cotas importadas" mostra colunas `Rent. mês`, `Captação`, `Resgate`, `Amortização` quando vierem.
- Onde uma métrica resultar `null`, manter `NoDataInline` com `title="Não localizado no informe (seção <âncora>)"`.

## Fase 3 — Smoke test

Após edits, abrir uma página de FIDC com informe já importado e verificar console + render. Re-importar 1 mês para popular os novos campos do `raw_data` (avisar o usuário).

---

## Critérios de aceite (do usuário)

- Caixa/PL usa Caixa Ampliado.
- DC = I.2.a + I.2.b.
- PL = IV.a.
- PDD = |I.2.a.10| + |I.2.b.10|.
- Atraso = V.b + VI.b (fallback I).
- Inad. 30/60/90/120 = V.b.1-4 + VI.b.1-4.
- Recompras = VII.d.2.
- Cotistas = X.1.
- Cotas = X.2.
- Rent. = X.3.
- Captação/Resgate/Amort = X.4.
- Garantias = 7).
- SCR = 8).
- Nenhuma métrica ausente vira zero indevido — vira `N/D` com tooltip.
- Checklist mostra a seção e o rótulo encontrado.

## Fora de escopo

- Upload de posições; Cadastro Mestre; sidebar; IA; nova migration.
