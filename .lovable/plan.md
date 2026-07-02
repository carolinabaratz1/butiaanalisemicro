
# Plano: Consolidação de "Empresas" e "Análises" em "Emissores"

## Objetivo
Unificar as seções **Empresas** e **Análises** em uma única seção chamada **Emissores**, preservando 100% dos dados existentes (empresas, análises, ratings, posições). A mudança é de navegação, visualização e relacionamento — **não** há migração destrutiva no banco.

## Escopo

**Alterado:** menu lateral, rotas, tela de listagem, tela de detalhe do emissor, componente de nova análise.

**Não alterado:** BASE LOTE 45 / importação de posições, FIDC Monitor, Trade Monitor, Posições, tabelas `empresas`, `analises`, `emissoes`, `issuer_ratings`, `posicoes`.

## Mudanças

### 1. Menu lateral (`AppSidebar.tsx`)
- Remover itens "Empresas" e "Análises".
- Adicionar item único **"Emissores"** (`/emissores`, ícone `Building2`).
- Ajustar `hasAccess` em `AuthContext` para mapear a permissão antiga (`/empresas` + `/analises`) para `/emissores`.

### 2. Rotas (`App.tsx`)
- Nova rota `/emissores` → `EmissoresPage` (lista).
- Nova rota `/emissores/:cnpj` → `EmissorDetailPage` (detalhe com abas).
- **Redirects** (sem quebra de links):
  - `/empresas` → `/emissores`
  - `/empresas/:cnpj` → `/emissores/:cnpj`
  - `/analises` → `/emissores`
  - `/analises/:id` → `/emissores/:cnpj` (resolvendo o CNPJ via análise)

### 3. Tela `EmissoresPage` (listagem)
Reaproveita a estrutura de `EmpresasPage.tsx` e enriquece com dados cruzados:

**Cards de resumo:**
- Total de emissores
- Emissores com posição
- Emissores com análise vencida
- Emissores sem análise
- Exposição total (R$)
- Emissores sem CNPJ / não mapeados

**Filtros no topo:**
Busca (nome / CNPJ / ticker / grupo), Tipo, Setor, Grupo Econômico, Rating, Status da Análise, Analista, "Com posição" (Todos/Sim/Não), "Análise vencida" (Todos/Sim/Não).

**Tabela:**
Emissor · Código · CNPJ · Rating · Tipo · Grupo · Setor · **Status da Análise** · Última Análise · Analista · Ativos em Carteira · Exposição Atual · Ações.

**Chave:** CNPJ normalizado (`regexp_replace [^0-9]`).
**Rating:** via `resolveRatingsBatch` (hierarquia Ticker > CNPJ > Grupo) já existente.
**Status da Análise:** via `getDisplayStatus` (util já existente) sobre a análise mais recente do CNPJ; se não houver → "Sem análise"; se vencida → "Vencido".
**Exposição/ativos em carteira:** join com `posicoes` na última `val_date` por CNPJ do emissor.

**Botão "+ Novo Emissor":** reaproveita o formulário atual de nova empresa em dialog.

### 4. Página `EmissorDetailPage` (`/emissores/:cnpj`)
Reaproveita `EmpresaDetailPage` como base e reorganiza em abas via `<Tabs>`.

**Header:** nome · CNPJ · código · grupo · setor · `<RatingBadge/>` · status análise · última análise · exposição · botões *Editar Emissor*, *Novo Ativo*, *Nova Análise*.

**Abas:**
1. **Visão Geral** — cards (exposição total, nº ativos, rating, status, última análise, grupo, setor, maior fundo exposto) + tabela de exposição por fundo.
2. **Ativos em Carteira** — posições atuais do CNPJ vindas de `posicoes` (última val_date). Empty state quando não houver.
3. **Ativos Cadastrados** — todos os `emissoes`/`trade_ativos` cadastrados do CNPJ. Botão *+ Novo Ativo* abre dialog com os campos da spec.
4. **Análises** — migração 1:1 da funcionalidade de `AnalisesPage.tsx` filtrada pelo CNPJ. Preserva versionamento (v1/v2/v3), botão *+ Nova Análise* abre o formulário existente com CNPJ / grupo pré-preenchidos.
5. **Histórico de Rating** — `IssuerRatingHistoryDialog` já existente vira uma aba (agência, rating, data, validade, fonte, observações). Rating vigente = do CNPJ.

### 5. Preservação de dados
- Nenhum `DROP`, `DELETE` ou renomeação de tabela.
- Nenhuma migration necessária nesta fase — todos os dados já existem em `empresas`, `analises`, `emissoes`, `trade_ativos`, `issuer_ratings`, `posicoes`.
- Vínculo consistente via **CNPJ normalizado** (padrão já usado no projeto).

## Detalhes técnicos

**Novos arquivos:**
- `src/pages/EmissoresPage.tsx` (evolução de `EmpresasPage`)
- `src/pages/EmissorDetailPage.tsx` (evolução de `EmpresaDetailPage` + abas)
- `src/components/emissores/AtivosCarteiraTab.tsx`
- `src/components/emissores/AtivosCadastradosTab.tsx`
- `src/components/emissores/AnalisesTab.tsx` (reaproveita `AnalisesPage`)
- `src/components/emissores/HistoricoRatingTab.tsx`
- `src/components/emissores/VisaoGeralTab.tsx`

**Editados:**
- `src/App.tsx` — rotas novas + redirects
- `src/components/layout/AppSidebar.tsx` — item único "Emissores"
- `src/contexts/AuthContext.tsx` — `hasAccess` inclui `/emissores`

**Arquivos antigos (`EmpresasPage.tsx`, `EmpresaDetailPage.tsx`, `AnalisesPage.tsx`):** mantidos como fallback interno se necessário; podem ser deletados após validação.

## Não incluso (fora de escopo)
- Alterações em Trade Monitor, FIDC Monitor, Posições, Desempenho.
- Migrations no banco.
- Alterações no importador BASE LOTE 45.

Confirma para eu implementar?
