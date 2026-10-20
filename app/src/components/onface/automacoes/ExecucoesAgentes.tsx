"use client";

/* Execuções dos agentes de IA: a visão "Agentes" da tela Execuções.
 *
 * Tudo vem de /api/automacoes/agentes-op/{indicadores,execucoes,execucoes/:id}, que calculam de
 * fatos persistidos (runs, passos, mensagens, reuniões). Quando um dado não existe a tela diz
 * "sem dados"; não estima nem inventa. */

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rotuloMotivo } from "@/components/onface/atendimento/agente-operacao";
import "./execucoes.css";

type Linha = {
  id: string; agenteId: string; agente: string; versao: number | null; status: string; modo: string;
  contatoId: string | null; leadId: string | null; contato: string | null; lead: string | null;
  evento: string | null; origem: string | null; tokens: number | null; custo: string | null; erro: string | null;
  bloqueio: string | null; handoff: string | null; inicio: string; fim: string | null; duracaoMs: number | null;
  ferramentas: string[]; mensagensEnviadas: number;
};
type Ferramenta = { sequencia: number; nome: string; status: string; entrada: unknown; resultado: unknown; erro: string | null; simulada: boolean; aguardaAprovacao: boolean; latenciaMs: number | null };
type Detalhe = {
  id: string; agente: string; agenteId: string; versao: number | null; status: string; modo: string; evento: string | null; mensagemRecebida: string | null;
  contatoId: string | null; leadId: string | null; tokensEntrada: number | null; tokensSaida: number | null; custo: string | null; erro: string | null; bloqueio: string | null;
  handoff: string | null; inicio: string; fim: string | null;
  contexto: { secoes: { id: string; titulo: string; itens: number; caracteres: number }[]; fontes: { tipo: string; ref: string; rotulo: string }[]; sinais: unknown; tokensAprox: number | null } | null;
  permissoes: { origem?: string; concedidas?: string[] } | null;
  autonomia: { mode?: string; porClasse?: Record<string, string>; mensagens?: string } | null;
  ferramentas: Ferramenta[];
  alertas: { id: string; title: string; severity: string; status: string }[];
  casos: { id: string }[];
  compromissos: { id: string; tipo: string; motivo: string; dueAt: string; status: string; bloqueioMotivo: string | null; origemRunId: string | null }[];
  mensagens: { id: string; conteudo: string | null; status: string | null; createdAt: string }[];
};
type Indicadores = {
  periodoDias: number; leadsTrabalhados: number; execucoes: number; falhas: number; tempoMedianoPrimeiraRespostaSeg: number | null;
  qualificacoesConcluidas: number; reunioesConfirmadas: number; handoffs: number; conversasSemProximaAcao: number;
  retomadasPendentes: number; retomadasBloqueadas: number; custoTotal: number; custoPorExecucao: number | null; custoPorResultado: number | null;
};

const STATUS: Record<string, [string, "ok" | "neutro" | "atencao" | "erro"]> = {
  completed: ["Concluída", "ok"], failed: ["Falhou", "erro"], aborted: ["Bloqueada ou abortada", "atencao"], handed_off: ["Passou para humano", "atencao"],
  running: ["Rodando", "neutro"], queued: ["Na fila", "neutro"], pending: ["Pendente", "neutro"],
};
const MODO: Record<string, string> = { live: "Produção", test: "Teste", dry_run: "Simulação" };
const AUTONOMIA: Record<string, string> = { suggest: "Copiloto", approval: "Com aprovação", autonomous: "Autônomo" };
const CLASSE: Record<string, string> = { leitura: "Leitura", mensagens: "Mensagens", crm: "CRM", agenda: "Agenda", comercial: "Comercial" };
const COMPROMISSO: Record<string, string> = { pendente: "Pendente", processando: "Processando", concluido: "Concluído", cancelado: "Cancelado", bloqueado: "Bloqueado", falhou: "Falhou", expirado: "Expirado" };

const dataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const num = (n: number | null | undefined) => (n == null ? "sem dados" : n.toLocaleString("pt-BR"));
const brl = (n: number | null | undefined) => (n == null ? "sem dados" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 }));
const seg = (s: number | null) => (s == null ? "sem dados" : s < 90 ? `${s} s` : `${Math.round(s / 60)} min`);
const dur = (ms: number | null) => (ms == null ? "sem dados" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);

async function pegar<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || j?.message || "Não foi possível carregar");
  return j as T;
}

function Selo({ status }: { status: string }) {
  const [rotulo, tom] = STATUS[status] ?? [status, "neutro" as const];
  return <span className="exe-selo" data-tom={tom}>{rotulo}</span>;
}

function Indicador({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <div className="exa-kpi" data-alerta={alerta ? "true" : undefined}>
      <span>{rotulo}</span>
      <strong data-vazio={valor === "sem dados" ? "true" : undefined}>{valor}</strong>
      {detalhe ? <em>{detalhe}</em> : null}
    </div>
  );
}

function Faixa({ agenteId }: { agenteId: string }) {
  const [d, setD] = React.useState<Indicadores | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [tentativa, setTentativa] = React.useState(0);
  React.useEffect(() => {
    let vivo = true;
    setD(null); setErro(null);
    pegar<Indicadores>(`/api/automacoes/agentes-op/indicadores?dias=30${agenteId ? `&agentId=${agenteId}` : ""}`)
      .then((x) => vivo && setD(x)).catch((e: Error) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [agenteId, tentativa]);

  if (erro) return <p className="exa-erro" role="alert">Não foi possível carregar os indicadores: {erro} <button type="button" className="exe-btn" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button></p>;
  if (!d) return <div className="exa-faixa" aria-busy="true" aria-label="Carregando indicadores">{Array.from({ length: 6 }, (_, i) => <div key={i} className="exa-kpi exa-esqueleto" />)}</div>;
  const semExecucao = d.execucoes === 0;
  return (
    <section aria-label={`Indicadores dos últimos ${d.periodoDias} dias, execuções em produção`}>
      <div className="exa-faixa">
        <Indicador rotulo="Leads trabalhados" valor={num(d.leadsTrabalhados)} detalhe={`${num(d.execucoes)} execuções em produção`} />
        <Indicador rotulo="Primeira resposta (mediana)" valor={seg(d.tempoMedianoPrimeiraRespostaSeg)} detalhe={d.tempoMedianoPrimeiraRespostaSeg == null ? "nenhuma resposta enviada" : undefined} />
        <Indicador rotulo="Qualificações" valor={semExecucao ? "sem dados" : num(d.qualificacoesConcluidas)} />
        <Indicador rotulo="Reuniões confirmadas" valor={semExecucao ? "sem dados" : num(d.reunioesConfirmadas)} />
        <Indicador rotulo="Passou para humano" valor={semExecucao ? "sem dados" : num(d.handoffs)} />
        <Indicador rotulo="Falhas" valor={semExecucao ? "sem dados" : num(d.falhas)} alerta={d.falhas > 0} />
        <Indicador rotulo="Conversas sem próxima ação" valor={num(d.conversasSemProximaAcao)} detalhe="ativas, paradas há mais de 24 h" alerta={d.conversasSemProximaAcao > 0} />
        <Indicador rotulo="Retomadas pendentes" valor={num(d.retomadasPendentes)} />
        <Indicador rotulo="Retomadas bloqueadas" valor={num(d.retomadasBloqueadas)} alerta={d.retomadasBloqueadas > 0} />
        <Indicador rotulo="Custo por execução" valor={brl(d.custoPorExecucao)} detalhe={`total ${brl(d.custoTotal)}`} />
        <Indicador rotulo="Custo por resultado" valor={brl(d.custoPorResultado)} detalhe={d.custoPorResultado == null ? "sem qualificação ou reunião no período" : "qualificação ou reunião"} />
      </div>
    </section>
  );
}

function Json({ v }: { v: unknown }) {
  if (v == null) return <span className="exa-fraco">sem dados</span>;
  return <pre className="exe-json">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</pre>;
}

function proximoPasso(d: Detalhe): string {
  if (d.handoff) return `Passa o atendimento para uma pessoa: ${d.handoff}`;
  const c = d.compromissos.find((x) => x.origemRunId === d.id && (x.status === "pendente" || x.status === "bloqueado"));
  if (c) return c.status === "bloqueado" ? `Retomada bloqueada: ${c.bloqueioMotivo ?? c.motivo}` : `Retomada em ${dataHora.format(new Date(c.dueAt))}: ${c.motivo}`;
  if (d.ferramentas.some((f) => f.aguardaAprovacao)) return "Aguardando aprovação de uma pessoa";
  return "Nenhuma próxima ação registrada por esta execução";
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="exa-secao"><h3>{titulo}</h3>{children}</section>;
}

function Gaveta({ id, onClose, voltarFoco }: { id: string | null; onClose: () => void; voltarFoco: () => void }) {
  const [d, setD] = React.useState<Detalhe | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [tentativa, setTentativa] = React.useState(0);
  React.useEffect(() => {
    if (!id) return;
    let vivo = true;
    setD(null); setErro(null);
    pegar<Detalhe>(`/api/automacoes/agentes-op/execucoes/${id}`).then((x) => vivo && setD(x)).catch((e: Error) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [id, tentativa]);

  const criados = d?.compromissos.filter((c) => c.origemRunId === d.id) ?? [];
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="exa-gaveta" onCloseAutoFocus={(e) => { e.preventDefault(); voltarFoco(); }}>
        <SheetHeader>
          <SheetTitle>{d ? `${d.agente}${d.versao ? ` · v${d.versao}` : ""}` : "Execução do agente"}</SheetTitle>
          <SheetDescription>{d ? `${dataHora.format(new Date(d.inicio))} · ${MODO[d.modo] ?? d.modo}` : "Detalhe da execução"}</SheetDescription>
        </SheetHeader>
        <div className="exa-gaveta-corpo">
          {erro ? <p className="exa-erro" role="alert">{erro} <button type="button" className="exe-btn" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button></p> : null}
          {!d && !erro ? <p className="exa-fraco" aria-busy="true">Carregando a execução…</p> : null}
          {d ? (
            <>
              <div className="exa-resumo">
                <Selo status={d.status} />
                <dl>
                  <div><dt>Duração</dt><dd>{dur(d.fim ? new Date(d.fim).getTime() - new Date(d.inicio).getTime() : null)}</dd></div>
                  <div><dt>Tokens</dt><dd>{d.tokensEntrada == null && d.tokensSaida == null ? "sem dados" : `${num(d.tokensEntrada ?? 0)} entrada · ${num(d.tokensSaida ?? 0)} saída`}</dd></div>
                  <div><dt>Custo</dt><dd>{d.custo == null ? "sem dados" : brl(Number(d.custo))}</dd></div>
                  <div><dt>Gatilho</dt><dd>{d.evento ?? "sem dados"}</dd></div>
                  <div><dt>Registro</dt><dd>{d.leadId ? <a href={`/atendimento?leadId=${d.leadId}`}>Abrir a conversa do lead</a> : d.contatoId ? "Contato sem lead vinculado" : "sem registro vinculado"}</dd></div>
                </dl>
              </div>

              {d.erro ? <p className="exe-erro" data-tom="erro"><strong>Erro.</strong> {d.erro}</p> : null}
              {d.bloqueio ? <p className="exe-erro" data-tom="atencao"><strong>Bloqueio.</strong> {d.bloqueio}</p> : null}
              {d.handoff ? <p className="exe-erro" data-tom="atencao"><strong>Handoff.</strong> {d.handoff}</p> : null}

              <Secao titulo="Próximo passo"><p>{proximoPasso(d)}</p></Secao>

              <Secao titulo="Mensagem recebida">{d.mensagemRecebida ? <p className="exa-citacao">{d.mensagemRecebida}</p> : <span className="exa-fraco">sem dados</span>}</Secao>

              <Secao titulo="Contexto consultado e fontes">
                {d.contexto ? (
                  <>
                    <ul className="exa-lista">
                      {d.contexto.secoes.map((s) => <li key={s.id}><strong>{s.titulo}</strong><span>{s.itens} {s.itens === 1 ? "item" : "itens"} · {num(s.caracteres)} caracteres</span></li>)}
                    </ul>
                    {d.contexto.fontes.length > 0 ? (
                      <ul className="exa-fontes" aria-label="Fontes">{d.contexto.fontes.map((f) => <li key={`${f.tipo}-${f.ref}`} title={f.ref}><b>{f.tipo}</b> {f.rotulo}</li>)}</ul>
                    ) : <span className="exa-fraco">Nenhuma fonte registrada.</span>}
                    {d.contexto.tokensAprox != null ? <span className="exa-fraco">Contexto de cerca de {num(d.contexto.tokensAprox)} tokens.</span> : null}
                  </>
                ) : <span className="exa-fraco">sem dados: esta execução não registrou o contexto consultado.</span>}
              </Secao>

              <Secao titulo={`Ferramentas (${d.ferramentas.length})`}>
                {d.ferramentas.length === 0 ? <span className="exa-fraco">Nenhuma ferramenta chamada.</span> : d.ferramentas.map((f) => (
                  <details key={f.sequencia} className="exa-ferr">
                    <summary>
                      <code>{f.nome}</code>
                      {f.simulada ? <span className="exe-selo" data-tom="atencao">Simulada</span> : null}
                      {f.aguardaAprovacao ? <span className="exe-selo" data-tom="atencao">Aguarda aprovação</span> : null}
                      {f.erro ? <span className="exe-selo" data-tom="erro">Erro</span> : <span className="exe-selo" data-tom={f.status === "completed" ? "ok" : "neutro"}>{f.status === "completed" ? "Concluída" : f.status}</span>}
                      <span className="exa-fraco">{dur(f.latenciaMs)}</span>
                    </summary>
                    {f.erro ? <p className="exe-erro" data-tom="erro">{f.erro}</p> : null}
                    <span className="exa-rotulo">Entrada</span><Json v={f.entrada} />
                    <span className="exa-rotulo">Resultado</span><Json v={f.resultado} />
                  </details>
                ))}
              </Secao>

              <Secao titulo="Permissões e autonomia aplicadas">
                {d.autonomia || d.permissoes ? (
                  <>
                    {d.autonomia ? (
                      <p>Modo geral: <strong>{AUTONOMIA[d.autonomia.mode ?? ""] ?? "sem dados"}</strong>
                        {d.autonomia.porClasse && Object.keys(d.autonomia.porClasse).length > 0 ? ` · ${Object.entries(d.autonomia.porClasse).map(([c, m]) => `${CLASSE[c] ?? c}: ${AUTONOMIA[m] ?? m}`).join(", ")}` : ""}</p>
                    ) : null}
                    {d.permissoes ? (
                      <p>Permissões ({d.permissoes.origem ?? "origem não registrada"}): {d.permissoes.concedidas?.length ? <code>{d.permissoes.concedidas.join(", ")}</code> : "nenhuma concedida"}</p>
                    ) : null}
                  </>
                ) : <span className="exa-fraco">sem dados: execução anterior ao registro de permissões.</span>}
              </Secao>

              <Secao titulo={`Mensagens enviadas (${d.mensagens.length})`}>
                {d.mensagens.length === 0 ? <span className="exa-fraco">Nenhuma mensagem saiu desta execução.</span> : d.mensagens.map((m) => (
                  <p key={m.id} className="exa-citacao">{m.conteudo ?? "(sem texto)"}<em>{m.status ?? ""} · {dataHora.format(new Date(m.createdAt))}</em></p>
                ))}
              </Secao>

              <Secao titulo={`Compromissos criados (${criados.length})`}>
                {criados.length === 0 ? <span className="exa-fraco">Nenhuma retomada criada.</span> : (
                  <ul className="exa-lista">{criados.map((c) => <li key={c.id}><strong>{c.tipo}: {c.motivo}</strong><span>{COMPROMISSO[c.status] ?? c.status} · para {dataHora.format(new Date(c.dueAt))}{c.bloqueioMotivo ? ` · ${c.bloqueioMotivo}` : ""}</span></li>)}</ul>
                )}
              </Secao>

              {d.alertas.length > 0 ? (
                <Secao titulo="Alertas"><ul className="exa-lista">{d.alertas.map((a) => <li key={a.id}><strong>{a.title}</strong><span>{a.severity} · {a.status}</span></li>)}</ul></Secao>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Fila da equipe: atendimentos que esperam uma pessoa ─────────────────
 * Lê /agentes-op/atribuicoes com os dois estados que pedem gente: "aguardando_aprovacao"
 * (o agente preparou e espera decisão) e "humano" (a conversa está com uma pessoa). A decisão
 * acontece na conversa (Atendimento, painel do agente); aqui o gestor vê o tamanho e quem é. */
type Atribuicao = {
  id: string; status: string; agente: string; lead: string | null; contato: string | null; leadId: string | null;
  objetivo: string | null; motivoEstado: string | null; updatedAt: string;
};
const FILAS: Record<string, [string, "atencao" | "neutro"]> = { aguardando_aprovacao: ["Aguardando aprovação", "atencao"], humano: ["Com humano", "neutro"] };

function FilaDaEquipe({ agenteId }: { agenteId: string }) {
  const [linhas, setLinhas] = React.useState<Atribuicao[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [filtro, setFiltro] = React.useState<"" | "aguardando_aprovacao" | "humano">("");
  const [aberta, setAberta] = React.useState(false);
  const [tentativa, setTentativa] = React.useState(0);
  React.useEffect(() => {
    let vivo = true;
    setLinhas(null); setErro(null);
    const p = new URLSearchParams({ status: "aguardando_aprovacao,humano" });
    if (agenteId) p.set("agentId", agenteId);
    pegar<{ atribuicoes: Atribuicao[] }>(`/api/automacoes/agentes-op/atribuicoes?${p}`)
      .then((r) => vivo && setLinhas(r.atribuicoes)).catch((e: Error) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [agenteId, tentativa]);

  if (erro) return <p className="exa-erro" role="alert">Não foi possível carregar a fila da equipe: {erro} <button type="button" className="exe-btn" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button></p>;
  const n = (st: string) => (linhas ?? []).filter((l) => l.status === st).length;
  const visiveis = (linhas ?? []).filter((l) => !filtro || l.status === filtro);
  const escolher = (f: typeof filtro) => { setFiltro(f); setAberta(true); };
  return (
    <section className="exa-fila" aria-label="Fila da equipe">
      <div className="exa-fila-topo">
        <h3>Fila da equipe</h3>
        <div className="exe-chips" role="group" aria-label="Filtrar a fila">
          {linhas === null ? <span className="exa-fraco" aria-busy="true">Carregando…</span> : (
            <>
              <button type="button" className="exe-chip exa-fila-chip" aria-current={aberta && filtro === "aguardando_aprovacao" ? "true" : undefined} onClick={() => escolher("aguardando_aprovacao")}>Aguardando aprovação · {n("aguardando_aprovacao").toLocaleString("pt-BR")}</button>
              <button type="button" className="exe-chip exa-fila-chip" aria-current={aberta && filtro === "humano" ? "true" : undefined} onClick={() => escolher("humano")}>Com humano · {n("humano").toLocaleString("pt-BR")}</button>
              {aberta ? <button type="button" className="exe-btn" onClick={() => setAberta(false)}>Recolher</button> : null}
            </>
          )}
        </div>
      </div>
      {aberta && linhas ? (
        visiveis.length === 0 ? (
          <p className="exa-fraco">{filtro === "humano" ? "Nenhum atendimento está com uma pessoa agora." : "Nada aguardando aprovação agora."}</p>
        ) : (
          <ul className="exa-lista exa-fila-lista">
            {visiveis.map((l) => {
              const [rotulo, tom] = FILAS[l.status] ?? [l.status, "neutro" as const];
              const motivo = rotuloMotivo(l.motivoEstado);
              return (
                <li key={l.id}>
                  <strong>{l.leadId ? <a href={`/atendimento?leadId=${l.leadId}`}>{l.lead ?? l.contato ?? "Sem nome"}</a> : l.lead ?? l.contato ?? "Sem nome"}</strong>
                  <span><span className="exe-selo" data-tom={tom}>{rotulo}</span> {l.agente}{motivo ? ` · ${motivo}` : ""} · desde {dataHora.format(new Date(l.updatedAt))}</span>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}

const LIMITE = 50;

export function ExecucoesAgentes({ agentes, agenteInicial, execInicial }: { agentes: { id: string; nome: string }[]; agenteInicial: string; execInicial: string | null }) {
  const [agente, setAgente] = React.useState(agenteInicial);
  const [status, setStatus] = React.useState("");
  const [modo, setModo] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [linhas, setLinhas] = React.useState<Linha[] | null>(null);
  const [mais, setMais] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = React.useState(false);
  const [tentativa, setTentativa] = React.useState(0);
  const [aberta, setAberta] = React.useState<string | null>(execInicial);
  const ultimoFoco = React.useRef<HTMLElement | null>(null);

  const qs = React.useCallback((antesDe?: string) => {
    const p = new URLSearchParams({ limite: String(LIMITE) });
    if (agente) p.set("agentId", agente);
    if (status) p.set("status", status);
    if (modo) p.set("modo", modo);
    if (antesDe) p.set("antesDe", antesDe);
    return p.toString();
  }, [agente, status, modo]);

  React.useEffect(() => {
    let vivo = true;
    setLinhas(null); setErro(null);
    pegar<{ execucoes: Linha[] }>(`/api/automacoes/agentes-op/execucoes?${qs()}`)
      .then((r) => { if (vivo) { setLinhas(r.execucoes); setMais(r.execucoes.length >= LIMITE); } })
      .catch((e: Error) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [qs, tentativa]);

  async function carregarMais() {
    if (!linhas?.length) return;
    setCarregandoMais(true);
    try {
      const r = await pegar<{ execucoes: Linha[] }>(`/api/automacoes/agentes-op/execucoes?${qs(linhas[linhas.length - 1].inicio)}`);
      setLinhas([...linhas, ...r.execucoes]); setMais(r.execucoes.length >= LIMITE);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar mais"); }
    setCarregandoMais(false);
  }

  const q = busca.trim().toLowerCase();
  const visiveis = (linhas ?? []).filter((l) => !q || `${l.contato ?? ""} ${l.lead ?? ""}`.toLowerCase().includes(q));
  const filtrando = !!(agente || status || modo || q);

  return (
    <div className="exa">
      <Faixa agenteId={agente} />
      <FilaDaEquipe agenteId={agente} />

      <form className="exa-filtros" role="search" aria-label="Filtrar execuções de agentes" onSubmit={(e) => e.preventDefault()}>
        <label>Agente
          <select value={agente} onChange={(e) => setAgente(e.target.value)}>
            <option value="">Todos</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([id, [r]]) => <option key={id} value={id}>{r}</option>)}
          </select>
        </label>
        <label>Modo
          <select value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(MODO).map(([id, r]) => <option key={id} value={id}>{r}</option>)}
          </select>
        </label>
        <label className="exa-busca">Contato ou lead
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome na lista carregada" />
        </label>
        {filtrando ? <button type="button" className="exe-btn" onClick={() => { setAgente(""); setStatus(""); setModo(""); setBusca(""); }}>Limpar filtros</button> : null}
      </form>

      {erro ? (
        <div className="exe-vazio" role="alert">
          <strong>Não foi possível carregar as execuções</strong>
          <span>{erro}</span>
          <button type="button" className="exe-btn" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button>
        </div>
      ) : linhas === null ? (
        <div className="exa-lista-esqueleto" aria-busy="true" aria-label="Carregando execuções">{Array.from({ length: 6 }, (_, i) => <div key={i} className="exa-esqueleto" />)}</div>
      ) : visiveis.length === 0 ? (
        <div className="exe-vazio">
          <strong>{filtrando ? "Nenhuma execução neste recorte" : "Nenhum agente executou ainda"}</strong>
          <span>{filtrando ? "Ajuste ou limpe os filtros." : "Quando um agente atender um contato, passar por teste ou for acionado por um fluxo, cada execução aparece aqui, com fontes, ferramentas e custo."}</span>
        </div>
      ) : (
        <ol className="exe-lista">
          <li className="exe-cab exa-cab" aria-hidden="true"><span>Agente</span><span>Contato ou lead</span><span>Status</span><span>Modo</span><span>Quando</span></li>
          {visiveis.map((l) => (
            <li key={l.id}>
              <button type="button" className="exe-linha exa-linha" onClick={(e) => { ultimoFoco.current = e.currentTarget; setAberta(l.id); }}>
                <span className="exe-nome">
                  <strong>{l.agente}{l.versao ? ` · v${l.versao}` : ""}</strong>
                  <span className="exe-detalhe">{l.erro ?? l.bloqueio ?? l.handoff ?? (l.evento ? `Gatilho: ${l.evento}` : "Sem gatilho registrado")}</span>
                </span>
                <span className="exe-entidade">{l.lead ?? l.contato ?? "Sem registro"}</span>
                <span><Selo status={l.status} /></span>
                <span className="exa-modo">{MODO[l.modo] ?? l.modo}</span>
                <time dateTime={l.inicio} className="exe-quando">{dataHora.format(new Date(l.inicio))}</time>
              </button>
            </li>
          ))}
        </ol>
      )}
      {mais && !erro ? <button type="button" className="exe-btn exa-mais" disabled={carregandoMais} onClick={carregarMais}>{carregandoMais ? "Carregando…" : `Carregar mais ${LIMITE}`}</button> : null}
      {linhas && !mais && linhas.length >= LIMITE ? <p className="exe-rodape">Fim da lista: {linhas.length} execuções carregadas.</p> : null}

      <Gaveta id={aberta} onClose={() => setAberta(null)} voltarFoco={() => ultimoFoco.current?.focus()} />
    </div>
  );
}
