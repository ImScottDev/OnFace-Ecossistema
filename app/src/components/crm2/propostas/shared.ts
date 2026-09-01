/**
 * Propostas (CRM2, reconstrução 18/08 a partir de spec+mockups+correção do
 * Kauã) — status REAL da tabela `propostas` tem 3 valores legados fora do
 * enum documentado (achado real, 18/08): "Em Construção"(2)/"Proposta
 * Ganha"(2)/"Negotiation"(1), 5 linhas no total contra 1433 no enum real.
 * Mapeados aqui só como RÓTULO/COR de exibição (tradução óbvia da palavra,
 * não é reinterpretação de regra de negócio) — a coluna `status` no banco
 * NUNCA é reescrita por este código.
 */
export const STATUS_LABEL: Record<string, { label: string; tom: "neutral" | "warning" | "success" | "danger" | "accent" }> = {
  rascunho: { label: "Rascunho", tom: "neutral" },
  enviada: { label: "Enviada", tom: "warning" },
  ajuste_solicitado: { label: "Ajuste solicitado", tom: "accent" },
  aceita: { label: "Aceita", tom: "success" },
  recusada: { label: "Recusada", tom: "danger" },
  expirada: { label: "Expirada", tom: "danger" },
  // Legado (5 linhas reais, achado 18/08) — tradução direta, não decisão de negócio.
  "Em Construção": { label: "Rascunho (legado)", tom: "neutral" },
  "Proposta Ganha": { label: "Aceita (legado)", tom: "success" },
  Negotiation: { label: "Enviada (legado)", tom: "warning" },
};

export function statusDisplay(status: string): { label: string; tom: "neutral" | "warning" | "success" | "danger" | "accent" } {
  return STATUS_LABEL[status] || { label: status, tom: "neutral" };
}

export const FAMILY_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
export const FAMILY_COLOR: Record<string, string> = { CALLFACE_AI: "#88d600", PABX: "#3b82f6", WHITE_LABEL: "#f59e0b", UNKNOWN: "#9ca3af" };

export interface PropostaRow {
  id: string; numero: number; versao: number; status: string;
  leadId: string | null; leadNome: string | null; leadEmpresa: string | null;
  negocioId: string | null; negocioTitulo: string | null; negocioStatus: string | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  dataEmissao: string | null; dataValidade: string | null;
  criadoPorId: string | null; criadoPorNome: string | null;
  proximoPasso: string | null; visualizacoes: number;
  primeiraVisualizacaoEm: string | null; clienteRespondeuEm: string | null;
  enviadaEm: string | null; createdAt: string;
  familias: string[];
  itensResumo: Array<{ nome: string; quantidade: string; tipo: string }>;
  ultimaAtividadeEm: string;
  ultimaAtividadeTipo: "criou" | "enviou" | "visualizou" | "respondeu";
}

export const brl = (v: string | number | null | undefined) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Etapa do negócio vinculado, exibida na tabela/drawer de Propostas (25/08,
// referência do Kauã) — reusa o MESMO de/para de Pipeline (nunca reinventa
// um 2º vocabulário de etapa pra negócio).
import { PIPELINE_OPEN_COLS } from "../pipeline/shared";
export function resolveEtapaNegocio(status: string | null): { label: string; color: string } | null {
  if (!status) return null;
  if (status === "ganho") return { label: "Ganho", color: "#22C55E" };
  if (status === "perdido" || ["sem_retorno", "trava_negociacao", "trava_assinatura", "outra_data"].includes(status)) return { label: "Perdido", color: "#dc2626" };
  const col = PIPELINE_OPEN_COLS.find((c) => c.keys.includes(status));
  return col ? { label: col.label, color: col.color } : null;
}
