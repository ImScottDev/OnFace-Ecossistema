"use client";

import * as React from "react";
import Link from "next/link";
import {
  Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "motion/react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, CalendarRange, ChartNoAxesCombined,
  CircleAlert, Download, Filter, Info, Minus, Target, TrendingUp, Users, Wallet,
} from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { ExecutiveRevenueStory } from "./ExecutiveRevenueStory";
import { ExecutiveMonthDrawer } from "./ExecutiveMonthDrawer";
import { useMetrica, type ErroMetrica } from "@/components/onface/relatorios/useMetrica";
import { usePainel, cartao, valorDe } from "./usePainel";
import { VALOR_FAMILIA, dinheiro, dinheiroCurto, fimDoPonto, rotuloPonto } from "@/components/onface/relatorios/explorador-formato";
import { FAMILIAS } from "@/lib/metricas/recorte";
import type { Cartao, Alerta } from "@/lib/metricas/painel-geral-tipos";
import "@/components/onface/relatorios/relatorios.css";
import "./visao-geral.css";

/**
 * Visão Geral executiva.
 *
 * Cada número vem da mesma rota (e do mesmo recorte) que abre ao clicar nele:
 * cartão e lista nunca divergem. O que a fonte não sustenta aparece com o
 * motivo, nunca como zero — é por isso que há cartão dizendo "indisponível"
 * no lugar de um R$ 0,00 que pareceria um fato.
 *
 * A ordem da tela é a ordem das perguntas de quem chega aqui para decidir:
 * a receita recorrente está de pé? de onde ela vem e bate a meta? o que mudou
 * nos indicadores? como foi a evolução? o que exige decisão hoje?
 */

const BIB = "/relatorios/biblioteca/metrica-";
const JANELAS = [
  { chave: "12m", rotulo: "12 meses" },
  { chave: "ano_atual", rotulo: "Ano atual" },
  { chave: "tudo", rotulo: "Todo o histórico" },
] as const;
type Janela = (typeof JANELAS)[number]["chave"];

/** Cor por família. Categórica de gráfico, igual ao resto do DS. */
const COR_FAMILIA: Record<string, string> = {
  PABX: "var(--chart-1)",
  CALLFACE_AI: "var(--chart-2)",
  WHITE_LABEL: "var(--chart-5)",
  UNKNOWN: "var(--chart-3)",
};

const CONFIG: ChartConfig = {
  valor: { label: "Faturado", color: "var(--chart-1)" },
  anterior: { label: "Mesmo mês do ano anterior", color: "var(--chart-3)" },
};

const pct = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

function link(codigo: string, p: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return `${BIB}${codigo}${qs ? `?${qs}` : ""}`;
}
/** O servidor já manda `codigo?querystring`; a tela só prefixa a rota. */
const href = (drill: string | null) => (drill ? `${BIB}${drill}` : undefined);

export function TabExecutivo({ familiaInicial, janelaInicial, aoMudar }: {
  familiaInicial: string; janelaInicial: string; aoMudar: (m: { familia?: string; janela?: string }) => void;
}) {
  const reduzido = useReducedMotion();
  const familia = (FAMILIAS as readonly string[]).includes(familiaInicial) ? familiaInicial : "";
  const janela: Janela = JANELAS.some((j) => j.chave === janelaInicial) ? (janelaInicial as Janela) : "12m";
  const f = familia || undefined;

  // O painel inteiro numa requisição: cartões, composição, alertas e lacunas.
  const painel = usePainel({ periodo: janela, familia: f, serie: janela });

  // A série completa alimenta o gráfico grande, a área do destaque e as faíscas.
  const hist = useMetrica("faturamento_competencia", { periodo: "tudo", familia: f, tamanho: "5" });
  const clientes = useMetrica("clientes_faturados", { periodo: janela, familia: f, ordem: "valor", sentido: "desc", tamanho: "10" });

  const p = painel.data;
  const mrr = cartao(p, "mrr_atual");
  const faturado = cartao(p, "faturamento_competencia");
  const booking = cartao(p, "booking_ganho");
  const recebido = cartao(p, "recebido");
  const ativos = cartao(p, "clientes_ativos");
  const winRate = cartao(p, "win_rate");
  const ticket = cartao(p, "ticket_medio_booking");
  const meta = cartao(p, "meta_booking");
  const pipeline = cartao(p, "pipeline_aberto");
  const leads = cartao(p, "leads_novos");
  const oportunidades = cartao(p, "oportunidades_criadas");

  // ── Derivados da série mensal (mesma resposta do gráfico) ──
  const pontos = hist.data?.exploracao.serie?.pontos ?? [];
  const ultimo = pontos[pontos.length - 1];
  const mesmoMesAnterior = ultimo ? pontos.find((x) => x.inicio === `${Number(ultimo.inicio.slice(0, 4)) - 1}${ultimo.inicio.slice(4)}`) : undefined;
  const ult12 = pontos.slice(-12), ant12 = pontos.slice(-24, -12);
  const soma = (a: typeof pontos) => a.reduce((x, y) => x + y.valor, 0);
  const yoy = ultimo && mesmoMesAnterior && mesmoMesAnterior.valor > 0 ? ultimo.valor / mesmoMesAnterior.valor - 1 : null;
  const yoy12 = ant12.length === 12 && soma(ant12) > 0 ? soma(ult12) / soma(ant12) - 1 : null;
  const media3 = pontos.length >= 4 ? soma(pontos.slice(-4, -1)) / 3 : null;
  const vsMedia3 = media3 && media3 > 0 && ultimo ? ultimo.valor / media3 - 1 : null;

  const visiveis = janela === "tudo" ? pontos
    : janela === "ano_atual" ? pontos.filter((x) => ultimo && x.inicio.slice(0, 4) === ultimo.inicio.slice(0, 4))
      : pontos.slice(-12);
  const dados = visiveis.map((x) => {
    const a = pontos.find((y) => y.inicio === `${Number(x.inicio.slice(0, 4)) - 1}${x.inicio.slice(4)}`);
    return { ...x, rotulo: rotuloPonto(x.inicio, "mes"), anterior: a?.valor ?? null, rotuloAnterior: a ? rotuloPonto(a.inicio, "mes") : null };
  });
  const temAnterior = dados.some((d) => d.anterior !== null);
  const [oculta, setOculta] = React.useState(false);
  const [mesFocado, setMesFocado] = React.useState<string | null>(null);
  const [mesAberto, setMesAberto] = React.useState<string | null>(null);
  const focoValido = visiveis.some((x) => x.inicio === mesFocado) ? mesFocado : null;
  const abrirMes = (inicio: string) => { setMesFocado(inicio); setMesAberto(inicio); };

  // ── Composição do MRR por família (o "de onde vem") ──
  const composicao = p?.blocos.composicao;
  const dimFamilia = composicao?.dimensoes.find((d) => d.chave === "familia");
  const fatias = (dimFamilia?.itens ?? []).filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor);
  const totalComposicao = composicao?.total ?? fatias.reduce((a, i) => a + i.valor, 0);
  const avisoWl = p?.blocos.receita.avisos.find((a) => a.codigo === "white_label_sem_recorrencia");

  // ── Concentração ──
  const top = clientes.data?.exploracao.linhas ?? [];
  const somaTodos = clientes.data?.exploracao.somaValor ?? 0;
  const somaTop = (n: number) => top.slice(0, n).reduce((a, l) => a + Number(l.valor), 0);

  // ── Meta do mês ──
  const metaValor = valorDe(meta);
  const bookingValor = valorDe(booking);
  const atingido = metaValor && metaValor > 0 && bookingValor !== null ? bookingValor / metaValor : null;

  const erroPainel = painel.error;

  return (
    <div className="ex">
      {/* ── Topo ──────────────────────────────────────────────── */}
      <div className="vg-topo">
        <div>
          <h1>Visão Geral Executiva</h1>
          <p>Receita, carteira e conversão da Callface, com a origem de cada número a um clique.</p>
        </div>
        <Link className="rx-btn" href={`/api/relatorios/metricas/faturamento_competencia/exportar?periodo=${janela}${f ? `&familia=${f}` : ""}`}>
          <Download size={15} aria-hidden /> Exportar faturamento
        </Link>
      </div>

      {/* ── Filtros ───────────────────────────────────────────── */}
      <div className="vg-filtros">
        <div className="vg-filtro">
          <span>Período</span>
          <div className="rx-seg" role="group" aria-label="Período dos indicadores">
            {JANELAS.map((j) => (
              <button key={j.chave} type="button" aria-pressed={janela === j.chave}
                onClick={() => aoMudar({ janela: j.chave })}>{j.rotulo}</button>
            ))}
          </div>
        </div>
        <div className="vg-filtro">
          <span>Produto</span>
          <div className="rx-seg" role="group" aria-label="Família de serviço">
            <button type="button" aria-pressed={!familia} onClick={() => aoMudar({ familia: "" })}>Consolidado</button>
            {FAMILIAS.map((x) => (
              <button key={x} type="button" aria-pressed={familia === x} onClick={() => aoMudar({ familia: x })}>{VALOR_FAMILIA[x]}</button>
            ))}
          </div>
        </div>
        <div className="vg-filtro">
          <span>Comparação</span>
          <span className="vg-frescor" style={{ height: "calc(30 * var(--onface-u))", alignItems: "center" }}>
            <CalendarRange size={14} aria-hidden /> Período anterior equivalente
          </span>
        </div>
        {familia ? (
          <button type="button" className="rx-btn vg-filtro-limpar" onClick={() => aoMudar({ familia: "" })}>
            <Filter size={14} aria-hidden /> Limpar filtros
          </button>
        ) : null}
      </div>

      {erroPainel ? (
        <p className="rx-aviso" data-tom="erro" role="alert">
          {erroPainel.status === 400 ? erroPainel.mensagem : "Não foi possível carregar o painel. Recarregue a página."}
        </p>
      ) : null}

      {/* ── Receita recorrente + saúde da operação ────────────── */}
      <div className="vg-primeira">
        <section className="vg-destaque" aria-label="Receita recorrente">
          <div className="vg-destaque-cab">
            <span className="vg-destaque-rotulo">
              <span className="vg-icone"><Wallet size={15} aria-hidden /></span> Receita recorrente
            </span>
            {ultimo ? <span className="vg-pill" data-tom="neutro">Fechado até {rotuloPonto(ultimo.inicio, "mes")}</span> : null}
          </div>

          {painel.isPending ? (
            <>
              <span className="vg-esqueleto" style={{ height: 44, width: "min(100%, 280px)" }} />
              <span className="vg-esqueleto" style={{ height: 36, width: "min(100%, 440px)" }} />
            </>
          ) : mrr && valorDe(mrr) !== null ? (
            <>
              <div className="vg-destaque-valor">
                <span className="vg-valor">{dinheiro(valorDe(mrr), "BRL")}</span>
              </div>
              {/* Frase curta na tela; a definição técnica inteira fica no
                  tooltip e no explorador, que é onde ela é útil. */}
              <p className="vg-valor-sub" title={mrr.fonte}>
                Retrato de agora: a recorrência faturada na última competência fechada, mais as
                assinaturas ativas que ainda não entraram nela.
                {mrr.registros ? ` ${mrr.registros.toLocaleString("pt-BR")} linhas explicam este número.` : ""}
              </p>
              {avisoWl ? (
                <p className="vg-valor-sub">
                  <CircleAlert size={13} aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                  {avisoWl.mensagem}{" "}
                  <Link href={href(avisoWl.drill) ?? "#"} style={{ color: "var(--of-coral-no-escuro)" }}>Ver as linhas</Link>
                </p>
              ) : null}
            </>
          ) : (
            <Indisponivel c={mrr} escuro />
          )}

          {/* A área é o faturamento mensal — a série que existe e explica a
              receita no tempo. O número acima é um retrato de agora: rótulos
              separados de propósito, para não dar a entender que o MRR tem
              histórico que ele não tem. */}
          {dados.length > 1 ? (
            <figure className="vg-destaque-grafico" style={{ margin: 0 }}>
              <ChartContainer config={CONFIG} className="vg-destaque-grafico" style={{ height: "100%" }}>
                <AreaChart data={dados} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vg-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--of-coral-marca)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--of-coral-marca)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={6}
                    interval="preserveStartEnd" minTickGap={28}
                    tick={{ fill: "var(--of-shell-tinta-4)", fontSize: 11 }} />
                  <Tooltip cursor={{ stroke: "var(--of-shell-linha)" }} content={<Tip titulo="Faturado" />} />
                  <Area dataKey="valor" type="monotone" stroke="var(--of-coral-marca)" strokeWidth={2}
                    fill="url(#vg-area)" isAnimationActive={!reduzido} />
                </AreaChart>
              </ChartContainer>
              <figcaption className="vg-valor-sub" style={{ fontSize: "var(--of-t-meta)" }}>
                Faturamento mensal fechado — a recorrência acima é um retrato de hoje, não a série.
              </figcaption>
            </figure>
          ) : null}
        </section>

        <section className="vg-painel" aria-label="Saúde da operação">
          <div className="vg-painel-cab">
            <div>
              <h2><span className="vg-icone" data-tom="sucesso"><ChartNoAxesCombined size={15} aria-hidden /></span> De onde vem a receita</h2>
              <p>{composicao?.titulo ?? "Composição do faturamento"} por produto, no período selecionado.</p>
            </div>
          </div>

          {painel.isPending ? <span className="vg-esqueleto" style={{ height: 120 }} /> : fatias.length > 0 ? (
            <>
              <div className="vg-faixa" role="img"
                aria-label={`Composição: ${fatias.map((i) => `${VALOR_FAMILIA[i.chave as keyof typeof VALOR_FAMILIA] ?? "Sem família"} ${dinheiro(i.valor, "BRL")}`).join(", ")}`}>
                {fatias.map((i) => {
                  const parte = (i.valor / Math.max(totalComposicao, 1)) * 100;
                  const destino = href(i.drill);
                  const conteudo = parte >= 9 ? `${parte.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "";
                  return destino ? (
                    <Link key={i.chave} href={destino} style={{ flex: `${i.valor} 0 0`, minWidth: "calc(18 * var(--onface-u))", background: COR_FAMILIA[i.chave] ?? "var(--chart-3)" }}
                      aria-label={`${VALOR_FAMILIA[i.chave as keyof typeof VALOR_FAMILIA] ?? "Sem família"}: abrir os registros`}>{conteudo}</Link>
                  ) : (
                    <span key={i.chave} style={{ flex: `${i.valor} 0 0`, minWidth: "calc(18 * var(--onface-u))", background: COR_FAMILIA[i.chave] ?? "var(--chart-3)", cursor: "default" }}>{conteudo}</span>
                  );
                })}
              </div>
              <div className="vg-faixa-legenda">
                {fatias.map((i) => {
                  const destino = href(i.drill);
                  const corpo = (
                    <>
                      <span>
                        <span className="vg-faixa-ponto" style={{ background: COR_FAMILIA[i.chave] ?? "var(--chart-3)" }} aria-hidden />
                        {VALOR_FAMILIA[i.chave as keyof typeof VALOR_FAMILIA] ?? "Sem família"}
                      </span>
                      <b>{dinheiro(i.valor, "BRL")}</b>
                    </>
                  );
                  return destino
                    ? <Link key={i.chave} href={destino}>{corpo}</Link>
                    : <div key={i.chave}>{corpo}</div>;
                })}
              </div>
            </>
          ) : <Indisponivel c={mrr} />}

          {/* Meta do mês: existe de verdade em `metas`, não é número de enfeite. */}
          {metaValor !== null && metaValor > 0 ? (
            <div className="vg-meta">
              <div className="vg-meta-linha">
                <span>Meta do mês</span>
                <b>{dinheiro(metaValor, "BRL")}</b>
              </div>
              <div className="vg-barra" data-tom={atingido !== null && atingido >= 0.9 ? undefined : atingido !== null && atingido >= 0.6 ? "atencao" : "baixo"}>
                <span style={{ width: `${Math.min(100, Math.max(0, (atingido ?? 0) * 100))}%` }} />
              </div>
              <div className="vg-meta-linha">
                <span>{atingido !== null ? `${(atingido * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% atingido` : "sem base"}</span>
                <span>
                  {atingido !== null && atingido < 1 && bookingValor !== null
                    ? `Faltam ${dinheiro(metaValor - bookingValor, "BRL")}`
                    : atingido !== null ? "Meta batida" : ""}
                </span>
              </div>
              {meta?.naoInclui ? (
                <p className="vg-estado" data-estado="parcial" title={meta.naoInclui}>
                  <Info size={12} aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                  A meta cadastrada não é comparável ao booking — passe o cursor
                </p>
              ) : null}
            </div>
          ) : meta ? <Indisponivel c={meta} rotulo="Meta do mês" /> : null}
        </section>
      </div>

      {/* ── Indicadores ───────────────────────────────────────── */}
      <section className="vg-kpis" aria-label="Indicadores do período">
        {painel.isPending
          ? [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="vg-cartao">
              <span className="vg-esqueleto" style={{ height: 14, width: 100 }} />
              <span className="vg-esqueleto" style={{ height: 26, width: 130 }} />
              <span className="vg-esqueleto" style={{ height: 14, width: "80%" }} />
            </div>
          ))
          : (
            <>
              <CartaoKpi c={faturado} icone={<Banknote size={15} />} tom="neutro"
                titulo={ultimo ? `Faturado em ${rotuloPonto(ultimo.inicio, "mes")}` : "Faturado"}
                valorForcado={ultimo?.valor} deltaForcado={yoy} notaForcada={ult12.length === 12 ? `12 meses: ${dinheiroCurto(soma(ult12), "BRL")}${yoy12 !== null ? ` · ${pct(yoy12)} vs 12 anteriores` : ""}` : undefined}
                faisca={ult12.map((x) => x.valor)}
                destino={ultimo ? link("faturamento_competencia", { periodo: "tudo", familia: f, de: ultimo.inicio, ate: fimDoPonto(ultimo.inicio, "mes") }) : undefined} />
              <CartaoKpi c={booking} icone={<TrendingUp size={15} />} tom="sucesso" />
              <CartaoKpi c={recebido} icone={<Wallet size={15} />} tom="neutro" />
              <CartaoKpi c={ativos} icone={<Users size={15} />} tom="neutro" />
              <CartaoKpi c={winRate} icone={<Target size={15} />} tom="sucesso" />
              <CartaoKpi c={ticket} icone={<Banknote size={15} />} tom="neutro" />
            </>
          )}
      </section>

      {/* ── Evolução + alertas ────────────────────────────────── */}
      <div className="vg-segunda">
        <section className="vg-painel" aria-label="Faturamento por competência">
          <div className="vg-painel-cab">
            <div>
              <h2><span className="vg-icone"><ChartNoAxesCombined size={15} aria-hidden /></span> Faturamento por competência</h2>
              <p>Clique numa barra para abrir os registros daquele mês. Competência não fechada não aparece — e não vira zero.</p>
            </div>
            <Link className="rx-kpi-ver" href={link("faturamento_competencia", { periodo: janela, familia: f })}>Ver os registros</Link>
          </div>

          {hist.isPending ? <div className="vg-esqueleto" style={{ height: 260 }} />
            : hist.error ? <Aviso erro={hist.error} />
              : dados.length === 0 ? (
                <div className="rel-vazio" style={{ padding: "32px 12px", boxShadow: "none" }}>
                  <strong>Sem faturamento para esta família</strong><span>Nenhuma competência tem valor neste filtro.</span>
                </div>
              ) : (
                <>
                  <ExecutiveRevenueStory pontos={visiveis} mes={focoValido} aoExplorar={abrirMes} />
                  <div className="vg-grafico-lado">
                    <div style={{ minWidth: 0 }}>
                      <div className="rx-barra" style={{ justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
                        {temAnterior ? (
                          <div className="rx-legenda" role="group" aria-label="Séries">
                            <button type="button" aria-pressed disabled style={{ cursor: "default" }}><i style={{ background: "var(--chart-1)" }} />Faturado no mês</button>
                            <button type="button" aria-pressed={!oculta} onClick={() => setOculta((v) => !v)}><i style={{ background: "var(--chart-3)" }} />Mesmo mês do ano anterior</button>
                          </div>
                        ) : <span />}
                        <div className="rx-barra" style={{ marginLeft: "auto" }}>
                          {focoValido && <button type="button" className="rx-btn" onClick={() => setMesFocado(null)}>Limpar seleção</button>}
                          <select id="ex-mes-detalhe" className="rx-select" aria-label="Selecione uma competência para detalhar"
                            value={focoValido ?? ""} onChange={(e) => { if (e.target.value) abrirMes(e.target.value); }}>
                            <option value="">Selecionar mês</option>
                            {dados.map((x) => <option key={x.inicio} value={x.inicio}>{x.rotulo}</option>)}
                          </select>
                        </div>
                      </div>
                      <ChartContainer config={CONFIG} className="vg-grafico">
                        <ComposedChart data={dados} accessibilityLayer margin={{ left: 4, right: 8, top: 8 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={18} />
                          <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={(v: number) => dinheiroCurto(v, "BRL")} />
                          <Tooltip cursor={{ fill: "var(--of-calha)", opacity: 0.6 }} content={<Tip titulo="Faturado" comparar />} />
                          <Bar dataKey="valor" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={38}
                            isAnimationActive={!reduzido} animationDuration={380} cursor="pointer"
                            onClick={(d) => { const i = (d as unknown as { inicio?: string }).inicio; if (i) abrirMes(i); }}>
                            {dados.map((x) => <Cell key={x.inicio} fill={focoValido === x.inicio ? "var(--of-coral-acao)" : "var(--chart-1)"} />)}
                          </Bar>
                          {temAnterior && !oculta
                            ? <Line dataKey="anterior" type="monotone" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={!reduzido} />
                            : null}
                        </ComposedChart>
                      </ChartContainer>
                    </div>

                    <div className="vg-derivados">
                      <Derivado rotulo="Evolução mensal" v={yoy} nota={mesmoMesAnterior ? `vs ${rotuloPonto(mesmoMesAnterior.inicio, "mes")}` : "sem mês comparável"} />
                      <Derivado rotulo="Vs. média de 3 meses" v={vsMedia3} nota={media3 ? `Média: ${dinheiro(media3, "BRL")}` : "sem três competências"} />
                      <Derivado rotulo="12 meses vs 12 anteriores" v={yoy12} nota={ult12.length === 12 ? dinheiroCurto(soma(ult12), "BRL") : "sem 24 competências"} />
                    </div>
                  </div>
                </>
              )}
        </section>

        <section className="vg-painel" aria-label="O que exige decisão">
          <div className="vg-painel-cab">
            <div>
              <h2><span className="vg-icone" data-tom="aviso"><CircleAlert size={15} aria-hidden /></span> O que exige decisão</h2>
              <p>Cada alerta aponta a métrica que o prova. O clique abre os registros.</p>
            </div>
          </div>
          {painel.isPending ? <span className="vg-esqueleto" style={{ height: 160 }} />
            : <Alertas alertas={p?.blocos.alertas.alertas ?? []} />}
        </section>
      </div>

      {/* ── Aquisição e concentração ──────────────────────────── */}
      <div className="vg-duas">
        <section className="vg-painel" aria-label="Da entrada à venda">
          <div className="vg-painel-cab">
            <div>
              <h2><span className="vg-icone" data-tom="neutro"><Filter size={15} aria-hidden /></span> Da entrada à venda</h2>
              <p>Volumes do período. São etapas distintas, não uma coorte: um lead de março pode virar oportunidade em agosto.</p>
            </div>
          </div>
          {painel.isPending ? <span className="vg-esqueleto" style={{ height: 90 }} /> : (
            <div className="vg-funil">
              <EtapaFunil c={leads} rotulo="Leads novos" />
              <EtapaFunil c={oportunidades} rotulo="Oportunidades criadas" base={valorDe(leads)} />
              <EtapaFunil c={pipeline} rotulo="Pipeline aberto" />
              <EtapaFunil c={booking} rotulo="Venda ganha" />
            </div>
          )}
        </section>

        <section className="vg-painel" aria-label="Concentração de clientes">
          <div className="vg-painel-cab">
            <div>
              <h2><span className="vg-icone" data-tom="neutro"><Users size={15} aria-hidden /></span> Concentração</h2>
              <p>Quanto do faturado depende dos maiores clientes.</p>
            </div>
            <Link className="rx-kpi-ver" href={link("clientes_faturados", { periodo: janela, familia: f })}>Ver todos</Link>
          </div>
          {clientes.isPending ? <span className="vg-esqueleto" style={{ height: 150 }} />
            : clientes.error ? <Aviso erro={clientes.error} />
              : top.length === 0 ? <p className="vg-estado">Nenhum cliente faturado neste filtro.</p>
                : (
                  <>
                    <p className="vg-leitura" data-tom="neutro">
                      <TrendingUp size={15} aria-hidden />
                      <span>
                        <b>{pct(somaTodos ? somaTop(5) / somaTodos : 0).replace("+", "")} vem dos 5 maiores</b>
                        {pct(somaTodos ? somaTop(10) / somaTodos : 0).replace("+", "")} dos 10 maiores, entre{" "}
                        {(clientes.data?.exploracao.registrosTotal ?? 0).toLocaleString("pt-BR")} clientes faturados.
                      </span>
                    </p>
                    <ol className="ex-top">
                      {top.slice(0, 6).map((l, i) => (
                        <li key={String(l.documento ?? i)} style={{ "--p": `${somaTodos ? (Number(l.valor) / Number(top[0].valor)) * 100 : 0}%` } as React.CSSProperties}>
                          <span className="ex-top-nome">{l.empresa_id ? <Link href={`/empresas/${l.empresa_id}`}>{String(l.empresa)}</Link> : String(l.empresa)}</span>
                          <span className="ex-top-valor">{dinheiro(Number(l.valor), "BRL")}</span>
                          <span className="ex-top-meta">{somaTodos ? ((Number(l.valor) / somaTodos) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
        </section>
      </div>

      {mesAberto ? <ExecutiveMonthDrawer key={mesAberto + (f ?? "todos")} mes={mesAberto} familia={f} aoFechar={() => setMesAberto(null)} /> : null}

      {/* ── Lacunas ───────────────────────────────────────────── */}
      {p && p.lacunas.length > 0 ? (
        <section className="vg-lacunas" aria-label="O que este painel ainda não responde">
          <h3>O que este painel não responde, e por quê</h3>
          {p.lacunas.map((l) => (
            <p key={l.titulo} className="vg-lacuna"><b>{l.titulo}</b>{l.motivo}</p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/* ───────── peças ───────── */

function Aviso({ erro }: { erro: ErroMetrica }) {
  return <p className="rx-aviso" data-tom="erro" role="alert">{erro.codigo === "filtro_nao_suportado" ? erro.message : "Não foi possível carregar este bloco. Recarregue a página."}</p>;
}

/** Ausência com motivo. Nunca um zero que pareceria um fato. */
function Indisponivel({ c, rotulo, escuro }: { c: Cartao | null; rotulo?: string; escuro?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {rotulo ? <span className="vg-cartao-titulo">{rotulo}</span> : null}
      <span className="vg-vazio" style={escuro ? { color: "var(--of-shell-tinta-4)" } : undefined}>—</span>
      <span className={escuro ? "vg-valor-sub" : "vg-estado"} data-estado={c?.estado ?? "indisponivel"}>
        {c?.motivo?.mensagem ?? "Indisponível agora."}
      </span>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  const tom = v > 0.0005 ? "alta" : v < -0.0005 ? "baixa" : "neutro";
  const Seta = tom === "alta" ? ArrowUpRight : tom === "baixa" ? ArrowDownRight : Minus;
  return <span className="vg-delta" data-tom={tom}><Seta size={13} aria-hidden />{pct(v)}</span>;
}

function Derivado({ rotulo, v, nota }: { rotulo: string; v: number | null; nota: string }) {
  const tom = v === null ? "neutro" : v > 0.0005 ? undefined : v < -0.0005 ? "baixa" : "neutro";
  return (
    <div className="vg-derivado">
      <span>{rotulo}</span>
      <strong data-tom={tom}>{v === null ? "—" : pct(v)}</strong>
      <small>{nota}</small>
    </div>
  );
}

/** Mini-série do cartão. Só desenha quando há histórico de verdade. */
function Faisca({ dados }: { dados: number[] }) {
  const reduzido = useReducedMotion();
  if (dados.length < 3) return null;
  const pontos = dados.map((v, i) => ({ i, v }));
  const subindo = dados[dados.length - 1] >= dados[0];
  const cor = subindo ? "var(--of-sucesso-tinta)" : "var(--of-coral-acao)";
  return (
    <div className="vg-faisca" aria-hidden>
      <ChartContainer config={{ v: { label: "série", color: cor } }} className="vg-faisca" style={{ height: "100%", aspectRatio: "auto" }}>
        <AreaChart data={pontos} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Area dataKey="v" type="monotone" stroke={cor} strokeWidth={1.5} fill={cor} fillOpacity={0.12}
            dot={false} isAnimationActive={!reduzido} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function CartaoKpi({ c, icone, tom, titulo, valorForcado, deltaForcado, notaForcada, faisca, destino }: {
  c: Cartao | null;
  icone: React.ReactNode;
  tom?: "sucesso" | "aviso" | "neutro";
  titulo?: string;
  valorForcado?: number;
  deltaForcado?: number | null;
  notaForcada?: string;
  faisca?: number[];
  destino?: string;
}) {
  if (!c && valorForcado === undefined) return null;
  const nome = titulo ?? c?.nome ?? "";
  const valor = valorForcado ?? valorDe(c);
  const unidade = c?.unidade ?? "BRL";
  const variacao = deltaForcado !== undefined ? deltaForcado : c?.comparacao?.variacao ?? null;
  const url = destino ?? href(c?.drill ?? null);
  const ressalva = [c?.estado === "parcial" ? c?.motivo?.mensagem : null, c?.naoInclui].filter(Boolean).join(" ") || null;

  const corpo = (
    <>
      <div className="vg-cartao-topo">
        <span className="vg-icone" data-tom={tom}>{icone}</span>
        <span className="vg-cartao-titulo" title={nome}>{nome}</span>
      </div>
      {valor === null ? (
        <>
          <span className="vg-vazio">—</span>
          <span className="vg-estado" data-estado={c?.estado ?? "indisponivel"}>{c?.motivo?.mensagem ?? "Indisponível agora."}</span>
        </>
      ) : (
        <>
          <span className="vg-cartao-valor">
            {unidade === "percentual"
              ? `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : unidade === "contagem"
                ? valor.toLocaleString("pt-BR")
                : dinheiro(valor, unidade)}
          </span>
          <div className="vg-cartao-pe">
            <span className="vg-cartao-nota">
              {variacao !== null ? <Delta v={variacao} /> : null}
              {notaForcada ?? c?.comparacao?.rotulo ?? ""}
            </span>
            {faisca ? <Faisca dados={faisca} /> : null}
          </div>
          {/* A ressalva da métrica é longa e é documentação: fica no tooltip, com
              um sinal visível de que existe. Despejá-la no cartão empurra o
              número para cima e faz o cartão parar de ser escaneável. */}
          {/* Linha visível só quando a cobertura é parcial — isso muda a
              confiança no número. A ressalva de definição fica no `title` do
              cartão inteiro: repetir "tem ressalva" em todo cartão vira ruído. */}
          {c?.estado === "parcial" ? (
            <span className="vg-estado" data-estado="parcial" title={ressalva ?? undefined}>
              <Info size={12} aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              Cobertura parcial
            </span>
          ) : null}
        </>
      )}
    </>
  );

  return url && valor !== null
    ? <Link className="vg-cartao" href={url} title={ressalva ?? undefined} aria-label={`${nome}: abrir os registros`}>{corpo}</Link>
    : <div className="vg-cartao" title={ressalva ?? undefined}>{corpo}</div>;
}

function EtapaFunil({ c, rotulo, base }: { c: Cartao | null; rotulo: string; base?: number | null }) {
  const v = valorDe(c);
  const url = href(c?.drill ?? null);
  const taxa = base && base > 0 && v !== null ? v / base : null;
  const corpo = (
    <>
      <span>{rotulo}</span>
      <b>{v === null ? "—" : c?.unidade === "BRL" ? dinheiro(v, "BRL") : v.toLocaleString("pt-BR")}</b>
      <small>{v === null ? (c?.motivo?.mensagem ?? "indisponível") : taxa !== null ? `${(taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do anterior` : (c?.registros ?? 0).toLocaleString("pt-BR") + " registros"}</small>
    </>
  );
  return url && v !== null ? <Link href={url}>{corpo}</Link> : <div>{corpo}</div>;
}

function Alertas({ alertas }: { alertas: Alerta[] }) {
  const ativos = alertas.filter((a) => a.situacao === "disparado");
  if (ativos.length === 0) {
    return (
      <p className="vg-leitura">
        <TrendingUp size={15} aria-hidden />
        <span><b>Nada exige decisão agora</b>Nenhum dos limiares monitorados foi cruzado neste recorte.</span>
      </p>
    );
  }
  return (
    <div className="vg-alertas">
      {ativos.map((a) => {
        const url = href(a.drill);
        const corpo = (
          <>
            <CircleAlert size={16} aria-hidden style={{ flex: "0 0 auto", marginTop: 2, color: a.severidade === "critica" ? "var(--of-coral-texto)" : "var(--of-aviso-tinta)" }} />
            <span className="vg-alerta-corpo">
              <b>{a.titulo}</b>
              <span>{a.frase ?? a.limiar.descricao}</span>
            </span>
            {url ? <ArrowRight size={15} aria-hidden className="vg-alerta-meta" /> : null}
          </>
        );
        return url
          ? <Link key={a.id} className="vg-alerta" href={url}>{corpo}</Link>
          : <div key={a.id} className="vg-alerta">{corpo}</div>;
      })}
    </div>
  );
}

type PontoTip = { rotulo: string; valor: number; registros: number; anterior: number | null; rotuloAnterior: string | null };
function Tip({ active, payload, titulo, comparar }: {
  active?: boolean; payload?: Array<{ payload: PontoTip }>; titulo: string; comparar?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rx-tip" role="status">
      <strong>Competência {p.rotulo}</strong>
      <div><span>{titulo}</span><b>{dinheiro(p.valor, "BRL")}</b></div>
      {comparar && p.anterior !== null ? <div><span>{p.rotuloAnterior}</span><b>{dinheiro(p.anterior, "BRL")}</b></div> : null}
      {comparar && p.anterior !== null && p.anterior > 0 ? <div><span>Variação</span><b>{pct(p.valor / p.anterior - 1)}</b></div> : null}
      <small>{p.registros.toLocaleString("pt-BR")} linhas · clique para abrir</small>
    </div>
  );
}
