# Callface CRM2 Redesign Tracker

> Revisão ponta a ponta iniciada em 2026-09-10. Cada superfície só passa para
> concluída após revisão de hierarquia, responsividade, estados e validação.

| Superfície | Status | Critique | Redesign | Responsive | Harden | Audit | Polish | Browser | Pendências |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| App shell: sidebar, topbar, navegação, overlays | Concluído | Feito | Feito | Feito | Feito | Sem crítico | Feito | Desktop, 1024 e 390px | Auditoria automatizada live não autenticou; detector limpo e console sem erros |
| Início | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | |
| Vendas e pipeline | Em andamento | Feito | Em andamento | Pendente | Pendente | Pendente | Pendente | Pendente | Remover malha decorativa do workspace e revisar board |
| Pré-vendas e prospecção | Em andamento | Feito | Em andamento | Pendente | Pendente | Pendente | Pendente | Pendente | Remover malha decorativa do workspace e revisar board |
| Clientes e Cliente 360 | Em andamento | Feito | Em andamento | Pendente | Pendente | Pendente | Pendente | Desktop | Carteira está sendo reconstruída como worklist; Cliente 360 vem em seguida |
| CS, onboarding e implantação | Em andamento | Feito | Feito (tela dedicada de CS) | Onboarding feito; PABX desktop/390px; White Label desktop; CS desktop/390px | Pendente | Pendente | Pendente | Onboarding desktop/390px; PABX desktop/390px; White Label desktop; CS desktop/390px | Bug real corrigido: todo clique de dentro do CS caía em Cliente 360 (que nunca leu `?aba=` da URL). Pendente White Label mobile |
| Atendimento | Em andamento | Feito | Não se aplicou — ver nota | Feito (2 bugs reais corrigidos) | Pendente | Pendente | Pendente | Desktop 1512/1024, 390px | Header do WhatsApp thread quebrava em 390px; painel de contexto era inacessível abaixo de xl (1280px) — ambos corrigidos. Resto da superfície (ConversationList, EmailThread, CallDetail, Dialer) só recebeu leitura crítica, não intervenção |
| Financeiro (7 abas) | Concluído | Feito | Feito | Feito | Feito | Contraste medido no DOM: 0 falha em 683 nós | Feito | Desktop 1512 e 390px, console limpo | AccessLint não autorizado na sessão — auditoria automatizada segue sem rodar |
| Propostas | Concluído | Feito | Feito | Feito | Parcial | Contraste herdado dos tokens do sistema, não medido em pixel | Feito | Desktop 1512 e 390px, console 0 erro | Drawer/lista/gráficos redesenhados; `PropostaDetalhe.tsx` (`/propostas/[id]`) e o formulário completo de `NovaProposta.tsx` (além da tela de origem) não passaram por revisão de UX própria nesta sessão |
| Automações e agentes | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | |
| Calendário, contatos e empresas | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente | |
| Ajustes, integrações e administração | Em andamento | Parcial (2 de 20 rotas) | Não se aplicou — ver nota | Pendente | Pendente | Pendente | Pendente | Desktop 1512px | Índice (`/ajustes`) e `/ajustes/membros` lidos e criticados; as outras 18 rotas do inventário seguem sem leitura |

## Decisões de linguagem

- **North star:** Revenue Control Room. Superfícies claras e densas para trabalho; chrome escuro como contexto e orientação.
- **Contraste:** seaweed profundo para ação e foco; lime só para confirmação e momentos de leitura excepcional.
- **Composição:** worklists, rails e divisores substituem grades de cards equivalentes. A área com maior consequência conduz o olhar.
- **Motion:** transições de contexto e feedback de ação, sempre com `prefers-reduced-motion` respeitado.

## Log

### 2026-09-10 — App shell concluído

- Removido o grid decorativo do workspace. A superfície contínua reduz competição visual com dados reais.
- Padronizados controls da topbar, sino e painel de notificações nos raios e sombras do sistema; estados ativos, foco, item lido e mutação pendente preservados.
- Sidebar ganhou assinatura Callface explícita, ícone pertinente ao domínio e `aria-current` na rota atual.
- Scrollbar virou sinal discreto de conteúdo longo; motion de entrada foi mantido sutil e compatível com redução de movimento.
- Validação local em `/inicio`: desktop, 1024px e 390px. Console sem erros; `impeccable detect` sem achados para os arquivos tocados.

### 2026-09-10 — Direção de produto elevada

- O CRM vigente deve ser tratado como MVP funcional, não como layout-base. A partir desta revisão, mudanças de composição precisam ser substanciais e cada superfície deve responder se a diferença visual e operacional é suficiente para ser chamada de redesign.
- Cliente/Carteira é o primeiro módulo sob esse critério: a tabela cercada de filtros será substituída por uma worklist de carteira com triagem, foco e contexto de ação.

### 2026-09-10 — Onboarding: pulso operacional e fila responsiva

- Os cinco KPIs equivalentes foram trocados por uma faixa de pulso escura, com total de clientes em onboarding como leitura dominante e estágios secundários em rail.
- A fila e agenda continuam com os mesmos dados e rotas. Em 390px, a composição passou a uma coluna para impedir que a agenda comprima os clientes; busca e filtro de responsável agora cabem na viewport.
- Validação em desktop e 390px, tsc, detector Impeccable e git diff --check concluídos.

### 2026-09-10 — Implantação PABX: pulso e kanban

- Os seis KPIs que competiam com as fases viraram barra de controle escura; implantações ativas conduz a leitura e estados secundários ficam em rail.
- Kanban preservado como o espaço principal de execução. Dados mostram 185 entregas em Planejamento e demais colunas vazias, portanto nenhum sinal ou prioridade foi fabricado.
- Validação desktop, tsc, detector Impeccable e git diff --check concluídos.

### 2026-09-10 — White Label: worklist orientada por entrega

- O topo de White Label saiu de quatro KPIs em cards iguais para uma faixa escura de sinais. A worklist segue clara e densa para leitura de empresa, progresso, responsável e status.
- Validação desktop e console limpo; tsc herdado da alteração compartilhada passou.

### 2026-09-10 — Financeiro: pulso, painéis e worklist de cobrança (Claude, pós-handoff)

Sete abas sob a mesma rota `/clientes/financeiro`. A composição herdada do MVP
era card branco com número grande, quatro cards brancos equivalentes e uma
sequência de rótulos soltos com caixas brancas — toda grandeza de dinheiro com o
mesmo peso, nada conduzindo o olho.

- `pecas.tsx` virou o ponto de alavanca: `FinHero` passou a ser `FinPulso`, faixa
  escura assimétrica com um dominante e satélites em rail dividido por fio. Como
  `FinHero` segue exportado com a mesma assinatura e os `FinStat` filhos se
  redesenham por contexto (`NoPulso`), as seis abas que já o chamavam subiram sem
  mudança de call site.
- A faixa declara `data-cf2-superficie="escura"`, escopo que já existia no
  `globals.css`. Sem ele, `--cf2-accent` (seaweed-700) e `--cf2-danger-text`
  chegariam com os valores calibrados pra fundo branco: ~2,8:1 sobre `#111827`.
- `FinPainel` substituiu o par `FinSecao` + `FinCaixa`, em que o rótulo flutuava
  fora da caixa e a relação entre os dois era só proximidade.
- **Visão geral:** MRR dominante; a divergência entre a base de contratos e a
  carteira canônica saiu de quarta linha de parágrafo de apoio para alerta
  próprio (hoje R$ 6.365,96 — é o dado que muda a decisão de quem lê). Duas
  colunas de peso diferente: movimento do MRR conduz, economics e forecast em
  rail de lista comparável.
- **Cobrança:** a única superfície do módulo onde se TRABALHA, e a que menos
  parecia trabalho. Aging virou barra única segmentada (a proporção
  recuperável/crítico se lê de relance, antes exigia somar quatro barras de
  cabeça) e a fila deixou de ser tabela de 820px pra ser worklist — cliente,
  situação, valor e as duas ações sempre visíveis, sem scroll lateral em 390px.
- **PABX:** o frescor da planilha condiciona todo número da aba, então é ele o
  dominante, com o "Subir CSV" dentro da faixa e o resultado da carga no rodapé.
  A carteira embutida entra com `pulso={false}` pra não criar segundo dominante.
- **Faturas:** não tem rota de KPI. Em vez de inventar um total do mês, a régua
  diz o valor e o tamanho DO RECORTE aberto, com esse rótulo.

Achados corrigidos durante a validação no browser, não por leitura de código:

- Fios entre satélites saíam alternados. `[&>*:nth-child(odd)]:border-l-0` soma
  especificidade e vencia `md:[&>*]:border-l` independentemente da ordem no CSS.
  Passou a resolver por índice em JS, uma classe de borda por célula.
- `aria-controls` apontava pra id inexistente em 6 das 7 abas: só o painel ativo
  é montado. Agora só a aba selecionada referencia o painel.
- Não havia `role="tabpanel"`: `role="tab"` governava região nenhuma.
- Alvo do checkbox de acionamento tinha 16px, sendo o controle mais clicado da
  tela. 44px no toque, 36px no ponteiro — 44px em toda largura levava a linha de
  55 pra 69px, e a fila tem 100 delas.
- Painéis esquerdos esticavam até a altura da coluna direita, com ~100px e ~180px
  de área morta. `xl:self-start`.

Validação: `tsc` limpo; `ds:check` sem violação no módulo; detector Impeccable
sem achados; `git diff --check` limpo; console 0 erro / 0 aviso; contraste medido
no DOM real por composição de pixel (o `color-mix(… transparent)` do Chromium sai
como `color(srgb 1 1 1 / 0.56)` e engana leitura ingênua) — 0 falha em 683 nós de
texto, rótulos 6,22:1, apoio 7,35:1, valores 9,83–11,54:1. Teclado: seta no rail
sincroniza foco, URL, aba e painel.

Não feito: AccessLint (MCP não autorizado na sessão) e Propostas, que estava na
mesma linha do tracker e continua pendente.

### 2026-09-10 — Propostas: pulso real, distribuição corrigida, drawer e origem clara

A superfície inteira (`app/src/app/(crm2)/propostas/page.tsx` e
`components/crm2/propostas/{Workspace,PropostaCharts,PropostaDrawer}.tsx`) era
uma ilha "chrome" escura cobrindo a página inteira — o único módulo do CRM2
nessa situação, com header próprio em vez de `Cf2Topbar`, 4 KPIs dark
equivalentes e um doughnut ao lado de um gráfico de barras do mesmo peso.
Reconstruída sobre o mesmo contrato de Clientes/Financeiro: `Cf2Topbar` claro
no `page.tsx`, faixa de pulso escura (`Cf2Pulso`, promovido de
`financeiro/pecas.tsx` — ver abaixo) só como sinal dominante, resto em
superfície clara.

- **Dominante trocou de sentido.** Era "total de propostas" (1486 — estoque
  histórico cheio de rascunho/expirada, não aciona nada). Agora é "aguardando
  ação da Callface": valor + contagem de propostas enviadas sem resposta OU
  com ajuste pedido pelo cliente, com a espera da mais antiga em dias. Isso
  expôs um achado real de backend: `ajuste_solicitado` não entrava em NENHUM
  balde do KPI (`app/src/api-server/routes/propostas.ts`, rota
  `/propostas/kpis`) — só `enviada` era contado. Também dobrados os 5 status
  legados (`Em Construção`/`Proposta Ganha`/`Negotiation`, achado de 18/08 em
  `shared.ts`) nos baldes corretos, que antes ficavam fora dos 4 filtros e
  faziam a soma da distribuição divergir do total.
- **Distribuição por status** trocou o doughnut escuro por `Cf2BarraEmpilhada`
  (a mesma barra segmentada da fila de cobrança do Financeiro), incluindo
  agora "Ajuste solicitado" como fatia própria.
- **`Cf2Pulso`/`Cf2PulsoStat`/`Cf2Painel`/etc. promovidos** de
  `financeiro/pecas.tsx` pra `components/crm2/shared/Pulso.tsx` — módulo
  compartilhado de verdade em vez de Propostas importar de dentro do módulo
  Financeiro. `financeiro/pecas.tsx` virou um re-export fino com os nomes
  antigos (`FinPulso` etc.); nenhum call site das 7 abas do Financeiro mudou.
- **Drawer de preview** (`PropostaDrawer.tsx`) recolorido de chrome escuro pra
  claro — era o único drawer do CRM2 nessa situação (`ClienteDrawer` já usa
  `panelBg="var(--cf2-bg-surface)"`).
- **Worklist**: mesma composição flat estilo Circle, recolorida pra superfície
  clara, com ponto de cor por família (`FAMILY_COLOR`) e um chip
  "Parada há Xd" (`AlertTriangle`, tom warning) quando uma proposta
  enviada/ajuste está parada há 3+ dias — antes não havia nenhum sinal de
  urgência por linha, só a badge de status.
- **Achado real de mobile**: o nome do cliente na linha tinha `min-w-0` mas
  não `flex-1` — sem crescer, ficava espremido a ~8px de largura em 390px
  mesmo sobrando espaço. Corrigido, e o número `#PROP-XXXX` (92px fixos) saiu
  do mobile pra devolver esse espaço ao nome, que é o dado que identifica a
  linha.
- **Tela de origem de `Nova proposta`** (`NovaProposta.tsx`) tinha 4 cartões
  brancos empilhados numa coluna estreita, só texto. Virou grid 2x2 com ícone
  por caminho (`Briefcase`/`Building2`/`UserSearch`/`Contact`) e hover com o
  accent do produto.
- **Achado operacional que não é de UI**: o processo do api-server rodando
  nesta máquina tinha sido reiniciado nesta sessão via `npm exec tsx watch
  --env-file=.env ...` — `npm exec` descarta silenciosamente `--env-file`
  (só emite um warning de depreciação), então o processo subiu SEM
  `NEXTAUTH_SECRET`/`DATABASE_URL`, e todo endpoint autenticado (`/api/*`
  via Hono) voltava 401 mesmo com sessão válida no Next. Corrigido chamando
  o binário direto (`./node_modules/.bin/tsx watch --env-file=.env ...`).
  Vale registrar em `scripts/dev.sh` ou similar pra ninguém mais cair nisso.

Validação: `tsc` limpo, detector Impeccable sem achados, `git diff --check`
limpo, desktop 1512px e 390px, console 0 erro em toda a superfície (Workspace,
drawer, `/propostas/novo`). Contraste NÃO foi medido por composição de pixel
nesta rodada (herdado dos tokens do sistema, já calibrados em Financeiro) —
diferente de Financeiro, que teve medição real no DOM.

Não feito: `PropostaDetalhe.tsx` (`/propostas/[id]`, gestão completa — Aceitar,
Recusar, PDF) e o formulário multi-etapas de `NovaProposta.tsx` (itens,
catálogo, revisão) já eram claros e não passaram por crítica de UX própria —
só a tela de origem, que é o primeiro contato. AccessLint segue sem autorização
na sessão.

### 2026-09-10 — Inventário de rotas do CRM2 (fonte: Kauã)

Lista completa de rotas relevantes, recebida diretamente do Kauã como escopo
oficial de cobertura (substitui qualquer inventário anterior implícito neste
tracker). Usar esta lista pra saber o que falta, não a memória de sessões
anteriores:

**Núcleo**: `/inicio` `/pipeline` `/vendas` `/pre-vendas` `/tarefas`
`/relatorios` `/perfil` `/design` `/atendimento`

**Contatos, empresas e negócios**: `/contatos` `/contatos/[id]`
`/empresas/[id]` `/negocios/novo` `/negocios/[id]`

**Clientes (pós-venda)**: `/clientes` `/clientes/[id]` `/clientes/cs`
`/clientes/sucesso` `/clientes/financeiro` `/clientes/implantacao`
`/clientes/onboarding` `/clientes/onboarding/[fulfillmentId]`
`/clientes/entrega/[fulfillmentId]`

**Propostas**: `/propostas` `/propostas/novo` `/propostas/[id]`

**Prospecção**: `/prospeccao` `/prospeccao/apollo`

**Automações (inclui Callpilot)**: `/automacoes` `/automacoes/agentes`
`/automacoes/agentes/[id]` `/automacoes/agente-ia` `/automacoes/ai/[module]`
`/automacoes/cadencias` `/automacoes/campanhas` `/automacoes/campanhas/nova`
`/automacoes/execucoes`

**Calendário**: `/calendario` `/calendario/configuracoes`

**Ajustes**: `/ajustes` `/ajustes/geral` `/ajustes/membros`
`/ajustes/organizacoes` `/ajustes/organizacoes/[id]` `/ajustes/pipeline`
`/ajustes/campos-custom` `/ajustes/catalogo` `/ajustes/contratos`
`/ajustes/servicos` `/ajustes/email` `/ajustes/email/templates`
`/ajustes/whatsapp` `/ajustes/integracoes` `/ajustes/tracking`
`/ajustes/icp` `/ajustes/handover` `/ajustes/enriquecimento`
`/ajustes/ai-sdr` `/ajustes/leads` `/ajustes/notificacoes`
`/ajustes/qualidade-dados` `/ajustes/qualidade-dados/duplicidade`

**Fora do grupo (crm2) mas em uso**: `/` `/login` `/definir-senha`
`/esqueci-senha` `/checkout/[id]` `/impl-pabx/[token]` `/p/[id]`

Nenhuma rota de Ajustes foi tocada em nenhuma sessão até aqui — é o maior
bloco 100% pendente do produto.

### 2026-09-10 — Atendimento: crítica honesta + dois bugs reais corrigidos

Diferente de Propostas, a crítica no browser (com dado real, filtro "Todos",
`claude-visual@local.dev`) NÃO encontrou uma superfície de MVP. O inbox de
`/atendimento` (`ChatThread.tsx`, `CallDetail.tsx`, `ContextPanel.tsx`,
`ConversationList.tsx`) já é um three-pane inbox maduro: cards de IA (chance de
fechar, urgência do cliente, objeções, resumo/transcrição por tabs), rail de
contexto com pessoa/empresa/negócio ativo/cadências, bolhas de WhatsApp reais.
Registrar isso é tão importante quanto registrar um problema — declarar
"redesign" aqui seria fabricar diferença que não existe, contra a regra de
ouro da missão.

Dois problemas REAIS, achados no browser, foram corrigidos:

1. **Header do thread de WhatsApp quebrava em 390px**
   (`ChatThread.tsx`). O container de identidade+ações era uma única linha
   sem quebra; o cluster de ações (até 6 botões: assumir/devolver IA,
   atribuir, dono da conversa, adiar, arquivar, "...") tinha `shrink-0`, então
   o bloco de nome/subtítulo (que só tinha `min-w-0`, sem `flex-1`) era
   espremido a ~0px — nome e "WhatsApp de fulano" ficavam literalmente
   invisíveis atrás do avatar, e o próprio cluster de ações vazava pela borda
   direita da tela (o menu "..." nem aparecia). Corrigido com
   `flex-col sm:flex-row` no container e `overflow-x-auto` de segurança no
   cluster de ações.
2. **Painel de contexto inacessível abaixo de 1280px**
   (`Workspace.tsx`). `Cf2ContextPanel` (pessoa, empresa, negócio ativo,
   próximas atividades, cadências) só renderizava com `hidden xl:block` — uma
   decisão deliberada e documentada em comentário (evitar espremer a
   conversa em notebook), mas sem nenhum caminho alternativo, o contexto
   inteiro desaparecia em qualquer tela abaixo de 1280px, notebook incluso,
   não só celular. Adicionado um botão "Detalhes" (`xl:hidden`, ícone `Info`,
   ao lado do "Todas as conversas") que abre o MESMO `Cf2ContextPanel` dentro
   de um `DetailDrawer` — sem duplicar dado ou lógica.

Validação: `tsc` limpo, detector Impeccable sem achados, `git diff --check`
limpo, console 0 erro em desktop 1512px/1024px e mobile 390px, testado com
ligação (CallDetail) e WhatsApp (ChatThread) reais.

Não feito, honestamente: `ConversationList.tsx`, `EmailThread.tsx`,
`CallDetail.tsx` e `Dialer.tsx` só passaram por leitura, não por crítica
estrutural própria — podem ter problemas menores não cobertos aqui. Esta
superfície fica "Em andamento", não "Concluído", porque a passagem foi de
hardening/bugfix, não a auditoria completa que o método da missão pede
(estados de erro/loading/permissão, acessibilidade de teclado, etc.).

### 2026-09-10 — Ajustes: primeira leitura, sem intervenção visual

`/ajustes` (índice) e `/ajustes/membros` foram lidos e criticados no browser.
Nenhuma mudança de UI foi feita aqui — registro honesto do porquê:

- **`/ajustes` (índice)**: grid de cards por seção (Organização & Acesso,
  Comercial, Comunicação, IA & Growth, ...), cada um com ícone, título,
  descrição e badge "Em construção" quando a rota ainda não existe de
  verdade. Isso NÃO é o anti-padrão "card + card" que a missão pede pra
  eliminar em dashboards — é um índice de navegação puro, sem métrica
  dominante nenhuma pra hierarquizar; o padrão certo pra esse tipo de tela já
  é o que está lá. Aplicar `Cf2Pulso` aqui seria forçar um vocabulário errado
  só pra "parecer redesenhado".
- **`/ajustes/membros`**: página madura — sub-nav lateral com todas as seções
  de Ajustes, tabela de equipe com avatar/papel/meta, convite, controle de
  permissão por papel. Um achado real, não corrigido nesta sessão: a coluna
  "Meta do mês" sempre mostra o botão "Definir", nunca o valor JÁ definido —
  o tipo `Membro` (`tipos.ts`) nem carrega esse dado, e `GET /api/usuarios`
  (`usuarios.ts:74`) não faz join com a tabela `metas`. Pra mostrar o valor
  atual seria preciso um join real no backend, não só CSS — registrado como
  pendência de produto, não corrigido aqui pra não fazer uma mudança de
  contrato de API às pressas sem medir o impacto em quem mais consome
  `GET /api/usuarios`.

Restam 18 das 20 rotas de `/ajustes/*` sem nenhuma leitura nesta sessão (ver
inventário completo acima).

### 2026-09-10 — CS: tela dedicada, corrigindo um bug de roteamento que nunca funcionou

Pedido direto do Kauã: "CS não deve abrir o Cliente 360, tem que ser a tela
de CS mesmo". Investigação confirmou que era um bug real, não só preferência
de produto.

**Achado.** Todo clique de dentro do módulo de CS (`CsFila`, `CsBlocos`,
`CsWorkspace` — fila de atenção, blocos de resumo, tabela de carteira,
renovações, expansões) navegava pra `/clientes/:empresaId`, que é
`Cf2Cliente360` — uma página de 12 abas sobre a conta inteira (Resumo,
Pessoas, Comercial, Serviços, Financeiro, Contratos, Atividades, Timeline,
Documentos, Onboarding, Implantação e **CS**, essa por último). Alguns links
até mandavam `?aba=cs` ou `?aba=cs&marco=X` tentando abrir direto na aba
certa — mas **`Cf2Cliente360` nunca leu nenhum parâmetro da URL** (zero
`useSearchParams` no arquivo inteiro, confirmado por grep). Resultado: 100%
dos cliques feitos de dentro do CS sempre caíam na aba "Resumo", nunca na
aba CS — o trabalho de CS (`Cf2CsPanel`, 864 linhas, jornada/riscos/billing/
renovação/expansão/churn, já pronto) ficava soterrado como a 9ª de 12 abas
de uma tela que fala de outra coisa.

**Correção.** Rota nova `/clientes/cs/[empresaId]` (`CsDetalhe.tsx` +
`app/(crm2)/clientes/cs/[empresaId]/page.tsx`): identidade mínima da conta
(avatar, nome, MRR, CS owner, sinais de atenção — mesmo critério da fila
cross-cliente) mais o `Cf2CsPanel` inteiro, sem as outras 11 abas. Link
explícito "Cliente 360 completo" no canto pra quem realmente precisar da
conta inteira (propostas, contratos, documentos) — a diferença chave é que
agora ISSO é a exceção deliberada, não o destino padrão de todo clique.

Todos os `router.push`/links de CS foram repontados: `CsFila.tsx` (linha da
fila + "Executar checkpoint" + "Abrir renovação" no menu "..." — "Abrir
Cliente 360" continua indo pra Cliente 360, de propósito), `CsBlocos.tsx`
(sem responsável, checkpoints urgentes, renovações), `CsWorkspace.tsx`
(tabela de carteira, lista de renovações, lista de expansões).

**De brinde, o deep link de marco passou a funcionar pela primeira vez.**
"Executar checkpoint" sempre mandou `?marco=X` e nada no código lia esse
parâmetro também — `Cf2CsJornada` ganhou prop `marcoInicialId` (usada só
como valor inicial do `useState` que já existia), passada por `Cf2CsPanel` →
`Cf2CsDetalhe` → página. Validado com marco real: abre a régua de jornada já
com o card do checkpoint aberto (script, perguntas, sinais), em vez de exigir
achar o card certo na régua manualmente.

Validação: `tsc` limpo, detector Impeccable sem achados, `git diff --check`
limpo, console 0 erro em desktop 1512px e mobile 390px, testado com conta
real (`Ativo real`, MRR R$ 359,80, 2 riscos abertos) e deep link de marco
real (`Checkpoint 3 meses`).

Não feito: a aba "CS" continua existindo dentro de `Cliente360.tsx` (não foi
removida — alguém já dentro da conta por outro motivo pode querer ver o
mesmo painel sem trocar de rota) e ainda está sujeita ao mesmo `?aba=`
morto — não conserta o parâmetro dela, só deixa de ser o caminho principal.
