

## Plano: Adicionar exclusão de análise + Corrigir função Reabrir

### Problema 1: Exclusão não existe
Não há botão nem lógica para excluir análises. Além disso, a tabela `analises` não possui política RLS para DELETE — qualquer tentativa falharia silenciosamente.

### Problema 2: Reabrir não funciona
A mutação `updateStatus` envia `data_inicio: null, data_conclusao: null, data_comite: null` no update. O problema é que o Supabase ignora campos `null` em updates quando a coluna já tem valor — preciso garantir que o update está enviando corretamente. Vou investigar se o `.update()` do Supabase está tratando `null` vs `undefined` corretamente e se o status está sendo atualizado.

### Mudanças

**1. Migration: adicionar política DELETE na tabela `analises`**

```sql
CREATE POLICY "Authenticated users can delete analises"
ON public.analises FOR DELETE TO authenticated USING (true);
```

Restrito a usuários autenticados. O controle fino (só Gestor pode excluir) será feito no frontend.

**2. Adicionar mutação `deleteAnalise` em `PipelineResearchPage.tsx`**

```typescript
const deleteAnalise = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from('analises').delete().eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline-analises'] });
    toast({ title: 'Análise excluída' });
  },
});
```

**3. Adicionar botão "Excluir" nos cards**
- Visível apenas para Gestor
- Com confirmação via `AlertDialog` antes de excluir
- Disponível em todos os status (com ícone de lixeira)

**4. Corrigir função Reabrir**
- Investigar e corrigir o update para garantir que os campos `data_inicio`, `data_conclusao` e `data_comite` sejam efetivamente limpos (null)
- Garantir invalidação correta do cache após mutação

### Arquivos modificados
- 1 migration SQL (política DELETE)
- `src/pages/PipelineResearchPage.tsx` (delete mutation + botão + fix reabrir)

