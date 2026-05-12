## Escopo

Ajustes na função **Alocação** (Trade Monitor → Alocação), aplicados às 3 abas: Visão por Fundo, Enquadramento por Emissor e Targets de Alocação.

---

### 1. Visão por Fundo

**1.1 Limites por Tipo de Ativo**
- Criar a categoria **"Crédito Privado"** como agregador (soma de Crédito Corporativo + Crédito Financeiro + FIDC Cota Sênior + FIDC Subordinado + FIDC NP). Limite atual da linha continua 100%.
- As subcategorias continuam aparecendo individualmente abaixo, mas a primeira linha mostra o total agregado.

**1.2 Limites por Indexador** — reclassificar:
- **Termo** → tratado como **Pré** (taxa fixada na entrada).
- **LFT / Overnight / Compromissadas** → **%Selic**.
- **FIDC** → **CDI+**.
- **Debêntures** → usar `sub_indexador` registrado em `trade_ativos` (já existe — manter).
- **Ativos financeiros/bancários (CDB, LF, LCI, LCA)** sem `sub_indexador` → fallback parseando a descrição do produto (procura "CDI+", "%CDI", "IPCA+", "PRE") antes de cair em "Outros".

**1.3 Limites por Faixa de Rating**
- **Termo** → forçar bucket **AAA** (risco principal é B3).

**Exclusão geral do PL**: Posições cujo `product`/`product_class` contenham **DAP** ou **Futuro** são removidas do `totalFundo` e de todas as agregações (não contam como posição).

---

### 2. Enquadramento por Emissor

- Adicionar **headers clicáveis** com sort em todas as colunas (Grupo, Emissores, Rating, Limite, % do PL, Headroom, Status) e um campo de **busca** (filtra por nome de grupo/emissor).
- **Tesouro Nacional** → tratado como categoria **Soberano** com limite 100% (independente do rating). Adicionar registro em `allocation_limits` (categoria = `emissor`, subcategoria = `Soberano`, 100%).
- **Termo** → não listar como emissor; agregar em uma linha-resumo final **"Termo (B3)"** com somatório do %, complementando o 100% do fundo.
- Mesma exclusão de **DAP/Futuros** do PL aplicada aqui.

---

### 3. Targets de Alocação — versionamento + por emissor

**3.1 Histórico de políticas (período de vigência ~12 meses)**
- Nova tabela `allocation_target_periods` (id, fundo, nome, data_inicio, data_fim, ativo, created_by, timestamps). Apenas **um período ativo por fundo**.
- Alterar `allocation_targets`: adicionar `period_id` (FK) e mudar unique para `(period_id, tipo_ativo)`. Migrar registros existentes para um período inicial "Política vigente".
- UI:
    - Seletor de **Período** no topo da aba (com botão "Novo período" — cria período novo e copia targets do anterior).
    - Edição só no período ativo; períodos antigos são read-only (visualização histórica).

**3.2 Targets por Emissor**
- Nova tabela `allocation_targets_emissor` (period_id, fundo, cnpj_emissor, target_pct, updated_by, timestamps), unique `(period_id, fundo, cnpj_emissor)`.
- Nova sub-aba dentro de "Targets de Alocação": **"Por Emissor"** — lista emissores cadastrados em `empresas` (pesquisa + filtro por fundo) e permite definir target % por emissor no período ativo. Será consumido futuramente pelo módulo Trade.

---

### Detalhes técnicos

**Migrações SQL (uma migration consolidada):**
```sql
-- 1. Períodos de target
CREATE TABLE public.allocation_target_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundo text NOT NULL,
  nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_target_period_active
  ON allocation_target_periods(fundo) WHERE ativo;

-- 2. Liga targets ao período
ALTER TABLE allocation_targets ADD COLUMN period_id uuid REFERENCES allocation_target_periods(id);
-- popular um período "Política inicial" por fundo e backfill
-- depois: tornar period_id NOT NULL e trocar unique para (period_id, tipo_ativo)

-- 3. Targets por emissor
CREATE TABLE public.allocation_targets_emissor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES allocation_target_periods(id),
  fundo text NOT NULL,
  cnpj_emissor text NOT NULL,
  target_pct numeric,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (period_id, fundo, cnpj_emissor)
);

-- 4. Soberano com limite 100% no allocation_limits para todos os fundos
INSERT INTO allocation_limits (fundo, categoria, subcategoria, limite_pct)
SELECT DISTINCT fundo, 'emissor', 'Soberano', 100 FROM allocation_limits
ON CONFLICT DO NOTHING;

-- RLS: leitura para autenticados, escrita para Gestor/Coordenação
```

**Arquivos front-end:**
- `allocationUtils.ts`: novas helpers `isExcludedFromPL` (DAP/Futuro), `tipoAtivoFromProduct` ajustado (Termo→pré não muda aqui pois é categoria de indexador), `indexadorFromProductFallback` (CDB/LF parsing), `forceAAAForTermo` no rating.
- `useAllocationData.ts`: filtrar posições excluídas; somar bucket "Crédito Privado"; aplicar reclassificações de indexador/rating; tratar Tesouro Nacional como grupo "Soberano"; agregar Termo num grupo único "Termo (B3)".
- `IssuerExposurePanel.tsx`: ordenação por coluna + busca.
- `TargetsPanel.tsx`: seletor de período + botão "Novo período"; nova sub-aba "Por Emissor".
- `useAllocationData.ts`: novos hooks `useTargetPeriods`, `useEmissorTargets`.

**Confirmação necessária do usuário (assumido como sim para seguir):**
1. **Tesouro Nacional**: identificado por CNPJ específico ou pelo nome em `empresas`? Vou usar o CNPJ `00.394.460/0001-41` (Tesouro Nacional) como filtro.
2. **Período inicial**: criar 1 por fundo com nome "Política vigente" e `data_inicio = hoje`, sem `data_fim`.
3. **Termo (B3)**: somar todas as posições cujo `product` contenha "termo" como uma única linha, sem rating/limite específico (status "Sem limite").
