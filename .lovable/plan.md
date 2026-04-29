## Objetivo

Análises de emissores tipo **FIDC** ficam aprovadas indefinidamente — não vencem após 1 ano. O acompanhamento periódico continua sendo registrado normalmente via novas versões / eventos, mas o status aprovado não muda automaticamente para "Vencida".

## Identificação

- Critério: `empresas.tipo === 'FIDC'` (cadastro do emissor).
- A função utilitária precisa cruzar a análise com o emissor para checar o tipo. Hoje ela só recebe `status` e `data_conclusao`.

## Mudanças

### 1. `src/pages/PipelineResearchPage.tsx`
- Estender `isVencida(status, dataConclusao, tipoEmissor?)`: se `tipoEmissor === 'FIDC'`, retorna `false` sempre.
- Estender `getDisplayStatus(...)`: passar `tipoEmissor` adiante.
- Nos pontos onde essas funções são chamadas (mapeamento de `analisesComStatus`, drawer, kanban), buscar o tipo do emissor a partir do `empresaMap` já existente (`empresas` query), usando `empresa_id` (CNPJ).
- O filtro "Vencido" do prazo de entrega (linha 328/566) **não** se aplica a aprovação — é prazo de entrega da análise pendente, então mantém comportamento atual.

### 2. `src/pages/AnalisesPage.tsx`
- Mesma alteração em `isVencida` e `getDisplayStatus`, recebendo `tipoEmissor`.
- Garantir que o componente já tenha acesso ao map de empresas (verificar; se não tiver, adicionar query de `empresas` selecionando `cnpj, tipo`).

### 3. `src/pages/DashboardPage.tsx`
- Onde o `computedStatus` é calculado (linhas 129–139), antes de marcar como "Vencida c/ Alocação"/"Vencida s/ Alocação", checar se o emissor é FIDC; se for, manter `computedStatus = 'Aprovada'`.
- Cobertura ativa: FIDCs aprovados continuam contando como cobertura ativa naturalmente (já contam, pois ficarão "Aprovada").

### 4. Sem mudanças no backend
- O campo `empresas.tipo` já existe e é lido pelas páginas. RLS já permite leitura.
- Nenhuma migration necessária.

## Detalhes técnicos

### Assinatura nova

```ts
function isVencida(
  status: string,
  dataConclusao: string | null,
  tipoEmissor?: string | null
): boolean {
  if (tipoEmissor === 'FIDC') return false;
  if (status !== 'Aprovada' || !dataConclusao) return false;
  const conclusao = new Date(dataConclusao.split('T')[0]);
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  return conclusao < umAnoAtras;
}
```

### Lookup do tipo

Onde já existe `empresaMap: Map<cnpj, empresa>`, basta:
```ts
const tipoEmissor = empresaMap.get(a.empresa_id)?.tipo ?? null;
isVencida(a.status, a.data_conclusao, tipoEmissor);
```

Em `DashboardPage` o `cnpjSet` já existe; precisa também de um `Map<cnpj, tipo>` derivado da query de empresas — adicionar.

## Não muda

- Lógica de versionamento / fluxo de aprovação.
- Auditoria (`pipeline_eventos`).
- Permissões de perfil (Coord/Analista/Gestor).
- Filtros de prazo (data de entrega ≠ vencimento da aprovação).
- Status visual: FIDC aprovado continua aparecendo apenas como **Aprovada** (sem badge extra).

## Aceitação

1. Análise aprovada de emissor FIDC com `data_conclusao` >1 ano: status = **Aprovada** (não vira Vencida) no Pipeline Research, lista de Análises e Dashboard.
2. Análise aprovada de emissor não-FIDC com mesma idade: continua virando **Vencida c/ Alocação** ou **Vencida s/ Alocação**.
3. KPIs do Dashboard refletem isso: FIDCs aprovados antigos contam em "Aprovadas" e em "Cobertura ativa".
