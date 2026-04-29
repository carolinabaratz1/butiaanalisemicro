## Nova aba: Desempenho & Agenda

Criar a página `/desempenho` com KPIs de equipe, tabela por analista, calendário de entregas e painel de SLA/acertividade. Acesso restrito a **Gestor** e **Coordenação/Especialista** (no projeto o role é literalmente `'Coordenação/Especialista'`, não `'Coordenador'` — vou usar o valor existente para não quebrar o RBAC).

Tudo será alimentado por **mock estático** nesta primeira versão. Nenhuma alteração em backend/edge functions/RLS.

---

### Arquivos a criar

1. `src/data/desempenhoMock.ts` — interface `AnaliseEntry`, `ANALISES_MOCK` (≈18 entradas Jan–Abr 2026, com 4 analistas fictícios, mix de tipos, ≥2 atrasadas, ≥2 vencidas), constante `SLA_META_DIAS_UTEIS = 7` e lista de feriados nacionais BR 2026.
2. `src/utils/desempenhoUtils.ts` — `diasUteisEntre`, `inicioDoPeriodo`, `calcularMetricasPorAnalista`, `agruparPorDia`, helpers de delta período-anterior e acertividade mensal.
3. `src/pages/DesempenhoPage.tsx` — página principal (topbar + KPIs + tabela + grid inferior + Sheet de detalhe).
4. `src/components/desempenho/PeriodoSelector.tsx` — botões pill 7d/30d/90d/YTD.
5. `src/components/desempenho/KpiCards.tsx` — 4 cards com delta vs período anterior.
6. `src/components/desempenho/TabelaAnalistas.tsx` — tabela clicável que abre o Sheet.
7. `src/components/desempenho/AnalistaSheet.tsx` — Sheet lateral (right, 600px) com KPIs do analista, tempo por etapa do kanban e tabela de análises.
8. `src/components/desempenho/CalendarioEntregas.tsx` — calendário mensal customizado (grid 7 colunas, navegação `<` `>`, pontos coloridos por tipo, Popover por dia).
9. `src/components/desempenho/PainelSlaAcertividade.tsx` — lista de pendentes ordenada por urgência + mini barras dos últimos 6 meses.

### Arquivos a editar

- `src/data/users.ts` — adicionar `/desempenho` ao array `sections` de **Gestor** e **Coordenação/Especialista** (necessário porque o `hasAccess` do `AuthContext` consulta esse mapa).
- `src/components/layout/AppSidebar.tsx` — adicionar item `{ label: 'Desempenho & Agenda', icon: BarChart3, path: '/desempenho' }` em `mainItems`. O filtro existente `filteredMain = mainItems.filter(item => hasAccess(item.path))` já garantirá visibilidade só para perfis autorizados — mantém o padrão do projeto sem hardcode de role no componente.
- `src/App.tsx` — registrar `<Route path="/desempenho" element={<DesempenhoPage />} />` dentro de `ProtectedRoutes`.

### Guard na página

Dentro de `DesempenhoPage`, ler `currentUser.funcao` do `useAuth()` e:

```ts
if (funcao !== 'Gestor' && funcao !== 'Coordenação/Especialista') {
  return <Navigate to="/" replace />;
}
```

---

### Layout (topo → base)

```text
┌─────────────────────────────────────────────────────────────┐
│ Topbar: título | badge perfil | [7d][30d][90d][YTD]         │
├─────────────────────────────────────────────────────────────┤
│ [KPI 1] [KPI 2] [KPI 3] [KPI 4]   (grid-cols-4)             │
├─────────────────────────────────────────────────────────────┤
│ Tabela desempenho por analista (linhas clicáveis → Sheet)   │
├──────────────────────────────┬──────────────────────────────┤
│ Calendário mensal de entregas│ SLA pendentes (top 6)        │
│ + legenda                    │ ─────────────────────────    │
│                              │ Acertividade 6m (mini bars)  │
└──────────────────────────────┴──────────────────────────────┘
```

Em `< lg` o grid inferior colapsa para coluna única.

### Cálculos (resumo das regras)

- **Período**: filtro por `dataInicio >= inicioDoPeriodo(periodo)`.
- **Dias úteis**: contagem excluindo sáb/dom e feriados hardcoded.
- **KPIs**: entregues, prazo médio (dias úteis), aprovação 1ª revisão (%), em atraso. Delta = comparação com a janela imediatamente anterior do mesmo tamanho.
- **Status badge da tabela**:
  - No prazo: `prazoMedio ≤ SLA_META` e nenhuma vencida não entregue.
  - Atenção: `SLA_META < prazoMedio ≤ SLA_META + 1.5`.
  - Em atraso: `prazoMedio > SLA_META + 1.5` ou tem vencida não entregue.
- **Acertividade mensal** (últimos 6 meses): `entreguesNoPrazo / entregues * 100`. Cores: ≥85 verde `#639922`, 70–84 âmbar `#EF9F27`, <70 vermelho `#E24B4A`. Barras altura máx 52px, sem eixo Y.

### Calendário

- Grid 7 colunas, células `min-h-[54px] rounded-md`.
- Pontos por tipo (máx 4, excedente vira `+N`): Corporativo `#378ADD`, FIDC `#EF9F27`, CRI/CRA `#639922`, Financeiro `#7F77DD`, vencido sem entrega `#E24B4A`.
- Dia atual com fundo info claro; feriados com `bg-muted`.
- Click no dia → `Popover` com lista (título, tipo, initials do analista, status pill).

### Sheet do analista

`Sheet` shadcn `side="right"` com `w-[600px]` (custom via className do `SheetContent`). Conteúdo:
1. Header: avatar + nome + badge de status geral.
2. 4 mini KPI cards (entregues / prazo médio / aprovação / em andamento).
3. "Tempo por etapa": 4 cards com média de dias por etapa (`Em análise`, `Revisão`, `Aprovado`, `Concluído`) calculada de `etapasKanban`.
4. Tabela de análises do analista no período (título, tipo, datas, status, aprovação 1ª revisão).

### Detalhes técnicos

- Apenas **Shadcn/ui + Tailwind** existentes; usar `Card`, `Badge`, `Sheet`, `Popover`, `Progress`, `Table`. Ícone do menu: `BarChart3` do `lucide-react`.
- Avatares de analistas: 28px com classes `bg-{cor}-100 text-{cor}-700` (cores `blue/teal/amber/pink/purple`) — incluir as classes na safelist via uso explícito por mapa para evitar purge do Tailwind (mapa `colorClass: Record<AnalistaColor, string>` no componente).
- Toda formatação numérica: `.toFixed(1)` para dias, `Math.round()` para %.
- Datas em ISO no mock; UI em pt-BR (DD/MM/YYYY) usando `toLocaleDateString('pt-BR')`.

### Não-objetivos (fora desta entrega)

- Nenhuma persistência em Supabase, nenhuma migração, nenhuma edge function.
- Nada sobre o erro de "senha rejeitada" nem reimportação de empresas — escopo somente da nova aba.
