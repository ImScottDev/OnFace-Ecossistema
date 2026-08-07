"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ListChecks, Trash2, Building2, UserRound } from "lucide-react";
import { BoardFilters, useOrgUsuarios, initialsOf } from "@/components/crm/BoardFilters";
import { TarefaFormModal, tipoLabel, TIPO_TAREFA_OPTIONS, type Tarefa } from "@/components/crm/tarefas/TarefaFormModal";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { useMe } from "@/lib/useMe";
import { isPersonalView } from "@/lib/auth/roles";
import { DonutChart } from "@/app/(crm)/relatorios/components/charts/DonutChart";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">{label}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
    </div>
  );
}

const PRIORIDADE_COLOR: Record<string, string> = {
  urgente: "#EF4444",
  alta: "#F59E0B",
  media: "#3B82F6",
  baixa: "#6B7280",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Mesma paleta categórica usada nos donuts de Relatórios (TabComercial.tsx) — cor da marca
// primeiro, depois degradê de branco pras categorias seguintes.
const TIPO_COLORS = ["#e23752", "rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.42)", "rgba(255,255,255,0.3)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.12)"];

function fmtVence(v: string | null): { label: string; atrasada: boolean } {
  if (!v) return { label: "", atrasada: false };
  const d = new Date(v);
  if (isNaN(d.getTime())) return { label: "", atrasada: false };
  const temHora = v.includes("T") && !v.endsWith("T00:00:00.000Z");
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + (temHora ? " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return { label, atrasada: d < hoje };
}

export default function TarefasPage() {
  const queryClient = useQueryClient();
  const { usuarios, currentUserId } = useOrgUsuarios();
  const { data: me } = useMe();
  // Admin/gerente entram vendo o time todo (regra de tarefas.ts); closer/sdr entram vendo só as próprias.
  // `respOverride` só existe depois que a pessoa mexe no filtro manualmente — daí a escolha dela prevalece.
  const [respOverride, setResp] = useState<string | null>(null);
  const resp = respOverride ?? (me && !isPersonalView(me.role) ? "todos" : "meu");
  const [status, setStatus] = useState<"pendente" | "concluida" | "todas">("pendente");
  const [tipo, setTipo] = useState("todos");
  const [creating, setCreating] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const modalOpen = creating || !!editingTarefa;
  const closeModal = () => { setCreating(false); setEditingTarefa(null); };

  const responsavelId = resp === "todos" ? null : resp === "meu" ? currentUserId : resp;

  const { data, isLoading } = useQuery({
    queryKey: ["tarefas", "aba", responsavelId, status, tipo],
    queryFn: async () => {
      const params = new URLSearchParams({ escopo: "org" });
      if (responsavelId) params.set("responsavelId", responsavelId);
      if (status !== "todas") params.set("concluida", String(status === "concluida"));
      if (tipo !== "todos") params.set("tipo", tipo);
      const r = await fetch(`/api/tarefas?${params.toString()}`);
      if (!r.ok) return { tarefas: [] as Tarefa[] };
      return r.json() as Promise<{ tarefas: Tarefa[] }>;
    },
  });
  const tarefas = data?.tarefas || [];

  // Dashboard (TF-10/11/12): sempre "em aberto" — não segue o filtro de status/tipo da
  // lista embaixo, só o toggle Meu/Todos. Sem endpoint de agregação novo — computa em cima
  // do GET /api/tarefas já existente.
  const { data: dashData } = useQuery({
    queryKey: ["tarefas", "dashboard", responsavelId],
    queryFn: async () => {
      const params = new URLSearchParams({ escopo: "org", concluida: "false" });
      if (responsavelId) params.set("responsavelId", responsavelId);
      const r = await fetch(`/api/tarefas?${params.toString()}`);
      if (!r.ok) return { tarefas: [] as Tarefa[] };
      return r.json() as Promise<{ tarefas: Tarefa[] }>;
    },
  });
  const abertas = dashData?.tarefas || [];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimSemana = new Date(hoje);
  fimSemana.setDate(fimSemana.getDate() + 7);

  const dueDateOnly = (t: Tarefa): Date | null => {
    const v = t.venceEm || t.dataVencimento;
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const totalAbertas = abertas.length;
  const atrasadas = abertas.filter((t) => { const dd = dueDateOnly(t); return dd !== null && dd < hoje; }).length;
  const venceHoje = abertas.filter((t) => { const dd = dueDateOnly(t); return dd !== null && dd.getTime() === hoje.getTime(); }).length;
  const venceSemana = abertas.filter((t) => { const dd = dueDateOnly(t); return dd !== null && dd >= hoje && dd < fimSemana; }).length;

  const porPrioridade = (["urgente", "alta", "media", "baixa"] as const).map((p) => ({
    name: PRIORIDADE_LABEL[p],
    value: abertas.filter((t) => t.prioridade === p).length,
    color: PRIORIDADE_COLOR[p],
  }));

  const porTipo = TIPO_TAREFA_OPTIONS.map((t, i) => ({
    name: t.label,
    value: abertas.filter((a) => a.tipo === t.value).length,
    color: TIPO_COLORS[i % TIPO_COLORS.length],
  })).filter((d) => d.value > 0);

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  return (
    <div className="page-scroll space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white/90 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-[#e23752]" /> Tarefas
          </h1>
          <p className="text-xs text-white/40 mt-0.5">{tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-white"
          style={{ background: "#e23752" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nova tarefa
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total em aberto" value={totalAbertas} color="#e23752" />
        <StatCard label="Atrasadas" value={atrasadas} color="#EF4444" />
        <StatCard label="Vence hoje" value={venceHoje} color="#F59E0B" />
        <StatCard label="Vence esta semana" value={venceSemana} color="#3B82F6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-1">Em aberto por prioridade</p>
          <DonutChart data={porPrioridade} centerValue={String(totalAbertas)} centerLabel="em aberto" height={170} />
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-1">Em aberto por tipo</p>
          {porTipo.length > 0 ? (
            <DonutChart data={porTipo} centerValue={String(totalAbertas)} centerLabel="em aberto" height={170} />
          ) : (
            <p className="text-xs text-white/25 py-8 text-center">Nenhuma tarefa em aberto.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <BoardFilters usuarios={usuarios} currentUserId={currentUserId} resp={resp} setResp={setResp} showPeriodo={false} />

          <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
            {(["pendente", "concluida", "todas"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="px-2.5 py-1.5 text-[11px] capitalize transition-colors"
                style={{ background: status === s ? "rgba(226,55,82,0.15)" : "transparent", color: status === s ? "#e23752" : "rgba(255,255,255,0.4)" }}
              >
                {s === "concluida" ? "Concluídas" : s === "todas" ? "Todas" : "Pendentes"}
              </button>
            ))}
          </div>

          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[11px] bg-white/[0.03] border border-white/[0.08] text-white/60 outline-none">
            <option value="todos">Todos os tipos</option>
            {TIPO_TAREFA_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {isLoading && <p className="text-xs text-white/30">Carregando...</p>}
        {!isLoading && tarefas.length === 0 && (
          <p className="text-xs text-white/25 py-8 text-center">Nenhuma tarefa por aqui.</p>
        )}

        <div className="space-y-1.5">
          {tarefas.map((t) => {
            const vence = fmtVence(t.venceEm || t.dataVencimento);
            const abrirVinculo = () => {
              if (t.negocioId) setDrawerNegocioId(t.negocioId);
              else if (t.leadId) setDrawerLeadId(t.leadId);
              else setEditingTarefa(t);
            };
            return (
              <div
                key={t.id}
                onClick={abrirVinculo}
                className="flex items-start gap-2.5 p-3 rounded-lg card-solid group cursor-pointer hover:bg-white/[0.04] transition-colors"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggle.mutate({ id: t.id, concluida: !t.concluida }); }}
                  disabled={toggle.isPending}
                  className="mt-0.5 w-4 h-4 rounded border shrink-0 transition-colors"
                  style={{ borderColor: t.concluida ? "#e23752" : "rgba(255,255,255,0.2)", background: t.concluida ? "#e23752" : "transparent" }}
                  title={t.concluida ? "Reabrir" : "Concluir"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-xs ${t.concluida ? "text-white/30 line-through" : "text-white/80"}`}>{t.titulo}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${PRIORIDADE_COLOR[t.prioridade]}20`, color: PRIORIDADE_COLOR[t.prioridade] }}>
                      {tipoLabel(t.tipo)}
                    </span>
                  </div>
                  {t.descricao && <p className="text-[10px] text-white/35 whitespace-pre-wrap mt-0.5">{t.descricao}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30 flex-wrap">
                    {vence.label && <span style={{ color: vence.atrasada && !t.concluida ? "#EF4444" : undefined }}>{vence.atrasada && !t.concluida ? "Atrasada · " : ""}{vence.label}</span>}
                    {t.leadNome && <span className="flex items-center gap-0.5"><UserRound className="w-2.5 h-2.5" /> {t.leadNome}</span>}
                    {t.negocioTitulo && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" /> {t.negocioTitulo}</span>}
                    {t.responsavelNome && resp !== "meu" && (
                      <span className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold overflow-hidden" style={{ background: "rgba(226,55,82,0.15)", color: "#e23752" }}>
                          {t.responsavelAvatarUrl ? <img src={t.responsavelAvatarUrl} alt={t.responsavelNome} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : initialsOf(t.responsavelNome)}
                        </span>
                        {t.responsavelNome}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remover.mutate(t.id); }}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-opacity shrink-0"
                  title="Excluir tarefa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <TarefaFormModal open={modalOpen} onClose={closeModal} tarefa={editingTarefa} invalidateKeys={[["tarefas"]]} />

      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }}
      />
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
        onOpenNegocio={(id) => { setDrawerLeadId(null); setDrawerNegocioId(id); }}
      />
    </div>
  );
}
