

## Plano: Substituir SVG genérico pela logo oficial PNG da Butiá

### Problema
O componente `ButiaLogo` usa um SVG de palmeira desenhado manualmente que não corresponde à logo oficial da Butiá Investimentos. O usuário forneceu o PNG oficial (versão negativa/branca com fundo transparente).

### Mudanças

**1. Copiar o PNG oficial para o projeto**
- Copiar `ButiaInvestimentos_Vertical_Negativo.png` para `src/assets/logo-butia-white.png`

**2. Reescrever `src/components/ui/ButiaLogo.tsx`**
- Remover todo o SVG inline (PalmSvg) e o texto manual ("BUTIÁ" / "INVESTIMENTOS")
- Usar `<img>` com o PNG importado
- Para `theme="dark"`: exibir o PNG branco diretamente (fundo transparente funciona sobre navy)
- Para `theme="light"`: aplicar CSS filter `brightness(0)` + `saturate(100%)` + cor via filtro para transformar o branco em navy (#1B3864), ou usar um segundo PNG se disponível
- Manter as props `variant`, `size` e `className` controlando dimensões via width/height
- Como o PNG já contém o texto "BUTIÁ INVESTIMENTOS" na versão vertical, a variante `full` usa a imagem completa; a variante `icon` pode usar um crop ou a imagem inteira em tamanho menor

**3. Gerar ícones PWA a partir da logo oficial**
- Usar script Python com Pillow para criar `icon-192.png` e `icon-512.png` a partir do PNG oficial (logo branca centralizada sobre fundo navy #1B3864)
- Substituir os ícones genéricos atuais

### Detalhe técnico: troca de cor por tema
O PNG fornecido é branco — perfeito para fundos escuros. Para fundos claros, usaremos CSS filter para torná-lo navy:
```css
filter: brightness(0) saturate(100%);
/* Isso transforma qualquer cor em preto puro */
/* Combinado com sepia + hue-rotate para chegar ao navy */
```

### Arquivos modificados
- `src/assets/logo-butia-white.png` (novo — cópia do upload)
- `src/components/ui/ButiaLogo.tsx` (reescrito para usar img)
- `public/icon-192.png` e `public/icon-512.png` (regenerados com logo oficial)

