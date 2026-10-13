export type AgentToolCategory = "contexto" | "comunicacao" | "crm" | "operacao";

/** Identidades internas da plataforma, não agentes configuráveis pelo time. */
export const AGENT_SYSTEM_SLUGS = ["nexo", "hermes"] as const;
export function isSystemAgentSlug(slug: string) {
  return (AGENT_SYSTEM_SLUGS as readonly string[]).includes(slug);
}

export interface AgentToolDefinition {
  id: string;
  nome: string;
  descricao: string;
  categoria: AgentToolCategory;
  modo: "leitura" | "acao";
  disponibilidade: "dry_run" | "live";
}

/**
 * Catálogo único de capacidades dos agentes Callface.
 * Catálogo client-safe. A implementação canônica vive no registry do runtime;
 * todo item listado aqui possui executor real (mutações viram preview no modo
 * de teste e executam somente no modo live).
 */
export const AGENT_TOOL_CATALOG: AgentToolDefinition[] = [
  { id: "context.read_contact", nome: "Consultar pessoa e empresa", descricao: "Lê identidade, empresa, tags e dados disponíveis do contato.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "context.read_conversation", nome: "Consultar conversa", descricao: "Lê o histórico recente e o estado operacional da conversa.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "context.read_crm", nome: "Consultar contexto do CRM", descricao: "Lê lead, oportunidades, serviços e próximas ações vinculadas.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "knowledge.search", nome: "Buscar conhecimento", descricao: "Busca trechos nas fontes publicadas da organização.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "memory.read", nome: "Consultar memória", descricao: "Lê memória e aprendizados ativos da organização.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "response.classify", nome: "Classificar resposta", descricao: "Classifica intenção, interesse e confiança para próximas decisões.", categoria: "comunicacao", modo: "acao", disponibilidade: "live" },
  { id: "message.prepare", nome: "Preparar resposta", descricao: "Define as mensagens finais; o egress usa o ledger e a fila do Callface.", categoria: "comunicacao", modo: "acao", disponibilidade: "live" },
  { id: "handoff.request", nome: "Solicitar atendimento humano", descricao: "Pausa a IA, registra handoff e abre alerta operacional.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "task.create", nome: "Criar tarefa", descricao: "Cria uma próxima ação real para responsável ou administrador.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "lead.update_status", nome: "Atualizar status do lead", descricao: "Atualiza o estado operacional do lead vinculado.", categoria: "crm", modo: "acao", disponibilidade: "live" },
  { id: "lead.qualify", nome: "Qualificar lead", descricao: "Registra empresa, CNPJ, cargo, dor, tomador, fit e próxima ação.", categoria: "crm", modo: "acao", disponibilidade: "live" },
  { id: "deal.advance", nome: "Avançar negócio", descricao: "Move um negócio real para um novo estágio.", categoria: "crm", modo: "acao", disponibilidade: "live" },
  { id: "lead.tag", nome: "Gerenciar tags", descricao: "Adiciona ou remove tags e publica o gatilho para outros fluxos.", categoria: "crm", modo: "acao", disponibilidade: "live" },
  { id: "activity.note", nome: "Registrar nota", descricao: "Salva resumo e contexto na timeline do lead.", categoria: "crm", modo: "acao", disponibilidade: "live" },
  { id: "meeting.schedule", nome: "Agendar reunião", descricao: "Revalida a agenda real (CRM + Outlook), cria o evento, a reunião e a oportunidade, e avisa a closer.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "meeting.reschedule", nome: "Remarcar reunião", descricao: "Remarca uma reunião do lead num horário verificado e atualiza o Outlook.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "meeting.cancel", nome: "Cancelar reunião", descricao: "Cancela uma reunião do lead no CRM e no Outlook.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "agenda.slots", nome: "Consultar horários reais", descricao: "Horários livres da closer definida pela regra comercial (CRM + Outlook).", categoria: "operacao", modo: "leitura", disponibilidade: "live" },
  { id: "memory.remember", nome: "Lembrar um fato", descricao: "Guarda fato sobre pessoa, empresa, conversa ou operação, com fonte e confirmação.", categoria: "contexto", modo: "acao", disponibilidade: "live" },
  { id: "followup.schedule", nome: "Agendar retomada própria", descricao: "O agente combina um retorno e é reacionado no horário com o contexto atualizado. Não usa cadência.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "followup.resume_cancel", nome: "Cancelar retomada própria", descricao: "Cancela uma retomada que o agente tinha combinado.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "callface.call", nome: "Ligar com Callface AI", descricao: "Envia o lead para a fila de discagem da Callface AI.", categoria: "comunicacao", modo: "acao", disponibilidade: "live" },
  { id: "cadence.pause", nome: "Pausar follow-ups", descricao: "Pausa inscrições ativas quando há resposta ou handoff.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "followup.enroll", nome: "Iniciar follow-up", descricao: "Inscreve a entidade em um fluxo publicado.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "followup.cancel", nome: "Cancelar follow-up", descricao: "Cancela uma inscrição da organização com motivo.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "contact.propose_field", nome: "Propor dado do contato", descricao: "Propõe nome, email ou telefone para confirmação humana.", categoria: "crm", modo: "acao", disponibilidade: "live" },
  { id: "case.open", nome: "Abrir caso humano", descricao: "Abre um caso assíncrono para a equipe ajudar o agente.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "skill.activate", nome: "Ativar skill", descricao: "Carrega e registra o uso de uma skill instalada.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "alert.create", nome: "Criar alerta", descricao: "Cria um alerta operacional para a equipe.", categoria: "operacao", modo: "acao", disponibilidade: "live" },
  { id: "budget.read", nome: "Consultar orçamento", descricao: "Consulta limites e consumo mensal da organização.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
];

export const AGENT_EVENT_CATALOG = [
  { id: "conversation.message_received", nome: "Mensagem recebida", descricao: "Quando chega uma nova mensagem de um contato." },
  { id: "LeadCreated", nome: "Lead criado", descricao: "Quando um lead novo é persistido no CRM." },
  { id: "DealCreated", nome: "Oportunidade criada", descricao: "Quando uma nova negociação é criada." },
  { id: "StageChanged", nome: "Etapa alterada", descricao: "Quando Lead, Negócio ou Oportunidade muda de etapa." },
  { id: "TagAdded", nome: "Tag adicionada", descricao: "Quando uma tag é adicionada a uma entidade do CRM." },
  { id: "TagRemoved", nome: "Tag removida", descricao: "Quando uma tag é removida de uma entidade do CRM." },
  { id: "ProposalSent", nome: "Proposta enviada", descricao: "Quando uma proposta é enviada ao cliente." },
  { id: "ProposalAccepted", nome: "Proposta aceita", descricao: "Quando o cliente aceita uma proposta." },
  { id: "ProposalRejected", nome: "Proposta recusada", descricao: "Quando o cliente recusa uma proposta." },
  { id: "DealWon", nome: "Venda ganha", descricao: "Quando a evidência de Won é validada." },
  { id: "PaymentFailed", nome: "Pagamento falhou", descricao: "Quando uma tentativa de cobrança falha." },
  { id: "PaymentCompleted", nome: "Pagamento confirmado", descricao: "Quando um pagamento é confirmado." },
  { id: "ContractSigned", nome: "Contrato assinado", descricao: "Quando o contrato conclui a assinatura." },
  { id: "CanonicalServiceActivated", nome: "Serviço ativado", descricao: "Quando o serviço canônico entra na operação." },
  { id: "prospect.created", nome: "Prospect criado", descricao: "Quando um prospect entra na base outbound." },
  { id: "prospect.response_received", nome: "Prospect respondeu", descricao: "Quando um prospect responde uma abordagem." },
  { id: "lead.atribuido_ao_agente", nome: "Atendimento atribuído ao agente", descricao: "Quando uma automação, regra ou pessoa atribui o atendimento ao agente, inclusive colocando-o como responsável pelo lead, oportunidade ou conversa." },
  { id: "agent.retomada", nome: "Retomada combinada venceu", descricao: "Quando chega o horário de uma retomada que o próprio agente agendou." },
  { id: "cadence.step_due", nome: "Passo de cadência vencido", descricao: "Quando uma etapa de cadência está pronta para executar." },
] as const;

export const AGENT_PURPOSES = [
  { id: "prospeccao", nome: "Prospecção", descricao: "Pesquisa, aborda e classifica prospects dentro das regras outbound." },
  { id: "pre_vendas", nome: "Pré-vendas", descricao: "Qualifica interesse e prepara o handoff comercial." },
  { id: "atendimento", nome: "Atendimento", descricao: "Responde conversas e encaminha exceções para humanos." },
  { id: "financeiro", nome: "Financeiro", descricao: "Apoia recuperação e cobrança sem tomar decisões financeiras sensíveis." },
  { id: "cs", nome: "Customer Success", descricao: "Acompanha sinais e sugere próximas ações para a carteira." },
] as const;

export const AGENT_PRESETS: Record<string, { prompt: string; tools: string[]; events: string[] }> = {
  prospeccao: {
    prompt: "Você é um agente de prospecção da Callface. Analise o contexto disponível, personalize a abordagem sem inventar informações, classifique respostas e encaminhe para uma pessoa quando houver interesse, dúvida sensível ou pedido explícito de atendimento humano.",
    tools: ["context.read_contact", "context.read_conversation", "context.read_crm", "knowledge.search", "response.classify", "message.prepare", "handoff.request", "lead.update_status", "lead.qualify", "lead.tag", "activity.note", "meeting.schedule", "callface.call", "cadence.pause"],
    events: ["prospect.response_received"],
  },
  pre_vendas: {
    prompt: "Você é um agente de pré-vendas da Callface. Qualifique o contexto com clareza, não invente preço ou condição comercial e encaminhe para uma pessoa quando a conversa exigir decisão humana.",
    tools: ["context.read_contact", "context.read_conversation", "context.read_crm", "response.classify", "message.prepare", "handoff.request", "task.create", "lead.update_status", "lead.qualify", "lead.tag", "activity.note", "meeting.schedule", "callface.call", "cadence.pause"],
    events: ["LeadCreated", "conversation.message_received"],
  },
  atendimento: {
    prompt: "Você é um agente de atendimento da Callface. Responda de forma clara usando somente o contexto disponível, respeite os limites configurados e faça handoff sempre que não puder resolver com segurança.",
    tools: ["context.read_contact", "context.read_conversation", "context.read_crm", "message.prepare", "handoff.request", "task.create"],
    events: ["conversation.message_received"],
  },
};

export const DEFAULT_HANDOFF_CONFIG = {
  enabled: true,
  keywords: ["falar com humano", "atendente", "pessoa real"],
  onLowConfidence: true,
  onToolFailure: true,
  confidenceThreshold: 0.65,
};

export const DEFAULT_TRIGGER_CONFIG = {
  events: ["conversation.message_received"],
  filters: { ignoreGroups: true, ignoreSelf: true, keywordRegex: null, businessHours: null },
  concurrency: "one_per_conversation",
};

export function isKnownAgentTool(toolId: string) {
  return AGENT_TOOL_CATALOG.some((tool) => tool.id === toolId);
}

/**
 * NEXO e Hermes foram semeados (migração 0071) com o NOME de modelo da
 * ferramenta (`context_read_crm`) em vez do id do catálogo (`context.read_crm`).
 * O runtime resolve por id, então essas ferramentas eram ignoradas em
 * silêncio, e o schema da versão recusa salvar o nome. A tela converte ao
 * abrir; salvar grava o id certo.
 */
export function normalizarIdFerramenta(id: string): string {
  if (isKnownAgentTool(id)) return id;
  const comPonto = id.replace("_", ".");
  return isKnownAgentTool(comPonto) ? comPonto : id;
}
