"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GitBranch, AlertTriangle, Plus, Pencil, Save, Send } from "lucide-react";
import { CadenceCanvas } from "./CadenceCanvas";
import type { Cadencia, Step } from "./cadence-types";
import { novoStep } from "./cadence-types";

const STATUS_LABEL: Record<string, string> = { active: "Ativas", waiting: "Aguardando", completed: "Concluídas", cancelled: "Canceladas", failed: "Falharam" };

/**
 * Automações → Cadências (19/08) — motor genérico real
 * (lib/cadencia/cadence-engine.ts: steps, branches, retry/backoff), hoje
 * com 1 consumidor real (Prospecção outbound). Achado de arquitetura
 * explícito (não escondido): existem 2 outros mecanismos de "sequência no
 * tempo" ainda não unificados a este motor — mostrado abaixo, não
 * fabricado como se já fosse tudo 1 engine só.
 */
export function Cf2CadenciasWorkspace() {
  const { data, isLoading } = useQuery<{ cadencias: Cadencia[]; mecanismosParalelos: { cadenciaSdrInboundExecucoes: number; aiSdrRetrySweep: string } }>({
    queryKey: ["cf2-automacoes-cadencias"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes/cadencias");
      if (!r.ok) return { cadencias: [], mecanismosParalelos: { cadenciaSdrInboundExecucoes: 0, aiSdrRetrySweep: "" } };
      return r.json();
    },
  });

  const cadencias = data?.cadencias ?? [];
  const [editando, setEditando] = useState<Cadencia | null>(null);
  const [nome, setNome] = useState("");
  const [entityType, setEntityType] = useState("lead");
  const [steps, setSteps] = useState<Step[]>([]);

  const abrirEditor = (cadencia?: Cadencia) => {
    const base = cadencia?.draftSteps?.length ? cadencia.draftSteps : cadencia?.steps;
    setEditando(cadencia ?? null);
    setNome(cadencia?.nome ?? "Nova cadência");
    setEntityType(cadencia?.entityType ?? "lead");
    setSteps(base?.length ? base : [novoStep("action"), novoStep("wait")]);
  };

  const salvar = async (action: "save_draft" | "publish") => {
    const url = editando ? `/api/automacoes/cadencias/${editando.id}` : "/api/automacoes/cadencias";
    const res = await fetch(url, {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editando ? { action, nome, entityType, steps } : { nome, entityType, steps }),
    });
    if (!res.ok) return;
    if (!editando && action === "publish") return;
    setEditando(null);
    window.location.reload();
  };

  const publicar = async (cadencia: Cadencia) => {
    await fetch(`/api/automacoes/cadencias/${cadencia.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Cadências</p>
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Motor genérico de sequência no tempo (steps/branches/retry) — hoje usado pela Prospecção outbound.</p>
      </div>
      <button onClick={() => abrirEditor()} className="self-start flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
        <Plus className="w-3.5 h-3.5" /> Nova cadência
      </button>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : cadencias.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma cadência configurada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cadencias.map((cd) => (
              <div key={cd.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: "var(--cf2-bg-inverse)" }}>
                  <GitBranch className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{cd.nome}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{cd.totalPassos} passos · entidade: {cd.entityType} · {cd.ativo ? "ativa" : "inativa"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {Object.entries(cd.enrollmentsPorStatus).map(([status, n]) => (
                  <div key={status} className="text-center">
                    <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{n}</p>
                    <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{STATUS_LABEL[status] || status}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 ml-4">
                <button onClick={() => abrirEditor(cd)} title="Editar rascunho" className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => publicar(cd)} title="Publicar versão" className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><Send className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando !== null || nome ? (
        <div data-cf2-theme="builder" className="fixed inset-0 z-[1000] flex flex-col" style={{ background: "var(--cf2-bg-page)" }}>
          <div className="h-[72px] shrink-0 flex items-center gap-5 px-7" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-extrabold tracking-tight">Automações</span>
                <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>/</span>
                <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Cadências</span>
              </div>
              <p className="text-[16px] font-bold mt-1 truncate" style={{ color: "var(--cf2-text-primary)" }}>{nome || "Nova cadência"}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)", border: "1px solid var(--cf2-warning-border)" }}>Rascunho</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] hidden lg:inline" style={{ color: "var(--cf2-text-tertiary)" }}>As mudanças só entram no motor ao salvar</span>
              <button onClick={() => { setEditando(null); setNome(""); }} className="px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Fechar</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-5 lg:p-6">
            <CadenceCanvas
              key={editando?.id ?? "nova"}
              steps={steps}
              onStepsChange={setSteps}
              nome={nome}
              entityType={entityType}
              onNomeChange={setNome}
              onEntityTypeChange={setEntityType}
            />
          </div>
          <div className="h-[68px] shrink-0 flex items-center gap-2 px-7" style={{ borderTop: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface-subtle)" }}>
            <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{steps.length} {steps.length === 1 ? "etapa configurada" : "etapas configuradas"}</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => salvar("save_draft")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}><Save className="w-3.5 h-3.5" /> Salvar rascunho</button>
              {editando && <button onClick={() => salvar("publish")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Send className="w-3.5 h-3.5" /> Publicar</button>}
            </div>
          </div>
        </div>
      ) : null}

      {data?.mecanismosParalelos && (data.mecanismosParalelos.cadenciaSdrInboundExecucoes > 0) && (
        <div className="p-4 rounded-2xl flex items-start gap-3" style={{ background: "var(--cf2-warning-bg)", border: "1px solid var(--cf2-warning-border)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--cf2-warning-text)" }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-warning-text)" }}>Mecanismos paralelos ainda não unificados a este motor</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
              Cadência SDR inbound (legado): {data.mecanismosParalelos.cadenciaSdrInboundExecucoes} execuções registradas em `cadencia_execucoes`.
              <br />
              Retry do AI SDR: {data.mecanismosParalelos.aiSdrRetrySweep}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
