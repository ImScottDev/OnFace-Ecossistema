"use client";

/* Abas do editor do agente que leem e escrevem direto nas rotas de operação
 * (/api/automacoes/agentes-op/* e /api/automacoes/agentes/:id/*): Ferramentas,
 * Gatilhos e atribuição, Testes e versões, Execuções. O formulário da versão
 * (identidade, autonomia, canais...) continua no AgenteEditor; aqui só entra o
 * que depende de dado vivo do servidor.
 *
 * Nenhuma regra mora aqui: disponibilidade, permissão e efeitos vêm do
 * catálogo do servidor; simulação, comparação e rollback são as rotas. A tela
 * só mostra o que elas devolvem, inclusive o erro quando não há provedor. */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, CircleAlert, Loader2, Lock, Play, Plus, RotateCcw, Send, ShieldCheck, Workflow } from "lucide-react";
import { AGENT_EVENT_CATALOG } from "@/lib/ai/agent-studio";
import type { VersaoDoEditor } from "@/lib/automacoes/agente-detalhe";
import { Aviso, Interruptor, Secao, api, num, quando, useApi } from "./agente-pecas";
import { rotuloMotivo } from "@/components/onface/atendimento/agente-operacao";

const BASE = "/api/automacoes/agentes-op";
const DOMINIOS = ["Leitura", "Atendimento", "Comercial", "Atividades", "Calendário", "Cadências", "Integrações"] as const;
const DOMINIO_AJUDA: Record<string, string> = {
  Leitura: "Consultas. Não alteram nada.", Atendimento: "Conversa, retomadas, handoff e memória.", Comercial: "Lead e oportunidade.",
  Atividades: "Notas e tarefas.", Calendário: "Horários e reuniões reais.", Cadências: "Cadência do time. Opcional: o agente não depende dela.", Integrações: "Sistemas externos.",
};
const STATUS_VERSAO: Record<string, string> = { draft: "Rascunho", published: "No ar", superseded: "Substituída" };
const STATUS_ATRIB: Record<string, string> = { ativa: "Conduzindo", pausada: "Pausada", aguardando_aprovacao: "Aguardando aprovação", humano: "Com humano", falha: "Falhou" };
const RUN_STATUS: Record<string, string> = { completed: "Concluída", failed: "Falhou", running: "Rodando", queued: "Na fila", handed_off: "Passou para humano", aborted: "Abortada", blocked: "Bloqueada" };
const MODO_RUN: Record<string, string> = { live: "Real", test: "Simulação", dry_run: "Simulação" };

interface Ferramenta {
  id: string; nome: string; descricao: string; modo: "leitura" | "acao"; dominio: string; classe: string; classeRotulo: string;
  entidades: string[]; permissao: string | null; efeitos: string; exigeConfirmacao: boolean; resultado: string;
  disponibilidade: { estado: "disponivel" | "bloqueado"; motivo: string | null };
}

const json = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v, null, 1));
const curto = (v: unknown, n = 160) => { const t = json(v).replace(/\s+/g, " "); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/* ── D. Ferramentas e permissões ──────────────────────────────────── */

export function AbaFerramentas({ tools, onToggle, travado, ferramentasLegadas, permissoes }: {
  tools: string[]; onToggle: (id: string, ligar: boolean) => void; travado: boolean; ferramentasLegadas: number; permissoes: string[];
}) {
  const { dados, erro, carregando } = useApi<{ ferramentas: Ferramenta[] }>(`${BASE}/ferramentas`);
  const lista = dados?.ferramentas ?? [];
  return (
    <>
      {ferramentasLegadas ? (
        <div className="age-faltas" role="status">
          <CircleAlert size={14} />
          <span><strong>{ferramentasLegadas} {ferramentasLegadas === 1 ? "ação estava gravada" : "ações estavam gravadas"} num formato que o runtime não reconhece</strong>, e por isso não funcionavam. Elas aparecem ligadas abaixo; salve o rascunho para valerem.</span>
        </div>
      ) : null}
      {carregando ? <Aviso><Loader2 size={13} className="age-gira" /> Carregando o catálogo de ferramentas…</Aviso> : null}
      {erro ? <Aviso tom="alerta">Não foi possível carregar o catálogo: {erro}</Aviso> : null}
      {dados ? (
        <>
          <p className="age-texto-fraco">
            <strong>{tools.length} de {lista.length} ligadas.</strong> Ligar é decidir que o agente pode pedir a ferramenta; quem manda é a autonomia (aba Autonomia) e a permissão exigida.
            {" "}Bloqueada = a dependência não existe neste ambiente: ela até pode ser ligada, mas o runtime recusa até resolver.
          </p>
          {DOMINIOS.map((d) => {
            const doDominio = lista.filter((t) => t.dominio === d);
            if (!doDominio.length) return null;
            return (
              <Secao key={d} titulo={d} ajuda={DOMINIO_AJUDA[d]}>
                {doDominio.map((t) => {
                  const on = tools.includes(t.id);
                  const bloq = t.disponibilidade.estado === "bloqueado";
                  return (
                    <div key={t.id} className="age-tool2" data-on={on ? "true" : undefined}>
                      <div className="age-tool">
                        <div>
                          <strong>
                            {t.nome} <em data-tipo={t.modo}>{t.modo === "leitura" ? "Leitura" : "Ação"}</em>
                            <em>{t.classeRotulo}</em>
                            {bloq ? <span className="agn-selo" data-tom="alerta"><Lock size={10} />Bloqueada</span> : null}
                            {t.exigeConfirmacao ? <span className="agn-selo"><ShieldCheck size={10} />Pode pedir confirmação</span> : null}
                          </strong>
                          <span>{t.descricao}</span>
                          {bloq ? <span className="age-bloqueio">{t.disponibilidade.motivo}</span> : null}
                        </div>
                        <Interruptor ligado={on} rotulo={t.nome} desligado={travado} onChange={(v) => onToggle(t.id, v)} />
                      </div>
                      <details className="age-tool-det">
                        <summary>Detalhes</summary>
                        <dl>
                          <div><dt>O que faz</dt><dd>{t.descricao}</dd></div>
                          <div><dt>Entidades afetadas</dt><dd>{t.entidades.length ? t.entidades.join(", ") : "Nenhuma"}</dd></div>
                          <div><dt>Permissão exigida</dt><dd>{t.permissao ? <code>{t.permissao}</code> : "Nenhuma (leitura ou ação sem escrita)"}</dd></div>
                          <div><dt>Efeitos colaterais</dt><dd>{t.efeitos}</dd></div>
                          <div><dt>Exige confirmação</dt><dd>{t.exigeConfirmacao ? `Sim, quando a classe ${t.classeRotulo} está sob aprovação` : "Não"}</dd></div>
                          <div><dt>Disponibilidade</dt><dd>{bloq ? `Bloqueada: ${t.disponibilidade.motivo}` : "Disponível neste ambiente"}</dd></div>
                          <div><dt>Resultado esperado</dt><dd>{t.resultado}</dd></div>
                        </dl>
                      </details>
                    </div>
                  );
                })}
              </Secao>
            );
          })}
        </>
      ) : null}
      <Secao titulo="Teto de permissões" ajuda="Autonomia nunca concede permissão: o agente só altera dados dentro destas permissões, e a ferramenta ainda exige a dela. Sem nenhuma, fica só na leitura.">
        {permissoes.length ? (
          <div className="age-chips">{permissoes.map((p) => <span key={p} className="age-chip age-chip-mono">{p}</span>)}</div>
        ) : (
          <p className="age-texto-fraco">Esta versão não tem permissões delegadas: ações que alteram dados são recusadas pelo runtime.</p>
        )}
      </Secao>
    </>
  );
}

/* ── G. Gatilhos e atribuição ─────────────────────────────────────── */

interface Gatilhos {
  fluxos: { id: string; nome: string; ativo: boolean; evento: string | null; nos: string | null }[];
  eventos: string[];
  atribuicoes: { id: string; status: string; objetivo: string | null; motivoEstado: string | null; lead: string | null; leadId: string | null; contato: string | null; updatedAt: string; humano: string | null }[];
}

export function AbaGatilhos({ agenteId, events, onToggleEvento, prioridade, onPrioridade, travado }: {
  agenteId: string; events: string[]; onToggleEvento: (id: string) => void; prioridade: number; onPrioridade: (n: number) => void; travado: boolean;
}) {
  const router = useRouter();
  const { dados, erro, carregando } = useApi<Gatilhos>(`/api/automacoes/agentes/${agenteId}/gatilhos`);
  const [criando, setCriando] = React.useState(false);
  const [fila, setFila] = React.useState<"" | "aguardando_aprovacao" | "humano">("");

  async function criarFluxo() {
    setCriando(true);
    try {
      const f = await api(`/api/automacoes/agentes/${agenteId}/fluxo-padrao`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Fluxo de entrada criado em rascunho. Abrindo o construtor.");
      router.push(`/automacoes/fluxos/${f.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o fluxo.");
      setCriando(false);
    }
  }

  return (
    <>
      <Secao titulo="Eventos do agente" ajuda="Em produção, o agente publicado responde por conta própria só a estes eventos. Fluxos e pessoas também podem acioná-lo (abaixo).">
        <div className="age-eventos">
          {AGENT_EVENT_CATALOG.map((ev) => {
            const on = events.includes(ev.id);
            return (
              <button key={ev.id} type="button" className="age-evento" aria-pressed={on} disabled={travado} onClick={() => onToggleEvento(ev.id)}>
                <span className="age-check">{on ? <Check size={11} strokeWidth={3} /> : null}</span>
                <span><strong>{ev.nome}</strong><span>{ev.descricao}</span></span>
              </button>
            );
          })}
        </div>
        <div className="age-form" style={{ marginTop: 14, maxWidth: 260 }}>
          <label>Prioridade<input type="number" min={0} max={10000} value={prioridade} disabled={travado} onChange={(e) => onPrioridade(Math.min(10000, Math.max(0, Number(e.target.value) || 0)))} /></label>
          <span className="age-texto-fraco">Dois agentes publicados no mesmo evento: vence o de maior prioridade.</span>
        </div>
      </Secao>

      <Secao titulo="Fluxos que usam este agente" ajuda="O agente é acionado por fluxo com os nós Agente: atribuir e Agente: acionar. O desenho fica no construtor de fluxos; aqui só se vê quem o usa."
        direita={<button type="button" className="agn-primario" onClick={criarFluxo} disabled={criando}>{criando ? <Loader2 size={14} className="age-gira" /> : <Workflow size={14} />} Criar fluxo de entrada</button>}>
        {carregando ? <Aviso><Loader2 size={13} className="age-gira" /> Carregando…</Aviso> : null}
        {erro ? <Aviso tom="alerta">Não foi possível carregar os fluxos: {erro}</Aviso> : null}
        {dados && dados.fluxos.length === 0 ? (
          <div className="age-vazio"><strong>Nenhum fluxo publicado usa este agente</strong><span>Em &ldquo;Criar fluxo de entrada&rdquo;, o ONFACE monta no construtor o caminho lead novo, atribuir ao agente e acionar. Ele nasce em rascunho: você revisa e publica lá.</span></div>
        ) : null}
        {dados && dados.fluxos.length ? (
          <ul className="age-fontes">
            {dados.fluxos.map((f) => (
              <li key={f.id}>
                <strong><Link href={`/automacoes/fluxos/${f.id}`}>{f.nome}</Link></strong>
                <span>{f.evento ? `Evento ${f.evento}` : "Gatilho manual ou agendado"}{f.nos ? ` · ${f.nos}` : ""}</span>
                <span className="agn-selo" data-tom={f.ativo ? "ok" : undefined}><i />{f.ativo ? "Ativo" : "Inativo"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      <Secao titulo="Atribuições vivas" ajuda="Atendimentos que este agente conduz agora. A atribuição é o que o torna responsável pela conversa; quem quiser pausar ou transferir faz isso no Atendimento.">
        {dados && dados.atribuicoes.length ? (
          <div className="age-chips" role="group" aria-label="Filtrar atribuições" style={{ marginBottom: 10 }}>
            {([["", "Todas", dados.atribuicoes.length], ["aguardando_aprovacao", "Aguardando aprovação", dados.atribuicoes.filter((a) => a.status === "aguardando_aprovacao").length], ["humano", "Com humano", dados.atribuicoes.filter((a) => a.status === "humano").length]] as const).map(([v, r, n]) => (
              <button key={v || "todas"} type="button" className="age-chip age-chip-botao" aria-pressed={fila === v} onClick={() => setFila(v)}>{r} · {num(n)}</button>
            ))}
          </div>
        ) : null}
        {dados && dados.atribuicoes.length > 0 && fila && !dados.atribuicoes.some((a) => a.status === fila) ? (
          <p className="age-texto-fraco">{fila === "humano" ? "Nenhum atendimento deste agente está com uma pessoa agora." : "Nada aguardando aprovação neste agente."}</p>
        ) : null}
        {dados && dados.atribuicoes.length === 0 ? (
          <div className="age-vazio"><strong>Nenhuma atribuição neste momento</strong><span>Quando um fluxo ou uma pessoa atribuir uma conversa ou lead a este agente, ela aparece aqui.</span></div>
        ) : null}
        {dados && dados.atribuicoes.length ? (
          <ul className="age-fontes">
            {dados.atribuicoes.filter((a) => !fila || a.status === fila).map((a) => (
              <li key={a.id}>
                <strong>{a.leadId ? <Link href={`/atendimento?leadId=${a.leadId}`}>{a.lead ?? a.contato ?? "Sem nome"}</Link> : a.lead ?? a.contato ?? "Sem nome"}</strong>
                <span>{(a.status === "humano" || a.status === "pausada" ? rotuloMotivo(a.motivoEstado) : null) ?? a.objetivo ?? rotuloMotivo(a.motivoEstado) ?? "Sem objetivo informado"} · {quando(a.updatedAt)}</span>
                <span className="agn-selo" data-tom={a.status === "ativa" ? "ok" : a.status === "falha" || a.status === "aguardando_aprovacao" ? "alerta" : undefined}><i />{a.status === "humano" && a.humano ? `Com humano: ${a.humano}` : STATUS_ATRIB[a.status] ?? a.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>
    </>
  );
}

/* ── I. Testes e versões ──────────────────────────────────────────── */

interface Resultado {
  modoExecucao: "simulacao" | "integrado"; rotulo: string; enviouMensagem: boolean; resposta: string | null; respostaRotulo: string; handoff: unknown; runId: string; status: string;
  tokens: { entrada: number; saida: number }; custo: number | string | null;
  contexto: { secoes: unknown[]; fontes: { tipo?: string; rotulo?: string; ref?: string }[]; sinais: unknown; tokensAprox: number | null } | null;
  ferramentas: { sequencia: number; nome: string; status: string; entrada: unknown; resultado: unknown; erro: string | null; simulada: boolean; aguardaAprovacao: boolean }[];
  permissoes: unknown; autonomia: unknown; erros: { ferramenta: string; erro: string }[]; proximoPasso: string;
}

type ModoTeste = "simulacao" | "integrado";

export function AbaTestes({ agenteId, versoes, trabalho, rascunho, publicada, podeUsar, podeConfigurar, sujo, salvar, publicar, publicando, faltas, credencialOk, onCarregar }: {
  agenteId: string; versoes: VersaoDoEditor[]; trabalho: VersaoDoEditor; rascunho: VersaoDoEditor | null; publicada: VersaoDoEditor | null;
  podeUsar: boolean; podeConfigurar: boolean; sujo: boolean; salvar: () => Promise<string | null>; publicar: () => void; publicando: boolean;
  faltas: string[]; credencialOk: boolean; onCarregar: (v: VersaoDoEditor) => void;
}) {
  const [modo, setModo] = React.useState<ModoTeste>("simulacao");
  const [versionId, setVersionId] = React.useState(trabalho.id);
  const [alvo, setAlvo] = React.useState<"lead_teste" | "conversa">("lead_teste");
  const [leadSel, setLeadSel] = React.useState("");
  const [convSel, setConvSel] = React.useState("");
  const [evento, setEvento] = React.useState("conversation.message_received");
  const [mensagem, setMensagem] = React.useState("");
  const [rodando, setRodando] = React.useState(false);
  const [resultado, setResultado] = React.useState<Resultado | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  const leads = useApi<{ leads: { lead_id: string; contato_id: string | null; nome: string }[] }>(`${BASE}/teste/leads`);
  const conversas = useApi<{ conversas: { id: string; tipo: string; nome: string; leadId: string | null }[] }>(alvo === "conversa" ? "/api/atendimento/conversas?view=todos&canal=whatsapp&limit=30" : null);
  const lead = leads.dados?.leads.find((l) => l.lead_id === leadSel) ?? null;
  const conv = conversas.dados?.conversas.find((c) => c.id === convSel) ?? null;

  // Teste integrado só roda em lead de teste (a rota recusa o resto).
  const alvoEfetivo = modo === "integrado" ? "lead_teste" : alvo;

  const [novoAberto, setNovoAberto] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("Rafael");
  const [novoEmpresa, setNovoEmpresa] = React.useState("");
  const [novoMsgs, setNovoMsgs] = React.useState("");
  const [criando, setCriando] = React.useState(false);
  async function criarLead(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    try {
      const r = await api(`${BASE}/teste/lead`, { method: "POST", body: JSON.stringify({ nome: novoNome.trim() || "Rafael", empresa: novoEmpresa.trim() || undefined, mensagens: novoMsgs.split("\n").map((m) => m.trim()).filter(Boolean) }) });
      leads.recarregar(); setLeadSel(r.leadId); setNovoAberto(false); setNovoMsgs("");
      toast.success("Lead de teste criado. Ele nunca tem número de WhatsApp: nada sai.");
    } catch (er) { toast.error(er instanceof Error ? er.message : "Não foi possível criar o lead de teste."); }
    finally { setCriando(false); }
  }

  const semAlvo = alvoEfetivo === "lead_teste" ? !leadSel : !convSel;
  const bloqueio = !podeUsar ? "Simular exige a permissão de usar IA." : null;

  async function rodar() {
    setRodando(true); setErro(null); setResultado(null);
    try {
      let vid = versionId;
      // Simular a versão em edição com alterações pendentes: salva o rascunho antes, como o Playground.
      if (sujo && podeConfigurar && (versionId === trabalho.id)) { const id = await salvar(); if (!id) throw new Error("Não deu para salvar o rascunho antes de simular."); vid = id; }
      const corpo = {
        versionId: vid, mensagem: mensagem.trim(), evento, modo,
        leadId: alvoEfetivo === "lead_teste" ? lead?.lead_id : conv?.leadId ?? undefined,
        contatoId: alvoEfetivo === "lead_teste" ? lead?.contato_id : conv?.id,
      };
      setResultado(await api(`/api/automacoes/agentes/${agenteId}/simular`, { method: "POST", body: JSON.stringify(corpo) }) as Resultado);
    } catch (e) { setErro(e instanceof Error ? e.message : "A simulação falhou."); }
    finally { setRodando(false); }
  }

  // Execução real: só informativa. Cada requisito é um fato da versão e do ambiente.
  const requisitos: [string, boolean][] = [
    ["Versão publicada", Boolean(publicada)], ["Pode usar IA (permissão ai.use)", podeUsar], ["Credencial do provedor disponível", credencialOk],
    ["Canal: pelo menos um número de WhatsApp conectado e autorizado", true], ["Sem pendências de prontidão", faltas.length === 0],
  ];

  return (
    <>
      <Secao titulo="Como rodar" ajuda="Três níveis, separados de propósito. Só os dois primeiros acontecem daqui.">
        <div className="age-niveis" role="radiogroup" aria-label="Nível de execução">
          <button type="button" role="radio" aria-checked={modo === "simulacao"} className="age-modo" onClick={() => setModo("simulacao")}>
            <span className="age-modo-topo"><i />Simulação</span>
            <span>Modelo real, ferramentas em prévia. Nada é enviado nem alterado. Pode usar conversa real como contexto.</span>
          </button>
          <button type="button" role="radio" aria-checked={modo === "integrado"} className="age-modo" onClick={() => setModo("integrado")}>
            <span className="age-modo-topo"><i />Teste integrado</span>
            <span>Só em lead de teste. Grava no CRM desse lead de teste e nunca envia WhatsApp.</span>
          </button>
          <div className="age-modo age-modo-info" aria-disabled="true">
            <span className="age-modo-topo"><Lock size={13} />Execução real</span>
            <span>Não é botão: acontece sozinha em produção, quando todos os itens abaixo valem.</span>
            <ul className="age-requisitos">
              {requisitos.map(([t, ok]) => <li key={t} data-ok={ok ? "true" : "false"}>{ok ? <Check size={11} strokeWidth={3} /> : <CircleAlert size={11} />}{t}</li>)}
            </ul>
          </div>
        </div>
      </Secao>

      <Secao titulo="Parâmetros" ajuda={modo === "integrado" ? "Teste integrado: escolha ou crie um lead de teste." : "Escolha a versão, o contexto e o evento que o agente vai receber."}>
        <div className="age-form">
          <div className="age-tres">
            <label>Versão
              <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                {versoes.map((v) => <option key={v.id} value={v.id}>v{v.versao} · {STATUS_VERSAO[v.status] ?? v.status}{v.id === trabalho.id ? " (em edição)" : ""}</option>)}
              </select>
            </label>
            <label>Evento
              <select value={evento} onChange={(e) => setEvento(e.target.value)}>
                {AGENT_EVENT_CATALOG.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                <option value="agent.retomada">Retomada combinada venceu</option>
              </select>
            </label>
            <label>Contexto
              <select value={alvoEfetivo} disabled={modo === "integrado"} onChange={(e) => setAlvo(e.target.value as "lead_teste" | "conversa")}>
                <option value="lead_teste">Lead de teste</option>
                <option value="conversa">Conversa real (só leitura)</option>
              </select>
            </label>
          </div>
          {alvoEfetivo === "lead_teste" ? (
            <div className="age-linha-alvo">
              <label>Lead de teste
                <select value={leadSel} onChange={(e) => setLeadSel(e.target.value)}>
                  <option value="">{leads.carregando ? "Carregando…" : leads.dados?.leads.length ? "Escolha…" : "Nenhum lead de teste ainda"}</option>
                  {leads.dados?.leads.map((l) => <option key={l.lead_id} value={l.lead_id}>{l.nome}</option>)}
                </select>
              </label>
              <button type="button" className="agn-secundario" onClick={() => setNovoAberto((v) => !v)} aria-expanded={novoAberto}><Plus size={13} /> Criar lead de teste</button>
            </div>
          ) : (
            <label>Conversa
              <select value={convSel} onChange={(e) => setConvSel(e.target.value)}>
                <option value="">{conversas.carregando ? "Carregando…" : conversas.erro ? "Não foi possível carregar" : "Escolha…"}</option>
                {conversas.dados?.conversas.filter((c) => c.tipo === "whatsapp").map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}
          {leads.erro && alvoEfetivo === "lead_teste" ? <p className="age-alerta-linha"><CircleAlert size={13} /> Não foi possível listar os leads de teste: {leads.erro}</p> : null}
          {novoAberto && alvoEfetivo === "lead_teste" ? (
            <form className="age-form age-nova-fonte" onSubmit={criarLead}>
              <div className="agn-duas">
                <label>Nome<input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} maxLength={80} /></label>
                <label>Empresa<input value={novoEmpresa} onChange={(e) => setNovoEmpresa(e.target.value)} maxLength={120} placeholder="Opcional" /></label>
              </div>
              <label>Mensagens que o lead já mandou (uma por linha)<textarea value={novoMsgs} onChange={(e) => setNovoMsgs(e.target.value)} rows={3} placeholder="Opcional. Ex.: Oi, vi o anúncio e queria entender o discador." /></label>
              <div><button type="submit" className="agn-secundario" disabled={criando}>{criando ? <Loader2 size={13} className="age-gira" /> : <Plus size={13} />} Criar</button></div>
            </form>
          ) : null}
          <label>Mensagem do contato
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} maxLength={4000} placeholder="Ex.: Quanto custa o plano para 10 atendentes?" />
          </label>
          <div className="age-linha-acoes">
            {bloqueio ? <span className="age-texto-fraco">{bloqueio}</span> : sujo && podeConfigurar && versionId === trabalho.id ? <span className="age-texto-fraco">Suas alterações serão salvas no rascunho antes de simular.</span> : null}
            <button type="button" className="agn-primario" disabled={rodando || Boolean(bloqueio) || semAlvo || !mensagem.trim()} onClick={rodar}>
              {rodando ? <Loader2 size={14} className="age-gira" /> : <Play size={14} />} {modo === "integrado" ? "Rodar teste integrado" : "Rodar simulação"}
            </button>
          </div>
        </div>
      </Secao>

      {rodando ? <Aviso><Loader2 size={13} className="age-gira" /> Rodando com o modelo de verdade. Pode levar alguns segundos.</Aviso> : null}
      {erro ? (
        <div className="age-faltas" role="alert">
          <CircleAlert size={14} />
          <span><strong>A simulação não rodou.</strong> {erro}</span>
        </div>
      ) : null}
      {resultado ? <ResultadoSimulacao r={resultado} /> : null}

      <Comparar agenteId={agenteId} versoes={versoes} />

      <Secao titulo="Versões" ajuda="Publicar cria um marco; a anterior fica guardada. Reverter publica uma cópia da versão antiga como nova versão, pela mesma regra de prontidão.">
        <div className="age-linha-acoes" style={{ marginBottom: 12 }}>
          <span className="age-texto-fraco">{publicada ? `No ar: v${publicada.versao}.` : "Nada no ar."} {rascunho ? `Rascunho: v${rascunho.versao}.` : "Sem rascunho aberto."}</span>
          {podeConfigurar ? (
            <button type="button" className="agn-primario" onClick={publicar} disabled={publicando || faltas.length > 0 || (!sujo && !rascunho)} title={faltas.length ? `Falta: ${faltas.join("; ")}` : undefined}>
              {publicando ? <Loader2 size={14} className="age-gira" /> : <Send size={14} />} Publicar rascunho
            </button>
          ) : null}
        </div>
        <ol className="age-versoes">
          {versoes.map((v) => <LinhaVersao key={v.id} v={v} agenteId={agenteId} emEdicao={v.id === trabalho.id} noAr={v.id === publicada?.id} podeConfigurar={podeConfigurar} onCarregar={() => onCarregar(v)} />)}
        </ol>
      </Secao>
    </>
  );
}

function ResultadoSimulacao({ r }: { r: Resultado }) {
  const integrado = r.modoExecucao === "integrado";
  const tokens = (r.tokens?.entrada ?? 0) + (r.tokens?.saida ?? 0);
  const custo = Number(r.custo ?? 0);
  return (
    <section className="agn-cartao age-secao age-resultado" data-modo={r.modoExecucao} aria-label="Resultado">
      <div className="age-secao-topo">
        <div><h2>{integrado ? "Resultado do teste integrado" : "Resultado da simulação"}</h2><p>{r.rotulo}</p></div>
        <span className="agn-selo" data-tom="ok"><Check size={10} strokeWidth={3} />Nada foi enviado</span>
      </div>
      <div className="age-secao-corpo age-res-corpo">
        <div className="age-res-bloco">
          <span className="agn-rotulo age-rot">Resposta do agente</span>
          {r.resposta ? <p className="age-res-resposta">{r.resposta.replace(/\n---SPLIT---\n/g, "\n\n")}</p> : <p className="age-texto-fraco">O agente não devolveu texto.</p>}
          <span className="age-texto-fraco">{r.respostaRotulo}</span>
          {r.handoff ? <span className="agn-selo" data-tom="alerta"><i />Pediria uma pessoa</span> : null}
        </div>

        <div className="age-res-grade">
          <div className="age-res-bloco"><span className="agn-rotulo age-rot">Próximo passo</span><p>{r.proximoPasso}</p></div>
          <div className="age-res-bloco"><span className="agn-rotulo age-rot">Tokens e custo</span><p>{num(tokens)} tokens ({num(r.tokens?.entrada ?? 0)} entrada, {num(r.tokens?.saida ?? 0)} saída) · {custo ? `US$ ${custo.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}` : "custo não estimado"}</p></div>
          <div className="age-res-bloco"><span className="agn-rotulo age-rot">Status da execução</span><p>{RUN_STATUS[r.status] ?? r.status}</p></div>
        </div>

        <div className="age-res-bloco">
          <span className="agn-rotulo age-rot">Contexto carregado{r.contexto?.tokensAprox ? ` · cerca de ${num(r.contexto.tokensAprox)} tokens` : ""}</span>
          {r.contexto ? (
            <>
              <div className="age-chips">
                {r.contexto.secoes.length === 0 ? <span className="age-chips-vazio">Nenhuma seção carregada.</span> : null}
                {r.contexto.secoes.map((s, i) => {
                  const o = s as { titulo?: string; id?: string; chars?: number };
                  return <span key={i} className="age-chip">{typeof s === "string" ? s : o.titulo ?? o.id ?? json(s)}</span>;
                })}
              </div>
              <span className="age-texto-fraco">Fontes consultadas: {r.contexto.fontes.length === 0 ? "nenhuma" : r.contexto.fontes.map((f) => `${f.tipo ?? "fonte"}: ${f.rotulo ?? f.ref ?? ""}`).join(" · ")}</span>
            </>
          ) : <p className="age-texto-fraco">Sem contexto: nenhuma conversa nem lead foi informado.</p>}
        </div>

        <div className="age-res-bloco">
          <span className="agn-rotulo age-rot">Ferramentas solicitadas ({r.ferramentas.length})</span>
          {r.ferramentas.length === 0 ? <p className="age-texto-fraco">O agente não pediu nenhuma ferramenta.</p> : (
            <ul className="age-ferr">
              {r.ferramentas.map((f) => (
                <li key={f.sequencia} data-falhou={f.erro ? "true" : undefined}>
                  <div className="age-ferr-topo">
                    <strong>{f.nome}</strong>
                    {f.simulada ? <span className="agn-selo"><i />Simulada</span> : null}
                    {f.aguardaAprovacao ? <span className="agn-selo" data-tom="alerta"><i />Pediria aprovação</span> : null}
                    <span className="agn-selo" data-tom={f.erro ? "alerta" : undefined}><i />{f.erro ? "Recusada" : f.status === "completed" ? "Concluída" : f.status}</span>
                  </div>
                  <span className="age-texto-fraco">{f.erro ? f.erro : `Resultado ${f.simulada ? "(simulado, nada foi alterado)" : ""}: ${curto(f.resultado)}`}</span>
                  <details className="age-tool-det"><summary>Entrada enviada à ferramenta</summary><pre>{json(f.entrada)}</pre></details>
                </li>
              ))}
            </ul>
          )}
          {r.permissoes || r.autonomia ? (
            <details className="age-tool-det"><summary>Permissões e autonomia aplicadas</summary><pre>{json({ permissoes: r.permissoes, autonomia: r.autonomia })}</pre></details>
          ) : null}
        </div>

        <div className="age-res-bloco">
          <span className="agn-rotulo age-rot">Erros</span>
          {r.erros.length === 0 ? <p className="age-texto-fraco">Nenhum erro.</p> : <ul className="age-ferr">{r.erros.map((e, i) => <li key={i} data-falhou="true"><strong>{e.ferramenta}</strong><span className="age-texto-fraco">{e.erro}</span></li>)}</ul>}
        </div>
        <span className="age-texto-fraco">Execução {r.runId.slice(0, 8)} registrada em Execuções, marcada como {integrado ? "teste integrado" : "simulação"}.</span>
      </div>
    </section>
  );
}

function Comparar({ agenteId, versoes }: { agenteId: string; versoes: VersaoDoEditor[] }) {
  const [a, setA] = React.useState(versoes[1]?.id ?? versoes[0]?.id ?? "");
  const [b, setB] = React.useState(versoes[0]?.id ?? "");
  const [r, setR] = React.useState<{ a: { versao: number }; b: { versao: number }; diferencas: { campo: string; antes: unknown; depois: unknown }[]; ferramentasAdicionadas: string[]; ferramentasRemovidas: string[] } | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [indo, setIndo] = React.useState(false);
  if (versoes.length < 2) return (
    <Secao titulo="Comparar versões" ajuda="Precisa de pelo menos duas versões."><Aviso>Este agente tem uma versão só. Salve e publique outra para comparar.</Aviso></Secao>
  );
  async function comparar() {
    setIndo(true); setErro(null); setR(null);
    try { setR(await api(`/api/automacoes/agentes/${agenteId}/versions/comparar?a=${a}&b=${b}`)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível comparar."); }
    finally { setIndo(false); }
  }
  const opcoes = versoes.map((v) => <option key={v.id} value={v.id}>v{v.versao} · {STATUS_VERSAO[v.status] ?? v.status}</option>);
  return (
    <Secao titulo="Comparar versões" ajuda="Mostra o que mudou entre duas versões: instruções, modelo, política, gatilhos e ferramentas.">
      <div className="age-linha-alvo">
        <label>De<select value={a} onChange={(e) => setA(e.target.value)}>{opcoes}</select></label>
        <label>Para<select value={b} onChange={(e) => setB(e.target.value)}>{opcoes}</select></label>
        <button type="button" className="agn-secundario" onClick={comparar} disabled={indo || a === b}>{indo ? <Loader2 size={13} className="age-gira" /> : null} Comparar</button>
      </div>
      {erro ? <p className="age-alerta-linha"><CircleAlert size={13} /> {erro}</p> : null}
      {r ? (
        r.diferencas.length === 0 && !r.ferramentasAdicionadas.length && !r.ferramentasRemovidas.length ? <Aviso>v{r.a.versao} e v{r.b.versao} são idênticas.</Aviso> : (
          <div className="age-diff">
            {r.ferramentasAdicionadas.length ? <p><strong>Ferramentas adicionadas:</strong> {r.ferramentasAdicionadas.join(", ")}</p> : null}
            {r.ferramentasRemovidas.length ? <p><strong>Ferramentas removidas:</strong> {r.ferramentasRemovidas.join(", ")}</p> : null}
            {r.diferencas.map((d) => (
              <div key={d.campo} className="age-diff-linha">
                <strong>{d.campo}</strong>
                <span data-lado="antes">v{r.a.versao}: {curto(d.antes, 220)}</span>
                <span data-lado="depois">v{r.b.versao}: {curto(d.depois, 220)}</span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </Secao>
  );
}

function LinhaVersao({ v, agenteId, emEdicao, noAr, podeConfigurar, onCarregar }: { v: VersaoDoEditor; agenteId: string; emEdicao: boolean; noAr: boolean; podeConfigurar: boolean; onCarregar: () => void }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = React.useState(false);
  const [indo, setIndo] = React.useState(false);
  const [falha, setFalha] = React.useState<string | null>(null);
  async function reverter() {
    setIndo(true); setFalha(null);
    try {
      await api(`/api/automacoes/agentes/${agenteId}/versions/${v.id}/rollback`, { method: "POST", body: JSON.stringify({}) });
      toast.success(`Rollback feito: o conteúdo da v${v.versao} foi publicado como nova versão.`);
      setConfirmando(false); router.refresh();
    } catch (e) { setFalha(e instanceof Error ? e.message : "Não foi possível reverter."); }
    finally { setIndo(false); }
  }
  const g = v.guardrailConfig;
  return (
    <li data-atual={emEdicao ? "true" : undefined}>
      <span className="age-versao-num">v{v.versao}</span>
      <div>
        <strong>
          <span className="agn-selo" data-tom={noAr ? "ok" : undefined}><i />{STATUS_VERSAO[v.status] ?? v.status}</span>
          {emEdicao ? <em>em edição</em> : null}
        </strong>
        <span>{v.provider ?? "sem provedor"} · {v.modelo ?? "sem modelo"} · {v.tools.length} ferramentas · modo {String(g.autonomia ?? g.autonomy ?? "suggest")}</span>
        <span>Criada {quando(v.createdAt)}{v.publishedAt ? ` · publicada ${quando(v.publishedAt)}` : ""}</span>
        {confirmando ? (
          <div className="age-confirma" role="alert">
            <p><strong>Reverter para a v{v.versao}?</strong> O conteúdo dela vira uma nova versão e é publicada agora, substituindo a que está no ar. Se faltar credencial ou outro requisito, a publicação é recusada e fica um rascunho.</p>
            {falha ? <p className="age-exec-erro">{falha}</p> : null}
            <div className="age-linha-acoes">
              <button type="button" className="agn-secundario" onClick={() => { setConfirmando(false); setFalha(null); }}>Cancelar</button>
              <button type="button" className="agn-primario" onClick={reverter} disabled={indo}>{indo ? <Loader2 size={13} className="age-gira" /> : <RotateCcw size={13} />} Confirmar rollback</button>
            </div>
          </div>
        ) : null}
      </div>
      {!emEdicao && podeConfigurar && !confirmando ? (
        <div className="age-linha-acoes">
          <button type="button" className="agn-secundario" onClick={onCarregar}>Carregar no editor</button>
          {v.status !== "draft" && !noAr ? <button type="button" className="agn-secundario" onClick={() => setConfirmando(true)}><RotateCcw size={13} /> Reverter para esta</button> : null}
        </div>
      ) : null}
    </li>
  );
}

/* ── Execuções ────────────────────────────────────────────────────── */

interface Indicadores {
  periodoDias: number; leadsTrabalhados: number; execucoes: number; falhas: number; tempoMedianoPrimeiraRespostaSeg: number | null; qualificacoesConcluidas: number;
  reunioesConfirmadas: number; handoffs: number; conversasSemProximaAcao: number; retomadasPendentes: number; retomadasBloqueadas: number;
  custoTotal: number; custoPorExecucao: number | null; custoPorResultado: number | null;
}
interface ExecucaoLinha {
  id: string; status: string; modo: string; evento: string | null; contato: string | null; lead: string | null; tokens: number; custo: string | null; erro: string | null;
  bloqueio: string | null; handoff: string | null; inicio: string; versao: number | null; ferramentas: string[]; mensagensEnviadas: number; duracaoMs: number | null;
}
interface Detalhe {
  id: string; versao: number | null; status: string; modo: string; evento: string | null; mensagemRecebida: string | null; erro: string | null; bloqueio: string | null; handoff: string | null;
  tokensEntrada: number; tokensSaida: number; custo: string | null;
  contexto: { secoes: unknown[]; fontes: { tipo?: string; rotulo?: string }[] } | null;
  ferramentas: { sequencia: number; nome: string; status: string; resultado: unknown; erro: string | null; simulada: boolean; aguardaAprovacao: boolean }[];
  passos: { sequencia: number; tipo: string; nome: string | null; status: string; erro: string | null; latenciaMs: number | null }[];
  mensagens: { id: string; conteudo: string | null; status: string | null }[];
}

const seg = (s: number | null) => (s == null ? "—" : s < 90 ? `${num(s)} s` : `${(s / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`);
const usd = (n: number | null) => (n == null ? "—" : n === 0 ? "US$ 0" : `US$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`);

export function AbaExecucoes({ agenteId }: { agenteId: string }) {
  const [modo, setModo] = React.useState("");
  const ind = useApi<Indicadores>(`${BASE}/indicadores?agentId=${agenteId}&dias=30`);
  const lista = useApi<{ execucoes: ExecucaoLinha[] }>(`${BASE}/execucoes?agentId=${agenteId}&limite=40${modo ? `&modo=${modo}` : ""}`);
  const i = ind.dados;
  return (
    <>
      <Secao titulo="Indicadores · 30 dias" ajuda="Contados só de execuções reais (produção). Simulações e testes não entram: números de teste inflam o que o agente entrega de verdade.">
        {ind.carregando ? <Aviso><Loader2 size={13} className="age-gira" /> Carregando indicadores…</Aviso> : null}
        {ind.erro ? <Aviso tom="alerta">Não foi possível carregar os indicadores: {ind.erro}</Aviso> : null}
        {i ? (
          <div className="age-indicadores">
            {([
              ["Leads trabalhados", num(i.leadsTrabalhados)], ["Execuções reais", num(i.execucoes)], ["Falhas", num(i.falhas), i.falhas > 0],
              ["1ª resposta (mediana)", seg(i.tempoMedianoPrimeiraRespostaSeg)], ["Qualificações", num(i.qualificacoesConcluidas)], ["Reuniões confirmadas", num(i.reunioesConfirmadas)],
              ["Handoffs", num(i.handoffs)], ["Sem próxima ação (24h)", num(i.conversasSemProximaAcao), i.conversasSemProximaAcao > 0],
              ["Retomadas pendentes", num(i.retomadasPendentes)], ["Retomadas bloqueadas", num(i.retomadasBloqueadas), i.retomadasBloqueadas > 0],
              ["Custo total", usd(i.custoTotal)], ["Custo por execução", usd(i.custoPorExecucao)], ["Custo por resultado", usd(i.custoPorResultado)],
            ] as [string, string, boolean?][]).map(([r, v, alerta]) => <div key={r} className="age-ind" data-alerta={alerta ? "true" : undefined}><span>{r}</span><strong>{v}</strong></div>)}
          </div>
        ) : null}
        {i && i.execucoes === 0 ? <p className="age-texto-fraco" style={{ marginTop: 10 }}>Nenhuma execução real neste período. Quando o agente estiver publicado e atribuído a conversas, os números aparecem aqui.</p> : null}
      </Secao>

      <Secao titulo="Execuções" ajuda="Clique para ver o contexto que o agente carregou, as ferramentas, os passos e o que foi enviado."
        direita={<label className="age-liga">Tipo<select className="age-select-mini" value={modo} onChange={(e) => setModo(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todas</option><option value="live">Reais</option><option value="test">Simulações e testes</option></select></label>}>
        {lista.carregando ? <Aviso><Loader2 size={13} className="age-gira" /> Carregando execuções…</Aviso> : null}
        {lista.erro ? <Aviso tom="alerta">Não foi possível carregar as execuções: {lista.erro}</Aviso> : null}
        {lista.dados && lista.dados.execucoes.length === 0 ? <div className="age-vazio"><strong>Nenhuma execução {modo === "live" ? "real" : modo === "test" ? "de teste" : "registrada"}</strong><span>Rode uma simulação na aba Testes e versões para ver a primeira.</span></div> : null}
        {lista.dados && lista.dados.execucoes.length ? <div className="age-execs">{lista.dados.execucoes.map((e) => <LinhaExec key={e.id} e={e} />)}</div> : null}
      </Secao>
    </>
  );
}

function LinhaExec({ e }: { e: ExecucaoLinha }) {
  const [aberta, setAberta] = React.useState(false);
  const det = useApi<Detalhe>(aberta ? `${BASE}/execucoes/${e.id}` : null);
  const tom = e.status === "completed" ? "ok" : e.status === "failed" || e.status === "aborted" || e.bloqueio ? "alerta" : undefined;
  const d = det.dados;
  return (
    <div className="age-exec">
      <button type="button" className="age-exec-linha" onClick={() => setAberta((a) => !a)} aria-expanded={aberta}>
        <span className="agn-selo" data-tom={tom}><i />{e.bloqueio ? "Bloqueada" : RUN_STATUS[e.status] ?? e.status}</span>
        <span className="age-exec-msg">{e.lead ?? e.contato ?? "Sem lead"} · {e.evento ?? "evento"}{e.erro ? ` · ${e.erro}` : ""}</span>
        <span className="age-exec-meta">{MODO_RUN[e.modo] ?? e.modo}{e.versao ? ` · v${e.versao}` : ""} · {num(e.tokens)} tokens · {quando(e.inicio)}</span>
        <ChevronDown size={14} className="age-exec-seta" />
      </button>
      {aberta ? (
        <div className="age-exec-detalhe">
          {det.carregando ? <p><Loader2 size={12} className="age-gira" /> Carregando detalhe…</p> : null}
          {det.erro ? <p className="age-exec-erro">Não foi possível carregar: {det.erro}</p> : null}
          {d ? (
            <div className="age-res-corpo">
              {d.mensagemRecebida ? <p><strong>Mensagem recebida:</strong> {d.mensagemRecebida}</p> : null}
              {d.erro ? <p className="age-exec-erro"><strong>Erro:</strong> {d.erro}</p> : null}
              {d.bloqueio ? <p className="age-exec-erro"><strong>Bloqueio:</strong> {d.bloqueio}</p> : null}
              {d.handoff ? <p><strong>Passou para humano:</strong> {d.handoff}</p> : null}
              <p><strong>Contexto carregado:</strong> {d.contexto ? (d.contexto.secoes.map((s) => { const o = s as { titulo?: string; id?: string }; return typeof s === "string" ? s : o.titulo ?? o.id ?? ""; }).filter(Boolean).join(", ") || "vazio") : "nenhum"}</p>
              <p><strong>Mensagens enviadas:</strong> {e.mensagensEnviadas ? `${e.mensagensEnviadas}${d.mensagens.length ? ` (${d.mensagens.map((m) => curto(m.conteudo, 80)).join(" | ")})` : ""}` : "nenhuma"}</p>
              <p><strong>Tokens:</strong> {num(d.tokensEntrada + d.tokensSaida)} · <strong>Custo:</strong> {usd(Number(d.custo ?? 0))}</p>
              {d.ferramentas.length ? (
                <ul className="age-ferr">
                  {d.ferramentas.map((f) => (
                    <li key={f.sequencia} data-falhou={f.erro ? "true" : undefined}>
                      <div className="age-ferr-topo"><strong>{f.nome}</strong>{f.simulada ? <span className="agn-selo"><i />Simulada</span> : null}{f.aguardaAprovacao ? <span className="agn-selo" data-tom="alerta"><i />Aguardou aprovação</span> : null}</div>
                      <span className="age-texto-fraco">{f.erro ?? curto(f.resultado)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p>Nenhuma ferramenta chamada.</p>}
              <ol className="age-passos">
                {d.passos.map((p) => <li key={p.sequencia} data-falhou={p.status === "failed" ? "true" : undefined}><strong>{p.tipo}{p.nome ? ` · ${p.nome}` : ""}</strong><span>{p.status}{p.erro ? ` · ${p.erro}` : ""}</span></li>)}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
