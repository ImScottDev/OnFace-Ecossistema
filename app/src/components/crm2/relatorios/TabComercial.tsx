"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";
import { ChartCard } from "./charts/ChartCard";
import { DonutChart } from "./charts/DonutChart";
import { MetaProgress } from "./MetaProgress";
import { AlertasCard, metaEmRisco, type AlertaUi } from "./AlertasCard";
import { HeroBand, Stat, Secao, BarraLinha } from "./kit";
import { FaturamentoCategoria } from "./FaturamentoCategoria";
import { ComercialPipelineExplorer } from "./ComercialPipelineExplorer";
import { Wallet, Receipt, Percent, Clock, Filter, Briefcase, Layers } from "lucide-react";
import { taxaQualificacaoDaSafra } from "@/lib/relatorios/comercial-qualificacao";

// As MESMAS quatro etapas de `STAGE_PROB` em lib/relatorios/comercial.ts.
// Não dá para importar de lá (aquele módulo puxa `db` e isto é Client
// Component), então um teste arquitetural trava a divergência: rótulo que não
// casa com a chave faz a barra do funil aparecer com o nome cru da etapa.
const STAGE_LABELS: Record<string, string> = {
  entrada: "Entrada",
  diagnostico: "Diagnóstico",
  proposta: "Proposta",
  negociacao: "Negociação",
};

interface TabComercialProps {
  periodo: string;
  /** Insights ONFACE (/relatorios) já mostra receita, ticket, win rate, ciclo
   * e qualificados no hero grafite, da MESMA requisição. Lá a faixa daqui é
   * repetição; na biblioteca (/relatorios/biblioteca/[id]) ela é o único topo. */
  ocultarHero?: boolean;
  safraSelecionada?: "todos" | "nativo" | "legado";
  aoMudarSafra?: (safra: "todos" | "nativo" | "legado") => void;
  aoMudarPeriodo?: (periodo: string) => void;
}

// Paleta contida (disciplina de cor 21/07): neutros + 1 acento de marca no topo.
const COLORS = ["var(--cf2-accent)", "var(--cf2-text-primary)", "var(--cf2-text-secondary)", "var(--cf2-text-tertiary)", "var(--cf2-text-tertiary)", "var(--cf2-border-default)", "var(--cf2-border-default)"];

// Mix recorrente × avulso: categórico neutro (2 tons)
const COR_RECORRENTE = "var(--cf2-text-secondary)";
const COR_AVULSO = "var(--cf2-text-tertiary)";
const COR_ALERTA = "var(--cf2-warning-text)"; // status atenção

const darkTooltip = {
  contentStyle: {
    background: "rgba(15,15,20,0.95)",
    border: "1px solid var(--cf2-border-default)",
    borderRadius: 10,
    fontSize: 12,
    color: "#fff",
  },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "var(--cf2-text-secondary)", fontSize: 11 },
};

// ─── Shape do GET /api/relatorios/comercial (fonte única: lib/relatorios/comercial.ts) ───
interface EtapaPipeline {
  status: string;
  count: number;
  recorrente: number;
  avulso: number;
  valor: number;
}

interface ComercialData {
  pipeline: {
    etapas: EtapaPipeline[];
    total: number;
    negociosAbertos: number;
    ponderado: number;
  };
  winRateInfo: {
    ganhos: number;
    perdidos: number;
    n: number;
    taxa: number | null;
    amostraPequena: boolean;
  };
  motivosInfo: {
    itens: { motivo: string; count: number; pct: number }[];
    total: number;
    semClassificacao: number;
    semClassificacaoPct: number;
  };
  fechado: { ganhos: number; receita: number; recorrente: number; avulso: number };
  ticketMedio: number | null;
  forecast: number;
  leadsQualificados: number;
  metaComercial: { valorAlvo: number; realizado: number; closers: number } | null;
  pipelineEsfriando: { id: string; titulo: string; status: string; valor: number; diasParado: number }[];
  /** Heurística sobre meta por vendedor; vazio fora da visão de gestão. */
  insights?: { id: string; texto: string; tom: string }[];
  coberturaValor: { status: string; total: number; comValor: number; pct: number }[];
  safra: "todos" | "legado" | "nativo";
  // compat ainda presentes no payload
  cicloMedio: number | null;
}

interface EquipeMembro {
  usuarioId: string;
  nome: string;
  ganhos: number;
  perdidos: number;
  winRate: number;
  receitaTotal: number;
  cicloMedio: number | null;
  leadsAtribuidos: number;
  qualificados: number;
  atividadesTotal: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TabComercial({ periodo, ocultarHero = false, safraSelecionada, aoMudarSafra, aoMudarPeriodo }: TabComercialProps) {
  // Safra compartilhada com o hero global; aplicá-la somente ao visual mentiria sobre os totais.
  const [safraLocal, setSafraLocal] = useState<"todos" | "legado" | "nativo">("nativo");
  const safra = safraSelecionada ?? safraLocal;
  const setSafra = (v: "todos" | "legado" | "nativo") => {
    if (aoMudarSafra) aoMudarSafra(v);
    else setSafraLocal(v);
  };
  const { data: comercial, isLoading: loadingComercial, isError: erroComercial, refetch: recarregarComercial } = useQuery<ComercialData>({
    queryKey: ["relatorios", "comercial", periodo, safra],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/comercial?periodo=${periodo}${safra !== "todos" ? `&safra=${safra}` : ""}`);
      if (!r.ok) throw new Error(`Não foi possível carregar comercial (${r.status})`);
      return r.json();
    },
  });

  interface FechadoMes {
    mes: string;
    ganhosPabx: number; ganhosAi: number; ganhosOutros: number;
    mrrPabx: number; mrrAi: number; mrrOutros: number;
    perdidos: number; fatStripe: number; fatPabx: number;
  }
  const { data: fechadoMensal, isLoading: loadingFechado, isError: erroFechado } = useQuery<{ series: FechadoMes[] }>({
    queryKey: ["relatorios", "fechado-semanal", periodo, safra],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/fechado-mensal?periodo=${encodeURIComponent(periodo)}&safra=${safra}`);
      if (!r.ok) throw new Error(`Não foi possível carregar série mensal (${r.status})`);
      return r.json();
    },
  });
  const fechadoSeries = fechadoMensal?.series ?? [];

  const { data: equipe, isLoading: loadingEquipe, isError: erroEquipe } = useQuery<{ membros: EquipeMembro[] }>({
    queryKey: ["relatorios", "equipe", periodo],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/equipe?periodo=${periodo}`);
      if (!r.ok) throw new Error(`Não foi possível carregar equipe (${r.status})`);
      return r.json();
    },
  });

  // ─── Derived ───
  const fechado = comercial?.fechado;

  const motivosDonut = comercial?.motivosInfo?.itens?.map((m, i) => ({
    name: m.motivo,
    value: m.count,
    color: COLORS[i % COLORS.length],
  })) ?? [];
  const totalPerdidos = comercial?.motivosInfo?.total ?? 0;
  const semClassPct = comercial?.motivosInfo?.semClassificacaoPct ?? 0;

  const mixDonut = [
    { name: "Recorrente", value: fechado?.recorrente ?? 0, color: COR_RECORRENTE },
    { name: "Avulso", value: fechado?.avulso ?? 0, color: COR_AVULSO },
  ].filter((d) => d.value > 0);

  const winTaxa = comercial?.winRateInfo?.taxa ?? null;
  const winN = comercial?.winRateInfo?.n ?? 0;
  const winAmostraPequena = comercial?.winRateInfo?.amostraPequena ?? false;

  const membrosOrdenados = [...(equipe?.membros ?? [])].sort((a, b) => b.ganhos - a.ganhos);

  const metaCom = comercial?.metaComercial;

  // ── Alertas acionáveis (derivados do payload — o que fazer, não só o número) ──
  const alertas: AlertaUi[] = [];
  if (comercial) {
    const mr = metaCom ? metaEmRisco(metaCom.valorAlvo, metaCom.realizado) : null;
    if (mr) alertas.push(mr);
    const esfriando = comercial.pipelineEsfriando ?? [];
    if (esfriando.length >= 3) {
      const valorParado = esfriando.reduce((s, n) => s + n.valor, 0);
      alertas.push({ nivel: esfriando.length >= 8 ? "vermelho" : "amarelo", texto: `${esfriando.length} negócios sem movimento há 5+ dias (${formatCurrency(valorParado)}) — retomar os mais antigos primeiro.` });
    }
    if (totalPerdidos >= 5 && semClassPct >= 30) {
      alertas.push({ nivel: "amarelo", texto: `${semClassPct}% dos perdidos sem motivo classificado — sem isso não dá pra atacar a causa das perdas.` });
    }
    if (winAmostraPequena) alertas.push({ nivel: "amarelo", texto: `Win rate com base pequena (n=${winN}) — não usar pra decisão ainda.` });
  }

  if (erroComercial) return (
    <div role="alert" className="rounded-xl p-5 text-sm bg-[var(--cf2-bg-surface)] text-[var(--cf2-danger-text)]">
      Não foi possível consultar os indicadores comerciais. Os dados não estão zerados: estão indisponíveis.
      <button className="ml-3 font-semibold underline" type="button" onClick={() => void recarregarComercial()}>Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* O que fazer agora */}
      <AlertasCard alertas={alertas} loading={loadingComercial} />

      {/* INSIGHTS DE META. Heurística sobre meta por vendedor (meta menos
          realizado), sem IA e sem credencial. As duas metades — o gerador e a
          leitura de metas — existiam prontas e sem ninguém ligando até 21/09. */}
      {Array.isArray(comercial?.insights) && comercial.insights.length > 0 ? (
        <div className="flex flex-col gap-2">
          {(comercial.insights as Array<{ id: string; texto: string; tom: string }>).map((i) => (
            <div
              key={i.id}
              className="flex items-start gap-2 rounded-xl px-4 py-3"
              style={{
                background: "var(--cf2-bg-surface)",
                border: `1px solid ${i.tom === "destaque" ? "var(--cf2-success-text)" : "var(--cf2-warning-text)"}`,
              }}
            >
              <span className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{i.texto}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Row 0: Meta comercial do mês = soma das metas das closers (visão de gestão) */}
      {metaCom && metaCom.valorAlvo > 0 ? (
        <section aria-label="Meta exclusiva das closers" className="ins-goal-scope">
          <div className="ins-goal-explanation">
            <strong>Meta das closers · escopo restrito</strong>
            <p>Este realizado soma somente vendas das {metaCom.closers} closers com meta no mês. Não equivale às vendas de todos os responsáveis no topo. A meta mede uma população diferente.</p>
          </div>
          <MetaProgress
            tipo="faturamento_fechado"
            valorAlvo={metaCom.valorAlvo}
            realizado={metaCom.realizado}
            label={`Meta mensal · ${metaCom.closers} closer${metaCom.closers === 1 ? "" : "s"} · ${periodo === "mes_passado" ? "mês anterior" : "mês atual"}`}
            mesReferencia={periodo === "mes_passado" ? "mes_passado" : "mes_atual"}
          />
        </section>
      ) : metaCom ? (
        <div className="ins-goal-explanation" role="note">Nenhuma meta comercial cadastrada para as closers desta competência.</div>
      ) : <div className="ins-goal-explanation" role="note">
        A meta mensal das closers não se aplica ao recorte <strong>{safra === "nativo" ? "CRM nativo" : safra === "legado" ? "Zoho migrado" : "de datas personalizado"}</strong>.
        Selecione <strong>Consolidado</strong> e <strong>Mês atual</strong> ou <strong>Mês passado</strong> para comparar exatamente a população e a competência da meta.
      </div>}

      {/* O hero da página Insights usa a MESMA safra e período da API.
          Fora dela, o HeroBand abaixo continua sendo a única faixa. */}
      {ocultarHero ? null : (
      <HeroBand
        label="Receita fechada no período"
        value={loadingComercial ? "…" : formatCurrency(fechado?.receita ?? 0)}
        sub={loadingComercial ? "" : `${fechado?.ganhos ?? 0} negócio${(fechado?.ganhos ?? 0) === 1 ? "" : "s"} ganho${(fechado?.ganhos ?? 0) === 1 ? "" : "s"} · recorrente ${formatCurrency(fechado?.recorrente ?? 0)} · avulso ${formatCurrency(fechado?.avulso ?? 0)}`}
        cor="ganho"
        icon={Wallet}
      >
        <Stat label="Ticket médio" value={loadingComercial ? "…" : comercial?.ticketMedio != null ? formatCurrency(comercial.ticketMedio) : "—"} sub="por negócio ganho" icon={Receipt} />
        <Stat
          label="Win rate"
          value={loadingComercial ? "…" : winTaxa != null ? `${winTaxa}%` : "n/a"}
          sub={loadingComercial ? "" : winAmostraPequena ? `base pequena · n=${winN}` : `${winN} decididos`}
          cor={winAmostraPequena ? "atencao" : "neutro"}
          icon={Percent}
        />
        <Stat label="Ciclo médio" value={loadingComercial ? "…" : comercial?.cicloMedio != null ? `${comercial.cicloMedio}d` : "—"} sub="lead caiu no CRM → ganho" icon={Clock} />
        <Stat label="Qualificados" value={loadingComercial ? "…" : comercial?.leadsQualificados ?? 0} sub="negócios criados no período" icon={Filter} />
      </HeroBand>
      )}

      {/* Composição do faturamento (09/09/2026): a meta comercial é um número
          só; é aqui que se vê de QUE ele foi feito, mês a mês e por pessoa. */}
      <Secao cor="ganho" hint="mensalidade × setup/avulso, por mês de ganho">
        Faturamento fechado por categoria
      </Secao>
      <FaturamentoCategoria meses={12} periodo={periodo} safra={safra} aoSelecionarPeriodo={aoMudarPeriodo} />

      {/* Pipeline */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Secao cor="pipeline" hint="snapshot de agora — não reage ao período">Pipeline</Secao>
        {/* Filtro de safra (COM-02): legado = migrado do Zoho, nativo = criado direto no CRM */}
        <div role="group" aria-label="Origem dos negócios exibidos" className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {([
            { key: "nativo" as const, label: "CRM nativo" },
            { key: "todos" as const, label: "Consolidado" },
            { key: "legado" as const, label: "Migrado Zoho" },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={safra === t.key}
              onClick={() => setSafra(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                safra === t.key
                  ? "text-[var(--cf2-text-primary)] bg-[var(--cf2-bg-surface)] shadow-sm"
                  : "text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pipeline total" value={loadingComercial ? "…" : formatCurrency(comercial?.pipeline?.total ?? 0)} sub="soma dos negócios abertos" destaque icon={Briefcase} />
        <Stat label="Negócios abertos" value={loadingComercial ? "…" : comercial?.pipeline?.negociosAbertos ?? 0} sub="em andamento no funil" icon={Layers} />
      </div>

      {/* Row 2: Pipeline por etapa (snapshot) + Negócios esfriando */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ComercialPipelineExplorer etapas={comercial?.pipeline?.etapas ?? []} loading={loadingComercial} />

        <ChartCard
          title="Negócios esfriando"
          subtitle="Abertos sem movimento há 5+ dias — retomar antes que morram"
          loading={loadingComercial}
          empty={(comercial?.pipelineEsfriando?.length ?? 0) === 0}
          emptyText="Pipeline em dia — nada parado"
          delay={0.2}
        >
          <div className="space-y-1.5 py-1">
            {(comercial?.pipelineEsfriando ?? []).slice(0, 10).map((n) => (
              <div key={n.id} className="flex items-center gap-3 py-1">
                <span className="text-[12px] text-[var(--cf2-text-secondary)] flex-1 truncate">{n.titulo}</span>
                <span className="text-[11px] text-[var(--cf2-text-tertiary)] tabular-nums">{formatCurrency(n.valor)}</span>
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded-full tabular-nums"
                  style={{
                    background: n.diasParado >= 14 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                    color: n.diasParado >= 14 ? "var(--cf2-danger-text)" : "var(--cf2-warning-text)",
                  }}
                >
                  {n.diasParado}d
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Cobertura de valor por etapa (COM-12): mede se a trava de valor do COM-10
          (não deixa avançar pra Proposta Enviada sem valor) está funcionando pra
          frente. Sempre org toda, não segmenta por safra (legado é tratado à
          parte na Fase 0) */}
      <ChartCard
        title="Cobertura de valor por etapa"
        subtitle="% de negócios com valor vinculado (valorTotal > 0) em cada etapa aberta"
        loading={loadingComercial}
        empty={(comercial?.coberturaValor?.length ?? 0) === 0}
        emptyText="Nenhum negócio aberto"
        delay={0.19}
      >
        <div className="space-y-2 py-1">
          {(comercial?.coberturaValor ?? []).map((e) => (
            <BarraLinha
              key={e.status}
              label={STAGE_LABELS[e.status] ?? e.status}
              valor={e.pct}
              max={100}
              direita={`${e.pct}%`}
              extra={`${e.comValor}/${e.total}`}
              cor={e.pct >= 80 ? "ganho" : e.pct >= 40 ? "atencao" : "critico"}
            />
          ))}
        </div>
      </ChartCard>

      {/* Row 3: Motivos de Perda + Mix recorrente × avulso */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Motivos de Perda"
          subtitle="Por que negócios são perdidos no período"
          loading={loadingComercial}
          empty={motivosDonut.length === 0}
          emptyText="Nenhum negócio perdido no período"
          delay={0.2}
        >
          {semClassPct > 0 && (
            <div
              className="mb-3 rounded-lg px-3 py-2 text-[11px] font-medium"
              style={{
                background: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: COR_ALERTA,
              }}
            >
              {`${semClassPct}% dos perdidos sem motivo classificado`}
            </div>
          )}
          <DonutChart
            data={motivosDonut}
            centerValue={String(totalPerdidos)}
            centerLabel="perdidos"
          />
        </ChartCard>

        <ChartCard
          title="Mix recorrente × avulso"
          subtitle="Composição da receita fechada no período"
          loading={loadingComercial}
          empty={mixDonut.length === 0}
          emptyText="Nenhuma receita fechada no período"
          delay={0.22}
        >
          <DonutChart
            data={mixDonut}
            centerValue={formatCurrency(fechado?.receita ?? 0)}
            centerLabel="receita fechada"
            formatar={formatCurrency}
          />
        </ChartCard>
      </div>

      {erroFechado && <div role="alert" className="rounded-xl p-3 text-xs bg-[var(--cf2-bg-surface)] text-[var(--cf2-danger-text)]">Série de fechamento indisponível. Não representa período zerado.</div>}
      {/* Row 4: Fechado por semana */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="MRR Fechado por Semana"
          subtitle="Mensalidade dos negócios ganhos nas semanas do período filtrado"
          loading={loadingFechado}
          empty={fechadoSeries.length === 0}
          delay={0.24}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fechadoSeries.map((m) => ({ ...m, mrr: m.mrrPabx + m.mrrAi + m.mrrOutros }))} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cf2-bg-surface-muted)" />
                <XAxis dataKey="mes" tick={{ fill: "var(--cf2-text-tertiary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--cf2-text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <Tooltip
                  {...darkTooltip}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [formatCurrency(Number(value)), "MRR fechado"]}
                />
                <Bar dataKey="mrr" fill="var(--cf2-text-secondary)" radius={[4, 4, 0, 0]} name="mrr" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Ganhos × Perdidos por Semana"
          subtitle="Ganhos por data de decisão e perdas pela data de encerramento; mesmo período e safra"
          loading={loadingFechado}
          empty={fechadoSeries.length === 0}
          delay={0.24}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fechadoSeries.map((m) => ({ ...m, ganhos: m.ganhosPabx + m.ganhosAi + m.ganhosOutros }))} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cf2-bg-surface-muted)" />
                <XAxis dataKey="mes" tick={{ fill: "var(--cf2-text-tertiary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--cf2-text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  {...darkTooltip}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [value, name === "ganhos" ? "Ganhos" : "Perdidos"]}
                />
                <Legend formatter={(v: string) => (
                  <span className="text-[11px] text-[var(--cf2-text-secondary)]">{v === "ganhos" ? "Ganhos" : "Perdidos"}</span>
                )} />
                <Bar dataKey="ganhos" fill="var(--cf2-success-text)" radius={[4, 4, 0, 0]} name="ganhos" />
                <Bar dataKey="perdidos" fill="var(--cf2-danger-text)" radius={[4, 4, 0, 0]} name="perdidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 5: Desempenho detalhado por vendedor */}
      <div
        className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden"
        style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.27s" }}
      >
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-[var(--cf2-text-primary)]" style={{ fontFamily: "var(--cf2-font-heading)" }}>Desempenho por Vendedor</h3>
          <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Qualificação da safra de leads vs. ganhos por data de decisão. Bases diferentes, deliberadamente separadas.</p>
        </div>
        {erroEquipe ? (
          <div role="alert" className="px-4 py-8 text-center text-[var(--cf2-danger-text)] text-sm">Equipe indisponível. Não significa ausência de vendas.</div>
        ) : loadingEquipe ? (
          <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">Carregando...</div>
        ) : membrosOrdenados.length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">Nenhum membro da equipe encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-y border-[var(--cf2-border-default)] text-[10px] uppercase tracking-wider text-[var(--cf2-text-tertiary)]">
                  <th className="text-left font-medium px-4 py-2.5">Vendedor</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Leads atribuídos ao vendedor no período">Leads recebidos</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Leads criados no período e atualmente qualificados">Qualificados</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Leads qualificados ÷ leads recebidos na mesma safra de criação">Taxa qualif.</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Oportunidades ganhas pela data de decisão (não necessariamente da mesma safra de leads)">Ganhos</th>
                  <th className="text-right font-medium px-3 py-2.5">Perdidos</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Ganhos ÷ (ganhos + perdidos)">Win Rate</th>
                  <th className="text-right font-medium px-3 py-2.5">Receita</th>
                  <th className="text-right font-medium px-3 py-2.5 hidden md:table-cell">Ciclo médio</th>
                  <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell" title="Atividades registradas (ligações, emails, notas...)">Atividades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {membrosOrdenados.map((m) => {
                  // Mesma coorte de criação: qualificados são subconjunto dos leads recebidos.
                  // Ganhos são por DATA DA DECISÃO, logo não são o numerador dessa taxa.
                  const taxaQualificacao = taxaQualificacaoDaSafra(m.qualificados, m.leadsAtribuidos);
                  return (
                    <tr key={m.usuarioId} className="hover:bg-[var(--cf2-bg-surface)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--cf2-text-primary)] font-medium truncate max-w-[160px]">{m.nome}</td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-text-secondary)]">{m.leadsAtribuidos}</td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-text-primary)] font-semibold">{m.qualificados}</td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-text-secondary)]">{taxaQualificacao != null ? `${taxaQualificacao}%` : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-success-text)] font-semibold">{m.ganhos}</td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-text-tertiary)]">{m.perdidos}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span style={{ color: m.winRate >= 30 ? "var(--cf2-success-text)" : m.winRate > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }} className="font-semibold">
                          {m.winRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-text-primary)] font-semibold tabular-nums">{formatCurrency(m.receitaTotal)}</td>
                      <td className="px-3 py-2.5 text-right text-[var(--cf2-text-secondary)] hidden md:table-cell">{m.cicloMedio != null ? `${m.cicloMedio}d` : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--cf2-text-secondary)] hidden lg:table-cell">{m.atividadesTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
