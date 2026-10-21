"use client";

import * as React from "react";
import Link from "next/link";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { ExecutiveRevenueStory } from "./ExecutiveRevenueStory";
import { ExecutiveMonthDrawer } from "./ExecutiveMonthDrawer";
import { useMetrica, type ErroMetrica } from "@/components/onface/relatorios/useMetrica";
import { VALOR_FAMILIA, dinheiro, dinheiroCurto, fimDoPonto, rotuloPonto } from "@/components/onface/relatorios/explorador-formato";
import { FAMILIAS } from "@/lib/metricas/recorte";
import "@/components/onface/relatorios/relatorios.css";

/**
 * Painel executivo: consolidado Callface com filtro de família. Cada número vem
 * da mesma rota (e do mesmo recorte) que abre ao clicar nele: o card e a lista
 * que o explica nunca divergem. O que a fonte não sustenta aparece como lacuna,
 * não como zero.
 */

const CONFIG: ChartConfig = {
  valor: { label: "Faturado", color: "var(--cf2-serie-1)" },
  anterior: { label: "Mesmo mês do ano anterior", color: "var(--cf2-serie-3)" },
};
const JANELAS = [
  { chave: "12m", rotulo: "12 meses" },
  { chave: "ano_atual", rotulo: "Ano atual" },
  { chave: "tudo", rotulo: "Todo o histórico" },
] as const;
type Janela = (typeof JANELAS)[number]["chave"];

const BIB = "/relatorios/biblioteca/metrica-";
const pct = (v: number | null | undefined, casas = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`);

function link(codigo: string, p: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return `${BIB}${codigo}${qs ? `?${qs}` : ""}`;
}

export function TabExecutivo({ familiaInicial, janelaInicial, aoMudar }: {
  familiaInicial: string; janelaInicial: string; aoMudar: (m: { familia?: string; janela?: string }) => void;
}) {
  const reduzido = useReducedMotion();
  const familia = (FAMILIAS as readonly string[]).includes(familiaInicial) ? familiaInicial : "";
  const janela: Janela = JANELAS.some((j) => j.chave === janelaInicial) ? (janelaInicial as Janela) : "12m";
  const f = familia || undefined;

  const hist = useMetrica("faturamento_competencia", { periodo: "tudo", familia: f, tamanho: "5" });
  const recorte = useMetrica("faturamento_competencia", { periodo: janela, familia: f, tamanho: "5" });
  const clientes = useMetrica("clientes_faturados", { periodo: janela, familia: f, ordem: "valor", sentido: "desc", tamanho: "10" });
  const mrr = useMetrica("mrr_atual", { familia: f, tamanho: "5" });
  const ativos = useMetrica("clientes_ativos", { familia: f, tamanho: "5" });
  const booking = useMetrica("booking_ganho", { periodo: "mes_atual", familia: f, tamanho: "5" });
  const recebido = useMetrica("recebido", { periodo: "mes_atual", tamanho: "5" });
  const foraPlanilha = useMetrica("faturas_stripe_fora_da_planilha", { periodo: "12m", tamanho: "5" });

  // ── Derivados da série mensal completa (mesma resposta do gráfico) ──
  const pontos = hist.data?.exploracao.serie?.pontos ?? [];
  const ultimo = pontos[pontos.length - 1];
  const mesmoMesAnterior = ultimo ? pontos.find((p) => p.inicio === `${Number(ultimo.inicio.slice(0, 4)) - 1}${ultimo.inicio.slice(4)}`) : undefined;
  const ult12 = pontos.slice(-12), ant12 = pontos.slice(-24, -12);
  const soma = (a: typeof pontos) => a.reduce((x, p) => x + p.valor, 0);
  const yoy = ultimo && mesmoMesAnterior && mesmoMesAnterior.valor > 0 ? ultimo.valor / mesmoMesAnterior.valor - 1 : null;
  const yoy12 = ant12.length === 12 && soma(ant12) > 0 ? soma(ult12) / soma(ant12) - 1 : null;

  const visiveis = janela === "tudo" ? pontos : janela === "ano_atual" ? pontos.filter((p) => ultimo && p.inicio.slice(0, 4) === ultimo.inicio.slice(0, 4)) : pontos.slice(-12);
  const dados = visiveis.map((p) => {
    const a = pontos.find((x) => x.inicio === `${Number(p.inicio.slice(0, 4)) - 1}${p.inicio.slice(4)}`);
    return { ...p, rotulo: rotuloPonto(p.inicio, "mes"), anterior: a?.valor ?? null, rotuloAnterior: a ? rotuloPonto(a.inicio, "mes") : null };
  });
  const temAnterior = dados.some((d) => d.anterior !== null);
  const [oculta, setOculta] = React.useState(false);
  const [mesFocado, setMesFocado] = React.useState<string | null>(null);
  const [mesAberto, setMesAberto] = React.useState<string | null>(null);
  const focoValido = visiveis.some((p) => p.inicio === mesFocado) ? mesFocado : null;
  const abrirMes = (inicio: string) => { setMesFocado(inicio); setMesAberto(inicio); };

  const familiaDim = recorte.data?.exploracao.dimensoes.find((d) => d.chave === "familia");
  const semFamilia = familiaDim?.itens.find((i) => i.chave === "UNKNOWN");
  const totalRecorte = recorte.data?.exploracao.total ?? 0;
  const top = clientes.data?.exploracao.linhas ?? [];
  const somaTodos = clientes.data?.exploracao.somaValor ?? 0;
  const somaTop = (n: number) => top.slice(0, n).reduce((a, l) => a + Number(l.valor), 0);

  return (
    <div className="ex">
      <div className="rx-barra">
        <div className="rx-seg" role="group" aria-label="Família de serviço">
          <button type="button" aria-pressed={!familia} onClick={() => aoMudar({ familia: "" })}>Consolidado</button>
          {FAMILIAS.map((x) => <button key={x} type="button" aria-pressed={familia === x} onClick={() => aoMudar({ familia: x })}>{VALOR_FAMILIA[x]}</button>)}
        </div>
        <div className="rx-seg" role="group" aria-label="Janela dos gráficos de faturamento">
          {JANELAS.map((j) => <button key={j.chave} type="button" aria-pressed={janela === j.chave} onClick={() => aoMudar({ janela: j.chave })}>{j.rotulo}</button>)}
        </div>
      </div>

      {/* ── Números do negócio ───────────────────────────────── */}
      <section className="ex-kpis" aria-label="Indicadores executivos">
        <Tile titulo="MRR atual" rotulo="retrato de agora · recorrente faturado" r={mrr} href={link("mrr_atual", { familia: f })}
          sub={mrr.data ? `${mrr.data.exploracao.registrosTotal.toLocaleString("pt-BR")} linhas explicam este número` : ""} destaque />
        <TileSerie titulo={ultimo ? `Faturado em ${rotuloPonto(ultimo.inicio, "mes")}` : "Faturado"} carregando={hist.isPending} erro={hist.error}
          valor={ultimo?.valor} unidade="BRL" delta={yoy} deltaRotulo="vs mesmo mês do ano anterior"
          sub={ult12.length === 12 ? `12 meses: ${dinheiroCurto(soma(ult12), "BRL")}${yoy12 !== null ? ` (${pct(yoy12)} vs 12 anteriores)` : ""}` : "competência fechada mais recente"}
          href={ultimo ? link("faturamento_competencia", { periodo: "tudo", familia: f, de: ultimo.inicio, ate: fimDoPonto(ultimo.inicio, "mes") }) : undefined} />
        <Tile titulo="Booking do mês" rotulo="venda ganha, mês atual até hoje" r={booking} href={link("booking_ganho", { periodo: "mes_atual", familia: f })} comparar />
        <Tile titulo="Recebido no mês" rotulo="só pagamentos Stripe (boleto e NF sem baixa no ONFACE)" r={recebido} href={link("recebido", { periodo: "mes_atual" })} comparar
          naoAplicaFamilia={!!familia} />
        <Tile titulo="Clientes ativos" rotulo="com serviço ativo agora" r={ativos} href={link("clientes_ativos", { familia: f })} />
      </section>
      <p className="rx-dica">Faturado, recebido, booking e MRR são números diferentes: faturado é o que foi cobrado na competência, recebido é caixa, booking é venda decidida e MRR é recorrência faturada. Nenhum substitui o outro.</p>

      {/* ── Evolução ─────────────────────────────────────────── */}
      <section className="rx-painel" aria-label="Faturamento por competência">
        <div className="rx-painel-cab">
          <h2>Faturamento por competência{familia ? ` · ${VALOR_FAMILIA[familia as keyof typeof VALOR_FAMILIA]}` : ""}</h2>
          <Link className="rx-kpi-ver" href={link("faturamento_competencia", { periodo: janela, familia: f })}>Ver os registros</Link>
        </div>
        {hist.isPending ? <div className="rx-esq" style={{ height: 240 }} /> : hist.error ? <Aviso erro={hist.error} /> : dados.length === 0 ? (
          <div className="rel-vazio" style={{ padding: "32px 12px", boxShadow: "none" }}><strong>Sem faturamento para esta família</strong><span>Nenhuma competência tem valor neste filtro.</span></div>
        ) : (
          <>
            <ExecutiveRevenueStory pontos={visiveis} mes={focoValido} aoExplorar={abrirMes} />
            <div className="rx-barra" style={{ justifyContent: "space-between" }}>
              <label className="rx-dica" htmlFor="ex-mes-detalhe">Explorar uma competência pelo teclado ou toque</label>
              <div className="rx-barra" style={{ marginLeft: "auto" }}>
                {focoValido && <button type="button" className="rx-btn" onClick={() => setMesFocado(null)}>Limpar seleção</button>}
                <select id="ex-mes-detalhe" className="rx-select" aria-label="Selecione uma competência para detalhar"
                  value={focoValido ?? ""} onChange={(e) => { if (e.target.value) abrirMes(e.target.value); }}>
                  <option value="">Selecionar mês</option>
                  {dados.map((p) => <option key={p.inicio} value={p.inicio}>{p.rotulo}</option>)}
                </select>
              </div>
            </div>
            {temAnterior ? (
              <div className="rx-legenda" role="group" aria-label="Séries">
                <button type="button" aria-pressed={true} disabled style={{ cursor: "default" }}><i style={{ background: "var(--cf2-serie-1)" }} />Faturado no mês</button>
                <button type="button" aria-pressed={!oculta} onClick={() => setOculta((v) => !v)}><i style={{ background: "var(--cf2-serie-3)" }} />Mesmo mês do ano anterior</button>
              </div>
            ) : null}
            <ChartContainer config={CONFIG} className="rx-grafico" >
              <ComposedChart data={dados} accessibilityLayer margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={18} />
                <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={(v: number) => dinheiroCurto(v, "BRL")} />
                <Tooltip cursor={{ fill: "var(--of-calha)", opacity: 0.6 }} content={<Tip />} />
                <Bar dataKey="valor" fill="var(--cf2-serie-1)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!reduzido} animationDuration={380} cursor="pointer"
                  onClick={(d) => { const i = (d as unknown as { inicio?: string }).inicio; if (i) abrirMes(i); }}>
                  {dados.map((p) => <Cell key={p.inicio} fill={focoValido === p.inicio ? "var(--of-coral-marca)" : "var(--cf2-serie-1)"} />)}
                </Bar>
                {temAnterior && !oculta ? <Line dataKey="anterior" type="monotone" stroke="var(--cf2-serie-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={!reduzido} /> : null}
              </ComposedChart>
            </ChartContainer>
            <p className="rx-dica">Clique numa barra para investigar a competência sem sair do painel. Use o drawer para pesquisar, paginar ou exportar. Mês não fechado não aparece (não é zero).</p>
          </>
        )}
      </section>

      {mesAberto ? <ExecutiveMonthDrawer key={mesAberto + (f ?? "todos")} mes={mesAberto} familia={f} aoFechar={() => setMesAberto(null)} /> : null}

      <div className="ex-duas">
        {/* ── Composição por família ───────────────────────── */}
        <section className="rx-painel" aria-label="Faturamento por família">
          <div className="rx-painel-cab"><h2>Por família</h2><span className="rx-dica">{janela === "tudo" ? "todo o histórico" : janela === "12m" ? "últimos 12 meses" : "ano atual"}</span></div>
          {recorte.isPending ? <div className="rx-esq" style={{ height: 150 }} /> : recorte.error ? <Aviso erro={recorte.error} /> : (
            <div className="rx-comp">
              {[...(familiaDim?.itens ?? []), ...(familiaDim?.outros ? [familiaDim.outros] : [])].map((i) => {
                const max = Math.max(...(familiaDim?.itens ?? []).map((x) => x.valor), 1);
                const vira = i.chave !== "__outros";
                const corpo = (
                  <>
                    <span className="rx-barra-nome">{vira ? VALOR_FAMILIA[i.chave as keyof typeof VALOR_FAMILIA] ?? i.chave : i.rotulo}</span>
                    <span className="rx-barra-valor">{dinheiro(i.valor, "BRL")}</span>
                    <span className="rx-barra-meta">{totalRecorte ? ((i.valor / totalRecorte) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}% · {i.registros.toLocaleString("pt-BR")} linhas</span>
                  </>
                );
                const estilo = { "--p": `${Math.max(2, (Math.abs(i.valor) / max) * 100)}%` } as React.CSSProperties;
                return vira
                  ? <Link key={i.chave} className="rx-barra-item" style={estilo} href={link("faturamento_competencia", { periodo: janela, dim: "familia", valorDim: i.chave })}>{corpo}</Link>
                  : <div key={i.chave} className="rx-barra-item" data-estatico="true" style={estilo}>{corpo}</div>;
              })}
              {semFamilia && totalRecorte > 0 ? (
                <p className="rx-aviso"><strong>{((semFamilia.valor / totalRecorte) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% sem família.</strong> A família vem da Business Line da planilha (CALL FACE - LEASE conta como PABX). Setup e linhas mistas ficam sem família até serem classificados.</p>
              ) : null}
            </div>
          )}
        </section>

        {/* ── Concentração ─────────────────────────────────── */}
        <section className="rx-painel" aria-label="Concentração de clientes">
          <div className="rx-painel-cab"><h2>Concentração</h2>
            <Link className="rx-kpi-ver" href={link("clientes_faturados", { periodo: janela, familia: f })}>Ver todos os clientes</Link></div>
          {clientes.isPending ? <div className="rx-esq" style={{ height: 150 }} /> : clientes.error ? <Aviso erro={clientes.error} /> : top.length === 0 ? (
            <p className="rx-dica">Nenhum cliente faturado neste filtro.</p>
          ) : (
            <>
              <p className="ex-conc">
                <b>{pct(somaTodos ? somaTop(5) / somaTodos : 0).replace("+", "")}</b> do faturado vem dos 5 maiores e <b>{pct(somaTodos ? somaTop(10) / somaTodos : 0).replace("+", "")}</b> dos 10 maiores,
                entre {(clientes.data?.exploracao.registrosTotal ?? 0).toLocaleString("pt-BR")} clientes faturados.
              </p>
              <ol className="ex-top">
                {top.map((l, i) => (
                  <li key={String(l.documento ?? i)} style={{ "--p": `${somaTodos ? (Number(l.valor) / Number(top[0].valor)) * 100 : 0}%` } as React.CSSProperties}>
                    <span className="ex-top-nome">{l.empresa_id ? <Link href={`/empresas/${l.empresa_id}`}>{String(l.empresa)}</Link> : String(l.empresa)}</span>
                    <span className="ex-top-valor">{dinheiro(Number(l.valor), "BRL")}</span>
                    <span className="ex-top-meta">{somaTodos ? ((Number(l.valor) / somaTodos) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}% · {String(l.competencias)} {Number(l.competencias) === 1 ? "competência" : "competências"}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>

      {foraPlanilha.data && foraPlanilha.data.exploracao.total > 0 ? (
        <p className="rx-aviso">
          <strong>Conciliação pendente:</strong> {dinheiro(foraPlanilha.data.exploracao.total, "BRL")} em {foraPlanilha.data.exploracao.registrosTotal.toLocaleString("pt-BR")} cobranças
          Stripe dos últimos 12 meses não têm linha na planilha de faturamento do mesmo mês. Não estão somados ao faturado acima.{" "}
          <Link className="rx-kpi-ver" href={link("faturas_stripe_fora_da_planilha", { periodo: "12m" })}>Ver quais são</Link>
        </p>
      ) : null}

      <section className="rx-painel" aria-label="O que este painel ainda não responde">
        <h2>O que este painel não responde (e por quê)</h2>
        <ul className="ex-lacunas">
          <li><b>Lucro, margem, CAC completo, payback, burn e runway:</b> só existem custos de mídia organizados; sem custo de equipe, telefonia, IA e fornecedores o cálculo seria inventado.</li>
          <li><b>Bridge de MRR e retenção (NRR/GRR):</b> exigem movimentos de receita reconciliados com o fechamento mensal; entram quando a conciliação por cliente fechar.</li>
          <li><b>Faturamento por família antes da classificação:</b> a planilha base não tem produto, só Business Line; ver o percentual &quot;sem família&quot; acima.</li>
          <li><b>Recebido:</b> só existe a baixa dos pagamentos Stripe; boleto e nota fiscal do PABX não têm baixa no ONFACE. Por isso recebido não deve ser lido contra o faturado total, nem por família.</li>
        </ul>
      </section>
    </div>
  );
}

function Aviso({ erro }: { erro: ErroMetrica }) {
  return <p className="rx-aviso" data-tom="erro" role="alert">{erro.codigo === "filtro_nao_suportado" ? erro.message : "Não foi possível carregar este bloco. Recarregue a página."}</p>;
}

type R = ReturnType<typeof useMetrica>;

function Tile({ titulo, rotulo, r, href, sub, destaque, comparar, naoAplicaFamilia }: {
  titulo: string; rotulo: string; r: R; href: string; sub?: string; destaque?: boolean; comparar?: boolean; naoAplicaFamilia?: boolean;
}) {
  const d = r.data;
  const unidade = d?.metrica.unidade ?? "BRL";
  if (naoAplicaFamilia) {
    return (
      <div className="ex-kpi" data-vazio="true">
        <span className="ex-kpi-titulo">{titulo}</span>
        <span className="ex-kpi-valor">—</span>
        <span className="ex-kpi-sub">Pagamentos não carregam a família do serviço: este número só existe no consolidado.</span>
      </div>
    );
  }
  const variacao = comparar ? d?.comparacao?.variacao ?? null : null;
  return (
    <Link className="ex-kpi" href={href} data-destaque={destaque || undefined} aria-label={`${titulo}: abrir os registros`}>
      <span className="ex-kpi-titulo">{titulo}</span>
      {r.isPending ? <span className="rx-esq" style={{ height: 30, width: 130 }} /> : r.error ? <span className="ex-kpi-valor">—</span> : (
        <span className="ex-kpi-valor">{dinheiro(d?.exploracao.total, unidade)}</span>
      )}
      {r.error ? <span className="ex-kpi-sub">{r.error.codigo === "filtro_nao_suportado" ? "não se aplica a este filtro" : "indisponível agora"}</span> : (
        <span className="ex-kpi-sub">
          {comparar && variacao !== null ? <Delta v={variacao} /> : null}
          {sub ?? rotulo}
          {comparar && d?.exploracao.ultimoEm ? ` · último registro em ${new Date(d.exploracao.ultimoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}
          {comparar && d && !d.exploracao.ultimoEm ? " · nenhum registro no período" : ""}
          {comparar && d?.comparacao && variacao === null ? " · sem base de comparação" : ""}
        </span>
      )}
    </Link>
  );
}

function TileSerie({ titulo, carregando, erro, valor, unidade, delta, deltaRotulo, sub, href }: {
  titulo: string; carregando: boolean; erro: ErroMetrica | null; valor?: number; unidade: string; delta: number | null; deltaRotulo: string; sub: string; href?: string;
}) {
  const corpo = (
    <>
      <span className="ex-kpi-titulo">{titulo}</span>
      {carregando ? <span className="rx-esq" style={{ height: 30, width: 130 }} /> : <span className="ex-kpi-valor">{erro || valor === undefined ? "—" : dinheiro(valor, unidade)}</span>}
      <span className="ex-kpi-sub">{delta !== null ? <><Delta v={delta} />{deltaRotulo} · </> : null}{erro ? "indisponível agora" : sub}</span>
    </>
  );
  return href ? <Link className="ex-kpi" href={href}>{corpo}</Link> : <div className="ex-kpi">{corpo}</div>;
}

function Delta({ v }: { v: number }) {
  const tom = v > 0.0005 ? "alta" : v < -0.0005 ? "queda" : "neutro";
  const Seta = tom === "alta" ? ArrowUpRight : tom === "queda" ? ArrowDownRight : Minus;
  return <span className="rx-delta" data-tom={tom} style={{ marginRight: 6 }}><Seta size={13} aria-hidden />{pct(v)}</span>;
}

type PontoTip = { rotulo: string; valor: number; registros: number; anterior: number | null; rotuloAnterior: string | null };
function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PontoTip }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rx-tip" role="status">
      <strong>Competência {p.rotulo}</strong>
      <div><span>Faturado</span><b>{dinheiro(p.valor, "BRL")}</b></div>
      {p.anterior !== null ? <div><span>{p.rotuloAnterior}</span><b>{dinheiro(p.anterior, "BRL")}</b></div> : null}
      {p.anterior !== null && p.anterior > 0 ? <div><span>Variação</span><b>{pct(p.valor / p.anterior - 1)}</b></div> : null}
      <small>{p.registros.toLocaleString("pt-BR")} linhas · clique para abrir</small>
    </div>
  );
}
