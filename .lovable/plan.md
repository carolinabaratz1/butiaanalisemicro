## Conectar Desempenho & Agenda com dados reais

Substituir `ANALISES_MOCK` por queries reais no Supabase, mantendo intactos os componentes visuais, os tipos `AnaliseEntry` / `AnalistaMetrica` e as funções de cálculo em `desempenhoUtils.ts`.

---

### 1. Mapeamento Supabase → `AnaliseEntry`

Não existe tabela `pipeline_historico`. Vamos derivar tudo a partir de **`analises`** + **`pipeline_eventos`** + **`profiles`** + **`empresas`** (todas já existentes).

Tabela `analises` (campos existentes confirmados):
- `id`, `empresa_id` (CNPJ), `tipo` (`Crédito Privado` | `Ações`), `status` (`Pendente` | `Em Análise` | `Concluída` | `Aprovada` | `Reprovada` | `Vencida c/ Alocação` | `Vencida s/ Alocação`)
- `analista_responsavel` (UUID do profile, ou nome em registros legados)
- `data_inicio`, `prazo`, `data_conclusao`, `data_comite` (todos `text` ISO)
- `versao`

Tabela `pipeline_eventos`: `analise_id`, `acao`, `etapa_anterior`, `etapa_nova`, `created_at`. Usada para reconstruir `etapasKanban` (entrada/saída de cada etapa do kanban).

Tabela `empresas`: usada para derivar o `tipo` visual (`Corporativo` | `FIDC` | `CRI` | `CRA` | `Financeiro`) a partir de `empresas.tipo` + `empresas.setor`.

Tabela `profiles`: para buscar `nome` e `initials` do analista (lendo `analises.analista_responsavel` como UUID; fallback para o próprio texto se não for UUID).

**Mapeamentos:**

| `AnaliseEntry` | Origem |
|---|---|
| `id` | `analises.id` |
| `titulo` | `empresas.nome` (lookup por CNPJ); fallback `empresa_id` |
| `tipo` | derivado: `empresas.tipo='FINANCEIRO'`→`Financeiro`; `empresas.tipo='FIDC'` ou `setor='FIDC'`→`FIDC`; `setor` contém `CRI`→`CRI`; `setor` contém `CRA`→`CRA`; senão → `Corporativo` |
| `analistaId` / `analistaNome` / `analistaInitials` | `profiles` por UUID; iniciais = primeiras letras do nome |
| `analistaColor` | derivado por índice estável (hash do `analistaId` → `blue/teal/amber/pink/purple`) |
| `dataInicio` | `analises.data_inicio` |
| `dataEntrega` | `analises.prazo` (fallback: `data_inicio + SLA_META`) |
| `dataEntregueEm` | `data_conclusao` quando `status` ∈ {`Concluída`,`Aprovada`,`Reprovada`,`Vencida c/ Alocação`,`Vencida s/ Alocação`}; senão `undefined` |
| `aprovadoPrimeiraRevisao` | `status === 'Aprovada'` (proxy — não temos contagem de revisões) |
| `statusEntrega` | derivado da regra do enunciado (sem entrega + prazo<hoje → `atrasado`; sem entrega + prazo ok → `em_andamento`; entregue ≤ prazo → `no_prazo`; entregue > prazo → `atencao`). Quando entregue, usar `entregue` se houver demanda, senão manter `no_prazo`/`atencao`. |
| `etapasKanban` | reconstruído de `pipeline_eventos` filtrando `etapa_nova` ∈ {`Em Análise`,`Concluída`,`Aprovada`} → renomeados para o enum visual (`Em análise`/`Revisão`/`Aprovado`/`Concluído`); `entradaEm` = `created_at` do evento, `saidaEm` = `created_at` do próximo evento |

---

### 2. Novo hook `src/hooks/useDesempenhoData.ts`

```ts
useDesempenhoData(periodo: Periodo): {
  analises: AnaliseEntry[];
  isLoading: boolean;
  isError: boolean;
}
```

Implementação com TanStack Query (já presente no projeto):

1. `queryKey: ['desempenho', periodo]`.
2. Calcular `inicio = inicioDoPeriodo(periodo)`.
3. Em paralelo (`Promise.all`):
   - `supabase.from('analises').select('id,empresa_id,tipo,status,analista_responsavel,data_inicio,prazo,data_conclusao,versao').gte('data_inicio', isoInicio)`
   - `supabase.from('empresas').select('cnpj,nome,tipo,setor')`
   - `supabase.from('profiles').select('id,nome').eq('status','Ativo')`
4. Após receber as análises, buscar:
   - `supabase.from('pipeline_eventos').select('analise_id,acao,etapa_anterior,etapa_nova,created_at').in('analise_id', ids).order('created_at',{ascending:true})`
5. Aplicar mapeamentos da tabela acima em memória e retornar `AnaliseEntry[]`.
6. `onError`: disparar `toast.error('Erro ao carregar dados de desempenho. Tente novamente.')` (sonner) e retornar `[]`.

---

### 3. Atualizar `DesempenhoPage.tsx`

- Remover `import { ANALISES_MOCK } from '@/data/desempenhoMock'`.
- Usar `const { analises, isLoading, isError } = useDesempenhoData(periodo);`
- `ref` passa a ser `new Date()` (não depende mais de datas mock).
- Substituir `ANALISES_MOCK` por `analises` em `filtrarPorPeriodo` e em `<PainelSlaAcertividade ... todasParaAcertividade={analises} />`.
- Renderização condicional:
  - **Loading**: cards de KPI com `<Skeleton>` (4 blocos), tabela de analistas com 4 linhas `<Skeleton>`, calendário com spinner centralizado (`Loader2` animado).
  - **Vazio** (`!isLoading && analises.length === 0`): KPIs zerados (passar arrays vazios — já funciona); tabela com empty state (ícone `BarChart3` + texto "Nenhuma análise encontrada no período selecionado"); painel SLA com texto "Nenhuma entrega pendente".
- Manter o guard de perfil intacto.

Pequena adição nos componentes-filhos quando necessário:
- `KpiCards`: aceitar prop `loading?: boolean` para alternar valores ↔ skeletons.
- `TabelaAnalistas`: aceitar `loading?: boolean` e renderizar skeleton/empty state.
- `CalendarioEntregas`: aceitar `loading?: boolean` e mostrar spinner.
- `PainelSlaAcertividade`: já trata listas vazias; só ajustar texto do empty.

Sem alterações em `desempenhoUtils.ts` nem em `desempenhoMock.ts` (mantido apenas como fonte de tipos e constantes — `AnaliseEntry`, `SLA_META_DIAS_UTEIS`, `FERIADOS_BR_2026`).

---

### 4. Detalhes técnicos

**Iniciais do analista:** primeiras letras do primeiro e último nome (`Lucas Almeida` → `LA`).

**Cor estável:** `colors[hash(analistaId) % 5]` com `colors = ['blue','teal','amber','pink','purple']`.

**Reconstrução de etapas a partir de `pipeline_eventos`:** ordenar eventos da análise por `created_at`; sequência tipica observada no DB: `criada → analista_atribuido → etapa_alterada (Pendente→Em Análise) → concluida (→Concluída) → aprovado (→Aprovada)`. Mapeamento de `etapa_nova`:
- `Em Análise` → `Em análise`
- `Concluída` → `Revisão` (etapa que precede aprovação)
- `Aprovada` → `Aprovado`
- Última etapa quando `data_conclusao` existe → `Concluído` com `saidaEm = data_conclusao`

**Resiliência a `analista_responsavel` em texto:** se não bater com nenhum UUID do `profiles`, usar o próprio valor como `analistaNome`/`analistaId` e gerar iniciais a partir dele.

---

### 5. Arquivos tocados

- **Criar**: `src/hooks/useDesempenhoData.ts`
- **Editar**: `src/pages/DesempenhoPage.tsx`, `src/components/desempenho/KpiCards.tsx`, `src/components/desempenho/TabelaAnalistas.tsx`, `src/components/desempenho/CalendarioEntregas.tsx`, `src/components/desempenho/PainelSlaAcertividade.tsx` (apenas para aceitar `loading` e tratar vazio)
- **Não tocar**: `src/utils/desempenhoUtils.ts`, `src/data/desempenhoMock.ts` (mantido como fonte de tipos), guard de rota, `AppSidebar`, `users.ts`
