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

export function SeloEstadoAgente({ estado }: { estado: string }) {
  const e = ESTADOS_AGENTE[estado] ?? { rotulo: estado, variante: "secondary" as const };
  return <Badge variant={e.variante}>{e.rotulo}</Badge>;
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
