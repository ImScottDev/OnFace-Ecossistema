"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import TabMarketing from "@/components/crm2/relatorios/TabMarketing";
import TabMidiaPaga from "@/components/crm2/relatorios/TabMidiaPaga";
import TabComercial from "@/components/crm2/relatorios/TabComercial";
import TabComercialCloser from "@/components/crm2/relatorios/TabComercialCloser";
import TabSdr from "@/components/crm2/relatorios/TabSdr";
import TabGrowth from "@/components/crm2/relatorios/TabGrowth";
import TabAtividadeTime from "@/components/crm2/relatorios/TabAtividadeTime";
import TabPosVenda from "@/components/crm2/relatorios/TabPosVenda";
import { useMe } from "@/lib/useMe";
import { isAdminView } from "@/lib/auth/roles";
import { GO_LIVE, GO_LIVE_ISO, parsePeriodo } from "@/lib/relatorios/periodo";
import { moeda } from "@/components/onface/vendas/formato";
import { TabFechamento } from "./TabFechamento";
import { preencherSemanas, type Semana } from "./semanas";
import "./insights.css";

/**
 * Insights (/relatorios) na linguagem ONFACE — arquétipo A (hero grafite com
 * KPI + gráfico, depois o conteúdo).
 *
 * As abas são as MESMAS de antes (crm2/relatorios/Tab*): queries e regras de
 * cálculo já validadas; reescrever por estética seria trocar risco por
 * aparência. O que esta camada acrescenta:
 *  - hero com KPIs reais do período, lidos do MESMO /api/relatorios/comercial
 *    que a aba Comercial usa (mesma queryKey → uma requisição só, e topo e aba
 *    nunca divergem);
 *  - aba e período na URL (?aba=&periodo=), para sobreviver ao reload e para
 *    um link colado abrir exatamente o recorte que a pessoa estava vendo;
 *  - a aba Fechamento, que existia no shell legado e se perdeu na migração —
 *    a API (/relatorios/fechamento-comercial + export .xlsx) continuava viva.
 */

const ABAS_GESTAO = [
  { key: "comercial", label: "Comercial" },
  { key: "sdr", label: "Pré-vendas" },
  { key: "pos-venda", label: "Pós-venda" },
  { key: "atividade-time", label: "Atividade do time" },
  { key: "growth", label: "Growth" },
  { key: "marketing", label: "Marketing" },
  { key: "midia-paga", label: "Mídia paga" },
  { key: "fechamento", label: "Fechamento" },
] as const;
const ABAS_PESSOAIS = [
  { key: "comercial", label: "Meu desempenho" },
  { key: "sdr", label: "Minha pré-venda" },
] as const;

const PRESETS = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "7d", label: "7 dias" },
] as const;

type Comercial = {
  fechado: { ganhos: number; receita: number; recorrente: number; avulso: number };
  ticketMedio: number | null;
  winRateInfo: { n: number; taxa: number | null; amostraPequena: boolean };
  pipeline: { total: number; negociosAbertos: number; ponderado: number };
  leadsQualificados: number;
  metaComercial: { valorAlvo: number; realizado: number; closers: number } | null;
  cicloMedio: number | null;
};
type Esteira = {
  funil: { label: string; total: number }[];
  novosLeads: number;
  totalEsteira: number;
  taxaQualificacao: number;
  reunioes: { agendadas: number; realizadas: number; taxaComparecimento: number };
  // Em visão pessoal o backend devolve só a linha da própria SDR (relatorios.ts, soEuSdr).
  porResponsavel?: { usuarioId: string; total: number; novo: number; qualificado: number; taxaQualificacao: number }[];
};

export function InsightsOnface({ abaInicial, periodoInicial }: { abaInicial: string; periodoInicial: string }) {
  // Papel EFETIVO (respeita view-as) decide o menu. Segurança real é no backend
  // (o Hono filtra por responsavelId/403 conforme o papel).
  const { data: me, isLoading: meLoading } = useMe();
  const role = me?.role ?? "";
  const gestao = isAdminView(role) || role === "leitor";
  const isSdr = role === "sdr";

  const [periodo, setPeriodo] = useState(periodoInicial);
  const [aba, setAba] = useState(abaInicial);

  // Growth responde 403 para leitor (gate isAdminView no Hono). Antes a aba
  // aparecia e quebrava; agora só aparece para quem consegue ler.
  const abas = gestao
    ? ABAS_GESTAO.filter((a) => a.key !== "growth" || isAdminView(role))
    : ABAS_PESSOAIS;
  const abaPadrao = !gestao && isSdr ? "sdr" : "comercial";
  const abaAtiva = abas.some((a) => a.key === aba) ? aba : abaPadrao;

  // Grava o recorte na URL sem navegar (sem refetch do server component).
  useEffect(() => {
    if (meLoading) return;
    const qs = new URLSearchParams(window.location.search);
    qs.set("aba", abaAtiva);
    qs.set("periodo", periodo);
    const novo = `${window.location.pathname}?${qs.toString()}`;
    if (novo !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", novo);
  }, [abaAtiva, periodo, meLoading]);

  return (
    <div className="ins">
      <header className="ins-cab">
        <div>
          <h1 className="ins-titulo">Insights</h1>
          <p className="ins-sub">
            {gestao || meLoading ? "Desempenho da operação" : "Seus números"} · histórico confiável desde{" "}
            {GO_LIVE.toLocaleDateString("pt-BR")}, quando a base saiu do Zoho.
          </p>
        </div>
        <SeletorPeriodo value={periodo} onChange={setPeriodo} />
      </header>

      {meLoading ? (
        <section className="ins-hero" aria-busy="true" aria-label="Carregando indicadores">
          <span className="ins-hero-brilho" aria-hidden />
          <span className="ins-rotulo-escuro">Carregando…</span>
          <div className="ins-hero-valor"><strong>—</strong></div>
        </section>
      ) : isSdr && !gestao ? (
        <HeroSdr periodo={periodo} />
      ) : (
        <HeroComercial periodo={periodo} gestao={gestao} />
      )}

      {!meLoading && (
        <>
          <div className="ins-abas" role="tablist" aria-label="Relatórios">
            {abas.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={abaAtiva === t.key}
                className="ins-aba"
                onClick={() => setAba(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="ins-corpo" role="tabpanel">
            {gestao ? (
              <>
                {abaAtiva === "comercial" && <TabComercial periodo={periodo} ocultarHero />}
                {abaAtiva === "sdr" && <TabSdr periodo={periodo} />}
                {/* Pós-venda e Atividade do time são retrato de agora / últimos
                    14 dias: as rotas Hono não aceitam período. O seletor fica
                    visível, mas o próprio conteúdo diz a janela que usa. */}
                {abaAtiva === "pos-venda" && <TabPosVenda />}
                {abaAtiva === "atividade-time" && <TabAtividadeTime />}
                {abaAtiva === "growth" && <TabGrowth periodo={periodo} />}
                {abaAtiva === "marketing" && <TabMarketing periodo={periodo} />}
                {abaAtiva === "midia-paga" && <TabMidiaPaga periodo={periodo} />}
                {abaAtiva === "fechamento" && <TabFechamento periodo={periodo} />}
              </>
            ) : abaAtiva === "sdr" ? (
              <TabSdr periodo={periodo} />
            ) : (
              <TabComercialCloser periodo={periodo} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Hero comercial ─────────────────────────────────────────────────────── */

function HeroComercial({ periodo, gestao }: { periodo: string; gestao: boolean }) {
  // MESMA queryKey da TabComercial com safra "todos": o react-query deduplica.
  // Para closer, a queryKey é a da TabComercialCloser (mesma URL, escopo do
  // backend por responsavelId).
  const { data, isLoading, isError } = useQuery<Comercial>({
    queryKey: gestao ? ["relatorios", "comercial", periodo, "todos"] : ["relatorios", "comercial-closer", periodo],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/comercial?periodo=${periodo}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });
  // A série semanal é da organização inteira (a rota não escopa por papel):
  // só a gestão vê o gráfico. Closer veria o número da empresa como se fosse dele.
  const { data: semanal } = useQuery<{ series: Semana[] }>({
    queryKey: ["relatorios", "fechado-semanal"],
    enabled: gestao,
    queryFn: () => fetch(`/api/relatorios/fechado-mensal?semanas=12`).then((r) => r.json()),
  });

  const f = data?.fechado;
  const meta = data?.metaComercial;
  const pct = meta && meta.valorAlvo > 0 ? Math.round((meta.realizado / meta.valorAlvo) * 100) : null;
  const win = data?.winRateInfo;
  const v = (x: string) => (isLoading ? "…" : x);

  return (
    <section className="ins-hero" aria-label="Indicadores do período" aria-busy={isLoading}>
      <span className="ins-hero-brilho" aria-hidden />
      <div className="ins-hero-topo">
        <div>
          <span className="ins-rotulo-escuro">{gestao ? "Receita fechada" : "Sua receita fechada"} · {rotuloPeriodo(periodo)}</span>
          <div className="ins-hero-valor">
            <strong>{isError ? "—" : v(moeda(f?.receita ?? 0))}</strong>
            {f ? (
              <span>
                {f.ganhos} ganho{f.ganhos === 1 ? "" : "s"} · recorrente {moeda(f.recorrente)} · avulso {moeda(f.avulso)}
              </span>
            ) : null}
          </div>
          {meta && meta.valorAlvo > 0 ? (
            <>
              <div className="ins-barra" role="progressbar" aria-label="Meta comercial" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
              </div>
              {/* Meta é MENSAL (mês de início do período) e soma só as closers;
                  por isso o realizado dela pode diferir da receita do topo. */}
              <p className="ins-nota-escura">
                Meta das closers no mês: {moeda(meta.realizado)} de {moeda(meta.valorAlvo)} · <b style={{ color: "var(--ins-branco)" }}>{pct}%</b>
              </p>
            </>
          ) : meta ? (
            <p className="ins-nota-escura">Nenhuma meta de faturamento cadastrada para as closers neste mês.</p>
          ) : null}
          {isError ? <p className="ins-nota-escura">Não foi possível carregar os indicadores. Recarregue a página.</p> : null}
        </div>
        {gestao && semanal?.series?.length ? <GraficoSemanal series={semanal.series} /> : null}
      </div>
      <div className="ins-hero-kpis">
        <Kpi l="Win rate" v={v(win?.taxa != null ? `${win.taxa}%` : "—")} s={win ? (win.amostraPequena ? `base pequena · n=${win.n}` : `${win.n} decididos`) : ""} />
        <Kpi l="Ticket médio" v={v(data?.ticketMedio != null ? moeda(data.ticketMedio) : "—")} s="por negócio ganho" />
        <Kpi l="Ciclo médio" v={v(data?.cicloMedio != null ? `${data.cicloMedio}d` : "—")} s="entrada → ganho" />
        <Kpi l="Pipeline aberto" v={v(moeda(data?.pipeline.total ?? 0))} s={data ? `${data.pipeline.negociosAbertos} negócios · agora` : ""} />
        <Kpi l="Forecast ponderado" v={v(moeda(data?.pipeline.ponderado ?? 0))} s="valor × probabilidade da etapa" />
        <Kpi l="Leads qualificados" v={v(String(data?.leadsQualificados ?? 0))} s="no período" />
      </div>
    </section>
  );
}

/* ─── Hero da SDR (visão pessoal) ────────────────────────────────────────── */

function HeroSdr({ periodo }: { periodo: string }) {
  // MESMA queryKey da TabSdr: a requisição é compartilhada. Confere r.ok: um
  // 4xx/5xx viraria `{error}` (truthy) e quebraria a tela lendo campos ausentes.
  const { data, isLoading, isError } = useQuery<Esteira>({
    queryKey: ["sdr-esteira", periodo],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/sdr-esteira?periodo=${periodo}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });
  // Funil/totalEsteira/novosLeads do payload são da ORGANIZAÇÃO (getEsteiraSdr não
  // recebe usuário). Este hero é pessoal, então lê só a linha da própria SDR,
  // que o backend já filtra; sem linha → "—", nunca o total da empresa.
  const eu = data?.porResponsavel?.[0];
  const v = (x: string) => (isLoading ? "…" : isError ? "—" : x);
  const n = (x: number | undefined) => v(x != null ? String(x) : "—");
  return (
    <section className="ins-hero" aria-label="Indicadores do período" aria-busy={isLoading}>
      <span className="ins-hero-brilho" aria-hidden />
      <span className="ins-rotulo-escuro">Seus leads qualificados · {rotuloPeriodo(periodo)}</span>
      <div className="ins-hero-valor">
        <strong>{n(eu?.qualificado)}</strong>
        {eu ? <span>de {eu.total} na sua esteira</span> : null}
      </div>
      {isError ? <p className="ins-nota-escura">Não foi possível carregar os indicadores. Recarregue a página.</p> : null}
      <div className="ins-hero-kpis">
        <Kpi l="Ainda sem contato" v={n(eu?.novo)} s="entraram no período, seguem em Novo" />
        <Kpi l="Taxa de qualificação" v={v(eu ? `${eu.taxaQualificacao}%` : "—")} s="dos seus trabalhados" />
        <Kpi l="Reuniões agendadas" v={n(data?.reunioes?.agendadas)} s={data?.reunioes ? `${data.reunioes.realizadas} realizadas` : ""} />
        <Kpi l="Comparecimento" v={v(data?.reunioes ? `${data.reunioes.taxaComparecimento}%` : "—")} s="das suas reuniões" />
      </div>
    </section>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s?: string }) {
  return (
    <div className="ins-kpi">
      <span>{l}</span>
      <strong title={v}>{v}</strong>
      {s ? <small>{s}</small> : null}
    </div>
  );
}

/** Ganhos por semana (12 semanas, piso no go-live). Linha + área, sem eixo:
 * é tendência, o número exato está nas abas. */
function GraficoSemanal({ series: esparsa }: { series: Semana[] }) {
  const series = preencherSemanas(esparsa);
  const W = 320, H = 96, P = 6;
  const max = Math.max(1, ...series.map((s) => s.ganhosAi));
  const passo = series.length > 1 ? (W - P * 2) / (series.length - 1) : 0;
  const pts = series.map((s, i) => [P + i * passo, H - P - (s.ganhosAi / max) * (H - P * 2)] as const);
  const linha = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${linha} L${pts[pts.length - 1][0].toFixed(1)},${H - P} L${pts[0][0].toFixed(1)},${H - P} Z`;
  const ultima = series[series.length - 1];
  return (
    <figure className="ins-grafico" aria-label={`Negócios ganhos por semana nas últimas ${series.length} semanas`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
        <path className="ins-g-area" d={area} />
        <path className="ins-g-linha" d={linha} />
        <circle className="ins-g-ponto" cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.5} />
      </svg>
      <figcaption>
        <span>Ganhos por semana · desde {series[0].mes}</span>
        <span>sem. {ultima.mes}: <b style={{ color: "var(--ins-branco)" }}>{ultima.ganhosAi}</b></span>
      </figcaption>
    </figure>
  );
}

/* ─── Período ────────────────────────────────────────────────────────────── */

const fmtCurto = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

function rotuloPeriodo(p: string): string {
  const preset = PRESETS.find((x) => x.key === p);
  if (preset) return preset.label.toLowerCase();
  const { since, until } = parsePeriodo(p);
  return `${fmtCurto(since)} – ${fmtCurto(until)}`;
}

/** Mesmos valores do seletor antigo (mes_atual | mes_passado | 7d | custom:de:até)
 * — as rotas Hono entendem exatamente esses. Piso no go-live: o input não deixa
 * escolher antes, e o pino coral avisa quando a janela foi encurtada. */
function SeletorPeriodo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const custom = value.startsWith("custom:");
  const [de, setDe] = useState(custom ? value.split(":")[1] : "");
  const [ate, setAte] = useState(custom ? value.split(":")[2] : "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const aplicar = (d: string, a: string) => { if (d && a && d <= a) onChange(`custom:${d}:${a}`); };
  const { since, until } = parsePeriodo(value);
  const limitado = since.getTime() <= GO_LIVE.getTime();

  return (
    <div className="ins-periodo" ref={ref}>
      <div className="ins-seg" role="group" aria-label="Período">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" aria-pressed={value === p.key} onClick={() => { setAberto(false); onChange(p.key); }}>
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          aria-expanded={aberto}
          onClick={() => setAberto((x) => !x)}
          title={limitado ? `Limitado ao go-live (${GO_LIVE.toLocaleDateString("pt-BR")}): dado anterior vem do Zoho e não entra` : undefined}
        >
          <CalendarDays size={14} aria-hidden />
          {custom ? `${fmtCurto(since)} – ${fmtCurto(until)}` : "Intervalo"}
          {limitado ? <span className="ins-pino" aria-hidden /> : null}
        </button>
      </div>
      {aberto ? (
        <div className="ins-pop" role="dialog" aria-label="Intervalo personalizado">
          <p className="ins-pop-rotulo">Intervalo personalizado</p>
          <div className="ins-pop-campos">
            <input type="date" aria-label="De" value={de} min={GO_LIVE_ISO} onChange={(e) => { setDe(e.target.value); aplicar(e.target.value, ate); }} />
            <span aria-hidden>–</span>
            <input type="date" aria-label="Até" value={ate} min={GO_LIVE_ISO} onChange={(e) => { setAte(e.target.value); aplicar(de, e.target.value); }} />
          </div>
          <p>Aplicado: {fmtCurto(since)} – {fmtCurto(until)}</p>
        </div>
      ) : null}
    </div>
  );
}
