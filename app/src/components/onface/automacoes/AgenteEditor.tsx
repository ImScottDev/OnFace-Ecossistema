"use client";

/* Automação → Agentes → [id]: editor do agente na linguagem ONFACE.
 *
 * Abas: Identidade, Inteligência, Conhecimento, Ferramentas, Autonomia, Canais,
 * Gatilhos, Handoff, Testes e versões, Execuções; Playground fixo à direita
 * testando o RASCUNHO. As abas de dado vivo (Ferramentas, Gatilhos, Testes,
 * Execuções) moram em AgenteOperacao.tsx; aqui fica o formulário da versão.
 *
 * AGENTE de IA não é cadência nem automação: ele tem atribuição, retomadas
 * próprias (follow-up inteligente) e memória. Por isso não existe campo de
 * cadência nesta tela.
 *
 * Tudo que aparece aqui tem consumidor real no runtime:
 * - identidade, escopo e expressões de handoff entram no prompt pelo
 *   `compilarPrompt`, a mesma função que o runtime usa (o "Ver prompt
 *   compilado" é literal);
 * - autonomia geral e por classe, limites, horário, retomadas, canais,
 *   supervisor, memória e política de conhecimento são lidos de
 *   `guardrail_config` / `knowledge_config` / `handoff_config` a cada execução;
 * - credencial é a que o runtime decifra (sem ela, só a chave do ambiente).
 * O jsonb da versão é MESCLADO, nunca substituído: chave que a tela não conhece
 * (permissoes, filtros, limiar...) passa intacta no salvar.
 *
 * Escrita só pelas rotas Hono existentes; o servidor valida a configuração. */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, CircleAlert, FlaskConical, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AGENT_PURPOSES, isKnownAgentTool, normalizarIdFerramenta } from "@/lib/ai/agent-studio";
import { compilarPrompt, lerEscopo, lerIdentidade, type EscopoAgente, type IdentidadeAgente } from "@/lib/ai/agente-escopo";
import { CLASSES_AUTONOMIA, lerAutonomiaPorAcao, type ClasseAutonomia, type ModoAutonomia } from "@/lib/ai-platform/tools/politica";
import type { DadosEditorAgente, VersaoDoEditor } from "@/lib/automacoes/agente-detalhe";
import { AbaExecucoes, AbaFerramentas, AbaGatilhos, AbaTestes } from "./AgenteOperacao";
import { AprovacoesPendentes, useCasosAbertos } from "@/components/onface/atendimento/agente-operacao";
import { BotaoMotivo, Radiogroup } from "@/components/onface/ds/escolha";
import { Aviso, Interruptor, ListaEditavel, Secao, api, num, quando, useApi } from "./agente-pecas";
import "./agentes.css";
import "./agente-editor.css";

const PROVEDORES = [
  { id: "anthropic", nome: "Anthropic" }, { id: "claude_subscription", nome: "Claude Subscription" },
  { id: "openai", nome: "OpenAI" }, { id: "google", nome: "Google" }, { id: "groq", nome: "Groq" },
] as const;
// Claude Subscription roda pelo adaptador da assinatura (token OAuth só no
// ambiente, nunca credencial da organização) com os mesmos modelos Claude.
const ASSINATURA = "claude_subscription";
const modelosDe = (d: DadosEditorAgente, p: string) => d.modelos.filter((m) => m.provider === (p === ASSINATURA ? "anthropic" : p));
const NOME_PROVEDOR: Record<string, string> = Object.fromEntries(PROVEDORES.map((p) => [p.id, p.nome]));
const MODOS = [
  { id: "suggest", nome: "Copiloto", texto: "Gera resposta e plano no registro da execução. Não envia mensagem nem altera dados: a equipe decide." },
  { id: "approval", nome: "Sob aprovação", texto: "Prepara as ações; as que alteram dados viram caso para a equipe aprovar. Não envia mensagem sozinho." },
  { id: "autonomous", nome: "Autônomo controlado", texto: "Responde no WhatsApp e executa as ações ligadas, dentro do teto de permissões e dos limites abaixo." },
] as const;
type Modo = ModoAutonomia;
const NOME_MODO = Object.fromEntries(MODOS.map((m) => [m.id, m.nome])) as Record<string, string>;
const IDIOMAS = ["português do Brasil", "inglês", "espanhol"];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PRIORIDADES = [{ id: "normal", nome: "Normal" }, { id: "alta", nome: "Alta" }, { id: "urgente", nome: "Urgente" }];

type Aba = "identidade" | "inteligencia" | "conhecimento" | "ferramentas" | "autonomia" | "canais" | "gatilhos" | "handoff" | "testes" | "execucoes";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "identidade", nome: "Identidade" }, { id: "inteligencia", nome: "Inteligência" }, { id: "conhecimento", nome: "Conhecimento" },
  { id: "ferramentas", nome: "Ferramentas" }, { id: "autonomia", nome: "Autonomia" }, { id: "canais", nome: "Canais" },
  { id: "gatilhos", nome: "Gatilhos" }, { id: "handoff", nome: "Handoff" }, { id: "testes", nome: "Testes e versões" }, { id: "execucoes", nome: "Execuções" },
];

interface Form {
  nome: string; descricao: string; finalidade: string; prioridade: number;
  identidade: IdentidadeAgente; supervisor: string; systemPrompt: string;
  provider: string; modelo: string; credentialId: string; maxSteps: number; tokenBudget: number; costBudget: string; janelaMsgs: number; janelaTokens: number;
  memoriaAtiva: boolean; conhAtivo: boolean; conhCategorias: string[]; maxTrechos: number;
  tools: string[]; events: string[]; escopo: EscopoAgente;
  modo: Modo; porAcao: Record<ClasseAutonomia, Modo | "">;
  horarioAtivo: boolean; dias: number[]; inicio: string; fim: string; responderFora: boolean;
  porHora: number; porDia: number; semRetorno: number;
  maxRetomadas: number; janelaDias: number; maxDiasRetomada: number; exigirOutlook: boolean;
  canalWhats: boolean; sessoes: string[];
  handoffEnabled: boolean; handoffKeywords: string[]; mensagemTransicao: string; resumoObrigatorio: boolean; prioridadeHandoff: string; copilotoApos: boolean; retomada: string; retomadaHoras: number;
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const nOu = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function eventosDe(t: Record<string, unknown>) {
  const bruto = [...(Array.isArray(t.events) ? t.events : []), ...(Array.isArray(t.eventTypes) ? t.eventTypes : [])];
  return [...new Set(bruto.filter((e): e is string => typeof e === "string"))];
}

function formDe(a: DadosEditorAgente["agente"], v: VersaoDoEditor): Form {
  const g = v.guardrailConfig;
  // Os agentes semeados (NEXO, Hermes) gravaram `autonomia`; o runtime lê `autonomy`.
  const modoBruto = g.autonomy ?? g.autonomia;
  const h = v.handoffConfig, kc = v.knowledgeConfig, lim = rec(g.limites), hor = rec(g.horarioComercial), fu = rec(g.followup), can = rec(g.canais);
  const porAcaoBruto = lerAutonomiaPorAcao(g);
  const porAcao = Object.fromEntries(CLASSES_AUTONOMIA.map((c) => [c.id, porAcaoBruto[c.id] ?? ""])) as Form["porAcao"];
  return {
    nome: a.nome, descricao: a.descricao ?? "", finalidade: a.finalidade, prioridade: a.prioridade,
    identidade: lerIdentidade(g), supervisor: typeof g.supervisorUsuarioId === "string" ? g.supervisorUsuarioId : "", systemPrompt: v.systemPrompt,
    provider: v.provider ?? "", modelo: v.modelo ?? "", credentialId: v.credentialId ?? "",
    maxSteps: v.maxSteps, tokenBudget: v.tokenBudget, costBudget: v.costBudget ?? "", janelaMsgs: v.historyMessageWindow, janelaTokens: v.historyTokenWindow,
    memoriaAtiva: rec(g.memoria).ativa !== false, conhAtivo: kc.ativo !== false, conhCategorias: strs(kc.categorias), maxTrechos: nOu(kc.maxTrechos, 4),
    // Só ids que o runtime conhece; nomes legados são convertidos (ver normalizarIdFerramenta).
    tools: [...new Set(v.tools.map(normalizarIdFerramenta).filter(isKnownAgentTool))], events: eventosDe(v.triggerConfig), escopo: lerEscopo(g),
    modo: MODOS.some((m) => m.id === modoBruto) ? modoBruto as Modo : "suggest", porAcao,
    horarioAtivo: hor.ativo !== false, dias: Array.isArray(hor.dias) && hor.dias.length ? (hor.dias as number[]) : [1, 2, 3, 4, 5],
    inicio: typeof hor.inicio === "string" ? hor.inicio : "08:00", fim: typeof hor.fim === "string" ? hor.fim : "19:00",
    responderFora: typeof lim.responderForaDoHorario === "boolean" ? lim.responderForaDoHorario : true,
    porHora: nOu(lim.maxMensagensPorHora, 6), porDia: nOu(lim.maxMensagensPorDia, 30), semRetorno: nOu(lim.maxSemRetorno, 3),
    maxRetomadas: nOu(fu.maxRetomadas, 5), janelaDias: nOu(fu.janelaDias, 30), maxDiasRetomada: nOu(fu.maxDiasRetomada, 90), exigirOutlook: g.agendaExigirOutlook !== false,
    canalWhats: can.whatsapp !== false, sessoes: strs(can.sessoes),
    handoffEnabled: h.enabled !== false, handoffKeywords: strs(h.keywords),
    mensagemTransicao: typeof h.mensagemTransicao === "string" ? h.mensagemTransicao : "", resumoObrigatorio: h.resumoObrigatorio === true,
    prioridadeHandoff: PRIORIDADES.some((p) => p.id === h.prioridade) ? String(h.prioridade) : "normal", copilotoApos: h.copilotoAposHandoff === true,
    retomada: typeof h.retomada === "string" ? h.retomada : "somente_humano", retomadaHoras: nOu(h.retomadaHoras, 24),
  };
}

/** Corpo da versão: o que a tela edita por cima do que a versão já tinha.
 * Chaves de jsonb que a tela não conhece (permissoes, filtros, limiar...)
 * passam intactas; sem isso o salvar apagaria o teto de permissões. */
function corpoDaVersao(f: Form, base: VersaoDoEditor) {
  const { eventTypes: _legado, ...trigger } = base.triggerConfig;
  void _legado; // eventTypes foi fundido em `events` ao abrir; manter duplicaria o gatilho
  const g = base.guardrailConfig;
  const autonomiaPorAcao = { ...rec(g.autonomiaPorAcao) };
  for (const c of CLASSES_AUTONOMIA) { if (f.porAcao[c.id]) autonomiaPorAcao[c.id] = f.porAcao[c.id]; else delete autonomiaPorAcao[c.id]; }
  const identidade = { ...rec(g.identidade), ...f.identidade };
  return {
    systemPrompt: f.systemPrompt,
    provider: f.provider || null, modelo: f.modelo.trim() || null, credentialId: f.credentialId || null,
    channelSessionId: base.channelSessionId,
    tools: f.tools,
    triggerConfig: { ...trigger, events: f.events },
    handoffConfig: {
      ...base.handoffConfig, enabled: f.handoffEnabled, keywords: f.handoffKeywords, mensagemTransicao: f.mensagemTransicao.trim() || null,
      resumoObrigatorio: f.resumoObrigatorio, prioridade: f.prioridadeHandoff, copilotoAposHandoff: f.copilotoApos, retomada: f.retomada, retomadaHoras: f.retomadaHoras,
    },
    knowledgeConfig: { ...base.knowledgeConfig, ativo: f.conhAtivo, categorias: f.conhCategorias, maxTrechos: f.maxTrechos },
    guardrailConfig: {
      ...g, autonomy: f.modo, autonomia: f.modo, escopo: f.escopo, identidade, supervisorUsuarioId: f.supervisor || null, autonomiaPorAcao,
      horarioComercial: { ...rec(g.horarioComercial), ativo: f.horarioAtivo, dias: f.dias, inicio: f.inicio, fim: f.fim },
      limites: { ...rec(g.limites), responderForaDoHorario: f.responderFora, maxMensagensPorHora: f.porHora, maxMensagensPorDia: f.porDia, maxSemRetorno: f.semRetorno },
      followup: { ...rec(g.followup), maxRetomadas: f.maxRetomadas, janelaDias: f.janelaDias, maxDiasRetomada: f.maxDiasRetomada },
      agendaExigirOutlook: f.exigirOutlook, memoria: { ...rec(g.memoria), ativa: f.memoriaAtiva }, canais: { ...rec(g.canais), whatsapp: f.canalWhats, sessoes: f.sessoes },
    },
    maxSteps: f.maxSteps, tokenBudget: f.tokenBudget,
    costBudget: f.costBudget.trim() ? Number(f.costBudget.replace(",", ".")) : null,
    historyMessageWindow: f.janelaMsgs, historyTokenWindow: f.janelaTokens, casesEnabled: base.casesEnabled,
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

/** Número com faixa: aceita digitar livre e crava a faixa ao sair do campo. */
function Num({ rotulo, valor, min, max, onChange, desligado, ajuda }: { rotulo: string; valor: number; min: number; max: number; onChange: (n: number) => void; desligado?: boolean; ajuda?: string }) {
  const [t, setT] = React.useState(String(valor));
  React.useEffect(() => { setT(String(valor)); }, [valor]);
  return (
    <label>{rotulo}
      <input type="number" inputMode="numeric" min={min} max={max} value={t} disabled={desligado}
        onChange={(e) => { setT(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.round(n)); }}
        onBlur={() => { const n = Math.min(max, Math.max(min, Math.round(Number(t)) || min)); setT(String(n)); onChange(n); }} />
      {ajuda ? <small className="age-ajuda">{ajuda}</small> : null}
    </label>
  );
}

function Linha({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return <div className="age-linha-opcao"><div><strong>{titulo}</strong>{ajuda ? <span>{ajuda}</span> : null}</div>{children}</div>;
}

/* ── Playground ───────────────────────────────────────────────────── */

type Linha_ = { id: number; tipo: "eu" | "agente" | "erro"; texto: string; meta?: string; humano?: boolean };

function Playground({ bloqueio, aviso, testar }: {
  bloqueio: string[] | null; aviso: string | null;
  testar: (msg: string) => Promise<{ textos: string[]; meta: string; humano: boolean }>;
}) {
  const [linhas, setLinhas] = React.useState<Linha_[]>([]);
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
          <p>Conversa rápida com o rascunho e o modelo de verdade. Nada é enviado ao contato. Para ver contexto e ferramentas, use Testes e versões.</p>
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

/* ── Editor ───────────────────────────────────────────────────────── */

interface Apoio {
  sessoes: { id: string; nome: string; status: string | null; telefone: string | null; finalidade: string | null; dono: string | null }[];
  pessoas: { id: string; nome: string; role: string | null }[];
  fontes: { id: string; nome: string; governanca: string; categoria: string | null; status: string; indexadoEm: string | null }[];
}

export function AgenteEditor({ dados, podeConfigurar, podeUsar }: { dados: DadosEditorAgente; podeConfigurar: boolean; podeUsar: boolean }) {
  const router = useRouter();
  const { agente, versoes } = dados;
  const rascunho = versoes.find((v) => v.status === "draft") ?? null;
  const publicada = versoes.find((v) => v.status === "published") ?? null;
  const trabalho = rascunho ?? publicada ?? versoes[0] ?? null;

  // Estado derivado das props: quando o servidor devolve agente/versões
  // novos (após salvar/publicar), o formulário volta a espelhar o banco.
  // Mudança só em conhecimento/execuções não mexe no que está sendo editado.
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
  // Link da lista ("Testar") entra direto na aba: ?aba=testes
  React.useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("aba");
    if (a && ABAS.some((x) => x.id === a)) setAba(a as Aba);
  }, []);
  const apoio = useApi<Apoio>("/api/automacoes/agentes-op/apoio");
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
  const setId = (patch: Partial<IdentidadeAgente>) => set({ identidade: { ...f.identidade, ...patch } });
  const faltas = faltasLocais(f, dados);
  const promptCompilado = compilarPrompt({ systemPrompt: f.systemPrompt, guardrailConfig: { escopo: f.escopo, identidade: f.identidade }, handoffConfig: { enabled: f.handoffEnabled, keywords: f.handoffKeywords } });
  const modelosDoProvedor = modelosDe(dados, f.provider);
  const credsDoProvedor = f.provider === ASSINATURA ? [] : dados.credenciais.filter((c) => c.provider === f.provider);
  const permissoes = strs(trabalho.guardrailConfig.permissoes);
  const temHandoffTool = f.tools.includes("handoff.request");
  const alternarFerramenta = (id: string, ligar: boolean) => set({ tools: ligar ? [...new Set([...f.tools, id])] : f.tools.filter((x) => x !== id) });
  const credencialOk = f.provider === ASSINATURA ? Boolean(dados.ambiente[ASSINATURA]) : Boolean(f.credentialId || (f.provider && dados.ambiente[f.provider]));

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

  const fontesApoio = apoio.dados?.fontes ?? [];
  const categoriasConhecidas = [...new Set([...fontesApoio.map((s) => s.categoria).filter((c): c is string => Boolean(c)), ...f.conhCategorias])].sort();

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
            <span className="agn-selo"><i />{NOME_MODO[f.modo]}</span>
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
          <BotaoMotivo type="button" className="agn-primario" disabled={!podePublicar || publicando} motivo={motivoPublicar} onClick={publicar}>
            {publicando ? <Loader2 size={14} className="age-gira" /> : <Send size={14} />} Publicar
          </BotaoMotivo>
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
            {a.id === "execucoes" && dados.casosAbertos.length ? <span className="age-contador">{dados.casosAbertos.length}</span> : null}
          </button>
        ))}
      </nav>

      <div className="age-grade">
        <div className="age-principal">
          {/* ── A. Identidade ── */}
          {aba === "identidade" ? (
            <>
              <Secao titulo="Identidade" ajuda="Quem é este agente. Função, objetivo, especialidade, idioma, personalidade e estilo entram no prompt que o modelo recebe.">
                <div className="age-form">
                  <div className="agn-duas">
                    <label>Nome<input value={f.nome} onChange={(e) => set({ nome: e.target.value })} maxLength={120} disabled={travado} /></label>
                    <label>Papel na operação
                      <select value={f.finalidade} onChange={(e) => set({ finalidade: e.target.value })} disabled={travado}>
                        {AGENT_PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        {!AGENT_PURPOSES.some((p) => p.id === f.finalidade) ? <option value={f.finalidade}>{f.finalidade === "copiloto" ? "Copiloto" : f.finalidade === "orquestracao" ? "Orquestração" : f.finalidade === "pre_vendas" ? "Pré-vendas" : f.finalidade}</option> : null}
                      </select>
                    </label>
                  </div>
                  <label>Função<input value={f.identidade.funcao} onChange={(e) => setId({ funcao: e.target.value })} maxLength={160} disabled={travado} placeholder="Ex.: SDR consultiva de leads inbound" /></label>
                  <label>Descrição<textarea value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} rows={2} maxLength={500} placeholder="O que ele resolve e onde deve parar. Aparece na lista de agentes." disabled={travado} /></label>
                  <label>Objetivo<textarea value={f.identidade.objetivo} onChange={(e) => setId({ objetivo: e.target.value })} rows={2} maxLength={400} placeholder="Ex.: qualificar o lead e, havendo fit, agendar uma demonstração." disabled={travado} /></label>
                  <div className="agn-duas">
                    <label>Especialidade<input value={f.identidade.especialidade} onChange={(e) => setId({ especialidade: e.target.value })} maxLength={200} disabled={travado} placeholder="Ex.: telefonia e discador preditivo" /></label>
                    <label>Idioma
                      <select value={f.identidade.idioma} onChange={(e) => setId({ idioma: e.target.value })} disabled={travado}>
                        <option value="">Não definir</option>
                        {IDIOMAS.map((i) => <option key={i} value={i}>{i}</option>)}
                        {f.identidade.idioma && !IDIOMAS.includes(f.identidade.idioma) ? <option value={f.identidade.idioma}>{f.identidade.idioma}</option> : null}
                      </select>
                    </label>
                  </div>
                  <div className="agn-duas">
                    <label>Personalidade<input value={f.identidade.personalidade} onChange={(e) => setId({ personalidade: e.target.value })} maxLength={200} disabled={travado} placeholder="Ex.: consultiva, segura, sem pressa" /></label>
                    <label>Estilo de comunicação<input value={f.identidade.estilo} onChange={(e) => setId({ estilo: e.target.value })} maxLength={200} disabled={travado} placeholder="Ex.: mensagens curtas, uma pergunta por vez" /></label>
                  </div>
                </div>
              </Secao>

              <Secao titulo="Escopo" ajuda="Cada item vira uma linha do prompt. O agente segue estas listas em toda conversa. Quando transferir para uma pessoa fica em Handoff.">
                <div className="age-listas age-listas-2">
                  <ListaEditavel titulo="Pode ajudar com" ajuda="Assuntos que ele resolve sozinho." tom="ok" travado={travado}
                    itens={f.escopo.podeAjudar} onChange={(v) => set({ escopo: { ...f.escopo, podeAjudar: v } })} exemplo="Ex.: dúvidas sobre planos e preços públicos" />
                  <ListaEditavel titulo="Não deve tratar de" ajuda="Recusa com educação e oferece uma pessoa." tom="alerta" travado={travado}
                    itens={f.escopo.naoDeveTratar} onChange={(v) => set({ escopo: { ...f.escopo, naoDeveTratar: v } })} exemplo="Ex.: cancelamento de contrato" />
                </div>
              </Secao>

              <Secao titulo="Instruções" ajuda="Objetivo, tom e jeito de conduzir a conversa. Identidade e escopo são somados a isto."
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

              <Secao titulo="Versão e supervisor" ajuda="O supervisor é a pessoa avisada quando o agente passa um atendimento, falha ou deixa uma ação aguardando aprovação.">
                <div className="age-form">
                  <div className="agn-duas">
                    <div className="age-fato"><span className="agn-rotulo">Versão em edição</span><strong>v{trabalho.versao} · {trabalho.status === "draft" ? "Rascunho" : trabalho.status === "published" ? "No ar" : "Substituída"}</strong><small>{publicada ? `No ar: v${publicada.versao}, publicada ${publicada.publishedAt ? quando(publicada.publishedAt) : ""}` : "Nenhuma versão no ar"}</small></div>
                    <label>Supervisor humano
                      <select value={f.supervisor} onChange={(e) => set({ supervisor: e.target.value })} disabled={travado || !apoio.dados}>
                        <option value="">{apoio.carregando ? "Carregando…" : "Ninguém (só a equipe do Atendimento é avisada)"}</option>
                        {apoio.dados?.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        {f.supervisor && apoio.dados && !apoio.dados.pessoas.some((p) => p.id === f.supervisor) ? <option value={f.supervisor}>Pessoa não encontrada ou inativa</option> : null}
                      </select>
                    </label>
                  </div>
                  {apoio.erro ? <p className="age-alerta-linha"><CircleAlert size={13} /> Não foi possível carregar as pessoas da organização: {apoio.erro}</p> : null}
                </div>
              </Secao>
            </>
          ) : null}

          {/* ── B. Inteligência ── */}
          {aba === "inteligencia" ? (
            <>
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
                    <Num rotulo="Passos por execução" valor={f.maxSteps} min={1} max={30} desligado={travado} onChange={(n) => set({ maxSteps: n })} ajuda="Rodadas de modelo e ferramenta. 1 a 30." />
                    <Num rotulo="Tokens por execução" valor={f.tokenBudget} min={1} max={100000} desligado={travado} onChange={(n) => set({ tokenBudget: n })} ajuda="Teto de resposta. 1 a 100.000." />
                    <label>Orçamento por execução (US$)<input inputMode="decimal" value={f.costBudget} placeholder="Sem limite" disabled={travado} onChange={(e) => set({ costBudget: e.target.value.replace(/[^\d.,]/g, "") })} /><small className="age-ajuda">Aborta a execução ao passar.</small></label>
                  </div>
                  <div className="age-tres">
                    <Num rotulo="Janela de mensagens" valor={f.janelaMsgs} min={6} max={40} desligado={travado} onChange={(n) => set({ janelaMsgs: n })} ajuda="Últimas mensagens da conversa no contexto. 6 a 40." />
                    <Num rotulo="Janela em tokens" valor={f.janelaTokens} min={500} max={100000} desligado={travado} onChange={(n) => set({ janelaTokens: n })} ajuda="Teto do histórico em tokens." />
                  </div>
                </div>
              </Secao>

              <Secao titulo="Memória" ajuda="Fatos com fonte que o agente lembra entre conversas (preferências, o que já foi dito, compromissos). Desligada, o agente trata cada contato sem lembrar o que sabia.">
                <Linha titulo="Memória ligada" ajuda="Entra no contexto de toda execução. Fatos inferidos nunca valem como dado confirmado.">
                  <Interruptor ligado={f.memoriaAtiva} rotulo="Memória ligada" desligado={travado} onChange={(v) => set({ memoriaAtiva: v })} />
                </Linha>
              </Secao>

              <Secao titulo="Recuperação de conhecimento" ajuda="Quais trechos da base de conhecimento entram no contexto. Só conhecimento aprovado conta (aba Conhecimento).">
                <div className="age-form">
                  <Linha titulo="Recuperação ligada" ajuda="Desligada, o agente responde sem consultar a base.">
                    <Interruptor ligado={f.conhAtivo} rotulo="Recuperação de conhecimento ligada" desligado={travado} onChange={(v) => set({ conhAtivo: v })} />
                  </Linha>
                  {f.conhAtivo ? (
                    <>
                      <div>
                        <span className="agn-rotulo age-rot">Categorias consultadas ({f.conhCategorias.length ? f.conhCategorias.length : "todas"})</span>
                        <div className="age-chips" style={{ marginTop: 8 }}>
                          {categoriasConhecidas.length === 0 ? <span className="age-chips-vazio">Nenhuma fonte tem categoria ainda. Sem seleção, o agente consulta todas as fontes aprovadas.</span> : null}
                          {categoriasConhecidas.map((c) => {
                            const on = f.conhCategorias.includes(c);
                            return <button key={c} type="button" className="age-chip age-chip-botao" aria-pressed={on} disabled={travado}
                              onClick={() => set({ conhCategorias: on ? f.conhCategorias.filter((x) => x !== c) : [...f.conhCategorias, c] })}>{c}</button>;
                          })}
                        </div>
                      </div>
                      <div style={{ maxWidth: 260 }}><Num rotulo="Máximo de trechos" valor={f.maxTrechos} min={1} max={8} desligado={travado} onChange={(n) => set({ maxTrechos: n })} ajuda="Trechos por consulta. 1 a 8." /></div>
                    </>
                  ) : null}
                </div>
              </Secao>
            </>
          ) : null}

          {/* ── C. Conhecimento ── */}
          {aba === "conhecimento" ? (
            <Conhecimento dados={dados} form={f} set={set} travado={travado} apoio={apoio} onMudou={() => router.refresh()} />
          ) : null}

          {/* ── D. Ferramentas ── */}
          {aba === "ferramentas" ? (
            <AbaFerramentas tools={f.tools} onToggle={alternarFerramenta} travado={travado} ferramentasLegadas={ferramentasLegadas} permissoes={permissoes} />
          ) : null}

          {/* ── E. Autonomia ── */}
          {aba === "autonomia" ? (
            <>
              <Secao titulo="Modo geral" ajuda="Até onde o agente vai sozinho, quando a classe de ação não tem regra própria. Vale para a versão publicada; o Playground e a simulação nunca enviam.">
                <Radiogroup className="age-modos" rotulo="Modo geral de autonomia">
                  {MODOS.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={f.modo === m.id} className="age-modo" disabled={travado} onClick={() => set({ modo: m.id })}>
                      <span className="age-modo-topo"><i />{m.nome}</span>
                      <span>{m.texto}</span>
                    </button>
                  ))}
                </Radiogroup>
              </Secao>

              <Secao titulo="Autonomia por classe de ação" ajuda="Cada classe tem o seu botão, independente das outras. Exemplo: responder sozinho, mas pedir aprovação para mover oportunidade. Autonomia nunca concede permissão: o teto de RBAC continua valendo.">
                <div className="age-classes">
                  {CLASSES_AUTONOMIA.map((c) => (
                    <div key={c.id} className="age-classe">
                      <div><strong>{c.rotulo}</strong><span>{c.ajuda}{c.id === "leitura" ? " Leitura nunca é bloqueada." : ""}</span></div>
                      <select value={f.porAcao[c.id]} disabled={travado} aria-label={`Autonomia: ${c.rotulo}`} onChange={(e) => set({ porAcao: { ...f.porAcao, [c.id]: e.target.value as Modo | "" } })}>
                        <option value="">Segue o modo geral ({NOME_MODO[f.modo]})</option>
                        {MODOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </Secao>

              <Secao titulo="Horário e limites" ajuda="Travas por conversa. O agente respeita estes limites mesmo no modo autônomo.">
                <div className="age-form">
                  <Linha titulo="Só iniciar contato em horário comercial" ajuda="Vale para primeiro contato e retomadas. Fuso de São Paulo.">
                    <Interruptor ligado={f.horarioAtivo} rotulo="Limitar ao horário comercial" desligado={travado} onChange={(v) => set({ horarioAtivo: v })} />
                  </Linha>
                  {f.horarioAtivo ? (
                    <>
                      <div className="age-dias" role="group" aria-label="Dias da semana">
                        {DIAS.map((d, i) => {
                          const on = f.dias.includes(i);
                          return <button key={d} type="button" className="age-chip age-chip-botao" aria-pressed={on} disabled={travado}
                            onClick={() => set({ dias: on ? f.dias.filter((x) => x !== i) : [...f.dias, i].sort() })}>{d}</button>;
                        })}
                      </div>
                      <div className="agn-duas">
                        <label>Início<input type="time" value={f.inicio} disabled={travado} onChange={(e) => set({ inicio: e.target.value })} /></label>
                        <label>Fim<input type="time" value={f.fim} disabled={travado} onChange={(e) => set({ fim: e.target.value })} /></label>
                      </div>
                      {f.dias.length === 0 ? <p className="age-alerta-linha"><CircleAlert size={13} /> Escolha pelo menos um dia.</p> : null}
                    </>
                  ) : null}
                  <Linha titulo="Responder fora do horário" ajuda="Quando o contato escreve primeiro, o agente responde mesmo fora da janela.">
                    <Interruptor ligado={f.responderFora} rotulo="Responder fora do horário" desligado={travado} onChange={(v) => set({ responderFora: v })} />
                  </Linha>
                  <div className="age-tres">
                    <Num rotulo="Mensagens por hora" valor={f.porHora} min={1} max={60} desligado={travado} onChange={(n) => set({ porHora: n })} ajuda="Por conversa. 1 a 60." />
                    <Num rotulo="Mensagens por dia" valor={f.porDia} min={1} max={500} desligado={travado} onChange={(n) => set({ porDia: n })} ajuda="Por conversa. 1 a 500." />
                    <Num rotulo="Sem retorno" valor={f.semRetorno} min={0} max={20} desligado={travado} onChange={(n) => set({ semRetorno: n })} ajuda="Mensagens seguidas sem resposta antes de parar. 0 a 20." />
                  </div>
                </div>
              </Secao>

              <Secao titulo="Follow-up inteligente" ajuda="Retomadas que o próprio agente agenda quando o contato pede retorno (&ldquo;me chama quinta&rdquo;). No horário, ele relê o contexto e decide a mensagem. Não é cadência: não há sequência de passos.">
                <div className="age-tres">
                  <Num rotulo="Máximo de retomadas" valor={f.maxRetomadas} min={0} max={20} desligado={travado} onChange={(n) => set({ maxRetomadas: n })} ajuda="Por conversa, dentro da janela. 0 a 20." />
                  <Num rotulo="Janela em dias" valor={f.janelaDias} min={1} max={180} desligado={travado} onChange={(n) => set({ janelaDias: n })} ajuda="Período em que as retomadas são contadas. 1 a 180." />
                  <Num rotulo="Horizonte máximo (dias)" valor={f.maxDiasRetomada} min={1} max={365} desligado={travado} onChange={(n) => set({ maxDiasRetomada: n })} ajuda="Quão longe uma retomada pode ser marcada. 1 a 365." />
                </div>
              </Secao>

              <Secao titulo="Agenda" ajuda="Como o agente confirma horários de reunião.">
                <Linha titulo="Exigir Outlook conectado" ajuda="Só oferece e confirma horário quando a agenda da closer pôde ser verificada no Outlook. Desligado, vale só a agenda do CRM.">
                  <Interruptor ligado={f.exigirOutlook} rotulo="Exigir Outlook" desligado={travado} onChange={(v) => set({ exigirOutlook: v })} />
                </Linha>
              </Secao>
            </>
          ) : null}

          {/* ── F. Canais ── */}
          {aba === "canais" ? (
            <>
              <Secao titulo="WhatsApp" ajuda="Por onde o agente pode falar com o contato.">
                <div className="age-form">
                  <Linha titulo="WhatsApp ligado" ajuda="Desligado, o agente continua analisando e preparando, mas nenhuma execução real responde por WhatsApp.">
                    <Interruptor ligado={f.canalWhats} rotulo="WhatsApp ligado" desligado={travado} onChange={(v) => set({ canalWhats: v })} />
                  </Linha>
                  <div className="age-aviso-canal" role="note">
                    <CircleAlert size={14} />
                    <span><strong>Uma conexão existente não pertence ao agente.</strong> O número continua sendo da organização (ou da pessoa dona). Autorizar aqui só permite que este agente atenda por ele; desconectar ou trocar o número é feito em Ajustes → WhatsApp e afeta o agente na hora.</span>
                  </div>
                  {f.canalWhats ? (
                    <div>
                      <span className="agn-rotulo age-rot">Números autorizados ({f.sessoes.length || (trabalho.channelSessionId ? 1 : 0)})</span>
                      {apoio.carregando ? <Aviso><Loader2 size={13} className="age-gira" /> Carregando números…</Aviso> : null}
                      {apoio.erro ? <Aviso tom="alerta">Não foi possível carregar os números: {apoio.erro}</Aviso> : null}
                      {apoio.dados && apoio.dados.sessoes.length === 0 ? <div className="age-vazio"><strong>Nenhum número de WhatsApp conectado nesta organização</strong><span>Conecte um em Ajustes → WhatsApp para autorizar o agente.</span></div> : null}
                      {apoio.dados && apoio.dados.sessoes.length ? (
                        <ul className="age-numeros">
                          {apoio.dados.sessoes.map((s) => {
                            const fixo = trabalho.channelSessionId === s.id;
                            const on = fixo || f.sessoes.includes(s.id);
                            return (
                              <li key={s.id}>
                                <label>
                                  <input type="checkbox" checked={on} disabled={travado || fixo} onChange={(e) => set({ sessoes: e.target.checked ? [...f.sessoes, s.id] : f.sessoes.filter((x) => x !== s.id) })} />
                                  <span><strong>{s.nome}</strong><small>{s.telefone ?? "sem telefone"}{s.finalidade ? ` · ${s.finalidade}` : ""}{fixo ? " · número fixo desta versão" : ""}</small></span>
                                </label>
                                <span className="agn-selo" data-tom={s.status === "connected" ? "ok" : "alerta"}><i />{s.status === "connected" ? "Conectado" : s.status ?? "Desconectado"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {apoio.dados && f.sessoes.length === 0 && !trabalho.channelSessionId ? <p className="age-texto-fraco" style={{ marginTop: 8 }}>Sem número autorizado, o agente só responde pelo número da própria conversa, quando a política de canal permitir.</p> : null}
                    </div>
                  ) : null}
                </div>
              </Secao>
              <Secao titulo="Telefonia" ajuda="Ligação por voz feita pelo agente.">
                <div className="age-vazio"><span className="agn-selo" data-tom="alerta"><i />Indisponível</span><span>Este ambiente não tem conector de telefonia para agentes. A voz com IA da Callface é o Callpilot, que é outro módulo; o agente de texto não liga.</span></div>
              </Secao>
            </>
          ) : null}

          {/* ── G. Gatilhos e atribuição ── */}
          {aba === "gatilhos" ? (
            <AbaGatilhos agenteId={agente.id} events={f.events} onToggleEvento={(id) => set({ events: f.events.includes(id) ? f.events.filter((x) => x !== id) : [...f.events, id] })}
              prioridade={f.prioridade} onPrioridade={(n) => set({ prioridade: n })} travado={travado} />
          ) : null}

          {/* ── H. Handoff ── */}
          {aba === "handoff" ? (
            <>
              <Secao titulo="Quando transferir" ajuda="O agente para e chama uma pessoa nestas situações. Entram no prompt e valem também antes do modelo, para pedido de humano e assunto sensível."
                direita={<Interruptor ligado={f.handoffEnabled} rotulo="Handoff ligado" desligado={travado} onChange={(v) => set({ handoffEnabled: v })} />}>
                <div className="age-listas age-listas-2">
                  <ListaEditavel titulo="Transferir para humano quando" ajuda="Situações descritas em palavras." tom="humano" travado={travado}
                    itens={f.escopo.transferirQuando} onChange={(v) => set({ escopo: { ...f.escopo, transferirQuando: v } })} exemplo="Ex.: pedir desconto ou condição especial" />
                  {f.handoffEnabled ? (
                    <ListaEditavel titulo="Expressões do contato" ajuda="Frases que disparam a transferência." travado={travado}
                      itens={f.handoffKeywords} onChange={(v) => set({ handoffKeywords: v })} exemplo="Ex.: quero falar com uma pessoa" />
                  ) : <p className="age-texto-fraco">Handoff desligado: as expressões não entram no prompt. As situações da lista ao lado continuam valendo.</p>}
                </div>
                {!temHandoffTool ? (
                  <p className="age-alerta-linha"><CircleAlert size={13} /> A ferramenta Solicitar atendimento humano está desligada: sem ela o agente não consegue transferir.
                    {!travado ? <button type="button" onClick={() => alternarFerramenta("handoff.request", true)}>Ligar</button> : null}</p>
                ) : null}
              </Secao>

              <Secao titulo="Para quem e com que prioridade" ajuda="Quem recebe: a pessoa responsável pelo lead (pela regra de roteamento ou delegação) e o supervisor definido em Identidade, que é avisado.">
                <div className="age-form">
                  <div style={{ maxWidth: 280 }}>
                    <label>Prioridade do handoff
                      <select value={f.prioridadeHandoff} onChange={(e) => set({ prioridadeHandoff: e.target.value })} disabled={travado}>
                        {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="age-texto-fraco">Supervisor atual: {f.supervisor ? apoio.dados?.pessoas.find((p) => p.id === f.supervisor)?.nome ?? "pessoa definida" : "ninguém definido"}. Urgente também sobe a severidade do alerta.</p>
                </div>
              </Secao>

              <Secao titulo="Transição" ajuda="O que acontece na hora de passar e depois dela.">
                <div className="age-form">
                  <label>Mensagem de transição<textarea value={f.mensagemTransicao} onChange={(e) => set({ mensagemTransicao: e.target.value })} rows={3} maxLength={600} disabled={travado}
                    placeholder="Ex.: Vou passar você para uma pessoa do nosso time, que já recebe todo o histórico desta conversa." /></label>
                  <Linha titulo="Resumo obrigatório" ajuda="Sem resumo claro do que foi conversado, a transferência é recusada: quem assume não pode receber um atendimento sem contexto.">
                    <Interruptor ligado={f.resumoObrigatorio} rotulo="Resumo obrigatório" desligado={travado} onChange={(v) => set({ resumoObrigatorio: v })} />
                  </Linha>
                  <Linha titulo="Continua como copiloto interno" ajuda="Depois de passar, o agente segue ajudando a pessoa com sugestões e resumo, sem enviar nada ao contato.">
                    <Interruptor ligado={f.copilotoApos} rotulo="Continua como copiloto interno" desligado={travado} onChange={(v) => set({ copilotoApos: v })} />
                  </Linha>
                  <label>Regra de retomada
                    <select value={f.retomada} onChange={(e) => set({ retomada: e.target.value })} disabled={travado}>
                      <option value="somente_humano">Só uma pessoa devolve o atendimento ao agente</option>
                      <option value="automatica">Automática: o agente reassume se ninguém responder</option>
                      {f.retomada !== "somente_humano" && f.retomada !== "automatica" ? <option value={f.retomada}>{f.retomada}</option> : null}
                    </select>
                    <small className="age-ajuda">{f.retomada === "automatica" ? "Se o contato escrever depois do handoff e nenhuma pessoa responder dentro do prazo, o atendimento volta ao agente." : "O agente só volta a conduzir quando alguém usa Retomar no Atendimento."}</small>
                  </label>
                  {f.retomada === "automatica" ? <div style={{ maxWidth: 280 }}><Num rotulo="Devolver ao agente após (horas)" valor={f.retomadaHoras} min={1} max={720} desligado={travado} onChange={(n) => set({ retomadaHoras: n })} ajuda="Sem resposta humana. 1 a 720." /></div> : null}
                </div>
              </Secao>
            </>
          ) : null}

          {/* ── I. Testes e versões ── */}
          {aba === "testes" ? (
            <AbaTestes agenteId={agente.id} versoes={versoes} trabalho={trabalho} rascunho={rascunho} publicada={publicada} podeUsar={podeUsar} podeConfigurar={podeConfigurar}
              sujo={sujo} salvar={() => salvar(true)} publicar={publicar} publicando={publicando} faltas={faltas} credencialOk={credencialOk}
              onCarregar={(v) => {
                setForm({ ...formDe(agente, v), nome: f.nome, descricao: f.descricao, finalidade: f.finalidade, prioridade: f.prioridade });
                setAba("identidade");
                toast.success(`Conteúdo da v${v.versao} carregado. Salve para virar o rascunho.`);
              }} />
          ) : null}

          {/* ── Execuções ── */}
          {aba === "execucoes" ? (
            <>
              <Casos agenteId={agente.id} casos={dados.casosAbertos} podeUsar={podeUsar} onMudou={() => router.refresh()} />
              <AbaExecucoes agenteId={agente.id} />
            </>
          ) : null}
        </div>

        <Playground bloqueio={bloqueioTeste} aviso={avisoTeste} testar={testar} />
      </div>
    </div>
  );
}

/* ── Conhecimento ─────────────────────────────────────────────────── */

const GOVERNANCA = [
  { id: "aprovado", nome: "Aprovado", texto: "Vale como verdade comercial. É o único que o agente consulta." },
  { id: "rascunho", nome: "Rascunho", texto: "Em revisão. Não entra na resposta." },
  { id: "historico", nome: "Histórico", texto: "Guardado, desatualizado. Não entra na resposta." },
] as const;

function Conhecimento({ dados, form, set, travado, apoio, onMudou }: {
  dados: DadosEditorAgente; form: Form; set: (p: Partial<Form>) => void; travado: boolean; apoio: ReturnType<typeof useApi<Apoio>>; onMudou: () => void;
}) {
  const [nome, setNome] = React.useState("");
  const [conteudo, setConteudo] = React.useState("");
  const [enderecoFonte, setEnderecoFonte] = React.useState("");
  const [arquivoFonte, setArquivoFonte] = React.useState<File | null>(null);
  const [tipoFonte, setTipoFonte] = React.useState<"texto" | "site" | "arquivo">("texto");
  const [memoria, setMemoria] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [ocupada, setOcupada] = React.useState<string | null>(null);
  const busca = form.tools.includes("knowledge.search");
  const memoriaOn = form.tools.includes("memory.read");
  const alternar = (id: string, v: boolean) => set({ tools: v ? [...new Set([...form.tools, id])] : form.tools.filter((x) => x !== id) });
  const STATUS: Record<string, string> = { ready: "Indexada", indexing: "Indexando", pending: "Sem conteúdo", failed: "Falhou", archived: "Arquivada" };
  const tipoDe = new Map(dados.conhecimento.map((k) => [k.id, k.tipo]));
  const fontes = apoio.dados?.fontes ?? [];
  const aprovadas = fontes.filter((s) => s.governanca === "aprovado" && s.status === "ready").length;

  async function governar(id: string, corpo: { governanca?: string; categoria?: string | null }, ok: string) {
    setOcupada(id);
    try { await api(`/api/automacoes/agentes-op/conhecimento/${id}`, { method: "PATCH", body: JSON.stringify(corpo) }); toast.success(ok); apoio.recarregar(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a fonte."); }
    finally { setOcupada(null); }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (tipoFonte === "texto" && (!nome.trim() || !conteudo.trim())) return;
    if (tipoFonte === "site" && (!nome.trim() || !enderecoFonte.trim())) return;
    if (tipoFonte === "arquivo" && !arquivoFonte) return;
    setEnviando(true);
    try {
      if (tipoFonte === "arquivo") {
        const dados = new FormData();
        dados.append("arquivo", arquivoFonte!);
        if (nome.trim()) dados.append("nome", nome.trim());
        await api("/api/automacoes/ai/knowledge/upload", { method: "POST", body: dados });
      } else {
        await api("/api/automacoes/ai/knowledge", {
          method: "POST",
          body: JSON.stringify(tipoFonte === "site"
            ? { nome: nome.trim(), sourceType: "url", sourceUri: enderecoFonte.trim() }
            : { nome: nome.trim(), sourceType: "text", content: conteudo.trim() }),
        });
      }
      toast.success("Fonte importada em rascunho. Revise e selecione Aprovado para disponibilizar ao agente.");
      setNome(""); setConteudo(""); setEnderecoFonte(""); setArquivoFonte(null);
      apoio.recarregar(); onMudou();
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
      <Secao titulo="Fontes e governança" ajuda="Fontes da organização, compartilhadas por todos os agentes que têm Buscar conhecimento ligado. Só conhecimento aprovado vale: rascunho e histórico ficam guardados, mas nunca entram na resposta."
        direita={<label className="age-liga">Este agente consulta<Interruptor ligado={busca} rotulo="Buscar conhecimento" desligado={travado} onChange={(v) => alternar("knowledge.search", v)} /></label>}>
        {apoio.carregando ? <Aviso><Loader2 size={13} className="age-gira" /> Carregando fontes…</Aviso> : null}
        {apoio.erro ? <Aviso tom="alerta">Não foi possível carregar as fontes: {apoio.erro}</Aviso> : null}
        {apoio.dados && fontes.length === 0 ? (
          <div className="age-vazio"><strong>Nenhuma fonte ainda</strong><span>Cole abaixo um texto de referência (preços públicos, FAQ, políticas). Ele é dividido em trechos e fica disponível na hora, depois de aprovado.</span></div>
        ) : null}
        {apoio.dados && fontes.length ? (
          <>
            <p className="age-texto-fraco" style={{ marginBottom: 10 }}><strong>{aprovadas} de {fontes.length}</strong> fontes valem para o agente agora (aprovadas e indexadas).</p>
            <ul className="age-fontes age-fontes-gov">
              {fontes.map((k) => (
                <li key={k.id} data-gov={k.governanca}>
                  <div className="age-fonte-nome">
                    <strong>{k.nome}</strong>
                    <span>{tipoDe.get(k.id) === "url" ? "Link" : tipoDe.get(k.id) === "faq" ? "FAQ" : tipoDe.get(k.id) === "text" ? "Texto" : "Fonte"}{k.indexadoEm ? ` · ${quando(k.indexadoEm)}` : ""}</span>
                  </div>
                  <span className="agn-selo" data-tom={k.status === "ready" ? "ok" : k.status === "failed" ? "alerta" : undefined}><i />{STATUS[k.status] ?? k.status}</span>
                  <label className="age-fonte-cat">Categoria
                    <input defaultValue={k.categoria ?? ""} disabled={travado || ocupada === k.id} maxLength={40} placeholder="Sem categoria" aria-label={`Categoria de ${k.nome}`}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (k.categoria ?? "")) void governar(k.id, { categoria: v || null }, "Categoria atualizada."); }} />
                  </label>
                  <label className="age-fonte-gov">Governança
                    <select value={k.governanca} disabled={travado || ocupada === k.id} aria-label={`Governança de ${k.nome}`}
                      onChange={(e) => void governar(k.id, { governanca: e.target.value }, `Fonte marcada como ${GOVERNANCA.find((g) => g.id === e.target.value)?.nome.toLowerCase()}.`)}>
                      {GOVERNANCA.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {!travado ? (
          <form className="age-form age-nova-fonte" onSubmit={adicionar}>
            <strong>Adicionar conhecimento</strong>
            <span className="age-texto-fraco">A fonte entra em rascunho e só passa a orientar o agente quando você aprová-la.</span>
            <div className="age-linha-acoes" role="group" aria-label="Tipo de fonte">
              {(["texto", "site", "arquivo"] as const).map((tipo) => (
                <button key={tipo} type="button" className={tipoFonte === tipo ? "agn-primario" : "agn-secundario"} aria-pressed={tipoFonte === tipo} onClick={() => setTipoFonte(tipo)} disabled={enviando}>
                  {tipo === "texto" ? "Colar texto" : tipo === "site" ? "Importar site" : "Enviar arquivo"}
                </button>
              ))}
            </div>
            <label>Nome da fonte
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipoFonte === "arquivo" ? "Opcional: nome de exibição" : "Ex.: FAQ comercial 2026"} maxLength={150} />
            </label>
            {tipoFonte === "texto" ? <label>Conteúdo
              <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={5} placeholder="Cole informações comerciais oficiais, FAQ ou políticas aprovadas." />
            </label> : null}
            {tipoFonte === "site" ? <label>Endereço HTTPS público
              <input type="url" value={enderecoFonte} onChange={(e) => setEnderecoFonte(e.target.value)} placeholder="https://suaempresa.com.br/solucoes" />
              <span className="age-texto-fraco">Importa o texto de uma página pública. Não acessa áreas logadas nem coleta sites inteiros automaticamente.</span>
            </label> : null}
            {tipoFonte === "arquivo" ? <label>Documento para extrair e indexar
              <input type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm" onChange={(e) => setArquivoFonte(e.currentTarget.files?.[0] ?? null)} />
              <span className="age-texto-fraco">PDF, DOCX, TXT, MD, CSV, JSON e HTML · até 6 MB. PDFs digitalizados sem texto exigem OCR fora desta tela.</span>
            </label> : null}
            <div><button type="submit" className="agn-secundario" disabled={enviando || (tipoFonte === "texto" ? !nome.trim() || !conteudo.trim() : tipoFonte === "site" ? !nome.trim() || !enderecoFonte.trim() : !arquivoFonte)}>
              {enviando ? <Loader2 size={13} className="age-gira" /> : <Plus size={13} />} {enviando ? "Importando…" : "Importar em rascunho"}
            </button></div>
          </form>
        ) : null}
      </Secao>

      <Secao titulo="Memória da organização" ajuda="Documento curto com fatos que valem para toda conversa. Versionado: cada salvar publica uma nova versão. A memória de cada contato (o que ele já disse) é outra, por contato."
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

/* Aprovação (source tool_approval) é a MESMA peça da conversa (AprovacoesPendentes): mensagem com prévia,
 * "Aprovar e enviar", "Editar e enviar" e "Descartar"; ação com a entrada legível. Os demais casos
 * (dúvida que o agente abriu) seguem com "Marcar resolvido". */
function Casos({ agenteId, casos, podeUsar, onMudou }: { agenteId: string; casos: DadosEditorAgente["casosAbertos"]; podeUsar: boolean; onMudou: () => void }) {
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const aprov = useCasosAbertos({ agentId: agenteId, source: "tool_approval" }, true);
  const recarregarAprov = aprov.recarregar;
  // Recarrega junto com o dado do servidor (router.refresh troca `casos`).
  React.useEffect(() => { void recarregarAprov(); }, [recarregarAprov, casos]);
  const outros = casos.filter((c) => c.origem !== "tool_approval");
  // Enquanto a lista da rota não chega, o dado do servidor diz se há aprovação.
  const temAprovacao = aprov.erro ? true : aprov.casos ? aprov.casos.length > 0 : casos.some((c) => c.origem === "tool_approval");
  if (outros.length === 0 && !temAprovacao) return null;
  async function agir(id: string, action: string, ok: string) {
    setOcupado(id);
    try { await api(`/api/automacoes/ai/cases/${id}/action`, { method: "POST", body: JSON.stringify({ action }) }); toast.success(ok); onMudou(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível concluir."); }
    finally { setOcupado(null); }
  }
  return (
    <Secao titulo="Aguardando a equipe" ajuda="Ações que o agente preparou no modo Sob aprovação, ou dúvidas que ele abriu como caso.">
      <AprovacoesPendentes casos={aprov.casos} erro={aprov.erro} comConversa somenteLeitura={!podeUsar}
        aoDecidir={async () => { await recarregarAprov(); onMudou(); }} />
      {outros.length ? (
        <ul className="age-casos">
          {outros.map((c) => (
            <li key={c.id}>
              <div><strong>{c.titulo}</strong><span>{c.resumo} · {quando(c.aberto)}</span></div>
              {podeUsar ? (
                <div className="age-linha-acoes">
                  <button type="button" className="agn-secundario" disabled={ocupado === c.id} onClick={() => agir(c.id, "resolve", "Caso resolvido.")}>Marcar resolvido</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Secao>
  );
}
