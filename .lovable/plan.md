
# Evolução da seção Emissores — Visão de Gestor

Objetivo: transformar Emissores em uma tela de gestão orientada à ação (exposição, análise, limite, alertas), mantendo CNPJ normalizado como chave principal do emissor e ticker apenas no nível de ativo. Nada é alterado em BASE LOTE 45, FIDC Monitor ou Posições.

---

## 1. Backend (migrations + views)

### 1.1. Nova tabela `issuer_limits`
Camada de limites por emissor (reaproveitando padrão do Trade Monitor onde já existe).

- `id uuid pk`
- `cnpj_emissor text not null` (normalizado, dígitos)
- `grupo_economico text`
- `limit_value numeric` (R$)
- `limit_pct_nav numeric` (% do PL)
- `limit_type text` ('valor' | 'percentual' | 'ambos')
- `effective_from date`, `effective_to date`
- `approved_by text`, `committee_date date`
- `source text`, `notes text`
- `created_at`, `updated_at`
- Índice em `cnpj_emissor`
- RLS: leitura para autenticados; escrita para Gestor + Risco e Compliance
- GRANTs conforme padrão do projeto

### 1.2. View / RPC `get_emissores_gestao(p_val_date date default null)`
Retorna uma linha por CNPJ normalizado consolidando:

- Identidade: `cnpj`, `nome`, `grupo_economico`, `setor`
- Rating resolvido via `get_resolved_rating(cnpj)` (mantém hierarquia CNPJ > Grupo)
- Análise vigente: `analise_id`, `status_analise`, `recomendacao`, `analista_id`, `analista_nome`, `data_validade`, `is_vencida`
- Exposição (BASE LOTE 45 na última val_date por fundo):
  - `exposure_total`, `funds_count`, `funds_list jsonb`
  - `largest_fund`, `largest_fund_value`, `largest_fund_pct`
  - `consolidated_pct` = total / soma PL dos fundos onde aparece
- Limite: `limit_value`, `limit_pct_nav`, `usage_ratio`, `limit_status`
- Flags de governança: `sem_cnpj`, `sem_grupo`, `sem_setor`, `sem_rating`, `sem_analise`, `sem_limite`, `analise_vencida_com_posicao`, `acima_do_limite`, `proximo_do_limite`, `cadastro_incompleto`
- `alerts jsonb` — lista consolidada de alertas com severidade

A função é `SECURITY DEFINER`, `STABLE`, usa CTEs para não estourar timeout.

---

## 2. Frontend — Tabela principal `/emissores`

### 2.1. Cards de resumo (10)
Grid responsivo no topo. Cada card respeita filtros ativos:
Exposição total, Emissores com posição, Análise vencida, Exposição vencida, Sem análise, Exposição sem análise, Sem limite, Acima do limite, Próximo do limite, Alerta crítico.

### 2.2. Filtros
Barra de filtros compacta (Popover com seções):
- Busca (emissor / CNPJ / grupo)
- Selects: Grupo, Setor, Rating, Status Análise, Recomendação, Analista, Fundo
- Toggles tri-state: Com posição, Análise vencida, Com limite, Acima do limite, Próximo do limite, Com alerta
- Select "Ação necessária" (multi): análise vencida, sem análise, sem limite, acima do limite, próximo do limite, rating ausente, CNPJ não mapeado, cadastro incompleto

### 2.3. Nova tabela
Colunas (sem ticker): Emissor, CNPJ, Grupo, Setor, Rating (`<RatingBadge/>`), Status Análise, Recomendação, Exposição Total, % PL Consolidado, Fundos, Maior Fundo, % PL Maior Fundo, Limite, Uso do Limite (barra colorida), Próx. Vencimento Análise, Analista, Alertas (ícones + tooltip), Ações.

Ordenação, exportação XLSX, densidade compacta.

---

## 3. Página individual `/emissores/:cnpj`

### 3.1. Header enriquecido
Nome, CNPJ, Grupo, Setor, RatingBadge, Status Análise, Recomendação, Exposição atual, Uso do limite, Próximo vencimento da análise.

### 3.2. Aba "Visão Geral" (aprimorada)
10 cards + 4 gráficos: Exposição por fundo (bar), Evolução da exposição (line, últimas val_dates), Vencimentos por ano (bar), Distribuição por tipo de ativo (pie).

### 3.3. Aba **nova**: "Limites e Enquadramento"
- Painel resumo: Limite, Exposição, Uso, Folga, Status, Fonte, Data, Comitê, Observações
- Tabela por fundo: exposição, %PL, target (se existir), limite máximo, folga, status
- Gráfico de barras comparando exposição × target × limite por fundo
- Botão "Editar limite" (Gestor/Risco) abre dialog CRUD em `issuer_limits`
- Histórico de limites (versões anteriores)

### 3.4. Aba **nova**: "Agenda e Pendências"
Lista derivada dos alertas + validade da análise: Pendência, Responsável, Prazo, Prioridade (alta/média/baixa por regra), Status, Observações, Ações (ex.: "Abrir análise", "Cadastrar limite").

### 3.5. Aba "Rating e Mercado" (renomeada de Histórico de Rating)
- Rating atual (CNPJ) + agência + fonte + data
- Histórico da tabela `issuer_ratings`
- Tickers/ativos relacionados (via `emissoes` e `trade_ativos`)
- Spread médio (join com `trade_metricas` quando disponível)

### 3.6. Aba "Ativos em Carteira" (mantida, enriquecida)
Colunas: Ticker, Ativo, Tipo, ISIN, Fundo, Valor, %PL, Taxa, Vencimento, Duration, Rating emissor, Status análise, Recomendação.

### 3.7. Aba "Análises" (mantida)
Fluxo atual preservado.

---

## 4. Governança de dados
Diagnósticos gerados pela mesma RPC alimentam:
- Cards de resumo
- Filtro "Ação necessária"
- Aba Agenda e Pendências

---

## 5. Arquivos afetados

**Novos**
- `supabase/migrations/<ts>_issuer_limits_and_gestao_rpc.sql`
- `src/hooks/useEmissoresGestao.ts`
- `src/components/emissores/EmissoresSummaryCards.tsx`
- `src/components/emissores/EmissoresFilters.tsx`
- `src/components/emissores/EmissoresTable.tsx` (nova, substitui a renderização atual)
- `src/components/emissores/LimitUsageBar.tsx`
- `src/components/emissores/AlertBadges.tsx`
- `src/components/emissores/detail/LimitesEnquadramentoTab.tsx`
- `src/components/emissores/detail/AgendaPendenciasTab.tsx`
- `src/components/emissores/detail/RatingMercadoTab.tsx`
- `src/components/emissores/detail/IssuerLimitDialog.tsx`

**Editados**
- `src/pages/EmpresasPage.tsx` — troca tabela por versão gestão, cards e filtros
- `src/pages/EmpresaDetailPage.tsx` — reorganiza abas, header enriquecido, cards
- Ajustes leves em componentes existentes de análises/ativos apenas para exibir status/recomendação já disponíveis

**Não tocar**
- Upload BASE LOTE 45, importadores, FIDC Monitor, Posições, `src/integrations/supabase/*`.

---

## 6. Ordem de implementação
1. Migration: `issuer_limits` + RPC `get_emissores_gestao`
2. Hook + tabela principal + cards + filtros
3. Header e Visão Geral aprimorada
4. Aba Limites e Enquadramento + dialog
5. Aba Agenda e Pendências
6. Aba Rating e Mercado
7. Enriquecer Ativos em Carteira
8. Validar critérios de aceite

Escopo grande — proponho executar em duas entregas: **(A)** backend + tabela principal + cards/filtros; **(B)** página individual completa (abas novas). Confirma para eu começar pela entrega A?
