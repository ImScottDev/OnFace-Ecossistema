/**
 * Prospecção (CRM2, reconstrução 17/08 a partir de spec+mockups do Kauã) —
 * workspace EXCLUSIVO de outbound, separado de Pré-vendas. Reaproveita o
 * mesmo `Lead` base de `qualificacao/shared.ts` (mesmo endpoint `/api/leads`,
 * mesmos sinais reais) só que com um vocabulário de status PRÓPRIO — os 6
 * operacional próprio. O estado é derivado de sinais reais já persistidos:
 * lista, enrollment de cadência, sdrStatus e oportunidade vinculada. Isso
 * mantém Prospect separado de Pré-vendas sem criar um segundo CRM.
 */
import type { Lead } from "@/components/crm2/qualificacao/shared";

export interface CadenciaInfo {
  enrollmentId: string;
  definitionId: string;
  definitionNome: string;
  status: string; // active | waiting | completed | cancelled | failed
  stepIndex: number; // 1-based, só conta steps tipo="action"
  totalSteps: number; // total de steps tipo="action" na definição
  proximaAcaoEm?: string | null; // scheduledAt real do enrollment, só quando ativo/esperando
}

export interface ProspeccaoLead extends Lead {
  listaId?: string | null;
  listaNome?: string | null;
  cadencia?: CadenciaInfo | null;
  labels?: Array<{ id: string; nome: string; cor: string }>;
}

export interface ProspeccaoStatus {
  key: string;
  label: string;
  color: string;
}

export const PROSPECCAO_STATUS: ProspeccaoStatus[] = [
  { key: "novo", label: "Novo", color: "#64748B" },
  { key: "selecionado", label: "Selecionado", color: "#2563EB" },
  { key: "em_cadencia", label: "Em cadência", color: "#7C3AED" },
  { key: "respondeu", label: "Respondeu", color: "#0EA5E9" },
  { key: "qualificado", label: "Pré-vendas", color: "#16A34A" },
  { key: "sem_resposta", label: "Sem resposta", color: "#8e27ef" },
  { key: "desqualificado", label: "Desqualificado", color: "#dc2626" },
];

const BY_KEY = new Map(PROSPECCAO_STATUS.map((s) => [s.key, s]));

/**
 * Status de Prospecção pro lead, calculado ao VIVO — mesma disciplina do
 * `resolveDisplayStage` de Pré-vendas (nunca lê snapshot de coluna, sempre
 * recalcula dos campos reais). "Qualificado" aqui significa que a
 * oportunidade JÁ foi criada (negocioPrincipal/negocioCount reais). Nesse
 * momento o prospect passa a aparecer na coluna Qualificado de Pré-vendas,
 * preservando origem, lista, cadência e histórico outbound.
 */
export function resolveProspeccaoStatus(lead: Lead & Partial<ProspeccaoLead>): ProspeccaoStatus {
  const s = lead.sdrStatus || "pending";
  if (s === "disqualified") return BY_KEY.get("desqualificado")!;
  if (lead.negocioPrincipal || (lead.negocioCount && lead.negocioCount > 0)) return BY_KEY.get("qualificado")!;
  if (s === "sdr_sem_retorno") return BY_KEY.get("sem_resposta")!;
  if (s === "qualifying") return BY_KEY.get("respondeu")!;
  if (lead.cadencia && ["active", "waiting"].includes(lead.cadencia.status)) return BY_KEY.get("em_cadencia")!;
  if (lead.cadencia?.status === "completed") return BY_KEY.get("sem_resposta")!;
  if (lead.listaId || s === "contacted") return BY_KEY.get("selecionado")!;
  return BY_KEY.get("novo")!;
}

export const BULK_ACTIONS = [
  { key: "atribuir_responsavel", label: "Atribuir responsável" },
  { key: "adicionar_cadencia", label: "Adicionar à cadência" },
  { key: "trocar_lista", label: "Trocar lista" },
  { key: "adicionar_tag", label: "Adicionar tag" },
  { key: "pausar", label: "Pausar" },
  { key: "arquivar", label: "Arquivar" },
] as const;

export type BulkActionKey = (typeof BULK_ACTIONS)[number]["key"];
