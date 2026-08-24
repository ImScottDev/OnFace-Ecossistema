import { Fragment } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { getMetaComercialAgregada, getMetasPorVendedor } from "@/lib/metas";
import { getPipelineAtual, getFechadoPeriodo, getWinRate, getTicketMedio } from "@/lib/relatorios/comercial";
import { getPipelineComercial, getNegociosTravadosResumo } from "@/lib/analytics/command-center";
import { getPulsoPreVendas } from "@/lib/analytics/pre-vendas";
import { getMovimentoPipeline, getPropostasPendentesCount, getNegociosSemAgendamentoCount, getPrevisoesExpiradasCount } from "@/lib/analytics/vendas";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2UnavailableMetric } from "@/components/crm2/ui/States";
import { Cf2PreVendasPulse } from "@/components/crm2/PreVendasPulse";

const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const brl2 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthBounds(ref: Date) {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { inicio, fim };
}

export default async function VendasVisaoGeralPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const hoje = new Date();
  const { inicio, fim } = monthBounds(hoje);
  const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const { inicio: inicioAnt, fim: fimAnt } = monthBounds(mesAnteriorRef);
  // Win rate/ticket médio precisam de uma janela maior que 1 mês pra não
  // ficar "amostra pequena" o tempo todo (ciclo de venda real é mais longo
  // que o período de exibição do Pulso Comercial) — 90 dias, decisão
  // registrada no relatório desta rodada.
  const desde90 = new Date(hoje.getTime() - 90 * 86_400_000);

  const [
    org,
    pipelineAtivo,
    fechadoPeriodo,
    fechadoAnterior,
    metaMes,
    winRate90,
    ticketMedio90,
    movimento,
    travados,
    propostasPendentes,
    semAgendamento,
    previsoesExpiradas,
    pipelineComercial,
    vendedores,
    pulsoPreVendas,
    pulsoPreVendasAnterior,
  ] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getPipelineAtual(ctx.organizacaoId),
    getFechadoPeriodo(ctx.organizacaoId, inicio, fim),
    getFechadoPeriodo(ctx.organizacaoId, inicioAnt, fimAnt),
    getMetaComercialAgregada(ctx.organizacaoId, hoje),
    getWinRate(ctx.organizacaoId, desde90, hoje),
    getTicketMedio(ctx.organizacaoId, desde90, hoje),
    getMovimentoPipeline(ctx.organizacaoId, inicio, fim),
    getNegociosTravadosResumo(ctx.organizacaoId, 5),
    getPropostasPendentesCount(ctx.organizacaoId),
    getNegociosSemAgendamentoCount(ctx.organizacaoId),
    getPrevisoesExpiradasCount(ctx.organizacaoId),
    getPipelineComercial(ctx.organizacaoId, hoje),
    getMetasPorVendedor(ctx.organizacaoId),
    getPulsoPreVendas(ctx.organizacaoId, inicio, fim),
    getPulsoPreVendas(ctx.organizacaoId, inicioAnt, fimAnt),
  ]);

  const orgNome = org[0]?.nome || "Callface";
  const pipelineTotalCount = pipelineAtivo.etapas.reduce((s, e) => s + e.count, 0);
  const faltantes = Math.max(metaMes.valorAlvo - metaMes.realizado, 0);
  const coberturaRatio = faltantes > 0 ? pipelineAtivo.ponderado / faltantes : null;
  const deltaFechadoPct = fechadoAnterior.receita > 0 ? ((fechadoPeriodo.receita - fechadoAnterior.receita) / fechadoAnterior.receita) * 100 : null;
  const metaPct = metaMes.valorAlvo > 0 ? Math.round((fechadoPeriodo.receita / metaMes.valorAlvo) * 100) : 0;

  // Vendedores ordenados pela mesma regra da Home (realizado desc); pra
  // cada um busca forecast (pipeline ponderado dele) e win rate (mesma
  // janela de 90 dias), reaproveitando as mesmas funções escopadas por
  // responsavelId já existentes em comercial.ts.
  const rankingOrdenado = [...vendedores].sort((a, b) => b.realizado - a.realizado);
  const performanceTime = await Promise.all(
    rankingOrdenado.map(async (v) => {
      const [pipelineVendedor, winRateVendedor] = await Promise.all([
        getPipelineAtual(ctx.organizacaoId, v.id),
        getWinRate(ctx.organizacaoId, desde90, hoje, v.id),
      ]);
      return { ...v, forecast: pipelineVendedor.ponderado, winRate: winRateVendedor };
    })
  );
  const avatarColors = ["var(--cf2-avatar-1)", "var(--cf2-avatar-2)", "var(--cf2-avatar-3)", "var(--cf2-avatar-4)", "var(--cf2-avatar-5)"];

  return (
    <div className="-m-6 flex flex-col min-h-full">
      {/* top-zone claro (Figma: distinto da Home — aqui o topo é claro e o
          conteúdo do módulo é escuro, esquema INVERTIDO). Header fixo
          global (Topbar) + navegação de módulo (ModuleTabs, reutilizável
          pelas próximas telas de Vendas). */}
      <div className="relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-bg-canvas)" }}>
        <Cf2Topbar
          orgNome={orgNome}
          variant="light"
          title="Vendas"
          subtitle="Visão executiva da operação comercial e performance do pipeline"
        />
      </div>

      {/* corpo escuro do módulo — grid mais sutil (opacity menor) que o
          hero da Home, igual ao "bg-grid-effect" deste frame específico. */}
      <div
        className="flex-1 flex flex-col gap-5 px-6 pt-7 pb-6 relative"
        style={{
          background: "var(--cf2-chrome-bg-alt)",
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(217,222,229,0.05) 0 1px, transparent 1px 60px), repeating-linear-gradient(to bottom, rgba(217,222,229,0.05) 0 1px, transparent 1px 60px)",
          backgroundSize: "60px 60px",
        }}
      >
        {/* Pulso Comercial */}
        <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pulso Comercial</p>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Visão executiva do ritmo comercial e cobertura de forecast do período</p>
            </div>
            {deltaFechadoPct !== null ? (
              <div className="px-2 py-1 rounded-md" style={{ background: "#153723" }}>
                <p className="text-[11px] font-bold" style={{ color: "#4ade80" }}>{deltaFechadoPct >= 0 ? "+" : ""}{deltaFechadoPct.toFixed(1)}% vs mês anterior</p>
              </div>
            ) : (
              <Cf2UnavailableMetric reason="Sem fechado no mês anterior pra comparar" />
            )}
          </div>
          <div className="flex items-center gap-6">
            <MetricGroup label="Pipeline Aberto" valor={brl0(pipelineAtivo.total)} sub={`${pipelineTotalCount} oportunidades ativas`} subTom="accent" />
            <Divider />
            <MetricGroup label="Forecast Ponderado" valor={brl0(pipelineAtivo.ponderado)} sub="Probabilidade calculada" />
            <Divider />
            <MetricGroup label="Fechado no Período" valor={brl0(fechadoPeriodo.receita)} sub={`${metaPct}% da meta atingida`} subTom="accent" />
            <Divider />
            <MetricGroup
              label="Meta do Período"
              valor={brl0(metaMes.valorAlvo)}
              sub={coberturaRatio !== null ? `Cobertura atual: ${coberturaRatio.toFixed(1)}x` : "Meta já atingida"}
              subTom="accent"
            />
            <Divider />
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <SubStat label="Win Rate:" valor={winRate90.taxa !== null && !winRate90.amostraPequena ? `${winRate90.taxa}%` : undefined} indisponivel={winRate90.taxa === null || winRate90.amostraPequena ? "Amostra insuficiente nos últimos 90 dias" : undefined} />
              <SubStat label="Ticket Médio:" valor={ticketMedio90 !== null ? brl0(ticketMedio90) : undefined} indisponivel={ticketMedio90 === null ? "Sem negócios ganhos nos últimos 90 dias" : undefined} />
            </div>
          </div>
        </div>

        <Cf2PreVendasPulse pulso={pulsoPreVendas} pulsoAnterior={pulsoPreVendasAnterior} />

        <div className="flex gap-8 items-start">
          {/* Movimento do Pipeline */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Movimento do Pipeline</p>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Fluxo de oportunidades no período</p>
            </div>
            <div className="rounded-2xl p-6 flex flex-col gap-3 w-full" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <FlowStep badge="ENTRARAM" badgeBg="var(--cf2-chrome-bg)" texto={`${movimento.entraram.total} oportunidades criadas no período`} valor={brl0(movimento.entraram.valor)} />
              <FlowStep badge="AVANÇARAM" badgeBg="var(--cf2-accent)" badgeText="var(--cf2-text-on-accent)" texto={`${movimento.avancaram.total} oportunidades progrediram no funil`} valor={brl0(movimento.avancaram.valor)} />
              <FlowStep badge="PARADAS" badgeBg="#f59e0b" texto={`${travados.total} oportunidades sem movimentação (${travados.diasMin}+ dias)`} valor={brl0(travados.valor)} valorTom="#f59e0b" />
              <FlowStep badge="GANHAS" badgeBg="#09ba2a" texto={`${movimento.ganhas.total} negócio(s) fechado(s) com sucesso`} valor={brl0(movimento.ganhas.valor)} valorTom="#09ba2a" />
              <FlowStep badge="PERDIDAS" badgeBg="#dc2626" texto={`${movimento.perdidas.total} negócio(s) descartado(s)/perdido(s)`} valor={brl0(movimento.perdidas.valor)} valorTom="#dc2626" />
            </div>
          </div>

          {/* Atenção Comercial — só os 4 alertas com fonte real; "sinais
              fortes de ganho via Carol AI" do Figma não tem fonte hoje
              (priority-engine só calcula sinais de risco, não de ganho) —
              omitido em vez de fabricado, ver relatório da rodada. */}
          <div className="flex flex-col gap-4 w-[500px] shrink-0">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Atenção Comercial</p>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Alertas operacionais e prioridades críticas</p>
            </div>
            <div className="rounded-2xl p-5 flex flex-col gap-3 w-full" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <AlertItem cor="#dc2626" titulo={`${brl0(travados.valor)} parados (+${travados.diasMin} dias)`} sub={`${travados.total} oportunidades sem interação recente`} href="/pipeline" />
              <AlertItem cor="#f59e0b" titulo={`${propostasPendentes} propostas pendentes`} sub="Enviadas aos clientes sem resposta de retorno" href="/propostas" />
              <AlertItem cor="#f59e0b" titulo={`${semAgendamento} negócios sem atividade`} sub="Oportunidades ativas sem agendamento futuro" href="/pipeline" />
              <AlertItem cor="#dc2626" titulo={`${previsoesExpiradas} previsões expiradas`} sub="Negócios com data de fechamento prevista vencida" href="/pipeline" />
            </div>
          </div>
        </div>

        {/* Pipeline por Estágio */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pipeline por Estágio</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Fluxo unificado e conversão de negócios entre etapas comerciais</p>
          </div>
          <div className="rounded-2xl p-6 flex items-stretch gap-3" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
            {pipelineComercial.map((etapa, i) => (
              <Fragment key={etapa.label}>
                <div className="flex-1 flex flex-col gap-3 p-4 rounded-xl min-w-0" style={{ background: "var(--cf2-chrome-surface-active)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{etapa.label.toUpperCase()}</p>
                  <p className="text-[22px] font-bold" style={{ color: "var(--cf2-accent-border)", fontFamily: "var(--cf2-font-heading)" }}>{etapa.total} negócios</p>
                  <div className="flex flex-col gap-0.5 text-xs">
                    <p style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl0(etapa.valor)} total</p>
                    <Cf2UnavailableMetric reason="Conversão real precisa de coorte — snapshot atual não é confiável pra isso, mesma decisão da Home" />
                  </div>
                </div>
                {i < pipelineComercial.length - 1 && <span className="self-center text-lg" style={{ color: "var(--cf2-chrome-text-primary)" }}>→</span>}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Performance do Time */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Performance do Time</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Desempenho individual contra as metas de receita estabelecidas</p>
          </div>
          <div className="rounded-2xl p-6 flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {performanceTime.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Ninguém com meta cadastrada ainda.</p>
            ) : (
              performanceTime.map((v, i) => (
                <div key={v.id} className="flex items-center gap-5 p-3 rounded-xl" style={{ border: "1px solid var(--cf2-border-default)" }}>
                  <div className="flex items-center justify-center rounded-full text-xs font-extrabold shrink-0" style={{ width: 36, height: 36, background: avatarColors[i % avatarColors.length], color: "var(--cf2-text-on-accent)" }}>
                    {v.nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{v.nome}</p>
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Meta: {brl2(v.valorAlvo)}</p>
                  </div>
                  <div className="flex gap-10 items-center shrink-0">
                    <div className="flex flex-col gap-0.5 w-[110px]">
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>Realizado</p>
                      <p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl2(v.realizado)}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 w-[110px]">
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>Forecast</p>
                      <p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl2(v.forecast)}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 w-[70px]">
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>Win Rate</p>
                      {v.winRate.taxa !== null && !v.winRate.amostraPequena ? (
                        <p className="text-sm font-bold" style={{ color: "#09ba2a" }}>{v.winRate.taxa}%</p>
                      ) : (
                        <Cf2UnavailableMetric reason="Amostra insuficiente nos últimos 90 dias" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 w-[180px] shrink-0">
                    <div className="rounded-full overflow-hidden h-1.5 w-full" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <div className="h-full" style={{ width: `${Math.min(v.pct, 100)}%`, background: "var(--cf2-success-fill)" }} />
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{Math.round(v.pct)}% da meta atingida</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch" style={{ background: "var(--cf2-chrome-border-subtle)" }} />;
}

function MetricGroup({ label, valor, sub, subTom }: { label: string; valor: string; sub: string; subTom?: "accent" }) {
  return (
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
      <p className="text-[28px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
      <p className="text-xs" style={{ color: subTom === "accent" ? "var(--cf2-accent-border)" : "var(--cf2-chrome-text-secondary)" }}>{sub}</p>
    </div>
  );
}

function SubStat({ label, valor, indisponivel }: { label: string; valor?: string; indisponivel?: string }) {
  return (
    <div className="flex items-center justify-between w-full gap-3">
      <span className="text-xs" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</span>
      {valor !== undefined ? (
        <span className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</span>
      ) : (
        <Cf2UnavailableMetric reason={indisponivel || "Sem dado suficiente"} />
      )}
    </div>
  );
}

function FlowStep({
  badge, badgeBg, badgeText = "#ffffff", texto, valor, valorTom,
}: {
  badge: string; badgeBg: string; badgeText?: string; texto: string; valor: string; valorTom?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl w-full" style={{ background: "var(--cf2-bg-surface-subtle)" }}>
      <div className="flex items-center justify-center px-2 py-1 rounded-md shrink-0 w-[90px]" style={{ background: badgeBg }}>
        <p className="text-[11px] font-bold" style={{ color: badgeText }}>{badge}</p>
      </div>
      <p className="flex-1 text-sm min-w-0" style={{ color: "var(--cf2-text-primary)" }}>{texto}</p>
      <p className="text-base font-bold shrink-0" style={{ color: valorTom || "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
    </div>
  );
}

function AlertItem({ cor, titulo, sub, href }: { cor: string; titulo: string; sub: string; href: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl w-full" style={{ border: "1px solid var(--cf2-border-default)" }}>
      <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: cor }} />
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
        <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{sub}</p>
      </div>
      <Link href={href} className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--cf2-success-text)" }}>Ver →</Link>
    </div>
  );
}
