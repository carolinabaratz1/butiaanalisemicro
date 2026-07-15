## Problema

O tratamento sintético dos ativos especiais (Termo → B3, Overnight/LFT → Tesouro Nacional, DAP/Futuro → excluído) foi aplicado nas abas Posições, Exposição por Grupo/Emissor e Alocação, mas **não foi propagado para o Dashboard do Fundo** (aba "Dashboard" em `/posicoes`, componente `FundoDashboard`).

O hook `useFundoDashboard` consome o RPC `get_posicoes_dashboard_fundo` e agrega diretamente pelos campos crus (`nome_emissor`, `grupo_economico`, `cnpj_emissor`, `product_class`), sem passar pelo helper `synthesizeIssuerFromProduct` nem filtrar DAP/Futuro.

Efeitos visíveis hoje no dashboard:
- Ativos Termo aparecem sem emissor/grupo (ou com o emissor original), em vez de B3 / grupo TERMO.
- Overnight e LFT aparecem sem emissor consolidado, em vez de Tesouro Nacional / grupo CAIXA / rating "Soberano".
- DAP/Futuro entra no PL total, distorcendo KPIs, distribuições e Top Posições.

## Correção

Ajustar apenas o hook `src/hooks/useFundoDashboard.ts` para reaplicar a mesma normalização já em uso nas demais telas. Nenhuma outra tela, RPC ou tabela precisa mudar.

Passos:

1. **Filtrar DAP/Futuro antes de qualquer agregação**  
   Aplicar `isExcludedFromPL(product_class, product_class)` (usando `product_class` como produto — é o único campo disponível no retorno do RPC) e descartar as linhas correspondentes. Assim DAP/Futuro somem de PL total, nº de ativos, duration médio, distribuições e Top Posições.

2. **Injetar emissor sintético para Termo/Overnight/LFT**  
   Antes de resolver ratings e classificar, mapear cada `DashboardRow` com `synthesizeIssuerFromProduct(product_class, product_class)`:
   - Quando o helper retorna um sintético, sobrescrever no row: `nome_emissor`, `grupo_economico`, `cnpj_emissor`, `setor` e um campo `rating` sintético (`"Soberano"` para Tesouro, `"AAA"` para B3).
   - Isso garante que o rating resolvido por CNPJ pegue o registro real do Tesouro/B3 quando existir em `empresas`, e caso contrário use o rótulo sintético como fallback.

3. **Preservar o rótulo "Soberano" no Top Posições e no By Rating**  
   Após a resolução por CNPJ, se o row for sintético soberano (Tesouro), forçar o `ratingLabel` exibido como `"Soberano"` (mantendo o bucket AAA na agregação `byRating`, para não quebrar a ordenação existente).

4. **CNPJs únicos para resolução de rating**  
   O `Set` de CNPJs enviado para `resolveRatingsBatch` passa a incluir os CNPJs sintéticos (B3 `09.346.601/0001-25` e Tesouro `00.394.460/0001-41`), então limites e ratings reais desses emissores, se cadastrados, aparecem naturalmente.

## Detalhes técnicos

- Arquivo alterado: `src/hooks/useFundoDashboard.ts` apenas.
- Imports adicionais: `synthesizeIssuerFromProduct`, `isExcludedFromPL` de `@/components/alocacao/allocationUtils`.
- Transformação feita uma vez, logo após receber `rows` do RPC e antes de montar `uniqueCnpjs`. As agregações (`byTipo`, `byIndexador`, `byDuration`, `topPosicoes`, `byRating`, `bySetor`, `byGrupo`, `byEmissor`, `qualidade`) reutilizam os rows normalizados sem mudança adicional.
- Nada muda no RPC, em RLS, em tipos gerados, nem no componente `FundoDashboard.tsx`.

## Fora de escopo

- Renormalização do `byTipo` para os rótulos padronizados de `tipoAtivoFromProduct` (hoje mostra o `product_class` cru). Pode ser tratado em uma etapa futura se o usuário pedir.
- Qualquer ajuste em Notional/DAP — mantém-se apenas a exclusão do PL, conforme já acordado.
