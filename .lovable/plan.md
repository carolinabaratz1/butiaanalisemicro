

## Plano: Incluir Coordenação/Especialista na aba Analistas

### Problema
A query filtra apenas `funcao = 'Analista'`, excluindo usuários com função "Coordenação/Especialista".

### Solução
No `src/pages/AnalistasPage.tsx`, linha 27: substituir `.eq('funcao', 'Analista')` por `.in('funcao', ['Analista', 'Coordenação/Especialista'])`.

Adicionar a coluna `funcao` ao select (linha 26) e exibi-la na tabela ao lado do nome ou como uma coluna separada, para distinguir Analistas de Coordenadores/Especialistas.

### Detalhes técnicos
- Interface `AnalistaProfile`: adicionar campo `funcao: string`
- Select: `'id, nome, email, status, created_at, funcao'`
- Filtro: `.in('funcao', ['Analista', 'Coordenação/Especialista'])`
- Tabela: adicionar coluna "Função" exibindo badge com a função
- KPI "Total de Analistas" renomear para "Total" (ou manter, pois inclui coordenadores)

### Arquivo modificado
- `src/pages/AnalistasPage.tsx`

