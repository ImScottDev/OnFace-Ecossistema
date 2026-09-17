import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getMetaComercialAgregada } from "@/lib/metas";
import { getFechadoPeriodo, getWinRate, getTicketMedio } from "@/lib/relatorios/comercial";
import { getPulsoPreVendas } from "@/lib/analytics/pre-vendas";
import {
  getColaboradoresComerciais, getPipelinePorEtapa, getPropostasResumo,
  getMovimentoComercialSerie, getAtencaoComercial, getForecastResumo,
  getOrigemOportunidades, getPreVendasEscopo, getPerformanceTime,
} from "@/lib/analytics/vendas-visao-geral";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2FiltrosVendas, type PeriodoKey } from "@/components/crm2/vendas/FiltrosVendas";
import { Cf2MovimentoComercial } from "@/components/crm2/vendas/MovimentoComercial";
import {
  Cf2PulsoComercial, Cf2PulsoPreVenda, Cf2CardPreVendas, Cf2CardPipeline,
  Cf2CardPropostas, Cf2PulsoNegocio, Cf2CardOrigem, Cf2CardAtencao,
  Cf2PerformanceTime, type KpiPulso,
} from "@/components/crm2/vendas/Blocos";

/**
 * Visão Geral de Vendas — cockpit comercial (30/08, 2ª volta).
 *
 * Layout segue a referência visual do Kauã: alterna faixa ESCURA e cards
 * CLAROS (hero → Pré-Venda escuro → 3 cards claros → Pulso do Negócio escuro
 * → 2 cards claros → Performance escuro). A 1ª versão fez tudo escuro e não
 * parecia a referência — a alternância é o ritmo da tela.
 *
 * Server Component de propósito: os filtros (período + colaborador) vivem na
 * URL e TODA query recebe `inicio/fim/responsavelId`. É isso que faz "mudar o
 * filtro muda a tela inteira" ser verdade, e não só uma parte dela.
 */

export const dynamic = "force-dynamic";

const brl0 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

function saudacao(hora: number) {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Resolve o período escolhido em janela real. */
function resolverPeriodo(chave: PeriodoKey, hoje: Date) {
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanha = new Date(hojeZero.getTime() + 86_400_000);
  const porDias = (n: number) => ({ inicio: new Date(hojeZero.getTime() - (n - 1) * 86_400_000), fim: amanha });

  switch (chave) {
    case "7d": return porDias(7);
    case "30d": return porDias(30);
    case "90d": return porDias(90);
    case "mes_anterior":
      return {
        inicio: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
        fim: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
      };
    case "ano": return { inicio: new Date(hoje.getFullYear(), 0, 1), fim: amanha };
    case "mes":
    default: return { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: amanha };
  }
}

/** Janela anterior de mesmo tamanho — dá o "vs período anterior" dos deltas. */
function janelaAnterior(inicio: Date, fim: Date) {
  const duracao = fim.getTime() - inicio.getTime();
  return { inicio: new Date(inicio.getTime() - duracao), fim: inicio };
}

/** "01 - 29 ago 2026" — formato da pílula de período na referência. */
function rotuloIntervalo(i: Date, f: Date) {
  const ultimo = new Date(f.getTime() - 86_400_000);
  const dd = (d: Date) => String(d.getDate()).padStart(2, "0");
  const mes = ultimo.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const mesIni = i.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return i.getMonth() === ultimo.getMonth()
    ? `${dd(i)} - ${dd(ultimo)} ${mes} ${ultimo.getFullYear()}`
    : `${dd(i)} ${mesIni} - ${dd(ultimo)} ${mes} ${ultimo.getFullYear()}`;
}

/** Dias úteis (seg–sex) que ainda restam dentro da janela, contando hoje. */
function diasUteisRestantes(hoje: Date, fim: Date) {
  let n = 0;
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  while (cursor < fim) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) n++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
}

const semanaIso = (d: Date) => {
  const alvo = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  alvo.setUTCDate(alvo.getUTCDate() + 4 - (alvo.getUTCDay() || 7));
  const inicioAno = new Date(Date.UTC(alvo.getUTCFullYear(), 0, 1));
  return Math.ceil(((alvo.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
};

export default async function VendasVisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; responsavel?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const sessao = await auth();

  const sp = await searchParams;
  const periodo = (sp.periodo ?? "mes") as PeriodoKey;
  const responsavelId = sp.responsavel || null;

  const hoje = new Date();
  const { inicio, fim } = resolverPeriodo(periodo, hoje);
  const anterior = janelaAnterior(inicio, fim);
  // Win rate/ticket médio usam janela FIXA de 90 dias, não a do filtro: com
  // "últimos 7 dias" a amostra seria pequena demais pra a taxa significar algo
  // (o ciclo de venda real é mais longo que o período de exibição).
  const desde90 = new Date(hoje.getTime() - 90 * 86_400_000);

  const [
    org, colaboradores, fechado, fechadoAnterior, metaAgregada, winRate,
    ticketMedio, etapas, propostas, propostasAnt, movimento, atencao,
    origem, preVendas, preVendasAnt, pulsoSDR, performance,
  ] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getColaboradoresComerciais(ctx.organizacaoId),
    getFechadoPeriodo(ctx.organizacaoId, inicio, fim, responsavelId),
    getFechadoPeriodo(ctx.organizacaoId, anterior.inicio, anterior.fim, responsavelId),
    getMetaComercialAgregada(ctx.organizacaoId, hoje),
    getWinRate(ctx.organizacaoId, desde90, hoje, responsavelId),
    getTicketMedio(ctx.organizacaoId, desde90, hoje, responsavelId),
    getPipelinePorEtapa(ctx.organizacaoId, responsavelId),
    getPropostasResumo(ctx.organizacaoId, inicio, fim, responsavelId),
    getPropostasResumo(ctx.organizacaoId, anterior.inicio, anterior.fim, responsavelId),
    getMovimentoComercialSerie(ctx.organizacaoId, inicio, fim, responsavelId),
    getAtencaoComercial(ctx.organizacaoId, responsavelId),
    getOrigemOportunidades(ctx.organizacaoId, inicio, fim, responsavelId),
    getPreVendasEscopo(ctx.organizacaoId, inicio, fim, responsavelId),
    getPreVendasEscopo(ctx.organizacaoId, anterior.inicio, anterior.fim, responsavelId),
    // Só pelo tempo de qualificação e SLA de 1º contato — métricas caras que
    // já existem prontas aqui e não vale reimplementar.
    getPulsoPreVendas(ctx.organizacaoId, inicio, fim),
    getPerformanceTime(ctx.organizacaoId, inicio, fim, desde90, responsavelId),
  ]);

  // Meta: com colaborador selecionado a régua é a meta DELE — a agregada da
  // org compararia o resultado de uma pessoa contra o alvo do time inteiro.
  const metaEscopo = responsavelId
    ? (performance.find((p) => p.id === responsavelId)?.meta ?? 0)
    : metaAgregada.valorAlvo;

  const forecast = await getForecastResumo(ctx.organizacaoId, inicio, fim, metaEscopo, responsavelId);

  const orgNome = org[0]?.nome || "Callface";
  const primeiroNome = (sessao?.user?.name || "").split(" ")[0];
  const pessoaSelecionada = responsavelId
    ? colaboradores.find((c) => c.id === responsavelId)?.nome ?? "colaborador"
    : null;

  const deltaFechado = fechadoAnterior.receita > 0
    ? ((fechado.receita - fechadoAnterior.receita) / fechadoAnterior.receita) * 100
    : null;
  const deltaConversao = preVendasAnt.taxaQualificacao != null && preVendas.taxaQualificacao != null
    ? preVendas.taxaQualificacao - preVendasAnt.taxaQualificacao
    : null;

  const totalAtivos = etapas.reduce((s, e) => s + e.total, 0);
  // Tempo médio do pipeline = média dos tempos de etapa PONDERADA pela
  // quantidade em cada uma (média simples daria o mesmo peso pra uma etapa
  // com 2 negócios e outra com 39).
  const tempoMedioPipeline = totalAtivos > 0
    ? etapas.reduce((s, e) => s + (e.tempoMedioDias ?? 0) * e.total, 0) / totalAtivos
    : null;

  const sinal = (k: string) => atencao.find((s) => s.key === k)?.total ?? 0;
  const metaPct = metaEscopo > 0 ? Math.round((fechado.receita / metaEscopo) * 100) : null;

  const kpis: KpiPulso[] = [
    {
      key: "pipeline", label: "Pipeline aberto", icone: "chart", valor: brl0(forecast.pipelineTotal),
      apoio: `${totalAtivos} negócios ativos`, href: "/pipeline",
    },
    {
      key: "forecast", label: "Forecast ponderado", icone: "target", valor: brl0(forecast.ponderado),
      apoio: "Ponderado por etapa", href: "/pipeline",
    },
    {
      key: "fechado", label: "Fechado no período", icone: "wallet", valor: brl0(fechado.receita),
      apoio: `${fechado.ganhos} negócios ganhos`, deltaPct: deltaFechado, href: "/pipeline?status=ganho",
    },
    {
      key: "meta", label: "Meta do período", icone: "target",
      valor: metaEscopo > 0 ? brl0(metaEscopo) : "—",
      apoio: metaEscopo > 0 ? `Falta ${brl0(Math.max(metaEscopo - fechado.receita, 0))}` : "Sem meta cadastrada",
      progresso: metaPct, href: "/ajustes",
    },
    {
      key: "winrate", label: "Win rate", icone: "percent",
      // `amostraPequena` (n<3) não vira número: 100% em cima de 1 negócio
      // decidido não é win rate, é ruído.
      valor: winRate.taxa != null && !winRate.amostraPequena ? `${Math.round(winRate.taxa)}%` : "—",
      apoio: winRate.n > 0 ? `${winRate.n} decididos em 90d` : "Sem decididos em 90d",
      href: "/pipeline",
    },
    {
      key: "ticket", label: "Ticket médio", icone: "receipt",
      valor: ticketMedio != null ? brl0(ticketMedio) : "—",
      apoio: "Por contrato fechado (90d)", href: "/pipeline?status=ganho",
    },
  ];

  const dataExtenso = hoje
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div
        className="-mx-6 -mt-6 px-4 sm:px-6 py-2.5 rounded-tl-2xl"
        style={{ background: "var(--cf2-bg-surface)" }}
      >
        <Cf2Topbar
          orgNome={orgNome} variant="light" compact compactTitle
          title="Visão Geral de Vendas" actions={null}
        />
      </div>

      {/* ── Hero escuro: saudação + ações + Pulso comercial ── */}
      <section
        data-cf2-superficie="escura"
        className="flex flex-col gap-4 px-4 sm:px-6 pt-5 sm:pt-6 pb-6 rounded-[32px]"
        style={{ background: "var(--cf2-home-hero-bg)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[11px] font-semibold tracking-wide" style={{ color: "var(--cf2-home-text-muted)" }}>
              {dataExtenso} · SEMANA {semanaIso(hoje)}
            </p>
            <h1
              className="text-[28px] font-semibold leading-tight"
              style={{ color: "var(--cf2-home-text-strong)", fontFamily: "var(--cf2-font-heading)" }}
            >
              {primeiroNome ? `${saudacao(hoje.getHours())}, ${primeiroNome}` : saudacao(hoje.getHours())}
            </h1>
            <p className="text-[13px]" style={{ color: "var(--cf2-home-text-muted)" }}>
              {pessoaSelecionada
                ? `Panorama comercial de ${pessoaSelecionada} no período selecionado.`
                : "Aqui está o panorama completo do seu desempenho comercial."}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Link
              href="/negocios/novo"
              className="flex items-center gap-1.5 h-10 px-4 rounded-full text-[13.5px] font-bold whitespace-nowrap"
              style={{ background: "var(--cf2-home-lime)", color: "var(--cf2-home-lime-ink)" }}
            >
              <Plus className="size-4" /> Novo negócio
            </Link>
            <Cf2FiltrosVendas
              periodo={periodo}
              responsavelId={responsavelId}
              colaboradores={colaboradores}
              intervaloLabel={rotuloIntervalo(inicio, fim)}
            />
          </div>
        </div>

        <div className="h-px w-full" style={{ background: "var(--cf2-home-dark-overlay)" }} />

        <Cf2PulsoComercial kpis={kpis} />
      </section>

      {/* ── Pulso da Pré-Venda (escuro) ── */}
      <Cf2PulsoPreVenda
        dados={preVendas}
        deltaConversao={deltaConversao}
        tempoQualificacaoDias={pulsoSDR.tempoQualificacaoDias}
        slaPrimeiroContatoMin={pulsoSDR.primeiroContatoSlaMinutos}
      />

      {/* ── Trio de cards CLAROS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <Cf2CardPreVendas dados={preVendas} anterior={preVendasAnt} />
        <Cf2CardPipeline
          etapas={etapas}
          valorTotal={forecast.pipelineTotal}
          tempoMedioDias={tempoMedioPipeline}
          parados={sinal("parados")}
          semProximaAcao={sinal("sem_acao")}
          previsoesVencidas={sinal("previsoes")}
        />
        <Cf2CardPropostas dados={propostas} anterior={propostasAnt} />
      </div>

      {/* ── Pulso do Negócio (escuro) ── */}
      <Cf2PulsoNegocio
        realizado={fechado.receita}
        meta={metaEscopo}
        forecast={forecast}
        diasUteisRestantes={diasUteisRestantes(hoje, fim)}
        deltaPeriodo={deltaFechado}
        nomesEquipe={performance.map((p) => p.nome)}
      />

      {/* ── Dupla de cards CLAROS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Cf2CardOrigem linhas={origem} />
        <Cf2MovimentoComercial serie={movimento} />
      </div>

      <Cf2CardAtencao sinais={atencao} />

      {/* ── Performance do Time (escuro) ── */}
      <Cf2PerformanceTime linhas={performance} />
    </div>
  );
}
