

## Plano: Audit Trail para Pipeline de Research

### Resumo
Criar tabela `pipeline_eventos` para registrar todas as ações do pipeline de forma imutável, integrar o registro nos handlers existentes, exibir timeline na página de detalhe da empresa e badge de data de comitê nos cards Kanban.

### 1. Migration — tabela `pipeline_eventos`

```sql
CREATE TABLE pipeline_eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analise_id uuid NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  acao text NOT NULL,
  etapa_anterior text,
  etapa_nova text,
  comentario text,
  data_comite date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura autenticados" ON pipeline_eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inserção autenticados" ON pipeline_eventos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_pipeline_eventos_analise ON pipeline_eventos(analise_id);
CREATE INDEX idx_pipeline_eventos_created ON pipeline_eventos(created_at DESC);
```

Sem FK para `analises(id)` — preserva o log se análise for excluída.

### 2. Serviço `src/services/pipelineEventos.ts`

Função `registrarEvento()` que:
- Obtém `user.id` via `supabase.auth.getUser()`
- Insere em `pipeline_eventos` com `analise_id`, `acao`, `etapa_anterior`, `etapa_nova`, `comentario`, `data_comite`
- Fire-and-forget (não bloqueia a ação principal; erros logados no console)

### 3. Integrar nos handlers (`PipelineResearchPage.tsx`)

Cada handler chama `registrarEvento()` **após** o `updateStatus.mutate` com sucesso (no `onSuccess` ou inline):

| Handler | `acao` | Detalhes |
|---|---|---|
| `handleCriar` | `criada` | `etapa_nova = 'Pendente'` |
| `handleDrop` (simples) | `etapa_alterada` | `etapa_anterior` / `etapa_nova` das colunas |
| `handleDrop` → `Em Análise` | `etapa_alterada` | idem, com `data_inicio` |
| `handleRejeitarAnalista` | `devolvida` | `etapa_anterior = 'Em Análise'`, `etapa_nova = 'Pendente'`, `comentario = justificativa` |
| `handleEntregar` | `concluida` | `etapa_anterior = 'Em Análise'`, `etapa_nova = 'Concluída'` |
| `handleComite` (Aprovada) | `aprovado` | `etapa_nova = 'Aprovada'`, `data_comite` |
| `handleComite` (Reprovada) | `reprovado` | `etapa_nova = 'Reprovada'`, `data_comite`, `comentario` obrigatório |
| `handleReatribuir` | `analista_atribuido` | `comentario = nome do novo analista` |
| Reabrir (inline) | `reaberta` | `etapa_nova = 'Pendente'`, `comentario = 'vN'` |

**Ajuste no modal de Reprovação (comitê):** Adicionar campo `Textarea` obrigatório para comentário quando `targetStatus === 'Reprovada'`. O botão fica desabilitado sem comentário.

### 4. Badge de data de comitê nos cards Kanban

Nos cards onde `item.data_comite` existe, exibir badge `📅 DD/MM/AAAA` (usando `fmtDateBR`). Sem query extra — dado já disponível no objeto `analise`.

### 5. Aba "Histórico de Pipeline" em `EmpresaDetailPage.tsx`

- Adicionar terceira tab `Histórico de Pipeline`
- Query: `pipeline_eventos` filtrado por `analise_id IN (ids das análises da empresa)`
- Join manual com `profiles_public` para nome do usuário
- Timeline vertical com:
  - Ícone por tipo de ação (CheckCircle, X, Calendar, ArrowRight, UserRoundCog)
  - Nome do usuário + data/hora formatada
  - Texto descritivo (ex: "Movido de Em Análise → Concluída por João Silva")
  - Comentário e data de comitê quando presentes

### Arquivos modificados
- 1 migration SQL (nova tabela)
- `src/services/pipelineEventos.ts` (novo)
- `src/pages/PipelineResearchPage.tsx` (integrar registro + campo comentário na reprovação + badge comitê)
- `src/pages/EmpresaDetailPage.tsx` (nova aba timeline)

