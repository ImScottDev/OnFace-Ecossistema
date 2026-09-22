# Fundação antes das telas

Estudo feito em 2026-09-22 sobre a documentação inteira do shadcn (111 páginas, 52
de conceito, via `llms.txt`), a skill oficial `shadcn` instalada com
`pnpm dlx skills add shadcn/ui`, e o estado real deste repo medido no navegador.

O padrão dos erros até aqui foi sempre o mesmo: descobrir a fundação no meio de uma
tela. Este documento existe para isso não se repetir.

## 1. O que o projeto é, segundo a própria CLI

`npx shadcn@latest info --json`:

```
framework       Next.js 16.1.6 (app router, RSC)
tailwind        v4, css em src/app/globals.css, sem tailwind.config
style           new-york
base            radix          <- NÃO é Base UI
icon            lucide
aliases         ui: @/components/ui · utils: @/lib/utils/cn
preset          null           <- nenhum preset aplicado
```

`base: "radix"` é o que decide entre `asChild` e `render` nos triggers, e é o que
torna `combobox` (que importa `@base-ui/react`) uma peça fora do padrão daqui.

## 2. O tema ONFACE JÁ EXISTE e já está correto

Medido no navegador em `/onface-desenho/pipeline`, que roda a casca real:

| token | com `data-onface-theme="light"` | sem o atributo |
|---|---|---|
| `--primary` | **#fe4f2b** (coral ONFACE) | #c8ff00 (verde-lima legado) |
| `--background` | **#f6f6f3** (canvas claro) | #0a0a0a |
| `--cf2-brand` | **#d93c1a** (coral já escurecido) | — |

**O verde-lima só aparece onde o atributo de tema não está no `<html>`.** Eu reportei
o valor declarado no `:root` como se fosse o estado do produto, sem checar o
computado com o atributo presente. Era auditoria de superfície.

Consequência prática, e é a maior deste documento: **o estúdio não precisava inventar
token nenhum.** Bastava marcar `data-onface-theme="light"` no `<html>` e herdar o
tema que o produto já tem, inclusive o coral escurecido que resolve contraste.

## 3. As regras oficiais que o estúdio violou

Da skill `shadcn` (`rules/styling.md`, `rules/composition.md`, `rules/icons.md`):

| Regra oficial | O que eu fiz |
|---|---|
| `className` é para **layout**, nunca para cor ou tipografia | passei `text-[var(--tinta-forte)]` em praticamente todo elemento |
| usar cor **semântica**: `bg-primary`, `text-muted-foreground` | inventei `--tinta-forte`, `--tinta-media`, `--tinta-fraca` |
| **nunca criar arquivo CSS novo** para tema; editar o `globals.css` | criei `estudio.css` com 400 linhas |
| ícone dentro de `Button` usa `data-icon`, **sem classe de tamanho** | usei `<Search className="size-4" />` dentro de Button |
| conjunto de 2 a 7 opções usa `ToggleGroup` | usei `Toggle` solto dentro de `ButtonGroup` |
| formulário usa `FieldGroup` + `Field` | não usei |
| status positivo/negativo usa `Badge` ou `text-destructive` | inventei `--positivo-texto` e `--coral-texto` |

Não foi questão de gosto: construí **contra** a biblioteca, e é por isso que cada
rodada descobria um defeito novo de base.

## 4. Como o tema muda depois, que era a pergunta

Três caminhos oficiais, do mais barato ao mais completo:

```bash
# 1. Preset pronto, aplicado por código
npx shadcn@latest apply --preset a2r6bw

# 2. Preset nomeado, preservando os componentes já customizados
npx shadcn@latest init --preset nova --force --no-reinstall

# 3. Editar as ~25 variáveis em globals.css, em :root e .dark
```

Cor nova entra pelo caminho oficial e em nenhum outro:

```css
:root  { --warning: oklch(0.84 0.16 84); --warning-foreground: oklch(0.28 0.07 46); }
.dark  { --warning: oklch(0.41 0.11 46); --warning-foreground: oklch(0.99 0.02 95); }

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

E aí a tela escreve `bg-warning text-warning-foreground`. O formato é **OKLCH**, não
hex: lightness, chroma, hue. Com isso, trocar a cara do produto com as telas prontas
é mexer em 25 linhas, e toda tela acompanha — desde que nenhuma tenha cor literal.

## 5. Dark mode

Não existe hoje: os três resultados de `.dark` no `globals.css` são `.dark-input`,
uma classe de input do shell legado. `next-themes` está instalado e nunca foi
configurado.

O caminho é o oficial: `ThemeProvider attribute="class"`, `suppressHydrationWarning`
no `<html>`, `disableTransitionOnChange`, e os mesmos 25 tokens redefinidos dentro de
`.dark`. Sem segunda folha de estilo, sem `dark:` escrito na tela.

## 6. Ferramentas que passam a fazer parte do processo

- **Skill oficial** (instalada): traz contexto do projeto, regras com exemplos
  errado/certo, e `npx shadcn@latest docs <componente>` para a doc de cada peça.
- **MCP server**: `npx shadcn@latest mcp init --client claude` dá busca e instalação
  por linguagem natural, direto do registry.
- **`BIBLIOTECA.md`** (neste diretório): o inventário com 51 componentes instalados,
  o que falta e o custo de cada um.

## 7. Ordem de execução

**Onda 0, fundação, nenhuma tela**
1. `globals.css`: `:root` com ONFACE claro e `.dark` com ONFACE escuro, nos 25 tokens
   oficiais, em OKLCH. O `estudio.css` morre.
2. `button.tsx` volta ao padrão: as 12 classes `bg-marca`/`text-tinta` viram
   `bg-primary`/`text-foreground`. É o único primitivo fora do padrão (42 de 43 já
   estão certos).
3. `next-themes` configurado.
4. MCP do shadcn ligado.

**Onda 1, prova**
Rota `/tokens` mostrando os 25 tokens nos dois modos com o contraste de cada par
medido. É o que teria evitado os três defeitos em sequência (coral, tinta fraca,
verde), todos descobertos depois da tela pronta.

**Onda 2 em diante, telas**
Antes de cada uma: `npx shadcn@latest search` no registry, escolher os componentes,
nomear o arquétipo, decidir primeira camada e detalhe, e só então escrever.

## 8. Regras duras

- Cor só por token semântico. Nunca hex, nunca `text-[13px]`, nunca `var(--meu-token)`
  em `className`.
- `className` só para layout.
- Nunca `shadcn add --overwrite` (já destruiu o `button.tsx` uma vez).
- Todo componente com `useId` interno precisa de `id` explícito (`ChartContainer`,
  `DndContext`), senão a hidratação cai.
- Contraste medido com alpha composto, nos dois temas, antes de fechar a tela.
- Medir token pelo valor **computado no navegador com o atributo de tema presente**,
  nunca pelo declarado no arquivo.
