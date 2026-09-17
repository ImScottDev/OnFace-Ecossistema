/**
 * Tipos e lógica de coluna/etapa de pré-vendas, compartilhados entre a UI
 * (Kanban e drawer de lead) e a API (`api-server/routes/atendimento.ts`).
 *
 * Mora em `lib` e não em `components` porque a API depende dele: o bundle da
 * API só carrega `src/api-server` e `src/lib`, então um módulo compartilhado
 * dentro de `components` quebra o build da imagem.
 */
import { SDR_MIRROR_KEYS, SDR_MIRROR_STAGES, SDR_SLA_HOURS, SDR_STAGNATION_KEYS, isOutboundLead, negocioStatusToSdrMirror } from "@/lib/crm/pipeline";

export interface Lead {
  id: string;
  nome: string;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  origem?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  metaAdId?: string | null;
  metaAdsetId?: string | null;
  landingPage?: string | null;
  leadScore?: number | null;
  sdrStatus?: string | null;
  responsavelId?: string | null;
  tipo: string;
  negocioCount?: number;
  negocioPrincipal?: { id: string; titulo: string; status: string } | null;
  temReuniaoAgendada?: boolean;
  createdAt?: string;
  updatedAt?: string;
  avatarUrl?: string | null;
  lastContactAt?: string | null;
  whatsappUltimaMsgAt?: string | null;
}

/**
 * Contexto de CLIENTE da pessoa, separado da etapa de Lead (correção 19/08,
 * pedido do Kauã: "Pessoa não é Lead" — sdr_status='disqualified' é o
 * destino de um PROCESSO histórico de qualificação, nunca a identidade
 * atual da pessoa). Quando a pessoa é cliente (`tipo='cliente'`), este
 * contexto é o que deve aparecer em destaque no header do drawer — o stage
 * de SDR (resolveDisplayStage) passa a ser só histórico, mostrado dentro da
 * seção de Lead, nunca como badge principal.
 *
 * Mesma regra já usada em `contatos-crm2.ts` (`PESSOA_EX_CLIENTE`): cliente
 * ativo = tipo='cliente' e existe pelo menos um contrato com status='ativo';
 * ex-cliente = tipo='cliente', tem contrato histórico, mas nenhum ativo.
 * Recebida via `contratos` já buscado no GET /leads/:id (evita 2ª query).
 */
export function resolveContextoCliente(
  lead: Lead,
  contratos: { status: string }[] | undefined,
): { label: string; color: string; bg: string } | null {
  if (lead.tipo !== "cliente") return null;
  const temAtivo = (contratos || []).some((c) => c.status === "ativo");
  if (temAtivo) return { label: "Cliente ativo", color: "#4ade80", bg: "#05966918" };
  if ((contratos || []).length > 0) return { label: "Ex-cliente", color: "#9ca3af", bg: "#6B728018" };
  // tipo=cliente sem contrato vinculado (sem evidência de churn, só ausência
  // de dado) — mesma regra de fallback do PESSOA_EX_CLIENTE em contatos-crm2.ts.
  return { label: "Cliente", color: "#4ade80", bg: "#05966918" };
}

export function stageAge(updatedAt: string | undefined, status: string) {
  if (!updatedAt) return null;
  const ms = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = ms / (1000 * 60 * 60);
  const sla = SDR_SLA_HOURS[status] || 48;
  const ratio = hours / sla;
  let text: string;
  if (mins < 60) text = `${mins}min`;
  else if (mins < 1440) text = `${Math.floor(mins / 60)}h`;
  else text = `${Math.floor(mins / 1440)}d`;
  let color: string, bg: string;
  if (ratio < 0.5) { color = "var(--cf2-success-text)"; bg = "var(--cf2-success-bg)"; }
  else if (ratio <= 1) { color = "var(--cf2-warning-text)"; bg = "var(--cf2-warning-bg)"; }
  else { color = "var(--cf2-danger-text)"; bg = "#fde8e8"; }
  return { text, color, bg, breached: ratio > 1 };
}

// 5 colunas ABERTAS do fluxo principal (De/Para CRM2 aprovado 17/08, Figma
// node 211:4) — todas `flex-1`, largura igual, sem barras colapsadas. Nada
// disso muda a lógica de escrita: `dropTarget` é sempre um valor real de
// sdrBoardColumn/sdr_status já tratado por handleMove; `keys` é só o filtro
// de exibição (quais leads aparecem na coluna) e pode listar mais de uma
// key real quando a coluna agrupa mais de uma origem.
//
// "Qualificado (SQL)" vs "Agenda Confirmada" são a MESMA key real
// (m_qualified — negócio em reuniao_agendada, que é o status que
// converter-oportunidade.ts grava tanto qualificando com reunião quanto
// sem) — o que distingue as duas na tela é `temReuniaoAgendada`, sinal real
// vindo da API (existe linha em `reunioes` com status agendada e data
// futura pro negócio), não um status novo inventado.
export interface KanbanCol {
  key: string;
  label: string;
  color: string;
  keys: string[];
  dropTarget: string;
  filter?: (l: Lead) => boolean;
}

export const NOVO_COL: KanbanCol = { key: "pending", label: "Novo", color: "#7dd3fc", keys: ["pending", "outbound"], dropTarget: "pending" };
export const EM_CONTATO_COL: KanbanCol = { key: "contacted", label: "Em Contato", color: "#fbbf24", keys: ["contacted"], dropTarget: "contacted" };
export const QUALIFICACAO_COL: KanbanCol = { key: "qualifying", label: "Qualificação", color: "#c4a0ff", keys: ["qualifying"], dropTarget: "qualifying" };
// Qualificado (SQL) aceita DUAS chaves (01/09, decisão do Kauã):
//  - `m_qualified`: lead com oportunidade já criada, sem reunião marcada;
//  - `qualified`  : lead marcado como SQL pela SDR SEM abrir reunião nem
//                   oportunidade. Antes desta data isso era um buraco real —
//                   `sdrBoardColumn` devolvia "qualified", nenhuma coluna
//                   reconhecia essa chave, e o lead SUMIA do board. Era por
//                   isso que qualificar forçava o modal de reunião: criar o
//                   negócio era o único jeito de ele continuar visível.
// `dropTarget` diferente por coluna é o que separa as duas intenções ao
// arrastar: cair em Qualificado (SQL) grava `qualified` (sem modal), cair em
// Agenda Confirmada grava `m_qualified` (abre o modal de reunião).
export const QUALIFICADO_SQL_COL: KanbanCol = { key: "m_qualified_sql", label: "Qualificado (SQL)", color: "#4ade80", keys: ["m_qualified", "qualified"], dropTarget: "qualified", filter: (l) => !l.temReuniaoAgendada };
export const AGENDA_CONFIRMADA_COL: KanbanCol = { key: "m_qualified_agenda", label: "Agenda Confirmada", color: "#67d8f9", keys: ["m_qualified"], dropTarget: "m_qualified", filter: (l) => !!l.temReuniaoAgendada };
export const OPEN_COLS_QUALIFICACAO: KanbanCol[] = [NOVO_COL, EM_CONTATO_COL, QUALIFICACAO_COL, QUALIFICADO_SQL_COL, AGENDA_CONFIRMADA_COL];

// View Estagnados: 3 colunas — "Nutrição/Retomar depois" junta
// sdr_sem_interesse + sdr_retomar_depois; dropar nela grava sdr_sem_interesse
// (motivo mais genérico do par). "Sem resposta" continua 1:1 com sdr_sem_retorno.
// "Desqualificado" (pedido do Kauã 17/08): só pra visualização nessa view —
// não conta no badge "Estagnados N" da aba, que continua só sem_resposta+nutrição.
export const SEM_RESPOSTA_COL: KanbanCol = { key: "sdr_sem_retorno", label: "Sem resposta", color: "#c4a0ff", keys: ["sdr_sem_retorno"], dropTarget: "sdr_sem_retorno" };
export const NUTRICAO_MERGED_COL: KanbanCol = { key: "sdr_sem_interesse", label: "Nutrição/Retomar depois", color: "#b8a1fb", keys: ["sdr_sem_interesse", "sdr_retomar_depois"], dropTarget: "sdr_sem_interesse" };
export const DESQUALIFICADO_ESTAGNADOS_COL: KanbanCol = { key: "disqualified", label: "Desqualificado", color: "#f87171", keys: ["disqualified"], dropTarget: "disqualified" };
export const OPEN_COLS_ESTAGNADOS: KanbanCol[] = [SEM_RESPOSTA_COL, NUTRICAO_MERGED_COL, DESQUALIFICADO_ESTAGNADOS_COL];

export function sdrBoardColumn(lead: Lead): string {
  const s = lead.sdrStatus || "pending";
  if (s === "disqualified") return "disqualified";
  if (lead.negocioPrincipal?.status === "no_show") return s;
  if (lead.negocioPrincipal) return negocioStatusToSdrMirror(lead.negocioPrincipal.status);
  if (lead.negocioCount && lead.negocioCount > 0) return "m_qualified";
  if (s === "pending" && isOutboundLead(lead.origem)) return "outbound";
  return s;
}

/**
 * Label/cor da etapa CRM2 pro lead, calculado ao VIVO (mesma lógica que
 * monta as colunas do Kanban) — nunca usar a coluna `crm2_pre_vendas_stage`
 * do banco pra isso: aquela é um snapshot do backfill de 17/08, não é
 * re-sincronizada quando o lead se move no board, então fica velha depois
 * do primeiro drag. Usado pelo header do drawer novo (Figma 230:8825).
 */
export function resolveDisplayStage(lead: Lead): { label: string; color: string } {
  const s = lead.sdrStatus || "pending";
  if (SDR_STAGNATION_KEYS.includes(s)) {
    const col = [SEM_RESPOSTA_COL, NUTRICAO_MERGED_COL].find((c) => c.keys.includes(s));
    return col ? { label: col.label, color: col.color } : { label: s, color: "#9ca3af" };
  }
  const board = sdrBoardColumn(lead);
  if (board === "outbound") return { label: NOVO_COL.label, color: NOVO_COL.color };
  // SQL sem oportunidade/reunião — par da chave "qualified" adicionada em
  // QUALIFICADO_SQL_COL. Sem esta linha o header do drawer mostraria a chave
  // crua "qualified" em vez do rótulo.
  if (board === "qualified") return { label: QUALIFICADO_SQL_COL.label, color: QUALIFICADO_SQL_COL.color };
  if (board === "m_qualified") {
    return lead.temReuniaoAgendada
      ? { label: AGENDA_CONFIRMADA_COL.label, color: AGENDA_CONFIRMADA_COL.color }
      : { label: QUALIFICADO_SQL_COL.label, color: QUALIFICADO_SQL_COL.color };
  }
  const col = [NOVO_COL, EM_CONTATO_COL, QUALIFICACAO_COL].find((c) => c.keys.includes(board));
  if (col) return { label: col.label, color: col.color };
  if (board === "disqualified") return { label: "Desqualificado", color: "#f87171" };
  // Achado real 25/08 (Kauã: "que merda é essa... m_reuniao porra") — board
  // também pode vir de negocioStatusToSdrMirror como "m_reuniao"/
  // "m_convertido" quando o negócio já avançou pro closer (reunião+/ganho);
  // faltava esse pedaço aqui, caía direto no fallback e mostrava a CHAVE
  // crua em vez do rótulo. SDR_MIRROR_STAGES já tinha os 2 rótulos certos,
  // só nunca eram consultados nesta função.
  const mirror = SDR_MIRROR_STAGES.find((c) => c.key === board);
  if (mirror) return { label: mirror.label, color: mirror.color };
  return { label: board, color: "#9ca3af" };
}

export { SDR_MIRROR_KEYS };

/**
 * Instante da última movimentação real do lead (01/09, pedido do Kauã: "os
 * mais recentes em cima"). Pega o MAIOR entre atualização do registro, último
 * contato e criação — mover de etapa grava `updated_at` no PATCH, então o
 * card sobe pro topo da coluna nova na hora.
 */
export function recencia(lead: Pick<Lead, "updatedAt" | "lastContactAt" | "createdAt">): number {
  const candidatos = [lead.updatedAt, lead.lastContactAt, lead.createdAt];
  let maior = 0;
  for (const c of candidatos) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isNaN(t) && t > maior) maior = t;
  }
  return maior;
}

/** Comparador de coluna de Kanban: mais recente primeiro. */
export function porRecenciaDesc(
  a: Pick<Lead, "updatedAt" | "lastContactAt" | "createdAt">,
  b: Pick<Lead, "updatedAt" | "lastContactAt" | "createdAt">
): number {
  return recencia(b) - recencia(a);
}
