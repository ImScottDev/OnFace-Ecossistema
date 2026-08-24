# CRM 2.0 — Design System (auditoria real, 24/08)

> Este documento é uma AUDITORIA do que existe hoje no código, não uma
> especificação do que deveria existir. Onde não há sistema formal, isso
> está marcado explicitamente como gap — nada foi inventado pra parecer
> mais pronto do que está.
>
> Fonte única hoje: `src/app/globals.css` (não existe `theme.ts`/`tokens.ts`
> — as variáveis CSS soltas no `globals.css` SÃO o design system atual).

## 0. Dois sistemas de cor coexistindo no mesmo app

- **Legado** (`:root`, linhas 1-55 de `globals.css`): `--bg-primary`,
  `--accent-purple` (#e23752, carmim), `--accent-roxo` (#8e27ef), `--accent-lima`
  (#c8ff00), `--success`/`--warning`/`--danger`/`--info`. Usado pelas telas
  antigas (`src/app/(crm)/...`, `src/components/crm/...`) e ainda referenciado
  em módulos cf2 mais antigos (ex.: `.btn-primary`, `.unread-badge`,
  `chat-bubble-out` em `ChatThread.tsx` usam `var(--accent-purple)` / roxo
  `#A78BFA` hardcoded).
- **CRM 2.0 / cf2** (`[data-cf2-theme="..."]`, linhas 81-193): sistema novo,
  contrato visual do Figma (09/08 em diante), variáveis `--cf2-*`. É o que
  toda tela nova (`src/app/(crm2)/...`) deveria usar exclusivamente.

Este documento cobre o sistema **cf2**, que é o que importa pras próximas
rodadas de construção.

## 1. Paleta real (valores hex tirados direto do CSS)

Existem hoje **3 escopos de tema** — `light`, `builder`, e a "chrome" fixa
(sidebar/hero/Carol) que vive dentro do escopo `light`. **Não existe
`[data-cf2-theme="dark"]`** — o comentário no próprio CSS (linha 76-79) diz
que dark "seria só adicionar um bloco" quando for implementado. Hoje não foi.

### `[data-cf2-theme="light"]` — tema padrão de app (a maioria das telas)

| Categoria | Variável | Hex/valor |
|---|---|---|
| Superfície | `--cf2-bg-page` | `#fafafa` |
| Superfície | `--cf2-bg-canvas` | `#f8fafc` |
| Superfície | `--cf2-bg-surface` | `#ffffff` |
| Superfície | `--cf2-bg-surface-muted` | `#f3f4f6` |
| Superfície | `--cf2-bg-surface-subtle` | `#f8fafc` |
| Superfície | `--cf2-bg-inverse` | `#111827` |
| Borda | `--cf2-border-default` | `#e5e7eb` |
| Borda | `--cf2-border-grid` | `rgba(217,222,229,0.4)` |
| Texto | `--cf2-text-primary` | `#111827` |
| Texto | `--cf2-text-secondary` | `#4b5563` |
| Texto | `--cf2-text-tertiary` | `#9ca3af` |
| Texto | `--cf2-text-on-accent` | `#0f172a` |
| Texto | `--cf2-text-on-inverse` | `#ffffff` |
| Marca/accent | `--cf2-accent` | `#aaff00` (lima Figma — **diferente** do lima do style guide legado `--accent-lima: #c8ff00`, decisão deliberada do Kauã) |
| Marca/accent | `--cf2-accent-border` | `#88d600` |
| Marca/accent | `--cf2-accent-bg-subtle` | `#f3f4f6` |
| Semântica | `--cf2-success-text` | `#15803d` |
| Semântica | `--cf2-success-bg` | `#dcfce7` |
| Semântica | `--cf2-success-fill` | `#09ba2a` |
| Semântica | `--cf2-warning-text` | `#f59e0b` |
| Semântica | `--cf2-warning-bg` | `#fffbeb` |
| Semântica | `--cf2-warning-border` | `#fef3c7` |
| Semântica | `--cf2-danger-text` | `#e53333` |
| Semântica | `--cf2-danger-border` | `#e53333` |
| Semântica | **`--cf2-danger-bg`** | **não existe** (ver §3) |
| Avatar (ciclo por índice, não semântico) | `--cf2-avatar-1..5` | `#aaff00` `#34d399` `#ff6b8a` `#f59e0b` `#60a5fa` |
| Sombra | `--cf2-shadow-shell` | `-4px 0 16px rgba(0,0,0,.08)` |
| Sombra | `--cf2-shadow-card-sm` | `0 4px 8px rgba(0,0,0,.04)` |
| Sombra | `--cf2-shadow-card-md` | `0 4px 16px rgba(0,0,0,.04)` |
| Raio | `--cf2-radius-sm/md/lg/xl/full` | `8px / 12px / 16px / 24px / 9999px` |

### Chrome fixo (sidebar / hero de Início / barra da Carol) — sempre escuro, mesmo em tema claro

| Variável | Hex |
|---|---|
| `--cf2-chrome-bg` | `#1c1f26` |
| `--cf2-chrome-bg-alt` | `#16171c` |
| `--cf2-chrome-surface-active` | `#1a1d24` |
| `--cf2-chrome-border` | `rgba(255,255,255,0.17)` |
| `--cf2-chrome-border-subtle` | `#22252a` |
| `--cf2-chrome-text-primary` | `#ffffff` |
| `--cf2-chrome-text-secondary` | `#9ca3af` |

### `[data-cf2-theme="builder"]` — só o editor de automações/cadências (canvas de grafo)

| Variável | Hex |
|---|---|
| `--cf2-bg-page` / `--cf2-bg-canvas` | `#171812` / `#151611` |
| `--cf2-bg-surface` / `-muted` / `-subtle` | `#20211b` / `#292a23` / `#1b1c17` |
| `--cf2-text-primary` / `-secondary` / `-tertiary` | `#f5f7ef` / `#aeb3a4` / `#747a6c` |
| `--cf2-accent` / `-border` | `#b5ff16` / `#8ac400` |
| `--cf2-success-text/bg/fill` | `#9fe870` / `#26351e` / `#9fe870` |
| `--cf2-warning-text/bg/border` | `#f3b75f` / `#332d1b` / `#554626` |
| `--cf2-danger-text/border` | `#ff8e83` / `#b8544e` |

## 2. Tipografia real

Fonte carregada via `next/font/google` em `src/app/layout.tsx`:

| Variável CSS | Fonte | Uso |
|---|---|---|
| `--font-cf2-ui` | **Inter** | corpo/UI padrão do tema `light` (aplicado no elemento raiz do escopo, componente não precisa declarar) |
| `--font-cf2-heading` | **Manrope** | títulos/headers (`Cf2SectionHeader`, `Cf2Eyebrow`, `Cf2Gauge`) |
| `--font-cf2-nav` | **Geist** | só 1 uso encontrado fora do CSS (nav) |
| `--font-heading` (legado) | Poppins | telas antigas |
| `--font-body` (legado) | Noto Sans | telas antigas |

**Não existe Kanit** no CRM 2.0 — só aparece em comentário `.metric-value`
referenciando "estilo Kanit" mas a variável real (`--font-heading`) já é
Poppins desde 18/06 (decisão registrada no próprio CSS).

Escala de tamanho de texto (contagem real de uso de `text-[Npx]` em
`src/components/crm2` + `src/app/(crm2)`, ordenada por frequência):

```
10px (153×) · 11px (383×) · 12px (385×) · 13px (384×) · 14px (80×)
9px (21×) · 16px (20×) · 18px (15×) · 15px (13×) · 20px (11×)
24px (9×) · 22px (9×) · 28px (5×) · 8px (4×) · 26px (3×) · 17px (2×) · 32px (1×)
```

**Gap real**: não existe escala de tipografia formalizada (nem no Tailwind
config nem em CSS) — é tudo `text-[Npx]` arbitrário. Na prática o grosso do
produto convergiu em 10/11/12/13/14px pra corpo de UI, 18-20px pra headers de
seção e 22-32px pra métricas grandes, mas isso é convenção observada, não
regra escrita ou reforçada em lint.

## 3. Consistência — inconsistências reais encontradas (não corrigidas, achado de auditoria)

**Volume**: cor hex literal (`#xxxxxx`) aparece em ~35 arquivos de
`src/components/crm2` e `src/app/(crm2)`. A maior parte é **paleta
categórica legítima** (cores de status/tag/gráfico sem token semântico
correspondente — ex. azul/roxo/rosa pra distinguir categorias, não pra
significar sucesso/erro). Os casos abaixo são os que colidem com um token
`--cf2-*` que já existe e deveria ter sido usado:

1. **Vermelho de perigo com dois valores diferentes.** Token
   `--cf2-danger-text`/`--cf2-danger-border` = `#e53333`, mas o hex
   `#dc2626` (vermelho diferente) é usado como "perigo" em pelo menos:
   `src/components/crm2/clientes/ClienteFinanceiro.tsx:59,60,120,138,217`,
   `src/components/crm2/pipeline/Workspace.tsx:190,271,272`,
   `src/components/crm2/pipeline/NegocioDrawer.tsx:135`,
   `src/components/crm2/propostas/PropostaDrawer.tsx:125,127`,
   `src/components/crm2/prospeccao/ProspeccaoDrawer.tsx:216`,
   `src/components/crm2/qualificacao/LeadDrawerCf2.tsx:184`,
   `src/components/crm2/qualificacao/shared.ts:121,156`,
   `src/app/(crm2)/vendas/page.tsx:175,189,192`. Resultado visual: o
   "vermelho de erro" não é o mesmo pixel em todas as telas.

2. **Verde de sucesso com valores diferentes.** Token
   `--cf2-success-fill` = `#09ba2a`, mas aparecem `#22c55e`
   (`src/components/crm2/negocios/Workspace.tsx:255`,
   `src/components/crm2/pipeline/Workspace.tsx:189,268`,
   `src/components/crm2/pipeline/NegocioDrawer.tsx:210`,
   `src/components/crm2/qualificacao/Workspace.tsx:521`), `#4ade80`
   (`src/components/crm2/qualificacao/Workspace.tsx:646,741`,
   `src/components/crm2/PreVendasPulse.tsx:18`,
   `src/app/(crm2)/vendas/page.tsx:134`) e `#059669`
   (`src/components/crm2/clientes/Cliente360.tsx:137`,
   `src/components/crm2/clientes/ClienteFinanceiro.tsx:55,122,197`,
   `src/components/crm2/qualificacao/shared.ts:60,64`,
   `src/components/crm2/leads/PaginaCompleta.tsx:238`) — três verdes
   diferentes para o mesmo conceito de "positivo".

3. **`--cf2-danger-bg` não existe como token**, mas o mesmo hex
   `#fde8e8` foi hardcoded de forma idêntica em dois lugares
   (`src/components/crm2/ui/Badge.tsx:8` e
   `src/components/crm2/qualificacao/shared.ts:81`) — evidência de que
   deveria ser token, só não foi promovido.

4. **Duplicata literal de um token que já existe.** Em
   `src/components/crm2/qualificacao/Workspace.tsx:244,251,256,261`, a cor
   do dropdown (`[&>option]:bg-[#1c1f26]`) repete o valor exato de
   `--cf2-chrome-bg` (`#1c1f26`, definido em `globals.css:151`) em vez de
   referenciar a variável.

5. **Paleta categórica duplicada 4× com grafia inconsistente.** O mesmo
   conjunto de cores de status/categoria (azul `#3B82F6`/`#3b82f6`, amarelo
   `#EAB308`, roxo `#8e27ef`, verde `#22C55E`/`#22c55e`, ciano `#0EA5E9`)
   está reimplementado separadamente em `src/components/crm2/pipeline/shared.ts:42-45,75`,
   `src/components/crm2/propostas/shared.ts:28`,
   `src/components/crm2/prospeccao/shared.ts:39-44`,
   `src/components/crm2/qualificacao/shared.ts:107-121` — mesma paleta,
   4 fontes de verdade, casing de hex inconsistente entre elas (maiúsculo
   vs minúsculo, o que não afeta renderização mas indica cópia-e-cola em
   vez de import compartilhado).

6. **`Cf2ErrorState` (em `src/components/crm2/ui/States.tsx:24-31`) renderiza
   com os tokens de warning (`--cf2-warning-bg`/`--cf2-warning-text`, âmbar),
   não com os de danger.** Pode ser intencional (erro de carregamento é menos
   grave que uma ação destrutiva), mas não há nota no código confirmando a
   escolha — vale confirmar com quem definiu.

7. **Tokens de raio (`--cf2-radius-sm/md/lg/xl/full`) nunca são
   referenciados em nenhum componente** (`grep` por `cf2-radius` fora do
   `globals.css` retorna zero ocorrências). Todo componente usa as classes
   Tailwind (`rounded-lg`/`rounded-xl`/`rounded-2xl`/`rounded-full`
   diretamente — 297/175/149/162 ocorrências respectivamente), que
   aproximam mas não usam formalmente os tokens declarados. Tokens mortos.

8. **`--cf2-text-on-inverse` também nunca é referenciado** fora da própria
   declaração — outro token morto.

> Nenhum destes é uma correção sugerida pra ESTA sessão — ficam registrados
> como dívida real pra quem for tocar essas telas depois (evitar mexer em
> `Cliente360.tsx`, `Workspace.tsx` de qualquer módulo, `shared.ts` de
> pipeline/propostas/prospecção/qualificação e `qualificacao/Workspace.tsx`
> agora corre risco de colidir com os 2 outros agentes ativos em paralelo:
> redesign de Pré-vendas e tela de Início).

## 4. Espaçamento

**Não existe um token de espaçamento cf2 (`--cf2-space-*`)** — não foi
inventado nenhum aqui. O que existe de fato é uso disciplinado da escala
padrão do Tailwind (múltiplos de 4px): amostra real de contagem em
`src/components/crm2` + `src/app/(crm2)`:

```
gap-2 (374×, 8px) · gap-1 (300×, 4px) · px-3 (244×, 12px) · py-2 (206×, 8px)
gap-3 (206×, 12px) · py-1 (197×, 4px) · px-2 (130×, 8px) · p-3 (90×, 12px)
px-4 (80×, 16px) · p-5 (78×, 20px) · p-4 (76×, 16px) · p-2 (72×, 8px)
gap-4 (71×, 16px) · py-3 (59×, 12px)
```

Escapes arbitrários (`gap-[Npx]`, `p-[Npx]`) existem mas são raros (menos de
10 ocorrências no total). Conclusão real: espaçamento é consistente na
prática porque todo mundo usa a escala default do Tailwind, não porque
existe uma camada de token dedicada do CRM 2.0.

## 5. Componentes reutilizáveis reais (a base do design system hoje)

### `src/components/crm2/ui/`

- **`Card.tsx`** — 3 exports:
  - `Cf2Card({ children, className, padding="20px", highlight, style })`:
    container padrão (`var(--cf2-bg-surface)`, borda `var(--cf2-border-default)`,
    sombra `var(--cf2-shadow-card-sm)`, `rounded-2xl`). `highlight="success"|"danger"`
    troca a cor da borda pra `--cf2-accent-border`/`--cf2-danger-border` e
    engrossa pra 1.5px — é o único jeito "certo" de dar destaque colorido a
    um card.
  - `Cf2SectionHeader({ title, subtitle })`: título (`--cf2-font-heading`,
    `--cf2-text-primary`) + subtítulo opcional (`--cf2-text-secondary`,
    13px).
  - `Cf2Eyebrow({ children })`: rótulo pequeno maiúsculo (11px, bold,
    tracking largo, `--cf2-font-heading` + `--cf2-text-secondary`).
- **`Badge.tsx`** — `Cf2Badge({ children, variant })`, `variant` ∈
  `success|warning|danger|neutral|accent`. Mapeia pra bg/text tokens
  correspondentes (exceto `danger`, que usa o hex hardcoded `#fde8e8`
  descrito no achado 3 acima porque não existe `--cf2-danger-bg`).
- **`Gauge.tsx`** — `Cf2Gauge({ pct, size=80, label })`: gauge circular via
  SVG/`stroke-dasharray`. Trilho de fundo é `rgba(255,255,255,0.12)`
  hardcoded (não token — assume fundo escuro sempre), progresso é
  `--cf2-accent-border`, label usa `--cf2-chrome-text-primary` — ou seja,
  **este componente pressupõe que só é usado sobre chrome escuro**; não é
  seguro colocá-lo sobre `--cf2-bg-surface` claro sem revisar as cores.
- **`States.tsx`** — 4 exports de estado vazio/erro/indisponível/negado:
  `Cf2Skeleton`, `Cf2EmptyState({title, description})`,
  `Cf2ErrorState({message})` (ver achado 6), `Cf2UnavailableMetric({reason})`
  (princípio: nunca mostrar métrica sem fonte confiável),
  `Cf2PermissionDenied({message})`.

### `src/components/crm2/shared/`

- **`AssignOwnerControl.tsx`** — `AssignOwnerControl({ entityType, entityId,
  currentOwnerId, usuarios, onChanged, disabled })`. Único componente de UI
  que dispara troca de responsável (PATCH pro endpoint certo por
  `entityType`: `lead|negocio|fulfillment|cliente|fulfillment_item`);
  auditoria fica no backend (`lib/crm/owner.ts`). Reusar sempre que precisar
  trocar responsável — não recriar dropdown próprio por tela.
- **`avatar.ts`** — `iniciaisEmpresa(nome)` (2 primeiras palavras, 1ª letra
  maiúscula de cada) + `corAvatarEmpresa(seed)` (cor determinística por hash
  do id, usando a paleta `--cf2-avatar-1..5`). Usar sempre que precisar de
  avatar de iniciais estável entre reloads (ex.: listagens paginadas).

## 6. Conclusão do gap (item 6 do pedido)

Antes desta auditoria **não existia nenhum arquivo central de referência**
do design system — as variáveis viviam soltas em `globals.css` sem
documentação, e cada `shared.ts` de módulo reimplementava sua própria
paleta categórica sem saber que outros 3 módulos já tinham o mesmo mapa.
Este arquivo (`docs/reconstruction/CRM2-DESIGN-SYSTEM.md`) é a primeira
referência central; ele documenta o que existe, não fecha o gap de
inconsistência listado no §3 — isso continua sendo dívida real,
intencionalmente não corrigida nesta sessão pra não colidir com os 2 outros
agentes ativos em paralelo no repo.
