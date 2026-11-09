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
    // Esta função só faz conta de duração; de onde vem o prazo e se ele já foi
    // remarcado é leitura de projeto, e quem preenche é `relogiosDe` (montagem).
    venceEmOriginal: null,
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

// ---------------------------------------------------------------------------
// Chave do campo de levantamento
// ---------------------------------------------------------------------------

/**
 * O limite da `chave` que a server action aceita (`actions.ts`, `slice(0, 64)`).
 * A base fica menor para o sufixo de desempate caber sem ser cortado.
 */
const MAX_CHAVE = 64;
const MAX_BASE = 56;

/**
 * A chave de um campo de levantamento, a partir do rótulo que a pessoa digitou.
 *
 * **A regra é DE PROPÓSITO a mesma de `/ajustes/campos-custom`** (`slugify`,
 * `page.tsx:51`): minúsculas, sem acento, não-alfanumérico vira `_`. É lá que
 * nasce a definição em `custom_fields`, e quando o template de organização
 * chegar as duas superfícies têm de produzir a MESMA chave para o mesmo rótulo
 * — senão o campo criado no projeto e o criado em Ajustes viram dois campos.
 *
 * Existe aqui, exportada, porque o gerador estava sendo escrito uma terceira
 * vez dentro da tela: dois geradores divergindo em acento, hífen ou tamanho
 * fazem o mesmo rótulo virar duas chaves, e aí o valor preenchido desaparece.
 *
 * `existentes` resolve colisão com sufixo numérico, porque nada impede a pessoa
 * de criar dois campos com o mesmo nome.
 */
export function chaveDoCampo(rotulo: string, existentes: readonly string[] = []): string {
  const base = rotulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_BASE)
    .replace(/_+$/, "")
    // Rótulo só de emoji, pontuação ou espaço não gera chave nenhuma: sem um
    // nome estável o valor não tem onde morar na próxima leitura.
    || "campo";

  const tomadas = new Set(existentes);
  if (!tomadas.has(base)) return base;
  // Começa em 2: o primeiro campo é o sem sufixo, como a pessoa espera ler.
  for (let n = 2; n <= 99; n += 1) {
    const tentativa = `${base}_${n}`.slice(0, MAX_CHAVE);
    if (!tomadas.has(tentativa)) return tentativa;
  }
  // Cem campos com o mesmo rótulo é erro de uso, não caso de produto. Ainda
  // assim não devolve chave repetida, que apagaria o valor do campo anterior.
  return `${base}_${Date.now().toString(36)}`.slice(0, MAX_CHAVE);
}
