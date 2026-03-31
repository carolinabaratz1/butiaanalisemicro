

## Plano: Correções de Integridade + Criação da Tabela Emissões

### Problema 1: Padronizar `analista_responsavel`
Os 2 registros originais usam IDs (`analista_01`, `analista_02`), enquanto os 145 importados usam nomes completos. Precisamos padronizar para **nomes completos** (que é o formato usado pelo front-end no Pipeline).

**Migration:**
```sql
UPDATE analises SET analista_responsavel = 'Carolina Baratz Weinberg' WHERE analista_responsavel = 'analista_01';
UPDATE analises SET analista_responsavel = 'Diogo Vilaça Teixeira' WHERE analista_responsavel = 'analista_02';
```

### Problema 2: Cadastrar 29 empresas faltantes
29 CNPJs referenciados em análises não existem na tabela `empresas`. Precisamos inseri-los (mesmo que com nome genérico ou buscando os nomes do Excel original) para que o vínculo funcione.

**Execução:** Script Python que:
1. Busca os 29 CNPJs órfãos
2. Cruza com dados disponíveis (Excel ou `src/data/emissores.ts`) para obter nomes
3. Insere na tabela `empresas` com os dados disponíveis

### Problema 3: Criar tabela `emissoes` e importar 236 registros
Plano já aprovado anteriormente — criar a tabela e importar os dados do Excel `base_de_Emissoes_ISIN.xlsx`.

**Migration:**
```sql
CREATE TABLE emissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isin text NOT NULL UNIQUE,
  ticker text,
  cnpj_emissor text NOT NULL,
  val_date text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE emissoes ENABLE ROW LEVEL SECURITY;
-- Políticas públicas de leitura/escrita
```

**Importação:** Script Python lê o Excel e insere 236 registros via SQL.

### Ordem de execução
1. Migration: padronizar `analista_responsavel` (UPDATE 2 registros)
2. Script: identificar e inserir 29 empresas faltantes
3. Migration: criar tabela `emissoes` + RLS
4. Script: importar 236 emissões do Excel

### Arquivos modificados
- 2 migrations SQL
- 2 scripts Python (execução única)
- Nenhuma alteração de código front-end neste momento

