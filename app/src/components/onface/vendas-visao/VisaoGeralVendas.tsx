import Link from "next/link";
import type { ReactNode } from "react";
import type { BoardPipeline, BoardPreVendas, CardPipeline } from "@/lib/vendas/consultas";
import type { EscopoVendas, VisaoGeralVendasMes } from "@/lib/vendas/visao-geral";
import { moeda } from "@/components/onface/vendas/formato";
import "./visao-geral-vendas.css";

/**
 * Visão geral comercial (/vendas), arquétipo A do handoff: hero grafite com o
 * KPI que manda (meta de faturamento do mês) + gráfico, tiles do funil e listas.
 *
 * Server Component puro: tudo aqui é leitura e link. Não existe botão que
 * "faz" algo nesta tela — a ação mora na tela de destino (pipeline, propostas),
 * que já tem as regras e as travas. Assim nenhum botão daqui mente.
 */

type Props = {
  mes: VisaoGeralVendasMes;
  meta: { valorAlvo: number; realizado: number; closers: number };
  /** Gestão vê o time; pessoal vê a própria meta e linha; leitor não vê ranking. */
  escopo: EscopoVendas;
  preVendas: BoardPreVendas;
  pipeline: BoardPipeline;
  mesAnterior: string;
  mesSeguinte: string | null;
  ehMesCorrente: boolean;
  diaHoje: number;
};

const NOME_MES = (mes: string) =>
  new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
// Maiúscula só na primeira letra: text-transform deixaria "Setembro De 2026".
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Risco = só sinal explícito no negócio (no-show, follow-up vencido, motivo de
 * estagnação "sem retorno"/"trava"). Dois critérios ficaram de fora porque
 * pegavam quase tudo e o painel deixava de apontar algo:
 * - "Sem próxima ação": em 01/10 eram 536 de 536 abertas.
 * - Dias na etapa: 417 de 537 abertas com 14+ dias (mediana de "entrada" ~55d,
 *   de "proposta" ~72d). Tempo parado vira um contador à parte ("Paradas"),
 *   com limiar alto, e não entra na lista de risco. */
const BADGES_DE_RISCO = new Set(["Atrasado", "No-show", "Sem retorno", "Trava na negociação", "Trava na assinatura"]);
const BADGES_VISIVEIS = new Set([...BADGES_DE_RISCO, "Sem próxima ação"]);
const DIAS_PARADO = 45;

function emRisco(c: CardPipeline): boolean {
  return c.badges.some((b) => BADGES_DE_RISCO.has(b));
}

export function VisaoGeralVendas({ mes, meta, escopo, preVendas, pipeline, mesAnterior, mesSeguinte, ehMesCorrente, diaHoje }: Props) {
  const nomeMes = NOME_MES(mes.mes);
  const pct = meta.valorAlvo > 0 ? Math.round((meta.realizado / meta.valorAlvo) * 100) : null;
  const pessoal = escopo === "pessoal";
  const ganhosClosers = mes.ganhosEscopo;
  const ticket = ganhosClosers > 0 ? meta.realizado / ganhosClosers : null;
  // Projeção e ritmo só fazem sentido com o mês em curso; mês fechado mostra o
  // que aconteceu, não uma previsão inventada.
  const diasRestantes = ehMesCorrente ? Math.max(1, mes.diasNoMes - diaHoje + 1) : 0;
  const projecao = ehMesCorrente && diaHoje > 0 ? (meta.realizado / diaHoje) * mes.diasNoMes : null;
  const ritmo = ehMesCorrente && meta.valorAlvo > meta.realizado ? (meta.valorAlvo - meta.realizado) / diasRestantes : null;

  const abertas = pipeline.colunas.filter((c) => !c.colapsada);
  const cardsAbertos = abertas.flatMap((c) => c.cards);
  const riscos = cardsAbertos.filter(emRisco)
    // Maior dinheiro em jogo primeiro: é por onde o gestor começa.
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0) || (b.diasNaEtapa ?? 0) - (a.diasNaEtapa ?? 0));
  const valorEmRisco = riscos.reduce((s, c) => s + (c.valor ?? 0), 0);
  const atrasadas = cardsAbertos.filter((c) => c.badges.includes("Atrasado")).length;
  const paradas = cardsAbertos.filter((c) => (c.diasNaEtapa ?? 0) >= DIAS_PARADO).length;
  const maxEtapa = Math.max(1, ...abertas.map((c) => c.total));

  return (
    <div className="vgv">
      <header className="vgv-cab">
        <div>
          <h1 className="vgv-titulo">Vendas</h1>
          <p className="vgv-sub">Funil, meta e risco do time comercial em {nomeMes}.</p>
        </div>
        <nav className="vgv-mes" aria-label="Mês">
          <Link href={`/vendas?mes=${mesAnterior}`} className="vgv-mes-btn" aria-label="Mês anterior">‹</Link>
          <span className="vgv-mes-rotulo">{capital(nomeMes)}</span>
          {mesSeguinte ? (
            <Link href={`/vendas?mes=${mesSeguinte}`} className="vgv-mes-btn" aria-label="Próximo mês">›</Link>
          ) : (
            <span className="vgv-mes-btn" aria-disabled="true" title="Mês futuro ainda não tem dado">›</span>
          )}
        </nav>
      </header>

      {/* Hero: a meta é faturamento (mrr_fechado + valor_setup) das closers —
          o mesmo número da meta na Home, vindo de getMetaComercialAgregada. */}
      <section className="vgv-hero" aria-label="Meta do mês">
        <span className="vgv-hero-brilho" aria-hidden />
        <div className="vgv-hero-topo">
          <div>
            <span className="vgv-rotulo-escuro">{pessoal ? "Seu faturamento fechado" : "Faturamento fechado"} · {nomeMes}</span>
            <div className="vgv-hero-valor">
              <strong>{moeda(meta.realizado)}</strong>
              <span>
                {/* "de faturamento": a SDR tem meta de reuniões, não de faturamento —
                    "sem meta" seco seria falso para ela. */}
                {meta.valorAlvo > 0 ? <>de {moeda(meta.valorAlvo)} de meta · <b>{pct}%</b></> : "Sem meta de faturamento definida para o mês"}
              </span>
            </div>
            {meta.valorAlvo > 0 ? (
              <div className="vgv-barra" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
              </div>
            ) : null}
          </div>
          <Grafico acumulado={mes.acumuladoPorDia} meta={meta.valorAlvo} ateDia={ehMesCorrente ? diaHoje : mes.diasNoMes} />
        </div>
        <div className="vgv-hero-kpis">
          {pessoal ? (
            <Kpi l="Seus ganhos" v={String(ganhosClosers)} s={`em ${nomeMes.split(" ")[0]}`} />
          ) : (
            <Kpi l="Ganhos das closers" v={String(ganhosClosers)} s={`${meta.closers} closer${meta.closers === 1 ? "" : "s"} ativa${meta.closers === 1 ? "" : "s"}`} />
          )}
          <Kpi l="Ticket médio" v={ticket == null ? "—" : moeda(ticket)} s="mensalidade + setup" />
          <Kpi l="Ritmo necessário" v={ritmo == null ? "—" : `${moeda(ritmo)}/dia`} s={ehMesCorrente ? `${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} restantes` : "mês encerrado"} />
          <Kpi l="Projeção do mês" v={projecao == null ? "—" : moeda(projecao)} s={ehMesCorrente ? "no ritmo atual" : "mês encerrado"} />
        </div>
      </section>

      {/* Funil: Pré-vendas, Pipeline e Propostas são retrato de AGORA; Ganho é o
          mês escolhido. Misturar as duas réguas sem dizer seria mentir. */}
      <section className="vgv-funil" aria-label="Funil comercial">
        <Etapa href="/pre-vendas" l="Pré-vendas" v={preVendas.resumo.ativos} s={`${preVendas.resumo.qualificadosNoMes} qualificados no mês corrente`} rodape="agora">
          <Mini itens={preVendas.colunas.filter((c) => c.chave !== "nutricao" && c.chave !== "desqualificado").map((c) => ({ l: c.rotulo, n: c.total }))} />
          <span className="vgv-etapa-rodape">Nutrição {preVendas.resumo.nutricao} · Desqualificados {preVendas.resumo.desqualificados}</span>
        </Etapa>
        <Etapa href="/pipeline" l="Pipeline" v={pipeline.resumo.abertas} s={`${moeda(pipeline.resumo.valorEmAberto)} em aberto`} rodape="agora">
          <Mini itens={abertas.map((c) => ({ l: c.rotulo, n: c.total }))} max={maxEtapa} />
        </Etapa>
        <Etapa href="/propostas" l="Propostas vigentes" v={mes.propostas.vigentes} s={`${moeda(mes.propostas.valorVigente)} com o cliente`} rodape="agora">
          <div className="vgv-etapa-linhas">
            <span>Enviadas em {nomeMes.split(" ")[0]}<b>{mes.propostas.enviadasNoMes}</b></span>
            <span title={mes.propostas.aceitasNoMes == null ? "O aceite ainda não registra data no banco" : undefined}>
              Aceitas em {nomeMes.split(" ")[0]}<b>{mes.propostas.aceitasNoMes ?? "—"}</b>
            </span>
          </div>
        </Etapa>
        <Etapa href="/pipeline?aba=ganhas" l="Ganho" v={mes.ganhosOrg} s={`${moeda(mes.faturamentoOrg)} faturados`} rodape={nomeMes} final>
          <div className="vgv-etapa-linhas">
            {pessoal ? (
              <span>Seu faturamento<b>{moeda(meta.realizado)}</b></span>
            ) : mes.faturamentoOrg !== meta.realizado ? (
              <span>Fora das closers<b>{moeda(mes.faturamentoOrg - meta.realizado)}</b></span>
            ) : (
              <span>Tudo pelas closers<b>100%</b></span>
            )}
          </div>
        </Etapa>
      </section>

      <div className="vgv-grade">
        {/* Leitor não vê ranking (dado individual); pessoal vê só a própria linha,
            com a posição real no time. */}
        {escopo === "leitor" ? null : (
        <section className="vgv-painel" aria-labelledby="vgv-ranking">
          <div className="vgv-painel-cab">
            <h2 id="vgv-ranking">{pessoal ? "Sua posição no ranking" : "Ranking de closers"}</h2>
            <span className="vgv-painel-nota">{capital(nomeMes)}</span>
          </div>
          {mes.ranking.length === 0 ? (
            <p className="vgv-vazio">{pessoal ? "Você não está no ranking de closers." : "Nenhuma closer ativa nesta organização."}</p>
          ) : (
            <ol className="vgv-ranking">
              {mes.ranking.map((r) => {
                const p = r.meta > 0 ? Math.round((r.faturamento / r.meta) * 100) : null;
                return (
                  <li key={r.id}>
                    <span className="vgv-pos">{r.posicao}</span>
                    <span className="vgv-av" aria-hidden>{iniciais(r.nome)}</span>
                    <span className="vgv-rk-nome">
                      <strong>{r.nome}</strong>
                      <small>{r.ganhos} ganho{r.ganhos === 1 ? "" : "s"} · {r.abertas} abertas ({moeda(r.valorAberto)})</small>
                      {r.meta > 0 ? (
                        <span className="vgv-barra vgv-barra-clara"><span style={{ width: `${Math.min(100, p ?? 0)}%` }} /></span>
                      ) : null}
                    </span>
                    <span className="vgv-rk-valor">
                      <strong>{moeda(r.faturamento)}</strong>
                      <small>{r.meta > 0 ? `${p}% de ${moeda(r.meta)}` : "sem meta definida"}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        )}

        {/* Leitor vê o risco sem o nome do responsável (dado individual). */}
        <section className="vgv-painel" aria-labelledby="vgv-risco">
          <div className="vgv-painel-cab">
            <h2 id="vgv-risco">Oportunidades em risco</h2>
            <span className="vgv-painel-nota">{riscos.length} de {cardsAbertos.length} abertas · {moeda(valorEmRisco)}</span>
          </div>
          <div className="vgv-chips">
            <Link className="vgv-chip" data-sinal={pipeline.resumo.semProximaAcao > 0 || undefined} href="/pipeline?loop=sem-proxima-acao">
              Sem próxima ação <b>{pipeline.resumo.semProximaAcao}</b>
            </Link>
            <span className="vgv-chip">Atrasadas <b>{atrasadas}</b></span>
            <span className="vgv-chip">Paradas há {DIAS_PARADO}+ dias <b>{paradas}</b></span>
          </div>
          {riscos.length === 0 ? (
            <p className="vgv-vazio">Nenhuma oportunidade aberta em risco agora.</p>
          ) : (
            <ul className="vgv-riscos">
              {riscos.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link href={`/pipeline/${c.id}`} className="vgv-risco">
                    <span className="vgv-risco-txt">
                      <strong>{c.empresa}</strong>
                      <small>{c.titulo} · {pipeline.colunas.find((x) => x.chave === c.etapa)?.rotulo ?? c.etapa}{c.responsavel && escopo !== "leitor" ? ` · ${c.responsavel}` : ""}</small>
                      <span className="vgv-badges">
                        {c.badges.filter((b) => BADGES_VISIVEIS.has(b)).map((b) => <em key={b}>{b}</em>)}
                        {c.diasNaEtapa != null ? <em data-neutro>{c.diasNaEtapa}d na etapa</em> : null}
                      </span>
                    </span>
                    <span className="vgv-risco-valor">{moeda(c.valor)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {riscos.length > 8 ? (
            <Link className="vgv-mais" href="/pipeline">Ver todas no pipeline →</Link>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="vgv-atalhos">
        <h2 id="vgv-atalhos" className="vgv-secao">Atalhos</h2>
        <div className="vgv-atalhos">
          {ATALHOS.map((a) => (
            <Link key={a.href} href={a.href} className="vgv-atalho">
              <strong>{a.l}</strong>
              <small>{a.s}</small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const ATALHOS = [
  { href: "/prospeccao", l: "Prospecção", s: "Outbound e listas" },
  { href: "/pre-vendas", l: "Pré-vendas", s: "Leads em qualificação" },
  { href: "/pipeline", l: "Pipeline", s: "Oportunidades por etapa" },
  { href: "/propostas", l: "Propostas", s: "Enviadas e vigentes" },
  { href: "/propostas/nova", l: "Nova proposta", s: "Abrir o composer" },
  { href: "/tarefas", l: "Atividades", s: "Próximos passos do time" },
  { href: "/contatos", l: "Contatos & Empresas", s: "Pessoas e contas" },
];

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function Kpi({ l, v, s }: { l: string; v: string; s: string }) {
  return (
    <div className="vgv-kpi">
      <span>{l}</span>
      <strong>{v}</strong>
      <small>{s}</small>
    </div>
  );
}

function Etapa({ href, l, v, s, rodape, final, children }: {
  href: string; l: string; v: number; s: string; rodape: string; final?: boolean; children?: ReactNode;
}) {
  return (
    <Link href={href} className="vgv-etapa" data-final={final || undefined}>
      <span className="vgv-etapa-topo"><span>{l}</span><small>{rodape}</small></span>
      <strong className="vgv-etapa-n">{v.toLocaleString("pt-BR")}</strong>
      <span className="vgv-etapa-s">{s}</span>
      {children}
    </Link>
  );
}

function Mini({ itens, max }: { itens: Array<{ l: string; n: number }>; max?: number }) {
  const teto = max ?? Math.max(1, ...itens.map((i) => i.n));
  return (
    <span className="vgv-mini">
      {itens.map((i) => (
        <span key={i.l} className="vgv-mini-linha">
          <span className="vgv-mini-l">{i.l}</span>
          <span className="vgv-mini-trilho"><span style={{ width: `${(i.n / teto) * 100}%` }} /></span>
          <b>{i.n}</b>
        </span>
      ))}
    </span>
  );
}

/** Acumulado do faturamento por dia contra a reta da meta. SVG puro: sem lib. */
function Grafico({ acumulado, meta, ateDia }: { acumulado: number[]; meta: number; ateDia: number }) {
  const W = 320, H = 120, P = 6;
  const n = acumulado.length;
  const teto = Math.max(meta, acumulado[n - 1] ?? 0, 1);
  const x = (i: number) => P + (i / Math.max(1, n - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / teto) * (H - 2 * P);
  const pontos = acumulado.slice(0, Math.max(1, ateDia)).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = pontos.length > 0 ? `M${x(0)},${H - P} L${pontos.join(" L")} L${x(pontos.length - 1)},${H - P} Z` : "";
  return (
    <figure className="vgv-grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Faturamento acumulado no mês contra a meta">
        {meta > 0 ? <line x1={x(0)} y1={y(0)} x2={x(n - 1)} y2={y(meta)} className="vgv-g-meta" /> : null}
        {area ? <path d={area} className="vgv-g-area" /> : null}
        {pontos.length > 0 ? <polyline points={pontos.join(" ")} className="vgv-g-linha" /> : null}
      </svg>
      <figcaption>
        {(acumulado[n - 1] ?? 0) > 0 ? <span><i className="vgv-dot" /> acumulado</span> : <span>Nenhum ganho registrado ainda no mês</span>}
        {meta > 0 ? <span><i className="vgv-dot vgv-dot-meta" /> ritmo da meta</span> : null}
      </figcaption>
    </figure>
  );
}
