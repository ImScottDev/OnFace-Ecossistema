# Product Finalization — ONFACE / Callface CRM2

> Fase independente de `docs/reconstruction/PRODUCTION-READINESS-TRACKER.md`.
> Objetivo: transformar o CRM2 em um produto ONFACE operacional, consistente e pronto para
> produção, preservando domínio, integrações, dados reais, jornadas certificadas e correções P0.

## Contrato desta fase

- Não é uma rodada de polish. IA, composição, navegação, superfícies, componentes e responsividade
  podem mudar quando necessário.
- Nenhuma tela recebe **FINAL** sem dados e ações reais, estados assíncronos/erro/vazio/permissão,
  validação desktop e mobile, acessibilidade básica e testes relevantes verdes.
- Uma tela será redesenhada por vez, após o pre-flight e a validação de produto quando houver uma
  decisão não inferível.
- Sem mock de dado operacional. Referência visual informa forma e hierarquia; nunca substitui a
  regra de domínio.

## Checkpoint e reancoragem — 2026-09-15

| Item | Evidência |
|---|---|
| Branch | `dev` |
| Base de código | `a155b496be55090a1989781b9d042a186ff12060` |
| Tag de checkpoint | `product-finalization-baseline-20260915` → `a155b49` |
| Ponto pré-Production Readiness | `backup-pre-readiness` → `29465ce` |
| Worktree antes desta fase | 411 entradas em `git status`; preservado, sem reset/stash/commit global |
| Fingerprint do diff versionado | `b49ffeebd7f91d620f87a22f8b756ee906347cb3f47d7222e5a794b0c6dbc5bb` |
| Fingerprint dos não rastreados | `fd5817045d8d89a8a5cabde9f41522b6bf0de1d878845550d5a0d201de83f329` |

O checkpoint aponta deliberadamente para o último commit (`a155b49`), não para um commit novo que
capturaria alterações de outras frentes. Os dois fingerprints permitem detectar alteração do
worktree até que ele seja consolidado de forma segura.

### Correções P0 preservadas

O tracker de Production Readiness continua a fonte de verdade técnica. A rodada corrigiu:

- healthcheck do worker, migrations com hash/baseline e gates RBAC;
- webhooks fail-closed, uploads protegidos e roteamento Traefik/Next;
- Won → cliente → serviço → fulfillment → CS, por caminho manual e automático;
- jornadas de contrato PABX e White Label, MRR de fonte única e dead-letter;
- URLs consumidas, Ajustes e redirects legados quebrados.

Nenhuma dessas áreas será redesenhada removendo contrato de API, estado de domínio, validação ou
teste. Componentes e rotas poderão mudar de forma, não de comportamento certificado.

## Bateria de revalidação

Executada em DEV local em 2026-09-15:

| Verificação | Resultado | Estado |
|---|---:|---|
| `npx tsc --noEmit` | sem erros | ✅ |
| `npm test` | 51 passou / 0 falhou | ✅ |
| `npm run check:env` | 65 variáveis lidas documentadas | ✅ |
| `npm run db:migrar:check` | nenhuma migration pendente | ✅ |
| `npm run check:relatorios` | todas as invariantes OK | ✅ |
| `npm run aceite:won-cs` | 31 passou / 0 falhou | ✅ |
| `npm run aceite:contrato` | 32 passou / 0 falhou | ✅ |
| `simular-fechamento-2c1` | interrompeu no caminho direto de assinatura Documenso | ⚠️ |

### Divergência de certificação a corrigir antes do selo final

`src/scripts/simular-fechamento-2c1.ts` ainda chama `assinarContratoPublico()` para PABX/White
Label. A P0 certificou corretamente o fluxo atual por `DOCUMENT_COMPLETED` no webhook real do
Documenso, cuja confirmação direta é recusada pelo provider. Assim, os aceites modernos passam,
mas a bateria histórica não está literalmente toda verde. O cenário `ZZTESTE2C1` foi limpo após a
execução interrompida.

| ID | Categoria | Impacto | Encaminhamento | Estado |
|---|---|---|---|---|
| FIN-CERT-01 | Certificação | impede declarar bateria integralmente verde | atualizar o harness 2C.1 para entregar o webhook, mantendo suas 19 asserções e a limpeza | P1 pendente |
| FIN-ENV-01 | Ambiente | oito chaves documentadas sem leitura (`APP_PORT`, `HONO_API_PORT` etc.) | decidir/remover em tarefa de higiene; não bloqueia produto | P3 pendente |

## Auditoria da camada visual atual

| Camada | Estado observado | Decisão |
|---|---|---|
| shadcn | `components.json` usa CSS variables, `new-york`, base neutral e Lucide; 39 primitivas já existem | manter como base acessível e composável |
| Theme bridge | `globals.css` já mapeia tokens shadcn em `@theme inline` e reatribui dentro de `[data-cf2-theme]` | substituir por uma ponte ONFACE única; preservar o contrato de portal/focus até a migração |
| CRM2 DS | `cf2-design-system.css` + `components/crm2/ds` têm escala, reduced motion, tabela/timeline/sidebar e checks | reter os comportamentos úteis; retirar a linguagem visual seaweed e reduzir os adaptadores gradualmente |
| Shell | sidebar dark chrome, workspace claro e topbar contextual; há suporte a sheet mobile, colapso e teclado | preservar IA/navegação e responsividade; redesenhar a apresentação como AppShell ONFACE de topbar + navegação responsiva |
| Aderência | 171 tokens `--cf2-*`, mas 681 cores literais e 3.596 utilitários arbitrários em CRM2 | migrar módulo a módulo; não fazer busca/substituição global |
| Checagem atual | `ds:check` detecta dívida herdada, mas exclui o próprio `crm2/ds` | evoluir o checker para a taxonomia ONFACE e bloquear somente superfícies finalizadas |

## Referência ONFACE inspecionada

Arquivo de referência: `ONFACE Design System.zip` (295 arquivos; integridade do ZIP validada).

### Fundamentos a adotar

- **Cor e superfície:** graphite/paper como base, coral `#FE4F2B` como sinal escasso; hairline em
  vez de card-shadow; uma ação primária dominante por contexto.
- **Tipografia:** Plus Jakarta Sans para display/título/KPI, Inter para operação densa; Lucide
  16px/2px como iconografia.
- **Densidade:** controles 24/28/32/36px, campos 40px, lista/tabela compacta, grade fluida e
  touch target mínimo de 44px em tablet/mobile.
- **Forma e motion:** escala de 4px, radius por papel, transições 120–160ms, foco explícito e
  `prefers-reduced-motion`; sem glass, gradiente decorativo ou sombra de card.
- **Shell:** barra graphite fixa e canvas paper com raio contextual; tablet reduz navegação e
  celular a move para sheet. Esse é o contrato visual a adaptar à IA real do CRM2.
- **Assets:** usar os logos e símbolos oficiais; não recriar marca em CSS.

### Conflitos resolvidos por estratégia

| Conflito | Decisão |
|---|---|
| seaweed + sidebar atual vs. coral + topbar ONFACE | ONFACE prevalece para o novo shell; a sidebar atual permanece só como infraestrutura de transição até a migração do AppShell |
| fontes CF2 vs. Plus Jakarta/Inter | ONFACE prevalece; fontes serão instaladas/registradas uma vez na fundação |
| `mira`/olive/lime/IBM Plex/Space Grotesk/Phosphor do preset informado vs. ONFACE | não aplicar integralmente; ONFACE mantém coral, Plus Jakarta/Inter e Lucide |
| ONI no ZIP vs. NEXO no direcionamento de produto desta fase | NEXO prevalece por instrução de produto; nenhuma persona será espalhada como ornamento |
| JSX do ZIP com dados ilustrativos e estilos inline | referência visual e de tokens somente; não importar/copiar como código de produto |
| dark mode genérico CF2 vs. dark chrome ONFACE | separar modo de tema de chrome estrutural; o shell escuro não deve contaminar semântica de conteúdo |

## Estratégia segura para o preset shadcn

O preset `b6TqMNb5Wb` foi decodificado antes de qualquer escrita: `mira`, `olive/lime`,
`emerald` para charts, `phosphor`, `IBM Plex Sans`, `Space Grotesk`, menu invertido. O próprio
CLI avisa que uma aplicação completa sobrescreve componentes, fontes e CSS variables.

1. Não rodar `apply` completo sobre este worktree sujo.
2. Criar primeiro a camada ONFACE e manter `cssVariables: true` em `components.json`.
3. Usar o preset apenas como matriz de compatibilidade para `theme` e `font`; não adotar seus
   valores de marca, fonte, ícones ou base de cor.
4. Quando a fundação for aprovada, aplicar no máximo uma alteração isolada de theme/font em uma
   cópia/branch limpa, revisar todo diff e reconciliar conscientemente em vez de reinstalar os
   39 componentes existentes.
5. Cada novo primitive continuará vindo de shadcn compatível com a ponte ONFACE; nenhum kit
   concorrente será introduzido.

## Arquitetura visual alvo

```
shadcn/Radix primitives
        ↓
ONFACE primitives (raw colors, spacing, type, radii, motion, breakpoints)
        ↓
ONFACE semantic tokens + shadcn bridge
        ↓
ONFACE component patterns
        ↓
CRM2 screens / feature workspaces
```

### Organização proposta

| Nível | Responsabilidade | Destino proposto |
|---|---|---|
| Primitive | valores sem papel: ramps coral/graphite/slate, espaço, type, radius, motion, breakpoints | `src/styles/onface/tokens/primitives.css` |
| Semantic | `background`, `foreground`, `card`, `muted`, `primary`, `border`, status, chart, shell | `src/styles/onface/tokens/semantic.css` |
| shadcn bridge | expõe os semânticos em `@theme inline` para `bg-primary`, `border-border`, `ring-ring` etc. | `src/app/globals.css` mínimo |
| Component | medidas/estados de botão, field, badge, data table, topbar, sheet e dialog | `src/styles/onface/tokens/components.css` quando a variação for realmente recorrente |
| Patterns | `AppShell`, `PageHeader`, `SectionHeader`, `Metric`, `StatusBadge`, `FilterBar`, `EntityRow`, `DataTable`, `DetailPanel`, `Timeline`, estados | `src/components/onface/` |
| Compatibilidade | exports/adaptadores CF2 durante a migração; sem criar duplicatas novas | `src/components/crm2/ds/` temporariamente |

### Famílias reutilizáveis prioritárias

`AppShell`, `PageHeader`, `SectionHeader`, `Metric`, `StatusBadge`, `FilterBar`, `EntityRow`,
`DataTable`, `EmptyState`, `ErrorState`, `LoadingState`, `ActionMenu`, `DetailPanel`, `Timeline`,
`ActivityFeed`, `CommandBar` e `Workspace` serão avaliados como composição de primitives já
existentes. Nenhum `MetricCard2`/variante local será criado.

## Mapa de finalização por módulo

| Ordem | Módulo / rota-base | Por quê | Dependências | Desktop | Mobile | Estado |
|---:|---|---|---|---|---|---|
| 0 | Fundação ONFACE + AppShell | tokens, fontes, topbar, navegação, overlays e estados comuns antes de tela | validação do preview de navegação | ✅ | ⏳ | preview pronto em `/onface-preview`; aguardando validação de produto |
| 1 | Início `/inicio` | referência ONFACE explícita; fixa densidade, hero, métricas e painéis de decisão | fundação | ⏳ | ⏳ | aguardando referência/pre-flight |
| 2 | Vendas `/pre-vendas`, `/prospeccao`, `/pipeline`, `/propostas`, `/negocios` | jornada aquisição → proposta e maior dependência operacional | entidades e drawers reais existentes | ⏳ | ⏳ | aguardando tela a tela |
| 3 | Atendimento `/atendimento`, calendário `/calendario` | workspaces de alta frequência com split view e ações de canal | shell, drawers e command patterns | ⏳ | ⏳ | aguardando tela a tela |
| 4 | Clientes / implantação `/clientes`, `/clientes/implantacao`, `/clientes/onboarding`, `/clientes/cs` | continuidade certificada Won → fulfillment → CS | jornadas P0 preservadas | ⏳ | ⏳ | aguardando tela a tela |
| 5 | Financeiro e insights `/clientes/financeiro`, `/relatorios` | semântica e permissão são críticas; não fabricar KPI | MRR canônico/RBAC P0 | ⏳ | ⏳ | aguardando tela a tela |
| 6 | Automações e ajustes | superfícies especializadas, menos centrais na jornada | patterns consolidados | ⏳ | ⏳ | aguardando tela a tela |
| 7 | Certificação final | rotas, permissões, links, responsividade, console/network, E2E e deploy | todos os módulos | ⏳ | ⏳ | bloqueado até 0–6 |

## Critério por tela

| Eixo | Critério de aceite |
|---|---|
| UX/UI | objetivo de trabalho claro, uma ação dominante, hierarquia e dados reais |
| Responsividade | validada em 390, 768, 1280, 1440/1512 e 1920 quando aplicável; sem overflow involuntário |
| Estados | loading, empty, empty filtrado, erro, permissão, processando, sucesso, disabled e confirmação destrutiva quando aplicável |
| Integração | endpoints, filtros, busca, paginação, drawers/dialogs, deep links e mutations reais |
| Qualidade | teclado, foco, labels/aria, contraste, requests sem 404, console limpo e testes relevantes |
| Registro | rota, componentes, endpoints, regressões e resultado dos breakpoints atualizados aqui |

## Log

### 2026-09-15 — abertura da fase final

- Reancorada a rodada Production Readiness, sem reverter correções P0.
- Inspecionados o design system atual, componentes shadcn/CF2, o ZIP ONFACE e o preset shadcn
  informado.
- Criado checkpoint local e definida a arquitetura ONFACE única, sem iniciar redesign de tela.
- Bateria base e dois aceites de jornada verdes; identificada divergência do harness 2C.1 que
  precisa migrar para o webhook do Documenso antes da certificação final.

### 2026-09-15 — preview isolado do AppShell ONFACE

- Criada a fundação incremental em `src/app/onface.css`: primitives, semântica e contratos de
  componente. A ponte para shadcn fica escopada em `data-onface-theme`, preservando os temas e
  correções das rotas legadas/CF2 durante a transição.
- Registrada Plus Jakarta Sans uma única vez no root; Inter continua como fonte de interface.
- Criado `src/components/onface/OnfaceTopbar.tsx` e um mapa canônico de navegação. Os oito grupos
  apontam apenas para rotas CRM2 existentes; Vendas mantém seu conjunto de rotas operacionais.
- Criado preview autenticado em `/onface-preview`, fora do layout CRM2 atual. Desktop usa menus
  Radix acessíveis; mobile usa Sheet com alvos de 44px. Busca aciona a Command Palette existente
  e “Novo negócio” aponta para a mutation/jornada real já existente.
- Não houve troca do layout oficial, remoção da sidebar ou alteração de API/dados. A validação do
  usuário decidirá a promoção do mesmo componente ao layout CRM2.
- Verificações: `npx tsc --noEmit` e `npm run build` passaram; detector Impeccable no novo escopo
  retornou zero achados. Validação visual no navegador local ficou limitada pelo ciclo de servidor
  local do ambiente automatizado; a compilação confirmou o CSS e a rota no build.

### 2026-09-15 — correção estrutural da topbar no preview

- A referência Figma `316:35076` passou a ser o contrato do preview: topbar graphite de 64px,
  marca à esquerda, navegação central única de 669px e ações contextualizadas à direita. As seis
  áreas continuam a apontar somente para rotas reais do CRM.
- Corrigido o encaixe visual: cada item da navegação tem largura controlada dentro de uma única
  superfície, sem o espaço residual que deixava borda e botões parecerem elementos desconexos.
- Menus de macroárea, perfil e ajustes usam os primitives Radix/shadcn já existentes, com superfície
  graphite, foco/hover consistente, submenu de administração e ação real de sair.
- A busca global não duplicou lógica: `Providers` ganhou a variante `onface`, reutilizando a mesma
  Command Palette e endpoints existentes com tema ONFACE. Isso eliminou o bug de duas paletas
  abertas simultaneamente no preview.
- Mobile/tablet: navegação vira Sheet graphite; busca e avatar permanecem acessíveis; os itens têm
  alvo mínimo de 44px e filhos hierárquicos. Validados visualmente em 390px, 768px e desktop amplo.
- Verificações desta iteração: `npx tsc --noEmit --incremental false` verde, `git diff --check`
  verde, console do navegador sem warnings/errors e detector Impeccable sem achados no escopo
  alterado. A topbar continua isolada em `/onface-preview`; não houve troca do layout CRM2 oficial.
