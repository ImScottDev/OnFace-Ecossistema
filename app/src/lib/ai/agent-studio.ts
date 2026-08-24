export type AgentToolCategory = "contexto" | "comunicacao" | "crm" | "operacao";

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
 * `dry_run` significa que a capacidade pode ser selecionada e auditada, mas o
 * dispatcher ainda não pode executá-la no mundo externo. Isso evita uma UI que
 * promete automações que o runtime ainda não entrega.
 */
export const AGENT_TOOL_CATALOG: AgentToolDefinition[] = [
  { id: "context.read_contact", nome: "Consultar pessoa e empresa", descricao: "Lê identidade, empresa, tags e dados disponíveis do contato.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "context.read_conversation", nome: "Consultar conversa", descricao: "Lê o histórico recente e o estado operacional da conversa.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "context.read_crm", nome: "Consultar contexto do CRM", descricao: "Lê lead, oportunidades, serviços e próximas ações vinculadas.", categoria: "contexto", modo: "leitura", disponibilidade: "live" },
  { id: "response.classify", nome: "Classificar resposta", descricao: "Classifica intenção, interesse e necessidade de intervenção humana.", categoria: "comunicacao", modo: "acao", disponibilidade: "dry_run" },
  { id: "message.prepare", nome: "Preparar resposta", descricao: "Gera uma sugestão de resposta sem enviá-la automaticamente.", categoria: "comunicacao", modo: "acao", disponibilidade: "dry_run" },
  { id: "handoff.request", nome: "Solicitar atendimento humano", descricao: "Pausa a IA e encaminha a conversa para uma pessoa.", categoria: "operacao", modo: "acao", disponibilidade: "dry_run" },
  { id: "task.create", nome: "Criar tarefa", descricao: "Cria uma próxima ação para o responsável no CRM.", categoria: "operacao", modo: "acao", disponibilidade: "dry_run" },
  { id: "prospect.update_status", nome: "Atualizar prospect", descricao: "Atualiza o estado operacional de um prospect.", categoria: "crm", modo: "acao", disponibilidade: "dry_run" },
  { id: "prospect.qualify", nome: "Enviar para Pré-vendas", descricao: "Converte um prospect qualificado preservando origem e histórico.", categoria: "crm", modo: "acao", disponibilidade: "dry_run" },
  { id: "cadence.pause", nome: "Pausar cadência", descricao: "Interrompe a cadência ativa quando há resposta ou handoff.", categoria: "operacao", modo: "acao", disponibilidade: "dry_run" },
];

export const AGENT_EVENT_CATALOG = [
  { id: "conversation.message_received", nome: "Mensagem recebida", descricao: "Quando chega uma nova mensagem de um contato." },
  { id: "prospect.created", nome: "Prospect criado", descricao: "Quando um prospect entra na base outbound." },
  { id: "prospect.response_received", nome: "Prospect respondeu", descricao: "Quando um prospect responde uma abordagem." },
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
    tools: ["context.read_contact", "context.read_conversation", "context.read_crm", "response.classify", "message.prepare", "handoff.request", "prospect.update_status", "prospect.qualify", "cadence.pause"],
    events: ["prospect.response_received"],
  },
  pre_vendas: {
    prompt: "Você é um agente de pré-vendas da Callface. Qualifique o contexto com clareza, não invente preço ou condição comercial e encaminhe para uma pessoa quando a conversa exigir decisão humana.",
    tools: ["context.read_contact", "context.read_conversation", "context.read_crm", "response.classify", "message.prepare", "handoff.request", "task.create"],
    events: ["conversation.message_received"],
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
