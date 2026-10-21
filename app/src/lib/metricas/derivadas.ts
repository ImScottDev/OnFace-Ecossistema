/**
 * Razões (win rate, conversão, % de meta, ticket): numerador / denominador de métricas JÁ catalogadas.
 *
 * Não entram em `definir()` de propósito: ele só sabe somar `valor` ou contar linhas, e é essa limitação que
 * dá ao catálogo a trava de aditividade (card = soma do detalhe). Uma razão não é aditiva; se morasse lá, a
 * trava teria que abrir exceção e deixaria de provar qualquer coisa.
 *
 * Regras que valem para toda razão:
 *   - denominador 0 ou ausente  -> valor null, motivo "sem_denominador". Nunca 0%.
 *   - denominador abaixo da amostra mínima -> valor null, motivo "amostra_pequena". A amostra mínima é limiar
 *     de produto (versionado aqui), não evidência estatística: ela só impede de exibir 100% sobre 2 casos.
 *   - numerador e denominador usam a MESMA janela: se um operando tem piso mais recente, todos começam nele.
 *   - `drillDe` diz de qual operando o clique abre os registros.
 */
import { definicao, medirDetalhado, type MedicaoDetalhada, type Periodo } from "./catalogo";
import { lerPedido } from "./consulta";
import type { Familia } from "./recorte";
import type { DrillDe } from "./painel-geral-tipos";

export const VERSAO_RAZOES = "2026-10-21.1";

/** `valor` = o número da métrica; `registros` = quantas linhas o recorte tem (para soma, o "quantos"). */
export interface Operando { codigo: string; grandeza: "valor" | "registros" }

export interface DefinicaoRazao {
  codigo: string;
  nome: string;
  unidade: "percentual" | "BRL";
  descricao: string;
  fonte: string;
  naoInclui: string;
  /** Soma dos operandos. */
  numerador: Operando[];
  /** Soma dos operandos. A amostra é a soma dos `registros` deles. */
  denominador: Operando[];
  /** Multiplica o quociente: 100 para percentual, 1 para valor. */
  escala: 100 | 1;
  amostraMinima: number;
  drillDe: DrillDe;
}

export const RAZOES: DefinicaoRazao[] = [
  {
    codigo: "win_rate",
    nome: "Win rate",
    unidade: "percentual",
    descricao: "Oportunidades ganhas dividido por ganhas + perdidas, ambas dentro da janela.",
    fonte: "booking_ganho (quantas ganhas) e oportunidades_perdidas, mesma janela.",
    naoInclui: "oportunidade ainda aberta (não ganhou nem perdeu) e perda em lote de limpeza de funil, que conta como perda no dia marcada. Não é coorte: ganha e perdida da janela podem ter nascido antes dela.",
    numerador: [{ codigo: "booking_ganho", grandeza: "registros" }],
    denominador: [{ codigo: "booking_ganho", grandeza: "registros" }, { codigo: "oportunidades_perdidas", grandeza: "valor" }],
    escala: 100, amostraMinima: 20, drillDe: "numerador",
  },
  {
    codigo: "conversao_lead_oportunidade",
    nome: "Oportunidades criadas por lead novo",
    unidade: "percentual",
    descricao: "Oportunidades criadas dentro da janela dividido por leads novos da mesma janela.",
    fonte: "oportunidades_criadas e leads_novos, mesma janela.",
    naoInclui: "coorte: a oportunidade criada na janela pode vir de lead anterior a ela, então o número pode passar de 100% e não é a chance de um lead virar oportunidade. Compara fluxos, não a mesma gente.",
    numerador: [{ codigo: "oportunidades_criadas", grandeza: "valor" }],
    denominador: [{ codigo: "leads_novos", grandeza: "valor" }],
    escala: 100, amostraMinima: 30, drillDe: "numerador",
  },
  {
    codigo: "atingimento_meta_booking",
    nome: "Atingimento da meta",
    unidade: "percentual",
    descricao: "Valor das oportunidades ganhas dividido pela meta comercial das closers nos meses da janela.",
    fonte: "booking_ganho (valor) e meta_booking, mesma janela (começa no mês mais recente entre os pisos das duas).",
    naoInclui: "setup e MRR separados: booking_ganho soma o valor da oportunidade, e a meta de meses antigos é do tipo aposentado mrr_fechado (só MRR). Mês da janela sem meta cadastrada não entra no denominador, e o mês em curso entra com a meta inteira contra o booking até hoje (subestima).",
    numerador: [{ codigo: "booking_ganho", grandeza: "valor" }],
    denominador: [{ codigo: "meta_booking", grandeza: "valor" }],
    escala: 100, amostraMinima: 1, drillDe: "denominador",
  },
  {
    codigo: "ticket_medio_booking",
    nome: "Ticket médio das vendas ganhas",
    unidade: "BRL",
    descricao: "Valor ganho dividido pelo número de oportunidades ganhas na janela.",
    fonte: "booking_ganho: valor e quantidade de registros.",
    naoInclui: "ganho de valor zero entra na quantidade e puxa a média para baixo. Mistura MRR, setup e avulso no mesmo valor.",
    numerador: [{ codigo: "booking_ganho", grandeza: "valor" }],
    denominador: [{ codigo: "booking_ganho", grandeza: "registros" }],
    escala: 1, amostraMinima: 5, drillDe: "numerador",
  },
];

export const razao = (codigo: string): DefinicaoRazao | null => RAZOES.find((r) => r.codigo === codigo) ?? null;

export type MotivoRazao = "sem_denominador" | "amostra_pequena";

/** O quociente e suas regras, puro (sem banco): é o que o teste de "denominador zero" exercita. */
export function calcularRazao(def: Pick<DefinicaoRazao, "escala" | "amostraMinima">, numerador: number, denominador: number, amostra: number):
  { valor: number | null; motivo: MotivoRazao | null } {
  if (!(denominador > 0) || amostra <= 0) return { valor: null, motivo: "sem_denominador" };
  if (amostra < def.amostraMinima) return { valor: null, motivo: "amostra_pequena" };
  return { valor: (numerador / denominador) * def.escala, motivo: null };
}

export interface ParamsRazao { periodo: string; familia?: Familia; testes?: boolean }

export interface MedicaoRazao {
  def: DefinicaoRazao;
  valor: number | null;
  motivo: MotivoRazao | null;
  numerador: number;
  denominador: number;
  amostra: number;
  /** Cada operando com o pedido que o produziu e a medição. `deComum` é preenchido quando a janela foi alinhada. */
  operandos: Record<string, { medicao: MedicaoDetalhada; periodo: string; deComum: Date | null; pisoAplicado: Date | null }>;
}

/** Querystring do recorte de uma métrica, a mesma que a rota de métricas lê. */
export function consultaDe(params: ParamsRazao): URLSearchParams {
  const q = new URLSearchParams({ periodo: params.periodo });
  if (params.familia) q.set("familia", params.familia);
  if (params.testes) q.set("testes", "1");
  return q;
}

export async function medirRazao(org: string, codigo: string, params: ParamsRazao, agora = new Date()): Promise<MedicaoRazao> {
  const def = razao(codigo);
  if (!def) throw new Error(`razão desconhecida: ${codigo}`);
  const codigos = [...new Set([...def.numerador, ...def.denominador].map((o) => o.codigo))];
  const pedidos = codigos.map((c) => {
    const ped = lerPedido(c, consultaDe(params), agora);
    if (!ped) throw new Error(`a razão ${codigo} depende de ${c}, que não está no catálogo`);
    return { c, ped, def: definicao(c)! };
  });
  // Mesma janela para todos: começa na MAIOR data de início (o piso mais recente), termina junto.
  const inicios = pedidos.filter((x) => x.def.tipo === "EVENT" && x.ped.p.de).map((x) => x.ped.p.de!.getTime());
  const comum = inicios.length ? new Date(Math.max(...inicios)) : null;
  const medicoes = await Promise.all(pedidos.map(async (x) => {
    const alinhar = comum && x.ped.p.de && x.ped.p.de.getTime() < comum.getTime();
    const p: Periodo = alinhar ? { ...x.ped.p, de: comum } : x.ped.p;
    return [x.c, { medicao: await medirDetalhado(org, x.c, p), periodo: x.ped.periodo, deComum: alinhar ? comum : null, pisoAplicado: x.ped.pisoAplicado }] as const;
  }));
  const operandos = Object.fromEntries(medicoes);
  const soma = (os: Operando[]) => os.reduce((a, o) => a + operandos[o.codigo].medicao[o.grandeza === "valor" ? "valor" : "registros"], 0);
  const amostra = def.denominador.reduce((a, o) => a + operandos[o.codigo].medicao.registros, 0);
  const numerador = soma(def.numerador), denominador = soma(def.denominador);
  return { def, numerador, denominador, amostra, operandos, ...calcularRazao(def, numerador, denominador, amostra) };
}
