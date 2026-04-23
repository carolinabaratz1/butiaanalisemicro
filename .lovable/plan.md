

## Diagnóstico

Três problemas, todos relacionados à **corrupção UTF-8 → Latin-1 → UTF-8** (mojibake) no arquivo `src/pages/PipelineResearchPage.tsx`:

### 1. Dados NÃO foram perdidos
Verifiquei direto no banco: existem **10 análises com status `Em Análise`**, 161 `Aprovada`, 2 `Reprovada`. O celular (que renderiza outra view ou cache antigo) mostra corretamente "Em Análise (10)". O desktop mostra "0" porque o código do Pipeline compara com a string corrompida `'Em AnÃ¡lise'` e nunca casa com o valor real do banco `'Em Análise'`.

### 2. Erro de build TS2367 (Pipeline)
Linha 135: `currentUser?.funcao === 'CoordenaÃ§Ã£o/Especialista'`. O tipo `UserRole` define `'Coordenação/Especialista'` (correto), por isso o TypeScript reclama que "não há overlap". Mesma causa: encoding corrompido.

### 3. Erros de build TS18046 (edge functions)
`supabase/functions/create-user/index.ts:99` e `supabase/functions/manage-user/index.ts:186`: `catch (err)` retorna `err.message` sem narrowing. No Deno strict, `err` é `unknown`.

## Escopo da corrupção

- `src/pages/PipelineResearchPage.tsx` — **110 ocorrências** de mojibake (tipo `AnaliseStatus`, comparações de status, comparações de role, labels de UI, comentários, ícones de emoji virando "ð"). Todas as colunas do Kanban com texto corrompido (`AnÃ¡lise`, `ConcluÃda`, `PosiÃ§Ã£o Ativa`, `AlocaÃ§Ã£o`, `Nova AnÃ¡lise`).
- `src/data/emissores.ts` — **falso positivo**, os "Ã" são parte legítima de palavras como "LOCAÇÃO".
- Demais arquivos limpos.

## Correção

### Passo 1 — Restaurar encoding em `PipelineResearchPage.tsx`
Reescrever o arquivo substituindo todos os mojibakes pelas strings UTF-8 corretas. Mapeamento aplicado:

| Corrompido | Correto |
|---|---|
| `Em AnÃ¡lise` | `Em Análise` |
| `ConcluÃ­da` / `ConcluÃda` | `Concluída` |
| `Vencida c/ AlocaÃ§Ã£o` | `Vencida c/ Alocação` |
| `Vencida s/ AlocaÃ§Ã£o` | `Vencida s/ Alocação` |
| `CoordenaÃ§Ã£o/Especialista` | `Coordenação/Especialista` |
| `PosiÃ§Ã£o Ativa` | `Posição Ativa` |
| `RejeiÃ§Ã£o` | `Rejeição` |
| `ComitÃª` | `Comitê` |
| `Nova AnÃ¡lise` | `Nova Análise` |
| `â` (em comentário de seta) | `→` |
| `ð...` (ícone de calendário corrompido) | `📅` |
| Demais acentos `Ã£`/`Ã§`/`Ã©`/`Ã¡` etc. | recompor para `ã`/`ç`/`é`/`á` etc. |

Após o fix, o tipo `AnaliseStatus` voltará a casar com os valores que vêm do banco — as 10 análises "Em Análise" voltam a aparecer no desktop, e o erro TS2367 some.

### Passo 2 — Corrigir tipagem em `catch (err)` nas duas edge functions
Em ambos os arquivos, trocar:
```ts
} catch (err) {
  return new Response(JSON.stringify({ error: err.message }), { ... });
}
```
por:
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: message }), { ... });
}
```

### Passo 3 — Não tocar no banco
Nenhuma migration, nenhum UPDATE/INSERT/DELETE. Os dados estão íntegros; só o frontend estava lendo as strings erradas.

## Resultado esperado

- Build verde (TS2367 e dois TS18046 resolvidos).
- Coluna "Em Análise" do Pipeline volta a mostrar **10** (consistente com o celular e com o banco).
- Labels da UI em português correto: "Em Análise", "Concluída", "Vencida c/ Alocação", "Posição Ativa", "Comitê", "Nova Análise", ícone 📅.
- Comparações de role (`'Coordenação/Especialista'`) voltam a funcionar — analistas/coordenadores não ficam mais sem permissão por causa do mismatch de string.

## Arquivos modificados

- `src/pages/PipelineResearchPage.tsx` — reescrita completa do arquivo com encoding UTF-8 restaurado
- `supabase/functions/create-user/index.ts` — narrowing de `err` no catch
- `supabase/functions/manage-user/index.ts` — narrowing de `err` no catch

