# ONFACE × Callface AI — o que existe, o que está morto, o que dá para fazer

Levantamento de 21/10/2026. Feito lendo o código, o banco de produção
(`callface_crm_mz`, só SELECT) e o vault. O que está marcado como **suposição**
não foi provado — e está marcado de propósito, para ninguém construir em cima.

---

## 1. Em uma página

Existem **três canais** entre o ONFACE e a Callface AI, e eles não se conhecem:

| Canal | Direção | Estado |
|---|---|---|
| `enviarParaDiscagem` | ONFACE → Callface | 1 endpoint, manda `{nome, telefone}`. **Usado 3 vezes na vida.** |
| Webhook de ligação | Callface → ONFACE | **7.215 ligações**, 23/07 a 20/10. É a parte madura. |
| Espelho do banco do SaaS | Callface → ONFACE (leitura) | Read-only, sync a cada 6h, dado fresco de hoje. Só alimenta CS. |

**O que funciona de verdade:** a volta. Toda ligação traz áudio, transcrição e
resumo, vira atividade na linha do tempo, fecha tarefa aberta e — quando a IA
negocia horário — **agenda reunião sozinha**: converte o lead em oportunidade,
sorteia closer no rodízio com trava, confere conflito no CRM e no Outlook e cria
o evento real. **40 reuniões agendadas assim** até 15/10.

**O que está pronto e nunca foi ligado:** três peças, nessa ordem de esforço.

**O que depende da Callface, não de nós:** escolher qual agente liga, para qual
campanha, com qual roteiro. Hoje o ONFACE empurra o contato e perde o controle.

---

## 2. O que já funciona, com número

### A volta da ligação (`lib/integrations/callface.ts`)

7.215 ligações em produção. `FINISHED` 4.580 · `FAILED` 1.476 · `VOICEMAIL` 766
· `MISSED` 380 · `BUSY` 13. Todas com transcrição e áudio; 5.843 com resumo;
704 com percentual de chance de fechar.

Cada evento recebido: grava em `ligacoes` (idempotente por id da chamada),
resolve o dono, casa o lead pelos últimos 9 dígitos do telefone, escreve em
`communications` e `ai_analysis`, marca o primeiro contato de Pré-vendas, cria
atividade, fecha a tarefa de ligação e toca o relógio do board.

### O auto-agendamento

Quando o retorno traz uma reunião "Combinado", o ONFACE faz o ciclo inteiro
sozinho. É o padrão "agente de voz colhe informação e devolve para o CRM"
**já funcionando** — só que para um único tipo de informação: horário.

### O espelho do SaaS (`packages/integrations/callface-ai/`)

Leitura direta do banco do produto, com três travas de escrita. Espelha 1.051
licenças, 557 usuários, 218 equipes, 23 planos, 6 parceiros. Alimenta a tela
`/clientes/uso` e as tarefas de CS por silêncio, queda de uso e consumo do teto.

No banco do SaaS existem **3,88 milhões de ligações** com duração faturada,
direção, status, agente e campanha, e **30 mil sessões de CallPilot** com quantas
sugestões foram usadas.

---

## 3. Pronto e inerte — a fruta baixa

### 3.1 Enviar uma lista de leads para o discador: falta um item numa lista

A ação em massa `enviar_para_discador` **existe, trata telefone inválido com
motivo, soma aplicados e ignorados, e já é aceita pela API**
(`lib/vendas/acoes-em-massa.ts`, `api-server/routes/leads.ts`).

Ela não aparece na tela porque não está no array de ações disponíveis em
`components/onface/vendas/prospeccao-acoes.ts`. **É uma linha.**

Ressalva honesta: ligar isso entrega "mandar N contatos para a fila de discagem
da organização", não "mandar esta lista para esta campanha". Escolher campanha
depende da Callface (§5).

### 3.2 Ligação dentro de cadência: a peça está montada e nunca foi acionada

O passo `crm_callface_call` está registrado no motor de cadência, o editor já
oferece "Ligação Callface", e **3 cadências publicadas têm esse passo, com 6
inscrições**. Execuções desse nó: **zero**. Os eventos existentes param em
WhatsApp e e-mail.

Não descobrimos por quê. É a investigação de melhor relação valor/esforço deste
levantamento: a peça existe, está publicada e nunca rodou.

### 3.3 A ferramenta de ligação do agente está morta

`callface_call` existe no catálogo de ferramentas. Em 1.192 passos de execução
de agentes, **nenhum** é ela. A única versão de agente que a habilita está em
rascunho e nunca foi publicada.

Habilitar é uma linha — mas sem §5 ela só joga o lead na mesma fila cega.

---

## 4. O que está quebrado ou mentindo

| Problema | Tamanho |
|---|---|
| **Caixa postal conta como ligação.** `VOICEMAIL` não está na lista de status sem substância nem no mapa de rótulos. | 766 ligações |
| **Ligação órfã vira notificação e morre ali.** A mensagem promete "pode ser vinculada depois", e não existe tela para vincular. | 861 órfãs, 1.478 notificações em 3 meses |
| **Ligação sem dono.** 3.271 payloads chegam sem nome de agente. | 3.246 de 7.215 |
| **O webhook de saída é mono-tenant por constante.** A organização está escrita no código (`ORG_SLUG`). | bloqueia vender para terceiro |
| **Minuto tarifado não chega na ligação.** `billed_time` existe no SaaS e não vem no payload. Nenhuma fatura do ONFACE é calculada por minuto. | — |
| **Nenhuma métrica de voz no produto.** Fila, tempo de atendimento, abandono, atendidas/perdidas: o dado está no SaaS, a tela não existe. E Insights está desligado em produção. | — |
| **As telas de Relatório de Ligação são protótipo**, servidas só pelo laboratório `/design`. Não há rota nem item de menu de telefonia. | — |
| Referências mortas no código: `callpilot-trigger.ts` e `Cf2Dialer` não existem. | — |

---

## 4-A. O que as versões 2.17 a 2.21 da Callface mudaram (e nós não sabíamos)

As notas de versão que o Scott repassou em 21/10 respondem perguntas que estavam
abertas há meses. Resumo do que importa para a integração:

**A v2.17 corrigiu o nosso maior buraco.** Nas palavras deles: *"Ligação do
Agente grava `agent_id` e deixa `user_id` nulo, e todo o envio ao CRM era
ancorado em `user_id` — a transcrição salvava e o envio sumia sem erro visível."*
Era isso que fazia **2 de 3 ligações de teste não gerarem evento** em julho. A
nota diz que agora as ligações do agente de prospecção **são enviadas ao CRM**
quando há webhook de entrada configurado.

Medido no nosso banco, ligações sem dono resolvido por mês:

| Mês | Total | Sem dono | % |
|---|---|---|---|
| Agosto | 2.488 | 1.787 | **72%** |
| Setembro | 2.547 | 985 | 39% |
| Outubro | 1.623 | 465 | **28%** |

Melhorou de verdade. Parte do crédito é da correção deles, parte do nosso fix de
`agent_name` de 15/10.

**A v2.18 criou uma configuração que pode estar nos cortando.** Integrações
ganhou a opção *"enviar a sumarização da ligação somente quando o lead for
qualificado"* — interesse em demonstração, reunião agendada ou 50%+ de chance de
fechar. **Precisa conferir se está ligada na nossa organização**: se estiver,
deixamos de receber a maior parte das ligações, e isso parece defeito nosso.

**A v2.18 também resolveu a caixa postal** com status próprio. Nossas 766
ligações `VOICEMAIL` vêm daí — e o nosso código ainda as trata como ligação
comum (§4).

**Resumo e scorecard agora só saem em conversa real** (30s, 20 palavras, ao menos
uma fala do cliente). É a explicação provável de ligações sem resumo aqui.

**O que a plataforma passou a ter e nós não consumimos:**
- **Dados coletados** existe e é campo real — a v2.20 inclusive corrigiu um bug
  de exibição dele. Continua **não chegando** no nosso webhook.
- **Scorecard com evidências** por critério, com trecho e minuto da conversa.
- **Qualificação** com status próprios: Qualificado, Parcial, Não qualificado,
  Inelegível, Sem Informação (v2.21).
- **Origem da ligação** (Webphone ou Agente) como filtro.
- **CallPilot nesta ligação**: dicas recebidas, usadas, aproveitamento e
  tendência — e a **Base da Empresa** (v2.19), onde a organização cadastra
  produtos, preços, provas, objeções e o que nunca prometer.
- **Notificação de lead qualificado por WhatsApp** direto do agente (v2.19).
- **Webhook de criação de organização** (v2.17) e **quatro eventos de cobrança**
  para parceiros (v2.20).
- **Cancelamento de campanha do agente por organização**, atrás da flag
  `controlled_agents_batch_call_enabled` (v2.18) — primeira evidência de controle
  de campanha de agente por organização.

**Confirmado no nosso banco:** o payload das ligações dos últimos 21 dias
continua com **as mesmas 17 chaves** de sempre. Nenhum dos campos acima chega.
Não é bug — é contrato: precisa ser pedido.

---

## 4-B. O que foi verificado DENTRO da plataforma (21/10, logado como admin)

Navegado no painel, não deduzido. Isto corrige o §5 abaixo em pontos
importantes — leia esta seção primeiro.

### O disparo do agente de voz pelo ONFACE já é possível HOJE

Está escrito na tela de Integração › Webhooks › Entrada, palavra por palavra:

> *"A cada evento, a Callface valida o token e adiciona o contato à campanha
> 'Funil &lt;nome da sua organização&gt;', criando-a na primeira vez.
> **A ligação inicial é disparada automaticamente pelo agente de prospecção
> assim que o contato é criado. Escolha o agente na tela de Agentes.**"*

Ou seja: **não falta contrato de API para a Lia mandar ligar.** O agente é
escolhido **uma vez**, na tela de Agentes (botão "Definir agente de prospecção"),
e todo contato enviado pelo `create-contact` que já usamos é ligado por ele.

O que continua **não** sendo possível por API: escolher agente diferente por
ligação, mandar roteiro ou variável por contato, e escolher a campanha de
destino. Para isso vale o que está no §5.

### Estado dos agentes na nossa organização

| Agente | Papel | Campanhas | Chamadas | WhatsApp | Último uso |
|---|---|---|---|---|---|
| **Agente Mayra** | **agente de prospecção** (é quem atende o `create-contact`) | 320 | 7.643 | +55 11 91086-1344 | 20/10/2026 |
| Agente de IA Mayara | — | 16 | 18 | não configurado | 20/10/2026 |
| Assistente de Vendas | — | 5 | 6 | não configurado | 09/10/2026 |

Três agentes ativos, **413 campanhas** no total. O Agente Mayra já tem WhatsApp
de notificação de lead qualificado configurado (recurso da versão 2.19 deles).

### O filtro de qualificado está DESLIGADO

Integração › Configurações › "Enviar apenas leads qualificados": **desligado**.
Não estamos perdendo ligação por causa dele. Pergunta encerrada.

### O contrato do webhook de saída, oficial, tem 17 campos

A própria tela mostra o payload de exemplo, e ele é **exatamente** o que
recebemos: `deal_id`, `contact_id`, `call_date`, `summarization`,
`transcription`, `call_link`, `call_duration`, `call_audio_url`, `user_email`,
`user_name`, `destination_number`, `credentials`, `call_status`,
`deal_closure_percentage`, `scheduling`.

**Scorecard, dados coletados, qualificação, origem e minuto tarifado não estão
no contrato.** Existem no painel e não são enviados. Isso confirma o §5.3: é
pedido ao time, não defeito nosso.

Nosso webhook de saída: `https://crm.callface.io/api/webhooks/callface`, ativo,
secret configurado, criado em 22/07/2026.

### O webhook de ENTRADA quase não é usado

**17 eventos processados desde 22/07, último em 21/08/2026.** Bate com os 3 usos
da rota manual mais testes. Confirma que o caminho ONFACE → discador está
praticamente parado.

### Um buraco que ninguém tinha visto: 38% das ligações não chegam ao CRM

| Onde | Ligações |
|---|---|
| Painel da Callface (total) | **11.647** |
| `ligacoes` no ONFACE | 7.215 |
| **Diferença** | **4.432 (38%)** |

Parte é anterior ao webhook (criado em 22/07) e parte são chamadas de vídeo, que
o painel conta junto. **Mas a diferença precisa ser explicada antes de qualquer
relatório de voz no ONFACE** — hoje qualquer número que a gente mostrar está
incompleto e não sabemos o quanto.

### Zoho continua conectado

Em CRMs, **Zoho está "Conectado"** — o CRM legado segue recebendo registro de
ligação em paralelo ao nosso webhook. Decidir se desconecta.

---

## 4-C. A API real, lida do próprio painel (21/10)

Capturado instrumentando o app logado e lendo o pacote JavaScript dele. É o
contrato de verdade, não documentação.

**Base:** `https://api.callface.io`

### Agentes

`GET /agents` devolve, por agente:

| Campo | Para que serve aqui |
|---|---|
| `name`, `description`, `status` | identificação |
| **`is_prospection_agent`** | marca quem atende o `create-contact` que já usamos |
| **`system_prompt`** | o roteiro do agente |
| **`first_message_variables`** | **as variáveis do roteiro**. Hoje: `["nome"]` |
| `voice_id`, `provider_id`, `organization_id` | voz e tenant |

`POST /agents/upsert` cria e atualiza agente — ou seja, **dá para criar agente e
mexer no roteiro e nas variáveis por API**.

Também existe `agents/generate-prompt` e `/agents/create`.

### Campanhas

`GET /agents/campaigns` devolve `campaignId`, **`agentId`**, `name`, `status` —
**a campanha carrega o agente**. Escolher o agente por campanha é possível.

Rotas encontradas:

| Rota | O que faz |
|---|---|
| `POST /campaigns/{id}/upload` | sobe a lista de contatos (FormData, campo `file`) |
| `PATCH /campaigns/{id}` | altera a campanha |
| `GET /campaigns/{id}` | detalhe |
| `GET /campaigns/{id}/contact-report` | resultado contato a contato |
| `POST /campaigns/{id}/end` | encerra |
| `GET/POST /campaigns/{id}/redial-preview` e `/redial` | rediscagem |
| `POST /campaigns/{id}/contacts/claim` e `/release` | reserva de contato (webphone) |
| `GET /campaigns/team` | campanhas do time |
| `GET /agents/usage`, `/agents/metrics`, `/calls` | consumo e histórico |

**Não achei a criação da campanha no pacote.** Para descobrir seria preciso
subir uma planilha de verdade pelo assistente — o que **cria campanha e dispara
ligações reais**, e por isso não foi feito. É a única peça que falta mapear.

### O fluxo da lista, confirmado na tela

O assistente pede nome da campanha e um arquivo `.xlsx/.xls/.csv`, até **10.000
contatos**. Colunas: `Telefone` (obrigatória, com esse título), `Nome`,
`E-mail`, `Empresa` — **mais uma coluna para cada variável dinâmica do agente**.

É exatamente o encaixe que faltava: **as variáveis do agente viram colunas da
lista**, e é por aí que a informação de cada lead entra no roteiro da ligação.

### O desenho que isso viabiliza

1. No ONFACE, selecionar os leads e escolher campanha e agente.
2. O ONFACE monta a lista com uma coluna por variável do agente — nome, empresa,
   produto de interesse, dor registrada na qualificação, origem, último contato.
3. Sobe por `POST /campaigns/{id}/upload`.
4. O agente liga já sabendo com quem fala.
5. O resultado volta pelo webhook de saída, vira ligação, atividade e, quando há
   horário combinado, reunião marcada com closer — o que **já funciona hoje**.

O passo 1 já existe em versão simples (enviar para a campanha funil com o agente
de prospecção). O que falta para a versão completa é escolher campanha/agente e
mandar as variáveis.

---

## 5. O que depende da Callface, não de nós

Estas são perguntas para o time de produto da Callface. Nenhuma se resolve
escrevendo código aqui.

1. **Dá para disparar uma ligação escolhendo agente, roteiro e campanha por
   API?** Hoje o ONFACE manda `{nome, telefone}` para um webhook de entrada e o
   contato cai numa campanha fixa. Quem disca é o "agente de prospecção" único
   da organização. Sem isso, "a Lia manda ligar" é um tiro no escuro.
   *Histórico:* em julho isso foi tentado e **funcionou**, com gravação real de
   28 segundos — automatizando o navegador, porque a variável dinâmica por
   ligação só é alimentada por **upload de planilha** vinculada a um agente.
   Foi pausado por instabilidade. O código está intacto.
2. **Qual o critério de entrega e retry do webhook de ligação?** Em teste real
   de julho, **2 de 3 ligações não geraram evento**. Pergunta aberta até hoje.
3. **Os campos ricos podem vir no webhook?** O painel da Callface calcula
   scorecard de 0 a 100, sentimento, "call qualificada" sim/não, próximos passos
   e **dados coletados** (nome, valor citado, plano, e-mail, quantidade de
   usuários extraídos da fala). **Nenhum deles chega.** Chega só o percentual de
   chance de fechar, em 704 de 7.215.
4. **O botão "Sincronizar com CRM" nativo do painel está em uso?** Se estiver,
   há um segundo caminho de escrita que não enxergamos.

---

## 6. O que dá para construir, por ordem de alavanca

### Agora, só com o que existe

1. **Ligar a ação em massa na tela** (§3.1) — uma linha.
2. **Descobrir por que a ligação em cadência nunca roda** (§3.2) — a peça já
   está publicada; se destravar, ligação vira passo de cadência de verdade.
3. **Consertar caixa postal, órfã e dono** (§4) — higiene que hoje gera 1.478
   notificações inúteis e esconde 861 ligações de leads reais.
4. **Tela de ligações de verdade** — a API já existe e tem listagem geral sem
   consumidor; a peça de exibição já existe e só está montada no drawer do lead.
5. **Métricas de voz** — o dado está no espelho; falta a superfície.

### Quando a Callface responder §5

6. **Dados coletados virando campo do CRM.** O destino já existe:
   `ai_contact_field_proposals`. O agente de voz colhe na fala, o CRM propõe o
   campo, uma pessoa confirma. Hoje a única informação estruturada que o agente
   devolve e o CRM age em cima é o horário da reunião.
7. **Disparo de ligação com agente e roteiro escolhidos**, a partir de: ação em
   massa, passo de cadência, nó de fluxo, ou ferramenta da Lia. Os quatro pontos
   de entrada já existem no código; o que falta é o contrato do outro lado.
8. **Minuto tarifado na ligação**, abrindo cobrança por consumo.

---

## 7. O que precisa entrar na conta antes de desenhar

**O agente de voz custa R$ 0,81 dos R$ 0,97 por minuto** — 84% do custo
variável. Agente de voz é feature de expansão (o add-on de R$ 679), não de
volume. Qualquer desenho de "dispara IA para a base inteira" quebra a margem.

**O PABX é a perna grande:** R$ 374 mil contra R$ 57 mil da Callface AI na
carteira, com dezenas de contratos de 36 meses vencendo — enquanto o
posicionamento manda falar só de Callface AI. Feature de Callface AI atende
hoje a menor das três pernas, que é também a de maior margem e crescimento.

---

## 8. O que este documento NÃO prova

- **Não lemos a API da Callface AI.** O catálogo de capacidades do §5.3 vem de
  um mapa do produto navegado à mão em 11/06/2026 mais notas de versão de
  28/07. Scorecard e dados coletados podem já estar disponíveis e nós só não
  pedimos. Isso se resolve com uma pergunta, não com mais código lido.
- **Nenhuma tela foi aberta no navegador.** O que se diz aqui sobre aparecer ou
  não na interface vem de leitura de código.
- **Não sabemos por que o passo de ligação em cadência nunca executou.**
- **Suposição:** as 3.308 ligações de "Agente Mayra" devem ser o agente de
  prospecção automático da organização, disparado pelo mesmo webhook de entrada
  que o ONFACE usa. Não foi confirmado no painel deles.

---

## 9. O que construir, em ordem de resultado

Levantado navegando a plataforma tela a tela em 21/10. Cada item diz o que
existe lá, o que falta aqui, e de quem depende.

### Faixa 1 — só depende de nós, e o dado já chega

**1.1 Objeção vira motivo de perda, sem ninguém digitar.**
A Callface já classifica a objeção em código normalizado: falta de tempo, sem
interesse declarado, bloqueio técnico, preferência por concorrente, falta de
necessidade. Hoje o CRM pede isso ao vendedor, que esquece ou inventa. A ligação
já respondeu. Mapear direto para o motivo de perda do negócio.

**1.2 Chance de fechar move o pipeline.**
`deal_closure_percentage` já chega no webhook (704 de 7.215 ligações têm). É o
mesmo número que a Callface usa no corte de 50% para "lead qualificado". Serve
de gatilho de etapa, de alerta e de prioridade de fila sem nenhuma extração.

**1.3 Reunião do `scheduling` pela peça única.**
Já funciona para o caso "Combinado" e gerou 40 reuniões. Vale cobrir os outros
status e categorias, sempre pela peça de reunião existente.

### Faixa 2 — só depende de nós, mas precisa buscar o que o webhook não manda

**2.1 Puxar o resto da ligação por API, logo após o webhook.**
O webhook traz 17 campos e deixa de fora justamente os mais valiosos: scorecard
com evidências, dados coletados, qualificação e minuto tarifado. O `call_link`
carrega o id da chamada, e a ficha da ligação no painel prova que o backend tem
tudo estruturado. Um passo a mais no processamento do evento fecha a lacuna sem
depender de mudança do lado deles.

Com isso em mãos abrem-se, de graça:
- **Scorecard no CRM**: ranking de qualidade por vendedor, coaching com a
  evidência e o minuto, e correlação entre nota e negócio ganho.
- **Dados coletados viram campos do lead**: o agente de voz pergunta e o CRM
  preenche. É o formulário por voz.
- **Qualificação como régua de roteamento**: qualificado vira negócio, parcial
  volta para nutrição, inelegível não ocupa ninguém.
- **Minuto tarifado por ligação**, que abre cobrança por consumo.

**2.2 Explicar as 4.432 ligações que faltam.**
O painel conta 11.647 e o CRM tem 7.215. Enquanto isso não for explicado,
qualquer relatório de voz no ONFACE está incompleto sem saber o quanto.

**2.3 Fila de retorno do receptivo.**
A plataforma lista as chamadas abandonadas com número e tempo de espera. Cada
uma é alguém que tentou falar e não conseguiu. Volume hoje é irrisório, mas a
régua existe (abandono abaixo de 5%, atender em menos de 30s).

### Faixa 3 — o agente de voz sabendo com quem fala

**3.1 Personalizar a abertura por lead.**
A primeira mensagem do agente aceita `{{variavel}}`, e a lista da campanha é
quem alimenta: cada variável do agente vira uma coluna da planilha. Hoje o nosso
agente tem uma variável só, `nome`. Com empresa, produto de interesse, dor
registrada na qualificação e origem, a ligação abre com contexto em vez de
script. É o maior ganho de conversão disponível, e custa um mapeamento de
colunas mais `POST /agents/upsert`.

**3.2 Campos de coleta do agente espelhando campos do CRM.**
Cada campo tem nome, tipo e descrição do que capturar. Se espelharem os campos
do negócio, a ligação preenche o cadastro sozinha.

**3.3 Campanha por segmento, não uma fila só.**
Hoje todo contato cai na campanha "Funil" da organização e é atendido pelo único
agente de prospecção. Com `/campaigns/{id}/upload` dá para ter campanha por
produto, por origem ou por safra, cada uma com o seu agente.

**3.4 Rediscagem decidida por regra de negócio.**
`redial-preview` e `redial` são API. A política de tentativas já é configurável
por campanha (quantas, intervalo, e em quais desfechos insistir). Quem decide
quem merece segunda tentativa deveria ser o CRM, que conhece o valor do lead.

### Faixa 4 — depende do time da Callface

- **Webhook de fim de campanha, de tarefa e de qualificação.** Hoje só existe o
  de ligação finalizada; o resto exige varredura.
- **Mais casos de uso no webhook de entrada.** Só existe "criar contato". Faltam
  atualizar, remover da campanha e agendar ligação.
- **Mais de um agente de prospecção por organização**, para rotear lead
  diferente para agente diferente pelo caminho simples.
- **Os campos ricos no payload do webhook**, evitando a busca extra do item 2.1.
- **Edição dos critérios do scorecard**, hoje só leitura na tela.

### Decisões de produto que ficam para o Scott

1. **Tarefas: quem é o dono?** A Callface já gera tarefa com categoria, canal,
   prazo e a citação que a originou. Ou o ONFACE consome (e precisa deduplicar,
   porque vi a mesma repetida quatro vezes), ou desliga lá e gera do próprio
   resumo.
2. **Base de conhecimento: qual é a fonte única?** As nove seções da Base da
   empresa da Callface são, na prática, o discurso comercial da casa. O ONFACE
   tem a sua. Manter as duas diverge.
3. **WhatsApp transcrito pela Callface.** A plataforma captura e analisa conversa
   de WhatsApp com a mesma máquina das ligações. Está desconectado. Ligar
   significaria duas fontes de verdade sobre a mesma conversa.
4. **Cota de minutos de agente.** Hoje em 1.297 de 2.000. Campanha para quando
   acaba, e o aviso só existe lá dentro.
