/**
 * Prospecção (CRM2, reconstrução 17/08 a partir de spec+mockups do Kauã) —
 * workspace EXCLUSIVO de outbound, separado de Pré-vendas. Reaproveita o
 * mesmo `Lead` base de `qualificacao/shared.ts` (mesmo endpoint `/api/leads`,
 * mesmos sinais reais) só que com um vocabulário de status PRÓPRIO — os 6
 * operacional próprio. O estado é derivado de sinais reais já persistidos:
 * lista, enrollment de cadência, sdrStatus e oportunidade vinculada. Isso
 * mantém Prospect separado de Pré-vendas sem criar um segundo CRM.
 */
import type { Lead } from "@/lib/crm/qualificacao-colunas";

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
  /**
   * `sdr_status` gravado ao ARRASTAR um card pra esta coluna (01/09). O status
   * de Prospecção é DERIVADO (`resolveProspeccaoStatus`), não armazenado, então
   * cada coluna precisa dizer qual escrita real a representa.
   *
   * `null` = coluna não aceita drop, e por motivos diferentes:
   *  - `em_cadencia`: é consequência de um enrollment de cadência, não de um
   *    status. Arrastar pra cá não inscreveria ninguém — o caminho real é a
   *    ação "Adicionar à cadência".
   *  - `qualificado`: exige ESCOLHA de destino (Pré-vendas ou criar
   *    oportunidade), então abre diálogo em vez de gravar direto.
   */
  dropStatus?: string | null;
}

export const PROSPECCAO_STATUS: ProspeccaoStatus[] = [
  { key: "novo", label: "Novo", color: "#64748B", dropStatus: "pending" },
  { key: "selecionado", label: "Selecionado", color: "#2563EB", dropStatus: "contacted" },
  { key: "em_cadencia", label: "Em cadência", color: "#7C3AED", dropStatus: null },
  { key: "respondeu", label: "Respondeu", color: "#0EA5E9", dropStatus: "qualifying" },
  { key: "qualificado", label: "Qualificado", color: "#16A34A", dropStatus: null },
  { key: "sem_resposta", label: "Sem resposta", color: "#8e27ef", dropStatus: "sdr_sem_retorno" },
  { key: "desqualificado", label: "Desqualificado", color: "#dc2626", dropStatus: "disqualified" },
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
  // Qualificado = prospect que passou do handoff, por QUALQUER um dos dois
  // destinos (01/09, decisão do Kauã): oportunidade criada direto no Pipeline
  // (negócio real) OU enviado pra Pré-vendas como SQL (`sdr_status`
  // 'qualified', sem oportunidade). Antes só o 1º caminho existia, e a etapa
  // era rotulada "Pré-vendas" — nome do destino, não do estado.
  if (lead.negocioPrincipal || (lead.negocioCount && lead.negocioCount > 0)) return BY_KEY.get("qualificado")!;
  if (s === "qualified") return BY_KEY.get("qualificado")!;
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
