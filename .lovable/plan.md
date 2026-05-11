
# Módulo de Alocação de Carteira — aba "Alocação" no /trade

## 1. Banco de dados (migração Supabase)

Criar duas tabelas + seed:

- **`allocation_limits`** — limites gerenciais por fundo. Campos: `fundo`, `categoria` (`tipo_ativo`|`indexador`|`rating`|`emissor`), `subcategoria`, `limite_pct` (NULL = sem limite). Unique(fundo,categoria,subcategoria). Seed com todos os valores das 4 tabelas do spec (TOP_CP, TOP_PREV, PLUS_CP_RF, Debentures_INFRA_RF).
- **`allocation_targets`** — targets editáveis. Campos: `fundo`, `tipo_ativo`, `target_pct`, `updated_at`, `updated_by`. Unique(fundo,tipo_ativo).
- **RLS:** SELECT para `authenticated`; INSERT/UPDATE/DELETE em `allocation_targets` apenas para `Gestor` e `Coordenação/Especialista` (uso em vez de `risco_compliance`, que não existe nos roles atuais — ver Pergunta 1). `allocation_limits` editável apenas por Gestor.

## 2. Estrutura de arquivos novos

```text
src/components/alocacao/
  AlocacaoPage.tsx          # container com tabs internas
  FundLimitsPanel.tsx       # Sub-seção 1 (3 painéis colapsáveis)
  IssuerExposurePanel.tsx   # Sub-seção 2 (grupo econômico)
  TargetsPanel.tsx          # Sub-seção 3 (editável inline)
  useAllocationData.ts      # hook que agrega posicoes + emissoes + empresas + limites
  allocationUtils.ts        # mapeamento product_class→tipo_ativo, status, badges
```

## 3. Integração no /trade

Atualmente `TradeMonitorPage` usa um landing (`mode = DI_SPREAD|CDI_PCT|IPCA`) e não tabs. Adicionar **4ª opção "Alocação"** no `TradeLanding` (e em `TradeMode`) que, quando selecionada, renderiza `<AlocacaoPage/>` em vez de Dashboard/Tabela. Header mostra badge "Alocação" e botão "Trocar". Não compartilha o seletor de fundo do header (a Alocação tem seu próprio seletor por sub-seção).

## 4. Sub-seção 1 — Visão por Fundo

- Seletor de fundo (4 valores hardcoded). Estado compartilhado com Sub-seção 2 via context local na `AlocacaoPage`.
- 3 painéis `<Collapsible>` (Tipo de Ativo, Indexador, Faixa de Rating).
- Cada linha: Limite, Posição Atual (%), Headroom, Status badge.
- **Cálculo da posição (%):** `sum(financial_price das posicoes do fundo no grupo) / sum(financial_price total do fundo)`. Filtro pela `val_date` mais recente disponível em `posicoes`.
- **Mapeamento `product_class`/`product` → tipo_ativo** definido em `allocationUtils.ts` (heurística inicial: Debênture/NP→Corporativo; CDB/LF→Financeiro; FIDC Sr/Sub/NP via `product`; Cota de Fundo via `product_class`; Caixa via "Compromissada/Tit Pub"). Ver Pergunta 2.
- **Indexador:** lookup via `trade_ativos.sub_indexador` cruzado pelo ticker da posição (via `emissoes.isin` → `emissoes.ticker` → `trade_ativos`).
- **Rating:** `empresas.rating` (lookup por CNPJ via `emissoes`).
- Status: 🔴 EXCEDIDO (>limite), 🟡 ALERTA (>80%), 🟢 OK, ⚪ SEM LIMITE / AGUARDANDO DADOS.

## 5. Sub-seção 2 — Enquadramento por Emissor / Grupo Econômico

- Tabela ordenada por % do PL desc.
- Agrupa posições por `empresas.grupo_economico` (fallback para `empresas.nome` se grupo for null). Ver Pergunta 3.
- Colunas: Grupo, Emissores (lista de nomes), Rating (pior do grupo), Limite por Emissor (%), % do PL, Headroom, Status.
- Limite vem de `allocation_limits` categoria `emissor` × pior rating do grupo × fundo.
- Click no nome do emissor → `/empresas/{id}` (rota `EmpresaDetailPage`).
- Estado vazio com mensagem do spec.

## 6. Sub-seção 3 — Targets de Alocação

- Tabela com 1 linha por (fundo × tipo_ativo). Tipos de ativo derivados das chaves do `allocation_limits.categoria='tipo_ativo'`.
- Coluna Target editável: `<Input>` inline; onBlur/Enter faz upsert em `allocation_targets`.
- Botão "Salvar Todos" envia batch upsert.
- Status DENTRO/ACIMA DO LIMITE (vermelho se Target > Limite Gerencial).
- Permissão de edição: roles `Gestor` e `Coordenação/Especialista`. Demais → readonly + tooltip.

## 7. Visual

- Mesmo design system (Shadcn + tokens). Badges via `variant` `destructive`/`secondary`/`outline` mais classes utilitárias para amarelo/verde já presentes no projeto.
- Skeleton loaders durante fetch. Tabelas com `overflow-x-auto`.

## Detalhes técnicos

- `useAllocationData(fundo)` retorna `{ posicaoTotal, agrupadoPorTipo, agrupadoPorIndexador, agrupadoPorRating, agrupadoPorGrupo, loading }` usando React Query com chave `['alocacao', fundo, valDate]`.
- Identificação do "fundo" na tabela `posicoes`: usa `trading_desk_share_source`. Os valores reais precisam casar com TOP_CP / TOP_PREV / PLUS_CP_RF / Debentures_INFRA_RF — ver Pergunta 4.
- Para sub-seção 1, o threshold 80% vem de constante exportada em `allocationUtils.ts`.

## Perguntas a resolver antes de implementar

1. Não existe role `risco_compliance` no projeto (roles atuais: `Gestor`, `Coordenação/Especialista`, `Analista`, `Consulta`). Posso usar `Gestor` + `Coordenação/Especialista` como editores dos targets?
2. Confirmar mapeamento `product_class`/`product` → tipo_ativo (Corporativo, Financeiro, FIDC Sr, FIDC Sub, FIDC NP, Cotas, Caixa, Termo ≤60d, Termo >60d). Posso enviar a heurística e você ajusta depois, ou tem uma tabela de referência?
3. O campo `grupo_economico` em `empresas` é nullable. Quando NULL, agrupar pelo próprio nome do emissor — ok?
4. Quais valores exatos aparecem em `posicoes.trading_desk_share_source` para identificar TOP_CP, TOP_PREV, PLUS_CP_RF e Debentures_INFRA_RF? (Ou existe um mapeamento fundo→source que eu deva criar?)
