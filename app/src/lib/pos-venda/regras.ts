/**
 * Regras PURAS do pós-venda (sem `db`): mapeamentos de vocabulário, relógios e prazos.
 * Ficam separadas das leituras para os testes provarem a conta sem banco, e porque a
 * conta de relógio é a que a tela mais cobra ("quanto tempo o time realmente gastou?").
 */
import type {
  EstadoDaTarefa, EstadoDoProjeto, Familia, MotivoDaEspera, Nps, PassoDoPlaybook, Playbook, Prioridade, Relogios,
} from "./contrato";

const HORA = 3_600_000;
const DIA = 24 * HORA;

/** `timestamp` volta string do driver (fetch_types:false). Converte uma vez, no limite; inválido vira null. */
export function dataDe(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function iniciaisDe(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  if (!n) return "?";
  const partes = n.split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function familiaValida(v: string | null | undefined): Familia | null {
  return v === "CALLFACE_AI" || v === "PABX" || v === "WHITE_LABEL" ? v : null;
}

/** `fulfillments.status` -> estado macro. Espera aberta empurra para AGUARDANDO. */
export function estadoDoProjeto(status: string, temEsperaAberta: boolean): EstadoDoProjeto {
  switch (status) {
    case "COMPLETED": return "CONCLUIDO";
    case "CANCELED": return "CANCELADO";
    case "READY_FOR_VALIDATION": return "EM_VALIDACAO";
    case "WAITING_CUSTOMER": case "BLOCKED_CUSTOMER": case "BLOCKED_INTERNAL": case "BLOCKED_PROVIDER": return "AGUARDANDO";
    case "IN_PROGRESS": return temEsperaAberta ? "AGUARDANDO" : "EM_ANDAMENTO";
    default: return temEsperaAberta ? "AGUARDANDO" : "NAO_INICIADO";
  }
}

/** Inverso, para quem escreve: o `status` que o fulfillment recebe ao mudar de estado. */
export function statusDoFulfillment(estado: EstadoDoProjeto, motivo?: MotivoDaEspera | null): string {
  switch (estado) {
    case "CONCLUIDO": return "COMPLETED";
    case "CANCELADO": return "CANCELED";
    case "EM_VALIDACAO": return "READY_FOR_VALIDATION";
    case "AGUARDANDO": return motivo === "cliente" ? "WAITING_CUSTOMER" : motivo === "operadora" ? "BLOCKED_PROVIDER" : "BLOCKED_INTERNAL";
    case "EM_ANDAMENTO": return "IN_PROGRESS";
    default: return "NOT_STARTED";
  }
}

export function estadoDaTarefa(status: string, concluida: boolean): EstadoDaTarefa {
  if (status === "concluida" || concluida) return "CONCLUIDA";
  if (status === "declinada") return "NAO_SE_APLICA";
  if (status === "em_andamento") return "EM_ANDAMENTO";
  if (status === "aguardando") return "AGUARDANDO";
  return "A_FAZER";
}

export function prioridadeDe(v: string | null | undefined): Prioridade {
  return v === "baixa" || v === "alta" || v === "urgente" ? v : "media";
}

export function faixaDoNps(nota: number | null): Nps["faixa"] {
  if (nota == null) return null;
  return nota <= 6 ? "detrator" : nota <= 8 ? "neutro" : "promotor";
}

// ---------------------------------------------------------------------------
// Relógios
// ---------------------------------------------------------------------------

export interface PeriodoDeEspera { motivo: MotivoDaEspera; inicio: Date; fim: Date | null; detalhe: string | null }

/**
 * Horas de um período, recortado em [de, ate]. A espera que começou antes da entrada ou continua
 * depois da conclusão só conta a parte que está DENTRO da vida do projeto.
 */
function horasRecortadas(p: PeriodoDeEspera, de: Date, ate: Date): number {
  const ini = Math.max(p.inicio.getTime(), de.getTime());
  const fim = Math.min((p.fim ?? ate).getTime(), ate.getTime());
  return fim > ini ? (fim - ini) / HORA : 0;
}

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Os dois relógios. `horasCorridas` não desconta nada. `horasDoTime` desconta espera de cliente e de
 * operadora; espera `interno` NÃO pausa (a bola é do próprio time, o atraso é dele) mas entra em
 * `esperaAcumulada` para o KPI. Projeto concluído congela os dois em `concluidoEm`.
 */
export function calcularRelogios(e: {
  entrouEm: Date; concluidoEm: Date | null; agora: Date; prazoDias: number; esperas: PeriodoDeEspera[];
  /** Quando o relógio ainda não começou (ex.: T0 futuro). Callface AI não tem T0. */
  inicioDoRelogio?: Date | null;
}): Relogios {
  const inicio = e.inicioDoRelogio ?? e.entrouEm;
  const ate = e.concluidoEm ?? e.agora;
  const corridas = Math.max(0, (ate.getTime() - inicio.getTime()) / HORA);

  const acumulada: Record<MotivoDaEspera, number> = { cliente: 0, operadora: 0, interno: 0 };
  for (const p of e.esperas) acumulada[p.motivo] += horasRecortadas(p, inicio, ate);
  const descontavel = acumulada.cliente + acumulada.operadora;

  const aberta = e.concluidoEm ? undefined : e.esperas.find((p) => p.fim == null);
  const venceEm = new Date(inicio.getTime() + e.prazoDias * DIA);
  const diasDeAtraso = (ate.getTime() - venceEm.getTime()) / DIA;
  return {
    horasCorridas: arred(corridas),
    horasDoTime: arred(Math.max(0, corridas - descontavel)),
    prazoDias: e.prazoDias,
    venceEm,
    diasDeAtraso: arred(diasDeAtraso),
    consumoDoPrazo: e.prazoDias > 0 ? arred(corridas / (e.prazoDias * 24)) : null,
    esperando: aberta ? { motivo: aberta.motivo, desde: aberta.inicio, detalhe: aberta.detalhe } : null,
    esperaAcumulada: { cliente: arred(acumulada.cliente), operadora: arred(acumulada.operadora), interno: arred(acumulada.interno) },
  };
}

// ---------------------------------------------------------------------------
// Prazos do playbook
// ---------------------------------------------------------------------------

/** Dia, a partir da entrada, em que cada bloco começa. */
export function inicioDoBloco(pb: Pick<Playbook, "blocos">, bloco: PassoDoPlaybook["bloco"]): number {
  if (bloco === "abertura") return 0;
  if (bloco === "execucao") return pb.blocos.abertura;
  return pb.blocos.abertura + pb.blocos.execucao;
}

/** Quando a tarefa do passo vence. SLA em horas (corridas) vence o prazo em dias. */
export function vencimentoDoPasso(pb: Pick<Playbook, "blocos">, passo: Pick<PassoDoPlaybook, "bloco" | "prazoDias"> & { slaHoras?: number | null }, entrouEm: Date): Date {
  if (passo.slaHoras) return new Date(entrouEm.getTime() + passo.slaHoras * HORA);
  return new Date(entrouEm.getTime() + (inicioDoBloco(pb, passo.bloco) + passo.prazoDias) * DIA);
}

/**
 * Complementos vendidos, lidos dos NOMES dos itens da venda (não existe campo estruturado para isso).
 * Spec: o treino do Agente de IA entra quando o cliente contratou o agente "isolado ou plano Pro".
 */
export function complementosDosProdutos(produtos: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const p of produtos) {
    const n = (p ?? "").toLowerCase();
    if (/agente\s+(de\s+)?ia\b/.test(n) || /agente\s+bdr/.test(n) || /callface\s+ai\s*-\s*pro\b/.test(n)) out.add("agente_ia");
  }
  return [...out];
}
