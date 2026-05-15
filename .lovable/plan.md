## Escopo: 5 correções cirúrgicas

### 1. EmpresasPage — remover cap de 1.000 registros
- Em `src/pages/EmpresasPage.tsx` (query `empresas`, linhas 43-53), substituir o `select('*').order('nome')` por loop paginado com `.range(from, to)` (1000 por página) até esgotar — mesmo padrão já usado em `PipelineResearchPage`.
- Aplicar o mesmo loop na query `analisesCounts` (linhas 68-73), pois ela também é capada em 1000 e impacta a contagem por empresa.
- Adicionar paginação client-side simples (50 por página) abaixo da `Table` usando `@/components/ui/pagination`, mantendo todos os filtros existentes.
- Atualizar o contador "X empresa(s) encontrada(s)" para refletir o total filtrado real.

### 2. AnalisesPage — nome da empresa, ordenação e busca
- Coluna "Empresa": já existe `getEmpresaNome`; adicionar segunda linha com CNPJ em `text-xs text-muted-foreground font-mono` abaixo do nome (manter `empresa_id` no tooltip).
- Adicionar estado `sortKey`/`sortDir` e tornar cada `TableHead` (Empresa, Tipo, Analista, Início, Conclusão, Status, Recomendação, Comitê, Versão) clicável com ícone `ArrowUp`/`ArrowDown`/`ArrowUpDown` (lucide). Ordenação aplicada no `useMemo` antes da renderização. Para "Empresa" ordenar pelo nome resolvido; para "Analista" pelo nome resolvido via profiles.
- Adicionar `<Input>` de busca (ícone `Search`) acima da tabela, ao lado dos selects existentes, filtrando por nome da empresa, CNPJ ou nome do analista (case-insensitive).
- Garantir que a query `empresas` em `AnalisesPage` (linha 67) também seja paginada (mesmo loop), senão o nome volta a sumir quando passar de 1000.

### 3. AssembleiasPage — filtro mês/ano + export Excel
- Adicionar dois `<Select>` (Mês: Todos + Jan-Dez; Ano: Todos + ano atual±2) na barra de filtros existente. Ambos default `'all'`. Aplicar no filtro client-side comparando com `data_evento`.
- Botão **"Exportar Excel"** (ícone `FileSpreadsheet`/`Download`) ao lado do botão "+ Novo evento".
- Usar `xlsx` (SheetJS) — já presente no projeto (usado em `PosicoesPage`). Gerar `.xlsx` apenas com a lista filtrada visível, colunas: Data, Tipo, Empresa (nome resolvido via `cnpj_empresa`/`cnpj_emissor`), Ticker, Triagem, Voto Butiá, B3 (`url_b3`).
- Nome do arquivo: `assembleias_{YYYY-MM-DD}.xlsx`.

### 4. Substituir CNPJ por nome da empresa em telas de análise
- **AnalisesPage**: já coberto no item 2.
- **DesempenhoPage** (componentes filhos):
  - `useDesempenhoData.ts` já resolve `titulo = empresa?.nome ?? a.empresa_id` (linha 190). Adicionar também `grupoEconomico` ao retorno (`empresas.grupo_economico`) e expor `cnpj` para tooltip. Garantir loop paginado nas queries `analises` e `empresas` (linhas 148-150) para evitar cap de 1000.
  - `TabelaAnalistas.tsx`: onde lista análises em andamento, mostrar `titulo` (nome) e, abaixo em cinza, `grupoEconomico` quando disponível.
  - `CalendarioEntregas.tsx`: labels dos pontos passam a usar `titulo` (já é o caso) — confirmar que não há fallback para `empresa_id`. Tooltip pode mostrar CNPJ.
  - `PainelSlaAcertividade.tsx`: na seção "SLA de entregas pendentes", exibir nome + grupo econômico em subtexto cinza, CNPJ removido da visualização principal (mantido em `title=`).

### 5. Padronizar status "Vencida" / "Pendente"
- Criar utilitário `src/utils/analiseStatus.ts` com função única `getDisplayStatus(analise, tipoEmissor?)` aplicando a tabela:
  - `data_conclusao` + `status === 'Aprovada'` → `Concluída` (verde) — manter regra de validade 1 ano (FIDC isento, já existente).
  - sem conclusão e `prazo < hoje` → `Vencida` (vermelho).
  - sem conclusão e `prazo >= hoje` e status === 'Pendente' → `Pendente` (amarelo).
  - status === 'Em Análise' → `Em Análise` (azul).
  - demais (`Aprovada`/`Reprovada`/recomendações) → mantidos como hoje.
- Migrar `AnalisesPage` (remover `isVencida`/`getDisplayStatus` locais e usar o util).
- Aplicar o mesmo util em:
  - `TradeMonitorPage` / filtro "Status Análise" (chip "Vencida" deve casar exatamente com `prazo < hoje` e sem `data_conclusao`).
  - `PipelineResearchPage` (badges de status).
  - `DesempenhoPage` componentes que mostram status de análise.
- Mapa de cores único (`statusBadgeClass`) co-localizado no util para reuso.
- Não alterar schema, RLS, navegação ou lógica de negócio fora do mapeamento.

### Notas técnicas
- Padrão de paginação Supabase (já usado em `PipelineResearchPage`):
```ts
let from = 0; const size = 1000; const all: T[] = []; let more = true;
while (more) {
  const { data, error } = await supabase.from('x').select('...').range(from, from+size-1);
  if (error) throw error;
  all.push(...(data ?? [])); more = (data?.length ?? 0) === size; from += size;
}
```
- Nenhuma migration necessária. Sem mudança de auth/RLS.
- Arquivos tocados (estimativa): `EmpresasPage.tsx`, `AnalisesPage.tsx`, `AssembleiasPage.tsx`, `useDesempenhoData.ts`, `TabelaAnalistas.tsx`, `CalendarioEntregas.tsx`, `PainelSlaAcertividade.tsx`, `TradeMonitorPage.tsx`, `PipelineResearchPage.tsx`, novo `src/utils/analiseStatus.ts`.