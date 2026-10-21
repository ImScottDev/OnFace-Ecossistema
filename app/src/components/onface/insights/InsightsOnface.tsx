"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, BarChart3, BookOpenText, CalendarDays, ChartNoAxesCombined, CircleGauge, Command, ContactRound, CreditCard, Filter, Fingerprint, Layers3, LayoutDashboard, Megaphone, Radio, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
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
import { dataSP } from "@/lib/relatorios/calendario-sp";
import { moeda } from "@/components/onface/vendas/formato";
import { TabFechamento } from "./TabFechamento";
import { TabExecutivo } from "./TabExecutivo";
import { TabQualidadeDados } from "./TabQualidadeDados";
import { BlocoGestao } from "./BlocoGestao";
import { Tablist } from "@/components/onface/ds/escolha";
import { preencherSemanas, type Semana } from "./semanas";
import "./insights.css";
import "./insights-premium.css";
import "./insights-functional.css";

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
  { key: "executivo", label: "Executivo" },
  { key: "comercial", label: "Comercial" },
  { key: "sdr", label: "Pré-vendas" },
  { key: "pos-venda", label: "Pós-venda" },
  { key: "atividade-time", label: "Atividade do time" },
  { key: "growth", label: "Growth" },
  { key: "marketing", label: "Marketing" },
  { key: "midia-paga", label: "Mídia paga" },
  { key: "fechamento", label: "Fechamento" },
  { key: "qualidade", label: "Qualidade dos dados" },
] as const;
const ABAS_PESSOAIS = [
  { key: "comercial", label: "Meu desempenho" },
  { key: "sdr", label: "Minha pré-venda" },
] as const;

const ICONES_ABAS = {
  executivo: LayoutDashboard, comercial: ChartNoAxesCombined, sdr: ContactRound, "pos-venda": ShieldCheck,
  "atividade-time": UsersRound, growth: CircleGauge, marketing: Megaphone, "midia-paga": Radio,
  fechamento: CreditCard, qualidade: Fingerprint,
} as const;
const DESCRICOES_ABAS: Record<string, string> = {
  executivo: "Receita, recorrência, carteira e evolução em uma leitura estratégica.",
  comercial: "Pipeline, conversões, resultados e produtividade de vendas.",
  sdr: "Contato, qualificação, tempo de resposta e passagem de bastão.",
  "pos-venda": "Carteira ativa, retenção, relacionamento e continuidade.",
  "atividade-time": "Capacidade, cadência, execução e distribuição do trabalho.",
  growth: "Aquisição, retenção, expansão e crescimento sustentável.",
  marketing: "Jornada, origens, qualidade e contribuição de canais.",
  "midia-paga": "Investimento, campanhas, retorno e conversões rastreáveis.",
  fechamento: "Receita decidida, documentos e evidências do fechamento.",
  qualidade: "Integridade das fontes antes da tomada de decisão.",
};
const PRESETS = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_passado", label: "Mês anterior" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
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

export function InsightsOnface({ abaInicial, periodoInicial, familiaInicial = "", janelaInicial = "12m", safraInicial = "nativo" }: { abaInicial: string; periodoInicial: string; familiaInicial?: string; janelaInicial?: string; safraInicial?: "todos" | "nativo" | "legado" }) {
  // Papel EFETIVO (respeita view-as) decide o menu. Segurança real é no backend
  // (o Hono filtra por responsavelId/403 conforme o papel).
  const { data: me, isLoading: meLoading } = useMe();
  const role = me?.role ?? "";
  const gestao = isAdminView(role) || role === "leitor";
  const isSdr = role === "sdr";

  const [periodo, setPeriodo] = useState(periodoInicial);
  const [aba, setAba] = useState(abaInicial);
  const [safraCom, setSafraCom] = useState<"todos" | "nativo" | "legado">(safraInicial);
  // Filtros do painel executivo: moram na URL como os demais, para o link colado abrir o mesmo recorte.
  const [familiaExec, setFamiliaExec] = useState(familiaInicial);
  const [janelaExec, setJanelaExec] = useState(janelaInicial);

  // Growth responde 403 para leitor (gate isAdminView no Hono). Antes a aba
  // aparecia e quebrava; agora só aparece para quem consegue ler.
  const abas = gestao
    ? ABAS_GESTAO.filter((a) => a.key !== "growth" || isAdminView(role))
    : ABAS_PESSOAIS;
  // Gestão abre no consolidado executivo (decisão de 12/10); SDR na própria esteira; closer no próprio desempenho.
  const abaPadrao = gestao ? "executivo" : isSdr ? "sdr" : "comercial";
  const abaAtiva = abas.some((a) => a.key === aba) ? aba : abaPadrao;

  // Grava o recorte na URL sem navegar (sem refetch do server component).
  useEffect(() => {
    if (meLoading) return;
    const qs = new URLSearchParams(window.location.search);
    qs.set("aba", abaAtiva);
    qs.set("periodo", periodo);
    if (abaAtiva === "comercial") qs.set("safra", safraCom);
    else qs.delete("safra");
    if (abaAtiva === "executivo") {
      if (familiaExec) qs.set("familia", familiaExec); else qs.delete("familia");
      qs.set("janela", janelaExec);
    } else { qs.delete("familia"); qs.delete("janela"); }
    const novo = `${window.location.pathname}?${qs.toString()}`;
    if (novo !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", novo);
  }, [abaAtiva, periodo, meLoading, familiaExec, janelaExec, safraCom]);

  return (
    <div className="ins">
      <header className="ins-studio-masthead" aria-label="Central de inteligência Callface">
        <div className="ins-studio-masthead-grid" aria-hidden="true" />
        <div className="ins-studio-topline">
          <span className="ins-studio-brand"><span className="ins-studio-brand-icon"><Command size={17} strokeWidth={2.5} /></span> CALLFACE <b>/ INTELLIGENCE</b></span>
          <span className="ins-studio-edition"><span aria-hidden="true" className="ins-studio-pulse" /> OPERATIONS STUDIO <span className="ins-studio-edition-number">02 / 26</span></span>
        </div>
        <div className="ins-studio-masthead-main">
          <div className="ins-studio-statement">
            <span className="ins-studio-overline"><Activity size={14} /> INTELIGÊNCIA PARA DECISÕES</span>
            <h1>Entenda os números.<br/><em>Enxergue o próximo passo.</em></h1>
            <p>Receita, aquisição e operação conectadas em análises que explicam o negócio — não apenas exibem indicadores.</p>
          </div>
          <div className="ins-studio-shortcuts">
            <span className="ins-studio-shortcuts-label">SEU ESPAÇO DE ANÁLISE</span>
            <Link href="/relatorios/biblioteca" className="ins-studio-shortcut"><BookOpenText size={18} /><span>Biblioteca de métricas<small>Definições, fontes e exploração</small></span><ArrowUpRight size={17}/></Link>
            <Link href="/relatorios/performance" className="ins-studio-shortcut"><BarChart3 size={18}/><span>Performance<small>Equipe, metas e resultados</small></span><ArrowUpRight size={17}/></Link>
          </div>
        </div>
        <div className="ins-studio-masthead-foot">
          <span><span className="ins-studio-foot-dot" /> DADOS DO CRM · CONSULTAS POR ORGANIZAÇÃO</span>
          <span>Estratégico <span aria-hidden="true">/</span> Tático <span aria-hidden="true">/</span> Operacional</span>
        </div>
      </header>

      {meLoading && (
        <section className="ins-studio-loading" role="status" aria-busy="true">
          <span className="ins-studio-loading-ring" aria-hidden="true" />
          Preparando seu espaço de inteligência…
        </section>
      )}

      {!meLoading && (
        <>
          {/* Aqui é aba de verdade: cada relatório é um painel. O par
              tab/painel estava solto — `role="tabpanel"` sem `id` e abas sem
              `aria-controls`. Ids fixos, e a seta anda entre os relatórios. */}
          <nav className="ins-studio-nav" aria-label="Áreas de inteligência">
            <div className="ins-studio-nav-top">
              <span><Layers3 size={14} /> ÁREAS DE INTELIGÊNCIA</span>
              <span>{String(abas.length).padStart(2, "0")} DOMÍNIOS · SELECIONE UM PAINEL</span>
            </div>
            <Tablist className="ins-abas" rotulo="Relatórios">
              {abas.map((t, i) => {
                const Icone = ICONES_ABAS[t.key];
                return (
                  <button key={t.key} type="button" role="tab"
                    id={`ins-aba-${t.key}`}
                    aria-selected={abaAtiva === t.key}
                    aria-controls={abaAtiva === t.key ? "ins-painel-aba" : undefined}
                    className="ins-aba" onClick={() => setAba(t.key)}>
                    <span className="ins-aba-indice">{String(i + 1).padStart(2, "0")}</span>
                    <Icone size={17} strokeWidth={1.85} aria-hidden="true" />
                    <span className="ins-aba-label">{t.label}</span>
                    <span className="ins-aba-ativo" aria-hidden="true" />
                  </button>
                );
              })}
            </Tablist>
          </nav>
          <div className="ins-studio-context">
            <div className="ins-studio-context-title">
              <span className="ins-studio-context-overline"><span className="ins-studio-context-line" /> WORKSPACE / {abaAtiva.toUpperCase().replaceAll("-", " ")}</span>
              <h2>{abas.find((t) => t.key === abaAtiva)?.label ?? "Insights"}<span className="ins-studio-context-suffix"> / Análise</span></h2>
              <p>{DESCRICOES_ABAS[abaAtiva] ?? "Indicadores explicados por fontes e recortes confiáveis."}</p>
            </div>
            <div className="ins-studio-context-controls">
              {abaAtiva === "pos-venda" || abaAtiva === "atividade-time" ? (
                <span className="ins-studio-fixed-period"><CalendarDays size={15} />{abaAtiva === "pos-venda" ? "Carteira atual" : "Últimos 14 dias"}</span>
              ) : abaAtiva !== "executivo" && abaAtiva !== "qualidade" ? (
                <>
                  <SeletorPeriodo value={periodo} onChange={setPeriodo} />
                  {abaAtiva === "comercial" && gestao && (
                    <div className="ins-seg" role="group" aria-label="Origem dos negócios">
                      {([{ key: "nativo", label: "CRM nativo" }, { key: "todos", label: "Todos" }, { key: "legado", label: "Zoho migrado" }] as const).map((s) => (
                        <button key={s.key} type="button" aria-pressed={safraCom === s.key}
                          onClick={() => setSafraCom(s.key)}>{s.label}</button>
                      ))}
                    </div>
                  )}
                </>
              ) : <span className="ins-studio-fixed-period"><Filter size={15} />{abaAtiva === "executivo" ? "Filtros por produto e competência abaixo" : "Consulta de integridade"}</span>}
            </div>
          </div>
          {abaAtiva !== "executivo" && abaAtiva !== "qualidade" && (
            <div className="ins-studio-operational-hero">
              {isSdr && !gestao ? <HeroSdr periodo={periodo} /> : <HeroComercial periodo={periodo} gestao={gestao} safra={abaAtiva === "comercial" && gestao ? safraCom : "nativo"} />}
            </div>
          )}

          <div className="ins-corpo" role="tabpanel" id="ins-painel-aba" aria-labelledby={`ins-aba-${abaAtiva}`}>
            {gestao ? (
              <>
                {abaAtiva === "executivo" && (
                  <TabExecutivo familiaInicial={familiaExec} janelaInicial={janelaExec}
                    aoMudar={(m) => { if (m.familia !== undefined) setFamiliaExec(m.familia); if (m.janela !== undefined) setJanelaExec(m.janela); }} />
                )}
                {abaAtiva === "comercial" && (
                  <>
                    <TabComercial periodo={periodo} ocultarHero safraSelecionada={safraCom} aoMudarSafra={setSafraCom} aoMudarPeriodo={setPeriodo} />
                    <div className="mt-6"><BlocoGestao periodo={periodo} /></div>
                  </>
                )}
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
                {abaAtiva === "qualidade" && <TabQualidadeDados />}
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

function HeroComercial({ periodo, gestao, safra }: { periodo: string; gestao: boolean; safra: "todos" | "nativo" | "legado" }) {
  // MESMA queryKey da TabComercial com safra "todos": o react-query deduplica.
  // Para closer, a queryKey é a da TabComercialCloser (mesma URL, escopo do
  // backend por responsavelId).
  const { data, isLoading, isError } = useQuery<Comercial>({
    queryKey: gestao ? ["relatorios", "comercial", periodo, safra] : ["relatorios", "comercial-closer", periodo, safra],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/comercial?periodo=${encodeURIComponent(periodo)}&safra=${safra}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });
  // A série semanal é da organização inteira (a rota não escopa por papel):
  // só a gestão vê o gráfico. Closer veria o número da empresa como se fosse dele.
  const { data: semanal } = useQuery<{ series: Semana[] }>({
    queryKey: ["relatorios", "fechado-semanal", periodo, safra],
    enabled: gestao,
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/fechado-mensal?periodo=${encodeURIComponent(periodo)}&safra=${safra}`);
      if (!r.ok) throw new Error("Série semanal indisponível");
      return r.json();
    },
  });

  const f = data?.fechado;
  const win = data?.winRateInfo;
  const v = (x: string) => (isLoading ? "…" : x);

  return (
    <section className="ins-hero" aria-label="Indicadores do período" aria-busy={isLoading}>
      <span className="ins-hero-brilho" aria-hidden />
      <div className="ins-hero-topo">
        <div>
          <span className="ins-rotulo-escuro">{gestao ? (safra === "nativo" ? "Vendas ganhas · CRM nativo" : safra === "legado" ? "Vendas ganhas · Zoho migrado" : "Vendas ganhas · todos os responsáveis") : "Suas vendas ganhas"} · {rotuloPeriodo(periodo)}</span>
          <div className="ins-hero-valor">
            <strong>{isError ? "—" : v(moeda(f?.receita ?? 0))}</strong>
            {f ? (
              <span>
                {f.ganhos} ganho{f.ganhos === 1 ? "" : "s"} · recorrente {moeda(f.recorrente)} · avulso {moeda(f.avulso)}
              </span>
            ) : null}
          </div>
          <p className="ins-nota-escura" data-escopo="todos">
            <strong>Escopo: {gestao ? "todos os responsáveis no recorte de safra" : "seus negócios"}.</strong> Esta é a receita de vendas ganhas,
            não o valor da meta individual. As metas de closers têm população e competência próprias.
          </p>
          {isError ? <p className="ins-nota-escura">Não foi possível carregar os indicadores. Recarregue a página.</p> : null}
        </div>
        {gestao && semanal?.series?.length ? <GraficoSemanal series={semanal.series} /> : null}
      </div>
      <div className="ins-hero-kpis">
        <Kpi l="Win rate" v={v(win?.taxa != null ? `${win.taxa}%` : "—")} s={win ? (win.amostraPequena ? `base pequena · n=${win.n}` : `${win.n} decididos`) : ""} />
        <Kpi l="Ticket médio" v={v(data?.ticketMedio != null ? moeda(data.ticketMedio) : "—")} s="por negócio ganho" />
        <Kpi l="Ciclo médio" v={v(data?.cicloMedio != null ? `${data.cicloMedio}d` : "—")} s="lead no CRM → ganho" />
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
  const { since, until } = parsePeriodo(value);
  const limitado = since.getTime() <= GO_LIVE.getTime();
  const valido = de >= GO_LIVE_ISO && ate >= GO_LIVE_ISO && de <= ate && ate <= dataSP(new Date());
  const aplicar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!valido) return;
    onChange("custom:" + de + ":" + ate);
    setAberto(false);
  };
  return (
    <div className="ins-periodo" ref={ref}>
      <div className="ins-seg" role="group" aria-label="Período dos relatórios">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" aria-pressed={value === p.key}
            onClick={() => { setAberto(false); onChange(p.key); }}>{p.label}</button>
        ))}
        <button type="button" aria-pressed={custom} aria-expanded={aberto}
          aria-controls="ins-calendario-personalizado" onClick={() => {
            if (!aberto && value.startsWith("custom:")) {
              const [, inicio, fim] = value.split(":");
              setDe(inicio);
              setAte(fim);
            }
            setAberto((x) => !x);
          }}
          title={limitado ? "Histórico operacional limitado ao go-live do CRM" : "Selecionar datas"}>
          <CalendarDays size={15} aria-hidden />
          {custom ? fmtCurto(since) + " – " + fmtCurto(new Date(until.getTime() - 1)) : "Personalizado"}
          {limitado && <span className="ins-pino" aria-hidden />}
        </button>
      </div>
      {aberto && (
        <form className="ins-pop ins-pop-calendario" id="ins-calendario-personalizado"
          role="dialog" aria-label="Definir período personalizado" onSubmit={aplicar}>
          <p className="ins-pop-rotulo">ESCOLHER INTERVALO</p>
          <p>Selecione as datas de início e fim. O relatório só atualiza ao clicar em Aplicar.</p>
          <div className="ins-pop-campos">
            <label>Início<input type="date" value={de} min={GO_LIVE_ISO} max={dataSP(new Date())}
              onChange={(e) => setDe(e.target.value)} required/></label>
            <label>Fim<input type="date" value={ate} min={de || GO_LIVE_ISO} max={dataSP(new Date())}
              onChange={(e) => setAte(e.target.value)} required/></label>
          </div>
          {de && ate && de > ate && <p role="alert" className="ins-data-erro">A data inicial não pode ser maior que a final.</p>}
          <div className="ins-pop-acoes">
            <button type="button" onClick={() => setAberto(false)}>Cancelar</button>
            <button type="submit" disabled={!valido}>Aplicar período</button>
          </div>
          <p className="ins-pop-rodape">Fuso: São Paulo · dados operacionais a partir de 01/07/2026</p>
        </form>
      )}
    </div>
  );
}
