

## Plano: Tornar todo o sistema responsivo para celular e tablet

### Problema atual
O sistema usa layouts fixos (grids `grid-cols-4`, `grid-cols-7`, `grid-cols-3`, sidebar fixa `w-56`) sem breakpoints responsivos. Em telas pequenas, o conteúdo fica cortado e inutilizável.

### Mudanças por arquivo

**1. `src/components/layout/AppLayout.tsx`** -- Sidebar mobile como overlay
- Em telas `< md`, sidebar fica oculta por padrão (off-canvas)
- Botão hambúrguer abre/fecha sidebar como overlay com backdrop
- Em telas `>= md`, sidebar funciona como hoje (fixa lateral)
- Header: ocultar nome do usuário em mobile, manter apenas badge e logout

**2. `src/components/layout/AppSidebar.tsx`** -- Fechar ao navegar em mobile
- Receber callback `onClose` para fechar sidebar ao clicar em link (mobile)
- Adicionar overlay/backdrop quando aberta em mobile

**3. `src/pages/DashboardPage.tsx`** -- KPIs e grids responsivos
- KPIs: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- Pipeline Geral números: `flex-wrap` (já tem) com gap ajustado
- Seção inferior: `grid-cols-1 lg:grid-cols-3`
- Tabelas: scroll horizontal em mobile (`overflow-x-auto`)

**4. `src/pages/PipelineResearchPage.tsx`** -- Pipeline estilo accordion em mobile
- Desktop (`>= lg`): manter Kanban 7 colunas
- Mobile/Tablet (`< lg`): mudar para layout vertical com seções colapsáveis (accordion) por status, similar à imagem de referência
  - Cada status vira uma seção com header clicável mostrando nome + contagem
  - Cards empilhados dentro de cada seção
  - Drag & drop desativado em mobile
- Filtros: `flex-col` em mobile, inputs full-width
- Drawer: `w-full sm:w-[420px]`

**5. `src/pages/EmpresasPage.tsx`** -- Tabela responsiva
- Filtros: stack vertical em mobile
- Tabela: `overflow-x-auto` wrapper, ou em mobile mostrar como cards ao invés de tabela

**6. `src/pages/AnalistasPage.tsx`** -- Tabela responsiva
- KPIs: `grid-cols-2 sm:grid-cols-4`
- Tabela: `overflow-x-auto`, ocultar colunas menos importantes em mobile

**7. `src/pages/PosicoesPage.tsx`** -- Charts e tabela responsivos
- KPIs e gráficos: `grid-cols-1 md:grid-cols-2`
- Tabela: `overflow-x-auto`

**8. `src/pages/ConfiguracoesPage.tsx`** -- Tabela responsiva
- Tabela: `overflow-x-auto`, formulário de criação stack vertical

**9. `src/pages/LoginPage.tsx`** -- Já deve estar ok (Card centralizado), ajustar padding

**10. `src/index.css`** -- `main` padding responsivo
- Reduzir padding de `p-6` para `p-3 sm:p-4 lg:p-6` (no AppLayout)

### Detalhes técnicos
- Breakpoints Tailwind: `sm` (640px), `md` (768px), `lg` (1024px)
- Pipeline mobile: usar componente `Collapsible` do shadcn (já disponível) para as seções
- Sidebar mobile: posição `fixed` com `z-50`, backdrop semi-transparente
- `useIsMobile()` hook já existe e pode ser usado para lógica condicional
- Nenhuma mudança no banco de dados

### Arquivos modificados
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/PipelineResearchPage.tsx`
- `src/pages/EmpresasPage.tsx`
- `src/pages/AnalistasPage.tsx`
- `src/pages/PosicoesPage.tsx`
- `src/pages/ConfiguracoesPage.tsx`
- `src/pages/AnalisesPage.tsx`
- `src/pages/CreditoCorporativoPage.tsx`
- `src/pages/CreditoEstruturadoPage.tsx`
- `src/pages/AcoesPage.tsx`
- `src/pages/EmpresaDetailPage.tsx`

