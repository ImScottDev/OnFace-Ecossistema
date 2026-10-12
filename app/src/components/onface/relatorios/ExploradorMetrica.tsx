"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Minus, X } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RespostaMetrica } from "@/lib/metricas/consulta";
import { PERIODOS } from "@/lib/metricas/janela";
import { FAMILIAS } from "@/lib/metricas/recorte";
import {
  COLUNAS_OCULTAS, ROTULOS, VALOR_FAMILIA, destinoDaLinha, dinheiro, dinheiroCurto, fimDoPonto, formatarCelula,
  rotuloPonto, rotuloValor,
} from "./explorador-formato";
import "./relatorios.css";

/**
 * Explorador de uma métrica oficial. Tudo o que aparece (número, série,
 * composição, tabela, exportação) vem de UMA resposta do servidor sobre o mesmo
 * recorte; o estado inteiro mora na URL, então recarregar, copiar o link e o
 * botão Voltar do navegador reproduzem exatamente o que se estava vendo.
 */

const CONFIG: ChartConfig = {
  valor: { label: "Período atual", color: "var(--cf2-serie-1)" },
  anterior: { label: "Período anterior", color: "var(--cf2-serie-3)" },
};

const PERIODOS_EVENTO = PERIODOS.filter((p) => ["mes_atual", "mes_passado", "30d", "90d", "12m", "ano_atual", "tudo"].includes(p.chave));

type Resposta = RespostaMetrica;

export function ExploradorMetrica({ codigo }: { codigo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const busca = useSearchParams();
  const qs = busca.toString();
  const reduzido = useReducedMotion();

  const [registro, setRegistro] = React.useState<Record<string, unknown> | null>(null);
  const [termo, setTermo] = React.useState(busca.get("q") ?? "");
  const [ocultas, setOcultas] = React.useState<Set<string>>(new Set());

  /** Muda parâmetros da URL. Filtro novo volta para a página 1; `push` para o Voltar do navegador desfazer o filtro. */
  const mudar = React.useCallback((mudancas: Record<string, string | null>, { manterPagina = false } = {}) => {
    const p = new URLSearchParams(qs);
    for (const [k, v] of Object.entries(mudancas)) { if (v === null || v === "") p.delete(k); else p.set(k, v); }
    if (!manterPagina) p.delete("pagina");
    router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }, [qs, pathname, router]);

  // Busca com atraso curto: digitar não dispara uma consulta por tecla.
  React.useEffect(() => {
    if ((busca.get("q") ?? "") === termo.trim()) return;
    const t = setTimeout(() => mudar({ q: termo.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [termo]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, isPending, isFetching, refetch } = useQuery<Resposta, Error & { codigo?: string }>({
    queryKey: ["metrica", codigo, qs],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/metricas/${codigo}?${qs}`);
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(corpo.error ?? "Não foi possível carregar esta métrica."), { codigo: corpo.codigo });
      return corpo as Resposta;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const familia = busca.get("familia") ?? "";
  const testes = busca.get("testes") === "1";
  const dim = busca.get("dim");
  const valorDim = busca.get("valorDim");
  const de = busca.get("de");
  const ate = busca.get("ate");
  const ordem = busca.get("ordem");
  const sentido = busca.get("sentido") === "asc" ? "asc" : "desc";

  if (isPending) return <EsqueletoExplorador />;
  if (error && !data) {
    return (
      <div className="rel-vazio" role="alert">
        <strong>{error.codigo === "filtro_nao_suportado" ? "Filtro que esta métrica não tem" : "Não foi possível carregar"}</strong>
        <span>{error.message}</span>
        <span style={{ display: "flex", gap: 8 }}>
          {familia ? <button className="rx-btn" onClick={() => mudar({ familia: null })}>Tirar o filtro de família</button> : null}
          <button className="rx-btn" onClick={() => refetch()}>Tentar de novo</button>
        </span>
      </div>
    );
  }
  if (!data) return null;

  const { metrica: m, exploracao: e, janela, comparacao, serieAnterior, periodo } = data;
  const snapshot = m.tipo === "SNAPSHOT";
  const filtroAtivo = !!(dim || de || (busca.get("q") ?? ""));
  const exportarHref = `/api/relatorios/metricas/${codigo}/exportar?${(() => { const p = new URLSearchParams(qs); p.delete("pagina"); return p.toString(); })()}`;
  const colunas = e.linhas[0] ? Object.keys(e.linhas[0]).filter((c) => !COLUNAS_OCULTAS.has(c)) : [];
  const chips: Array<{ chave: string; texto: string; tirar: Record<string, string | null> }> = [];
  if (familia) chips.push({ chave: "familia", texto: `Família: ${VALOR_FAMILIA[familia] ?? familia}`, tirar: { familia: null } });
  if (dim && valorDim !== null) chips.push({ chave: "dim", texto: `${m.dimensoes.find((d) => d.chave === dim)?.rotulo ?? dim}: ${rotuloValor(dim, valorDim)}`, tirar: { dim: null, valorDim: null } });
  if (de && ate) chips.push({ chave: "de", texto: `Recorte: ${de.split("-").reverse().join("/")} a ${new Date(new Date(`${ate}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10).split("-").reverse().join("/")}`, tirar: { de: null, ate: null } });
  if (busca.get("q")) chips.push({ chave: "q", texto: `Busca: “${busca.get("q")}”`, tirar: { q: null } });

  const mostraSelecionado = filtroAtivo;
  const valorPrincipal = mostraSelecionado ? e.selecionado.valor : e.total;
  const tomDelta = !comparacao || comparacao.variacao === null ? "neutro" : comparacao.variacao > 0.0005 ? "alta" : comparacao.variacao < -0.0005 ? "queda" : "neutro";
  const Seta = tomDelta === "alta" ? ArrowUpRight : tomDelta === "queda" ? ArrowDownRight : Minus;

  const serie = e.serie;
  const pontos = serie?.pontos.map((p, i) => ({
    ...p, rotulo: rotuloPonto(p.inicio, serie.granularidade),
    anterior: serieAnterior?.pontos[i]?.valor ?? null,
    rotuloAnterior: serieAnterior?.pontos[i] ? rotuloPonto(serieAnterior.pontos[i].inicio, serieAnterior.granularidade) : null,
  })) ?? [];
  const intervaloSelecionado = de && ate ? pontos.find((p) => p.inicio === de && fimDoPonto(p.inicio, serie!.granularidade) === ate) : undefined;

  return (
    <div className="rx" aria-busy={isFetching}>
      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="rx-barra">
        {snapshot ? null : (
          <div className="rx-seg" role="group" aria-label="Período">
            {PERIODOS_EVENTO.map((p) => (
              <button key={p.chave} type="button" aria-pressed={periodo === p.chave} onClick={() => mudar({ periodo: p.chave, de: null, ate: null })}>{p.rotulo}</button>
            ))}
          </div>
        )}
        <select
          className="rx-select" aria-label="Família de serviço" value={familia} disabled={!m.filtros.familia}
          title={m.filtros.familia ? undefined : `${m.nome} não tem família: este filtro não se aplica a ela.`}
          onChange={(ev) => mudar({ familia: ev.target.value || null })}
        >
          <option value="">Todas as famílias</option>
          {FAMILIAS.map((f) => <option key={f} value={f}>{VALOR_FAMILIA[f]}</option>)}
        </select>
        <label className="rx-check" title="Registros marcados como teste (nome iniciado por [QA] ou [DOCUMENSO-E2E], origem qa/teste_local) ficam fora dos totais. Nada é apagado.">
          <input type="checkbox" checked={testes} onChange={(ev) => mudar({ testes: ev.target.checked ? "1" : null })} />
          Incluir registros de teste
        </label>
      </div>

      {chips.length > 0 ? (
        <div className="rx-chips" aria-label="Filtros ativos">
          {chips.map((c) => (
            <span className="rx-chip" key={c.chave}>{c.texto}
              <button type="button" aria-label={`Remover filtro: ${c.texto}`} onClick={() => mudar(c.tirar)}><X size={12} aria-hidden /></button>
            </span>
          ))}
          {chips.length > 1 ? <button className="rx-btn" style={{ height: 26 }} onClick={() => mudar({ familia: null, dim: null, valorDim: null, de: null, ate: null, q: null }, {})}>Limpar tudo</button> : null}
        </div>
      ) : null}

      <div className="rx-grade" data-modo={!serie ? "retrato" : m.dimensoes.length > 2 ? "largo" : "lado"}>
        {/* ── Número + série ─────────────────────────────────────── */}
        <section className="rx-painel" aria-label="Resultado">
          <div className="rx-kpi">
            <span className="rx-kpi-rotulo">
              {m.nome}
              {snapshot ? " · retrato de agora" : janela ? ` · ${janela.rotulo}${janela.parcial && (periodo === "mes_atual" || periodo === "ano_atual") ? " (em andamento)" : ""}` : ""}
              {mostraSelecionado ? " · recorte selecionado" : ""}
            </span>
            <div className="rx-kpi-linha">
              <span className="rx-kpi-valor" data-carregando={isFetching} aria-live="polite">{dinheiro(valorPrincipal, m.unidade)}</span>
              {comparacao && !mostraSelecionado ? (
                <span className="rx-delta" data-tom={tomDelta} title={`Período anterior (${comparacao.rotulo}): ${dinheiro(comparacao.valor, m.unidade)}`}>
                  <Seta size={14} aria-hidden />
                  {comparacao.variacao === null ? "sem base de comparação" : `${comparacao.variacao >= 0 ? "+" : ""}${(comparacao.variacao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                  <span style={{ fontWeight: 500, color: "var(--of-tinta-3)" }}>&nbsp;vs {comparacao.rotulo}</span>
                </span>
              ) : null}
            </div>
            {mostraSelecionado ? (
              <span className="rx-dica">Do total de {dinheiro(e.total, m.unidade)}: {e.total ? ((e.selecionado.valor / e.total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}% em {e.selecionado.registros.toLocaleString("pt-BR")} de {e.registrosTotal.toLocaleString("pt-BR")} registros.</span>
            ) : (
              <span className="rx-dica">
                {serie && pontos.length > 0 ? <>Dados de {rotuloPonto(pontos[0].inicio, serie.granularidade)} a {rotuloPonto(pontos[pontos.length - 1].inicio, serie.granularidade)}{janela?.parcial ? " (o período corrente ainda não fechou)" : ""}. </> : null}
                {e.registrosTotal.toLocaleString("pt-BR")} {e.registrosTotal === 1 ? "registro compõe" : "registros compõem"} este número. {" "}
                <button type="button" className="rx-kpi-ver" onClick={() => document.getElementById("rx-registros")?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" })}>Ver a lista</button>
              </span>
            )}
          </div>

          {data.pisoAplicado ? (
            <p className="rx-aviso"><strong>Janela encurtada.</strong> Esta fonte só é confiável a partir de {new Date(data.pisoAplicado).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}; antes disso o dado migrado não tem data de venda válida.</p>
          ) : null}
          {error ? <p className="rx-aviso" data-tom="erro" role="alert">{error.message} Mostrando o último resultado carregado.</p> : null}

          {serie ? (
            e.registrosTotal === 0 && pontos.length === 0 ? (
              <div className="rel-vazio" style={{ padding: "32px 12px" }}><strong>Nenhum registro neste período</strong><span>Amplie o período ou tire um filtro.</span></div>
            ) : (
              <>
                <div className="rx-painel-cab">
                  <h2>Evolução {serie.granularidade === "dia" ? "por dia" : "por mês"}</h2>
                  <span className="rx-dica">Clique numa barra para filtrar a página por ela.</span>
                </div>
                <div className="rx-legenda" role="group" aria-label="Séries do gráfico">
                  <button type="button" aria-pressed={!ocultas.has("valor")} onClick={() => alternar(setOcultas, "valor")}><i style={{ background: "var(--cf2-serie-1)" }} />Período atual</button>
                  {serieAnterior ? <button type="button" aria-pressed={!ocultas.has("anterior")} onClick={() => alternar(setOcultas, "anterior")}><i style={{ background: "var(--cf2-serie-3)" }} />Período anterior</button> : null}
                </div>
                <ChartContainer config={CONFIG} className="rx-grafico">
                  <ComposedChart data={pontos} accessibilityLayer margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={18} />
                    <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={(v: number) => dinheiroCurto(v, m.unidade)} />
                    <Tooltip cursor={{ fill: "var(--of-calha)", opacity: 0.6 }} content={<TipSerie unidade={m.unidade} granularidade={serie.granularidade} />} />
                    {ocultas.has("valor") ? null : (
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={!reduzido} animationDuration={380} maxBarSize={44} cursor="pointer"
                        onClick={(d) => { const inicio = (d as unknown as { inicio?: string }).inicio ?? (d as unknown as { payload?: { inicio?: string } }).payload?.inicio; if (inicio) selecionarPonto(inicio, serie.granularidade, intervaloSelecionado?.inicio === inicio, mudar); }}>
                        {pontos.map((p) => <Cell key={p.inicio} fill="var(--cf2-serie-1)" fillOpacity={de && !intervaloSelecionado ? 0.9 : intervaloSelecionado && intervaloSelecionado.inicio !== p.inicio ? 0.3 : 1} />)}
                      </Bar>
                    )}
                    {serieAnterior && !ocultas.has("anterior") ? (
                      <Line dataKey="anterior" type="monotone" stroke="var(--cf2-serie-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={!reduzido} />
                    ) : null}
                  </ComposedChart>
                </ChartContainer>
              </>
            )
          ) : (
            <p className="rx-dica">Esta métrica é um retrato do momento, sem série histórica própria: o histórico confiável entra com a base de snapshots e a conciliação do faturamento.</p>
          )}
        </section>

        {/* ── Composição ──────────────────────────────────────────── */}
        <section className="rx-painel" aria-label="Composição">
          {e.dimensoes.length === 0 ? (
            <p className="rx-dica">Esta métrica não tem dimensões de composição. A lista abaixo traz cada registro.</p>
          ) : e.dimensoes.map((d) => {
            const itens = [...d.itens, ...(d.outros ? [d.outros] : [])];
            const total = itens.reduce((a, i) => a + i.valor, 0);
            const maximo = Math.max(...itens.map((i) => Math.abs(i.valor)), 1);
            return (
              <div key={d.chave} className="rx-comp">
                <div className="rx-painel-cab"><h2>Por {d.rotulo.toLowerCase()}</h2><span className="rx-dica">{dim === d.chave ? "clique de novo para limpar" : "clique para filtrar"}</span></div>
                {d.chave === "familia" && itens.length === 1 && itens[0].chave === "UNKNOWN" ? (
                  <p className="rx-dica">Nenhum registro deste recorte tem família registrada, então esta composição não separa nada. Classificar a família na origem é o que a destrava (ver Qualidade dos dados).</p>
                ) : null}
                {itens.length === 0 ? <p className="rx-dica">Sem registros.</p> : itens.map((i) => {
                  const estatico = i.chave === "__outros";
                  const ativo = dim === d.chave && valorDim === i.chave;
                  return (
                    <button key={i.chave} type="button" className="rx-barra-item" aria-pressed={estatico ? undefined : ativo} data-estatico={estatico}
                      style={{ "--p": `${Math.max(2, (Math.abs(i.valor) / maximo) * 100)}%` } as React.CSSProperties}
                      disabled={estatico}
                      onClick={() => mudar(ativo ? { dim: null, valorDim: null } : { dim: d.chave, valorDim: i.chave })}>
                      <span className="rx-barra-nome">{estatico ? i.rotulo : rotuloValor(d.chave, i.rotulo)}</span>
                      <span className="rx-barra-valor">{dinheiro(i.valor, m.unidade)}</span>
                      <span className="rx-barra-meta">{total ? ((i.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}% · {i.registros.toLocaleString("pt-BR")} {i.registros === 1 ? "registro" : "registros"}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <details className="rx-dica">
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--of-tinta-2)" }}>Como este número é calculado</summary>
            <dl className="rel-def" style={{ marginTop: 10, gridTemplateColumns: "1fr" }}>
              <div><dt>O que é</dt><dd>{m.descricao}</dd></div>
              <div><dt>De onde sai</dt><dd>{m.fonte}</dd></div>
              {m.naoInclui ? <div><dt>Não inclui</dt><dd>{m.naoInclui}</dd></div> : null}
            </dl>
          </details>
        </section>
      </div>

      {/* ── Registros ───────────────────────────────────────────── */}
      <section className="rx-painel" id="rx-registros" aria-label="Registros que compõem o número" style={{ scrollMarginTop: 80 }}>
        <div className="rx-tabela-cab">
          <div>
            <h2>Registros</h2>
            <span className="rx-dica">
              {e.selecionado.registros.toLocaleString("pt-BR")} {e.selecionado.registros === 1 ? "registro soma" : "registros somam"} {m.agregacao === "soma" ? dinheiro(e.selecionado.valor, m.unidade) : e.selecionado.valor.toLocaleString("pt-BR")}
              {!mostraSelecionado ? ", igual ao número acima" : ""}.
            </span>
          </div>
          <div className="rx-barra-fim" style={{ marginLeft: 0 }}>
            <input className="rx-busca" type="search" placeholder="Buscar por empresa ou título" aria-label="Buscar nos registros" value={termo} onChange={(ev) => setTermo(ev.target.value)} />
            <a className="rx-btn" href={exportarHref} download aria-disabled={e.selecionado.registros === 0}>
              <Download size={14} aria-hidden /> Exportar {e.selecionado.registros.toLocaleString("pt-BR")} {e.selecionado.registros === 1 ? "registro" : "registros"}
            </a>
          </div>
        </div>

        {e.linhas.length === 0 ? (
          <div className="rel-vazio" style={{ boxShadow: "none", padding: "36px 12px" }}>
            <strong>Nenhum registro neste recorte</strong>
            <span>{filtroAtivo || familia ? "Os filtros ativos não deixaram nenhum registro. Remova um deles acima." : "Não há registros nesta métrica agora."}</span>
          </div>
        ) : (
          <div className="rel-tabela-wrap" style={{ boxShadow: "inset 0 0 0 1px var(--of-linha)" }}>
            <table className="rel-tabela rx-tabela">
              <thead>
                <tr>
                  {colunas.map((c) => {
                    const ordenavel = m.ordenaveis.includes(c);
                    const ativa = ordem === c || (!ordem && c === colunas.find((x) => m.ordenaveis.includes(x)) && false);
                    return (
                      <th key={c} scope="col" className={ehNumerica(c, e.linhas[0]?.[c]) ? "rx-num" : undefined} aria-sort={ativa ? (sentido === "asc" ? "ascending" : "descending") : undefined}>
                        {ordenavel ? (
                          <button type="button" className="rx-th" data-ativa={ativa} onClick={() => mudar({ ordem: c, sentido: ativa && sentido === "desc" ? "asc" : "desc" })}>
                            {ROTULOS[c] ?? c}{ativa ? (sentido === "asc" ? " ↑" : " ↓") : ""}
                          </button>
                        ) : (ROTULOS[c] ?? c)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {e.linhas.map((l, i) => (
                  <tr key={`${l.id}-${i}`} className="rx-linha-clicavel" tabIndex={0} onClick={() => setRegistro(l)}
                    onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setRegistro(l); } }}>
                    {colunas.map((c) => {
                      const destino = destinoDaLinha(codigo, c, l);
                      const txt = formatarCelula(c, l[c], m.unidade);
                      return (
                        <td key={c} className={ehNumerica(c, l[c]) ? (c === "valor" || c === "mrr" ? "rx-num rx-valor" : "rx-num") : undefined}>
                          {destino ? <Link href={destino} onClick={(ev) => ev.stopPropagation()}>{txt}</Link> : txt}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rx-rodape">
          <span>Página {e.pagina.toLocaleString("pt-BR")} de {e.paginas.toLocaleString("pt-BR")} · {e.tamanho} por página</span>
          <span className="rx-rodape-botoes">
            <button className="rx-btn" disabled={e.pagina <= 1} onClick={() => mudar({ pagina: String(e.pagina - 1) }, { manterPagina: true })}><ChevronLeft size={14} aria-hidden /> Anterior</button>
            <button className="rx-btn" disabled={e.pagina >= e.paginas} onClick={() => mudar({ pagina: String(e.pagina + 1) }, { manterPagina: true })}>Próxima <ChevronRight size={14} aria-hidden /></button>
          </span>
        </div>
      </section>

      <Sheet open={!!registro} onOpenChange={(o) => { if (!o) setRegistro(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-5">
          {registro ? (
            <div className="rx-registro" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SheetHeader className="p-0">
                <SheetTitle>{String(registro.titulo ?? registro.empresa ?? "Registro")}</SheetTitle>
                <SheetDescription>Um dos {e.registrosTotal.toLocaleString("pt-BR")} registros que compõem {m.nome}. Fechar volta à lista no mesmo ponto.</SheetDescription>
              </SheetHeader>
              <dl>
                {Object.entries(registro).filter(([k]) => !["negocio_id", "empresa_id"].includes(k)).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt>{k === "id" ? "ID" : (ROTULOS[k] ?? k)}</dt>
                    <dd className={k === "id" ? "rx-id" : undefined}>{k === "id" ? String(v) : formatarCelula(k, v, m.unidade)}</dd>
                  </React.Fragment>
                ))}
              </dl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {destinoDaLinha(codigo, "empresa", registro) ? <Link className="rx-btn" href={destinoDaLinha(codigo, "empresa", registro)!}>Abrir empresa</Link> : null}
                {destinoDaLinha(codigo, "titulo", registro) ? <Link className="rx-btn" href={destinoDaLinha(codigo, "titulo", registro)!}>Abrir oportunidade</Link> : null}
                {!destinoDaLinha(codigo, "empresa", registro) && !destinoDaLinha(codigo, "titulo", registro) ? <span className="rx-dica">Este registro não tem uma ficha para abrir (a fonte não aponta para uma empresa).</span> : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ehNumerica(coluna: string, amostra: unknown) {
  return coluna === "valor" || coluna === "mrr" || typeof amostra === "number";
}

function alternar(set: React.Dispatch<React.SetStateAction<Set<string>>>, chave: string) {
  set((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });
}

function selecionarPonto(inicio: string, gran: "dia" | "mes", jaSelecionado: boolean, mudar: (m: Record<string, string | null>) => void) {
  if (jaSelecionado) mudar({ de: null, ate: null });
  else mudar({ de: inicio, ate: fimDoPonto(inicio, gran) });
}

type PontoTip = { rotulo: string; valor: number; registros: number; anterior: number | null; rotuloAnterior: string | null };
function TipSerie({ active, payload, unidade, granularidade }: { active?: boolean; payload?: Array<{ payload: PontoTip }>; unidade: string; granularidade: "dia" | "mes" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rx-tip" role="status">
      <strong>{granularidade === "mes" ? `Mês ${p.rotulo}` : `Dia ${p.rotulo}`}</strong>
      <div><span>Período atual</span><b>{dinheiro(p.valor, unidade)}</b></div>
      {p.anterior !== null ? <div><span>Anterior ({p.rotuloAnterior})</span><b>{dinheiro(p.anterior, unidade)}</b></div> : null}
      <small>{p.registros.toLocaleString("pt-BR")} {p.registros === 1 ? "registro" : "registros"} · clique para filtrar</small>
    </div>
  );
}

function EsqueletoExplorador() {
  return (
    <div className="rx" aria-busy="true" aria-label="Carregando">
      <div className="rx-esq" style={{ height: 32, maxWidth: 520 }} />
      <div className="rx-grade">
        <div className="rx-painel"><div className="rx-esq" style={{ height: 40, width: 260 }} /><div className="rx-esq" style={{ height: 230 }} /></div>
        <div className="rx-painel"><div className="rx-esq" style={{ height: 150 }} /><div className="rx-esq" style={{ height: 90 }} /></div>
      </div>
      <div className="rx-painel"><div className="rx-esq" style={{ height: 240 }} /></div>
    </div>
  );
}
