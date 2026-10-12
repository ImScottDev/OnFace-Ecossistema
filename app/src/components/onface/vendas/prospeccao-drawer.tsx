"use client";

/**
 * Drawer operacional do prospect (Bloco 04 §16), no padrão do painel de
 * Pré-vendas/Pipeline (`Painel` + abas). Lê `detalheDoProspect`, que reaproveita
 * as mesmas leituras das fichas: nada é copiado nem inventado. Aba sem dado
 * diz que está sem dado.
 *
 * Toda ação sai pelo `aoMover`/`acoes` do pai, que passa pelos comandos de
 * domínio: o drawer não grava estado.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, MessageSquare, Mail, Phone } from "lucide-react";
import type { DetalheDoProspect } from "@/lib/vendas/prospeccao-detalhe";
import { rotuloDeEvento } from "@/lib/vendas/rotulos-evento";
import { ROTULO_FAMILIA, type EstadoProspeccao } from "@/lib/vendas/dominio";
import { destinosPermitidos } from "@/lib/vendas/prospeccao-transicoes";
import type { Resultado } from "@/lib/vendas/resultado";
import { Campo, Painel, Secao, Tag, dataCurta, dataHora } from "./ui";

const ABAS = ["Operação", "Pessoas", "Conversas", "Cadência", "Histórico", "Inteligência"] as const;
type Aba = (typeof ABAS)[number];

const ROTULO_STATUS_CADENCIA: Record<string, string> = {
  active: "Ativa", waiting: "Aguardando próximo passo", waiting_reply: "Aguardando resposta", paused: "Pausada",
  completed: "Concluída", cancelled: "Cancelada", failed: "Falhou",
};
const ROTULO_SITUACAO_PASSO = { executado: "Feito", atual: "Próximo", pendente: "Pendente", erro: "Erro" } as const;

const ACAO_DO_ESTADO: Record<string, string> = {
  em_cadencia: "Adicionar à cadência", respondeu: "Registrar resposta", sem_resposta: "Marcar sem resposta",
  pre_qualificado: "Pré-qualificar", oportunidade: "Criar oportunidade", descartado: "Descartar",
};

export interface AlvoDoDrawer { leadId: string; empresa: string; estado: EstadoProspeccao; empresaId: string | null }
const alvoDe = (d: DetalheDoProspect): AlvoDoDrawer => ({ leadId: d.leadId, empresa: d.lead.empresa.nome, estado: d.estado, empresaId: d.lead.empresa.id });

export interface AcoesDoDrawer {
  detalhe: (leadId: string) => Promise<Resultado<DetalheDoProspect>>;
  pausar: (leadId: string) => Promise<Resultado>;
  retomar: (leadId: string) => Promise<Resultado>;
}

export function ProspectDrawer({ leadId, versao, responsaveis, acoes, aoFechar, aoMover, aoAtribuir }: {
  leadId: string;
  /** Muda quando algo gravou: o drawer relê. */
  versao: number;
  responsaveis: Array<{ id: string; nome: string }>;
  acoes: AcoesDoDrawer;
  aoFechar: () => void;
  aoMover: (alvo: AlvoDoDrawer, para: EstadoProspeccao) => void;
  aoAtribuir: (leadId: string, responsavelId: string | null) => Promise<boolean>;
}) {
  const [aba, setAba] = useState<Aba>("Operação");
  const [estado, setEstado] = useState<{ chave: string; d: DetalheDoProspect | null; erro: string | null }>({ chave: "", d: null, erro: null });
  const [msg, setMsg] = useState<string | null>(null);
  const chave = `${leadId}:${versao}`;

  useEffect(() => {
    let vivo = true;
    acoes.detalhe(leadId)
      .then((r) => { if (vivo) setEstado({ chave, d: r.ok ? r.dados ?? null : null, erro: r.ok ? null : r.erro }); })
      .catch(() => { if (vivo) setEstado({ chave, d: null, erro: "Não foi possível carregar o prospect." }); });
    return () => { vivo = false; };
  }, [chave, leadId, acoes]);

  const carregando = estado.chave !== chave;
  const d = estado.d;
  const nome = d?.lead.empresa.nome ?? "Prospect";

  return (
    <Painel titulo={nome}
      subtitulo={d ? `${d.lead.pessoa.nome}${d.lead.pessoa.cargo ? ` · ${d.lead.pessoa.cargo}` : ""}` : undefined}
      aoFechar={aoFechar}>
      <div className="pp-abas-drawer" role="tablist" aria-label="Seções do prospect">
        {ABAS.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} data-on={aba === a} onClick={() => setAba(a)}>{a}</button>
        ))}
      </div>

      {carregando && !d ? <p className="ov-nota" role="status">Carregando…</p> : null}
      {estado.erro ? <p className="ov-nota" role="alert">{estado.erro}</p> : null}
      {msg ? <p className="ov-nota" role="status">{msg}</p> : null}

      {d ? (
        <div role="tabpanel" aria-label={aba} className="pp-drawer-corpo" data-carregando={carregando || undefined}>
          {aba === "Operação" ? <AbaOperacao d={d} responsaveis={responsaveis} aoMover={aoMover} aoAtribuir={aoAtribuir} /> : null}
          {aba === "Pessoas" ? <AbaPessoas d={d} /> : null}
          {aba === "Conversas" ? <AbaConversas d={d} /> : null}
          {aba === "Cadência" ? (
            <AbaCadencia d={d} aoMover={aoMover}
              aoPausar={async (retomar) => {
                const r = retomar ? await acoes.retomar(leadId) : await acoes.pausar(leadId);
                setMsg(r.ok ? (retomar ? "Cadência retomada." : "Cadência pausada.") : r.erro);
                setEstado((e) => ({ ...e, chave: "" }));
              }} />
          ) : null}
          {aba === "Histórico" ? <AbaHistorico d={d} /> : null}
          {aba === "Inteligência" ? <AbaInteligencia d={d} /> : null}
        </div>
      ) : null}
    </Painel>
  );
}

function AbaOperacao({ d, responsaveis, aoMover, aoAtribuir }: {
  d: DetalheDoProspect; responsaveis: Array<{ id: string; nome: string }>;
  aoMover: (alvo: AlvoDoDrawer, para: EstadoProspeccao) => void;
  aoAtribuir: (leadId: string, responsavelId: string | null) => Promise<boolean>;
}) {
  const destinos = destinosPermitidos(d.estado);
  const saiu = ["pre_qualificado", "oportunidade", "descartado"].includes(d.estado);
  const opp = d.lead.oportunidades[0];
  return (
    <>
      <Secao titulo="Estado">
        <div className="ov-card-meta">
          <Tag tom={saiu ? "sucesso" : "info"}>{d.estadoRotulo}</Tag>
          {d.lista ? <Tag>{d.lista}</Tag> : null}
          {d.lead.preQualificado && d.estado !== "pre_qualificado" ? <Tag tom="sucesso">Pré-qualificado</Tag> : null}
        </div>
        {d.descarte ? <p className="ov-nota">Descartado em {dataHora(d.descarte.em)}. Motivo: {d.descarte.motivo ?? "não informado"}. O histórico foi preservado.</p> : null}
        {d.estado === "pre_qualificado" ? <p className="ov-nota">Entregue a Pré-vendas. Daqui em diante a jornada de qualificação acontece lá.</p> : null}
        {d.estado === "oportunidade" ? <p className="ov-nota">Virou oportunidade direta no Pipeline.</p> : null}
      </Secao>

      {saiu ? (
        <div className="ov-acoes">
          {d.estado === "pre_qualificado" ? <Link className="ov-botao" href={`/pre-vendas/${d.leadId}`}><ExternalLink aria-hidden />Abrir em Pré-vendas</Link> : null}
          {d.estado === "oportunidade" ? <Link className="ov-botao" href={opp ? `/pipeline/${opp.id}` : "/pipeline"}><ExternalLink aria-hidden />Abrir no Pipeline</Link> : null}
        </div>
      ) : (
        <Secao titulo="Próximas ações">
          <div className="ov-acoes">
            {destinos.map((p) => (
              <button key={p} type="button" className="ov-botao"
                data-variante={p === "descartado" ? "perigo" : p === "pre_qualificado" ? undefined : "contorno"}
                onClick={() => aoMover(alvoDe(d), p)}>
                {ACAO_DO_ESTADO[p]}
              </button>
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Prospecção">
        <dl className="ov-campos">
          <Campo rotulo="Responsável">
            <select aria-label="Responsável" value={d.lead.responsavel.id ?? ""}
              onChange={(e) => { void aoAtribuir(d.leadId, e.target.value || null); }}>
              <option value="">Sem responsável</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Origem">Outbound</Campo>
          <Campo rotulo="Fonte">{d.fonte}</Campo>
          <Campo rotulo="Lista">{d.lista}</Campo>
          <Campo rotulo="Cadência">{d.cadencia ? `${d.cadencia.nome}${d.cadencia.passoAtual ? ` · passo ${d.cadencia.passoAtual} de ${d.cadencia.totalPassos}` : ""}` : null}</Campo>
          <Campo rotulo="Próxima ação">{d.cadencia?.proximaAcaoEm ? dataHora(d.cadencia.proximaAcaoEm) : d.lead.proximaAcao?.titulo ?? null}</Campo>
          <Campo rotulo="Entrou em">{dataCurta(d.lead.criadoEm)}</Campo>
        </dl>
      </Secao>

      <Secao titulo="Empresa">
        <dl className="ov-campos">
          <Campo rotulo="Setor">{d.lead.empresa.setor}</Campo>
          <Campo rotulo="Porte">{d.lead.empresa.porte}</Campo>
          <Campo rotulo="Cidade">{d.lead.empresa.cidade}</Campo>
          <Campo rotulo="Site">{d.lead.empresa.website}</Campo>
        </dl>
        {d.lead.empresa.id ? <Link className="pp-link" href={`/empresas/${d.lead.empresa.id}`}>Ver empresa 360</Link> : null}
      </Secao>
      {d.lead.oportunidades.length > 0 ? (
        <Secao titulo="Oportunidades">
          {d.lead.oportunidades.map((o) => (
            <Link key={o.id} className="pp-link" href={`/pipeline/${o.id}`}>{o.titulo}{o.familia ? ` · ${ROTULO_FAMILIA[o.familia as keyof typeof ROTULO_FAMILIA] ?? o.familia}` : ""} · {o.etapaRotulo}</Link>
          ))}
        </Secao>
      ) : null}
    </>
  );
}

function AbaPessoas({ d }: { d: DetalheDoProspect }) {
  const p = d.lead.pessoa;
  const tel = p.telefone || p.whatsapp;
  return (
    <>
      <Secao titulo="Pessoa principal">
        <dl className="ov-campos">
          <Campo rotulo="Nome">{p.nome}</Campo>
          <Campo rotulo="Cargo">{p.cargo}</Campo>
          <Campo rotulo="E-mail">{p.email}</Campo>
          <Campo rotulo="Telefone">{p.telefone}</Campo>
          <Campo rotulo="WhatsApp">{p.whatsapp}</Campo>
          <Campo rotulo="LinkedIn">{p.linkedin}</Campo>
        </dl>
        <div className="ov-acoes">
          {tel ? <Link className="ov-botao" data-variante="contorno" href={`/atendimento?canal=whatsapp&leadId=${d.leadId}`}><MessageSquare aria-hidden />WhatsApp</Link> : null}
          {p.email ? <Link className="ov-botao" data-variante="contorno" href={`/atendimento?canal=email&leadId=${d.leadId}`}><Mail aria-hidden />E-mail</Link> : null}
          {tel ? <a className="ov-botao" data-variante="contorno" href={`tel:${tel.replace(/[^\d+]/g, "")}`}><Phone aria-hidden />Ligar</a> : null}
          <Link className="ov-botao" data-variante="neutro" href={`/pessoas/${d.leadId}`}>Abrir contato</Link>
        </div>
        {!tel && !p.email ? <p className="ov-nota">Sem telefone nem e-mail: enriqueça ou edite o contato para abordar.</p> : null}
      </Secao>
      <Secao titulo="Outras pessoas da empresa">
        {d.outrasPessoas.length === 0 ? <p className="ov-nota">Nenhuma outra pessoa associada a esta empresa ainda.</p> : d.outrasPessoas.map((o) => (
          <p key={o.id} className="ov-nota"><strong>{o.nome}</strong>{o.cargo ? ` · ${o.cargo}` : ""}{o.email ? ` · ${o.email}` : ""}{o.telefone ? ` · ${o.telefone}` : ""}</p>
        ))}
      </Secao>
    </>
  );
}

function AbaConversas({ d }: { d: DetalheDoProspect }) {
  const c = d.conversas;
  return (
    <Secao titulo="Conversas">
      {c.total === 0 ? <p className="ov-nota">Nenhuma mensagem trocada com este prospect ainda.</p> : (
        <>
          <p className="ov-nota">{c.total} {c.total === 1 ? "mensagem" : "mensagens"}: {c.recebidas} recebidas, {c.enviadas} enviadas.</p>
          <ul className="pp-lista-simples">
            {c.ultimas.map((m) => (
              <li key={`${m.canal}-${m.id}`}>
                <span className="pp-apoio">{m.canal} · {m.direcao === "in" ? "recebida" : m.direcao === "out" ? "enviada" : "—"} · {dataHora(m.em)}</span>
                <span>{m.resumo || "(sem texto)"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link className="ov-botao" data-variante="contorno" href={c.hrefAtendimento}><ExternalLink aria-hidden />Abrir no Atendimento</Link>
    </Secao>
  );
}

function AbaCadencia({ d, aoMover, aoPausar }: {
  d: DetalheDoProspect; aoMover: (alvo: AlvoDoDrawer, para: EstadoProspeccao) => void; aoPausar: (retomar: boolean) => void;
}) {
  const c = d.cadencia;
  const podeEntrar = destinosPermitidos(d.estado).includes("em_cadencia");
  if (!c) {
    return (
      <Secao titulo="Cadência">
        <p className="ov-nota">Esta empresa nunca entrou em uma cadência.</p>
        {podeEntrar ? <button type="button" className="ov-botao" onClick={() => aoMover(alvoDe(d), "em_cadencia")}>Adicionar à cadência</button> : null}
      </Secao>
    );
  }
  const viva = ["active", "waiting", "waiting_reply"].includes(c.status);
  return (
    <>
      <Secao titulo={c.nome}>
        <dl className="ov-campos">
          <Campo rotulo="Status">{ROTULO_STATUS_CADENCIA[c.status] ?? c.status}</Campo>
          <Campo rotulo="Passo">{c.passoAtual != null ? `${c.passoAtual} de ${c.totalPassos}` : null}</Campo>
          <Campo rotulo="Próxima ação">{c.proximaAcaoEm ? dataHora(c.proximaAcaoEm) : null}</Campo>
          <Campo rotulo="Última execução">{c.ultimaExecucaoEm ? dataHora(c.ultimaExecucaoEm) : null}</Campo>
          <Campo rotulo="Iniciada em">{dataHora(c.iniciadaEm)}</Campo>
          <Campo rotulo="Responsável">{d.lead.responsavel.nome}</Campo>
        </dl>
        {c.motivoDeParada ? <p className="ov-nota">Motivo: {c.motivoDeParada}</p> : null}
        <div className="ov-acoes">
          {viva && d.estado === "em_cadencia" ? <button type="button" className="ov-botao" data-variante="neutro" onClick={() => aoPausar(false)}>Pausar cadência</button> : null}
          {c.status === "paused" && d.estado === "em_cadencia" ? <button type="button" className="ov-botao" onClick={() => aoPausar(true)}>Retomar cadência</button> : null}
          {podeEntrar ? <button type="button" className="ov-botao" data-variante="contorno" onClick={() => aoMover(alvoDe(d), "em_cadencia")}>Nova cadência</button> : null}
        </div>
      </Secao>
      <Secao titulo="Passos">
        <ol className="pp-passos">
          {c.passos.map((p) => (
            <li key={p.id} data-situacao={p.situacao}>
              <span className="pp-passo-n">{p.ordem}</span>
              <span className="pp-passo-t">{p.titulo}</span>
              <span className="pp-apoio">{ROTULO_SITUACAO_PASSO[p.situacao]}{p.quando ? ` · ${dataHora(p.quando)}` : ""}</span>
            </li>
          ))}
        </ol>
      </Secao>
    </>
  );
}

function AbaHistorico({ d }: { d: DetalheDoProspect }) {
  return (
    <Secao titulo="Histórico">
      {d.historico.length === 0 ? <p className="ov-nota">Nenhum evento registrado ainda.</p> : (
        <ol className="pp-passos">
          {d.historico.map((e) => (
            <li key={e.id} data-situacao="executado">
              <span className="pp-passo-t">{e.titulo || rotuloDeEvento(e.tipo)}</span>
              <span className="pp-apoio">{e.usuarioNome ?? "Sistema"} · {dataHora(e.ocorridoEm)}</span>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

function AbaInteligencia({ d }: { d: DetalheDoProspect }) {
  const i = d.inteligencia;
  return (
    <>
      <Secao titulo="Sinais">
        {i.sinais.length === 0 ? <p className="ov-nota">Nenhum sinal registrado ainda. Eles aparecem quando houver resposta, abordagem executada ou dado enriquecido.</p> : (
          <dl className="ov-campos">{i.sinais.map((s) => <Campo key={s.rotulo} rotulo={s.rotulo}>{s.valor}</Campo>)}</dl>
        )}
      </Secao>
      <Secao titulo="Dados a completar">
        {i.faltando.length === 0 ? <p className="ov-nota">Cadastro completo.</p> : <p className="ov-nota">{i.faltando.join(", ")}.</p>}
      </Secao>
      {i.empresa && (i.empresa.funcionarios || i.empresa.faturamento || i.empresa.tecnologias) ? (
        <Secao titulo="Empresa enriquecida">
          <dl className="ov-campos">
            <Campo rotulo="Funcionários">{i.empresa.funcionarios}</Campo>
            <Campo rotulo="Faturamento">{i.empresa.faturamento}</Campo>
            <Campo rotulo="Tecnologias">{i.empresa.tecnologias}</Campo>
          </dl>
        </Secao>
      ) : null}
    </>
  );
}
