// ─── PIPELINE CONFIG TYPES ────────────────────────────────
export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  slaHours?: number;
}

export interface Pipeline {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  stages: PipelineStage[];
  closedStages: PipelineStage[];
  isDefault: boolean;
  ativo: boolean;
}

export interface PipelineConfig {
  stages: PipelineStage[];          // pipeline stages (e.g. novo → contatado → proposta)
  closedStages: PipelineStage[];    // won/lost/active stages (always appended)
  lossReasons: { key: string; label: string }[];
  setores: { key: string; label: string }[];
  origens: { key: string; label: string }[];
  servicos: { key: string; label: string }[];
}

// ─── DEFAULT PIPELINE STAGES ──────────────────────────────
// Fluxo Callface (decisão Scott 12/jun): a qualificação acontece no board
// Pré-vendas (SDR). O negócio nasce no pipeline do closer JÁ com reunião
// agendada — por isso não existem stages de Qualificação/Contato Feito aqui.
// Keys proposta_apresentada/negociacao_iniciada mantidas por compat de dados;
// só o label mudou (Proposta Enviada / Negociação).
// Funil Callface.ai (decisão Scott 22/jun): vai até Negociação. Trial (teste 7 dias)
// é coluna central do funil de SaaS. "Em Fechamento" removido (era resquício PABX).
export const DEFAULT_STAGES: PipelineStage[] = [
  { key: "reuniao_agendada", label: "Reunião Agendada", color: "#3B82F6", slaHours: 48 },
  { key: "reuniao_realizada", label: "Reunião Realizada", color: "#06B6D4", slaHours: 72 },
  { key: "trial", label: "Trial", color: "#14B8A6", slaHours: 168 },
  { key: "proposta_apresentada", label: "Proposta Enviada", color: "#A855F7", slaHours: 72 },
  { key: "negociacao_iniciada", label: "Negociação", color: "#EC4899", slaHours: 168 },
];

export const DEFAULT_CLOSED_STAGES: PipelineStage[] = [
  { key: "ganho", label: "Ganho", color: "#22C55E" },
  { key: "perdido", label: "Perdido", color: "#EF4444" },
  // No-show: cliente não apareceu na reunião. O negócio fica registrado aqui e o
  // lead volta pro board SDR (qualifying). Quando a SDR reagenda, volta a reuniao_agendada.
  { key: "no_show", label: "No-show", color: "#F97316" },
];

// ─── STAGNATION REASONS (for Estagnados view) ────────────
export const STAGNATION_REASONS = [
  { key: "sem_retorno", label: "Sem Retorno de Contato", color: "#8e27ef" },
  { key: "trava_negociacao", label: "Trava na Negociação", color: "#EAB308" },
  { key: "trava_assinatura", label: "Trava na Assinatura do Contrato", color: "#EAB308" },
  { key: "outra_data", label: "Quer Negociar em Outra Data", color: "#8B5CF6" },
] as const;

export const DEFAULT_LOSS_REASONS = [
  { key: "preco_alto", label: "Preço alto" },
  { key: "escolheu_concorrente", label: "Escolheu concorrente" },
  { key: "sem_budget", label: "Sem orçamento" },
  { key: "vai_internalizar", label: "Vai internalizar" },
  { key: "nao_respondeu", label: "Não respondeu" },
  { key: "fora_perfil", label: "Fora do perfil" },
  { key: "outro", label: "Outro" },
];

export const DEFAULT_SETORES = [
  { key: "imobiliario", label: "Imobiliário" },
  { key: "saude", label: "Saúde / Clínicas" },
  { key: "juridico", label: "Jurídico" },
  { key: "educacao", label: "Educação / Cursos" },
  { key: "varejo", label: "Varejo / E-commerce" },
  { key: "consultoria", label: "Consultoria" },
  { key: "tecnologia", label: "Tecnologia / SaaS" },
  { key: "financeiro", label: "Financeiro" },
  { key: "automotivo", label: "Automotivo" },
  { key: "logistica", label: "Logística" },
  { key: "outro", label: "Outro" },
];

export const DEFAULT_SERVICOS = [
  { key: "discador", label: "Discador IA" },
  { key: "crm", label: "CRM de Vendas" },
  { key: "ai_sdr", label: "AI SDR" },
  { key: "voip", label: "VoIP / Telefonia" },
  { key: "whatsapp", label: "WhatsApp Business" },
];

export const DEFAULT_ORIGENS = [
  { key: "google_ads", label: "Google Ads" },
  { key: "meta_ads", label: "Meta Ads" },
  { key: "organico", label: "Orgânico" },
  { key: "indicacao", label: "Indicação" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "evento", label: "Evento" },
  { key: "site_institucional", label: "Site Institucional" },
  { key: "direto", label: "Direto" },
];

// ─── BUILD CONFIG FROM DB (or defaults) ───────────────────
export function buildPipelineConfig(dbConfig: Partial<PipelineConfig> | null | undefined): PipelineConfig {
  return {
    stages: dbConfig?.stages?.length ? dbConfig.stages : DEFAULT_STAGES,
    closedStages: dbConfig?.closedStages?.length ? dbConfig.closedStages : DEFAULT_CLOSED_STAGES,
    lossReasons: dbConfig?.lossReasons?.length ? dbConfig.lossReasons : DEFAULT_LOSS_REASONS,
    setores: dbConfig?.setores?.length ? dbConfig.setores : DEFAULT_SETORES,
    origens: dbConfig?.origens?.length ? dbConfig.origens : DEFAULT_ORIGENS,
    servicos: dbConfig?.servicos?.length ? dbConfig.servicos : DEFAULT_SERVICOS,
  };
}

// ─── HELPERS (work with any config) ───────────────────────
export function getAllStatuses(config: PipelineConfig): PipelineStage[] {
  return [...config.stages, ...config.closedStages];
}

export function getStatusInfo(status: string, config: PipelineConfig): PipelineStage {
  const all = getAllStatuses(config);
  return all.find((s) => s.key === status) || { key: status, label: status, color: "#6B7280" };
}

export function getSlaHours(config: PipelineConfig): Record<string, number> {
  const sla: Record<string, number> = {};
  for (const stage of config.stages) {
    if (stage.slaHours) sla[stage.key] = stage.slaHours;
  }
  return sla;
}

// ─── BACKWARD COMPAT (static defaults) ───────────────────
// These are used by code that doesn't have access to org config yet.
// Prefer using the dynamic config via usePipelineConfig() or buildPipelineConfig().
export const NEGOCIO_STAGES = DEFAULT_STAGES;
export const ALL_NEGOCIO_STATUSES = [...DEFAULT_STAGES, ...DEFAULT_CLOSED_STAGES];
export const PIPELINE_STAGES = DEFAULT_STAGES;
export const ALL_STATUSES = ALL_NEGOCIO_STATUSES;
export type NegocioStatus = string;
export type LeadStatus = string;
export const getNegocioStatusInfo = (status: string) => getStatusInfo(status, buildPipelineConfig(null));
export const getContatoTipoInfo = (tipo: string) => CONTATO_TIPOS.find((t) => t.key === tipo) || { key: tipo, label: tipo, color: "#6B7280" };

export const LOSS_REASONS = DEFAULT_LOSS_REASONS;
export const SLA_HOURS = getSlaHours(buildPipelineConfig(null));
export const SETORES = DEFAULT_SETORES;
export const SERVICOS = DEFAULT_SERVICOS;
export const ORIGENS = DEFAULT_ORIGENS;

// ─── NEGOCIO ORIGENS (filter) ────────────────────────────
export const NEGOCIO_ORIGENS = [
  { key: "todos", label: "Todos" },
  { key: "novo", label: "Novos" },
  { key: "carteira", label: "Carteira" },
] as const;

// ─── LEAD TYPES ──────────────────────────────────────────
export const CONTATO_TIPOS = [
  { key: "lead", label: "Lead", color: "#3B82F6" },
  { key: "contato", label: "Contato", color: "#8B5CF6" },
  { key: "cliente", label: "Cliente", color: "#10B981" },
] as const;

export type ContatoTipo = (typeof CONTATO_TIPOS)[number]["key"];

// ─── PRÉ-VENDAS / SDR STAGES ─────────────────────────────
// O board Pré-vendas opera sobre LEADS (campo `sdr_status`), NÃO sobre negócios.
// A SDR qualifica aqui; a oportunidade (negócio) só nasce ao "Converter em
// oportunidade", quando o lead passa pro board Novos Negócios.
// Ordem dos boards: Pré-vendas → Novos → Carteira → Estagnados.
// Colunas abertas do funil de pré-vendas
export const SDR_STAGES: PipelineStage[] = [
  { key: "pending", label: "Novo", color: "#3B82F6", slaHours: 1 },
  { key: "contacted", label: "Em Contato", color: "#EAB308", slaHours: 24 },
  { key: "qualifying", label: "Follow up", color: "#8e27ef", slaHours: 48 },
];

// Coluna de ENTRADA colapsada (à esquerda, antes de "Novo"): leads que vieram do
// OUTBOUND (origem='outbound') e ainda não foram trabalhados. Ficam separados do
// funil inbound pra não poluir a visão "Novo" das meninas. Ao serem movidos pra
// "Em Contato", entram no funil normal. É uma coluna DERIVADA (não é sdr_status).
export const SDR_OUTBOUND_STAGE: PipelineStage = {
  key: "outbound",
  label: "Outbound",
  color: "#0EA5E9",
};

// Um lead cai na coluna Outbound se veio do outbound E ainda está intocado (Novo).
export function isOutboundLead(origem?: string | null): boolean {
  return (origem || "").trim().toLowerCase() === "outbound";
}

// Horas em "Em Contato" antes de escalar automaticamente pra "Follow up" (Jenifer assume).
// 48h = 2 dias (decisão Kauã, 10/07: janela de qualificação do Agente SDR antes do handoff humano).
export const SDR_CONTATO_ESCALATION_HOURS = 48;

// Colunas de ESPELHO (colapsadas à direita): refletem o avanço do lead no
// Pipeline do CLOSER. São derivadas do status do negócio vinculado (read-only
// pra SDR) — ela acompanha o que o closer fez sem precisar abrir o outro board.
export const SDR_MIRROR_STAGES: PipelineStage[] = [
  { key: "m_qualified", label: "Qualificado", color: "#22C55E" },
  { key: "m_reuniao", label: "Reunião Realizada", color: "#06B6D4" },
  { key: "m_convertido", label: "Cliente Convertido", color: "#c8ff00" },
];

// Coluna fechada manual (a SDR desqualifica)
export const SDR_CLOSED_STAGES: PipelineStage[] = [
  { key: "disqualified", label: "Desqualificado", color: "#EF4444" },
];

// Mapeia o status do NEGÓCIO (pipeline do closer) → coluna de espelho do SDR
const SDR_REUNIAO_PLUS = [
  "reuniao_realizada",
  "trial",
  "proposta_apresentada",
  "negociacao_iniciada",
];
export function negocioStatusToSdrMirror(negocioStatus: string): string {
  if (negocioStatus === "ganho") return "m_convertido";
  if (negocioStatus === "perdido") return "disqualified";
  if (SDR_REUNIAO_PLUS.includes(negocioStatus)) return "m_reuniao";
  return "m_qualified"; // reuniao_agendada (e legados novo/qualificacao/contato_feito)
}

export const SDR_MIRROR_KEYS = SDR_MIRROR_STAGES.map((s) => s.key);

// Estagnados de pré-vendas (mesma pegada da view Estagnados do Pipeline)
export const SDR_STAGNATION_STAGES: PipelineStage[] = [
  { key: "sdr_sem_retorno", label: "Sem Retorno de Contato", color: "#8e27ef" },
  { key: "sdr_sem_interesse", label: "Sem Interesse no Momento", color: "#EAB308" },
  { key: "sdr_retomar_depois", label: "Retomar em Outra Data", color: "#8B5CF6" },
];

export const ALL_SDR_STATUSES = [
  SDR_OUTBOUND_STAGE,
  ...SDR_STAGES,
  ...SDR_MIRROR_STAGES,
  ...SDR_CLOSED_STAGES,
  ...SDR_STAGNATION_STAGES,
];

export const SDR_STAGNATION_KEYS = SDR_STAGNATION_STAGES.map((s) => s.key);

export function getSdrStatusInfo(status: string): PipelineStage {
  return (
    ALL_SDR_STATUSES.find((s) => s.key === status) || {
      key: status,
      label: status,
      color: "#6B7280",
    }
  );
}

export const SDR_SLA_HOURS: Record<string, number> = getSlaHours({
  stages: SDR_STAGES,
} as PipelineConfig);
