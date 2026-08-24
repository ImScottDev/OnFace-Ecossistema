# Benchmark DeskcommCRM x CRM 2.0 Callface

Documento de comparação funcional. O DeskcommCRM é referência de comportamento e arquitetura; não é fonte para copiar entidades ou substituir o modelo canônico do Callface.

## Regra de leitura

- **Já existe:** capacidade funcional presente no Callface, mesmo que possa receber melhoria.
- **Parcial:** existe uma base, mas falta parte importante do comportamento observado no Deskcomm.
- **Gap:** não existe no Callface atual.
- **Não portar literalmente:** capacidade incompatível com o modelo ou estratégia do Callface.

## Matriz

| Capacidade do Deskcomm | Estado no Callface | Evidência atual | Gap real / próximo passo |
|---|---|---|---|
| Inbox com conversas e mensagens | Já existe | `src/components/crm2/atendimento/Workspace.tsx`, `whatsappMensagens`, rotas de WhatsApp, e-mail e ligações | Melhorar sobre a base atual; não reconstruir Inbox nem mensagens |
| Vínculo conversa → Pessoa/Lead/Empresa | Parcial | Atendimento resolve `leadId` e contexto do lead; mensagens têm `contatoId` e `leadId` | Garantir resolução consistente de Pessoa, Lead e Empresa em todas as conversas e na Timeline |
| Fila geral | Já existe | `Cf2ConversationList` com visão `todas` | Manter |
| Minhas conversas | Já existe | `view=meus` | Manter e validar atribuição por conversa |
| Não atribuídas | Já existe | `view=nao_atribuidos` | Manter |
| Fechadas | Parcial | `contatos.status` agora persiste `open/closed` e a visão `fechadas` já filtra o Inbox | Ligar contagem dedicada e Timeline visual; sem criar tabela de conversa |
| Conversas sob responsabilidade da IA | Parcial | `handoffStatus` e AI SDR já existem; a visão `ia` filtra estado real `ai_handling` | Conectar ao dispatcher de múltiplos agentes depois do runtime versionado |
| Assumir conversa | Parcial | `AtribuirModal` e endpoint de atribuição continuam; ação publica `ConversationClaimed` na outbox | Adicionar conflito otimista e fila de responsável na UI |
| Transferir conversa | Parcial | Atribuição para outro usuário e ação explícita publicam `ConversationTransferred` | Expor destino/fila com contexto e permissões mais granulares |
| Devolver para fila | Parcial | Ação `release` limpa responsável e publica evento | Mostrar histórico de responsáveis na Timeline |
| Snooze de conversa | Parcial | `snoozedUntil`, ação operacional e filtro de conversas adiadas já persistem | Criar seletor de prazos e sweep/reativação observável |
| Templates compartilhados | Já existe | `whatsappTemplates`, rotas `/whatsapp/templates` e `WhatsappTemplatesModal` | Reutilizar entidade atual |
| Atalho `/` para template | Parcial | Template é escolhido por modal; não há confirmação de resolução slash no composer atual | Adicionar comando `/`, variáveis permitidas e preview sem alterar o envio existente |
| Variáveis em templates | Parcial | Templates têm conteúdo e envio por `templateId`; substituição contextual não está fechada como no Deskcomm | Definir whitelist de variáveis reais de Pessoa/Empresa/Lead/Oportunidade |
| Tags no contato/lead | Parcial | Há tags/labels em partes do CRM e tags de empresa no Cliente 360 | Consolidar vocabulário sem criar segunda entidade de contato |
| Tags na conversa | Gap | Não há tabela/rota equivalente para tag de atendimento | Adicionar vínculo de tags à conversa, separado de tags comerciais, com evento |
| Filtro do Inbox por tag | Gap | Lista atual filtra canal/visão/busca | Adicionar filtro usando tags da conversa e escopo da organização |
| Automação por novo lead/status/negócio | Já existe | `automacoes`, `automacao-engine.ts`, chamadas em leads/negócios | Preservar motor atual e ampliar somente os gatilhos necessários |
| Automação por mensagem recebida | Já existe | Gatilho `whatsapp_recebido` no motor e no worker | Validar idempotência e evitar disparo duplicado por webhook/retry |
| Automação por tag | Gap | Motor atual não tem gatilho específico de tag | Adicionar evento de tag em Lead/Pessoa/conversa e ações reutilizáveis |
| Ações de automação | Parcial | Criar tarefa, notificar, alterar status, atribuir, e-mail e WhatsApp já existem | Adicionar transferir/devolver/snooze somente após modelar estado da conversa |
| Histórico de execuções | Já existe | `automacaoExecucoes`, rota de execuções | Evoluir para resultado por ação e idempotency key |
| Event log/outbox | Já existe fundação | Event outbox no schema e worker Redis | Usar a outbox como ponte das automações, sem criar outro barramento |
| Cadências/follow-up de leads | Já existe | `cadenceDefinitions`, `cadenceEnrollments`, `cadenceEnrollmentEvents` e páginas de cadência | Reaproveitar engine |
| Follow-up visual por fluxo com ramificações | Parcial | Cadência já tem steps, condições e ações; UI/fluxo ainda não equivale ao builder do Deskcomm | Evoluir o editor sobre `cadenceDefinitions`, sem nova tabela paralela |
| Lembrete humano ligado à conversa | Parcial | Tarefas e lembretes existem, mas não estão modelados como estado da conversa | Criar vínculo explícito conversa → tarefa/lembrete |
| Agente configurável | Parcial | Existe AI SDR configurável em `/automacoes/agentes` e configuração legada | Expandir catálogo sem duplicar a configuração do AI SDR |
| Múltiplos agentes por organização | Gap | Catálogo atual reconhece apenas AI SDR real | Criar modelo de agentes/versionamento quando a decisão de IA for aprovada |
| Versionamento/publicação de agente | Parcial | AI SDR possui configuração e histórico limitado; não equivale ao ciclo draft/publicado do Deskcomm | Definir draft, teste, publicação, rollback e responsável |
| Handoff IA → humano | Já existe base | Worker registra transferência e `handoffStatus` aparece no Atendimento | Expor claim/transfer/devolver de forma consistente |
| Execução/log/custo de agente | Parcial | Worker e registros do AI SDR existem | Consolidar execução, erro, consumo e limite por organização |
| Conhecimento/memória do agente | Parcial | Há configuração de estilo e contexto no AI SDR; integração Callface AI está pendente | Não fabricar RAG; definir fonte e governança antes de portar |
| Roteadores por intenção/número | Gap | Não há módulo equivalente no CRM2 | Implementar depois do modelo de agentes e canais, vinculado a sessões reais |
| Webhooks específicos existentes | Já existe | Site, RD, Meta, Stripe, Callface, Apollo e WhatsApp | Manter integrações atuais |
| Webhook intake genérico configurável | Parcial | Há endpoints específicos; não há fonte configurável com field map/pipeline/etapa | Criar `webhook source` genérico apenas se o vínculo Lead/Pessoa/Empresa e idempotência estiverem definidos |
| Webhook de saída em automação | Gap | Automação atual não possui ação genérica para sistema externo | Adicionar depois do event log e secrets por organização |
| RBAC e escopo organizacional | Já existe | `getCtx`, usuários por organização e filtros no backend | Toda nova função deve manter o padrão atual |
| Auditoria de ações de atendimento | Parcial | Atividades/notificações existem | Registrar claim, transfer, release, snooze, IA e automação na Timeline |

## Ordem de implementação

### Fase 1: melhorar o Atendimento existente

1. ~~Fila fechadas e fila IA.~~ Estado e filtros persistidos; falta acabamento de contagem/dispatcher.
2. ~~Assumir, transferir e devolver conversa.~~ Ações e auditoria na outbox; falta histórico visual.
3. ~~Snooze/lembrete vinculado à conversa.~~ Estado persistido; falta sweep/UX de prazo.
4. Tags de conversa e filtro por tag.
5. Templates com `/` e variáveis reais.

### Fase 2: ampliar o motor atual

1. Eventos de tags, claim, transfer e snooze.
2. Idempotência por evento e ação.
3. Ações de automação de atendimento.
4. Execução detalhada e Timeline.
5. Follow-up visual sobre o engine de cadência existente.

### Fase 3: agentes e integrações

1. Modelo de agente configurável e versionado.
2. Publicação, teste, handoff e limites de custo.
3. Roteadores por intenção/número.
4. Webhook intake genérico e webhook de saída.

## Critério de pronto

Uma capacidade só será considerada portada quando o fluxo funcionar ponta a ponta no Callface: UI atualizada, persistência no banco, vínculo com as entidades canônicas, execução real, retry/idempotência, permissão e registro na Timeline. Não basta existir uma tela de configuração.
