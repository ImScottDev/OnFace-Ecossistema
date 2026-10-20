import Link from "next/link";
import { Zap, Workflow, Repeat, Bot, Megaphone, Inbox, Plus, Activity, Clock } from "lucide-react";

import type { VisaoGeralAutomacoes } from "@/lib/automacoes/visao-geral";
import { AbasAutomacoes } from "./Abas";
import { STATUS_EXECUCAO, ENTIDADE, quandoRelativo, plural } from "./formato";
import "./automacoes.css";
import { BotaoMotivo } from "@/components/onface/ds/escolha";

/**
 * Automações → visão geral (arquétipo A, vocabulário do desenho de CS).
 *
 * Componente de servidor de propósito: a tela só lê. Toda ação mora na tela
 * de destino (regra em Fluxos, cadência em Cadências, agente em Agentes) e o
 * tile é o atalho para ela — assim nenhum botão aqui pode existir sem
 * executor por trás.
 */
export function AutomacoesVisaoGeral({ dados, podeGerir, totalRotinas }: {
  dados: VisaoGeralAutomacoes;
  podeGerir: boolean;
  totalRotinas: number;
}) {
  const { regras, cadencias, agentes, campanhas, eventos, execucoes, toquesSdr, serie, recentes } = dados;
  const diasPendente = eventos.pendenteMaisAntigo
    ? Math.floor((Date.now() - new Date(eventos.pendenteMaisAntigo).getTime()) / 86_400_000)
    : 0;

  return (
    <div data-workspace="desenho">
      <div className="oa-tela">
        <div className="oa-rolagem">
          <div className="oa-coluna">
            <div className="oa-barra">
              <AbasAutomacoes atual="/automacoes" />
              <span className="oa-espaco" />
              {podeGerir ? (
                <Link href="/automacoes/fluxos?nova=1" className="oa-btn oa-btn-primario">
                  <Plus size={14} strokeWidth={2.4} /> Nova regra
                </Link>
              ) : (
                <BotaoMotivo type="button" className="oa-btn oa-btn-primario" motivo="Sua função não tem a permissão automation.manage">
                  <Plus size={14} strokeWidth={2.4} /> Nova regra
                </BotaoMotivo>
              )}
            </div>

            <section className="oa-hero" aria-labelledby="oa-titulo">
              <span className="oa-hero-icone"><Zap size={20} strokeWidth={2.2} /></span>
              <span className="oa-hero-texto">
                <h1 id="oa-titulo" className="oa-hero-titulo">Automações</h1>
                <span className="oa-hero-sub">O que o sistema faz sozinho: regras, cadências, agentes e as rotinas do worker.</span>
              </span>
              <div className="oa-hero-kpis">
                <span className="oa-hero-kpi"><b>{eventos.total30d.toLocaleString("pt-BR")}</b><span>eventos · 30 dias</span></span>
                <span className="oa-hero-kpi"><b>{execucoes.total30d.toLocaleString("pt-BR")}</b><span>execuções · 30 dias</span></span>
                <span className={`oa-hero-kpi${execucoes.erros30d > 0 ? " oa-alerta" : ""}`}><b>{execucoes.erros30d.toLocaleString("pt-BR")}</b><span>com erro</span></span>
              </div>
            </section>

            <div className="oa-tiles">
              <Tile href="/automacoes/fluxos" icone={<Workflow size={18} />} acento
                rotulo="Regras ativas" valor={regras.ativas} de={regras.total}
                nota={regras.total === 0 ? "nenhuma regra cadastrada" : `${regras.total - regras.ativas} pausada${regras.total - regras.ativas === 1 ? "" : "s"}`} />
              <Tile href="/automacoes/cadencias" icone={<Repeat size={18} />}
                rotulo="Cadências publicadas" valor={cadencias.publicadas} de={cadencias.total}
                nota={plural(cadencias.inscricoesAtivas, "inscrição ativa", "inscrições ativas")} />
              <Tile href="/automacoes/agentes" icone={<Bot size={18} />}
                rotulo="Agentes de IA" valor={agentes.total}
                nota={agentes.total === 0 ? "nenhum agente criado" : `${agentes.publicados} publicado${agentes.publicados === 1 ? "" : "s"} · ${agentes.rascunhos} rascunho${agentes.rascunhos === 1 ? "" : "s"}`} />
              <Tile href="/automacoes/campanhas" icone={<Megaphone size={18} />}
                rotulo="Campanhas" valor={campanhas.total}
                nota={campanhas.total === 0 ? "nenhuma campanha" : `${campanhas.enviados.toLocaleString("pt-BR")} envios · ${campanhas.rascunhos} rascunho${campanhas.rascunhos === 1 ? "" : "s"}`} />
              <Tile href="/automacoes/fluxos#eventos" icone={<Inbox size={18} />} acento={eventos.pendentes > 0}
                rotulo="Eventos na fila" valor={eventos.pendentes}
                alerta={diasPendente >= 1}
                nota={eventos.pendentes === 0
                  ? (eventos.falhas > 0 ? plural(eventos.falhas, "falha definitiva", "falhas definitivas") : "fila em dia")
                  : diasPendente >= 1 ? `parada há ${plural(diasPendente, "dia", "dias")}` : "aguardando o próximo ciclo"}
                titulo={diasPendente >= 1 ? "O barramento é consumido a cada minuto: pendente com dias de idade indica worker parado." : undefined} />
            </div>

            <div className="oa-linha">
              <section className="oa-secao oa-secao-larga" aria-labelledby="oa-atividade">
                <div className="oa-secao-topo">
                  <h2 id="oa-atividade" className="oa-secao-titulo">Atividade do motor · 30 dias</h2>
                  <span className="oa-legenda"><span className="oa-ponto" />Eventos recebidos</span>
                  <span className="oa-legenda"><span className="oa-ponto oa-coral" />Execuções</span>
                </div>
                <Grafico serie={serie} />
                <p className="oa-secao-sub" style={{ margin: 0 }}>
                  {eventos.ultimoEm ? `Último evento ${quandoRelativo(eventos.ultimoEm)}.` : "Nenhum evento publicado ainda."}{" "}
                  Evento é o fato (lead criado, etapa mudou, tag adicionada); execução é uma regra ou passo de cadência que rodou por causa dele.
                </p>
              </section>

              <section className="oa-secao" aria-labelledby="oa-sdr">
                <div className="oa-secao-topo">
                  <h2 id="oa-sdr" className="oa-secao-titulo">Cadência SDR inbound</h2>
                  <Link href="/pre-vendas" className="oa-link">Pré-vendas</Link>
                </div>
                <p className="oa-secao-sub">Toques registrados pelos SDRs nos últimos 30 dias. Quem envia é uma pessoa, por isso fica fora das execuções automáticas.</p>
                <span className="oa-tile-valor" style={{ fontSize: 26 }}>{toquesSdr.total30d.toLocaleString("pt-BR")} <small>toques</small></span>
                <BarraH nome="WhatsApp" valor={toquesSdr.whatsapp30d} total={toquesSdr.total30d} />
                <BarraH nome="Ligação" valor={toquesSdr.ligacao30d} total={toquesSdr.total30d} />
                <span className="oa-dica"><Clock size={11} style={{ verticalAlign: "-1px" }} /> {toquesSdr.ultimoEm ? `Último toque ${quandoRelativo(toquesSdr.ultimoEm)}` : "Nenhum toque registrado"}</span>
              </section>
            </div>

            <section className="oa-secao" aria-labelledby="oa-recentes">
              <div className="oa-secao-topo">
                <h2 id="oa-recentes" className="oa-secao-titulo">Atividade recente</h2>
                <Link href="/automacoes/execucoes" className="oa-link">Ver todas</Link>
              </div>
              {recentes.length === 0 ? (
                <div className="oa-vazio">
                  <strong>Nenhuma atividade registrada</strong>
                  <span>
                    {regras.ativas === 0 && cadencias.publicadas === 0
                      ? "Não há regra ativa nem cadência publicada, então nada dispara. Crie uma regra em Fluxos ou publique uma cadência."
                      : "As regras e cadências ativas ainda não dispararam. Cada execução aparece aqui com o resultado."}
                  </span>
                </div>
              ) : (
                <ul className="oa-lista">
                  {recentes.map((r) => {
                    const s = STATUS_EXECUCAO[r.status] ?? { l: r.status, tom: "neutro" as const };
                    return (
                      <li key={`${r.tipo}-${r.id}`} className="oa-item">
                        <span className={`oa-ponto oa-${s.tom}`} aria-hidden />
                        <span className="oa-item-corpo">
                          <span className="oa-item-titulo">{r.nome}</span>
                          <span className="oa-item-meta">{r.tipo === "automacao" ? "Regra" : "Cadência"} · {ENTIDADE[r.entityType] ?? r.entityType} <span className="oa-mono">{r.entityId.slice(0, 8)}</span></span>
                        </span>
                        <span className={`oa-selo oa-${s.tom === "neutro" ? "" : s.tom}`}>{s.l}</span>
                        <span className="oa-item-lado">{quandoRelativo(r.quando)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="oa-faixa" aria-label="Rotinas do worker">
              <span className="oa-faixa-titulo"><Activity size={14} strokeWidth={2.2} style={{ color: "var(--of-coral-marca)" }} /> {totalRotinas} rotinas agendadas no worker</span>
              <span className="oa-faixa-texto">Barramento de eventos a cada minuto, passos de cadência a cada 5, Agente SDR, SLA, propostas, CS e sincronizações.</span>
              <Link href="/automacoes/fluxos#rotinas">Ver rotinas</Link>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ href, icone, rotulo, valor, de, nota, acento, alerta, titulo }: {
  href: string; icone: React.ReactNode; rotulo: string; valor: number; de?: number; nota: string; acento?: boolean; alerta?: boolean; titulo?: string;
}) {
  return (
    <Link href={href} className="oa-tile" title={titulo}>
      <span className={`oa-tile-icone${acento ? " oa-acento" : ""}`}>{icone}</span>
      <span className="oa-tile-corpo">
        <span className="oa-tile-rotulo">{rotulo}</span>
        <span className="oa-tile-valor">{valor.toLocaleString("pt-BR")}{de !== undefined && <small> de {de}</small>}</span>
        <span className={`oa-tile-nota${alerta ? " oa-alerta" : ""}`}>{nota}</span>
      </span>
    </Link>
  );
}

function BarraH({ nome, valor, total }: { nome: string; valor: number; total: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="oa-hbar">
      <span className="oa-hbar-nome">{nome}</span>
      <span className="oa-hbar-trilho"><i style={{ width: `${pct}%` }} /></span>
      <span className="oa-hbar-valor">{valor.toLocaleString("pt-BR")}</span>
    </div>
  );
}

/** Barras por dia. O teto do eixo arredonda para cima num múltiplo de 4 para
 *  as quatro linhas de grade caírem em número inteiro. */
function Grafico({ serie }: { serie: VisaoGeralAutomacoes["serie"] }) {
  const max = Math.max(1, ...serie.map((d) => Math.max(d.eventos, d.execucoes)));
  const teto = Math.ceil(max / 4) * 4;
  const eixo = [teto, (teto * 3) / 4, teto / 2, teto / 4, 0];
  const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <div className="oa-grafico">
      <div className="oa-eixo" aria-hidden>{eixo.map((v) => <span key={v}>{v}</span>)}</div>
      <div className="oa-plot">
        <div className="oa-barras" role="img" aria-label={`Eventos e execuções por dia nos últimos ${serie.length} dias`}>
          {serie.map((d) => (
            <div key={d.dia} className="oa-col" title={`${dia(d.dia)}: ${d.eventos} eventos, ${d.execucoes} execuções${d.erros ? `, ${d.erros} com erro` : ""}`}>
              <span className="oa-bar" style={{ height: `${(d.eventos / teto) * 100}%` }} />
              <span className="oa-bar oa-coral" style={{ height: `${(d.execucoes / teto) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="oa-rotulos" aria-hidden>
          {serie.map((d, i) => <span key={d.dia}>{i % 5 === 0 || i === serie.length - 1 ? dia(d.dia) : ""}</span>)}
        </div>
      </div>
    </div>
  );
}
