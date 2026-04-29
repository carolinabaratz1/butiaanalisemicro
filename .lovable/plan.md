## Objetivo

Inserir duas análises históricas aprovadas para empresas que já existem no banco mas não tinham registros na tabela `analises`.

## Dados confirmados (via consulta ao banco)

- **Empresas**: já existem em `empresas` (ARTERIS S.A. e USINA SANTA ADELIA S.A.) — não precisam ser criadas.
- **Analista**: Lucas Costa existe em `profiles` com id `6d6c4714-c113-4379-b719-1f84c0716710`, funcao `Analista`.
- **Análises**: nenhuma análise existente para esses CNPJs — serão inseridas como `versao = 1`.

## Inserções na tabela `analises`

Dois INSERTs com os campos abaixo (via tool de insert de dados, sem migration):

**Análise 1 — ARTERIS S.A.**
- `empresa_id`: `02.919.555/0001-67`
- `tipo`: `CREDITO_CORPORATIVO`
- `status`: `Aprovada`
- `data_comite`: `2025-04-30`
- `data_inicio`: `2025-04-30`
- `data_conclusao`: `2025-04-30`
- `data_aprovacao`: `2025-04-30`
- `analista_responsavel`: `6d6c4714-c113-4379-b719-1f84c0716710` (Lucas Costa)
- `versao`: `1`
- `decisao`: `Aprovada`
- Observação: marcará como "registro histórico importado"

**Análise 2 — USINA SANTA ADELIA S.A.**
- Mesmos campos, com:
  - `empresa_id`: `50.376.938/0001-89`
  - `data_comite` / `data_inicio` / `data_conclusao` / `data_aprovacao`: `2025-09-30`

## Observações

- As datas seguem ISO-8601 (formato armazenado), apresentadas em pt-BR (DD/MM/YYYY) na UI.
- O valor exato de `tipo` será alinhado ao enum/convenção usada no codebase (verificarei `CREDITO_CORPORATIVO` vs `CREDITO PRIVADO` antes de inserir, lendo `AnalisesPage.tsx` / `historicoAnalises.ts`).
- Validade de 1 ano (regra de negócio existente) será calculada a partir de `data_comite`, conforme já implementado.
- Nenhum schema será alterado.
