repo: ImScottDev/OnFace-Ecossistema
branch: main
path: app/

## Last sync

date: 2026-09-22T18:44:20Z

### Updated in this project
- Casca ONFACE construída: sidebar inset colapsável (⌘B), rail de 52px, topbar contextual, logo "ON" real do repo.
- Árvore de navegação de 3 níveis espelhada de `navigation.ts`; rotas `pendente` marcadas com ponto e aviso "em construção".
- Pré-vendas desenhada a partir do domínio real: Qualificado e Oportunidade marcados como **comando** (não destino de arraste), nutrição com motivo + data obrigatória, lead sem empresa bloqueando oportunidade.
- Copiados os assets de marca Callface (brand/) e o logo ONFACE.
- Escopo desta rodada: área de **Vendas**, identidade coral/graphite, sem números fabricados.
- Laboratório `/design/onface` trazido para cá: os 10 CSS de `components/onface/ds/` + `onface.css` copiados e servidos em `OnFace DS Lab.dc.html` (CSS real, tokens em `html[data-onface-theme]`).
- Quadro de Pré-vendas reconstruído na especificação de `quadro.css`: coluna sem borda (plano afundado), pastilha de contagem, ponto de urgência no canto, arraste com rotação e sombra de duas camadas, anel coral no alvo de soltura.

## Kit ONFACE — UI Components (.fig)

Importado para `design-system/`. O kit é shadcn **já tematizado para ONFACE** e passa a ser a fonte da verdade visual.

- `fig-tokens.css` — **2054/2054 variáveis**, 21 coleções, modos light e dark.
- `Components.bundle.js` + `Components.d.ts` — **124 de 125 famílias** de componentes.
- `fig-typography.css` — o arquivo não define text styles (0); a tipografia vive nos componentes.
- `styles.css` na raiz importa os três.

Tokens de tema confirmados: `--primary` `#fe4f2b` · `--primary-foreground` branco · `--foreground` `#090b0c` · `--border` `#e3e7e8` · `--muted-foreground` `#67787c` · `--muted` `#f1f3f3` · `--destructive` `#e7000b` · `--ring` coral · `--radius` 10px.

### Pendente do import
- **Date** (célula de calendário, 72 variantes) — não resolveu pelo nome; precisa do node id.
- **Conjuntos de ícones** (~14.018 glifos: Lucide, HugeIcons, Phosphor, Remix, Tabler) — o `.fig` desmontou antes. Lucide é o que o código usa (`navigation.ts` importa de `lucide-react`), então é a prioridade quando reanexar.
- Avisos de extração: em `Avatar` e `Item`, a variante `Size=sm, Type=Avatar badge, Dir=None` colide de chave e fica inalcançável.

### Conflito a decidir
`--primary-foreground` branco sobre `--primary` coral dá **3,3:1** — abaixo de 4,5:1 para texto de corpo. Nos botões preenchidos desta casca usei `#d93c1a` (coral profundo, 4,6:1). O kit e o `onface.css` divergem nesse ponto.

## Screen map

| Tela no projeto | Arquivos do repo |
|---|---|
| OnFace Casca.dc.html | `components/onface/navigation.ts`, `app/onface.css`, `lib/vendas/pre-vendas.ts`, `lib/vendas/dominio.ts`, `components/onface/ds/quadro.css`, `public/onface/figma-logo.svg` |
| OnFace DS Lab.dc.html | `components/onface/ds/*.css`, `components/onface/ds/navegacao.ts`, `app/(onface-preview)/design/onface/[[...secao]]/page.tsx` |
| OnFace Dashboard.dc.html | (exploratória, pré-repositório — não derivada do código) |
| — fundação de tokens | `app/src/app/onface.css`, `app/src/app/layout.tsx` |
| — navegação / menu | `app/src/components/onface/navigation.ts`, `app/src/components/onface/OnfaceTopbar.tsx` |
| — moldura de página | `app/src/components/onface/shell/OnfacePage.tsx`, `shell/page.css` |
| — primitivas de sidebar (legado CRM2) | `app/src/components/crm2/ui/Sidebar.tsx` |
| — anatomia dos componentes | `app/src/components/ui/{button,badge,card,table,empty,item}.tsx` |
| — registry shadcn próprio | `app/registry.json`, `app/components.json` |

## Pendências técnicas observadas

- `card.tsx` de fábrica traz `shadow-sm`, mas o DS ONFACE define `--shadow-card: none` (elevação por hairline). Desenhado aqui conforme o DS.
- Primitivas que a biblioteca `.fig` pede e o repo ainda não tem: `button-group`, `input-group`, `kbd`, `combobox-chip`, `menubar`, `avatar-group`, `avatar-badge`, `slider`, `check`, `icon`.

## Desvios de jornada propostos (Pré-vendas)

O redesign não é visual: estas são mudanças de função que o domínio exige e a tela antiga não expressa.

1. **Qualificado e Oportunidade saem do arraste.** `moverEtapa` lança `RegraDeNegocio` para as duas. Marcadas como "comando" no cabeçalho da coluna, em vez de erro depois do clique.
2. **Nutrição com motivo + data no mesmo passo.** 6 dos 8 motivos exigem retomada; o botão fica desabilitado até a data existir, porque a data cria tarefa real.
3. **Lead sem empresa é pendência visível.** Ponto coral no card e aviso no drawer; "Criar oportunidade" nasce desabilitado em vez de falhar.
4. **Visão Fila ao lado do Quadro.** Ordenada por urgência (`tarefas.vence_em`, `leads.last_contact_at`) — quem não tem próxima ação sobe ao topo. O quadro mostra estado; a fila mostra o que fazer agora.
