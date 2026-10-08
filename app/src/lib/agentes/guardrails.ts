/**
 * Limites de autonomia do agente (guardrail_config) e paradas de segurança.
 *
 * Funções puras, sem banco: o worker consulta os números e decide aqui. Padrões
 * seguros quando a versão não configura nada: horário comercial para contato
 * ATIVO (primeiro contato e follow-up), 6 mensagens/hora e 30/dia por conversa,
 * e parada imediata quando o cliente pede uma pessoa ou fala de algo sensível.
 */
import { relogioDaOperacao } from "./distribuicao";

export interface LimitesDoAgente {
  /** Janela em que o agente pode iniciar contato. Nula = sem restrição. */
  horario: { dias: number[]; inicio: string; fim: string } | null;
  /** Responder a quem escreveu fora da janela? Padrão sim: o cliente falou primeiro. */
  responderForaDoHorario: boolean;
  maxMensagensPorHora: number;
  maxMensagensPorDia: number;
  /** Mensagens seguidas do agente sem o cliente responder (follow-up). */
  maxSemRetorno: number;
}

export const LIMITES_PADRAO: LimitesDoAgente = {
  horario: { dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "19:00" },
  responderForaDoHorario: true,
  maxMensagensPorHora: 6,
  maxMensagensPorDia: 30,
  maxSemRetorno: 3,
};

export function lerLimites(guardrailConfig: unknown): LimitesDoAgente {
  const g = (guardrailConfig && typeof guardrailConfig === "object" ? guardrailConfig : {}) as Record<string, unknown>;
  const l = (g.limites && typeof g.limites === "object" ? g.limites : {}) as Record<string, unknown>;
  const h = g.horarioComercial as { ativo?: boolean; dias?: number[]; inicio?: string; fim?: string } | undefined;
  const num = (v: unknown, d: number) => (typeof v === "number" && v >= 0 ? v : d);
  return {
    horario: h?.ativo === false ? null : h?.inicio && h?.fim ? { dias: h.dias?.length ? h.dias : LIMITES_PADRAO.horario!.dias, inicio: h.inicio, fim: h.fim } : LIMITES_PADRAO.horario,
    responderForaDoHorario: typeof l.responderForaDoHorario === "boolean" ? l.responderForaDoHorario : LIMITES_PADRAO.responderForaDoHorario,
    maxMensagensPorHora: num(l.maxMensagensPorHora, LIMITES_PADRAO.maxMensagensPorHora),
    maxMensagensPorDia: num(l.maxMensagensPorDia, LIMITES_PADRAO.maxMensagensPorDia),
    maxSemRetorno: num(l.maxSemRetorno, LIMITES_PADRAO.maxSemRetorno),
  };
}

export function dentroDoHorario(h: LimitesDoAgente["horario"], agora: Date): boolean {
  if (!h) return true;
  const { dia, minutos } = relogioDaOperacao(agora);
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  return h.dias.includes(dia) && minutos >= m(h.inicio) && minutos < m(h.fim);
}

export type MotivoDeParada = "pedido_humano" | "assunto_sensivel" | "descadastro";

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PEDIDO_HUMANO = /\b(humano|atendente|pessoa real|(falar|conversar|falo|passa\w*|chama\w*|quero|preciso|prefiro|transfer\w*)\b.{0,30}\b(pessoa|alguem|gerente|vendedor\w*|consultor\w*|especialista|supervisor\w*|responsavel))\b/;
const SENSIVEL = /\b(procon|advogad\w*|process(ar|o|ando)|juridic\w*|reclame ?aqui|golpe|fraude|ouvidoria|lgpd|denunc\w*|ameac\w*|cobranca indevida|reembolso|estorno|cancelamento|cancelar (o |meu |minha )?(contrato|plano|conta|assinatura))\b/;
const DESCADASTRO = /\b(pare de (me )?(mandar|enviar|chamar)|nao (me )?(chame|mande|envie|ligue)|descadastr\w*|sair da lista|remova meu (numero|contato)|bloquear)\b/;

/** O cliente pediu uma pessoa, falou de algo sensível ou pediu para parar? Roda ANTES do modelo. */
export function motivoDeParada(texto: string, expressoesDeHandoff: string[] = []): MotivoDeParada | null {
  const t = sem(texto);
  if (DESCADASTRO.test(t)) return "descadastro";
  if (SENSIVEL.test(t)) return "assunto_sensivel";
  if (PEDIDO_HUMANO.test(t) || expressoesDeHandoff.some((e) => e.trim() && t.includes(sem(e)))) return "pedido_humano";
  return null;
}

export const ROTULO_PARADA: Record<MotivoDeParada, string> = {
  pedido_humano: "O cliente pediu para falar com uma pessoa",
  assunto_sensivel: "O cliente trouxe um assunto sensível (jurídico, cancelamento, cobrança ou reclamação)",
  descadastro: "O cliente pediu para não receber mais mensagens",
};

export function excedeTaxa(c: { naHora: number; noDia: number; seguidasSemRetorno: number }, l: LimitesDoAgente, ativo: boolean): "hora" | "dia" | "sem_retorno" | null {
  if (c.naHora >= l.maxMensagensPorHora) return "hora";
  if (c.noDia >= l.maxMensagensPorDia) return "dia";
  if (ativo && c.seguidasSemRetorno >= l.maxSemRetorno) return "sem_retorno";
  return null;
}
