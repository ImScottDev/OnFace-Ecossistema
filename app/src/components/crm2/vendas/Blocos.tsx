import {
  Users, BarChart3, FileText, Sparkles,
  Wallet, Target, Percent, Receipt, LineChart, AlertTriangle,
} from "lucide-react";
import { Cf2UnavailableMetric } from "@/components/crm2/ui/States";
import {
  RAIO, ESPACO, TIPO, TOM, Cf2Faixa, Cf2FaixaHeader, Cf2Painel,
  Cf2Vazio, Cf2Tendencia, Cf2Pilula, Cf2CaixaIcone, Cf2Kpi, Cf2Celula,
  Cf2LinhaLista, Cf2Avatares, Cf2Progresso,
} from "@/components/crm2/ds";
import { Cf2Avatar } from "@/components/crm2/ds/Avatar";
import type {
  EtapaPipeline, PropostasResumo, SinalAtencao, ForecastResumo,
  OrigemLinha, PreVendasEscopo, LinhaPerformance,
} from "@/lib/analytics/vendas-visao-geral";

/**
 * Visão Geral de Vendas — blocos visuais (30/08, 3ª volta).
 *
 * **A /inicio é a base de referência do projeto.** Esta volta alinhou tudo às
 * convenções de lá, que antes divergiam (fonte, padding, raio):
 *   card claro      → rounded-[28px], #fff + --cf2-home-panel-border,
 *                     header `pt-4 px-5 pb-2`, corpo `p-2.5 gap-2.5`
 *   linha interna   → rounded-[20px] p-3
 *   card KPI escuro → rounded-[28px] p-4, --cf2-home-kpi-bg
 *   caixa de ícone  → w-7 h-7 rounded-[10px] (ícone w-3.5) / w-9 h-9 rounded-[14px]
 *   título de card  → text-[14px], letter-spacing -0.5px (SEM bold)
 *   rótulo de KPI   → text-[9.5px] uppercase, letter-spacing 0.62px
 *   valor de KPI    → text-[20px] font-semibold, letter-spacing -0.7px
 *   apoio/rodapé    → text-[11px] · linha de lista → text-[13.5px]/text-[12px]
 *   pílula          → py-1 px-2.5 rounded-full text-[12px] font-medium
 *
 * Layout alterna faixa ESCURA e cards CLAROS, como a referência do Kauã.
 */

const brl0 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const brl2 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ICONES_KPI = { wallet: Wallet, target: Target, receipt: Receipt, percent: Percent, chart: LineChart } as const;

// ── Primitivas alinhadas à /inicio ──────────────────────────────────────

// ── 1. Pulso comercial (faixa de KPIs dentro do hero) ───────────────────

export interface KpiPulso {
  key: string;
  label: string;
  valor: string;
  apoio: string;
  icone: keyof typeof ICONES_KPI;
  deltaPct?: number | null;
  /** 0–100 → desenha a barra de progresso (usado na Meta). */
  progresso?: number | null;
  href: string;
}

export function Cf2PulsoComercial({ kpis }: { kpis: KpiPulso[] }) {
  return (
    <div className={`flex flex-col ${ESPACO.grade}`}>
      <div className="flex items-center gap-2.5">
        <Cf2CaixaIcone className="!w-6 !h-6 rounded-xl">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--cf2-home-text-muted)" }} />
        </Cf2CaixaIcone>
        <p className={TIPO.tituloSecao.classe} style={{ ...TIPO.tituloSecao.estilo, color: "var(--cf2-home-text-strong)" }}>
          Pulso comercial
        </p>
        <p className={`${TIPO.corpo.classe} truncate`} style={{ color: "var(--cf2-home-text-muted)" }}>
          · Panorama de performance · dados consolidados do período
        </p>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 ${ESPACO.grade}`}>
        {kpis.map((k) => {
          const Icone = ICONES_KPI[k.icone];
          return (
            <Cf2Kpi
              key={k.key}
              rotulo={k.label}
              valor={k.valor}
              apoio={k.apoio}
              tendencia={k.deltaPct}
              progresso={k.progresso}
              href={k.href}
              icone={<Icone className="w-3.5 h-3.5" style={{ color: "var(--cf2-home-text-muted)" }} />}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── 2. Pulso da Pré-Venda (faixa escura) ────────────────────────────────

export function Cf2PulsoPreVenda({
  dados, deltaConversao, tempoQualificacaoDias, slaPrimeiroContatoMin,
}: {
  dados: PreVendasEscopo;
  deltaConversao: number | null;
  tempoQualificacaoDias: number | null;
  slaPrimeiroContatoMin: number | null;
}) {
  const metricas = [
    { label: "Leads no período", valor: String(dados.leadsNoPeriodo), apoio: "Total inbound e outbound", destaque: false },
    { label: "Em qualificação", valor: String(dados.emQualificacao), apoio: "Triagem ativa pelos SDRs", destaque: false },
    { label: "Qualificados (SQL)", valor: String(dados.qualificadosSQL), apoio: "Prontos para executivos", destaque: true },
    {
      label: "Taxa de qualificação",
      valor: dados.taxaQualificacao != null ? `${dados.taxaQualificacao.toFixed(0)}%` : "—",
      apoio: "Conversão interna média", destaque: true,
    },
  ];

  const lateral = [
    { k: "Tempo quali", v: tempoQualificacaoDias != null ? `${tempoQualificacaoDias.toFixed(1)} dias` : "—" },
    { k: "1º contato SLA", v: slaPrimeiroContatoMin != null ? `${Math.round(slaPrimeiroContatoMin)} min` : "—" },
    { k: "Sem contato", v: `${dados.semResposta} leads` },
  ];

  return (
    <Cf2Faixa>
      <Cf2FaixaHeader
        titulo="Pulso da Pré-Venda"
        subtitulo="Desempenho do funil de qualificação e taxas de conversão de leads"
        direita={
          deltaConversao != null && isFinite(deltaConversao) ? (
            <Cf2Pilula tom={deltaConversao >= 0 ? "positivo" : "danger"}>
              <Cf2Tendencia pct={deltaConversao} sufixo="conversão vs anterior" />
            </Cf2Pilula>
          ) : undefined
        }
      />

      <div className={`flex flex-col xl:flex-row ${ESPACO.secao}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-w-0">
          {metricas.map((m, i) => (
            <div
              key={m.label}
              className="flex flex-col gap-[3px] min-w-0 lg:pl-4"
              style={i > 0 ? { borderLeft: "1px solid var(--cf2-home-dark-overlay)" } : undefined}
            >
              <p className={TIPO.rotuloKpi.classe} style={{ ...TIPO.rotuloKpi.estilo, color: "var(--cf2-home-text-muted)" }}>
                {m.label}
              </p>
              <p className={TIPO.valorDestaque.classe} style={{ ...TIPO.valorDestaque.estilo, color: "var(--cf2-home-text-strong)" }}>
                {m.valor}
              </p>
              <p
                className={`${TIPO.apoio.classe} truncate`}
                style={{ color: m.destaque ? TOM.limeSuave : "var(--cf2-home-text-muted)" }}
              >
                {m.apoio}
              </p>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col gap-1.5 shrink-0 xl:w-[200px] xl:pl-4"
          style={{ borderLeft: "1px solid var(--cf2-home-dark-overlay)" }}
        >
          {lateral.map((l) => (
            <div key={l.k} className="flex items-baseline justify-between gap-3">
              <span className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-text-muted)" }}>{l.k}</span>
              <span className={`${TIPO.corpo.classe} font-medium`} style={{ color: "var(--cf2-home-text-strong)" }}>{l.v}</span>
            </div>
          ))}
        </div>
      </div>
    </Cf2Faixa>
  );
}

// ── 3. Trio de painéis claros ───────────────────────────────────────────

export function Cf2CardPreVendas({ dados, anterior }: { dados: PreVendasEscopo; anterior: PreVendasEscopo }) {
  const d = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
  return (
    <Cf2Painel
      titulo="Pré-vendas"
      icone={<Users className="w-4 h-4" />}
      link={{ label: "Ver funil de pré-vendas", href: "/pre-vendas" }}
    >
      <div className="grid grid-cols-3 gap-2.5">
        <Cf2Celula valor={dados.leadsNoPeriodo} rotulo="Leads no período" tendencia={d(dados.leadsNoPeriodo, anterior.leadsNoPeriodo)} />
        <Cf2Celula valor={dados.emQualificacao} rotulo="Em qualificação" tendencia={d(dados.emQualificacao, anterior.emQualificacao)} />
        <Cf2Celula valor={dados.qualificadosSQL} rotulo="Qualificados (SQL)" tendencia={d(dados.qualificadosSQL, anterior.qualificadosSQL)} />
        <Cf2Celula valor={dados.agendaConfirmada} rotulo="Agenda confirmada" tendencia={d(dados.agendaConfirmada, anterior.agendaConfirmada)} />
        <Cf2Celula
          valor={dados.taxaQualificacao != null ? `${dados.taxaQualificacao.toFixed(0)}%` : "—"}
          rotulo="Taxa de qualificação"
          tendencia={dados.taxaQualificacao != null && anterior.taxaQualificacao != null
            ? dados.taxaQualificacao - anterior.taxaQualificacao : null}
        />
        <Cf2Celula valor={dados.semResposta} rotulo="Sem resposta" tendencia={d(dados.semResposta, anterior.semResposta)} invertido />
        <Cf2Celula valor={dados.noShow} rotulo="No-show" tendencia={d(dados.noShow, anterior.noShow)} invertido />
      </div>
    </Cf2Painel>
  );
}

export function Cf2CardPipeline({
  etapas, valorTotal, tempoMedioDias, parados, semProximaAcao, previsoesVencidas,
}: {
  etapas: EtapaPipeline[];
  valorTotal: number;
  tempoMedioDias: number | null;
  parados: number;
  semProximaAcao: number;
  previsoesVencidas: number;
}) {
  const totalAtivos = etapas.reduce((s, e) => s + e.total, 0);
  const maxEtapa = Math.max(...etapas.map((e) => e.total), 1);

  return (
    <Cf2Painel
      titulo="Pipeline comercial"
      icone={<BarChart3 className="w-4 h-4" />}
      link={{ label: "Ver pipeline completo", href: "/pipeline" }}
    >
      <div className="grid grid-cols-3 gap-2.5">
        <Cf2Celula valor={totalAtivos} rotulo="Negócios ativos" />
        <Cf2Celula valor={brl0(valorTotal)} rotulo="Valor total" />
        <Cf2Celula valor={tempoMedioDias != null ? `${Math.round(tempoMedioDias)}d` : "—"} rotulo="Tempo médio" />
        <Cf2Celula valor={parados} rotulo="Negócios parados" nota="+5 dias" tom="danger" />
        <Cf2Celula valor={semProximaAcao} rotulo="Sem próxima ação" />
        <Cf2Celula valor={previsoesVencidas} rotulo="Previsões vencidas" />
      </div>

      <div className={`flex flex-col gap-2 p-3 ${RAIO.linha}`} style={{ border: "1px solid var(--cf2-home-panel-border)" }}>
        <p className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-ink-soft)" }}>Por etapa (quantidade)</p>
        <div className="flex items-end justify-between gap-2 h-[86px]">
          {etapas.map((e) => (
            <div
              key={e.key}
              className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end"
              title={`${e.label}: ${e.total}`}
            >
              <span className={`${TIPO.apoio.classe} font-medium`} style={{ color: "var(--cf2-home-ink)" }}>{e.total}</span>
              <div
                className={`w-full ${RAIO.iconePequeno}`}
                style={{
                  // mínimo de 4px pra etapa zerada continuar visível como
                  // "existe e está vazia", em vez de sumir do gráfico
                  height: `${Math.max((e.total / maxEtapa) * 56, 4)}px`,
                  background: TOM.lime,
                }}
              />
              <span className="text-[9.5px] truncate w-full text-center" style={{ color: "var(--cf2-home-ink-faint)" }}>
                {e.label.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Cf2Painel>
  );
}

export function Cf2CardPropostas({ dados, anterior }: { dados: PropostasResumo; anterior: PropostasResumo }) {
  const d = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
  return (
    <Cf2Painel
      titulo="Propostas"
      icone={<FileText className="w-4 h-4" />}
      link={{ label: "Ver propostas", href: "/propostas" }}
    >
      <div className="grid grid-cols-3 gap-2.5">
        <Cf2Celula valor={dados.criadas} rotulo="Criadas" tendencia={d(dados.criadas, anterior.criadas)} />
        <Cf2Celula valor={dados.enviadas} rotulo="Enviadas" tendencia={d(dados.enviadas, anterior.enviadas)} />
        {/* Não é 0: `primeira_visualizacao_em` nunca foi gravada em produção
            (0 de 1.467 propostas). Mostrar 0 afirmaria "ninguém abriu" — é
            ausência de tracking, não de visualização. */}
        <Cf2Celula rotulo="Visualizadas">
          <Cf2UnavailableMetric reason="Tracking de visualização da proposta pública não grava dado hoje" />
        </Cf2Celula>
        <Cf2Celula valor={dados.aguardandoResposta} rotulo="Aguardando resposta" tom="warning" />
        <Cf2Celula valor={dados.aceitas} rotulo="Aceitas" tendencia={d(dados.aceitas, anterior.aceitas)} tom="positivo" />
        <Cf2Celula valor={dados.expiradas} rotulo="Expiradas" tendencia={d(dados.expiradas, anterior.expiradas)} invertido tom="danger" />
      </div>

      <div className={`flex flex-col gap-[3px] p-3 ${RAIO.linha}`} style={{ background: "var(--cf2-home-neutral-surface)" }}>
        <p className={TIPO.rotuloKpi.classe} style={{ ...TIPO.rotuloKpi.estilo, color: "var(--cf2-home-ink-soft)" }}>
          Volume em circulação
        </p>
        <p className={TIPO.valorKpi.classe} style={{ ...TIPO.valorKpi.estilo, color: "var(--cf2-home-ink)" }}>
          {brl0(dados.valorEmCirculacao)}
        </p>
        <p className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-ink-soft)" }}>Propostas enviadas sem resposta</p>
      </div>
    </Cf2Painel>
  );
}

// ── 4. Pulso do Negócio (faixa escura, com gauge) ───────────────────────

/** Gauge circular — SVG puro, sem lib. */
function GaugeMeta({ pct }: { pct: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  // Arredondado: ponto flutuante difere entre SSR e cliente no último decimal
  // e o React acusa hydration mismatch (achado real de 30/08 no gauge da Home).
  const p3 = (n: number) => Math.round(n * 1000) / 1000;
  const preenchido = p3((circ * Math.min(pct, 100)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--cf2-home-dark-overlay)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={TOM.lime} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${preenchido} ${p3(circ - preenchido)}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[12px] font-medium"
        style={{ color: "var(--cf2-home-text-strong)" }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

/** Coluna de dados dentro da faixa escura (divisória à esquerda a partir da 2ª). */
function ColunaFaixa({ rotulo, primeira = false, children }: { rotulo: string; primeira?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-2 min-w-0 ${primeira ? "" : "lg:pl-4"}`}
      style={primeira ? undefined : { borderLeft: "1px solid var(--cf2-home-dark-overlay)" }}
    >
      <p className={TIPO.rotuloKpi.classe} style={{ ...TIPO.rotuloKpi.estilo, color: "var(--cf2-home-text-muted)" }}>
        {rotulo}
      </p>
      {children}
    </div>
  );
}

export function Cf2PulsoNegocio({
  realizado, meta, forecast, diasUteisRestantes, deltaPeriodo, nomesEquipe,
}: {
  realizado: number;
  meta: number;
  forecast: ForecastResumo;
  diasUteisRestantes: number;
  deltaPeriodo: number | null;
  nomesEquipe: string[];
}) {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const faltante = Math.max(meta - realizado, 0);
  const metaDia = diasUteisRestantes > 0 ? faltante / diasUteisRestantes : null;
  const cobertura = faltante > 0 ? forecast.ponderado / faltante : null;

  return (
    <Cf2Faixa>
      <Cf2FaixaHeader
        titulo="Pulso do Negócio"
        subtitulo="Visão executiva unificada da performance e ritmo do período comercial"
        direita={
          <div className="flex items-center gap-2.5">
            <Cf2Avatares nomes={nomesEquipe} />
            {deltaPeriodo != null && isFinite(deltaPeriodo) && (
              <Cf2Pilula tom={deltaPeriodo >= 0 ? "positivo" : "danger"}>
                <Cf2Tendencia pct={deltaPeriodo} sufixo="vs anterior" />
              </Cf2Pilula>
            )}
          </div>
        }
      />

      <div className={`grid grid-cols-1 lg:grid-cols-3 ${ESPACO.secao}`}>
        <ColunaFaixa rotulo="Meta do período" primeira>
          {meta > 0 ? (
            <div className="flex items-center gap-3">
              <GaugeMeta pct={pct} />
              <div className="flex flex-col gap-[3px] min-w-0">
                <p
                  className={`${TIPO.valorDestaque.classe} truncate`}
                  style={{ ...TIPO.valorDestaque.estilo, color: "var(--cf2-home-text-strong)" }}
                >
                  {brl0(realizado)}
                </p>
                <p className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-text-muted)" }}>
                  de {brl0(meta)} (meta do período)
                </p>
              </div>
            </div>
          ) : (
            <Cf2UnavailableMetric reason="Sem meta cadastrada para este escopo" />
          )}
        </ColunaFaixa>

        <ColunaFaixa rotulo="Cadência em andamento">
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Faltantes", v: meta > 0 ? brl0(faltante) : "—", destaque: false },
              { k: "Dias restantes", v: `${diasUteisRestantes} úteis`, destaque: false },
              { k: "Meta/dia", v: metaDia != null ? brl0(metaDia) : "—", destaque: true },
            ].map((c) => (
              <div key={c.k} className="flex flex-col gap-[3px] min-w-0">
                <p className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-text-muted)" }}>{c.k}</p>
                <p
                  className={`${TIPO.valorKpi.classe} truncate`}
                  style={{ ...TIPO.valorKpi.estilo, color: c.destaque ? TOM.limeSuave : "var(--cf2-home-text-strong)" }}
                >
                  {c.v}
                </p>
              </div>
            ))}
          </div>
        </ColunaFaixa>

        <ColunaFaixa rotulo="Projeção de resultado">
          <div className="flex flex-col gap-1.5">
            {[
              { k: "Pipeline aberto", v: brl0(forecast.pipelineTotal), destaque: false },
              { k: "Forecast ponderado", v: brl0(forecast.ponderado), destaque: false },
              { k: "Commit (alta prob.)", v: brl0(forecast.commit), destaque: false },
              {
                k: "Cobertura de meta",
                v: cobertura != null ? `${cobertura.toFixed(1)}x (1,5x rec.)` : "Meta batida",
                destaque: true,
              },
            ].map((l) => (
              <div key={l.k} className="flex items-baseline justify-between gap-3">
                <span className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-text-muted)" }}>{l.k}</span>
                <span
                  className={`${TIPO.corpo.classe} font-medium text-right`}
                  style={{ color: l.destaque ? TOM.limeSuave : "var(--cf2-home-text-strong)" }}
                >
                  {l.v}
                </span>
              </div>
            ))}
          </div>
        </ColunaFaixa>
      </div>
    </Cf2Faixa>
  );
}

// ── 5. Origem dos leads (painel claro) ──────────────────────────────────

/**
 * Funil por canal em QUANTIDADE (leads → qualificados → ganhos). Sem coluna de
 * receita de propósito: ver o comentário de `getOrigemOportunidades` — a versão
 * com R$ somava valor de negócio aberto/perdido e mostrava venda que não houve.
 */
export function Cf2CardOrigem({ linhas }: { linhas: OrigemLinha[] }) {
  const tot = {
    leads: linhas.reduce((s, l) => s + l.leads, 0),
    qualificados: linhas.reduce((s, l) => s + l.qualificados, 0),
    ganhos: linhas.reduce((s, l) => s + l.ganhos, 0),
  };
  const th = "text-[11px] font-normal pb-2";
  const td = `${TIPO.corpo.classe} text-right tabular-nums`;

  return (
    <Cf2Painel
      titulo="Origem dos leads"
      icone={<Sparkles className="w-4 h-4" />}
      direita={<Cf2Pilula>{tot.leads}</Cf2Pilula>}
      corpoSemPadding
    >
      {linhas.length === 0 ? (
        <Cf2Vazio
          icone={<Sparkles />}
          titulo="Nenhum lead no período"
          descricao="Ajuste o filtro de período ou de colaborador para ver outros canais."
        />
      ) : (
        <div className="overflow-x-auto cf2-hide-scrollbar px-5 pb-1">
          <table className="w-full min-w-[340px] text-left">
            <thead>
              <tr>
                {["Origem", "Leads", "%", "Qualificados", "Ganhos"].map((h, i) => (
                  <th
                    key={h}
                    className={`${th} ${i > 0 ? "text-right" : ""}`}
                    style={{ color: "var(--cf2-home-ink-faint)", borderBottom: "1px solid var(--cf2-home-panel-border)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.origem} style={{ borderBottom: "1px solid var(--cf2-home-panel-border)" }}>
                  <td className={`py-2.5 ${TIPO.itemTitulo.classe}`} style={{ color: "var(--cf2-home-ink)" }}>{l.origem}</td>
                  <td className={`py-2.5 ${td}`} style={{ color: "var(--cf2-home-ink)" }}>{l.leads}</td>
                  <td className={`py-2.5 ${td}`} style={{ color: "var(--cf2-home-ink-faint)" }}>{l.pct}%</td>
                  <td className={`py-2.5 ${td}`} style={{ color: "var(--cf2-home-ink-soft)" }}>{l.qualificados}</td>
                  <td
                    className={`py-2.5 ${td} font-medium`}
                    style={{ color: l.ganhos > 0 ? TOM.positivo : "var(--cf2-home-ink-faint)" }}
                  >
                    {l.ganhos}
                  </td>
                </tr>
              ))}
              <tr>
                <td className={`py-2.5 ${TIPO.itemTitulo.classe}`} style={{ color: "var(--cf2-home-ink)" }}>Total</td>
                <td className={`py-2.5 ${td} font-medium`} style={{ color: "var(--cf2-home-ink)" }}>{tot.leads}</td>
                <td className={`py-2.5 ${td} font-medium`} style={{ color: "var(--cf2-home-ink-faint)" }}>100%</td>
                <td className={`py-2.5 ${td} font-medium`} style={{ color: "var(--cf2-home-ink)" }}>{tot.qualificados}</td>
                <td className={`py-2.5 ${td} font-medium`} style={{ color: TOM.positivo }}>{tot.ganhos}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Cf2Painel>
  );
}

// ── 6. Atenção comercial (painel claro) ─────────────────────────────────

export function Cf2CardAtencao({ sinais }: { sinais: SinalAtencao[] }) {
  const criticos = sinais.filter((s) => s.tom === "danger").length;
  return (
    <Cf2Painel
      titulo="Atenção comercial"
      icone={<AlertTriangle className="w-4 h-4" />}
      direita={
        <div className="flex items-center gap-2 shrink-0">
          {criticos > 0 && (
            <Cf2Pilula tom="danger">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TOM.danger }} />
              {criticos} {criticos === 1 ? "crítico" : "críticos"}
            </Cf2Pilula>
          )}
          <Cf2Pilula>{sinais.length}</Cf2Pilula>
        </div>
      }
    >
      {sinais.length === 0 ? (
        <Cf2Vazio
          icone={<AlertTriangle />}
          titulo="Nada travado por aqui"
          descricao="Nenhum negócio parado, proposta sem resposta ou previsão vencida no filtro atual."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {sinais.map((s) => (
            <Cf2LinhaLista
              key={s.key}
              href={s.href}
              titulo={s.titulo}
              detalhe={s.descricao}
              tom={s.tom === "danger" ? "danger" : s.tom === "warning" ? "warning" : "info"}
              icone={<AlertTriangle className="w-4 h-4" style={{ color: TOM[s.tom === "danger" ? "danger" : s.tom === "warning" ? "warning" : "info"] }} />}
            />
          ))}
        </div>
      )}
    </Cf2Painel>
  );
}

// ── 7. Performance do Time (faixa escura) ───────────────────────────────

export function Cf2PerformanceTime({ linhas }: { linhas: LinhaPerformance[] }) {
  return (
    <Cf2Faixa>
      <Cf2FaixaHeader
        titulo="Performance do Time"
        subtitulo="Desempenho individual contra as metas de receita estabelecidas"
        direita={<Cf2Avatares nomes={linhas.map((l) => l.nome)} />}
      />

      {linhas.length === 0 ? (
        <p className={`${TIPO.corpo.classe} py-8 text-center`} style={{ color: "var(--cf2-home-text-muted)" }}>
          Nenhum responsável com negócios no filtro atual.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {linhas.map((l) => (
            <div
              key={l.id}
              className={`flex flex-col lg:flex-row lg:items-center gap-4 p-4 ${RAIO.linha}`}
              data-cf2-superficie="escura"
              style={{ background: "var(--cf2-home-kpi-bg)" }}
            >
              <div className="flex items-center gap-2.5 min-w-0 lg:w-[210px] shrink-0">
                <Cf2Avatar nome={l.nome} tipo="usuario" size="lg" />
                <div className="flex flex-col min-w-0">
                  <p className={`${TIPO.itemTitulo.classe} truncate`} style={{ color: "var(--cf2-home-text-strong)" }}>{l.nome}</p>
                  <p className={`${TIPO.apoio.classe} truncate`} style={{ color: "var(--cf2-home-text-muted)" }}>
                    {l.meta > 0 ? `Meta: ${brl2(l.meta)}` : "Sem meta cadastrada"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 min-w-0">
                {[
                  { k: "Realizado", v: brl2(l.fechado), destaque: false },
                  { k: "Forecast", v: brl2(l.forecast), destaque: false },
                  { k: "Pipeline", v: brl2(l.pipeline), destaque: false },
                  { k: "Win rate", v: l.winRate != null ? `${l.winRate}%` : "—", destaque: true },
                ].map((m) => (
                  <div key={m.k} className="flex flex-col gap-[3px] min-w-0">
                    <p className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-text-muted)" }}>{m.k}</p>
                    <p
                      className={`${TIPO.corpo.classe} font-medium truncate tabular-nums`}
                      style={{ color: m.destaque ? TOM.limeSuave : "var(--cf2-home-text-strong)" }}
                    >
                      {m.v}
                    </p>
                  </div>
                ))}
              </div>

              <div className="lg:w-[180px] shrink-0">
                {l.atingidoPct != null ? (
                  <Cf2Progresso pct={l.atingidoPct} legenda={`${l.atingidoPct}% da meta atingida`} />
                ) : (
                  // Sem meta não vira 0%: 0% diz "não vendeu", isto diz "não há
                  // régua pra comparar".
                  <p className={TIPO.apoio.classe} style={{ color: "var(--cf2-home-text-muted)" }}>Sem meta para comparar</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Cf2Faixa>
  );
}
