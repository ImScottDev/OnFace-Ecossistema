/**
 * Regras puras do Início: quem vê o quê, e a aritmética que a tela mostra.
 *
 * Nada aqui toca banco, relógio ou sessão: o teste exercita cada decisão de
 * papel e cada conta sem subir nada, e a tela só desenha o que estas funções
 * devolvem. Quando um número da home parece errado, a conta mora aqui.
 */
import { isAdminView, isReader } from "@/lib/auth/roles";
import { SLA_PRE_VENDAS } from "@/lib/vendas/sla";
import type { Delta, Lente, MesDeMrr, Severidade, Tom } from "./tipos";

/* ═══ Papel → lente ═══════════════════════════════════════════════════════ */

/**
 * Cada papel cai numa lente; a lente é o que a home desenha.
 *
 *   admin, gerente, director, coordinator, super_admin → gestão (o negócio todo)
 *   operations                                          → operação (entrega e retenção)
 *   closer, vendedor                                    → closer (o pipeline DELE)
 *   sdr                                                 → sdr (a fila DELE)
 *   leitor                                              → leitor (panorama, sem ação)
 *
 * Papel desconhecido cai em closer, a lente pessoal: na dúvida, mostra menos.
 * `isAdminView` é a fonte única de "quem enxerga a organização inteira" (a
 * mesma do middleware e do Financeiro), então "ver como" já chega aqui com o
 * papel efetivo.
 */
export function lenteDoPapel(role: string | null | undefined): Lente {
  if (isReader(role)) return "leitor";
  if (role === "operations") return "operacao";
  if (isAdminView(role)) return "gestao";
  if (role === "sdr") return "sdr";
  return "closer";
}

export interface PermissoesDaLente {
  /** Enxerga a organização inteira (dado agregado de todos). */
  organizacao: boolean;
  /** Financeiro, integrações e entrega: telas que o middleware reserva à gestão. */
  gestao: boolean;
  /** Lista de registros individuais (lead, proposta, conversa) com nome. */
  registros: boolean;
  /** Botões e links que levam a tela de escrita. */
  acoes: boolean;
}

export function permissoesDaLente(lente: Lente): PermissoesDaLente {
  switch (lente) {
    case "gestao":
      return { organizacao: true, gestao: true, registros: true, acoes: true };
    case "operacao":
      return { organizacao: true, gestao: true, registros: true, acoes: true };
    case "leitor":
      // Leitor é relatório curado: agregado da organização, sem nome de ninguém.
      return { organizacao: true, gestao: false, registros: false, acoes: false };
    default:
      return { organizacao: false, gestao: false, registros: true, acoes: true };
  }
}

/* ═══ Tempo e saudação ════════════════════════════════════════════════════ */

const FUSO = "America/Sao_Paulo";

export function saudacaoDaHora(hora: number): string {
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

export function horaEmSaoPaulo(agora: Date): number {
  return Number(agora.toLocaleString("pt-BR", { timeZone: FUSO, hour: "2-digit", hour12: false })) % 24;
}

export function dataPorExtenso(agora: Date): string {
  const t = agora.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** YYYY-MM-DD do dia em São Paulo. */
export function chaveDoDia(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: FUSO });
}

/** As `n` chaves de dia terminando hoje, da mais antiga para hoje. */
export function ultimosDias(agora: Date, n: number): string[] {
  const hoje = chaveDoDia(agora);
  const base = new Date(`${hoje}T12:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** Dias úteis (seg-sex) de hoje até o fim do mês, hoje incluso. Sem feriados:
 *  não existe fonte de feriados no produto, e a tela diz "dias úteis" sem
 *  prometer calendário. */
export function diasUteisAteOFimDoMes(hoje: Date): number {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const c = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let n = 0;
  while (c <= fim) {
    const d = c.getDay();
    if (d !== 0 && d !== 6) n++;
    c.setDate(c.getDate() + 1);
  }
  return n;
}

/** "12 min", "3 h", "2 d": a idade de uma espera, na menor unidade que não mente. */
export function duracaoCurta(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/* ═══ Moeda ═══════════════════════════════════════════════════════════════ */

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 51.862": o valor que decide, sem centavo. */
export const brlInteiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "R$ 842", "R$ 12,4 mil", "R$ 1,2 mi". Dinheiro grande não precisa de centavo. */
export function moedaCompacta(v: number): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (a < 1000) return `${sinal}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
  if (a < 1_000_000) return `${sinal}R$ ${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
}

/* ═══ Delta e tom ═════════════════════════════════════════════════════════ */

/**
 * Variação contra o período anterior, com o tom que o SINAL pede.
 *
 * O tom sai do número e de "mais é melhor?", nunca da marcação: o frame do
 * Figma trazia os quatro KPIs com o mesmo selo verde, e com dado real isso virou
 * "−78%" pintado de verde. Sem base (anterior ≤ 0) não há percentual: é "sem
 * base", em tom neutro, porque "não sei" e "não mudou" são coisas diferentes.
 * Variação que arredonda para 0% também é neutra.
 */
export function deltaDe(atual: number, anterior: number | null, opts: { maisEhMelhor?: boolean } = {}): Delta {
  const maisEhMelhor = opts.maisEhMelhor ?? true;
  if (anterior === null || !Number.isFinite(anterior) || anterior <= 0) {
    return { pct: null, tom: "neutro", texto: "sem base" };
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { pct: 0, tom: "neutro", texto: "0%" };
  const subiu = pct > 0;
  const tom: Tom = subiu === maisEhMelhor ? "ok" : "risco";
  return { pct, tom, texto: `${subiu ? "+" : "−"}${Math.abs(pct)}%` };
}

/** Variação já calculada (ex.: MRR na janela, vinda do ledger). */
export function deltaDePct(pct: number | null, opts: { maisEhMelhor?: boolean } = {}): Delta {
  if (pct === null || !Number.isFinite(pct)) return { pct: null, tom: "neutro", texto: "sem base" };
  const r = Math.round(pct);
  if (r === 0) return { pct: 0, tom: "neutro", texto: "0%" };
  const maisEhMelhor = opts.maisEhMelhor ?? true;
  return { pct: r, tom: (r > 0) === maisEhMelhor ? "ok" : "risco", texto: `${r > 0 ? "+" : "−"}${Math.abs(r)}%` };
}

/* ═══ Meta ════════════════════════════════════════════════════════════════ */

/**
 * Quanto falta por dia útil para bater a meta. Null quando não há meta (alvo ≤ 0)
 * ou já bateu: "ritmo necessário" de meta batida seria um número sem uso.
 */
export function ritmoPorDia(alvo: number | null, realizado: number, diasUteisRestantes: number): number | null {
  if (!alvo || alvo <= 0) return null;
  const falta = alvo - realizado;
  if (falta <= 0 || diasUteisRestantes <= 0) return null;
  return falta / diasUteisRestantes;
}

export function pctDaMeta(alvo: number | null, realizado: number): number | null {
  if (!alvo || alvo <= 0) return null;
  return Math.round((realizado / alvo) * 100);
}

/* ═══ MRR por mês ═════════════════════════════════════════════════════════ */

export interface LinhaLedger { mes: string; tipo: string; delta: number }

const GANHOS = new Set(["novo", "reativacao", "expansao"]);
const PERDAS = new Set(["contracao", "churn"]);

/**
 * Monta os últimos `n` meses de movimento de MRR (terminando no mês de `hoje`),
 * preenchendo com zero o mês sem movimento. O que entra é novo + reativação +
 * expansão; o que sai é contração + churn (o delta já vem negativo). Tipo que
 * este código não conhece não entra em nenhum lado: melhor omitir do que
 * classificar no chute.
 */
export function mesesDeMrr(linhas: LinhaLedger[], hoje: Date, n = 6): MesDeMrr[] {
  const porMes = new Map<string, { entrou: number; saiu: number }>();
  for (const l of linhas) {
    const a = porMes.get(l.mes) ?? { entrou: 0, saiu: 0 };
    if (GANHOS.has(l.tipo)) a.entrou += l.delta;
    else if (PERDAS.has(l.tipo)) a.saiu += l.delta;
    porMes.set(l.mes, a);
  }
  const saida: MesDeMrr[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    const nome = ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const v = porMes.get(chave) ?? { entrou: 0, saiu: 0 };
    saida.push({
      rotulo: nome.charAt(0).toUpperCase() + nome.slice(1),
      entrou: Math.round(v.entrou),
      saiu: Math.round(v.saiu),
      liquido: Math.round(v.entrou + v.saiu),
    });
  }
  return saida;
}

/* ═══ Série → SVG ═════════════════════════════════════════════════════════ */

export interface CaminhoDeSerie {
  /** `d` do traço da linha. */
  linha: string;
  /** `d` da área sob a linha, fechada na base. */
  area: string;
  pontos: Array<{ x: number; y: number; valor: number }>;
  max: number;
  min: number;
}

/**
 * Converte uma série em coordenadas de SVG dentro de `largura × altura`, com
 * `folga` em cima e embaixo para a linha não encostar na borda.
 *
 * Série constante vira reta no meio (não divide por zero), ou rente à base com
 * `baseZero` quando o valor é zero. Série com um ponto só devolve um ponto e
 * nenhuma linha: um ponto não é tendência.
 */
export function caminhoDeSerie(
  valores: number[], largura: number, altura: number, folga = 3, opts: { baseZero?: boolean } = {},
): CaminhoDeSerie | null {
  if (valores.length === 0) return null;
  const max = Math.max(...valores);
  // Contagem e dinheiro por dia têm zero como chão: uma série de 10 a 12 não
  // pode parecer um despenhadeiro só porque o eixo foi cortado em 10.
  const min = opts.baseZero ? Math.min(0, ...valores) : Math.min(...valores);
  const faixa = max - min;
  const util = Math.max(1, altura - folga * 2);
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0;
  const pontos = valores.map((valor, i) => ({
    x: Number((i * passo).toFixed(2)),
    y: Number((faixa === 0 ? (opts.baseZero && max === 0 ? altura - folga : altura / 2) : folga + util - ((valor - min) / faixa) * util).toFixed(2)),
    valor,
  }));
  if (pontos.length === 1) return { linha: "", area: "", pontos, max, min };
  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const area = `${linha} L${pontos[pontos.length - 1].x} ${altura} L${pontos[0].x} ${altura} Z`;
  return { linha, area, pontos, max, min };
}

/* ═══ SLA da fila de 1º contato ═══════════════════════════════════════════ */

/**
 * Separa a fila pelo relógio da etapa "novo" (a política que o board já usa:
 * `SLA_PRE_VENDAS.novo`). Lead que chegou há mais do `vencido` está fora do SLA;
 * entre `vencendo` e `vencido`, vencendo; antes disso, no prazo.
 */
export function classificarFila(horasDesdeAChegada: number[]): { foraDoSla: number; vencendo: number; noPrazo: number } {
  const p = SLA_PRE_VENDAS.novo;
  let foraDoSla = 0, vencendo = 0, noPrazo = 0;
  for (const h of horasDesdeAChegada) {
    if (h >= p.vencido) foraDoSla++;
    else if (h >= p.vencendo) vencendo++;
    else noPrazo++;
  }
  return { foraDoSla, vencendo, noPrazo };
}

/* ═══ Atenção ═════════════════════════════════════════════════════════════ */

const PESO_SEVERIDADE: Record<Severidade, number> = { critico: 0, alto: 1, moderado: 2 };

/** Ordem de trabalho: severidade primeiro, e dentro dela o que tem mais dinheiro
 *  ou mais tempo parado (`ordem` maior vem antes). Estável. */
export function ordenarPorUrgencia<T extends { severidade: Severidade; ordem?: number }>(itens: T[]): T[] {
  return itens
    .map((item, i) => ({ item, i }))
    .sort((a, b) =>
      PESO_SEVERIDADE[a.item.severidade] - PESO_SEVERIDADE[b.item.severidade]
      || (b.item.ordem ?? 0) - (a.item.ordem ?? 0)
      || a.i - b.i)
    .map((x) => x.item);
}

export function contarPorSeveridade(itens: Array<{ severidade: Severidade }>): Record<Severidade, number> {
  const r: Record<Severidade, number> = { critico: 0, alto: 0, moderado: 0 };
  for (const i of itens) r[i.severidade]++;
  return r;
}

/* ═══ Foco do dia ═════════════════════════════════════════════════════════ */

export interface SinalDoFoco { n: number; singular: string; plural: string }

/**
 * A linha de foco sob a saudação: até três contagens reais, nunca uma frase de
 * efeito. Sinal zerado some. Se todos os blocos que alimentam a frase foram
 * lidos e nenhum tem pendência, `vazio` é verdadeiro e a tela pode dizer que
 * não há nada pedindo; se algum bloco falhou, a frase não afirma ausência.
 */
export function focoDoDia(sinais: SinalDoFoco[], leituraCompleta: boolean): { frases: string[]; vazio: boolean } | null {
  const frases = sinais
    .filter((s) => s.n > 0)
    .slice(0, 3)
    .map((s) => `${s.n.toLocaleString("pt-BR")} ${s.n === 1 ? s.singular : s.plural}`);
  if (frases.length > 0) return { frases, vazio: false };
  return leituraCompleta ? { frases: [], vazio: true } : null;
}
