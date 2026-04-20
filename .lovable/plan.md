

## Diagnóstico

Há duas inconsistências distintas entre as métricas.

### Causa raiz #1 (Dashboard): falta de deduplicação por versão

O Dashboard (`DashboardPage.tsx`, linhas 129–147) classifica e conta **todas as análises da tabela**, incluindo versões antigas/superseded. O Pipeline Research (`PipelineResearchPage.tsx`, linhas 274–310) corretamente agrupa por `empresa_id + tipo` e mantém apenas a `MAX(versao)`.

**Verificação direta no banco:**
- Total bruto (Dashboard): **50** Vencidas c/ Alocação
- Após dedup por `empresa_id + tipo` (Pipeline): **42**

Diferença = 8 análises antigas (v1) que já foram substituídas por uma v2 ativa (em Análise/Aprovada), mas o Dashboard ainda está contando ambas.

**Conclusão:** o **Pipeline Research está correto (42)**. O Dashboard está inflando o contador.

### Causa raiz #2 (dados): duplicatas com mesma versão

Encontrei 2 pares `empresa_id + tipo` com **dois registros ambos com `versao = 1`** (versionamento foi bypassado, provavelmente em ações de "Reabrir" antes da correção anterior):

| empresa | tipo | versões |
|---|---|---|
| `50.258.089/0001-69` | Crédito Privado | [1, 1] — ambas Vencida c/ Alocação |
| `30.306.294/0001-45` | Crédito Privado | [1, 1] — Aprovada + Vencida c/ Alocação |

Hoje o Pipeline mostra apenas uma delas (a primeira do `sort` desempate), mas a outra fica órfã no banco.

## Correção

### 1. Aplicar deduplicação por versão no Dashboard

Em `src/pages/DashboardPage.tsx`, antes dos filtros das linhas 141–147, replicar a lógica do Pipeline:
- Agrupar `computedAnalises` por `${empresa_id}::${tipo}`
- Ordenar por `versao DESC` e manter apenas o primeiro
- Exceção: se o mais recente for `Reprovada`, incluir também a anterior `Aprovada/Vencida` (mesma regra do Pipeline, para coerência)

Após isso, recalcular `pendentes`, `emAnalise`, `aprovadas`, `vencidasComAlocacao` etc. sobre o conjunto deduplicado. Resultado esperado: Dashboard passa a mostrar **42** (alinhado ao Pipeline).

### 2. Corrigir os 2 pares com `versao` duplicada (data fix via migration)

Para cada par `(empresa_id, tipo)` com duas linhas em `versao = 1`, manter a mais recente (`updated_at` maior) como `versao = 2` e deixar a antiga como `versao = 1`. SQL:

```sql
WITH dups AS (
  SELECT id, empresa_id, tipo,
    ROW_NUMBER() OVER (PARTITION BY empresa_id, tipo ORDER BY updated_at ASC) AS rn
  FROM analises
  WHERE (empresa_id, tipo) IN (
    SELECT empresa_id, tipo FROM analises
    GROUP BY empresa_id, tipo, versao HAVING COUNT(*) > 1
  )
)
UPDATE analises a SET versao = d.rn, updated_at = now()
FROM dups d WHERE a.id = d.id;
```

### 3. (Opcional, recomendado) Constraint para prevenir recorrência

Adicionar índice único `UNIQUE (empresa_id, tipo, versao)` na tabela `analises` para impedir futuros bypasses do versionamento.

## Arquivos modificados

- `src/pages/DashboardPage.tsx` — deduplicação por `empresa_id + tipo` mantendo `MAX(versao)`
- Nova migration SQL — corrige 2 duplicatas e (opcional) cria índice único

