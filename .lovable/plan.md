## Novo Dashboard Setorial no Monitor de Trade

Adicionar uma **segunda visão de Dashboard** dentro do Monitor de Trade (DI+, %CDI e IPCA+), focada em **análise por setor / emissor**, no estilo da página de mercado secundário do relatório ABC Brasil.

### 1. Onde fica

No header já existente do Monitor (`TradeMonitorPage.tsx`), o toggle hoje tem dois botões:
`Dashboard | Emissões`. Vira **três botões**:

```
Dashboard Geral  |  Setorial  |  Emissões
```

O "Dashboard Geral" é o atual (KPIs, distribuição por rating, vencimento, spread mediano). "Setorial" é o novo. "Emissões" continua sendo a tabela.

### 2. Layout do Dashboard Setorial (referência: imagem ABC)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Setor: [Saneamento ▼]   Rating: [Todos ▼]   Janela: [30d 90d 1a]    │
├──────────────────────────────────┬──────────────────────────────────┤
│                                  │  Mediana de spread — Setor       │
│   Scatter: Spread × Duration     │  (linha histórica + barras vol)  │
│   (cores = rating)               ├──────────────────────────────────┤
│   Labels nos tickers do setor    │  Mediana de spread — Emissor     │
│   selecionado                    │  selecionado (linha + barras)    │
│                                  │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│ Tabela de tickers do setor: Ticker · Emissor · Rating · Duration ·  │
│ Spread atual · Δ 21d · Z-score · Vol 90d · Última negociação        │
└─────────────────────────────────────────────────────────────────────┘
```

**Componentes:**

- **Filtros no topo**
  - `Setor` — lista distinta vinda de `empresas.setor` (apenas setores que possuem ticker no universo atual). Default = primeiro setor com mais emissões.
  - `Rating` — multiselect (AAA, AA+, AA, A+, A, BBB, N/R). Default = todos.
  - `Janela` da série temporal: 30d / 90d / 1a (default 90d).

- **Scatter "Spread × Duration"** (a peça principal — copia o gráfico esquerdo da imagem ABC)
  - Eixo X: `anos_venc` (duration aproximada).
  - Eixo Y: `last_val` (spread em bps para DI+/IPCA+; %CDI no modo CDI_PCT).
  - Cor do ponto = rating normalizado (mesma paleta `RATING_COLORS` já usada).
  - Tickers do **setor selecionado** ficam destacados (label visível + halo amarelo, igual marcação amarela da imagem).
  - Tickers de outros setores continuam plotados em cinza claro como pano de fundo (opcional via toggle "Comparar com universo").
  - Clique em um ponto → seta o ticker selecionado (abre o `TradeDetail` lateral, mesmo padrão atual).
  - Legenda de rating embaixo, igual ao relatório.

- **Mediana de Spread — Setor** (gráfico topo direito da imagem)
  - Linha = mediana móvel 10 negociações do spread do setor.
  - Barras cinzas = volume financeiro diário agregado do setor.
  - Pontos verdes = mediana diária por data.

- **Mediana de Spread — Emissor selecionado** (gráfico inferior direito da imagem)
  - Mesmo formato, restrito ao emissor do ticker selecionado (ou ao maior emissor do setor se nada selecionado).

- **Tabela de tickers do setor** abaixo dos gráficos
  - Sortable / filtrável (mesma `SortableHeader` já usada nos painéis de Alocação).
  - Clique na linha = seleciona ticker.

### 3. Dados — sem novas tabelas

Tudo já existe:

- `trade_monitor_view` (já carregado por `useTradeData`) traz `emissor_cnpj`, `rating`, `anos_venc`, `last_val`, `total_vol_fin`, `z_score`, `avg_21d`.
- `empresas.setor` é o setor — fazer **join client-side** carregando uma vez `empresas (cnpj, setor, nome, grupo_economico)` num novo hook leve `useEmpresasSetor()`.
- Para a série histórica do setor / emissor, reaproveitar:
  - IPCA: `trade_spread_historico` (já paginado em `useTradeData`).
  - DI / %CDI: `history` por ticker (já no estado).
  - Agregar mediana por dia no client (mesma técnica do `spreadSeries` atual em `TradeDashboard`).

Sem migração necessária nesta etapa.

### 4. Arquivos a criar / editar

**Criar:**
- `src/components/trade/TradeSectorDashboard.tsx` — o novo dashboard (filtros + scatter + 2 gráficos de mediana + tabela).
- `src/hooks/useEmpresasSetor.ts` — fetch único de `cnpj → { setor, nome, grupo }`, cacheado.

**Editar:**
- `src/components/trade/TradeMonitorPage.tsx` — adicionar terceira opção no toggle `view` (`"sector"`) e renderizar `TradeSectorDashboard` quando ativa, passando `filteredData`, `history`, `mode`, `modeColor`, `onSelectTicker`.
- (opcional) extrair `RATING_COLORS` / `normRating` de `TradeDashboard.tsx` para `src/components/trade/tradeColors.ts` para reuso.

### 5. Detalhes técnicos

- Scatter implementado com `recharts` `<ScatterChart>` + `<Scatter>` por rating (uma série por rating → cores automáticas via `Cell`). Labels só nos pontos do setor selecionado (custom `<LabelList>` com `content` que omite outros).
- Mediana móvel de 10 negociações = janela móvel sobre as observações ordenadas por data, não por dia calendário.
- Tooltip do scatter mostra: ticker, emissor, rating, duration (anos), spread, volume 90d.
- Performance: dataset típico ~500 tickers — sem problema no client. Joins com `empresas` em memória.
- Tema: cores via `useChartTheme()` (já existe), nada hardcoded fora do mapa de rating.
- Modo `%CDI`: o eixo Y vira "% do CDI" (sem multiplicar por 100), mantém a mesma estrutura.
- Acessibilidade: `aria-label` no scatter, navegação por teclado entre pontos via `tabIndex` opcional.

### 6. Fora de escopo nesta etapa

- Exportar PNG/PDF do gráfico (pode vir depois).
- Drill-down por emissor abrindo nova página (já existe via `onViewEmissor` na `TradeDetail`).
- Persistir filtro de setor selecionado por usuário.
