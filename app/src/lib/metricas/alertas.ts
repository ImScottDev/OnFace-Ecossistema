/**
 * Alertas da Visão Geral: métrica catalogada + limiar explícito e versionado. Nunca texto gerado.
 *
 * Cada alerta aponta a métrica que o prova (o clique abre o drill dela) e traz uma frase que cita o próprio
 * número. Mudou um limiar? Muda aqui e sobe `VERSAO_LIMIARES`: o painel devolve a versão junto, então um
 * alerta que sumiu ou apareceu é explicável. Alertas são sempre do consolidado: ignoram o filtro de família
 * do painel (um alerta que some porque alguém filtrou PABX esconde problema).
 */
import { medir } from "./catalogo";
import { calendarioSP, diaSP, janelaDoPeriodo } from "./janela";
import type { Alerta, Cartao, SeveridadeAlerta } from "./painel-geral-tipos";

export const VERSAO_LIMIARES = "2026-10-21.1";

/** Os limiares, num lugar só. */
export const LIMIARES = {
  faturasStripeForaDaPlanilha: { periodo: "12m", acimaDe: 0 },
  mrrEmRisco: { acimaDe: 0 },
  oportunidadesEstagnadas: { acimaDe: 0 },
  /** Closers ativas com meta cadastrada no mês, abaixo do total de ativas. */
  metaDoMes: { periodo: "mes_atual" },
  /** Último mês fechado contra a média dos N anteriores a ele. */
  churn: { mesesBase: 3 },
} as const;

export interface ContextoAlertas {
  obter: (codigo: string, periodo: string) => Promise<Cartao>;
  closersAtivos: () => Promise<number>;
  organizacaoId: string;
  incluirTestes: boolean;
  agora: Date;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function base(id: string, titulo: string, severidade: SeveridadeAlerta, metrica: string, limiarDescricao: string): Alerta {
  return { id, titulo, severidade, metrica, situacao: "indisponivel", frase: null, valor: null, drill: null, motivo: null, limiar: { descricao: limiarDescricao, versao: VERSAO_LIMIARES } };
}

/** Cartão sem valor: o alerta fica "indisponível" com o motivo do cartão, nunca "ok". */
function semValor(a: Alerta, c: Cartao): Alerta {
  return { ...a, situacao: "indisponivel", motivo: c.motivo ?? { codigo: "erro", mensagem: "A métrica que prova este alerta não pôde ser calculada." }, drill: c.drill };
}

function simples(
  a: Alerta, c: Cartao, acimaDe: number, frase: (c: Cartao & { valor: number }) => string,
): Alerta {
  if (c.valor === null) return semValor(a, c);
  const disparado = c.valor > acimaDe;
  return { ...a, situacao: disparado ? "disparado" : "ok", valor: c.valor, frase: disparado ? frase(c as Cartao & { valor: number }) : null, drill: c.drill };
}

export async function avaliarAlertas(ctx: ContextoAlertas): Promise<Alerta[]> {
  const L = LIMIARES;
  const executar = async (a: Alerta, f: () => Promise<Alerta>): Promise<Alerta> => {
    try { return await f(); }
    catch { return { ...a, situacao: "indisponivel", motivo: { codigo: "erro", mensagem: "Não foi possível verificar este alerta agora." } }; }
  };

  const faturas = base("faturas_stripe_fora_da_planilha", "Cobrança no Stripe sem linha na planilha", "atencao", "faturas_stripe_fora_da_planilha",
    `valor > R$ ${L.faturasStripeForaDaPlanilha.acimaDe} nos últimos 12 meses`);
  const risco = base("mrr_em_risco", "Cobrança vencida no Stripe", "critica", "mrr_em_risco", `MRR em past_due > R$ ${L.mrrEmRisco.acimaDe}`);
  const estagnadas = base("oportunidades_estagnadas", "Oportunidades marcadas como estagnadas", "atencao", "oportunidades_estagnadas",
    `quantidade > ${L.oportunidadesEstagnadas.acimaDe}`);
  const meta = base("meta_do_mes", "Meta do mês incompleta", "atencao", "meta_booking", "closers ativas com meta no mês < closers ativas");
  const churn = base("churn_acima_da_media", "Cancelamento acima da média recente", "atencao", "mrr_cancelado",
    `MRR cancelado no último mês fechado > média dos ${L.churn.mesesBase} meses anteriores (só Stripe)`);

  return Promise.all([
    executar(faturas, async () => simples(faturas, await ctx.obter("faturas_stripe_fora_da_planilha", L.faturasStripeForaDaPlanilha.periodo), L.faturasStripeForaDaPlanilha.acimaDe,
      (c) => `${brl(c.valor)} em ${plural(c.registros ?? 0, "empresa-mês", "empresas-mês")} cobrados no Stripe sem linha na planilha de faturamento do mesmo mês, nos últimos 12 meses.`)),
    executar(risco, async () => simples(risco, await ctx.obter("mrr_em_risco", "mes_atual"), L.mrrEmRisco.acimaDe,
      (c) => `${brl(c.valor)} de MRR em ${plural(c.registros ?? 0, "assinatura Stripe", "assinaturas Stripe")} com cobrança vencida (past_due).`)),
    executar(estagnadas, async () => simples(estagnadas, await ctx.obter("oportunidades_estagnadas", "mes_atual"), L.oportunidadesEstagnadas.acimaDe,
      (c) => `${plural(c.valor, "oportunidade aberta marcada", "oportunidades abertas marcadas")} como estagnada${c.valor === 1 ? "" : "s"}.`)),
    executar(meta, async () => {
      const c = await ctx.obter("meta_booking", L.metaDoMes.periodo);
      if (c.valor === null) return semValor(meta, c);
      const ativas = await ctx.closersAtivos();
      const comMeta = c.registros ?? 0;
      const disparado = ativas > 0 && comMeta < ativas;
      return { ...meta, situacao: disparado ? "disparado" as const : "ok" as const, valor: comMeta, drill: c.drill,
        frase: disparado ? `${comMeta} de ${ativas} closers ativas têm meta cadastrada neste mês.` : null };
    }),
    executar(churn, async () => {
      const c = await ctx.obter("mrr_cancelado", "mes_passado");
      if (c.valor === null) return semValor(churn, c);
      const { ano, mes } = calendarioSP(ctx.agora);
      const meses = Array.from({ length: L.churn.mesesBase }, (_, i) => ({ de: diaSP(ano, mes - 2 - i, 1), ate: diaSP(ano, mes - 1 - i, 1) }));
      const valores = await Promise.all(meses.map((m) => medir(ctx.organizacaoId, "mrr_cancelado", { de: m.de, ate: m.ate, incluirTestes: ctx.incluirTestes })));
      const media = valores.reduce((s, v) => s + v.valor, 0) / valores.length;
      if (!(media > 0)) return { ...churn, drill: c.drill, motivo: { codigo: "sem_denominador" as const, mensagem: `Os ${L.churn.mesesBase} meses anteriores não têm cancelamento Stripe: não há média para comparar.` } };
      const disparado = c.valor > media;
      const rotulo = janelaDoPeriodo("mes_passado", ctx.agora).rotulo;
      return { ...churn, situacao: disparado ? "disparado" as const : "ok" as const, valor: c.valor, drill: c.drill,
        frase: disparado ? `${brl(c.valor)} de MRR cancelado no Stripe no mês fechado (${rotulo}), contra média de ${brl(media)} nos ${L.churn.mesesBase} meses anteriores.` : null };
    }),
  ]);
}
