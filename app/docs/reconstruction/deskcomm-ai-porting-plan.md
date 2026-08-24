# Plano de paridade Deskcomm: IA, follow-up, roteadores e automacoes

Este documento define como levar para o CRM 2.0 da Callface as capacidades operacionais observadas no DeskcommCRM. O Deskcomm e referencia de comportamento e arquitetura, nao substitui o modelo de dados do Callface.

## Objetivo

Entregar paridade funcional com:

- Inbox operacional com filas, tags, claim, transferencia, devolucao, snooze e templates com `/`;
- agentes de IA configuraveis, versionados, testaveis e auditaveis;
- follow-ups persistidos com fluxo, pausa, retomada, snooze e cancelamento;
- roteamento por canal, intencao e prioridade;
- automacoes orientadas a eventos;
- webhooks de entrada e saida configuraveis;
- conhecimento, memoria, ferramentas, handoff e custos governados.

Paridade significa funcionar no Callface, com dados reais, permissao, persistencia, retry/idempotencia e Timeline. Copiar telas ou nomes de tabelas nao e paridade.

## Invariantes do Callface

1. Atendimento continua sendo o Inbox canonico. Nao criar outro Inbox.
2. Conversas e mensagens continuam vinculadas a Pessoa/Lead e Empresa quando houver fonte real.
3. Lead, Empresa, Pessoa, Negocio, Contrato, Billing, Service, Fulfillment, Activity e Timeline continuam sendo as entidades canonicas.
4. Follow-up deve reutilizar o motor de cadencias existente (`cadenceDefinitions`, `cadenceEnrollments`, `cadenceEnrollmentEvents`), evoluindo-o quando necessario. Nao criar um segundo motor.
5. Automacoes devem usar a fundacao de event outbox existente e registrar execucao. Nao adicionar um barramento paralelo.
6. O agente nunca pode alterar preco, contrato, pagamento, permissao ou dado historico sem regra explicita e auditoria.
7. Sem chave, permissao ou fonte de conhecimento disponivel, a UI deve mostrar estado vazio ou indisponivel. Nunca simular resposta de IA.

## Estado atual e alvo

| Dominio | Base atual no Callface | Alvo funcional | Risco principal |
|---|---|---|---|
| Inbox | Conversas, mensagens, filas basicas e handoff ja existem | Fila, Minhas, Todas, Fechadas e IA; claim, transfer, release, snooze, tags e templates slash | Duplicar conversa ou perder responsavel atual |
| Templates | `whatsappTemplates` e modal de templates existem | Biblioteca compartilhada, `/nome`, variaveis whitelist e preview | Substituicao de variavel com dado errado |
| Automacoes | Gatilhos e acoes reais em `automacao-engine.ts` | Evento, condicao, acao, execucao detalhada e idempotencia | Disparo duplicado por webhook/retry |
| Follow-up | Engine de cadencia com wait/action, branches, retry e worker | Builder visual, versoes, enrollments e fila operacional equivalentes ao Deskcomm | Criar fluxo paralelo ou duplicar enrollment |
| Agentes | Um AI SDR configuravel, tool-use, handoff e logs basicos | Multiplos agentes, versoes draft/publicada, teste, runs, custo, ferramentas e governanca | Custo, loop, prompt inseguro e envio indevido |
| Roteadores | Nao existe modulo equivalente | Escolher agente/fila por canal, numero, intencao e prioridade | Dois agentes responderem a mesma mensagem |
| Webhooks | Integracoes especificas existem | Fontes configuraveis, field map, idempotencia e acoes de saida | Entrada nao confiavel ou criacao duplicada |
| Conhecimento | Contexto, estilo e base textual parcial no AI SDR | Fontes, versoes, indexacao, memoria e escopo por agente | RAG sem fonte aprovada ou vazamento entre empresas |

## Modelo de agentes

O AI SDR atual deve ser tratado como adaptador legado durante a migracao. O alvo e um catalogo de agentes por organizacao, com:

- agente: identidade, finalidade, prioridade, estado e vinculos de canal;
- versao: prompt, modelo, provedor, ferramentas, conhecimento, limites e configuracao de handoff;
- ciclo: rascunho, teste, publicada, pausada, arquivada e supersedida;
- run: conversa, mensagem de origem, agente escolhido, passos, ferramentas, tokens, custo, resultado e erro;
- binding: canal/sessao e escopo permitido;
- governanca: usuario que publicou, data, aprovacao, limite mensal e permissao.

Uma mensagem recebida deve passar por um dispatcher deterministico que escolhe no maximo um agente. O agente pode responder, executar ferramenta autorizada ou transferir para humano. O dispatcher deve respeitar prioridade, concorrencia, rate limit e estado da conversa.

### Limites obrigatorios do runtime

- modo teste sem envio externo;
- limite de passos, tokens, custo por execucao e custo mensal por organizacao;
- timeout, retry controlado e chave de idempotencia;
- bloqueio de resposta duplicada por mensagem de origem;
- handoff deterministico por regra e por ferramenta;
- trace interno sem expor segredo, prompt privado ou credencial;
- credenciais externas criptografadas e nunca gravadas em texto puro.

O runtime novo deve ter um adaptador para a configuracao atual do AI SDR. A troca so acontece depois de validar runs reais em modo teste e depois publicar uma versao explicitamente.

## Follow-up

O modelo alvo do Deskcomm sera traduzido para as cadencias existentes:

- definicao: trigger, nos, condicoes, acoes e versao;
- pointer: versao ativa publicada;
- enrollment: Pessoa/Lead/conversa, responsavel, status e proximo vencimento;
- evento: cada transicao, tentativa, promessa, erro, pausa, retomada, snooze e cancelamento;
- fila: worker busca itens vencidos e executa com idempotencia.

Nos minimos: Trigger, Wait, Condition, Classify, Action e End. Acoes devem chamar os adaptadores ja existentes de mensagem, tarefa, atribuicao, status e webhook. Um follow-up de IA pode gerar rascunho para aprovacao humana; envio autonomo depende da politica do agente e do canal.

Eventos de conversa nova, resposta recebida, silencio, mudanca de etapa, tag, claim, transferencia, release e fechamento podem iniciar ou cancelar enrollments. O vinculo deve apontar para Lead/Pessoa/Empresa e aparecer na Timeline.

## Roteadores

Roteador e configuracao operacional, nao texto dentro do prompt. Deve possuir:

- canal e sessao de origem;
- ordem de membros, que podem ser agentes, fila ou humano;
- intencoes e filtros reais;
- fallback explicito;
- historico da decisao, motivo e membro escolhido;
- endpoint de simulacao sem envio.

O roteador deve executar antes do agente. Uma decisao e persistida antes do processamento da mensagem, permitindo auditoria e reprocessamento sem dupla resposta.

## Automacoes e webhooks

As automacoes atuais serao ampliadas para um contrato de evento:

1. Evento normalizado entra na outbox com `eventId` e chave de deduplicacao.
2. Regras elegiveis avaliam filtros no worker.
3. Cada acao registra tentativa, resultado, erro e retry.
4. Acoes que afetam atendimento geram Activity/Timeline.
5. Falha de uma acao nao apaga o evento nem marca as demais como concluidas sem evidencia.

Gatilhos novos: tag adicionada/removida, claim, transferencia, release, snooze, mensagem sem resposta, enrollment vencido, agente transferido e webhook recebido.

Uma fonte de webhook configuravel deve definir segredo, evento, field map, pipeline/etapa default, politica de deduplicacao e destino canonico. O processamento deve criar ou atualizar Lead/Pessoa/Empresa por chaves reais; nunca criar um contato paralelo so porque veio de um webhook.

## Ordem de entrega

### Bloco 0: contratos e seguranca

- congelar o contrato de eventos, permissao, tenant e idempotencia;
- mapear os pontos reais de escrita do Atendimento, cadencia, automacao e AI SDR;
- definir provedor, credenciais e limites do runtime de IA;
- manter o AI SDR atual operando como fallback.

### Bloco 1: Atendimento operacional

- Fechadas e IA;
- claim, transferencia e devolver para fila;
- snooze e lembrete ligado a conversa;
- tags de conversa e filtro;
- templates com `/` e variaveis reais.

### Bloco 2: Follow-up sobre o motor existente

- versoes e publicacao de cadencia; (em implementacao: `draftSteps` separado de `steps` publicados)
- builder visual dos nos;
- fila de enrollments, pausa, retomada, cancelamento, skip e snooze;
- acoes IA com modo rascunho/aprovacao;
- Timeline e execucao detalhada.

### Bloco 3: Agentes configuraveis

- catalogo de agentes;
- draft/publicacao/rollback;
- Teste sem envio;
- runs, trace, ferramentas, handoff e custo;
- migracao do AI SDR atual para um agente do catalogo.

### Bloco 4: Dispatcher e roteadores

- prioridade e concorrencia;
- membros por canal/intencao;
- fallback humano/fila;
- historico de decisoes e simulacao.

### Bloco 5: Webhooks e automacao expandida

- fontes inbound configuraveis;
- field map e deduplicacao;
- regras por eventos;
- webhook outbound com secrets e retry;
- painel de execucoes e reenvio.

### Bloco 6: Conhecimento e governanca

- fontes e versoes de conhecimento;
- memoria por escopo permitido;
- skills/ferramentas autorizadas;
- propostas de melhoria sem autopublicacao;
- orcamento, auditoria e relatorios de uso.

## Criterio de aceite por bloco

Um bloco so sera fechado quando houver:

- tela operacional e estado de carregamento/erro/vazio;
- persistencia versionada e migration aplicavel;
- vinculo com entidades canonicas do Callface;
- execucao real em ambiente local com dado controlado;
- idempotencia e retry testados;
- permissao e escopo organizacional testados;
- Activity/Timeline para acoes relevantes;
- teste de regressao do Atendimento e `tsc` sem erro novo.

## Decisoes que precisam ser registradas antes do runtime de IA

- provedor(es) permitido(s), modelo default e politica de BYO key;
- quem pode criar, testar, publicar, pausar e ver custo de agente;
- se mensagens WhatsApp podem ser enviadas autonomamente ou exigem aprovacao;
- limite financeiro mensal por organizacao e por agente;
- fontes autorizadas para conhecimento e memoria;
- politica de retenção de prompts, traces e dados pessoais.

Essas decisoes afetam permissao, custo e dados de clientes. Devem ser registradas em `crm2-decisoes-pendentes.md` antes de habilitar envio autonomo em producao.
