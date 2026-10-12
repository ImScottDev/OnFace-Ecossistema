/**
 * Janelas de tempo dos relatórios, em America/Sao_Paulo, sempre [início, fim).
 *
 * O Brasil não tem horário de verão desde 2019, então o fuso é um deslocamento
 * fixo de -03:00 e a conta não depende do fuso do servidor (o `parsePeriodo`
 * antigo usava o relógio da máquina: o mesmo "mês atual" mudava de borda entre
 * o Mac e a EC2). Competência mensal é uma data de calendário, sem hora.
 */

const MS_DIA = 86_400_000;
const FUSO = "-03:00";

const dois = (n: number) => String(n).padStart(2, "0");

export function diaSP(ano: number, mes: number, dia: number): Date {
  // Date.UTC normaliza mes/dia fora do intervalo (mês 12 vira janeiro seguinte), por isso passa por ele.
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return new Date(`${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}T00:00:00${FUSO}`);
}

/** Ano/mês/dia de calendário, em São Paulo, de um instante. */
export function calendarioSP(instante: Date): { ano: number; mes: number; dia: number } {
  const d = new Date(instante.getTime() - 3 * 3_600_000);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export interface Janela {
  de: Date;
  /** Exclusivo. */
  ate: Date;
  rotulo: string;
  /** O fim da janela é depois de agora: o período ainda não fechou. */
  parcial: boolean;
}

export const PERIODOS = [
  { chave: "mes_atual", rotulo: "Mês atual" },
  { chave: "mes_passado", rotulo: "Mês passado" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "90d", rotulo: "90 dias" },
  { chave: "12m", rotulo: "12 meses" },
  { chave: "ano_atual", rotulo: "Ano atual" },
  { chave: "tudo", rotulo: "Todo o histórico" },
] as const;

export const PERIODO_RE = /^(mes_atual|mes_passado|ano_atual|tudo|\d{1,3}d|12m|custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;

const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

function fechar(de: Date, ate: Date, agora: Date, rotulo?: string): Janela {
  return { de, ate, parcial: ate.getTime() > agora.getTime(), rotulo: rotulo ?? `${fmt(de)} a ${fmt(new Date(ate.getTime() - 1))}` };
}

/** `tudo` começa em 2021-03-01, a primeira competência do faturamento histórico (fonte por fonte tem o próprio piso). */
export const INICIO_HISTORICO = diaSP(2021, 3, 1);

export function janelaDoPeriodo(periodo: string, agora = new Date()): Janela {
  const { ano, mes, dia } = calendarioSP(agora);
  const hojeInicio = diaSP(ano, mes, dia);
  const amanha = diaSP(ano, mes, dia + 1);
  if (periodo === "mes_passado") return fechar(diaSP(ano, mes - 1, 1), diaSP(ano, mes, 1), agora);
  if (periodo === "ano_atual") return fechar(diaSP(ano, 1, 1), amanha, agora);
  if (periodo === "tudo") return fechar(INICIO_HISTORICO, amanha, agora, "Todo o histórico");
  if (periodo === "12m") return fechar(diaSP(ano, mes - 11, 1), amanha, agora, "Últimos 12 meses");
  const custom = /^custom:(\d{4})-(\d{2})-(\d{2}):(\d{4})-(\d{2})-(\d{2})$/.exec(periodo);
  if (custom) {
    const de = diaSP(+custom[1], +custom[2], +custom[3]);
    const ate = diaSP(+custom[4], +custom[5], +custom[6] + 1);
    if (ate.getTime() > de.getTime()) return fechar(de, ate, agora);
  }
  const dias = /^(\d{1,3})d$/.exec(periodo);
  if (dias && +dias[1] > 0) return fechar(new Date(amanha.getTime() - +dias[1] * MS_DIA), amanha, agora, `Últimos ${dias[1]} dias`);
  // padrão e "mes_atual": do dia 1 até o fim de hoje
  return fechar(diaSP(ano, mes, 1), amanha, agora, "Mês atual");
}

/**
 * Janela de comparação: a imediatamente anterior, do mesmo tamanho. Mês parcial
 * compara com o mesmo número de dias do mês anterior (MTD contra MTD), nunca
 * com o mês anterior inteiro, senão todo mês em curso "cai".
 */
export function janelaAnterior(j: Janela, periodo: string, agora = new Date()): Janela {
  if (periodo === "mes_atual") {
    const { ano, mes, dia } = calendarioSP(agora);
    const de = diaSP(ano, mes - 1, 1);
    const ateDia = diaSP(ano, mes - 1, dia + 1);
    const fimMes = diaSP(ano, mes, 1);
    return fechar(de, ateDia.getTime() > fimMes.getTime() ? fimMes : ateDia, agora);
  }
  if (periodo === "mes_passado") {
    const { ano, mes } = calendarioSP(j.de);
    return fechar(diaSP(ano, mes - 1, 1), j.de, agora);
  }
  const tamanho = j.ate.getTime() - j.de.getTime();
  return fechar(new Date(j.de.getTime() - tamanho), j.de, agora);
}
