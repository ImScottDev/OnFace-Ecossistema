"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { EditableList } from "@/components/crm2/ajustes/EditableList";
import { Save, RotateCcw, Plus, Trash2, Star, GripVertical } from "lucide-react";
import type { Pipeline, PipelineStage } from "@/lib/crm/pipeline";

interface PipelineData {
  id?: string;
  nome: string;
  slug: string;
  ordem: number;
  stages: PipelineStage[];
  closedStages: PipelineStage[];
  isDefault: boolean;
  ativo: boolean;
}

export default function PipelineConfigPage() {
  const queryClient = useQueryClient();
  const { config, isLoading: configLoading, mutate: mutateConfig } = usePipelineConfig();

  const { data: pipelinesData, isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await fetch("/api/pipelines");
      if (!res.ok) return [];
      const json = await res.json();
      return json.pipelines || [];
    },
  });

  const pipelines = pipelinesData || [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [drafts, setDrafts] = useState<PipelineData[] | null>(null);
  const [sharedDraft, setSharedDraft] = useState<typeof config | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Build working list: drafts or loaded pipelines
  const workingPipelines: PipelineData[] = drafts || pipelines.map((p) => ({
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    ordem: p.ordem,
    stages: p.stages as PipelineStage[],
    closedStages: p.closedStages as PipelineStage[],
    isDefault: p.isDefault,
    ativo: p.ativo,
  }));

  const sharedConfig = sharedDraft || config;
  const selected = workingPipelines[selectedIdx] || workingPipelines[0];

  const updatePipeline = useCallback((idx: number, field: string, value: unknown) => {
    setDrafts((prev) => {
      const list = prev || pipelines.map((p) => ({
        id: p.id, nome: p.nome, slug: p.slug, ordem: p.ordem,
        stages: p.stages as PipelineStage[], closedStages: p.closedStages as PipelineStage[],
        isDefault: p.isDefault, ativo: p.ativo,
      }));
      const updated = [...list];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setMessage(null);
  }, [pipelines]);

  const addPipeline = () => {
    const list = drafts || pipelines.map((p) => ({
      id: p.id, nome: p.nome, slug: p.slug, ordem: p.ordem,
      stages: p.stages as PipelineStage[], closedStages: p.closedStages as PipelineStage[],
      isDefault: p.isDefault, ativo: p.ativo,
    }));
    const slug = `pipeline-${list.length + 1}`;
    setDrafts([...list, {
      nome: "Novo Pipeline",
      slug,
      ordem: list.length,
      stages: [{ key: "novo", label: "Novo", color: "#3B82F6" }],
      closedStages: [
        { key: "ganho", label: "Ganho", color: "#10B981" },
        { key: "perdido", label: "Perdido", color: "#EF4444" },
      ],
      isDefault: false,
      ativo: true,
    }]);
    setSelectedIdx(list.length);
    setMessage(null);
  };

  const removePipeline = (idx: number) => {
    const list = drafts || pipelines.map((p) => ({
      id: p.id, nome: p.nome, slug: p.slug, ordem: p.ordem,
      stages: p.stages as PipelineStage[], closedStages: p.closedStages as PipelineStage[],
      isDefault: p.isDefault, ativo: p.ativo,
    }));
    if (list.length <= 1) return;
    const updated = list.filter((_, i) => i !== idx);
    setDrafts(updated);
    setSelectedIdx(Math.min(selectedIdx, updated.length - 1));
    setMessage(null);
  };

  const setDefault = (idx: number) => {
    const list = drafts || pipelines.map((p) => ({
      id: p.id, nome: p.nome, slug: p.slug, ordem: p.ordem,
      stages: p.stages as PipelineStage[], closedStages: p.closedStages as PipelineStage[],
      isDefault: p.isDefault, ativo: p.ativo,
    }));
    setDrafts(list.map((p, i) => ({ ...p, isDefault: i === idx })));
    setMessage(null);
  };

  const handleSave = async () => {
    const pipelinesToSave = drafts || workingPipelines;
    if (!pipelinesToSave.length) return;

    // Validate
    for (const p of pipelinesToSave) {
      if (!p.nome.trim()) { setMessage({ type: "err", text: "Todos os pipelines precisam de um nome" }); return; }
      if (!p.stages.length) { setMessage({ type: "err", text: `Pipeline "${p.nome}" precisa de pelo menos 1 etapa` }); return; }
    }

    setSaving(true);
    setMessage(null);

    try {
      // Delete pipelines that were removed from the draft
      const savedIds = new Set(pipelinesToSave.filter((p) => p.id).map((p) => p.id));
      const removedPipelines = pipelines.filter((p) => !savedIds.has(p.id));
      for (const p of removedPipelines) {
        const delRes = await fetch(`/api/pipelines/${p.id}`, { method: "DELETE" });
        if (!delRes.ok) {
          const err = await delRes.json();
          throw new Error(err.error || `Erro ao excluir pipeline "${p.nome}"`);
        }
      }

      // Save each pipeline (create or update)
      for (const p of pipelinesToSave) {
        if (p.id) {
          await fetch(`/api/pipelines/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: p.nome, slug: p.slug, ordem: p.ordem, stages: p.stages, closedStages: p.closedStages, isDefault: p.isDefault, ativo: p.ativo }),
          });
        } else {
          await fetch("/api/pipelines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
        }
      }

      // Save shared config (lossReasons etc)
      if (sharedDraft) {
        await fetch("/api/configuracoes/pipeline", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sharedDraft),
        });
      }

      setDrafts(null);
      setSharedDraft(null);
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      mutateConfig();
      setMessage({ type: "ok", text: "Pipelines salvos com sucesso" });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDrafts(null);
    setSharedDraft(null);
    setMessage(null);
  };

  if (configLoading || pipelinesLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-[var(--cf2-bg-surface)] rounded" />
        <div className="h-40 bg-[var(--cf2-bg-surface)] rounded-xl" />
      </div>
    );
  }

  const hasChanges = drafts !== null || sharedDraft !== null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--cf2-text-primary)]">Pipelines de Vendas</h2>
          <p className="text-xs text-[var(--cf2-text-tertiary)] mt-0.5">Gerencie seus funis comerciais e etapas</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)] transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Descartar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* O quadro de Pipeline e os relatórios seguem as etapas fixas do módulo de Vendas
          (Entrada, Diagnóstico, Proposta, Negociação, definidas na especificação).
          Esta configuração só alimenta formulários antigos de negócio. */}
      <p className="aj-aviso" role="status">
        <strong>Não altera o quadro de Pipeline:</strong> o Pipeline e os relatórios usam as etapas fixas Entrada, Diagnóstico, Proposta e Negociação. O que se salva aqui vale apenas para os formulários antigos de negócio.
      </p>

      {message && (
        <div className={`text-sm px-4 py-2.5 rounded-lg ${message.type === "ok" ? "bg-emerald-500/10 text-[var(--cf2-success-text)] border border-emerald-500/20" : "bg-red-500/10 text-[var(--cf2-danger-text)] border border-red-500/20"}`}>
          {message.text}
        </div>
      )}

      {/* Pipeline tabs */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {workingPipelines.map((p, idx) => (
          <button
            key={p.id || idx}
            onClick={() => setSelectedIdx(idx)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
              selectedIdx === idx
                ? "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-primary)] border border-[var(--cf2-border-default)]"
                : "bg-[var(--cf2-bg-surface)] text-[var(--cf2-text-secondary)] border border-[var(--cf2-border-default)] hover:text-[var(--cf2-text-primary)]"
            }`}
          >
            {p.isDefault && <Star className="w-3 h-3 text-[var(--cf2-warning-text)] fill-amber-400" />}
            {p.nome}
          </button>
        ))}
        <button
          onClick={addPipeline}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)] border border-dashed border-[var(--cf2-border-default)] hover:border-[var(--cf2-border-default)] transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Pipeline
        </button>
      </div>

      {/* Selected pipeline settings */}
      {selected && (
        <div className="space-y-5">
          {/* Pipeline name & actions */}
          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 border border-[var(--cf2-border-default)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="text"
                  value={selected.nome}
                  onChange={(e) => updatePipeline(selectedIdx, "nome", e.target.value)}
                  className="cf2-input text-sm font-medium flex-1 max-w-xs"
                  placeholder="Nome do pipeline" aria-label="Nome do pipeline"
                />
                <input
                  type="text"
                  value={selected.slug}
                  onChange={(e) => updatePipeline(selectedIdx, "slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="cf2-input text-xs text-[var(--cf2-text-secondary)] w-32"
                  placeholder="slug" aria-label="slug"
                />
              </div>
              <div className="flex items-center gap-2">
                {!selected.isDefault && (
                  <button
                    onClick={() => setDefault(selectedIdx)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-warning-text)] transition-colors"
                    title="Tornar padrão"
                  >
                    <Star className="w-3.5 h-3.5" /> Padrão
                  </button>
                )}
                {workingPipelines.length > 1 && !selected.isDefault && (
                  <button
                    onClick={() => removePipeline(selectedIdx)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--cf2-danger-text)]/60 hover:text-[var(--cf2-danger-text)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h3 className="text-xs font-medium text-[var(--cf2-text-tertiary)] mb-2">Preview</h3>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {selected.stages.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-1 shrink-0">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--cf2-text-primary)] border border-[var(--cf2-border-default)]"
                      style={{ backgroundColor: `${stage.color}20`, borderColor: `${stage.color}40` }}>
                      {stage.label || "..."}
                    </div>
                    {idx < selected.stages.length - 1 && <span className="text-[var(--cf2-text-tertiary)] text-xs">→</span>}
                  </div>
                ))}
                <span className="text-[var(--cf2-text-tertiary)] text-xs mx-1">│</span>
                {selected.closedStages.map((stage, idx) => (
                  <div key={idx} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--cf2-text-secondary)] border border-[var(--cf2-border-default)] shrink-0"
                    style={{ backgroundColor: `${stage.color}10` }}>
                    {stage.label || "..."}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stages for this pipeline */}
          <EditableList
            title={`Etapas — ${selected.nome}`}
            description="As colunas do Kanban, na ordem do funil"
            items={selected.stages}
            onChange={(items) => updatePipeline(selectedIdx, "stages", items)}
            showColor
            showSla
          />

          <EditableList
            title="Etapas de Fechamento"
            description="Etapas fora do Kanban — representam o resultado final do negócio."
            items={selected.closedStages}
            onChange={(items) => updatePipeline(selectedIdx, "closedStages", items)}
            showColor
          />
        </div>
      )}

      {/* Shared config */}
      <div className="border-t border-[var(--cf2-border-default)] pt-5 mt-5">
        <h3 className="text-sm font-bold text-[var(--cf2-text-primary)] mb-1">Configurações Compartilhadas</h3>
        <p className="text-xs text-[var(--cf2-text-tertiary)] mb-4">Aplicam-se a todos os pipelines</p>

        <EditableList
          title="Motivos de Perda"
          description="Opções para quando um negócio é marcado como perdido"
          items={sharedConfig.lossReasons}
          onChange={(items) => setSharedDraft((prev) => ({ ...(prev || config), lossReasons: items }))}
        />
      </div>
    </div>
  );
}
