

## Plano: Importar 145 Análises do Excel para o Banco de Dados

### Situação Atual
- Banco possui **2 registros** na tabela `analises` (ambos com status "Pendente")
- Excel contém **145 registros** com: CNPJ, Data da Análise, Resultado, Analista Responsável
- Todos os 12 analistas do Excel existem em `src/data/analistas.ts`
- CNPJs verificados contra a tabela `empresas`

### Mapeamento dos Dados

| Excel | Campo no banco | Transformação |
|-------|---------------|---------------|
| CNPJ | `empresa_id` | Texto direto |
| Data da Análise | `data_inicio` e `data_conclusao` | M/D/YY → YYYY-MM-DD |
| Resultado | `status` | "Aprovada" → `Aprovada`; "Rejeitado" → `Reprovada`; "Aprovada com restrição ao emissor" → `Aprovada` (nota em `observacoes`) |
| Analista | `analista_responsavel` | Nome completo |

### Valores Padrão
- `tipo`: `'Crédito Privado'`
- `versao`: `1`
- Campos de texto (`isin`, `relatorio`, `riscos`, etc.): string vazia
- Campos numéricos/opcionais: `null`

### Execução
1. Script Python lê o Excel com pandas
2. Converte datas de M/D/YY para YYYY-MM-DD
3. Mapeia resultados para status correto
4. Gera INSERTs SQL e executa via `psql`
5. Verifica contagem final (esperado: 147 = 2 existentes + 145 novos)

### Resultado
- 145 análises visíveis na aba **Análises** e no **Pipeline de Research**
- Análises com data > 1 ano automaticamente exibidas como **Vencida** pelo front-end

