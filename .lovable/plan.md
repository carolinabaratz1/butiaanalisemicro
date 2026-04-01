

## Plano: Melhorar seletor de empresa no modal "Nova Análise"

### Problema
O select atual usa um dropdown simples sem busca e sem ordenação alfabética. Com 164+ empresas, é difícil encontrar a desejada.

### Mudança

**Substituir `Select` por `Combobox` com busca (`PipelineResearchPage.tsx`)**

- Trocar o `<Select>` de Empresa/Emissor (linhas 1009-1016) por um `Popover` + `Command` (padrão combobox do shadcn)
- A lista de empresas será ordenada alfabeticamente por nome: `.sort((a, b) => a.nome.localeCompare(b.nome))`
- O input de busca dentro do `Command` permite digitar parte do nome para filtrar
- Ao selecionar, o popover fecha e exibe o nome da empresa selecionada no botão trigger
- Importar `Command, CommandInput, CommandList, CommandEmpty, CommandItem` e `Check` icon

### Arquivo modificado
- `src/pages/PipelineResearchPage.tsx` (linhas 1007-1016 — substituir select por combobox)

