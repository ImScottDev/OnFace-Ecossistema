# Biblioteca ONFACE, inventário do registry shadcn

Gerado de `npx shadcn@latest search @shadcn -l 400` em 2026-09-22. Reler antes de desenhar tela nova:
o defeito recorrente é escrever à mão peça que a biblioteca já tem.

## Instalados neste repo (`src/components/ui`)
accordion alert aspect-ratio avatar badge breadcrumb button-group button calendar card chart checkbox collapsible command dialog drawer dropdown-menu empty field hover-card input-group input item kbd label pagination popover progress radio-group scroll-area select separator sheet sidebar skeleton sonner spinner switch table tabs textarea toggle-group toggle tooltip 

## Componentes do registry AINDA NÃO instalados
alert-dialog attachment bubble carousel combobox context-menu direction form input-otp marker menubar message message-scroller native-select navigation-menu resizable slider

## Blocos (97)

**Estrutura (27):** dashboard-01 sidebar-01 sidebar-02 sidebar-03 sidebar-04 sidebar-05 sidebar-06 sidebar-07 sidebar-08 sidebar-09 sidebar-10 sidebar-11 sidebar-12 sidebar-13 sidebar-14 sidebar-15 sidebar-16 login-01 login-02 login-03 login-04 login-05 signup-01 signup-02 signup-03 signup-04 signup-05

**Gráficos (70):** chart-area-axes chart-area-default chart-area-gradient chart-area-icons chart-area-interactive chart-area-legend chart-area-linear chart-area-stacked-expand chart-area-stacked chart-area-step chart-bar-active chart-bar-default chart-bar-horizontal chart-bar-interactive chart-bar-label-custom chart-bar-label chart-bar-mixed chart-bar-multiple chart-bar-negative chart-bar-stacked chart-line-default chart-line-dots-colors chart-line-dots-custom chart-line-dots chart-line-interactive chart-line-label-custom chart-line-label chart-line-linear chart-line-multiple chart-line-step chart-pie-donut-active chart-pie-donut-text chart-pie-donut chart-pie-interactive chart-pie-label-custom chart-pie-label-list chart-pie-label chart-pie-legend chart-pie-separator-none chart-pie-simple chart-pie-stacked chart-radar-default chart-radar-dots chart-radar-grid-circle-fill chart-radar-grid-circle-no-lines chart-radar-grid-circle chart-radar-grid-custom chart-radar-grid-fill chart-radar-grid-none chart-radar-icons chart-radar-label-custom chart-radar-legend chart-radar-lines-only chart-radar-multiple chart-radar-radius chart-radial-grid chart-radial-label chart-radial-shape chart-radial-simple chart-radial-stacked chart-radial-text chart-tooltip-default chart-tooltip-indicator-line chart-tooltip-indicator-none chart-tooltip-label-none chart-tooltip-label-custom chart-tooltip-label-formatter chart-tooltip-formatter chart-tooltip-icons chart-tooltip-advanced

## Por que NÃO instalar tudo

Medido, não suposto:

- **Bloco de gráfico não é componente.** `chart-area-default` escreve UM arquivo de
  demo, e as dependências reais dele (`card`, `chart`) já estão instaladas. Os 70
  blocos de gráfico somam zero capacidade nova: são exemplos de como usar o
  `ChartContainer` que já temos. Servem para LER com `npx shadcn view`, não para
  instalar.
- **Bloco de estrutura é página, não peça.** `dashboard-01` escreve 7 arquivos, 2
  deles com destino fixo: `app/dashboard/page.tsx` e `app/dashboard/data.json`.
  Instalar os 27 criaria 27 rotas no app e dezenas de componentes soltos em
  `components/`, colidindo com os nossos.
- **Componente vale instalar, mas nem todo sai de graça.** Quatro pedem pacote npm
  que este projeto não tem, e ficaram FORA até haver uso real:

  | Componente | Custo | Quando instalar |
  |---|---|---|
  | `combobox` | `@base-ui/react` | nunca sem decidir antes: é a SEGUNDA camada de primitivo, e o projeto é Radix |
  | `carousel` | `embla-carousel-react` | se alguma tela precisar de carrossel |
  | `input-otp` | `input-otp` | quando houver 2FA |
  | `resizable` | `react-resizable-panels` | quando um painel precisar de divisor arrastável |

## Como instalar sem quebrar

`npx shadcn add` com `--overwrite` destrói primitivo customizado (já aconteceu com `button.tsx`);
sem a flag ele trava perguntando. O caminho é `npx shadcn view <item>`, ler o JSON e escrever
só os arquivos que não existem, trocando `from "cn"` por `@/lib/utils/cn` e
`@/registry/*/ui/` por `@/components/ui/`.
