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
