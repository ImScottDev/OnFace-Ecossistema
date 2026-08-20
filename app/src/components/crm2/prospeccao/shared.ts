/**
 * Prospecção (CRM2, reconstrução 17/08 a partir de spec+mockups do Kauã) —
 * workspace EXCLUSIVO de outbound, separado de Pré-vendas. Reaproveita o
 * mesmo `Lead` base de `qualificacao/shared.ts` (mesmo endpoint `/api/leads`,
 * mesmos sinais reais) só que com um vocabulário de status PRÓPRIO — os 6
 * do spec (Novo/Em prospecção/Respondeu/Qualificado/Sem resposta/
 * Desqualificado), todos derivados de campos que já existem hoje
 * (`sdrStatus`, negócio vinculado). Nenhum literal novo foi criado: dado
 * real da org Callface (17/08) mostra só pending/contacted/disqualified
 * entre os 78 leads outbound — "Respondeu" e "Sem resposta" reaproveitam
 * `qualifying`/`sdr_sem_retorno`, os mesmos já usados no board de
 * Pré-vendas, e ficam vazios até algum prospect real chegar nesse estado.
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
}

export interface ProspeccaoStatus {
  key: string;
  label: string;
  color: string;
}

export const PROSPECCAO_STATUS: ProspeccaoStatus[] = [
  { key: "novo", label: "Novo", color: "#3B82F6" },
  { key: "em_prospeccao", label: "Em prospecção", color: "#EAB308" },
  { key: "respondeu", label: "Respondeu", color: "#0EA5E9" },
  { key: "qualificado", label: "Qualificado", color: "#22C55E" },
  { key: "sem_resposta", label: "Sem resposta", color: "#8e27ef" },
  { key: "desqualificado", label: "Desqualificado", color: "#dc2626" },
];

const BY_KEY = new Map(PROSPECCAO_STATUS.map((s) => [s.key, s]));

/**
 * Status de Prospecção pro lead, calculado ao VIVO — mesma disciplina do
 * `resolveDisplayStage` de Pré-vendas (nunca lê snapshot de coluna, sempre
 * recalcula dos campos reais). "Qualificado" aqui significa que a
 * oportunidade JÁ foi criada (negocioPrincipal/negocioCount reais) — no
 * fluxo de Prospecção isso acontece direto (sem passar por Pré-vendas), via
 * `/leads/:id/converter-oportunidade` com `semReuniao: true`.
 */
export function resolveProspeccaoStatus(lead: Lead): ProspeccaoStatus {
  const s = lead.sdrStatus || "pending";
  if (s === "disqualified") return BY_KEY.get("desqualificado")!;
  if (lead.negocioPrincipal || (lead.negocioCount && lead.negocioCount > 0)) return BY_KEY.get("qualificado")!;
  if (s === "sdr_sem_retorno") return BY_KEY.get("sem_resposta")!;
  if (s === "qualifying") return BY_KEY.get("respondeu")!;
  if (s === "contacted") return BY_KEY.get("em_prospeccao")!;
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
