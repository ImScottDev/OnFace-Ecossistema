"use client";

/* Agente de IA conduzindo um atendimento: peças compartilhadas entre o Atendimento
 * (gaveta da conversa) e o Pipeline (diálogo da oportunidade). Delegar NÃO pede
 * cadência: o agente assume contexto e objetivo e planeja as próprias retomadas.
 * Rotas: /api/automacoes/agentes-op/*. Regra de negócio mora no servidor. */
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import "./agente-operacao.css";
// Catálogo estático do estúdio (sem banco): traduz o nome técnico da ferramenta nas aprovações.
import { AGENT_TOOL_CATALOG } from "@/lib/ai/agent-studio";

export const CATALOGO_FERRAMENTAS: { id: string; nome: string }[] = AGENT_TOOL_CATALOG.map((t) => ({ id: t.id, nome: t.nome }));

export const AO = "/api/automacoes/agentes-op";

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || j.message || "A operação não foi aceita.");
  return j as T;
}
export const enviar = <T = any>(url: string, metodo: string, corpo?: unknown) =>
  api<T>(url, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });

export type AgenteOp = { id: string; nome: string; finalidade: string; autonomia: string | null };
export type AlvoAtribuicao = { contatoId?: string | null; leadId?: string | null; negocioId?: string | null };
export type AtribuicaoOp = {
  id: string; agentId: string; agente?: string | null; status: string; objetivo: string | null; autonomia: string | null;
  motivoEstado: string | null; resumoHandoff: string | null; copiloto: boolean; humanoUsuarioId: string | null;
  ultimoRunId: string | null; ultimaExecucaoEm: string | null; createdAt: string; contatoId: string | null; leadId: string | null; negocioId: string | null;
};
export type CompromissoOp = { id: string; tipo: string; motivo: string; instrucao: string | null; dueAt: string; status: string; bloqueioMotivo: string | null };

/** Estado do agente numa conversa ou oportunidade, na linguagem da tela. */
export const ESTADOS_AGENTE: Record<string, { rotulo: string; variante: "success" | "warning" | "danger" | "info" | "secondary" }> = {
  ativa: { rotulo: "Agente ativo", variante: "success" },
  pausada: { rotulo: "Agente pausado", variante: "secondary" },
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", variante: "warning" },
  humano: { rotulo: "Sob responsabilidade humana", variante: "info" },
  falha: { rotulo: "Falha de execução", variante: "danger" },
  sem_agente: { rotulo: "Sem agente elegível", variante: "secondary" },
  desligada: { rotulo: "Resposta automática desligada", variante: "secondary" },
  encerrada: { rotulo: "Atuação encerrada", variante: "secondary" },
};
export const AUTONOMIAS: Record<string, string> = { suggest: "Copiloto (só sugere)", approval: "Sob aprovação", autonomous: "Autônomo controlado" };

/* Motivo gravado na atribuição (código do servidor ou frase do agente) na linguagem curta da tela.
 * O que não está aqui é frase livre do agente (handoff_request) e aparece como veio. */
const MOTIVOS_CURTOS: Record<string, string> = {
  reuniao_agendada: "Reunião agendada",
  humano_respondeu_na_conversa: "Uma pessoa respondeu na conversa",
  descadastro: "Cliente pediu para não receber mensagens",
  manual_toggle: "Pausada por uma pessoa",
  "Pausado por uma pessoa": "Pausada por uma pessoa",
  "pausado por uma pessoa": "Pausada por uma pessoa",
  "O cliente pediu para falar com uma pessoa": "Pedido do cliente",
  "O cliente pediu para não receber mais mensagens": "Cliente pediu para não receber mensagens",
  "Pessoa assumiu a conversa": "Uma pessoa assumiu",
  "Pessoa assumiu o atendimento": "Uma pessoa assumiu",
  "Responsável alterado para uma pessoa": "Responsável trocado para uma pessoa",
};
export function rotuloMotivo(motivo: string | null | undefined): string | null {
  const m = motivo?.trim();
  if (!m) return null;
  if (MOTIVOS_CURTOS[m]) return MOTIVOS_CURTOS[m];
  if (m.startsWith("O cliente trouxe um assunto sensível")) return "Assunto sensível";
  return m;
}

/** Estado na linguagem da conversa (Atendimento): quem está com o contato agora. */
export function estadoDaConversa(estado: string, p: { humano?: string | null; motivo?: string | null } = {}) {
  const motivo = rotuloMotivo(p.motivo);
  if (estado === "ativa") return { rotulo: "IA atendendo", variante: "success" as const, detalhe: null };
  if (estado === "pausada") {
    // O servidor ainda não grava QUEM pausou a atribuição: sem nome, o motivo "Pausada por uma pessoa" é o rótulo.
    if (p.humano) return { rotulo: `Pausada por ${p.humano}`, variante: "secondary" as const, detalhe: motivo };
    if (motivo?.startsWith("Pausada por")) return { rotulo: motivo, variante: "secondary" as const, detalhe: null };
    return { rotulo: "Pausada por uma pessoa", variante: "secondary" as const, detalhe: motivo };
  }
  if (estado === "humano") return { rotulo: `Com humano: ${p.humano ?? "sem responsável definido"}`, variante: "info" as const, detalhe: motivo };
  if (estado === "aguardando_aprovacao") return { rotulo: "Aguardando aprovação", variante: "warning" as const, detalhe: null };
  const e = ESTADOS_AGENTE[estado] ?? { rotulo: estado, variante: "secondary" as const };
  return { rotulo: e.rotulo, variante: e.variante, detalhe: null };
}

/**
 * Selo do estado do agente. Sem `conversa`, o rótulo geral (Pipeline e listas).
 * Com `conversa`, a linha da conversa: "IA atendendo", "Com humano: Ana — Reunião agendada"…
 */
export function SeloEstadoAgente({ estado, conversa }: { estado: string; conversa?: { humano?: string | null; motivo?: string | null } }) {
  if (!conversa) {
    const e = ESTADOS_AGENTE[estado] ?? { rotulo: estado, variante: "secondary" as const };
    return <Badge variant={e.variante}>{e.rotulo}</Badge>;
  }
  const e = estadoDaConversa(estado, conversa);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="agente-linha-estado">
      <Badge variant={e.variante}>{e.rotulo}</Badge>
      {e.detalhe ? <span className="text-corpo text-tinta-suave">{e.detalhe}</span> : null}
    </span>
  );
}

/* ── Aprovações pendentes da conversa ─────────────────────────────────
 * Casos que o agente abriu em "Sob aprovação" (ai_cases, source tool_approval). A decisão é a
 * rota /api/automacoes/ai/cases/:id/action: aprovar mensagem ENVIA (com `body`, envia o texto
 * editado no lugar do proposto); aprovar ação executa com as permissões delegadas da versão. */

export type CasoAprovacao = {
  id: string; contatoId: string; status: string; source: string; title: string; summary: string; openedAt: string;
  contextSnapshot: { kind?: string; mensagens?: unknown; toolName?: unknown; toolInput?: unknown } | null;
};

const CHAVES: Record<string, string> = {
  motivo: "Motivo", resumo: "Resumo", proximo_passo: "Próximo passo", prioridade: "Prioridade", titulo: "Título", title: "Título",
  descricao: "Descrição", inicio: "Início", fim: "Fim", data: "Data", quando: "Quando", valor: "Valor", etapa: "Etapa", status: "Status",
  nome: "Nome", email: "E-mail", telefone: "Telefone", mensagem: "Mensagem", mensagem_transicao: "Mensagem ao contato", texto: "Texto",
  closerId: "Closer", responsavelId: "Responsável", duracao: "Duração", messages: "Mensagens", observacao: "Observação",
};
const valorLegivel = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v))) return quando(v);
  if (Array.isArray(v)) return v.map(valorLegivel).join("; ");
  if (typeof v === "object") return JSON.stringify(v);
  const t = String(v);
  return t.length > 280 ? `${t.slice(0, 279)}…` : t;
};
/** Entrada da ferramenta em linhas "Rótulo: valor", sem JSON cru. */
export function resumoDaEntrada(entrada: unknown): { chave: string; valor: string }[] {
  if (!entrada || typeof entrada !== "object") return [];
  return Object.entries(entrada as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({ chave: CHAVES[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " "), valor: valorLegivel(v) }));
}
const normalizar = (s: string) => s.replace(/[.\-]/g, "_");
/** Nome da ferramenta para gente: o catálogo do estúdio (sem banco), casando "handoff_request" com "handoff.request". */
export function nomeDaFerramenta(nome: string, catalogo: { id: string; nome: string }[]): string {
  return catalogo.find((t) => t.id === nome || normalizar(t.id) === normalizar(nome))?.nome ?? nome.replace(/[._]/g, " ");
}

/** Casos de aprovação abertos de UMA conversa. Não carrega sozinho: `recarregar` vem junto com o carregamento do painel. */
export function useAprovacoesDaConversa(contatoId: string | null, ativo: boolean) {
  const [casos, setCasos] = React.useState<CasoAprovacao[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const carregar = React.useCallback(async () => {
    if (!contatoId) return;
    try {
      // A rota lista os casos da organização (250 mais recentes); o recorte da conversa é aqui.
      const r = await api<{ cases: CasoAprovacao[] }>("/api/automacoes/ai/cases");
      setCasos(r.cases.filter((c) => c.contatoId === contatoId && c.status === "awaiting_human" && c.source === "tool_approval"));
      setErro(null);
    } catch (e) { setErro((e as Error).message); setCasos([]); }
  }, [contatoId]);
  // Ao abrir, zera o que era de outra conversa; quem usa chama `recarregar` junto com o resto do painel.
  React.useEffect(() => { if (ativo) { setCasos(null); setErro(null); } }, [ativo, contatoId]);
  return { casos, erro, recarregar: carregar };
}

/** Lista das aprovações pendentes, com decisão inline. Desabilita o caso enquanto a rota responde e mostra o erro dela. */
export function AprovacoesPendentes({ casos, erro, catalogo = CATALOGO_FERRAMENTAS, aoDecidir }: {
  casos: CasoAprovacao[] | null; erro: string | null; catalogo?: { id: string; nome: string }[]; aoDecidir: () => void | Promise<void>;
}) {
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const [falhas, setFalhas] = React.useState<Record<string, string>>({});
  const [editando, setEditando] = React.useState<{ id: string; texto: string } | null>(null);

  if (erro) return <p className="text-corpo text-tinta-suave" role="alert">Não foi possível carregar as aprovações: {erro}</p>;
  if (!casos) return <p className="text-corpo text-tinta-suave">Carregando aprovações…</p>;
  if (!casos.length) return null;

  const decidir = async (c: CasoAprovacao, action: "approve" | "cancel", ok: string, body?: string) => {
    setOcupado(c.id); setFalhas((f) => { const resto = { ...f }; delete resto[c.id]; return resto; });
    try {
      await enviar(`/api/automacoes/ai/cases/${c.id}/action`, "POST", body ? { action, body } : { action });
      toast.success(ok); setEditando(null); await aoDecidir();
    } catch (e) {
      const msg = (e as Error).message;
      setFalhas((f) => ({ ...f, [c.id]: msg })); toast.error(msg);
    } finally { setOcupado(null); }
  };

  return (
    <ul className="flex flex-col gap-2" data-testid="agente-aprovacoes">
      {casos.map((c) => {
        const snap = c.contextSnapshot ?? {};
        const ehMensagem = snap.kind === "mensagem" && typeof snap.toolName !== "string";
        const mensagens = ehMensagem && Array.isArray(snap.mensagens) ? snap.mensagens.filter((m): m is string => typeof m === "string" && m.trim().length > 0) : [];
        const linhas = ehMensagem ? [] : resumoDaEntrada(snap.toolInput);
        const preso = ocupado === c.id;
        const emEdicao = editando?.id === c.id;
        return (
          <li key={c.id} className="flex flex-col gap-2 rounded-lg border border-linha p-3" data-testid="agente-aprovacao" aria-busy={preso || undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">{ehMensagem ? "Resposta para aprovar" : "Ação para aprovar"}</Badge>
              <span className="text-micro text-tinta-suave">{quando(c.openedAt)}</span>
            </div>
            {ehMensagem ? (
              emEdicao ? (
                <label className="flex flex-col gap-1 text-corpo font-medium text-tinta">Texto que será enviado
                  <Textarea value={editando.texto} onChange={(e) => setEditando({ id: c.id, texto: e.target.value })} rows={5} maxLength={4000} disabled={preso} />
                  <span className="text-micro font-normal text-tinta-suave">O texto editado sai como uma única mensagem, no lugar do que o agente propôs.</span>
                </label>
              ) : mensagens.length ? (
                <div className="flex flex-col gap-1">
                  {mensagens.map((m, i) => <p key={i} className="whitespace-pre-wrap rounded-lg bg-superficie-alt p-2 text-corpo text-tinta">{m}</p>)}
                </div>
              ) : <p className="text-corpo text-tinta-suave">O agente não deixou texto neste caso. Descarte e responda pela conversa.</p>
            ) : (
              <div className="flex flex-col gap-1">
                <strong className="text-corpo text-tinta">{typeof snap.toolName === "string" ? nomeDaFerramenta(snap.toolName, catalogo) : c.title}</strong>
                {linhas.length ? (
                  <dl className="flex flex-col gap-0.5">
                    {linhas.map((l) => <div key={l.chave} className="text-micro text-tinta-suave"><dt className="inline font-medium text-tinta">{l.chave}: </dt><dd className="inline whitespace-pre-wrap">{l.valor}</dd></div>)}
                  </dl>
                ) : <p className="text-micro text-tinta-suave">{c.summary}</p>}
              </div>
            )}
            {falhas[c.id] ? <p className="text-micro text-negativo" role="alert">Não foi feito: {falhas[c.id]}</p> : null}
            <div className="flex flex-wrap gap-2">
              {ehMensagem ? (
                emEdicao ? (
                  <>
                    <Button size="sm" disabled={preso || !editando.texto.trim()} onClick={() => decidir(c, "approve", "Mensagem editada enviada.", editando.texto.trim())}>{preso ? "Enviando…" : "Enviar texto editado"}</Button>
                    <Button size="sm" variant="ghost" disabled={preso} onClick={() => setEditando(null)}>Voltar</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" disabled={preso || !mensagens.length} onClick={() => decidir(c, "approve", mensagens.length > 1 ? "Mensagens aprovadas e enviadas." : "Mensagem aprovada e enviada.")}>{preso ? "Enviando…" : "Aprovar e enviar"}</Button>
                    <Button size="sm" variant="outline" disabled={preso} onClick={() => setEditando({ id: c.id, texto: mensagens.join("\n\n") })}>Editar e enviar</Button>
                    <Button size="sm" variant="ghost" disabled={preso} onClick={() => decidir(c, "cancel", "Resposta descartada.")}>Descartar</Button>
                  </>
                )
              ) : (
                <>
                  <Button size="sm" disabled={preso} onClick={() => decidir(c, "approve", "Ação aprovada e executada.")}>{preso ? "Executando…" : "Aprovar"}</Button>
                  <Button size="sm" variant="ghost" disabled={preso} onClick={() => decidir(c, "cancel", "Ação recusada.")}>Recusar</Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export const linkExecucao = (runId: string | null | undefined) => (runId ? `/automacoes/execucoes?run=${runId}` : "/automacoes/execucoes");

/** Agentes publicados que recebem atendimento. */
export function useAgentesOp() {
  const [agentes, setAgentes] = React.useState<AgenteOp[] | null>(null);
  React.useEffect(() => {
    let vivo = true;
    api<{ agentes: AgenteOp[] }>(`${AO}/agentes`).then((j) => vivo && setAgentes(j.agentes)).catch(() => vivo && setAgentes([]));
    return () => { vivo = false; };
  }, []);
  return agentes;
}

/** Escolher agente + objetivo (+ autonomia opcional) e atribuir. Sem cadência. */
export function FormDelegar({ alvo, trocar, rotulo = "Delegar ao agente", aoConcluir }: {
  alvo: AlvoAtribuicao; trocar?: boolean; rotulo?: string; aoConcluir: () => void;
}) {
  const agentes = useAgentesOp();
  const [agentId, setAgentId] = React.useState("");
  const [objetivo, setObjetivo] = React.useState("");
  const [autonomia, setAutonomia] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  React.useEffect(() => { if (agentes?.[0] && !agentId) setAgentId(agentes[0].id); }, [agentes, agentId]);

  if (!agentes) return <p className="text-corpo text-tinta-suave">Carregando agentes…</p>;
  if (!agentes.length) return <p className="text-corpo text-tinta-suave">Nenhum agente publicado atende conversas. Publique um agente em Automações, Agentes.</p>;

  const delegar = async () => {
    setEnviando(true);
    try {
      await enviar(`${AO}/atribuicoes`, "POST", { ...alvo, agentId, objetivo: objetivo.trim() || undefined, autonomia: autonomia || null, trocar: trocar || undefined });
      toast.success(trocar ? "Agente trocado." : "Atendimento delegado ao agente.");
      aoConcluir();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-corpo font-medium text-tinta">Agente
        <NativeSelect value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full" aria-label="Agente">
          {agentes.map((a) => <NativeSelectOption key={a.id} value={a.id}>{a.nome}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      <label className="flex flex-col gap-1 text-corpo font-medium text-tinta">Objetivo (opcional)
        <Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={3} maxLength={600}
          placeholder="Ex.: qualificar o lead e agendar uma demonstração" />
        <span className="text-micro font-normal text-tinta-suave">O agente lê o histórico, decide como conduzir e agenda as próprias retomadas.</span>
      </label>
      <label className="flex flex-col gap-1 text-corpo font-medium text-tinta">Autonomia (opcional)
        <NativeSelect value={autonomia} onChange={(e) => setAutonomia(e.target.value)} className="w-full" aria-label="Autonomia">
          <NativeSelectOption value="">A da versão publicada do agente</NativeSelectOption>
          {Object.entries(AUTONOMIAS).map(([v, r]) => <NativeSelectOption key={v} value={v}>{r}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      <Button type="button" disabled={enviando || !agentId} onClick={delegar}>{enviando ? "Enviando…" : rotulo}</Button>
    </div>
  );
}
