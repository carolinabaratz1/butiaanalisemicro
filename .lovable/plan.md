## Correção do CNPJ do Tesouro Nacional

Atualmente o helper de emissor sintético para ativos **Overnight** e **LFT** usa o CNPJ `00.000.000/0001-91`, que na verdade é do Banco do Brasil. O CNPJ correto do Tesouro Nacional é **`00.394.460/0001-41`**.

### Alteração

- **`src/components/alocacao/allocationUtils.ts`**: alterar a constante `TESOURO_CNPJ` de `"00.000.000/0001-91"` para `"00.394.460/0001-41"`.

Essa constante é a única fonte usada pelo `synthesizeIssuerFromProduct`, que por sua vez alimenta:
- Posições (`PosicoesPage.tsx`)
- Exposição por Grupo/Emissor (`useExposicaoData.ts`)
- Trade Monitor → Alocação (`useAllocationData.ts`)

Portanto, apenas essa linha precisa ser corrigida — todos os consumidores passarão a apontar para o CNPJ correto automaticamente.

### Observações

- Nenhuma alteração de schema, RLS ou dados persistidos é necessária — o CNPJ é injetado de forma sintética em runtime.
- Se existir no cadastro `empresas` um registro real de Tesouro Nacional com o CNPJ `00.394.460/0001-41`, a exposição passará a se ligar corretamente a ele (incluindo rating cadastrado). Caso contrário, o fallback sintético com rating "Soberano" continua funcionando.
