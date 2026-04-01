

## Plano: BI Completo no Painel Analítico de Posições

### Visão geral
Transformar o "Painel Analítico" em um dashboard de BI completo, cruzando dados de posições com análises e emissões para fornecer visão integrada de carteira + research.

### Dados necessários (queries adicionais)
O painel precisa cruzar 4 tabelas:
- `posicoes` (carteira atual)
- `emissoes` (ponte: ISIN → CNPJ)
- `empresas` (nome do emissor via CNPJ)
- `analises` (status, tipo, recomendação, preços)

### Seções do BI

**1. KPIs (linha superior)** -- manter os 4 atuais + adicionar:
- Posições com Análise Aprovada
- Posições com Análise Vencida
- Posições sem Análise
- % Cobertura (com análise válida / total)

**2. Gráficos existentes melhorados:**
- Distribuição por Tipo (pie chart -- já existe)
- Posição por Fundo (bar chart -- já existe)

**3. Novos gráficos/tabelas:**

- **Distribuição por Duration** -- Histograma agrupando posições em faixas de duration (0-1, 1-2, 2-3, 3-5, 5-10, 10+) com quantidade de ativos e volume
- **Status de Análise da Carteira** -- Pie/donut chart mostrando quantas posições têm análise Aprovada, Vencida, Reprovada, Em Análise, Pendente, ou Sem Análise
- **Cobertura por Fundo** -- Bar chart empilhado mostrando por fundo: % com análise aprovada vs vencida vs sem análise
- **Painel de Ações** -- Tabela filtrada para posições do tipo Equity/Ações mostrando: nome do ativo, fundo, recomendação (Buy/Hold/Sell com badge colorido), preço atual (financial_price), preço alvo min/med/max, indicador visual se o preço está dentro do range
- **Exposição por Rating** -- Bar chart com a distribuição de posições por rating do emissor (AAA, AA, A, BBB, etc.)

**4. Filtros globais do BI:**
- Filtro por Fundo (já existente, reutilizar)
- Filtro por Tipo de Ativo
- Filtro por Data de Referência

### Lógica de cruzamento

```text
posicao.isin → emissoes (WHERE isin = posicao.isin)
  → emissoes.cnpj_emissor → empresas (WHERE cnpj = cnpj_emissor)
  → analises (WHERE empresa_id = empresas.cnpj)
    → pegar análise mais recente por empresa
    → verificar status + validade 1 ano
    → se tipo = 'Ações': pegar recomendação + preços
```

Status de análise por posição:
- "Aprovada": análise com status Aprovada e data_conclusao < 1 ano
- "Vencida": análise Aprovada com data_conclusao > 1 ano
- "Reprovada": última análise com status Reprovada
- "Em Análise/Pendente": análise em andamento
- "Sem Análise": nenhuma análise encontrada para o emissor

### Detalhes técnicos

**Arquivo principal:** `src/pages/PosicoesPage.tsx`
- Adicionar queries para `emissoes`, `empresas` e `analises` (3 queries adicionais via `useQuery`)
- Criar `useMemo` para cruzar os dados e gerar as métricas
- O painel de ações compara `financial_price` com `preco_min`/`preco_maximo` para indicar se está "Abaixo", "Em Linha" ou "Acima" do range

**Componentes de gráfico:** Recharts (já instalado) -- PieChart, BarChart, ComposedChart

**Responsividade:** Grids `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` para os cards de gráficos

### Arquivos modificados
- `src/pages/PosicoesPage.tsx` (principal -- expandir aba Painel Analítico)

### Resultado
Um BI completo integrado ao sistema onde o gestor pode visualizar a carteira sob diversas perspectivas (fundo, tipo, duration, rating, cobertura de research) e acompanhar especificamente as posições de ações com recomendações e range de preço.

