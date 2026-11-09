/**
 * Formatação do pós-venda. Funções puras: nenhuma lê o relógio da máquina.
 *
 * Quem precisa de "agora" recebe `agora` por argumento. É o que impede o erro
 * de hidratação (servidor diz "há 3 dias", cliente diz "há 3 dias e um
 * minuto") e é o que deixa estas funções testáveis sem fingir o tempo.
 *
 * O fuso é o do negócio, não o da máquina: o servidor roda em UTC e o time
 * em São Paulo, então "vence hoje" calculado na máquina erra de dia entre
 * 21h e meia-noite.
 */
import type { Familia, MotivoDaEspera, EstadoDoProjeto, EstadoDaTarefa } from "@/lib/pos-venda/contrato";

export const FUSO = "America/Sao_Paulo";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/** Ano, mês e dia do calendário de São Paulo para um instante. */
function partesNoFuso(d: Date): { a: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { a: n("year"), m: n("month"), d: n("day") };
}

/** Diferença em DIAS DE CALENDÁRIO (não em blocos de 24h) entre dois instantes. Positivo = `b` é depois de `a`. */
export function diasDeCalendario(a: Date, b: Date): number {
  const x = partesNoFuso(a);
  const y = partesNoFuso(b);
  return Math.round((Date.UTC(y.a, y.m - 1, y.d) - Date.UTC(x.a, x.m - 1, x.d)) / 86_400_000);
}

/** "24 nov" — com o ano quando não é o de `agora`. */
export function dia(d: Date, agora: Date): string {
  const p = partesNoFuso(d);
  const ano = partesNoFuso(agora).a;
  return `${p.d} ${MESES[p.m - 1]}${p.a !== ano ? ` ${p.a}` : ""}`;
}

export function hora(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function diaEHora(d: Date, agora: Date): string {
  return `${dia(d, agora)}, ${hora(d)}`;
}

/** Cabeçalho de grupo da linha do tempo: "Hoje", "Ontem" ou "3 nov". */
export function rotuloDoDia(d: Date, agora: Date): string {
  const delta = diasDeCalendario(d, agora);
  if (delta === 0) return "Hoje";
  if (delta === 1) return "Ontem";
  return dia(d, agora);
}

/** Chave estável de agrupamento por dia (AAAA-MM-DD no fuso do negócio). */
export function chaveDoDia(d: Date): string {
  const p = partesNoFuso(d);
  return `${p.a}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "há 3 dias", "hoje", "ontem". Para eventos passados. */
export function haQuanto(d: Date, agora: Date): string {
  const delta = diasDeCalendario(d, agora);
  if (delta <= 0) {
    const min = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 60_000));
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    return `há ${Math.floor(min / 60)} h`;
  }
  if (delta === 1) return "ontem";
  return `há ${plural(delta, "dia", "dias")}`;
}

/** Duração em horas para leitura humana: "45 min", "26 h", "3 d 4 h". */
export function duracao(horas: number): string {
  if (!Number.isFinite(horas) || horas < 0) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas)} h`;
  const d = Math.floor(horas / 24);
  const h = Math.round(horas - d * 24);
  return h === 0 ? `${d} d` : `${d} d ${h} h`;
}

export type Prazo = {
  texto: string;
  /** "risco" só quando o dado diz que estourou. */
  tom: "risco" | "neutro";
};

/**
 * O prazo de um projeto ou de uma tarefa, em palavras.
 * `null` não vira "sem prazo" por conveniência: o motivo vem do chamador.
 */
export function prazo(venceEm: Date | null, agora: Date, ausente = "Sem prazo"): Prazo {
  if (!venceEm) return { texto: ausente, tom: "neutro" };
  const delta = diasDeCalendario(agora, venceEm);
  if (delta < 0) return { texto: `Venceu há ${plural(-delta, "dia", "dias")}`, tom: "risco" };
  if (delta === 0) return { texto: "Vence hoje", tom: "neutro" };
  if (delta === 1) return { texto: "Vence amanhã", tom: "neutro" };
  if (delta <= 14) return { texto: `Vence em ${delta} dias`, tom: "neutro" };
  return { texto: `Vence em ${dia(venceEm, agora)}`, tom: "neutro" };
}

export function moeda(n: number | null): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function percentual(fracao: number): number {
  if (!Number.isFinite(fracao)) return 0;
  return Math.max(0, Math.min(100, Math.round(fracao * 100)));
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** "AAAA-MM-DD" do calendário de São Paulo, para mandar a data ao servidor sem ambiguidade de fuso. */
export function dataParaEnvio(d: Date): string {
  return chaveDoDia(d);
}

// ─── Vocabulário ───────────────────────────────────────────────────────────

export type Tom = "andamento" | "espera" | "validacao" | "ok" | "risco" | "neutro";

export const ESTADO_DO_PROJETO: Record<EstadoDoProjeto, { rotulo: string; tom: Tom }> = {
  NAO_INICIADO: { rotulo: "Não iniciado", tom: "neutro" },
  EM_ANDAMENTO: { rotulo: "Em andamento", tom: "andamento" },
  AGUARDANDO: { rotulo: "Aguardando", tom: "espera" },
  EM_VALIDACAO: { rotulo: "Em validação", tom: "validacao" },
  CONCLUIDO: { rotulo: "Concluído", tom: "ok" },
  CANCELADO: { rotulo: "Cancelado", tom: "neutro" },
};

export const ESTADO_DA_TAREFA: Record<EstadoDaTarefa, { rotulo: string; tom: Tom }> = {
  A_FAZER: { rotulo: "A fazer", tom: "neutro" },
  EM_ANDAMENTO: { rotulo: "Em andamento", tom: "andamento" },
  AGUARDANDO: { rotulo: "Aguardando", tom: "espera" },
  CONCLUIDA: { rotulo: "Concluída", tom: "ok" },
  NAO_SE_APLICA: { rotulo: "Não se aplica", tom: "neutro" },
};

export const FAMILIAS: Record<Familia, { rotulo: string }> = {
  CALLFACE_AI: { rotulo: "Callface AI" },
  PABX: { rotulo: "PABX" },
  WHITE_LABEL: { rotulo: "White Label" },
};
export const ORDEM_DAS_FAMILIAS: Familia[] = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];

export const MOTIVOS: Record<MotivoDaEspera, { rotulo: string; frase: string; explicacao: string }> = {
  cliente: { rotulo: "Cliente", frase: "A bola está com o cliente", explicacao: "Esperando material, resposta ou aceite" },
  operadora: { rotulo: "Operadora", frase: "A bola está com a operadora", explicacao: "Portabilidade, liberação de tronco, prazo externo" },
  interno: { rotulo: "Interno", frase: "A bola está com outra área da casa", explicacao: "Dependência de outro time nosso" },
};

export const TIPO: Record<"ONBOARDING" | "IMPLEMENTATION", string> = {
  ONBOARDING: "Onboarding",
  IMPLEMENTATION: "Implantação",
};

/** Cor do avatar por nome: o mesmo nome tem sempre a mesma cor, em qualquer tela. */
export function corDoAvatar(chave: string): 1 | 2 | 3 | 4 | 5 | 6 {
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  return ((h % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}
