

## Plano: Logo SVG dinâmica + Ícones para PWA / Home Screen

### Problema
1. A logo na sidebar usa um PNG (`logo-butia.png`) com fundo branco, que não se integra bem ao fundo navy escuro
2. Ao salvar o app na Home Screen do celular, aparece um ícone genérico "B" cinza em vez da logo da Butiá

### Mudanças

**1. Converter logo PNG para SVG inline no componente `ButiaLogo.tsx`**

- Substituir o `<img src={logoImg}>` por um SVG inline da palmeira estilizada da Butiá
- O SVG terá `fill` dinâmico baseado na prop `theme`: branco no tema dark (sidebar), navy (#1B3864) no tema light
- Fundo transparente natural do SVG — sem mais quadrado branco
- Remover a dependência do arquivo `src/assets/logo-butia.png`

**2. Gerar ícones para PWA / Home Screen e configurar `manifest.json`**

- Criar ícones da logo Butiá em múltiplos tamanhos (192x192, 512x512) com fundo navy e logo branca — para uso no celular
- Criar `public/manifest.json` com:
  - `name`: "Butiá Research Platform"
  - `short_name`: "Butiá Research"
  - `icons`: referenciando os ícones gerados
  - `display`: "standalone"
  - `theme_color`: "#1B3864"
  - `background_color`: "#1B3864"
- Adicionar `<link rel="manifest">` e `<link rel="apple-touch-icon">` no `index.html`
- **Sem service worker** — apenas manifest para instalabilidade e ícone correto

### Detalhe técnico: SVG da palmeira

O SVG será desenhado como path inline reproduzindo o ícone da palmeira estilizada que já existe no PNG. A cor será controlada via prop, garantindo que funcione em qualquer contexto (sidebar escura, páginas claras, etc.).

### Arquivos modificados
- `src/components/ui/ButiaLogo.tsx` (SVG inline dinâmico)
- `public/manifest.json` (novo)
- `public/icon-192.png` e `public/icon-512.png` (novos, gerados via script)
- `index.html` (links para manifest e apple-touch-icon)

