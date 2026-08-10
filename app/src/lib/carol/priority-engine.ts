/**
 * Motor heurístico da Carol (Sales Copilot operacional, V1 sem IA).
 *
 * Regra de ouro (Kauã, 10/08): nunca inventar. Cada item de prioridade tem
 * uma explicação real e reproduzível ("por que isso é prioridade?") — não
 * um número que a IA inventou. Score = combinação explícita de sinais reais
 * (tempo sem interação, valor potencial, proximidade de reunião, atraso),
 * cada peso documentado aqui, nada oculto.
 *
 * V2 troca isso por LLM sem mudar a interface (`PrioridadeItem`) — mesma
 * disciplina do Insight Engine (lib/insights).
 */

export type PrioridadeItem = {
  id: string;
  tipo: "negocio_parado" | "tarefa_atrasada" | "reuniao_proxima" | "aguardando_resposta" | "proposta_sem_followup";
  titulo: string;
  subtitulo: string | null;
  score: number;
  urgencia: "alta" | "media" | "baixa";
  motivos: string[]; // linha a linha, pro "por que isso é prioridade?"
  link: string | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

function urgenciaPorScore(score: number): "alta" | "media" | "baixa" {
  if (score >= 70) return "alta";
  if (score >= 35) return "media";
  return "baixa";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function scoreNegocioParado(diasSemAtividade: number, valor: number, reuniaoProximaEmHoras: number | null): PrioridadeItem["score"] {
  let score = Math.min(diasSemAtividade * 6, 40); // tempo sem interação, capado
  score += Math.min(valor / 1000, 30); // valor potencial, capado
  if (reuniaoProximaEmHoras !== null && reuniaoProximaEmHoras <= 4) score += 25; // proximidade de reunião
  return Math.round(score);
}

export function motivosNegocioParado(diasSemAtividade: number, valor: number, reuniaoProximaEmHoras: number | null, etapa: string): string[] {
  const m = [`R$ ${brl(valor).replace("R$ ", "")} de potencial`, `Última interação há ${diasSemAtividade} dia${diasSemAtividade === 1 ? "" : "s"}`, `Etapa: ${etapa}`];
  if (reuniaoProximaEmHoras !== null) m.push(reuniaoProximaEmHoras <= 4 ? `Reunião em ${Math.max(1, Math.round(reuniaoProximaEmHoras))}h` : "Sem reunião marcada");
  return m;
}

export function scoreTarefaAtrasada(diasAtraso: number): number {
  return Math.round(Math.min(30 + diasAtraso * 8, 80));
}

export function scoreReuniaoProxima(horasAteReuniao: number, valor: number | null): number {
  let score = horasAteReuniao <= 1 ? 60 : horasAteReuniao <= 4 ? 45 : 25;
  if (valor) score += Math.min(valor / 2000, 15);
  return Math.round(score);
}

export function scoreAguardandoResposta(horasSemResposta: number): number {
  return Math.round(Math.min(20 + horasSemResposta * 3, 75));
}

export function scorePropostaSemFollowup(diasSemFollowup: number, valor: number): number {
  return Math.round(Math.min(diasSemFollowup * 7 + valor / 1500, 70));
}

export { urgenciaPorScore, DIA_MS, brl };
