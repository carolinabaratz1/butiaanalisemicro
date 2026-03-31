

## Plano: Permissões por Perfil e Modal de Conclusão Condicional (Ações vs Crédito)

### Mudanças

**1. Permissões do Analista no Pipeline**
O Analista só pode realizar duas ações sobre análises atribuídas a ele:
- **Devolver** (Em Análise → Pendente com justificativa) — já implementado
- **Entregar** (Em Análise → Concluída com relatório) — já implementado

Remover do perfil Analista:
- Botão "Rejeitar" em cards Pendente/Em Análise (linhas 500-504) — esse botão chama o modal de Comitê, que é ação de Gestor
- Botão "Iniciar" em cards Pendente (linha 475-478) — o Analista pode iniciar, isso está correto e permanece
- Garantir que Analista **não** possa Aprovar, Reprovar, Reabrir ou Reatribuir

Atualmente nas linhas 500-508, o Gestor tem botões "Rejeitar" e "Reatribuir" para Pendente/Em Análise. O problema é que NÃO há restrição impedindo o Analista de usar drag-and-drop para mover cards para colunas indevidas.

**Correções:**
- No `handleDrop`: verificar perfil antes de permitir transições. Analista só pode: Pendente→Em Análise, Em Análise→Concluída (abre modal de entrega), Em Análise→Pendente (abre modal de devolução). Bloquear todas as outras transições para Analista.
- Nos quick actions dos cards: já está correto (Analista só vê Iniciar, Entregar, Devolver)
- Nos drawer actions: já está correto

**2. Modal de Conclusão condicional por tipo**
- **Ações**: exigir Recomendação (Buy/Hold/Sell) + Preço Mín/Méd/Máx + Data-Alvo + Relatório
- **Crédito Privado**: exigir apenas Relatório (sem recomendação Buy/Hold/Sell e sem preços)

No `handleEntregar` e no modal de entrega:
- Buscar o `tipo` da análise sendo entregue
- Se `tipo === 'Ações'`: mostrar campos de recomendação, preços e data-alvo (obrigatórios)
- Se `tipo === 'Crédito Privado'`: ocultar esses campos, exigir apenas relatório
- Validação do botão "Entregar" ajustada conforme o tipo

### Arquivos modificados
- `src/pages/PipelineResearchPage.tsx`

### Detalhes Técnicos
- `handleDrop`: adicionar guard `if (isAnalista)` bloqueando transições não permitidas com toast de erro
- Modal de entrega: usar `useMemo` para buscar o `tipo` da análise atual pelo `entregarModal` id, e renderizar campos condicionalmente
- Sem migration necessária — apenas mudanças de UI/lógica

