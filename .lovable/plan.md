## Nova aba "Exposição por Grupo / Emissor" em `/posicoes`

Adicionar uma 4ª aba na página Posições, sem mexer em Tabela, Painel Analítico, Dashboard do Fundo, FIDC Monitor, sidebar ou importação. Fonte única: `posicoes` (BASE LOTE 45) cruzada com `empresas`, `emissoes`, `trade_ativos`, `analises` e ratings resolvidos.

### Arquivos

**Novos**
- `src/components/posicoes/ExposicaoGrupoEmissorTab.tsx` — UI principal (filtros, cards, tabela hierárquica, export).
- `src/components/posicoes/useExposicaoData.ts` — hook que carrega posições da `val_date` selecionada, faz join com empresas/emissões/trade_ativos/analises, aplica ratings resolvidos via `resolveRatingsBatch`, calcula PL por fundo e exposições agregadas.
- `src/components/posicoes/exposicaoExport.ts` — export XLSX (3 abas no modo Grupo, 2 no modo Emissor) reutilizando o padrão do `tradeExport.ts`.

**Editados**
- `src/pages/PosicoesPage.tsx` — adicionar `<TabsTrigger value="exposicao">Exposição por Grupo / Emissor</TabsTrigger>` e `<TabsContent>` renderizando o novo componente, passando `valDate` e fundos disponíveis. Nada mais muda.

### Modelo de dados (no hook)

1. `posicoes` filtrada por `val_date` (default = mais recente). `PL_fundo = Σ amount*financial_price` por `trading_desk_share_source` (mesma regra já usada no app — memória `calculation-rules`).
2. Para cada posição: join `emissoes.isin` → `cnpj_emissor` → `empresas` (nome, grupo_economico, setor, rating bruto); `trade_ativos.ticker` para taxa/venc/duration/rating de ticker; `analises` mais recente por CNPJ.
3. Ratings: `resolveRatingsBatch` para todos os CNPJs únicos (ticker > emissor > grupo > N/R), mantendo o `<RatingBadge />` padrão.
4. Status análise: `getDisplayStatus` já existente; adicionar bucket "Sem Análise" quando não há registro e mapear severidade conforme spec.

### Agregações

- **Modo Grupo**: chave `grupo_economico` (fallback "Grupo não mapeado"). Soma exposição dos emissores; rating = rating do grupo se existir senão pior rating dos emissores com posição; setor = maior exposição; status = mais severo entre emissores.
- **Modo Emissor**: chave `cnpj`. Mantém grupo como coluna auxiliar.
- Para cada nó: `exposureByFundo[fundo] = { value, pct = value/PL_fundo }`, `totalButia`, `consolidatedPct = totalButia / Σ PL_fundos_filtrados`, `weightedAvgRate` (ignora taxas ausentes; N/D se nenhuma).

### UI

- Toggle "Agrupar por: Grupo Econômico | Emissor" no topo.
- Linha de filtros: Data ref, Fundo (multi), Grupo, Emissor, Status, Rating, Setor, Tipo de ativo, Vencida (Todos/Sim/Não), Com posição (Todos/Sim/Não), busca livre.
- 6 cards de resumo conforme spec (mudam de label conforme modo).
- Tabela densa com header fixo, 1ª coluna fixa, expansão hierárquica (Grupo → Emissor → Ativos no modo Grupo; Emissor → Ativos no modo Emissor).
- Células de exposição por fundo: `R$ | %` + barra horizontal proporcional ao limite do fundo (10% como referência visual, igual ao padrão Excel antigo).
- Badges de status com cores conforme spec; linhas Vencido com fundo `bg-status-danger/5` e borda esquerda vermelha; "Sem análise" badge cinza; "não mapeado" badge âmbar.
- Título dinâmico: "Exposição por Grupo Econômico" / "Exposição por Emissor".
- Botão "Exportar Exposição .xlsx".

### Validações

Painel discreto (colapsável) "Validações" mostrando:
- Σ exposições do modo = Σ posições filtradas (com diff em R$).
- Nº emissores não mapeados, nº grupos não mapeados.
- Nº ativos sem taxa (apenas informativo).

### Cores e padrões visuais

Reaproveitar tokens `status-success/warning/danger/info` do `index.css` (memória de design). Sem hex hardcoded fora dos tokens já em uso na página.

### Critérios de aceite cobertos

Itens 1–18 da spec atendidos via componentização única e dados derivados em tempo real do `posicoes` filtrado por `val_date`.

---

**Confirma que sigo essa abordagem?** Se sim, implemento os 3 arquivos novos + 1 edição em `PosicoesPage.tsx` direto.