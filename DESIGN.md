---
name: ONFACE
description: Sistema operacional comercial (aquisição, venda, entrega e relacionamento) em casca grafite, canvas de papel e um único acento coral.
colors:
  coral: "#fe4f2b"
  coral-deep: "#d93c1a"
  coral-texto: "#b7391f"
  coral-hover: "#ff5a3c"
  coral-subtle: "rgba(254, 79, 43, 0.1)"
  coral-border: "rgba(255, 77, 41, 0.2)"
  preto-logo: "#12171d"
  graphite: "#090e14"
  graphite-deep: "#0b0f14"
  graphite-surface: "#161b22"
  paper: "#f6f6f3"
  branco-logo: "#eeeff3"
  white: "#ffffff"
  text-body: "#1f252c"
  cinza-2: "#616b78"
  cinza: "#6d747e"
  slate: "#8b949e"
  line: "#dbdede"
  alpha-hairline: "rgba(255, 255, 255, 0.051)"
  alpha-divider: "rgba(255, 255, 255, 0.102)"
  alpha-ring: "rgba(255, 255, 255, 0.149)"
  status-success: "#3fb950"
  status-success-strong: "#137333"
  status-danger: "#e7000b"
  status-danger-dark: "#ff7f6e"
  serie-2: "#ff8a6e"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "1.5625rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
  body-strong:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
rounded:
  xs: "0.25rem"
  sm: "0.375rem"
  md: "0.5rem"
  control: "0.625rem"
  card: "0.75rem"
  card-lg: "1rem"
  pill-nav: "1.25rem"
  canvas: "2.5rem"
  full: "9999px"
spacing:
  space-2: "0.125rem"
  space-4: "0.25rem"
  space-6: "0.375rem"
  space-8: "0.5rem"
  space-10: "0.625rem"
  space-12: "0.75rem"
  space-16: "1rem"
  space-20: "1.25rem"
  space-24: "1.5rem"
  space-32: "2rem"
  space-40: "2.5rem"
  space-48: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.coral-deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "2.25rem"
    padding: "0 1rem"
  button-secondary:
    backgroundColor: "{colors.preto-logo}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "2.25rem"
    padding: "0 1rem"
  button-tertiary:
    backgroundColor: "{colors.branco-logo}"
    textColor: "{colors.preto-logo}"
    rounded: "{rounded.control}"
    height: "2.25rem"
    padding: "0 1rem"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.preto-logo}"
    rounded: "{rounded.control}"
    height: "2.25rem"
    padding: "0 1rem"
  button-destructive:
    backgroundColor: "{colors.status-danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "2.25rem"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.preto-logo}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0.25rem 0.75rem"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.preto-logo}"
    rounded: "{rounded.card}"
  topbar:
    backgroundColor: "{colors.preto-logo}"
    textColor: "{colors.branco-logo}"
    height: "4.5rem"
  nav-pill:
    textColor: "{colors.branco-logo}"
    typography: "{typography.label}"
    rounded: "{rounded.pill-nav}"
    height: "2.375rem"
  sidebar:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.branco-logo}"
  badge-attention:
    backgroundColor: "{colors.coral-subtle}"
    textColor: "{colors.coral-texto}"
    rounded: "{rounded.full}"
---

# Design System: ONFACE

## Overview

**Creative North Star: "A casca é lei"**

ONFACE é uma ferramenta de operação comercial densa: uma casca grafite permanente no topo, um canvas de papel quente onde o trabalho acontece e um único acento coral que só aparece quando algo pede ação ou atenção. O produto é plano de propósito; superfícies se definem por fio de 1px e troca de plano, nunca por sombra. A hierarquia vem de superfície, escala, peso, densidade e posição antes de vir de cor.

Toda medida da casca e das telas ONFACE é expressa em `--onface-u`, uma unidade fluida em que 1u equivale a 1px da prancheta de 1440 (`clamp(0.5px, 0.0694vw × escala, 1.3px)`; abaixo de 768px, `clamp(0.8px, 0.2667vw, 1.25px)`). A tela inteira escala como uma redução ou ampliação fiel do desenho, em qualquer monitor e zoom. Os valores do frontmatter são os nominais da prancheta (os fallbacks em rem do `:root`); sob `html[data-onface-theme]` eles viram `calc(N * var(--onface-u))`. A densidade do produto inteiro tem um dial só, `--onface-escala` (decisão de 18/09: 1).

O tema é escopado por `html[data-onface-theme="light"]`. Os componentes shadcn de `components/ui` leem utilitários que apontam para `--cf2-*`; a seção "Ponte cf2 → ONFACE" de `onface.css` reaponta esses papéis para os tokens ONFACE, então a biblioteca fala ONFACE sem fork. `--cf2-*` é ponte, não fonte: valores novos nascem em `--onface-*` e nos papéis semânticos.

**Key Characteristics:**
- Casca grafite fixa no topo; a navegação nunca é branca.
- Um foco coral por composição.
- Hairline no lugar de sombra; só o temporário flutua.
- Número que decide em Plus Jakarta Sans bold, `tabular-nums`.
- Malha e fundo gráfico medidos na mesma unidade do layout, e só em momento, nunca em tela operacional.

## Colors

Uma rampa de acento (coral) sobre neutros de grafite e papel. Status existe à parte e responde a perguntas diferentes do acento.

### Primary
- **Coral da marca** (`coral`): borda, ícone, foco (`--ring`), `accent-color`, caret, item selecionado da sidebar e série principal de gráfico. Não carrega texto branco por cima: branco sobre ele dá 3,30:1.
- **Coral profundo** (`coral-deep`): todo preenchimento que carrega rótulo ou glifo. É o `--primary` do shadcn, `--cf2-brand` e `--cf2-accent` (branco em cima: 4,55:1).
- **Coral texto** (`coral-texto`): quando o coral é a própria letra (número de sinal, link de recorte, rótulo de alerta). 4,76:1 sobre `coral-subtle`, 5,36:1 sobre o papel.
- **Coral hover** (`coral-hover`), **coral subtle** (`coral-subtle`, fundo lavado e seleção de texto) e **coral border** (`coral-border`, variante suave e fio).

### Neutral
- **Preto do logo** (`preto-logo`): superfície da casca (`--surface-shell`) e `--text-strong`.
- **Grafite** (`graphite`): fundo da sidebar shadcn. **Grafite profundo** (`graphite-deep`) e **grafite de superfície** (`graphite-surface`): página e cartão no escopo escuro, e `--surface-shell-raised`.
- **Papel** (`paper`): `--surface-page`, o fundo do trabalho. **Branco** (`white`): `--surface-card` e popover. **Branco do logo** (`branco-logo`): `--surface-sunken`, `secondary`/`muted`/`accent` do shadcn e texto sobre a casca.
- **Texto de corpo** (`text-body`).
- **Cinza 2** (`cinza-2`): `--text-muted` e `--text-subtle` no claro (5,0:1 sobre o papel).
- **Slate** (`slate`): `--text-on-shell-muted` (6,30:1 sobre o grafite) e texto secundário no escopo escuro. **Cinza** (`cinza`): só texto terciário no escopo escuro.
- **Linha** (`line`): `--line-hairline`, `--border`, `--input`.
- **Alphas de casca** (`alpha-hairline`, `alpha-divider`, `alpha-ring`): fio, divisor e anel sobre grafite.

### Status
- **Sucesso** (`status-success` sólido, `status-success-strong` como texto; no escuro o forte sobe para `#7ee08a`).
- **Perigo** (`status-danger`; no escuro vira `status-danger-dark`).
- **Atenção** é o próprio coral (`--status-attention`, `--cf2-atencao` = coral profundo). Informativo é cinza 2 sobre branco do logo.

Séries de gráfico: `coral` (1), `serie-2` (2), `slate` (3), `line` (4), `status-success` (5).

**The Coral Is Action Rule.** Coral é ação principal, estado ativo e alerta que exige decisão. Nunca fundo de seção, nunca enfeite de cartão. Se tudo é coral, nada é.

**The Signal Rule.** Verde diz o que já aconteceu e deu certo; coral diz o que quer atenção agora; cinza diz que não há consequência. Duas pílulas com a mesma forma e cores diferentes na mesma linha é bug de semântica.

**The Two Greys Rule.** No claro existem dois cinzas de texto, e não três. Hierarquia de terceiro nível se faz por tamanho e peso, não por um cinza que ninguém enxerga.

## Typography

**Display Font:** Plus Jakarta Sans (600/700/800), via `--font-onface-titulo`
**Body Font:** Inter (400/500/600/700), via `--font-onface-corpo`
**Mono Font:** IBM Plex Mono (400/500), via `--font-onface-mono`

As três famílias são carregadas em `layout.tsx` e as variáveis legadas (`--font-cf2-ui`, `--font-onface-ui`, `--font-cf2-heading`, `--font-onface-display` e outras) apontam para o papel certo. Plus Jakarta é a voz da marca e fala pouco: título, nome de coluna, número grande. Inter é todo o resto. IBM Plex Mono é só atalho de teclado.

**Character:** separação de papéis no lugar de tamanho; texto de interface denso em Inter, números e títulos em Jakarta.

### Hierarchy
- **Display** (700, `--display-section`): número ou título de momento.
- **Headline** (700, `--display-kpi`, line-height 1, `tabular-nums`): valor de métrica.
- **Title** (700, `--display-title`): nome de entidade, título de bloco.
- **Label** (600, `--display-nav`, line-height 1): pílula de navegação e rótulo de casca.
- **Body** (400, `--text-md`, `--leading-body` 1.6) e **Body strong** (500, `--text-base`).
- **Caption** (`--text-xs`): apoio de métrica e meta.
- Escala de texto completa: `--text-2xs` 10, `--text-xs` 11, `--text-sm` 12, `--text-md` 13, `--text-base` 14, `--text-lg` 16 (u). Tracking de caixa-alta `0.0875em`; de wordmark `-0.05em`.

**The Legibility Floor Rule.** Rótulo que o operador precisa ler não desce abaixo de 11px entregues, medidos no navegador, não no nominal do token.

**The Tabular Number Rule.** Valor que decide sai em Plus Jakarta bold com `tabular-nums`: coluna de número não dança entre linhas.

## Layout

Casca fixa (`--shell-topbar-h` 72u, compacta 60u, padding lateral 24u) acima do canvas; a casca devolve a altura no `padding-top`. O documento não rola: a casca é a moldura e quem rola é o miolo. Nada de rolagem lateral em nenhuma largura (`overflow-x: clip`).

Espaçamento em passos de 2/4u (`space-2` a `space-48`). Alturas de controle: `--control-xs` 24, `sm` 28, `md` 32, `lg` 36, `form` 40, `cta` 44 (u). Ícones 12/16/18/20u. Avatares 24/32/40u, 36u na casca. Gutters 16/20/24u (mobile, tablet, desktop). Alvo de toque mínimo 44px.

Breakpoints reais: a 1440 a tela é o desenho (1u = 1px); a 1280 nada troca de forma, de propósito; abaixo de 1024 o descritor e a régua da marca saem do topbar e o perfil fica só com avatar; abaixo de 768 a unidade é recalibrada para o telefone, a navegação vira folha lateral e quadro e bento caem para uma coluna.

Densidade (compacta, padrão, confortável) muda o respiro vertical da linha, nunca o tamanho da fonte nem a altura do controle.

**The Shell Is Law Rule.** Topbar, moldura grafite, canvas claro e a escala em `--onface-u` não são negociáveis por tela. Quem precisa de outro layout está descrevendo um layout novo da casca, não uma exceção.

**The One Metric Rule.** Escolha o número que muda a decisão e dê a ele superfície, escala e peso. O resto é apoio: denso, pequeno e neutro.

## Elevation & Depth

Plano por padrão. A definição vem de fio de 1px (`--ring-inset-hairline`, `--line-hairline`) e troca de plano: casca grafite, papel da página, cartão branco, rebaixado. `--shadow-card` é `none`. Sombra existe só no que flutua (popover, menu, diálogo, folha, cartão sendo arrastado), sempre neutra; os valores estão no sidecar. Empilhamento: `--z-modal` 2000, `--z-popover` 2100, `--z-aviso` 2200 (menu acima de modal porque abre dentro dele).

O escuro é um escopo, não um tema global: `.onface-page-surface[data-tom="escuro"]` ou `[data-onface-superficie="escura"]` reapontam a camada semântica para grafite. Coral não muda entre os dois tons.

**The Temporary Floats Rule.** Se a peça some quando você clica fora, ela pode flutuar. Card, KPI, tabela e painel ficam colados na página.

## Shapes

Cantos contidos: controle `control` (10u), cartão `card` (12u), cartão grande `card-lg` (16u), pílula de navegação `pill-nav` (20u), canvas `canvas` (40u). `full` só para chip, badge, avatar e trilho do controle segmentado. O `--radius` do shadcn é `--radius-control`, então `rounded-md` resolve em 8u e `rounded-xl` em 14u.

**The Contained Radius Rule.** Card em cápsula está fora. O raio é token; pílula é só para chip, badge e avatar.

## Components

Primeira parada de toda tela é `components/ui` (shadcn do repo, reapontado pela ponte cf2). Componente novo só quando a composição de dois existentes não resolve.

- **Botão** (`components/ui/button.tsx`): hierarquia de cinco degraus (primary coral profundo, secondary tinta, tertiary rebaixado, subtle, ghost) mais `outline`, `link` e semânticos (`destructive`, `success`, `warning`). Raio de controle, `loading` embutido, desabilitado a 45% de opacidade. Hover por brilho ou troca de superfície, nunca por cor nova.
- **Campo** (`components/ui/input.tsx`): 36px de altura, fio `--input`, raio 8u, placeholder em `--text-muted`, foco em anel coral.
- **Controle segmentado** (`ToggleGroup`, ajustado em `controles-onface.css`): trilho rebaixado em pílula; o item selecionado sobe como papel com peso e sombra neutra de 1px, nunca com cor de marca.
- **Topbar e navegação** (`onface.css`): faixa fixa em preto do logo com fio `alpha-hairline`; pílulas de navegação em Jakarta 600, inativas em slate, hover em `alpha-hairline` e a ativa preenchida em coral da marca; seleção de texto coral a 30% dentro da casca.
- **Sidebar shadcn**: grafite contra o papel; hover é branco a 6% (troca de superfície), coral só no item selecionado.
- **Cartão de produto**: superfície branca, fio hairline, raio de cartão, sem sombra. Informação relacionada divide a mesma superfície com separador e alinhamento.

Motion: mudança de estado é crossfade de cor e opacidade (`--motion-fast` 120ms, `--ease-standard`), sem quicar; molas e variantes de entrada vivem em `components/onface/ds/motion.ts`. `prefers-reduced-motion` zera transições na casca, menus e folhas.

## Do's and Don'ts

### Do:
- **Do** compor com o que existe: primeiro `components/ui` e o laboratório em `/design`, depois a composição de dois existentes.
- **Do** tirar cor de token e medida de `calc(N * var(--onface-u))`.
- **Do** usar coral profundo em preenchimento com texto, coral puro em traço, ícone e foco, e coral texto quando o coral é a letra.
- **Do** dar grafite, fundo gráfico e número grande só ao bloco que muda o próximo passo (centro de comando, conclusão, proposta, processamento do NEXO, vazio importante).
- **Do** definir superfície por fio de 1px e anel interno.

### Don't:
- **Don't** abrir um segundo sistema: componente paralelo, hex solto, px solto ou casca própria de tela.
- **Don't** usar sombra colorida ou glow coral; sombra é neutra.
- **Don't** usar gradiente decorativo, glassmorphism ou card dentro de card.
- **Don't** usar card em cápsula ou ilustração genérica em estado vazio; o vazio é ícone de linha, texto direto e a ação que resolve.
- **Don't** pintar o bloco inteiro de coral, nem pôr dois momentos na mesma tela.
- **Don't** colocar malha ou fundo gráfico atrás de tabela ou formulário.
- **Don't** dar o mesmo tratamento a todos os blocos (democracia visual).
