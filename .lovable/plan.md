
# Dashboard do Fundo — nova aba em PosicoesPage

Adiciona uma terceira aba ao `Tabs` existente sem tocar em "Tabela" nem em "Painel Analítico". Toda a lógica nova vive em arquivos novos.

## Ajustes ao spec (campos que não existem no schema atual)

Validei o schema antes de planejar. Alguns campos do SELECT proposto precisam de ajuste — descrição abaixo, pedindo confirmação se quiser tratar diferente:

1. `posicoes.ticker` — **não existe**. Vou trazer o `ticker` via `emissoes.ticker` (join por ISIN).
2. `posicoes.vencimento` — **não existe**. Vou usar `emissoes.venc_date` (campo `date`) como `vencimento`.
3. `empresas.nome_fantasia` — **não existe**. Empresas tem `nome`. Vou usar `emp.nome AS nome_emissor`.
4. Não há filtro por `val_date` no spec. `posicoes` guarda múltiplas datas; sem filtro o financeiro soma todas. Vou usar a **última `val_date` daquele fundo** (`MAX(val_date)` por `trading_desk_share_source`) para evitar duplicação. Se preferir somar tudo, removo o filtro.

## Tarefa 1 — Migration: RPC `get_posicoes_dashboard_fundo`

`SECURITY DEFINER`, `STABLE`, `SET search_path = public`, `GRANT EXECUTE` para `authenticated`.

```sql
CREATE OR REPLACE FUNCTION public.get_posicoes_dashboard_fundo(p_fundo text)
RETURNS TABLE (
  ticker text, isin text, product_class text,
  financial_price numeric, amount numeric, duration_du numeric,
  vencimento date, fundo text, rating text,
  indexador text, sub_indexador text,
  setor text, grupo_economico text,
  nome_emissor text, codigo_emissor text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH last_dt AS (
    SELECT MAX(val_date) AS v FROM posicoes WHERE trading_desk_share_source = p_fundo
  )
  SELECT
    em.ticker, p.isin, p.product_class,
    p.financial_price, p.amount, p.duration_du,
    em.venc_date AS vencimento,
    p.trading_desk_share_source AS fundo,
    COALESCE(ta.rating, emp.rating) AS rating,
    COALESCE(ta.indexador, 'Outros') AS indexador,
    COALESCE(ta.sub_indexador, 'Outros') AS sub_indexador,
    emp.setor, emp.grupo_economico,
    emp.nome AS nome_emissor, emp.codigo_emissor
  FROM posicoes p
  LEFT JOIN emissoes em      ON em.isin = p.isin
  LEFT JOIN trade_ativos ta  ON ta.ticker = em.ticker
  LEFT JOIN empresas emp     ON emp.cnpj = em.cnpj_emissor
  WHERE p.trading_desk_share_source = p_fundo
    AND p.financial_price > 0
    AND p.val_date = (SELECT v FROM last_dt);
$$;

GRANT EXECUTE ON FUNCTION public.get_posicoes_dashboard_fundo(text) TO authenticated;
```

## Tarefa 2 — `src/hooks/useFundoDashboard.ts`

- Recebe `fundo: string | null`; `useQuery` desabilitado quando null.
- `supabase.rpc('get_posicoes_dashboard_fundo', { p_fundo: fundo })`.
- Retorna `{ data, isLoading, error }` onde `data` já vem com todas as agregações memoizadas:
  - `byTipo`, `byIndexador` — soma de `financial_price` agrupada.
  - `byRating` — agrupada e reordenada na sequência fixa `AAA, AA+, AA, AA-, A+, A, A-, BBB+, BBB, BBB-, <BBB, S/R` (rating nulo/vazio → `S/R`; ratings fora da lista caem em `<BBB`).
  - `bySetor`, `byGrupo` — top 10 desc.
  - `byDuration` — buckets `0–1a` (≤252), `1–3a` (253–756), `3–5a` (757–1260), `5–7a` (1261–1764), `>7a` (>1764).
  - `byEmissor` — soma por `codigo_emissor` (fallback `nome_emissor` quando código vazio) com `{ codigo, nome, rating, setor, grupo, financeiro, pctPL, duration (média ponderada), produtos (set→string) }`, desc.
  - `totalPL` — soma de `financial_price`.
  - `totalAtivos` — `new Set(ticker)`.size (ignora null).
  - `durationMedia` — Σ(duration_du · financial_price) / Σ financial_price.
  - `spreadMedio` — `null` por ora.
  - `topConcentracao` — `{ nome, pct }` do maior emissor.
  - `qualidadeMedia` — rating mais frequente ponderado por financeiro (usado no KPI 5).

## Tarefa 3 — `src/components/posicoes/FundoDashboard.tsx`

- Estado local: `const [fundo, setFundo] = useState<string|null>(null)` — **independente** do filtro global.
- Header: `Select` (shadcn) populado por `useFundos()`, label "Selecione o fundo", placeholder "Escolha um fundo para visualizar o dashboard".
- Estado vazio (`!fundo`): `Card` central com ícone (`BarChart3` lucide) + texto.
- Estado loading: `Skeleton`s nos cards e gráficos.
- Seção 1 — 5 `Card`s em `grid grid-cols-5 gap-3` (responsivo `md:grid-cols-2 xl:grid-cols-5`):
  - PL Total (R$ M, 1 casa), Nº Ativos, Duration Médio (`d.u.`), Maior Concentração (`nome · pct%`), Qualidade Média (rating).
- Seção 2 — `grid grid-cols-2 gap-4` com 6 `Card`s, cada um com título + `ResponsiveContainer` (height 260) de Recharts:
  - [0,0] Tipo de Ativo — donut `PieChart` (`innerRadius={55}`), legenda inline.
  - [0,1] Indexador — donut idem.
  - [1,0] Rating — `BarChart layout="vertical"`.
  - [1,1] Setor TOP 10 — `BarChart layout="vertical"`.
  - [2,0] Duration — `BarChart` vertical simples (buckets no eixo X).
  - [2,1] Grupo Econômico TOP 10 — `BarChart layout="vertical"`.
  - Cores via tokens (`hsl(var(--primary))`, `--chart-1..5` se existirem; senão paleta derivada de `--primary`).
  - Tooltip custom mostra `R$ X,XM` + `XX,X%` do total.
- Seção 3 — `Table` shadcn (size sm, zebrada via `[&_tr:nth-child(even)]:bg-muted/30`), `max-h-[400px] overflow-auto`:
  - Cols: Emissor | Grupo | Setor | Rating | Financeiro (R$) | % do PL | Duration (d.u.) | Produto.
  - Ordenada por financeiro desc; sem paginação.

## Tarefa 4 — Integração em `PosicoesPage.tsx`

Mudanças cirúrgicas (apenas 3 trechos):

1. Import: `import { FundoDashboard } from '@/components/posicoes/FundoDashboard';`
2. `TabsList` (linha 725-728): adicionar `<TabsTrigger value="dashboard" ...>Dashboard do Fundo</TabsTrigger>` após o trigger existente.
3. Após o `TabsContent value="analitico"` (linha 1078): adicionar
   ```tsx
   <TabsContent value="dashboard" className="mt-3">
     <FundoDashboard />
   </TabsContent>
   ```

Nada mais é alterado. Abas "tabela" e "analitico", filtros globais e hooks existentes permanecem intactos.

## Arquivos

- **novos**: `supabase/migrations/<ts>_get_posicoes_dashboard_fundo.sql`, `src/hooks/useFundoDashboard.ts`, `src/components/posicoes/FundoDashboard.tsx`.
- **editado**: `src/pages/PosicoesPage.tsx` (3 inserções).

Confirma os 4 ajustes do schema (especialmente o filtro por última `val_date`)? Posso seguir com qualquer alternativa que você indicar.
