

## Plano: Reabrir com histórico + Melhorar UX de exclusão

### Problema 1: Reabrir apaga o histórico
Atualmente, "Reabrir" limpa os campos da análise existente, perdendo o histórico. O correto é **manter a análise original** (como registro histórico) e **criar uma nova análise** para a mesma empresa, incrementando a versão.

### Problema 2: Lixeira aparente nos cards
O ícone de lixeira está visível diretamente nos cards, poluindo a interface. Deve ser mais discreto e acessível apenas ao Gestor.

### Mudanças em `src/pages/PipelineResearchPage.tsx`

**1. Reabrir → criar nova análise + manter original**

Ao clicar "Reabrir" em uma análise Reprovada/Vencida:
- A análise original permanece inalterada no banco (registro histórico)
- Uma nova análise é criada via `insert` com os mesmos dados base (`empresa_id`, `tipo`, `analista_responsavel`, `isin`), status `Pendente`, `data_inicio` = hoje, e `versao` incrementada
- Toast confirma: "Nova análise v{N} criada"

```typescript
// Pseudocódigo
const original = analises.find(a => a.id === id);
const novaVersao = (original.versao || 1) + 1;
await supabase.from('analises').insert({
  empresa_id: original.empresa_id,
  tipo: original.tipo,
  analista_responsavel: original.analista_responsavel,
  isin: original.isin,
  status: 'Pendente',
  data_inicio: hoje,
  versao: novaVersao,
  solicitante_id: currentUser.id,
});
```

**2. Mover excluir para menu contextual (três pontos)**

- Remover o ícone de `Trash2` visível nos cards
- Adicionar um `DropdownMenu` com ícone `MoreVertical` (⋮) no canto do card, visível apenas para **Gestor**
- Dentro do menu: opção "Excluir" com ícone de lixeira e cor vermelha
- Manter o `AlertDialog` de confirmação existente

**3. Exibir versão no card**

- Quando `versao > 1`, mostrar badge "v{N}" no card para indicar que é uma reanálise

### Arquivo modificado
- `src/pages/PipelineResearchPage.tsx`

