/**
 * Board de Pipeline (CRM2) — Entrada→Diagnóstico→Proposta→Negociação, NUNCA
 * reunião/trial/no-show como coluna própria (isso é estado/evento dentro da
 * oportunidade). De/Para fechado 17/08 (spec detalhada + mockups do Kauã):
 *
 *   reuniao_agendada    → Entrada
 *   reuniao_realizada    → Diagnóstico
 *   trial                → Diagnóstico + badge "Trial ativo" (não é coluna)
 *   proposta_apresentada → Proposta
 *   negociacao_iniciada  → Negociação
 *   ganho                → Ganho (bucket fechado, histórico nunca reavaliado)
 *   perdido               → Perdido
 *   no_show               → Entrada + badge "No-show" (recuperação real já
 *                            existe em converterLeadEmOportunidade — reagendar
 *                            reusa a MESMA oportunidade, nunca cria outra)
 *   sem_retorno/trava_negociacao/trava_assinatura/outra_data → Perdido, com
 *     motivo ESTRUTURADO (o próprio valor de status já é granular/filtrável
 *     — nenhuma coluna nova, nenhuma reescrita de histórico: só reclassificado
 *     na VISÃO do CRM2, `negocios.status` real permanece intocado)
 *
 * Contagens reais na org Callface (17/08): reuniao_agendada=11,
 * reuniao_realizada=16, trial=26, proposta_apresentada=34,
 * negociacao_iniciada=25, ganho=545, perdido=395, no_show=31,
 * sem_retorno=44, trava_negociacao=8, trava_assinatura=2, outra_data=135.
 *
 * "ativo"(80) fica FORA de todo esse De/Para — não está na lista que o Kauã
 * mandou, e o próprio código (`lib/crm/data-quality.ts:74-80`) já documenta
 * que é "pós-venda recorrente", não uma etapa de venda. Por instrução
 * explícita ("se existir status fora da lista, retornar como unresolved
 * antes de decidir sozinho"), ele NUNCA entra em nenhum bucket de Pipeline
 * aqui — fica só como contagem informativa separada, decisão de mover pra
 * Carteira/Clientes é do Kauã.
 */
export interface PipelineCol {
  key: string;
  label: string;
  color: string;
  keys: string[];
  dropTarget: string;
}

export const ENTRADA_COL: PipelineCol = { key: "reuniao_agendada", label: "Entrada", color: "#3B82F6", keys: ["reuniao_agendada", "no_show"], dropTarget: "reuniao_agendada" };
export const DIAGNOSTICO_COL: PipelineCol = { key: "reuniao_realizada", label: "Diagnóstico", color: "#06B6D4", keys: ["reuniao_realizada", "trial"], dropTarget: "reuniao_realizada" };
export const PROPOSTA_COL: PipelineCol = { key: "proposta_apresentada", label: "Proposta", color: "#A855F7", keys: ["proposta_apresentada"], dropTarget: "proposta_apresentada" };
export const NEGOCIACAO_COL: PipelineCol = { key: "negociacao_iniciada", label: "Negociação", color: "#EC4899", keys: ["negociacao_iniciada"], dropTarget: "negociacao_iniciada" };
export const PIPELINE_OPEN_COLS: PipelineCol[] = [ENTRADA_COL, DIAGNOSTICO_COL, PROPOSTA_COL, NEGOCIACAO_COL];

/** Próxima etapa real na sequência linear — usado pelo botão "Avançar" (drawer/página completa). Ganho sempre exige gate de evidência (endpoint já garante). */
export const STAGE_ORDER = ["reuniao_agendada", "reuniao_realizada", "proposta_apresentada", "negociacao_iniciada", "ganho"];
export function proximoStatusReal(statusAtual: string): string | null {
  // no_show/trial mapeiam pra Entrada/Diagnóstico na exibição, mas o "avançar"
  // real sai do status LITERAL atual (ex: trial avança igual reuniao_realizada).
  const base = statusAtual === "no_show" ? "reuniao_agendada" : statusAtual === "trial" ? "reuniao_realizada" : statusAtual;
  const idx = STAGE_ORDER.indexOf(base);
  if (idx === -1 || idx + 1 >= STAGE_ORDER.length) return null;
  return STAGE_ORDER[idx + 1];
}

export const ESTAGNADO_KEYS = ["sem_retorno", "trava_negociacao", "trava_assinatura", "outra_data"];
export const PERDIDO_KEYS = ["perdido", ...ESTAGNADO_KEYS];

/** Motivo ESTRUTURADO de perda — pedido explícito do Kauã (filtrável, não texto livre). Deriva do status real, nada reescrito. */
export const MOTIVO_PERDA_ESTRUTURADO: Record<string, string> = {
  sem_retorno: "Sem retorno de contato",
  trava_negociacao: "Trava na negociação",
  trava_assinatura: "Trava na assinatura do contrato",
  outra_data: "Negociar em outra data",
};
export function motivoPerdaLabel(n: { status: string; motivoPerda: string | null }): string {
  if (MOTIVO_PERDA_ESTRUTURADO[n.status]) return MOTIVO_PERDA_ESTRUTURADO[n.status];
  return n.motivoPerda?.trim() || "Motivo não informado";
}

export const FAMILY_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
export const FAMILY_COLOR: Record<string, string> = { CALLFACE_AI: "#88d600", PABX: "#3b82f6", WHITE_LABEL: "#f59e0b", UNKNOWN: "#9ca3af" };

export interface PropostaResumo {
  numero: number;
  status: string; // rascunho | enviada | aceita | recusada | expirada
  totalGeral: string | null;
  primeiraVisualizacaoEm: string | null;
  clienteRespondeuEm: string | null;
  dataValidade: string | null;
}

/** Sub-status de exibição da proposta — derivado 100% de campos reais (visualização/resposta/validade), nada fabricado. */
export function resolvePropostaDisplay(p: PropostaResumo): { label: string; tom: "neutral" | "warning" | "success" | "danger" } {
  const hoje = new Date().toISOString().split("T")[0];
  if (p.status === "aceita") return { label: "Aceita", tom: "success" };
  if (p.status === "recusada") return { label: "Recusada", tom: "danger" };
  // Ajuste solicitado (01/09, 2B): faltava — caía no fallback "Em elaboração",
  // que é o oposto do sinal real (o cliente respondeu e está esperando o
  // vendedor). É pendência do time, não rascunho.
  if (p.status === "ajuste_solicitado") return { label: "Ajuste solicitado", tom: "warning" };
  if (p.dataValidade && p.dataValidade < hoje && p.status === "enviada") return { label: "Expirada", tom: "danger" };
  if (p.status === "expirada") return { label: "Expirada", tom: "danger" };
  if (p.status === "enviada" && p.primeiraVisualizacaoEm && !p.clienteRespondeuEm) return { label: "Aberta pelo cliente", tom: "warning" };
  if (p.status === "enviada") return { label: "Aguardando cliente", tom: "neutral" };
  return { label: "Em elaboração", tom: "neutral" };
}

export interface NegocioBoard {
  id: string; titulo: string; status: string;
  valorTotal: string | null; mrrEstimado: string | null; mrrFechado: string | null;
  serviceFamily: string | null;
  responsavelId: string | null; responsavelNome: string | null;
  leadId: string | null; leadNome: string | null; leadSobrenome: string | null;
  leadOrigem: string | null;
  leadTelefone: string | null; leadEmail: string | null;
  empresaId: string | null; empresaNome: string | null;
  previsaoFechamento: string | null; motivoPerda: string | null;
  bundleId: string | null;
  createdAt: string; updatedAt: string; ganhoAt: string | null;
  proposta: PropostaResumo | null;
  contratoPendente: boolean;
  pagamentoPendente: boolean;
  proximaAcao: { titulo: string; dataVencimento: string | null } | null;
  oportunidadesRelacionadas: number;
  /** Tags da oportunidade (01/09) — vêm batch do `/pipeline-crm2/board`. */
  labels?: { id: string; nome: string; cor: string }[];
}

export function negocioValor(n: NegocioBoard): number {
  return Number(n.mrrFechado || n.mrrEstimado || n.valorTotal || 0);
}

export function tempoNaEtapa(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime();
  const dias = Math.floor(ms / 86_400_000);
  if (dias < 1) return "hoje";
  if (dias === 1) return "1d";
  return `${dias}d`;
}

export function diasSemAvanco(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
}
