"use client";

/* Automação → Agentes → [id]: editor do agente na linguagem ONFACE.
 *
 * Substitui o `Cf2AgenteDetalheWorkspace`. Estrutura inspirada no
 * Superagente: abas
 * de Identidade & escopo, Ações, Conhecimento, Gatilhos & handoff,
 * Desempenho e Histórico, com o Playground fixo à direita testando o
 * RASCUNHO.
 *
 * Tudo que aparece aqui tem consumidor real:
 * - escopo e expressões de handoff entram no prompt pelo `compilarPrompt`,
 *   a mesma função que o runtime usa (o "Ver prompt compilado" é literal);
 * - modo (Copiloto / Com aprovação / Autônomo) é o `guardrail_config.autonomy`
 *   que o runtime lê para decidir se envia e se executa;
 * - gatilhos decidem o roteamento em produção; prioridade desempata;
 * - credencial é a que o runtime decifra (sem ela, só a chave do ambiente).
 * O que existia no editor antigo e o runtime ignora (filtros de grupo,
 * limiar de confiança, sessão do canal) saiu da tela, mas é preservado no
 * salvar: nada do jsonb que a tela não conhece é apagado.
 *
 * Escrita só pelas rotas Hono existentes. O Playground chama
 * POST /api/automacoes/agentes/:id/test (modo test, egress suprimido:
 * nenhuma mensagem sai e ações viram prévia). */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, Check, ChevronDown, CircleAlert, FlaskConical, Loader2, Plus, RotateCcw, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { AGENT_EVENT_CATALOG, AGENT_PURPOSES, AGENT_TOOL_CATALOG, isKnownAgentTool, normalizarIdFerramenta, type AgentToolCategory } from "@/lib/ai/agent-studio";
import { compilarPrompt, lerEscopo, type EscopoAgente } from "@/lib/ai/agente-escopo";
import type { DadosEditorAgente, VersaoDoEditor, ExecucaoDoEditor } from "@/lib/automacoes/agente-detalhe";
import "./agentes.css";
import "./agente-editor.css";

const TZ = "America/Sao_Paulo";
const num = (n: number) => n.toLocaleString("pt-BR");
const PROVEDORES = [
  { id: "anthropic", nome: "Anthropic" }, { id: "claude_subscription", nome: "Claude Subscription" },
  { id: "openai", nome: "OpenAI" }, { id: "google", nome: "Google" }, { id: "groq", nome: "Groq" },
] as const;
// Claude Subscription roda pelo adaptador da assinatura (token OAuth só no
// ambiente, nunca credencial da organização) com os mesmos modelos Claude.
const ASSINATURA = "claude_subscription";
const modelosDe = (d: DadosEditorAgente, p: string) => d.modelos.filter((m) => m.provider === (p === ASSINATURA ? "anthropic" : p));
const NOME_PROVEDOR: Record<string, string> = Object.fromEntries(PROVEDORES.map((p) => [p.id, p.nome]));
const STATUS_VERSAO: Record<string, string> = { draft: "Rascunho", published: "No ar", superseded: "Substituída" };
const RUN_STATUS: Record<string, string> = { completed: "Concluída", failed: "Falhou", running: "Rodando", queued: "Na fila", handed_off: "Passou para humano", aborted: "Abortada (orçamento)" };
const MODO_RUN: Record<string, string> = { live: "Produção", test: "Teste", dry_run: "Simulação" };
const CATEGORIAS: { id: AgentToolCategory; nome: string; ajuda: string }[] = [
  { id: "contexto", nome: "Contexto", ajuda: "Leituras. Não alteram nada." },
  { id: "comunicacao", nome: "Comunicação", ajuda: "Classificar e preparar a resposta ao contato." },
  { id: "crm", nome: "CRM", ajuda: "Alteram lead, negócio, tags e timeline." },
  { id: "operacao", nome: "Operação", ajuda: "Tarefas, reuniões, follow-ups e handoff." },
];
const MODOS = [
  { id: "suggest", nome: "Copiloto", texto: "Gera resposta e plano no registro da execução. Não envia mensagem nem altera dados: a equipe decide." },
  { id: "approval", nome: "Com aprovação", texto: "Prepara as ações; as que alteram dados viram caso para a equipe aprovar. Não envia mensagem sozinho." },
  { id: "autonomous", nome: "Autônomo", texto: "Responde no WhatsApp e executa as ações ligadas, dentro do teto de permissões." },
] as const;
type Modo = (typeof MODOS)[number]["id"];
type Aba = "identidade" | "acoes" | "conhecimento" | "gatilhos" | "desempenho" | "historico";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "identidade", nome: "Identidade & escopo" },
  { id: "acoes", nome: "Ações" },
  { id: "conhecimento", nome: "Conhecimento" },
  { id: "gatilhos", nome: "Gatilhos & handoff" },
  { id: "desempenho", nome: "Desempenho" },
  { id: "historico", nome: "Histórico" },
];

interface Form {
  nome: string; descricao: string; finalidade: string; prioridade: number;
  systemPrompt: string; provider: string; modelo: string; credentialId: string;
  tools: string[]; events: string[]; escopo: EscopoAgente;
  handoffEnabled: boolean; handoffKeywords: string[]; modo: Modo;
  maxSteps: number; tokenBudget: number; costBudget: string;
}

function eventosDe(t: Record<string, unknown>) {
  const bruto = [...(Array.isArray(t.events) ? t.events : []), ...(Array.isArray(t.eventTypes) ? t.eventTypes : [])];
  return [...new Set(bruto.filter((e): e is string => typeof e === "string"))];
}

function formDe(a: DadosEditorAgente["agente"], v: VersaoDoEditor): Form {
  const g = v.guardrailConfig;
  // Os agentes semeados (NEXO, Hermes) gravaram `autonomia`; o runtime lê `autonomy`.
  const modoBruto = g.autonomy ?? g.autonomia;
  const h = v.handoffConfig;
  return {
    nome: a.nome, descricao: a.descricao ?? "", finalidade: a.finalidade, prioridade: a.prioridade,
    systemPrompt: v.systemPrompt, provider: v.provider ?? "", modelo: v.modelo ?? "", credentialId: v.credentialId ?? "",
    // Só ids que o runtime conhece; nomes legados são convertidos (ver normalizarIdFerramenta).
    tools: [...new Set(v.tools.map(normalizarIdFerramenta).filter(isKnownAgentTool))], events: eventosDe(v.triggerConfig), escopo: lerEscopo(g),
    handoffEnabled: h.enabled !== false,
    handoffKeywords: Array.isArray(h.keywords) ? h.keywords.filter((k): k is string => typeof k === "string") : [],
    modo: MODOS.some((m) => m.id === modoBruto) ? modoBruto as Modo : "suggest",
    maxSteps: v.maxSteps, tokenBudget: v.tokenBudget, costBudget: v.costBudget ?? "",
  };
}

/** Corpo da versão: o que a tela edita por cima do que a versão já tinha.
 * Chaves de jsonb que a tela não conhece (permissoes, filtros, limiar...)
 * passam intactas; sem isso o salvar apagaria o teto de permissões. */
function corpoDaVersao(f: Form, base: VersaoDoEditor) {
  const { eventTypes: _legado, ...trigger } = base.triggerConfig;
  void _legado; // eventTypes foi fundido em `events` ao abrir; manter duplicaria o gatilho
  return {
    systemPrompt: f.systemPrompt,
    provider: f.provider || null, modelo: f.modelo.trim() || null, credentialId: f.credentialId || null,
    channelSessionId: base.channelSessionId,
    tools: f.tools,
    triggerConfig: { ...trigger, events: f.events },
    handoffConfig: { ...base.handoffConfig, enabled: f.handoffEnabled, keywords: f.handoffKeywords },
    knowledgeConfig: base.knowledgeConfig,
    guardrailConfig: { ...base.guardrailConfig, autonomy: f.modo, autonomia: f.modo, escopo: f.escopo },
    maxSteps: f.maxSteps, tokenBudget: f.tokenBudget,
    costBudget: f.costBudget.trim() ? Number(f.costBudget.replace(",", ".")) : null,
    historyMessageWindow: base.historyMessageWindow, historyTokenWindow: base.historyTokenWindow, casesEnabled: base.casesEnabled,
  };
}

/** Espelho local de `verificarProntidao` para o que muda enquanto se edita.
 * O servidor confere de novo no publish; isto só evita surpresa. */
function faltasLocais(f: Form, d: DadosEditorAgente) {
  const r: string[] = [];
  if (!f.provider) r.push("Escolha o provedor de IA");
  if (!f.modelo.trim()) r.push("Escolha o modelo");
  // Mesma regra de `verificarProntidao` para a assinatura: só token do ambiente.
  if (f.provider === ASSINATURA) { if (!d.ambiente[ASSINATURA]) r.push("Conecte a credencial da Claude Subscription no ambiente (token OAuth do Super Admin)"); }
  else if (f.provider && !f.credentialId && !d.ambiente[f.provider]) r.push(`Escolha uma credencial de ${NOME_PROVEDOR[f.provider] ?? f.provider}`);
  if (f.systemPrompt.trim().length < 20) r.push("Escreva as instruções (pelo menos uma frase completa)");
  if (f.events.length === 0) r.push("Marque pelo menos um gatilho");
  return r;
}

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error || json?.message || `Falha (${r.status})`);
  return json;
}

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/* ── Peças ─────────────────────────────────────────────────────────── */

function Interruptor({ ligado, onChange, rotulo, desligado }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; desligado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className="age-switch" disabled={desligado} onClick={() => onChange(!ligado)}>
      <i />
    </button>
  );
}

function ListaEditavel({ titulo, ajuda, itens, onChange, exemplo, tom, travado }: {
  titulo: string; ajuda: string; itens: string[]; onChange: (v: string[]) => void; exemplo: string; tom?: "ok" | "alerta" | "humano"; travado: boolean;
}) {
  const [novo, setNovo] = React.useState("");
  const add = () => {
    const v = novo.trim();
    if (!v) return;
    if (!itens.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...itens, v]);
    setNovo("");
  };
  return (
    <div className="age-lista" data-tom={tom}>
      <div className="age-lista-topo"><strong>{titulo}</strong><span>{ajuda}</span></div>
      <div className="age-chips">
        {itens.length === 0 ? <span className="age-chips-vazio">Nada aqui ainda.</span> : null}
        {itens.map((i) => (
          <span key={i} className="age-chip">
            {i}
            {!travado ? <button type="button" aria-label={`Remover ${i}`} onClick={() => onChange(itens.filter((x) => x !== i))}><X size={11} /></button> : null}
          </span>
        ))}
      </div>
      {!travado ? (
        <div className="age-lista-add">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={exemplo} aria-label={`Adicionar em ${titulo}`} maxLength={160}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="agn-secundario" onClick={add} disabled={!novo.trim()} aria-label={`Adicionar em ${titulo}`} title="Adicionar"><Plus size={14} /></button>
        </div>
      ) : null}
    </div>
  );
}

function Secao({ titulo, ajuda, children, direita }: { titulo: string; ajuda?: React.ReactNode; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <section className="agn-cartao age-secao">
      <div className="age-secao-topo">
        <div><h2>{titulo}</h2>{ajuda ? <p>{ajuda}</p> : null}</div>
        {direita}
      </div>
      <div className="age-secao-corpo">{children}</div>
    </section>
  );
}

/* ── Playground ───────────────────────────────────────────────────── */

type Linha = { id: number; tipo: "eu" | "agente" | "erro"; texto: string; meta?: string; humano?: boolean };

function Playground({ bloqueio, aviso, testar }: {
  bloqueio: string[] | null; aviso: string | null;
  testar: (msg: string) => Promise<{ textos: string[]; meta: string; humano: boolean }>;
}) {
  const [linhas, setLinhas] = React.useState<Linha[]>([]);
  const [msg, setMsg] = React.useState("");
  const [rodando, setRodando] = React.useState(false);
  const fim = React.useRef<HTMLDivElement>(null);
  const seq = React.useRef(0);
  React.useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [linhas, rodando]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = msg.trim();
    if (!texto || rodando || bloqueio) return;
    setMsg("");
    setLinhas((l) => [...l, { id: ++seq.current, tipo: "eu", texto }]);
    setRodando(true);
    try {
      const r = await testar(texto);
      const textos = r.textos.length ? r.textos : ["(o agente não devolveu texto)"];
      setLinhas((l) => [...l, ...textos.map((t, i) => ({ id: ++seq.current, tipo: "agente" as const, texto: t, meta: i === textos.length - 1 ? r.meta : undefined, humano: i === textos.length - 1 && r.humano }))]);
    } catch (err) {
      setLinhas((l) => [...l, { id: ++seq.current, tipo: "erro", texto: err instanceof Error ? err.message : "O teste falhou." }]);
    } finally {
      setRodando(false);
    }
  }

  return (
    <aside className="agn-cartao age-play" aria-labelledby="age-play-titulo">
      <div className="age-play-topo">
        <div>
          <h2 id="age-play-titulo"><FlaskConical size={14} /> Playground</h2>
          <p>Testa o rascunho com o modelo de verdade. Nada é enviado ao contato.</p>
        </div>
        {linhas.length ? <button type="button" className="age-icone" onClick={() => setLinhas([])} aria-label="Limpar conversa de teste" title="Limpar"><Trash2 size={14} /></button> : null}
      </div>
      <div className="age-play-corpo" aria-live="polite">
        {linhas.length === 0 && !bloqueio ? (
          <div className="age-play-vazio">
            <Sparkles size={18} />
            <strong>Escreva como se fosse o contato</strong>
            <span>Ex.: &ldquo;Quanto custa o plano para 10 atendentes?&rdquo;. Leituras consultam o CRM; ações que alteram dados viram prévia.</span>
          </div>
        ) : null}
        {bloqueio ? (
          <div className="age-play-vazio" data-tom="alerta">
            <CircleAlert size={18} />
            <strong>Ainda não dá para testar</strong>
            {bloqueio.map((b) => <span key={b}>{b}</span>)}
          </div>
        ) : null}
        {linhas.map((l) => (
          <div key={l.id} className="age-bolha" data-tipo={l.tipo}>
            <p>{l.texto}</p>
            {l.humano ? <span className="agn-selo" data-tom="alerta"><i />Pediu humano</span> : null}
            {l.meta ? <small>{l.meta}</small> : null}
          </div>
        ))}
        {rodando ? <div className="age-bolha" data-tipo="agente"><p className="age-digitando"><Loader2 size={13} className="age-gira" /> Pensando…</p></div> : null}
        <div ref={fim} />
      </div>
      <form className="age-play-form" onSubmit={enviar}>
        {aviso ? <span className="age-play-aviso">{aviso}</span> : null}
        <div className="age-play-campo">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} placeholder={bloqueio ? "Resolva os itens acima para testar" : "Mensagem do contato"}
            aria-label="Mensagem de teste" disabled={Boolean(bloqueio) || rodando} maxLength={4000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          <button type="submit" className="agn-primario" disabled={Boolean(bloqueio) || rodando || !msg.trim()} aria-label="Enviar teste"><Send size={14} /></button>
        </div>
        <span className="age-play-nota">Cada mensagem é testada sozinha, sem o histórico acima.</span>
      </form>
    </aside>
  );
}

/* ── Execução (Desempenho) ────────────────────────────────────────── */

function LinhaExecucao({ e }: { e: ExecucaoDoEditor }) {
  const [aberta, setAberta] = React.useState(false);
  const [passos, setPassos] = React.useState<Record<string, unknown>[] | null>(null);
  const [erro, setErro] = React.useState(false);
  async function abrir() {
    setAberta((a) => !a);
    if (passos || aberta) return;
    try { setPassos((await api(`/api/automacoes/ai/runs/${e.id}/steps`)).steps ?? []); } catch { setErro(true); }
  }
  const tom = e.status === "completed" ? "ok" : e.status === "failed" || e.status === "aborted" ? "alerta" : undefined;
  return (
    <div className="age-exec">
      <button type="button" className="age-exec-linha" onClick={abrir} aria-expanded={aberta}>
        <span className="agn-selo" data-tom={tom}><i />{RUN_STATUS[e.status] ?? e.status}</span>
        <span className="age-exec-msg">{e.mensagem ?? "Evento sem mensagem"}</span>
        <span className="age-exec-meta">{MODO_RUN[e.modo] ?? e.modo}{e.versao ? ` · v${e.versao}` : ""} · {num(e.tokens)} tokens · {quando(e.inicio)}</span>
        <ChevronDown size={14} className="age-exec-seta" />
      </button>
      {aberta ? (
        <div className="age-exec-detalhe">
          {e.erro ? <p className="age-exec-erro">{e.erro}</p> : null}
          {e.handoff ? <p>Passou para humano: {e.handoff}</p> : null}
          {erro ? <p className="age-exec-erro">Não foi possível carregar os passos.</p> : passos == null ? <p><Loader2 size={12} className="age-gira" /> Carregando passos…</p> : passos.length === 0 ? <p>Sem passos registrados.</p> : (
            <ol className="age-passos">
              {passos.map((p, i) => (
                <li key={String(p.id ?? i)} data-falhou={p.status === "failed" ? "true" : undefined}>
                  <strong>{String(p.kind)}{p.name ? ` · ${String(p.name)}` : ""}</strong>
                  <span>{String(p.status)}{p.errorMessage ? ` · ${String(p.errorMessage)}` : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── Editor ───────────────────────────────────────────────────────── */

export function AgenteEditor({ dados, podeConfigurar, podeUsar }: { dados: DadosEditorAgente; podeConfigurar: boolean; podeUsar: boolean }) {
  const router = useRouter();
  const { agente, versoes } = dados;
  const rascunho = versoes.find((v) => v.status === "draft") ?? null;
  const publicada = versoes.find((v) => v.status === "published") ?? null;
  const trabalho = rascunho ?? publicada ?? versoes[0] ?? null;

  // Estado derivado das props: quando o servidor devolve agente/versões
  // novos (após salvar/publicar), o formulário volta a espelhar o banco.
  // Mudança só em conhecimento/desempenho não mexe no que está sendo editado.
  const chave = JSON.stringify([agente, versoes]);
  const [chaveVista, setChaveVista] = React.useState(chave);
  const [form, setForm] = React.useState<Form | null>(() => (trabalho ? formDe(agente, trabalho) : null));
  const [base, setBase] = React.useState(() => JSON.stringify(form));
  if (chave !== chaveVista) {
    const f = trabalho ? formDe(agente, trabalho) : null;
    setChaveVista(chave); setForm(f); setBase(JSON.stringify(f));
  }

  const [aba, setAba] = React.useState<Aba>("identidade");
  const [salvando, setSalvando] = React.useState(false);
  const [publicando, setPublicando] = React.useState(false);
  const [verPrompt, setVerPrompt] = React.useState(false);
  // Versão gravada com nomes legados de ferramenta: o runtime ignora todas
  // até salvar, então a conversão já conta como alteração pendente.
  const ferramentasLegadas = trabalho ? trabalho.tools.filter((t) => !isKnownAgentTool(t)).length : 0;
  const editado = JSON.stringify(form) !== base;
  const sujo = editado || ferramentasLegadas > 0;
  const travado = !podeConfigurar;

  // Sair com alteração não salva perde trabalho: o navegador pergunta.
  React.useEffect(() => {
    if (!editado) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [editado]);

  if (!form || !trabalho) {
    return (
      <div className="agn-tela">
        <div className="agn-cartao"><div className="agn-vazio" style={{ borderTop: 0 }}>
          <strong>Este agente não tem nenhuma versão</strong>
          <span>Sem versão não há instruções nem modelo para editar. <Link href="/automacoes/agentes" style={{ color: "var(--of-coral-texto)" }}>Voltar para Agentes</Link></span>
        </div></div>
      </div>
    );
  }
  const f = form;
  const set = (patch: Partial<Form>) => setForm({ ...f, ...patch });
  const faltas = faltasLocais(f, dados);
  const promptCompilado = compilarPrompt({ systemPrompt: f.systemPrompt, guardrailConfig: { escopo: f.escopo }, handoffConfig: { enabled: f.handoffEnabled, keywords: f.handoffKeywords } });
  const modelosDoProvedor = modelosDe(dados, f.provider);
  const credsDoProvedor = f.provider === ASSINATURA ? [] : dados.credenciais.filter((c) => c.provider === f.provider);
  const permissoes = Array.isArray(trabalho.guardrailConfig.permissoes) ? (trabalho.guardrailConfig.permissoes as unknown[]).filter((p): p is string => typeof p === "string") : [];
  const temHandoffTool = f.tools.includes("handoff.request");

  /** Salva metadados + versão. Devolve o id da versão (rascunho) salva. */
  async function salvar(silencioso = false): Promise<string | null> {
    if (!podeConfigurar) return null;
    if (!f.nome.trim()) { toast.error("O agente precisa de um nome."); return null; }
    setSalvando(true);
    try {
      const meta = { nome: f.nome.trim(), descricao: f.descricao.trim() || null, finalidade: f.finalidade, prioridade: f.prioridade };
      const metaAntes = { nome: agente.nome, descricao: agente.descricao, finalidade: agente.finalidade, prioridade: agente.prioridade };
      if (JSON.stringify(meta) !== JSON.stringify(metaAntes)) {
        // O schema do PATCH exige slug; o agente mantém o dele.
        await api(`/api/automacoes/agentes/${agente.id}`, { method: "PATCH", body: JSON.stringify({ ...meta, slug: agente.slug }) });
      }
      const corpo = JSON.stringify(corpoDaVersao(f, trabalho!));
      const v = rascunho
        ? await api(`/api/automacoes/agentes/${agente.id}/versions/${rascunho.id}`, { method: "PATCH", body: corpo })
        : await api(`/api/automacoes/agentes/${agente.id}/versions`, { method: "POST", body: corpo });
      setBase(JSON.stringify(f));
      if (!silencioso) toast.success(rascunho ? `Rascunho v${rascunho.versao} salvo.` : `Rascunho v${v.versao} criado. A versão no ar continua a mesma até publicar.`);
      router.refresh();
      return v.id as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      return null;
    } finally {
      setSalvando(false);
    }
  }

  async function publicar() {
    setPublicando(true);
    try {
      const id = sujo ? await salvar(true) : rascunho?.id ?? null;
      if (!id) return;
      await api(`/api/automacoes/agentes/${agente.id}/versions/${id}/publish`, { method: "POST" });
      toast.success("Versão publicada. O agente passa a responder pelos gatilhos marcados.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível publicar.");
    } finally {
      setPublicando(false);
    }
  }

  async function testar(mensagem: string) {
    let versionId = trabalho!.id;
    if (sujo && podeConfigurar) {
      const id = await salvar(true);
      if (!id) throw new Error("Não deu para salvar o rascunho antes do teste.");
      versionId = id;
    }
    const t0 = Date.now();
    const r = await api(`/api/automacoes/agentes/${agente.id}/test`, { method: "POST", body: JSON.stringify({ versionId, message: mensagem }) });
    const res = r.result ?? {};
    const trace: Record<string, unknown>[] = Array.isArray(r.run?.trace) ? r.run.trace : [];
    const ferramentas = trace.filter((t) => t.type === "tool_call").map((t) => String(t.name));
    const tokens = Number(res.tokensInput ?? 0) + Number(res.tokensOutput ?? 0);
    const seg = ((Date.now() - t0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const meta = [`${num(tokens)} tokens`, `${seg} s`, ferramentas.length ? `usou ${[...new Set(ferramentas)].join(", ")}` : null].filter(Boolean).join(" · ");
    return {
      textos: typeof res.responseText === "string" ? res.responseText.split("\n---SPLIT---\n").filter((t: string) => t.trim()) : [],
      meta, humano: Boolean(res.handoff),
    };
  }

  const bloqueioTeste = !podeUsar ? ["Testar exige a permissão de usar IA. Peça a um administrador."]
    : faltas.filter((x) => /provedor|modelo|credencial/i.test(x)).length ? faltas.filter((x) => /provedor|modelo|credencial/i.test(x)) : null;
  const avisoTeste = bloqueioTeste ? null
    : sujo && podeConfigurar ? "Suas alterações serão salvas no rascunho antes do teste."
      : sujo ? "Testando a versão salva: sem permissão de configurar, suas alterações não entram." : null;

  const podePublicar = podeConfigurar && (sujo || Boolean(rascunho)) && faltas.length === 0;
  const motivoPublicar = !podeConfigurar ? "Publicar exige a permissão de configurar IA"
    : !sujo && !rascunho ? "Nada novo para publicar: a versão no ar é a mais recente"
      : faltas.length ? `Falta: ${faltas.join("; ")}` : sujo ? "Salva o rascunho e publica" : `Publicar o rascunho v${rascunho!.versao}`;

  const d = dados.desempenho;
  const maxDia = Math.max(1, ...d.serie.map((s) => s.total));

  return (
    <div className="agn-tela age-tela">
      {/* ── Topo ── */}
      <header className="agn-cartao age-topo">
        <Link href="/automacoes/agentes" className="age-voltar" aria-label="Voltar para Agentes"><ArrowLeft size={15} /></Link>
        <span className="agn-avatar" data-ativo={publicada ? "true" : undefined}><Bot size={16} /></span>
        <div className="age-topo-nome">
          <h1>{f.nome || "Sem nome"}</h1>
          <div className="age-selos">
            {publicada ? <span className="agn-selo" data-tom="ok"><i />v{publicada.versao} no ar</span> : <span className="agn-selo"><i />Não publicado</span>}
            {rascunho ? <span className="agn-selo"><i />Rascunho v{rascunho.versao}</span> : null}
            <span className="agn-selo"><i />{MODOS.find((m) => m.id === f.modo)?.nome}</span>
            {faltas.length ? <span className="agn-selo" data-tom="alerta" title={faltas.join("\n")}><i />{faltas.length === 1 ? "Falta 1 item" : `Faltam ${faltas.length} itens`}</span> : <span className="agn-selo" data-tom="ok"><i />Pronto para publicar</span>}
            {sujo ? <span className="age-sujo">Alterações não salvas</span> : null}
          </div>
        </div>
        <div className="age-topo-acoes">
          {travado ? <span className="agn-motivo">Somente leitura: editar exige a permissão de configurar IA</span> : null}
          {editado && !travado ? <button type="button" className="agn-secundario" onClick={() => { setForm(JSON.parse(base)); }}>Descartar</button> : null}
          {!travado ? (
            <button type="button" className="agn-secundario" disabled={!sujo || salvando} onClick={() => salvar()}>
              {salvando && !publicando ? <Loader2 size={14} className="age-gira" /> : null} Salvar rascunho
            </button>
          ) : null}
          <button type="button" className="agn-primario" disabled={!podePublicar || publicando} title={motivoPublicar} onClick={publicar}>
            {publicando ? <Loader2 size={14} className="age-gira" /> : <Send size={14} />} Publicar
          </button>
        </div>
      </header>

      {faltas.length ? (
        <div className="age-faltas" role="status">
          <CircleAlert size={14} />
          <span><strong>Para publicar:</strong> {faltas.join(" · ")}</span>
        </div>
      ) : null}

      <nav className="agn-segmento age-abas" aria-label="Seções do agente">
        {ABAS.map((a) => (
          <button key={a.id} type="button" aria-pressed={aba === a.id} onClick={() => setAba(a.id)}>
            {a.nome}
            {a.id === "desempenho" && dados.casosAbertos.length ? <span className="age-contador">{dados.casosAbertos.length}</span> : null}
          </button>
        ))}
      </nav>

      <div className="age-grade">
        <div className="age-principal">
          {aba === "identidade" ? (
            <>
              <Secao titulo="Identidade" ajuda="Como a equipe reconhece este agente na lista e nas execuções.">
                <div className="age-form">
                  <div className="agn-duas">
                    <label>Nome<input value={f.nome} onChange={(e) => set({ nome: e.target.value })} maxLength={120} disabled={travado} /></label>
                    <label>Papel na operação
                      <select value={f.finalidade} onChange={(e) => set({ finalidade: e.target.value })} disabled={travado}>
                        {AGENT_PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        {!AGENT_PURPOSES.some((p) => p.id === f.finalidade) ? <option value={f.finalidade}>{f.finalidade === "copiloto" ? "Copiloto" : f.finalidade === "orquestracao" ? "Orquestração" : f.finalidade}</option> : null}
                      </select>
                    </label>
                  </div>
                  <label>Descrição<textarea value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} rows={2} maxLength={500} placeholder="O que ele resolve e onde deve parar." disabled={travado} /></label>
                </div>
              </Secao>

              <Secao titulo="Escopo" ajuda="Cada item vira uma linha do prompt. O agente segue estas listas em toda conversa.">
                <div className="age-listas">
                  <ListaEditavel titulo="Pode ajudar com" ajuda="Assuntos que ele resolve sozinho." tom="ok" travado={travado}
                    itens={f.escopo.podeAjudar} onChange={(v) => set({ escopo: { ...f.escopo, podeAjudar: v } })} exemplo="Ex.: dúvidas sobre planos e preços públicos" />
                  <ListaEditavel titulo="Não deve tratar de" ajuda="Recusa com educação e oferece uma pessoa." tom="alerta" travado={travado}
                    itens={f.escopo.naoDeveTratar} onChange={(v) => set({ escopo: { ...f.escopo, naoDeveTratar: v } })} exemplo="Ex.: cancelamento de contrato" />
                  <ListaEditavel titulo="Transferir para humano quando" ajuda="Usa Solicitar atendimento humano." tom="humano" travado={travado}
                    itens={f.escopo.transferirQuando} onChange={(v) => set({ escopo: { ...f.escopo, transferirQuando: v } })} exemplo="Ex.: pedir desconto ou condição especial" />
                </div>
                {f.escopo.transferirQuando.length && !temHandoffTool ? (
                  <p className="age-alerta-linha"><CircleAlert size={13} /> A ação Solicitar atendimento humano está desligada: sem ela o agente não consegue transferir.
                    {!travado ? <button type="button" onClick={() => set({ tools: [...f.tools, "handoff.request"] })}>Ligar</button> : null}</p>
                ) : null}
              </Secao>

              <Secao titulo="Instruções" ajuda="Objetivo, tom e jeito de conduzir a conversa. O escopo acima é somado a isto."
                direita={<button type="button" className="agn-secundario" onClick={() => setVerPrompt((v) => !v)} aria-expanded={verPrompt}>{verPrompt ? "Esconder" : "Ver"} prompt compilado</button>}>
                <div className="age-form">
                  <textarea className="age-prompt" value={f.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} rows={9} disabled={travado} aria-label="Instruções do agente" />
                  <span className="age-contagem" data-alerta={f.systemPrompt.trim().length < 20 ? "true" : undefined}>{num(f.systemPrompt.length)} caracteres</span>
                </div>
                {verPrompt ? (
                  <div className="age-compilado">
                    <span className="agn-rotulo">Exatamente o que o modelo recebe como sistema</span>
                    <pre>{promptCompilado}</pre>
                  </div>
                ) : null}
              </Secao>

              <Secao titulo="Modo de atendimento" ajuda="Até onde o agente vai sozinho. Vale para a versão publicada; o Playground nunca envia.">
                <div className="age-modos" role="radiogroup" aria-label="Modo de atendimento">
                  {MODOS.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={f.modo === m.id} className="age-modo" disabled={travado} onClick={() => set({ modo: m.id })}>
                      <span className="age-modo-topo"><i />{m.nome}</span>
                      <span>{m.texto}</span>
                    </button>
                  ))}
                </div>
              </Secao>

              <Secao titulo="Modelo e limites" ajuda="Cada versão publicada fixa o modelo, a credencial e o teto por execução.">
                <div className="age-form">
                  <div className="age-tres">
                    <label>Provedor
                      <select value={f.provider} disabled={travado} onChange={(e) => {
                        const p = e.target.value;
                        const doProvedor = modelosDe(dados, p);
                        const padrao = doProvedor.find((m) => m.padrao) ?? doProvedor[0];
                        set({ provider: p, modelo: padrao?.modelId ?? "", credentialId: "" });
                      }}>
                        <option value="">Escolha…</option>
                        {PROVEDORES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </label>
                    <label>Modelo
                      <select value={f.modelo} disabled={travado || !f.provider} onChange={(e) => set({ modelo: e.target.value })}>
                        <option value="">{f.provider ? "Escolha…" : "Escolha o provedor"}</option>
                        {modelosDoProvedor.map((m) => <option key={m.modelId} value={m.modelId}>{m.nome}</option>)}
                        {f.modelo && !modelosDoProvedor.some((m) => m.modelId === f.modelo) ? <option value={f.modelo}>{f.modelo}</option> : null}
                      </select>
                    </label>
                    <label>Credencial
                      <select value={f.credentialId} disabled={travado || !f.provider || f.provider === ASSINATURA} onChange={(e) => set({ credentialId: e.target.value })}>
                        <option value="">{f.provider === ASSINATURA ? (dados.ambiente[ASSINATURA] ? "Token do ambiente" : "Não conectada") : f.provider && dados.ambiente[f.provider] ? "Chave do ambiente" : "Nenhuma"}</option>
                        {credsDoProvedor.map((c) => <option key={c.id} value={c.id}>{c.label}{c.validada ? "" : " (não validada)"}</option>)}
                      </select>
                    </label>
                  </div>
                  {f.provider === ASSINATURA && !dados.ambiente[ASSINATURA] ? (
                    <p className="age-alerta-linha"><CircleAlert size={13} /> A Claude Subscription usa um token OAuth guardado só no ambiente (CLAUDE_CODE_OAUTH_TOKEN), configurado pelo Super Admin. Neste ambiente ele não existe.</p>
                  ) : f.provider && f.provider !== ASSINATURA && !credsDoProvedor.length && !dados.ambiente[f.provider] ? (
                    <p className="age-alerta-linha"><CircleAlert size={13} /> Nenhuma credencial de {NOME_PROVEDOR[f.provider]} nesta organização. <Link href="/ajustes/integracoes">Cadastrar em Ajustes → Integrações</Link></p>
                  ) : null}
                  <div className="age-tres">
                    <label>Passos por execução<input type="number" min={1} max={30} value={f.maxSteps} disabled={travado} onChange={(e) => set({ maxSteps: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} /></label>
                    <label>Tokens por execução<input type="number" min={1} max={100000} value={f.tokenBudget} disabled={travado} onChange={(e) => set({ tokenBudget: Math.min(100000, Math.max(1, Number(e.target.value) || 1)) })} /></label>
                    <label>Custo máximo (US$)<input inputMode="decimal" value={f.costBudget} placeholder="Sem limite" disabled={travado} onChange={(e) => set({ costBudget: e.target.value.replace(/[^\d.,]/g, "") })} /></label>
                  </div>
                </div>
              </Secao>
            </>
          ) : null}

          {aba === "acoes" ? (
            <>
              {ferramentasLegadas ? (
                <div className="age-faltas" role="status">
                  <CircleAlert size={14} />
                  <span><strong>{ferramentasLegadas} {ferramentasLegadas === 1 ? "ação estava gravada" : "ações estavam gravadas"} num formato que o runtime não reconhece</strong>, e por isso não funcionavam. Elas aparecem ligadas abaixo; salve o rascunho para valerem.</span>
                </div>
              ) : null}
              <Secao titulo="O que o agente pode fazer" ajuda={<>Ligue só o necessário. No teste, leituras consultam o CRM e ações viram prévia; em produção, ações só executam no modo Autônomo (ou após aprovação). <strong>{f.tools.length} de {AGENT_TOOL_CATALOG.length} ligadas.</strong></>}>
                {CATEGORIAS.map((c) => (
                  <div key={c.id} className="age-grupo">
                    <div className="age-grupo-topo"><strong>{c.nome}</strong><span>{c.ajuda}</span></div>
                    {AGENT_TOOL_CATALOG.filter((t) => t.categoria === c.id).map((t) => {
                      const on = f.tools.includes(t.id);
                      return (
                        <div key={t.id} className="age-tool" data-on={on ? "true" : undefined}>
                          <div>
                            <strong>{t.nome} <em data-tipo={t.modo}>{t.modo === "leitura" ? "Leitura" : "Ação"}</em></strong>
                            <span>{t.descricao}</span>
                          </div>
                          <Interruptor ligado={on} rotulo={t.nome} desligado={travado} onChange={(v) => set({ tools: v ? [...f.tools, t.id] : f.tools.filter((x) => x !== t.id) })} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </Secao>
              <Secao titulo="Teto de permissões" ajuda="Mesmo com a ação ligada, o agente só altera dados dentro destas permissões. Sem nenhuma, fica só na leitura.">
                {permissoes.length ? (
                  <div className="age-chips">{permissoes.map((p) => <span key={p} className="age-chip age-chip-mono">{p}</span>)}</div>
                ) : (
                  <p className="age-texto-fraco">Esta versão não tem permissões delegadas: ações que alteram dados são recusadas pelo runtime.</p>
                )}
              </Secao>
            </>
          ) : null}

          {aba === "conhecimento" ? (
            <Conhecimento dados={dados} form={f} set={set} travado={travado} onMudou={() => router.refresh()} />
          ) : null}

          {aba === "gatilhos" ? (
            <>
              <Secao titulo="Quando ele entra" ajuda="Em produção, o agente publicado só é acionado pelos eventos marcados.">
                <div className="age-eventos">
                  {AGENT_EVENT_CATALOG.map((ev) => {
                    const on = f.events.includes(ev.id);
                    return (
                      <button key={ev.id} type="button" className="age-evento" aria-pressed={on} disabled={travado}
                        onClick={() => set({ events: on ? f.events.filter((x) => x !== ev.id) : [...f.events, ev.id] })}>
                        <span className="age-check">{on ? <Check size={11} strokeWidth={3} /> : null}</span>
                        <span><strong>{ev.nome}</strong><span>{ev.descricao}</span></span>
                      </button>
                    );
                  })}
                </div>
                <div className="age-form" style={{ marginTop: 14, maxWidth: 260 }}>
                  <label>Prioridade<input type="number" min={0} max={10000} value={f.prioridade} disabled={travado} onChange={(e) => set({ prioridade: Math.min(10000, Math.max(0, Number(e.target.value) || 0)) })} /></label>
                  <span className="age-texto-fraco">Dois agentes publicados no mesmo evento: vence o de maior prioridade.</span>
                </div>
              </Secao>
              <Secao titulo="Handoff para humano" ajuda="Quando o agente para e chama a equipe."
                direita={<Interruptor ligado={f.handoffEnabled} rotulo="Handoff ligado" desligado={travado} onChange={(v) => set({ handoffEnabled: v })} />}>
                {f.handoffEnabled ? (
                  <ListaEditavel titulo="Expressões do contato" ajuda="Entram no prompt como gatilho de transferência." travado={travado}
                    itens={f.handoffKeywords} onChange={(v) => set({ handoffKeywords: v })} exemplo="Ex.: quero falar com uma pessoa" />
                ) : <p className="age-texto-fraco">Desligado: as expressões não entram no prompt. As regras de Transferir para humano do escopo continuam valendo.</p>}
                {!temHandoffTool ? (
                  <p className="age-alerta-linha"><CircleAlert size={13} /> A ação Solicitar atendimento humano está desligada.
                    {!travado ? <button type="button" onClick={() => set({ tools: [...f.tools, "handoff.request"] })}>Ligar</button> : null}</p>
                ) : null}
              </Secao>
            </>
          ) : null}

          {aba === "desempenho" ? (
            <>
              <section className="agn-hero age-hero" aria-label="Desempenho nos últimos 30 dias">
                <span className="agn-hero-brilho" />
                <div>
                  <span className="agn-rotulo">Execuções · 30 dias</span>
                  <span className="agn-numero">{num(d.total)}</span>
                  <span className="agn-sub">{d.total === 0 ? "Nenhuma execução ainda. Testes no Playground e respostas em produção aparecem aqui." : `${num(d.producao)} em produção · ${num(d.teste)} em teste`}</span>
                </div>
                <div className="agn-grafico">
                  <div className="agn-barras" role="img" aria-label={`${d.total} execuções nos últimos 30 dias`}>
                    {d.serie.map((s) => (
                      <span key={s.dia} className="agn-barra" data-vazio={s.total === 0 ? "true" : undefined} style={{ height: `${Math.max(4, (s.total / maxDia) * 100)}%` }}
                        title={`${new Date(`${s.dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${s.total} execuções${s.falhas ? `, ${s.falhas} com falha` : ""}`} />
                    ))}
                  </div>
                  <div className="agn-eixo"><span>{new Date(`${d.serie[0].dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span><span>hoje</span></div>
                </div>
                <div className="agn-kpis">
                  <div className="agn-kpi"><span>Concluídas</span><strong>{num(d.concluidas)}</strong></div>
                  <div className="agn-kpi"><span>Passou para humano</span><strong>{num(d.humano)}</strong></div>
                  <div className="agn-kpi" data-alerta={d.falhas ? "true" : undefined}><span>Falhas</span><strong>{num(d.falhas)}</strong></div>
                  <div className="agn-kpi"><span>Tempo médio</span><strong>{d.latenciaMediaMs == null ? "—" : `${(d.latenciaMediaMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`}</strong></div>
                  <div className="agn-kpi"><span>Tokens</span><strong>{num(d.tokens)}</strong></div>
                  <div className="agn-kpi"><span>Custo estimado</span><strong>{d.custo ? `US$ ${d.custo.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}` : "—"}</strong></div>
                </div>
              </section>

              <Casos casos={dados.casosAbertos} podeUsar={podeUsar} onMudou={() => router.refresh()} />

              <Secao titulo="Execuções recentes" ajuda="Clique para ver os passos: chamadas ao modelo, ferramentas e o que foi bloqueado.">
                {dados.execucoes.length === 0 ? (
                  <div className="age-vazio"><strong>Nenhuma execução registrada</strong><span>Mande uma mensagem no Playground para ver a primeira.</span></div>
                ) : <div className="age-execs">{dados.execucoes.map((e) => <LinhaExecucao key={e.id} e={e} />)}</div>}
              </Secao>
            </>
          ) : null}

          {aba === "historico" ? (
            <Secao titulo="Versões" ajuda="Publicar cria um marco; a anterior fica guardada. Carregar uma versão antiga põe o conteúdo dela no editor para virar o próximo rascunho.">
              <ol className="age-versoes">
                {versoes.map((v) => (
                  <li key={v.id} data-atual={v.id === trabalho.id ? "true" : undefined}>
                    <span className="age-versao-num">v{v.versao}</span>
                    <div>
                      <strong>
                        <span className="agn-selo" data-tom={v.status === "published" ? "ok" : undefined}><i />{STATUS_VERSAO[v.status] ?? v.status}</span>
                        {v.id === trabalho.id ? <em>em edição</em> : null}
                      </strong>
                      <span>{v.provider ? NOME_PROVEDOR[v.provider] ?? v.provider : "sem provedor"} · {v.modelo ?? "sem modelo"} · {v.tools.length} ações · {MODOS.find((m) => m.id === (v.guardrailConfig.autonomy ?? v.guardrailConfig.autonomia))?.nome ?? "Copiloto"}</span>
                      <span>Criada {quando(v.createdAt)}{v.publishedAt ? ` · publicada ${quando(v.publishedAt)}` : ""}</span>
                    </div>
                    {v.id !== trabalho.id && !travado ? (
                      <button type="button" className="agn-secundario" onClick={() => {
                        setForm({ ...formDe(agente, v), nome: f.nome, descricao: f.descricao, finalidade: f.finalidade, prioridade: f.prioridade });
                        setAba("identidade");
                        toast.success(`Conteúdo da v${v.versao} carregado. Salve para virar o rascunho.`);
                      }}><RotateCcw size={13} /> Carregar no editor</button>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Secao>
          ) : null}
        </div>

        <Playground bloqueio={bloqueioTeste} aviso={avisoTeste} testar={testar} />
      </div>
    </div>
  );
}

/* ── Conhecimento ─────────────────────────────────────────────────── */

function Conhecimento({ dados, form, set, travado, onMudou }: {
  dados: DadosEditorAgente; form: Form; set: (p: Partial<Form>) => void; travado: boolean; onMudou: () => void;
}) {
  const [nome, setNome] = React.useState("");
  const [conteudo, setConteudo] = React.useState("");
  const [memoria, setMemoria] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const busca = form.tools.includes("knowledge.search");
  const memoriaOn = form.tools.includes("memory.read");
  const alternar = (id: string, v: boolean) => set({ tools: v ? [...form.tools, id] : form.tools.filter((x) => x !== id) });
  const STATUS: Record<string, string> = { ready: "Indexada", indexing: "Indexando", pending: "Sem conteúdo", failed: "Falhou", archived: "Arquivada" };

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !conteudo.trim()) return;
    setEnviando(true);
    try {
      await api("/api/automacoes/ai/knowledge", { method: "POST", body: JSON.stringify({ nome: nome.trim(), sourceType: "text", content: conteudo.trim() }) });
      toast.success("Fonte indexada. Agentes com Buscar conhecimento já consultam.");
      setNome(""); setConteudo(""); onMudou();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível adicionar a fonte."); }
    finally { setEnviando(false); }
  }

  async function salvarMemoria() {
    if (!memoria?.trim()) return;
    setEnviando(true);
    try {
      await api("/api/automacoes/ai/memory", { method: "PUT", body: JSON.stringify({ content: memoria.trim() }) });
      toast.success("Memória publicada em nova versão.");
      setMemoria(null); onMudou();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível salvar a memória."); }
    finally { setEnviando(false); }
  }

  return (
    <>
      <Secao titulo="Base de conhecimento" ajuda="Fontes da organização, compartilhadas por todos os agentes que têm Buscar conhecimento ligado."
        direita={<label className="age-liga">Este agente consulta<Interruptor ligado={busca} rotulo="Buscar conhecimento" desligado={travado} onChange={(v) => alternar("knowledge.search", v)} /></label>}>
        {dados.conhecimento.length === 0 ? (
          <div className="age-vazio"><strong>Nenhuma fonte ainda</strong><span>Cole abaixo um texto de referência (preços públicos, FAQ, políticas). Ele é dividido em trechos e fica disponível na hora.</span></div>
        ) : (
          <ul className="age-fontes">
            {dados.conhecimento.map((k) => (
              <li key={k.id}>
                <strong>{k.nome}</strong>
                <span>{k.tipo === "text" ? "Texto" : k.tipo === "url" ? "Link" : k.tipo === "faq" ? "FAQ" : "Arquivo"}{k.indexadoEm ? ` · ${quando(k.indexadoEm)}` : ""}</span>
                <span className="agn-selo" data-tom={k.status === "ready" ? "ok" : k.status === "failed" ? "alerta" : undefined}><i />{STATUS[k.status] ?? k.status}</span>
              </li>
            ))}
          </ul>
        )}
        {!travado ? (
          <form className="age-form age-nova-fonte" onSubmit={adicionar}>
            <label>Nome da fonte<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Tabela de planos 2026" maxLength={120} /></label>
            <label>Conteúdo<textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={5} placeholder="Cole o texto que o agente pode consultar." /></label>
            <div><button type="submit" className="agn-secundario" disabled={enviando || !nome.trim() || !conteudo.trim()}>{enviando ? <Loader2 size={13} className="age-gira" /> : <Plus size={13} />} Adicionar fonte</button></div>
          </form>
        ) : null}
      </Secao>

      <Secao titulo="Memória da organização" ajuda="Documento curto com fatos que valem para toda conversa. Versionado: cada salvar publica uma nova versão."
        direita={<label className="age-liga">Este agente lê<Interruptor ligado={memoriaOn} rotulo="Consultar memória" desligado={travado} onChange={(v) => alternar("memory.read", v)} /></label>}>
        {memoria != null ? (
          <div className="age-form">
            <textarea value={memoria} onChange={(e) => setMemoria(e.target.value)} rows={8} aria-label="Documento de memória" />
            <div className="age-linha-acoes">
              <button type="button" className="agn-secundario" onClick={() => setMemoria(null)}>Cancelar</button>
              <button type="button" className="agn-primario" disabled={enviando || !memoria.trim()} onClick={salvarMemoria}>Publicar memória</button>
            </div>
          </div>
        ) : dados.memoria ? (
          <>
            <pre className="age-memoria">{dados.memoria.conteudo}</pre>
            <div className="age-linha-acoes">
              <span className="age-texto-fraco">Versão {dados.memoria.versao} · {quando(dados.memoria.em)}</span>
              {!travado ? <button type="button" className="agn-secundario" onClick={() => setMemoria(dados.memoria!.conteudo)}>Editar</button> : null}
            </div>
          </>
        ) : (
          <div className="age-vazio">
            <strong>Sem memória publicada</strong>
            <span>Escreva o que todo agente deve saber: horário de atendimento, regiões atendidas, o que a empresa não faz.</span>
            {!travado ? <button type="button" className="agn-secundario" style={{ marginTop: 10 }} onClick={() => setMemoria("")}><Plus size={13} /> Escrever memória</button> : null}
          </div>
        )}
      </Secao>
    </>
  );
}

/* ── Casos aguardando a equipe ─────────────────────────────────────── */

function Casos({ casos, podeUsar, onMudou }: { casos: DadosEditorAgente["casosAbertos"]; podeUsar: boolean; onMudou: () => void }) {
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  if (casos.length === 0) return null;
  async function agir(id: string, action: string, ok: string) {
    setOcupado(id);
    try { await api(`/api/automacoes/ai/cases/${id}/action`, { method: "POST", body: JSON.stringify({ action }) }); toast.success(ok); onMudou(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível concluir."); }
    finally { setOcupado(null); }
  }
  return (
    <Secao titulo="Aguardando a equipe" ajuda="Ações que o agente preparou no modo Com aprovação, ou dúvidas que ele abriu como caso.">
      <ul className="age-casos">
        {casos.map((c) => (
          <li key={c.id}>
            <div><strong>{c.titulo}</strong><span>{c.resumo} · {quando(c.aberto)}</span></div>
            {podeUsar ? (
              <div className="age-linha-acoes">
                {c.origem === "tool_approval" ? (
                  <>
                    <button type="button" className="agn-secundario" disabled={ocupado === c.id} onClick={() => agir(c.id, "cancel", "Ação recusada.")}>Recusar</button>
                    <button type="button" className="agn-primario" disabled={ocupado === c.id} onClick={() => agir(c.id, "approve", "Ação aprovada e executada.")}>Aprovar e executar</button>
                  </>
                ) : (
                  <button type="button" className="agn-secundario" disabled={ocupado === c.id} onClick={() => agir(c.id, "resolve", "Caso resolvido.")}>Marcar resolvido</button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Secao>
  );
}

