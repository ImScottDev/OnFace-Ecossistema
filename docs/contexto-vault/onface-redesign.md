---
tipo: produto
projeto: Callface CRM
status: ativo
owner: Kauã Scott
atualizado_em: 2026-09-16
tags: [onface, crm2, redesign, frontend]
---

# ONFACE — Redesign do CRM 2.0, módulo a módulo

Reconstrução das telas do CRM 2.0 sob a identidade ONFACE. Kauã conduz, mandando
uma tela de referência por vez.

## Método acordado (16/09/2026)

Front primeiro, dado depois. A decisão é do Kauã e o motivo é o ciclo de feedback:
misturar redesign com integração esconde qual dos dois está errado quando a tela
fica estranha.

1. **Cópia fiel** da imagem de referência. Nada de "melhorar" texto, número ou
   estrutura por conta própria. Divergência percebida vira anotação no fim da
   entrega, não mudança silenciosa.
2. **Lapidação** com o Kauã. Ele diz o que vira o quê.
3. **Integração** só depois de aprovada.

Regra estrutural para a integração não virar reescrita: cada tela tem `types.ts`
(contrato) e `mock.ts` (conteúdo de referência) ao lado do componente. O
componente recebe tudo por props e nunca escreve texto no meio do JSX. Integrar
é trocar a fonte, não o componente.

## Contexto que motivou o método

Todas as tentativas anteriores dessas telas frustraram o Kauã. A causa provável
não era gosto: `HomePageFigma.tsx` é dump literal do plugin do Figma, com o frame
inteiro em posicionamento absoluto e largura fixa de 1440px, classes utilitárias
com valores quebrados (`text-[12.919px]`) e fontes hard-coded. Não sobrevive a
outra viewport nem aceita ajuste fino.

Por isso os tokens de `src/app/onface.css` são tratados como **suspeitos**, não
como fonte de verdade. Quando a imagem diverge do token, a imagem manda e a
divergência fica registrada. A correção do token só é decidida depois da tela
aprovada.

## Estrutura base de toda página (definida pelo Kauã, 16/09)

Topbar sangra até as bordas. Abaixo dele, a página ocupa a viewport inteira e a
margem existe só como moldura de grafite em volta do canvas claro. Nada de
coluna centralizada com `max-width`: em monitor largo isso criava margem lateral
grande, que foi exatamente o que o Kauã apontou.

Implementado em `src/components/onface/shell/OnfacePage.tsx` + `page.css`:

- `.onface-page` — fundo grafite, altura mínima da viewport menos o topbar.
  Define `--onface-gutter` (28px) e `--onface-moldura` (12px), herdadas por quem
  estiver dentro.
- `.onface-page-band` — faixa escura do topo, sangrando até as bordas.
- `.onface-page-surface` — canvas claro, recuado pela moldura, radius 28px.

O padding do canvas desconta a moldura (`gutter - moldura`), então as colunas da
faixa escura caem exatamente sobre as do canvas. Sem esse desconto as duas
seções ficam desalinhadas em 12px, que foi a queixa de "segunda seção não
integrada".

Toda tela nova do ONFACE começa por esses três componentes.

## Estado por módulo

| Módulo | Rota de desenho | Estado |
|---|---|---|
| Topbar | `/onface-preview` | Aprovado pelo Kauã (única peça boa das tentativas anteriores) |
| Visão Geral | `/onface-preview/visao-geral` | Construída 16/09, aguardando lapidação |

## Visão Geral — o que foi construído

Arquivos em `src/components/onface/visao-geral/` (`types.ts`, `mock.ts`,
`VisaoGeral.tsx`, `visao-geral.css`), rota em
`src/app/(onface-preview)/onface-preview/visao-geral/page.tsx`.

`/onface-desenho/visao-geral` é um banco de desenho sem login, bloqueado fora de
desenvolvimento, criado porque o Chrome do Scott não estava conectado e a rota
oficial exige sessão. Conteúdo é mock, não há nada real para proteger. O layout
do grupo reproduz o shell oficial (topbar + tema); precisa de `SessionProvider` e
`QueryClientProvider` porque o sino de notificações do topbar consulta via
react-query e derruba o shell inteiro sem o provider.

Interações já funcionais, sem dado real: filtros (Todas / Em andamento / Atenção
/ Concluídas) filtrando a lista e trocando Detalhes e Resumo; clique na linha da
tabela seleciona a operação; gráfico com hover por mês e legenda que liga e
desliga série; assistente com conversa e composer; "Ver prioridades" leva para o
filtro de atenção.

### Mascote ONI

O card do Assistente ON precisava do mascote e não havia asset recortado. Extraí
do board da marca (`public/onface/inicio/9c78e.png`) com Pillow: flood fill do
fundo claro a partir das bordas e, na sequência, componente conexo a partir de
sementes no corpo do robô — o segundo passo é o que elimina os textos do board
sem recorte manual. Resultado em `public/onface/oni/` (`oni-mascote.png`,
`oni-avatar.png`).

### Assistente Nexo (decidido pelo Kauã em 16/09)

O assistente chama **Assistente Nexo**, não "Assistente ON". O card é o
**fechado**: termina nas duas ações secundárias, sem área de conversa e sem
composer. A versão com chat que eu havia montado foi reprovada.

O mascote continua sendo o ONI da marca e os arquivos seguem com esse nome em
`public/onface/oni/`. Ele integra o card: entra pela direita, escurecido
(`brightness(0.42)`), cortado pelas bordas, com um véu em gradiente por cima
para o texto não perder contraste.

"Ver prioridades" leva ao filtro de atenção. "Gerar resumo" e "Analisar
gargalos" ainda não têm destino definido.

### Divergências anotadas na entrega
- Espaço entre a faixa escura e o canvas: o padding inferior da faixa não é
  respiro puro, porque a pílula de filtros sobe 84px e come esse mesmo padding.
  O respiro visível é `padding - 84`. Ajustado para 132px (48px de respiro).
- Plus Jakarta Sans ganhou peso 400 no `layout.tsx`. A referência usa a mesma
  família no corpo, e sem o regular o navegador sintetizava o peso.
- Rodapé de "Detalhes da operação": rótulos como "Reunião técnica" não cabem em
  uma linha nesta largura. Deixei quebrar em duas em vez de truncar.

## V2 descartada, V1 é a tela oficial (16/09)

O Kauã comparou e decidiu ficar com a V1. A V2 foi excluída (componentes e
rotas). O que valia dela entrou na V1 como ajuste de conteúdo.

## Decisões de conteúdo da Visão Geral (16/09)

**Gráfico "Evolução da operação":** duas séries, Receita (MRR ativo) e Nova
receita (MRR fechado no mês). Chamados entrou e saiu na mesma rodada. A janela
é sempre os **seis meses até o mês corrente**, calculados na hora: a tela não
pode exibir mês que ainda não aconteceu, que foi o erro do mock com Jul a Dez.

**Cartão "Automações ON" virou "Novo faturamento"** (novas vendas do mês).
Automações não tem origem no CRM. Health Score também saiu: não é métrica do
negócio.

**Meta do mês existe**: tabela `metas` (`tipo = 'mrr_fechado'`, `periodo`,
`valorAlvo` por usuário). A meta do mês é a soma dos alvos do período.

**Card de detalhe é dinâmico por tipo de registro.** Um lead recém-chegado, uma
oportunidade, uma implantação, um cliente e um upgrade não têm o mesmo detalhe.
O esqueleto é fixo (identidade, progresso, sinal, quatro indicadores) e o
conteúdo de cada zona muda por `TipoRegistro`. Até o título muda: "Detalhe do
lead" não promete o mesmo que "Detalhe do cliente".

**Faixa do assistente só aparece quando há sinal real** (bloqueio, prazo
estourado, cobrança vencida, queda de uso). Sem sinal, entra uma linha discreta
de "nada travando". Aviso que aparece sempre deixa de ser aviso.

**Lista de prioridades:** colunas **Empresa · Etapa · Jornada**, decisão do
Kauã. Etapa sozinha é ambígua ("Proposta" existe em Vendas, "Qualificação" em
Pré-vendas); as duas juntas se completam. O valor desceu para a linha de apoio,
junto do serviço. O coral no selo de etapa passou a significar alerta, não
decoração. A lista rola dentro do card e tem rodapé com contagem e "ver todas".

### Etapas reais por jornada (conferidas no schema)

- **Pré-vendas** (`leads.sdrStatus` / `crm2PreVendasStage`): novo, em_contato,
  qualificacao, qualificado, agenda_confirmada, mais sem_resposta,
  nutricao_retomar, desqualificado.
- **Vendas** (`negocios`): entrada, diagnóstico, proposta_apresentada,
  negociacao_iniciada, em_fechamento, ganho, perdido.
- **Implantação** (`fulfillments`): estado macro (NOT_STARTED, IN_PROGRESS,
  WAITING_CUSTOMER, BLOCKED_*, READY_FOR_VALIDATION, COMPLETED, CANCELED) mais
  o checklist configurável, hoje com o seed real do Delivery PABX de 8 etapas.
- **CS e Expansão**: não existe pipeline no schema. As etapas precisam ser
  definidas pelo Kauã antes da integração.

Importante: `pipelines.stages` é jsonb configurável por tenant. Nenhuma etapa
pode virar enum fixo no componente.

## Escala proporcional do ONFACE (16/09) — regra para todas as telas

Decisão do Kauã: a tela tem que aparecer **igual para todo mundo**, em qualquer
monitor e em qualquer zoom. Um MacBook de 13" e um de 15" mostram a mesma tela,
em tamanhos diferentes, não duas telas diferentes.

**Implementação** em `.onface-app-shell` (`src/app/onface.css`):

```css
--onface-escala: 0.9;                                       /* dial único */
--onface-u: clamp(0.5px, calc(0.0694vw * var(--onface-escala)), 1.3px);
```

`1u = 1px da prancheta de 1440`. Como a medida é `vw`, a tela inteira é uma
redução ou ampliação fiel do desenho. Zoom do navegador deixa de quebrar o
layout: ao dar zoom a viewport encolhe em px de CSS, a unidade encolhe junto e
o resultado ocupa a mesma fração da tela física.

`--onface-escala` é o **único** lugar para mexer em densidade. Se o Kauã disser
"está grande demais" ou "pequeno demais", muda esse número, nunca o tamanho de
um componente solto. Foi para 0.9 em 16/09 a pedido dele.

Celular tem prancheta própria (375) em `@media (max-width: 767px)`, senão
herdaria a redução do desenho de desktop e ficaria ilegível.

**Nenhum breakpoint de laptop.** Os antigos (1279 e 1023 no topbar, 1280 e 1080
na Visão Geral) foram removidos: com a escala proporcional eles passaram a
atrapalhar, porque mudavam a aparência entre desktops. Existe um único ponto de
virada, 767px, onde entra o desenho de celular.

**Nenhuma fonte usa `vw` solto ou `clamp` próprio.** Era daí que vinham os
textos estourando o cartão: a fonte crescia com a viewport e o container não
acompanhava. Tudo mede em múltiplos de `--onface-u`.

**px continua** só em hairline de borda (1px, 2px) e em `--radius-full`.
Breakpoints continuam em px reais: eles medem a janela, não o desenho.

**Regra dura: nenhuma rolagem horizontal, em nenhuma largura.**
`.onface-app-shell` tem `overflow-x: clip` (não `hidden`, que quebraria o
`position: sticky` do topbar) como rede, mas a causa raiz é sempre corrigida.
As encontradas: topbar sem `min-width: 0` entre 1280 e 1024, e linhas da lista
20px mais largas que o container rolável.

**Como validar:** auditoria no navegador comparando `scrollWidth` com
`clientWidth` de cada nó folha, mais `scrollWidth` do documento. Zero cortes e
zero overflow em 375, 1100, 1329, 1440 e 1728 na entrega de 16/09.

## Abas do painel: Prioridades · Agenda · Pendências (16/09)

As antigas ("Todas / Em andamento / Atenção / Concluídas") eram quatro recortes
do mesmo status, redundantes com o selo de cada linha. Kauã também descartou
recorte por escopo ("Minhas / Do meu time"): a Visão Geral é pessoal por
definição, visão de time é assunto de relatório.

As abas agora trocam o **assunto** do painel, não filtram a mesma lista:

- **Prioridades**: o que já existia (detalhe + resumo + operações). Ação sua.
- **Agenda**: espelho do calendário do Microsoft 365, com próximo compromisso e
  resumo do dia. Compromisso.
- **Pendências**: o que está travado esperando terceiro. Espera.

Fontes reais: `getPrecisaAtencao`, `getAgendaHoje` (já existia e ninguém usava),
e os estados de bloqueio de `fulfillments` mais faturas vencidas.

### Padrão de seleção da tabela de pendências

Sem seleção, a tabela ocupa a largura toda. Ao selecionar uma linha, ela cede
espaço (grid de uma para duas colunas, com transição) e abre o **resumo da
atividade** ao lado, em vez de navegar para outra página.

O resumo mostra o **vínculo**: toda atividade nasce ligada a um registro
(Cliente, Lead, Negócio ou Entrega), e é esse vínculo que leva ao cadastro
completo. Esse padrão vale para a futura página de Atividades, onde o usuário
vai poder criar atividade a partir de qualquer registro.

## Janela do compromisso (16/09)

Clicar num compromisso da agenda abre uma janela que é o **controle remoto do
evento**, que continua vivendo no calendário do Microsoft 365. Ações:

- Entrar na reunião e copiar link (clipboard de verdade, com retorno visual)
- Incluir participante (nome + e-mail; interno x cliente sai do domínio do
  e-mail, `@callface.ai` é interno)
- Alterar data e hora, que devolve o convite para "aguardando" porque todo mundo
  precisa confirmar de novo
- Lembrete no WhatsApp para o contato do cliente, com prévia da mensagem e link
  `wa.me` montado a partir do telefone
- Cancelar reunião

### Cancelamento pergunta quem cancelou, e isso não é detalhe

Cancelamento **do cliente** entra como `no-show`, não como "cancelado"
genérico. É esse registro que alimenta a régua de no-show (73% medido na
auditoria de 04/08). Cancelamento interno fica como `cancelado`, sem
contaminar o indicador. A pergunta é obrigatória no fluxo em vez de opcional,
justamente para o dado não nascer torto.

Contrato em `types.ts`: `StatusCompromisso` ganhou `cancelado` e `no-show`, e o
compromisso carrega `cancelamento: { por, motivo, quando }`.

### Gotcha: portal perde as variáveis de escala

O `DialogContent` do shadcn renderiza em portal, fora de `.onface-app-shell`.
Como `--onface-u` e as cores da tela viviam só ali, todo `calc(N * var(--u))`
ficava inválido e a janela aparecia sem superfície nenhuma. Corrigido
declarando a escala também em `html[data-onface-theme]` e as cores em
`.ovg, .ovg-janela`. **Vale para qualquer dialog, popover ou tooltip futuro.**

Outro detalhe do shadcn: `DialogHeader` traz `flex-col`. Sem declarar
`flex-direction: row`, o botão de fechar cai para baixo do subtítulo.

## Aviso de hidratação: resolvido como artefato do dev (16/09)

O console acusava `hydration mismatch` nos `id` gerados pelo Radix. Investigado
até o fim, com medição em vez de hipótese:

- O HTML do servidor traz 2 ids radix; o DOM final do cliente tem **os mesmos**.
  `aria-controls` aponta para id existente, ou seja, nada quebra na prática.
- O dev serve o overlay de devtools do Next (35 scripts contra 16 em produção,
  e `nextjs-portal` presente só em dev). Ele monta componentes no cliente que o
  SSR não tem, o que desloca a numeração do `useId` do React.

**Conclusão: é artefato do modo de desenvolvimento, não bug do produto.** Não há
o que corrigir no código.

O que ficou da caçada, e vale manter porque resolve problemas reais:

- **Submenu do topbar saiu do Radix** e virou menu ancorado no próprio item.
  Menu de navegação não precisa de portal nem de foco aprisionado; precisa abrir
  no hover, fechar e deixar clicar. De quebra acabou o piscar.
- **`modal={false}` nos menus de ajustes e perfil.** No modo modal o Radix trava
  o scroll do body e compensa a barra, o que fazia a página inteira deslocar ao
  abrir o menu. Era o "bug de layout" que o Kauã relatou.
- **Indicador do sino não some mais da árvore**, só do olho (`data-visivel`).
- **Layout do banco de desenho virou server component**, igual às rotas
  oficiais, com os providers isolados num componente cliente.

## Correções de acabamento (16/09)

- **Submenu do topbar piscava no hover.** Causa: o Radix em modo modal zera o
  `pointer-events` da página ao abrir, o cursor deixa de estar sobre o item,
  dispara o mouseleave, fecha e reabre em loop. Fix: `modal={false}` no
  `DropdownMenu`. Medido com MutationObserver: 1 abertura e estável por 2s com
  o ponteiro parado.
- **Colunas da lista desalinhadas do cabeçalho.** Cada linha é um grid próprio;
  com `max-content` cada uma media a si mesma. Fix: colunas de largura fixa em
  `u` e o mesmo `padding-inline` no cabeçalho, nas linhas e no rodapé. Sem isso
  a coluna fixa nasce 9px adiantada. Verificado: os três eixos batem no pixel.
- **Linha de serviço e valor saiu da lista** a pedido do Kauã: só empresa,
  etapa e jornada.

## Selos padronizados (16/09)

Etapa e jornada usam o mesmo componente visual (`.ovg-selo`): mesma altura,
mesmo raio, ícone à esquerda. O ícone da etapa vem do **estado**
(`EstadoEtapa`: andamento, aguardando, alerta, concluída), nunca do nome da
etapa, porque `pipelines.stages` é configurável por tenant e um ícone por nome
quebraria na primeira instância que renomeasse "Proposta". A jornada, que é um
conjunto fechado, tem ícone próprio por valor.

Cor é semântica: coral é alerta, verde é concluído, cinza é o resto.

## Visão Geral integrada ao banco (16/09)

Decisão do Kauã: integrar antes de seguir para as próximas telas. Argumento que
pesou: o produto vai ser construído "daqui em diante", então dado que não é
gravado hoje é histórico que nunca nasce. O no-show é o exemplo: enquanto a
tela não grava, todo cancelamento de cliente some.

**Onde vive:** `src/lib/analytics/onface-visao-geral.ts`, função
`montarVisaoGeral(orgId, usuarioId, nome)`. A página só resolve contexto e
entrega. O componente não mudou uma linha, o que confirma que o método de
`types.ts` + `mock.ts` funcionou: a integração foi troca de fonte.

**Rotas:** `/onface-preview/visao-geral` (oficial, com login, dado real),
`/onface-desenho/visao-geral` (mock, para desenho),
`/onface-desenho/visao-geral-real` (dado real sem login, só em dev, para
validar o que só quebra com dado de verdade).

**Smoke check:** `npx tsx --env-file=.env src/scripts/checar-onface-visao-geral.ts`
Monta a tela inteira contra o banco e imprime bloco a bloco, incluindo aviso de
bloco vazio. Roda em ~360ms no banco de dev.

### Achado importante: "Receita" não era receita

`getMrrSeries` entrega MRR **fechado** por mês (o que entrou de novo), não a
base recorrente. No banco de dev isso pintava uma série de R$ 10k a R$ 60k num
gráfico chamado "Receita", enquanto o MRR ativo é R$ 428k. As duas séries do
gráfico diriam a mesma coisa, com número dez vezes menor que o real.

Corrigido com `getMrrAtivoPorMes`, que reconstrói a base recorrente para trás a
partir do MRR de hoje descontando os deltas de `mrr_movimentos`. Agora a série
sai de R$ 359,4k a R$ 428,6k, coerente com o cartão. As duas séries passaram a
medir coisas diferentes de propósito: tamanho da operação e velocidade dela.

Gotcha reincidente: `Date` cru não sobrevive ao template `sql``` (já estava em
`reference_crm_callface_pgjs_date_gotcha`). Vai como ISO com `::timestamptz`,
e o orgId com `::uuid`.

### O que a tela mostra hoje, com dado real

MRR R$ 428.565,69 · 820 operações ativas · 299 clientes · R$ 5.086,50 de novo
faturamento no mês · 9 operações prioritárias · 6 sinais em atenção.

### O que não foi inventado

`PENDENCIAS_DE_DADO`, no fim do módulo, lista o que falta no domínio: etapas de
CS e Expansão, agenda via Microsoft Graph (participante, link, confirmação),
atividade como registro próprio (autor, histórico, vínculo), responsável por
pendência e sugestão do assistente. A meta do mês some da tela quando não há
meta cadastrada no período, em vez de mostrar zero.

## Atividades (16/09) — segunda tela, já integrada

Dentro de **Operação** no topbar (substituiu "Tarefas" do legado).
`/onface-preview/atividades` é a oficial; `/onface-desenho/atividades` mostra o
mesmo com dado real sem login, só em dev.

### Atividade é `tarefas`, não entidade nova

A tabela já nasce com os vínculos que a tela precisa (`lead_id`, `negocio_id`,
`empresa_id`, `servico_canonico_id`) e com `origem`, que é a jornada de onde a
atividade veio. Criar tabela paralela duplicaria o que a operação já usa.

**Situação (colunas do kanban) é derivada, não campo:** concluída → Concluída;
sem data → Backlog; vencimento passado → Atrasada; resto → A fazer. **Não existe
"em andamento"** porque não existe marca de início em `tarefas`. Ter essa coluna
de verdade exige coluna nova, e isso é decisão do Kauã.

### O que a tela faz

Tabela com painel lateral (mesmo padrão de Pendências), alternância para
kanban, filtros de busca, jornada, responsável e **vencimento por data** (não
SLA, a pedido do Kauã), e criação de atividade.

**Fluxo de criação: empresa primeiro, pessoa depois.** Quem entra em pré-vendas
no ONFACE é a empresa; a pessoa é o contato dentro dela, e pode ser um lead ou
o contato de uma conta que já é cliente. O seletor marca cada empresa como
Cliente ou Prospect conforme tenha serviço ativo. Depois da empresa, carrega os
contatos e os negócios abertos dela.

Escrita por server actions (`actions.ts` ao lado da rota), que resolvem o tenant
no servidor. `revalidatePath` sozinho não atualiza quem já está montado: o
cliente chama `router.refresh()` depois de gravar.

### Achado: contador não pode sair de lista truncada

A lista carrega 300 linhas. Os cartões de resumo saíam desse recorte, e
"concluídas no mês" ficava em zero logo depois de concluir uma, porque a linha
saía da janela. Agora o resumo vem de uma consulta de agregação sobre a tabela
inteira, com `COUNT(*) FILTER`. **Regra para as próximas telas:** cartão de
resumo nunca se calcula da página carregada.

Outro: `Date.now()` no render quebra a regra de pureza do React e o lint pega.
O cálculo de dias até o vencimento foi para o servidor.

### Validado com dado real

300 atividades, 168 abertas, 64 atrasadas, 157 sem responsável. Vínculos
derivados: 157 Cliente, 95 Lead, 47 Negócio, 1 avulsa. Criação testada de ponta
a ponta gravando em `tarefas` (registro de teste removido depois), conclusão
testada e revertida. Zero cortes e zero rolagem horizontal em 1440 e 375.
`next build` compila.

Smoke check: `npx tsx --env-file=.env src/scripts/checar-onface-atividades.ts`

### Sujeira da base que a tela precisou contornar

O seletor de empresas ignora nomes com menos de 3 caracteres: a base tem
registros " ", "?" e "." de importação antiga, e escolher empresa numa lista
dessas é impossível. O dado continua no cadastro, só não polui o seletor.

## Atividades: segunda rodada (16/09)

**Status virou campo de verdade.** Migration `0046_tarefas_status_operacional`:
`tarefas.status` com `a_fazer | em_andamento | aguardando | concluida |
declinada`, backfill a partir de `concluida`, índice por organização e um
trigger que mantém `status` e `concluida` em sincronia nos dois sentidos. As
rotinas antigas do CRM continuam lendo `concluida` sem saber que existe status.

Antes disso o kanban era derivado de data de vencimento, o que descrevia o prazo
e não o trabalho: uma atividade parada esperando o cliente não é "a fazer".

**Tabela agrupada por prazo, em acordeão.** Atrasadas, Hoje, Próximos 7 dias, Em
breve, Sem data. Só "Hoje" abre sozinho: abrir tudo transforma a fila num
paredão de trezentas linhas, que é o oposto de saber o que fazer agora.

**Kanban por status**, com resumo ao lado (não embaixo, e sem trocar de visão ao
clicar, que era o bug). O quadro rola na horizontal quando as cinco colunas não
cabem; dentro da coluna, nunca.

**Chip de status com ícone de estado** na linha, no cartão e no resumo. A ideia
veio do `repos/circle` (clone do Linear) que o Kauã indicou: ícone de círculo
que conta o progresso sem depender de ler o rótulo. É o que faz a tela parecer
ferramenta em vez de protótipo.

**Criar atividade e criar lembrete** no topo. Lembrete é a mesma atividade com
tipo e prazo de hoje, não outra entidade.

**Acabamento:** cartões do topo com ícone em caixa e linha de contexto, vínculo
em duas linhas com ícone, resumo denso (título em 15.5u, campos em pares com
rótulo de 10u), e a tabela solta as colunas de apoio quando o resumo abre, em
vez de espremer. A grade de fundo do canvas caiu para 3,5% de opacidade.

## Jornadas: só as que o banco sustenta (16/09)

Última correção antes de fechar. A Visão Geral estava rotulando cobrança como
"CS" e trazendo "Expansão", que eram escolha minha e não dado. Conferido contra
o banco, o que o recorte de operações prioritárias sustenta é:

| Tipo do registro | Jornada | Por quê |
|---|---|---|
| negócio, proposta | Vendas | pipeline comercial |
| cobrança | **Financeiro** | o registro diz fatura em aberto, não acompanhamento de sucesso |
| entrega | **Implantação** ou **Onboarding** | a própria consulta distingue por `service_family` (Callface AI = Onboarding) |

`JornadaChave` passou a ser `Pré-vendas | Vendas | Implantação | Onboarding |
Financeiro`. **CS e Expansão saíram da tela** até existir pipeline delas, e
estão em `PENDENCIAS_DE_DADO` com essa redação.

Em **Atividades** é diferente e continua como está: lá a jornada vem de
`tarefas.origem`, que é coluna real (hoje o banco tem MANUAL, PLAYBOOK e
BILLING), então "CS" e "Expansão" podem aparecer quando a origem for essa. A
lista de filtro é montada do que existe, não do mapa.

**Regra que fica:** rótulo que a tela mostra ou sai de coluna do banco, ou sai
de derivação explicada em comentário. Não existe terceira opção.

## Menu principal congelado (16/09)

O Kauã fechou a árvore de navegação do ONFACE e pediu para congelar: sem
reorganizar, sem acrescentar item, sem mover módulo, sem "melhorar" a
arquitetura. Ela agora é uma estrutura única em
`src/components/onface/navigation.ts` (`MENU_ONFACE`), com três níveis reais:

```
Início · Atendimento
Vendas      → Pré-vendas, Pipeline, Propostas, Prospecção, Campanhas, Contatos & Empresas
Operação    → Atividades, Calendário, Chamados,
              Pós-vendas → Onboarding, Implantação → PABX, White Label, Callface AI
Clientes    → Visão Geral, Carteira, Customer Success, Expansão & Renovação, Risco / Churn
Automações  → Visão Geral, Fluxos, Cadências / Follow-ups, NEXO / Agentes IA, Execuções
Insights    → Visão Geral, Relatórios, Performance
```

**Financeiro sai do fluxo principal** por decisão de produto. A rota
`/clientes/financeiro` continua existindo e acessível, só não é exposta no
menu. Ajustes, busca, notificações e perfil seguem como utilitários à direita.

**Como o item acende:** casamento por prefixo mais longo entre o caminho atual
e todo href da árvore. É isso que resolve os cruzamentos sem regra manual:
`/clientes/implantacao` pertence a Operação mesmo estando sob `/clientes`, e
`/automacoes/campanhas` acende Vendas mesmo estando sob `/automacoes`. Rotas
legadas fora da árvore (`/negocios`, `/tarefas`) têm um mapa separado, senão o
menu apaga inteiro quando alguém abre um registro pelo CRM antigo.

**Três níveis no mesmo painel**, indentados, em vez de flyout lateral aninhado:
o painel já é onde a pessoa está olhando, e cada flyout é mais uma chance de o
ponteiro escapar no caminho (foi exatamente o bug do submenu piscando).

### Destinos estruturais criados (sem funcionalidade)

Onze rotas que a árvore pede e o produto não tinha, criadas com
`ModuloPendente`: a página diz o que o módulo vai ser e de que dado ele depende,
e não simula número nenhum.

`/chamados` · `/pos-vendas` · `/clientes/implantacao/{pabx,white-label,callface-ai}`
· `/clientes/carteira` · `/clientes/expansao` · `/clientes/risco`
· `/automacoes/fluxos` · `/relatorios/biblioteca` · `/relatorios/performance`

Dependências registradas nelas: dono de carteira não existe no banco; pipeline
de expansão não existe (mesma pendência da Visão Geral); risco precisa separar
churn voluntário de pagamento recusado, que hoje é 66% do churn; etapas próprias
por família de implantação; origem dos chamados.

### Divergências anotadas (não decididas por mim)

- **Início** aponta para a Visão Geral nova (`/onface-preview/visao-geral`),
  que é a tela padrão definida por ele.
- **Campanhas** entrou em Vendas na árvore, mas a tela continua em
  `/automacoes/campanhas`. Mover o módulo de pasta é outro trabalho.
- **Operação** e **Pós-vendas** não têm tela própria: Operação leva a
  Atividades, Pós-vendas é um destino estrutural.
- **Insights → Relatórios** virou `/relatorios/biblioteca` porque
  `/relatorios` já é a Visão Geral da área.

### Bug encontrado no caminho: `onface.css` estava duplicado

O arquivo tinha duas cópias das seções App shell → Responsive, e a segunda era
uma versão **antiga e corrompida** (regras coladas dentro de `@media` por edição
mal feita). Por vir depois, ela vencia a cascata: reintroduzia o breakpoint de
1279px que colapsa os rótulos do menu, justamente o que ele mandou tirar, e
anulava a regra `data-visivel` do indicador do sino. Removidas as ~900 linhas
antigas, preservando as media queries de 1023/767 que só existiam nelas.

**Lição:** CSS duplicado não dá erro em `tsc`, `eslint` nem `next build`. Só
aparece medindo no navegador ou lendo o arquivo inteiro.

## Módulo 01 — Vendas implementado (16/09)

O Kauã fechou a SpecDrive do Módulo 01 (cinco blocos, 5.671 linhas) e mandou
implementar de ponta a ponta, tratando a spec como fonte da verdade funcional.

### O que o diagnóstico mostrou

O repositório já tinha ido muito mais longe na direção da spec do que parecia.
Existiam `empresas`, `pessoas`, `pontos_contato`, `oportunidades`,
`oportunidade_bundle`, `clientes`, o gate de Won por evidência
(`comercial_evidencia` + `won_evidence_policies`) e o motor de cadências. O
trabalho foi **corrigir semântica e fechar o circuito**, não construir do zero.

O que estava errado em relação à spec:

- etapas do Pipeline eram `reuniao_agendada / reuniao_realizada / trial /
  proposta_apresentada / negociacao_iniciada`; a spec quer
  `Entrada / Diagnóstico / Proposta / Negociação`, com reunião e trial como evento;
- `no_show` era status fechado do negócio, quando devia ser evento que preserva
  a oportunidade e devolve o lead para Qualificado;
- o conversor gravava `reuniao_agendada` mesmo no caminho SEM reunião (a
  própria spec apontava isso);
- família da oportunidade vivia só no item, não no container;
- "Qualificado" era só estágio, não fato histórico;
- em Prospecção, ter oportunidade fazia o prospect ser lido como qualificado.

### Decisão de arquitetura que vale registrar

**`negocios` continua sendo a tabela física da oportunidade.** Trocar para
`oportunidades` significaria refatorar propostas, contratos, fulfillment, CS,
financeiro e reconciliação — e a spec proíbe refatorar módulo adjacente sem
necessidade estrita.

O que muda é que **o domínio novo é falado pelo motor**, não pelas colunas: tudo
passa por `src/lib/vendas/`, que traduz para as etapas canônicas num lugar só.
Nenhuma tela nova lê `negocios.status` cru. Entradas novas nascem no vocabulário
novo e o legado continua legível.

### Motor único para humano e IA

Bloco 01 §19 pede que humano e agente executem os mesmos comandos. Foi feito
literalmente: todo comando recebe um `Ator` (`HUMAN | AI_AGENT | AUTOMATION |
SYSTEM`) e a única diferença é quem chamou. O evento gravado diz o tipo do ator
sempre; o usuário só é exigido quando o ator é humano.

### Os gates, que são a parte que de fato muda o comportamento

- Qualificado não se alcança arrastando o card: é comando, porque grava fato.
- Oportunidade exige Empresa **e** Família; duas famílias criam duas
  oportunidades irmãs no mesmo bundle, nunca uma genérica.
- Proposta e Negociação exigem proposta vinculada, com CTA para criar.
- **Ganho não tem botão.** Existe "Tentar fechar", que pergunta ao gate de
  evidência e, quando recusa, diz o que falta.
- Nutrir e desqualificar exigem motivo estruturado; nutrir com data cria a
  retomada de verdade, como tarefa que reaparece na fila.
- Proposta contratual não envia sem os dados jurídicos da empresa, e o que o
  usuário preenche atualiza a **Empresa**, não fica preso na proposta.
- Aceite de proposta não é ganho: a tela mostra o gate pendente.

### O que o dado real mostrou

- 301 negócios tinham como status um **motivo de estagnação**
  (`outra_data`, `sem_retorno`, `trava_negociacao`, `trava_assinatura`). A spec
  proíbe perpetuar motivo como status: viraram coluna própria, e a etapa real foi
  recuperada de `status_changes`.
- 117 leads qualificados e `convertido_at` vazio na base inteira. A data veio da
  primeira transição registrada no histórico: 108 dos 117 têm data; **9 ficaram
  sem**, e ficam sem mesmo, em vez de receber data inventada.
- O catálogo, ao contrário do que eu supus no diagnóstico, está 100%
  classificado por família (PABX 194, Callface AI 11, White Label 8). Conferi no
  banco antes de registrar como dependência, e a dependência não existia.

### Verificação

`npm run aceite:vendas` roda as jornadas dos critérios de aceite contra o banco
real: **86 asserções, todas passando**, duas execuções seguidas com o mesmo
resultado. Ele cria tudo com prefixo `[ACEITE-VENDAS]` e limpa no fim.

Um achado do próprio aceite: a primeira rodada acusou "oportunidade direta cria
lead de Pré-vendas". Era bug de verdade — `criarOportunidade` empurrava o lead
para a etapa Oportunidade sempre que havia `leadId`, inclusive no caminho
outbound direto, que é justamente o que Bloco 04 §13 proíbe. Corrigido: o
espelho só acontece quando o processo de origem é Pré-vendas.

### Dependências registradas (não bloqueiam, dependem de fora)

- O formulário do site não pergunta a empresa. O webhook usa o domínio
  corporativo do e-mail quando dá; sem isso o lead entra sem empresa e a tela
  pede a associação antes de qualquer passo que exija Empresa. **Mudar o
  formulário é em outro repositório.**
- `propostas.lead_id` é `NOT NULL` no schema legado: proposta de oportunidade
  sem lead usa o contato mais antigo da empresa como referência.
- 1.441 negócios legados sem família. Aparecem como "Não classificada" e o
  catálogo não abre para eles até alguém definir a família — de propósito.

Detalhe técnico completo em `app/docs/reconstruction/MODULO-01-VENDAS.md`.

## Ligações

[[02_PROJETOS/Callface/CRM/HUB]] · [[02_PROJETOS/Callface/CRM/ESTADO-ATUAL]]
