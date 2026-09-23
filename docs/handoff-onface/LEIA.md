# Handoff do protótipo ONFACE — fonte do desenho

Bundle exportado do Claude Design em 22/09/2026 e versionado aqui. **Esta pasta é
a fonte do padrão visual do produto.** Quando o desenho e o código discordarem,
o desenho ganha.

## O que é canônico

| Arquivo | O que é |
|---|---|
| `OnFace Casca.dc.html` | A moldura: coluna, barra do topo, busca ⌘K, NEXO, aviso |
| `OnFace Pecas.dc.html` | As peças compartilhadas: gaveta de detalhe, modal de atividade, menu de tags, modal de cadência, popup de qualificação, desqualificação e nutrição |
| `OnFace Pre-vendas.dc.html` | Quadro, lista, filtros, exportação e seleção em massa |
| `OnFace Empresa.dc.html` | Página da empresa |
| `OnFace Dashboard.dc.html` | Dashboard — **usa outra paleta**, ver abaixo |
| `OnFace DS Lab.dc.html` | Laboratório do design system |
| `dados.js` | Fonte única de dado do protótipo **e** o store que atravessa páginas |
| `CLAUDE.md` | **O contrato de arquitetura.** Ler antes de mexer em qualquer tela |
| `inventario.md` | Gerado. Todo valor de estilo que o protótipo declara |

## O que NÃO é fonte

- `design-system/fig-tokens.css` — 2.376 variáveis cruas do Figma com nome sem
  significado (`--0-2: 0;`) e **zero cor**. Não serve de sistema de token.
- `design_handoff_pre_vendas/` — o recorte anterior, que veio sem `support.js` e
  sem as Peças. Fica como histórico; os screenshots dele ainda valem.
- `uploads/` — colagens da conversa de design. **Fora do git** (`.gitignore`), e
  é por isso que o material de spec não pode viver só ali.

## Como isto vira código

1. `node scripts/inventario-handoff.mjs` regera `inventario.md` a partir dos
   `.dc.html`. **Rodar a cada bundle novo.**
2. `app/src/app/onface-proto.css` é a camada de token, escrita a partir do
   inventário. Nome descreve papel, não valor.
3. A tela consome token. `app/src/lib/arquitetura/cor-tem-nome.test.ts` é a
   catraca: arquivo novo nasce sem hex literal, arquivo velho só encolhe.

O `README-bundle.md` (do próprio Claude Design) é explícito e vale seguir:
*"Don't render these files in a browser… Everything you need — dimensions,
colors, layout rules — is spelled out in the source."* A fonte é o código do
protótipo, não screenshot.

## Decisão aberta: a paleta do Dashboard

O inventário mede uma divergência dentro do próprio protótipo:

| tela | cores exclusivas dela | usos |
|---|---:|---:|
| Dashboard | **36** | 364 |
| Casca | 13 | 41 |
| Pecas | 8 | 19 |
| Pre-vendas | 4 | 12 |
| DS Lab | 4 | 8 |

O Dashboard foi desenhado com outra rampa de cinza (`#667085`, `#475467`,
`#e4e7ec`, `#eff1f4`) e um teal (`#0e7c6b`, `#0a6558`) que não aparece em
nenhuma outra tela. As demais usam `#4a5560`, `#67787c`, `#e3e7e8`, `#dbdede`.

**A camada de token cobre o núcleo de 27 cores** (as que aparecem em três ou
mais telas) e deixa o Dashboard de fora até o Scott decidir qual rampa vence.
Isso só bloqueia a tela de Dashboard, não as outras.
