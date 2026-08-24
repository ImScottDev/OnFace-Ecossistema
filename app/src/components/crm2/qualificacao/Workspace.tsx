"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SDR_STAGES, SDR_CLOSED_STAGES, SDR_MIRROR_KEYS,
  SDR_STAGNATION_STAGES, SDR_STAGNATION_KEYS,
} from "@/lib/crm/pipeline";
import {
  Search, X, MoreHorizontal, Tag, Briefcase, CheckCircle2, XCircle, PauseCircle, RotateCcw, Download, User,
  Filter, List as ListIcon, LayoutGrid, Globe, Megaphone, Instagram, Linkedin, UserPlus, PhoneOutgoing,
  Phone, MessageCircle, Star, Calendar,
} from "lucide-react";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { Cf2AgendarReuniaoModal, type AgendarReuniaoPayload } from "./AgendarReuniaoModal";
import { useOrgUsuarios, matchesResponsavel, matchesOrigem, buildOrigemOptions, type OrgUsuario } from "@/components/crm/BoardFilters";

/**
 * Board de Qualificação (cf2) — mesma lógica de negócio do legado
 * `(crm)/pre-vendas/page.tsx` (estágios reais, drag-and-drop, qualificar →
 * AgendarReuniaoModal → POST /leads/:id/converter-oportunidade), só o visual
 * foi adaptado pro tema claro. Drawers de Lead/Empresa/Negócio ainda são os
 * legados (funcionais, tema escuro) — reskin deles é escopo separado
 * (Quick View / drawer de negócio, já rastreado).
 */

import {
  type Lead, type KanbanCol, stageAge, sdrBoardColumn, resolveDisplayStage,
  NOVO_COL, EM_CONTATO_COL, QUALIFICACAO_COL, QUALIFICADO_SQL_COL, AGENDA_CONFIRMADA_COL, OPEN_COLS_QUALIFICACAO,
  SEM_RESPOSTA_COL, NUTRICAO_MERGED_COL, DESQUALIFICADO_ESTAGNADOS_COL, OPEN_COLS_ESTAGNADOS,
} from "./shared";
import { Cf2LeadDrawer } from "./LeadDrawerCf2";

type View = "qualificacao" | "estagnados";

export function Cf2QualificacaoWorkspace() {
  const qc = useQueryClient();
  const { usuarios, byId: usuariosById, currentUserId } = useOrgUsuarios();
  const [searchQuery, setSearchQuery] = useState("");
  const [respFilter, setRespFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [slaFilter, setSlaFilter] = useState<"todos" | "dentro" | "fora">("todos");
  const [semContatoOnly, setSemContatoOnly] = useState(false);
  const [filtrosExtraOpen, setFiltrosExtraOpen] = useState(false);
  const [layout, setLayout] = useState<"kanban" | "lista">("kanban");
  const [view, setView] = useState<View>("qualificacao");
  const [showExport, setShowExport] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pre-vendas-leads"],
    queryFn: async () => {
      const r = await fetch("/api/leads?tipo=lead&limit=2000&sort=createdAt&order=desc");
      if (!r.ok) return { leads: [] as Lead[] };
      return (await r.json()) as { leads: Lead[] };
    },
  });

  const allLeads = useMemo(() => data?.leads || [], [data]);
  const origemOptions = useMemo(() => buildOrigemOptions(allLeads), [allLeads]);

  // Colunas visíveis na tab atual — usadas tanto pro Kanban quanto pro
  // dropdown "Status" do toolbar (opções mudam com a view, igual ao board).
  const statusColumns = view === "estagnados" ? OPEN_COLS_ESTAGNADOS : OPEN_COLS_QUALIFICACAO;

  const matchesStatus = (l: Lead): boolean => {
    if (statusFilter === "todos") return true;
    const col = statusColumns.find((c) => c.key === statusFilter);
    if (!col) return true;
    const board = view === "estagnados" ? (l.sdrStatus || "pending") : sdrBoardColumn(l);
    if (!col.keys.includes(board)) return false;
    return col.filter ? col.filter(l) : true;
  };

  const matchesSla = (l: Lead): boolean => {
    if (slaFilter === "todos") return true;
    const age = stageAge(l.updatedAt, l.sdrStatus || "pending");
    if (!age) return true; // sem dado de tempo na etapa — não exclui, não fabrica sinal
    return slaFilter === "fora" ? age.breached : !age.breached;
  };

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allLeads.filter((l) => {
      if (!matchesResponsavel(l.responsavelId, respFilter, currentUserId)) return false;
      if (!matchesOrigem(l.origem, origemFilter)) return false;
      if (!matchesStatus(l)) return false;
      if (!matchesSla(l)) return false;
      if (semContatoOnly && l.lastContactAt) return false;
      if (!q) return true;
      return (
        l.nome.toLowerCase().includes(q) ||
        (l.empresa || "").toLowerCase().includes(q) ||
        (l.utmCampaign || "").toLowerCase().includes(q) ||
        (l.origem || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads, searchQuery, respFilter, origemFilter, statusFilter, slaFilter, semContatoOnly, currentUserId, view]);

  const isStagnant = (l: Lead) => SDR_STAGNATION_KEYS.includes(l.sdrStatus || "");
  const funnelLeads = filteredLeads.filter((l) => !isStagnant(l));
  const stagnantLeads = filteredLeads.filter(isStagnant);
  // Pedido do Kauã (17/08): a view Estagnados ganhou uma 3ª coluna
  // (Desqualificado) só pra visualização — o badge da aba "Estagnados 55"
  // continua contando só sem_resposta/nutrição (stagnantCount abaixo),
  // Desqualificado não entra nessa conta, só no board dessa view.
  const estagnadosViewLeads = filteredLeads.filter((l) => isStagnant(l) || (l.sdrStatus || "pending") === "disqualified");
  const openKeys = SDR_STAGES.map((s) => s.key);
  const activeCount = funnelLeads.filter((l) => openKeys.includes(sdrBoardColumn(l))).length;
  const stagnantCount = stagnantLeads.length;

  function telefoneDiscador(tel?: string | null): string {
    let d = (tel || "").replace(/\D/g, "");
    if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
    return d;
  }

  function gerarCsvLeads(lista: Lead[]) {
    if (lista.length === 0) { toast.error("Nenhum lead na seleção"); return; }
    const cols: { h: string; get: (l: Lead) => string }[] = [
      { h: "Telefone", get: (l) => telefoneDiscador(l.telefone) },
      { h: "Nome", get: (l) => [l.nome, l.sobrenome].filter(Boolean).join(" ") },
      { h: "E-mail", get: (l) => l.email || "" },
      { h: "Empresa", get: (l) => l.empresa || "" },
    ];
    const comTelefone = lista.filter((l) => telefoneDiscador(l.telefone).length >= 10);
    if (comTelefone.length === 0) { toast.error("Nenhum lead da seleção tem telefone válido"); return; }
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const linhas = [cols.map((c) => c.h).join(","), ...comTelefone.map((l) => cols.map((c) => esc(c.get(l))).join(","))];
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `discador-callface-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const puladas = lista.length - comTelefone.length;
    toast.success(`${comTelefone.length} leads exportados${puladas > 0 ? ` (${puladas} sem telefone, ignorados)` : ""}`);
  }

  const moveStage = useMutation({
    mutationFn: async ({ id, sdrStatus }: { id: string; sdrStatus: string }) => {
      const r = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus }) });
      if (!r.ok) throw new Error("falha ao mover");
      return r.json();
    },
    onMutate: async ({ id, sdrStatus }) => {
      await qc.cancelQueries({ queryKey: ["pre-vendas-leads"] });
      const prev = qc.getQueryData<{ leads: Lead[] }>(["pre-vendas-leads"]);
      qc.setQueryData<{ leads: Lead[] }>(["pre-vendas-leads"], (old) => (old ? { leads: old.leads.map((l) => (l.id === id ? { ...l, sdrStatus } : l)) } : old));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pre-vendas-leads"], ctx.prev);
      toast.error("Não foi possível mover o lead");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] }),
  });

  const qualificar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload?: AgendarReuniaoPayload | { semReuniao: true } }) => {
      const r = await fetch(`/api/leads/${id}/converter-oportunidade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? {}) });
      if (!r.ok) throw new Error("falha ao qualificar");
      return r.json();
    },
    onSuccess: (d, vars) => {
      const semReuniao = !!vars.payload && "semReuniao" in vars.payload;
      const comReuniao = !!vars.payload && !semReuniao;
      if (semReuniao) {
        toast.success("Lead qualificado sem reunião: negócio criado no SEU pipeline.");
      } else if (comReuniao) {
        const outlook = d?.outlook as { criado?: boolean; motivo?: string | null } | undefined;
        if (outlook?.criado) {
          toast.success(outlook.motivo === "lead_sem_email" ? "Reunião agendada e evento criado no Outlook — mas SEM convite pro lead (sem e-mail)." : "Reunião agendada: evento criado no Outlook da closer com convite pro lead.");
        } else {
          const motivos: Record<string, string> = { closer_sem_outlook: "a closer não tem Outlook conectado (Configurações → Email)", token_expirado: "a conexão Outlook da closer expirou — ela precisa reconectar", erro_graph: "erro na API da Microsoft" };
          toast.warning(`Reunião criada no CRM, mas NÃO entrou na agenda do Outlook: ${motivos[outlook?.motivo || ""] || "sem integração ativa"}.`, { duration: 9000 });
        }
      } else {
        toast.success("Lead qualificado: oportunidade criada no Pipeline. Fica aqui de espelho.");
      }
      setAgendarLead(null);
      qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["negocios"] });
    },
    onError: () => toast.error("Não foi possível qualificar o lead"),
  });

  const [agendarLead, setAgendarLead] = useState<Lead | null>(null);

  const handleMove = (leadId: string, targetStatus: string) => {
    const lead = allLeads.find((l) => l.id === leadId);
    if (!lead) return;
    const isNoShowRecovery = lead.negocioPrincipal?.status === "no_show";
    if ((targetStatus === "qualified" || targetStatus === "m_qualified") && (!lead.negocioCount || isNoShowRecovery)) {
      setAgendarLead(lead);
      return;
    }
    if (SDR_MIRROR_KEYS.includes(targetStatus)) {
      toast.info("Essa etapa é controlada pelo closer no Pipeline.");
      return;
    }
    moveStage.mutate({ id: leadId, sdrStatus: targetStatus });
  };

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      <div className="flex flex-col gap-3 shrink-0">
        {/* Título/subtítulo da seção já vêm de fora (page.tsx: "Kanban de
            Qualificação") — removido daqui pra não duplicar cabeçalho e
            devolver altura pro board (pedido do Kauã: "ocupar espaço,
            dá pra dar mais visualização"). Contagem "no funil" continua
            visível no pill "Qualificação {activeCount}" das quick-tabs
            abaixo. */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lead, empresa, campanha..."
              className="w-56 sm:w-80 pl-8 pr-7 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select value={respFilter} onChange={(e) => setRespFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none shrink-0 [&>option]:bg-[#1c1f26]" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todos">Responsável: Todos</option>
            {currentUserId && <option value="meu">Meus (eu)</option>}
            <option value="sem">Sem responsável</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>

          <select value={origemFilter} onChange={(e) => setOrigemFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none shrink-0 [&>option]:bg-[#1c1f26]" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todos">Origem: Todas</option>
            {origemOptions.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none shrink-0 [&>option]:bg-[#1c1f26]" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todos">Status: Todos</option>
            {statusColumns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>

          <select value={slaFilter} onChange={(e) => setSlaFilter(e.target.value as typeof slaFilter)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none shrink-0 [&>option]:bg-[#1c1f26]" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todos">SLA: Todos</option>
            <option value="dentro">Dentro do SLA</option>
            <option value="fora">Fora do SLA</option>
          </select>

          <div className="relative shrink-0">
            <button
              onClick={() => setFiltrosExtraOpen((v) => !v)}
              title="Mais filtros"
              className="p-1.5 rounded-lg flex items-center justify-center"
              style={{ background: semContatoOnly ? "var(--cf2-accent)" : "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: semContatoOnly ? "var(--cf2-text-on-accent)" : "var(--cf2-chrome-text-secondary)" }}
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
            {filtrosExtraOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-[200px] rounded-lg p-2.5 z-20" style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)", boxShadow: "0 8px 16px rgba(0,0,0,0.3)" }}>
                <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                  <input type="checkbox" checked={semContatoOnly} onChange={(e) => setSemContatoOnly(e.target.checked)} className="w-3.5 h-3.5" />
                  Somente sem contato
                </label>
              </div>
            )}
          </div>

          <button onClick={() => setShowExport(true)} title="Exportar leads: escolher responsável e etapas" className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>

          <div className="flex gap-1 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
            {([{ key: "qualificacao" as const, label: "Qualificação", count: activeCount }, { key: "estagnados" as const, label: "Estagnados", count: stagnantCount }]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setView(tab.key); setStatusFilter("todos"); }}
                className="px-2.5 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap flex items-center gap-1.5"
                style={{ background: view === tab.key ? "var(--cf2-accent)" : "transparent", color: view === tab.key ? "var(--cf2-text-on-accent)" : "var(--cf2-chrome-text-secondary)" }}
              >
                {tab.label} <span className="text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0 ml-auto" style={{ background: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => setLayout("kanban")} title="Visualização em quadro" className="p-1.5 rounded-md" style={{ background: layout === "kanban" ? "var(--cf2-chrome-surface-active)" : "transparent", color: layout === "kanban" ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setLayout("lista")} title="Visualização em lista" className="p-1.5 rounded-md" style={{ background: layout === "lista" ? "var(--cf2-chrome-surface-active)" : "transparent", color: layout === "lista" ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}>
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Carregando...</p>
        ) : layout === "lista" ? (
          <SdrListView
            leads={view === "estagnados" ? estagnadosViewLeads : funnelLeads}
            usuariosById={usuariosById}
            onOpenLead={(id) => setDrawerLeadId(id)}
          />
        ) : (
          <SdrKanbanView
            leads={view === "estagnados" ? estagnadosViewLeads : funnelLeads}
            allFilteredLeads={filteredLeads}
            view={view}
            usuariosById={usuariosById}
            onDrop={handleMove}
            onOpenLead={(id) => setDrawerLeadId(id)}
            onOpenNegocio={(id) => setDrawerNegocioId(id)}
          />
        )}
      </div>

      <Cf2LeadDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} onOpenEmpresa={(id) => { setDrawerLeadId(null); setDrawerEmpresaId(id); }} onOpenNegocio={(id) => { setDrawerLeadId(null); setDrawerNegocioId(id); }} onMove={handleMove} usuariosById={usuariosById} dark />
      <EmpresaDrawer empresaId={drawerEmpresaId} open={!!drawerEmpresaId} onClose={() => setDrawerEmpresaId(null)} onOpenLead={(id) => { setDrawerEmpresaId(null); setDrawerLeadId(id); }} onOpenNegocio={(id) => { setDrawerEmpresaId(null); setDrawerNegocioId(id); }} />
      <NegocioDrawer negocioId={drawerNegocioId} open={!!drawerNegocioId} onClose={() => setDrawerNegocioId(null)} onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }} onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }} />

      <Cf2AgendarReuniaoModal
        open={!!agendarLead}
        leadNome={agendarLead?.nome || ""}
        leadEmpresa={agendarLead?.empresa}
        leadEmail={agendarLead?.email}
        closerSugeridoId={agendarLead?.responsavelId}
        saving={qualificar.isPending}
        onClose={() => setAgendarLead(null)}
        onConfirm={(payload) => { if (agendarLead) qualificar.mutate({ id: agendarLead.id, payload }); }}
        onQualificarSemAgendar={() => { if (agendarLead) qualificar.mutate({ id: agendarLead.id, payload: { semReuniao: true } }); }}
      />

      {showExport && (
        <ExportLeadsModal leads={allLeads} usuarios={usuarios} onClose={() => setShowExport(false)} onExport={(lista) => { gerarCsvLeads(lista); setShowExport(false); }} />
      )}
    </div>
  );
}

function ExportLeadsModal({ leads, usuarios, onClose, onExport }: { leads: Lead[]; usuarios: OrgUsuario[]; onClose: () => void; onExport: (lista: Lead[]) => void }) {
  const etapas = [...SDR_STAGES, ...SDR_CLOSED_STAGES];
  const [resp, setResp] = useState("todos");
  const [stages, setStages] = useState<Set<string>>(new Set(etapas.map((e) => e.key)));

  const toggle = (k: string) => setStages((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const todasMarcadas = stages.size === etapas.length;
  const selecionados = leads.filter((l) => { if (resp !== "todos" && l.responsavelId !== resp) return false; return stages.has(sdrBoardColumn(l)); });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)" }} onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-[15px] mb-1" style={{ color: "var(--cf2-chrome-text-primary)" }}>Exportar leads</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Escolha o responsável e as etapas que quer puxar.</p>

        <label className="block text-[12px] mb-1" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Responsável</label>
        <select value={resp} onChange={(e) => setResp(e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] mb-4 outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>
          <option value="todos">Todos</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>

        <div className="flex items-center justify-between mb-1">
          <label className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Etapas</label>
          <button type="button" onClick={() => setStages(todasMarcadas ? new Set() : new Set(etapas.map((e) => e.key)))} className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>
            {todasMarcadas ? "Limpar" : "Todas"}
          </button>
        </div>
        <div className="space-y-1.5 mb-5 max-h-40 overflow-y-auto">
          {etapas.map((e) => (
            <label key={e.key} className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--cf2-chrome-text-primary)" }}>
              <input type="checkbox" checked={stages.has(e.key)} onChange={() => toggle(e.key)} className="w-3.5 h-3.5" />
              <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
              {e.label}
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{selecionados.length} leads na seleção</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Cancelar</button>
            <button onClick={() => onExport(selecionados)} disabled={selecionados.length === 0 || stages.size === 0} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold rounded-lg disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OwnerChipCf2({ nome, avatarUrl, color }: { nome?: string | null; avatarUrl?: string | null; color: string }) {
  if (!nome) {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
        <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 20, height: 20, border: "1px dashed var(--cf2-chrome-border-subtle)" }}>
          <User className="w-2.5 h-2.5" />
        </span>
        Sem dono
      </span>
    );
  }
  const iniciais = nome.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="flex items-center gap-1 text-[10px] min-w-0" style={{ color: "var(--cf2-chrome-text-secondary)" }} title={`Responsável: ${nome}`}>
      <span className="rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[8px] font-bold" style={{ width: 20, height: 20, background: `${color}25`, color }}>
        {avatarUrl ? <img src={avatarUrl} alt={nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : iniciais}
      </span>
      <span className="truncate max-w-[80px]">{nome.split(/\s+/)[0]}</span>
    </span>
  );
}

/** Ícone por origem (só cosmético, nunca decide dado) — cobre as chaves
 * reais de DEFAULT_ORIGENS + as observadas nos dados (site, instagram,
 * outbound, rd_station), fallback Globe pra qualquer origem desconhecida. */
function OrigemIcon({ origem }: { origem?: string | null }) {
  const key = (origem || "").toLowerCase();
  const Icon =
    key.includes("instagram") ? Instagram :
    key.includes("linkedin") ? Linkedin :
    key.includes("indicacao") ? UserPlus :
    key.includes("outbound") ? PhoneOutgoing :
    key.includes("ads") || key.includes("midia") ? Megaphone :
    Globe;
  return <Icon className="w-2.5 h-2.5 shrink-0" />;
}

/** Visualização em lista (toggle do toolbar) — mesmo dataset filtrado do
 * Kanban, sem drag-and-drop; clicar na linha abre o mesmo drawer. */
function SdrListView({ leads, usuariosById, onOpenLead }: {
  leads: Lead[]; usuariosById: Map<string, OrgUsuario>; onOpenLead: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto rounded-2xl" style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
      <table className="w-full text-[12px] border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
          <tr style={{ borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}>
            {["Nome", "Empresa", "Etapa", "Responsável", "Origem", "Tempo na etapa"].map((h) => (
              <th key={h} className="text-left font-semibold uppercase tracking-wide px-3 py-2.5" style={{ color: "var(--cf2-chrome-text-secondary)", fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhum lead nessa seleção.</td></tr>
          )}
          {leads.map((lead) => {
            const stage = resolveDisplayStage(lead);
            const age = stageAge(lead.updatedAt, lead.sdrStatus || "pending");
            const owner = lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined;
            return (
              <tr key={lead.id} onClick={() => onOpenLead(lead.id)} className="cursor-pointer hover:opacity-80" style={{ borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}>
                <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{lead.nome}{lead.sobrenome ? ` ${lead.sobrenome}` : ""}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.empresa || "—"}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold" style={{ background: `${stage.color}18`, color: stage.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} /> {stage.label}
                  </span>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{owner?.nome || "Sem responsável"}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                  <span className="inline-flex items-center gap-1.5"><OrigemIcon origem={lead.origem} /> {lead.origem || "—"}</span>
                </td>
                <td className="px-3 py-2.5" style={{ color: age?.breached ? "var(--cf2-danger-text)" : "var(--cf2-chrome-text-secondary)" }}>{age?.text || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ KANBAN ═══ */

function SdrKanbanView({ leads, allFilteredLeads, view, usuariosById, onDrop, onOpenLead, onOpenNegocio }: {
  leads: Lead[]; allFilteredLeads: Lead[]; view: View; usuariosById: Map<string, OrgUsuario>;
  onDrop: (id: string, sdrStatus: string) => void; onOpenLead: (id: string) => void; onOpenNegocio: (id: string) => void;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverAction, setDragOverAction] = useState<string | null>(null);
  const [expandedEstagnado, setExpandedEstagnado] = useState<string | null>(null);

  // 5 colunas abertas do fluxo principal (Novo/Em Contato/Qualificação/
  // Qualificado SQL/Agenda Confirmada, De/Para aprovado 17/08) — todas
  // largura igual, sem barra colapsada; na view Estagnados, 2 colunas (Sem
  // resposta/Nutrição-Retomar depois). Desqualificado não vira coluna aqui —
  const estagnadosBuckets = [
    { label: "Sem resposta", color: "#8e27ef", leads: allFilteredLeads.filter((l) => (l.sdrStatus || "pending") === "sdr_sem_retorno") },
    { label: "No-show", color: "#f59e0b", leads: allFilteredLeads.filter((l) => l.negocioPrincipal?.status === "no_show") },
    { label: "Nutrição / Retomar", color: "#8B5CF6", leads: allFilteredLeads.filter((l) => ["sdr_sem_interesse", "sdr_retomar_depois"].includes(l.sdrStatus || "")) },
    { label: "Desqualificado", color: "#dc2626", leads: allFilteredLeads.filter((l) => (l.sdrStatus || "pending") === "disqualified") },
  ];
  const openCols = view === "estagnados" ? OPEN_COLS_ESTAGNADOS : OPEN_COLS_QUALIFICACAO;

  const actions = view === "estagnados"
    ? [{ key: "qualifying", label: "REATIVAR", icon: RotateCcw, color: "#3B82F6" }]
    : [
        { key: "sdr_sem_retorno", label: "ESTAGNAR", icon: PauseCircle, color: "#8e27ef" },
        { key: "disqualified", label: "DESQUALIFICAR", icon: XCircle, color: "#EF4444" },
        { key: "qualified", label: "QUALIFICAR", icon: CheckCircle2, color: "#22C55E" },
      ];

  const renderColumnCards = (stage: KanbanCol) => {
    const matchKeys = stage.keys || [stage.key];
    const mirror = SDR_MIRROR_KEYS.includes(stage.key);
    return leads
      .filter((l) => matchKeys.includes(view === "estagnados" ? (l.sdrStatus || "pending") : sdrBoardColumn(l)))
      .filter((l) => (stage.filter ? stage.filter(l) : true))
      .sort((a, b) => Number(b.negocioPrincipal?.status === "no_show") - Number(a.negocioPrincipal?.status === "no_show"))
      .map((lead) => (
        <LeadCard
          key={lead.id} lead={lead} stageColor={stage?.color || "#6B7280"} view={view} readOnly={mirror}
          owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined}
          onOpenLead={onOpenLead} onOpenNegocio={onOpenNegocio} onMove={(s) => onDrop(lead.id, s)}
          onDragStart={() => setDraggingLeadId(lead.id)} onDragEnd={() => setDraggingLeadId(null)}
        />
      ));
  };

  return (
    <div className="relative h-full flex flex-col gap-3">
      <div className="flex-1 flex min-h-0 flex-col gap-3">
        <div className="flex-1 flex gap-4 min-h-0 overflow-x-auto pb-1">
          {openCols.map((stage) => {
            const cards = renderColumnCards(stage);
            const isDragOver = dragOverStage === stage.key;
            return (
              <div
                key={stage.key}
                className="flex-1 min-w-[220px] rounded-2xl flex flex-col max-h-full"
                style={{ background: isDragOver ? `${stage.color}10` : "var(--cf2-chrome-bg-alt)", border: isDragOver ? `2px dashed ${stage.color}` : "1px solid var(--cf2-chrome-border-subtle)" }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => { e.preventDefault(); setDragOverStage(stage.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                onDrop={(e) => { e.preventDefault(); setDragOverStage(null); const leadId = e.dataTransfer.getData("leadId"); if (leadId) onDrop(leadId, stage.dropTarget); }}
              >
                <div className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>{cards.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0">
                  {cards}
                  {cards.length === 0 && (
                    stage.key === AGENDA_CONFIRMADA_COL.key ? (
                      <div className="flex flex-col items-center justify-center text-center gap-1.5 py-6 px-2">
                        <Calendar className="w-5 h-5" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
                        <p className="text-[11px] font-semibold" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma agenda confirmada</p>
                        <p className="text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)", opacity: 0.7 }}>Leads com reunião aparecem aqui.</p>
                      </div>
                    ) : (
                      <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Vazio</div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {view !== "estagnados" && (
          <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Estados auxiliares">
            {estagnadosBuckets.map((item) => (
              <div key={item.label} className="rounded-xl border px-3 py-2.5" style={{ background: "var(--cf2-chrome-bg)", borderColor: "var(--cf2-chrome-border-subtle)" }}>
                <button type="button" onClick={() => setExpandedEstagnado((current) => current === item.label ? null : item.label)} className="flex w-full items-center gap-2 text-left" aria-expanded={expandedEstagnado === item.label}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{item.label}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: item.color, background: `${item.color}12` }}>{item.leads.length}</span>
                  <span className="text-[11px]" style={{ color: "var(--cf2-accent-border)" }}>Ver →</span>
                </button>
                {expandedEstagnado === item.label && (
                  <div className="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto border-t pt-2" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                    {item.leads.length === 0 ? <span className="text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhum lead</span> : item.leads.map((lead) => <button type="button" key={lead.id} className="w-full truncate rounded-md px-2 py-1 text-left text-[11px]" style={{ background: "var(--cf2-chrome-surface-active)", color: "var(--cf2-chrome-text-primary)" }} onClick={() => onOpenLead(lead.id)}>{lead.nome}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {draggingLeadId && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-3 z-20">
          {actions.map((action) => {
            const Icon = action.icon;
            const isOver = dragOverAction === action.key;
            return (
              <div
                key={action.key}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all duration-200"
                style={{ background: isOver ? `${action.color}33` : `${action.color}14`, borderColor: isOver ? action.color : `${action.color}50`, transform: isOver ? "scale(1.02)" : "scale(1)" }}
                onDragOver={(e) => { e.preventDefault(); setDragOverAction(action.key); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOverAction(action.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverAction(null); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverAction(null); setDraggingLeadId(null); const leadId = e.dataTransfer.getData("leadId"); if (leadId) onDrop(leadId, action.key); }}
              >
                <Icon className="w-4 h-4" style={{ color: action.color }} />
                <span className="text-[12px] font-bold tracking-wide" style={{ color: action.color }}>{action.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ CARD ═══ */

function LeadCard({ lead, stageColor, view, readOnly = false, owner, onOpenLead, onOpenNegocio, onMove, onDragStart, onDragEnd }: {
  lead: Lead; stageColor: string; view: View; readOnly?: boolean; owner?: OrgUsuario;
  onOpenLead: (id: string) => void; onOpenNegocio: (id: string) => void; onMove: (status: string) => void;
  onDragStart?: () => void; onDragEnd?: () => void;
}) {
  const age = stageAge(lead.updatedAt, lead.sdrStatus || "pending");
  // `stageAge()` devolve bg/color claros (pensados pro drawer, tema claro) —
  // aqui, no card escuro, ignoramos `age.bg` e usamos uma versão translúcida
  // da MESMA cor (`age.color`) como fundo, com um tom mais claro pro texto,
  // senão o selo de "3d/12d" vira um retângulo pastel destoando do card
  // escuro (achado real do Kauã, 17/08: "essas cores do dias no funil...
  // ta pessima").
  const ageDark = age ? (() => {
    if (age.color === "var(--cf2-success-text)") return { bg: "rgba(34,197,94,0.16)", text: "#4ade80" };
    if (age.color === "var(--cf2-warning-text)") return { bg: "rgba(245,158,11,0.16)", text: "#fbbf24" };
    return { bg: "rgba(248,113,113,0.18)", text: "#f87171" };
  })() : null;
  const nome = `${lead.nome}${lead.sobrenome ? " " + lead.sobrenome : ""}`;
  const isOportunidade = !!lead.negocioCount && lead.negocioCount > 0;
  const isNoShow = lead.negocioPrincipal?.status === "no_show";

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuTriggerRef.current?.contains(t)) return;
      if (menuPortalRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("resize", onScroll); window.removeEventListener("scroll", onScroll, true); };
  }, [menuOpen]);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuTriggerRef.current) return;
    if (menuOpen) { setMenuOpen(false); return; }
    const rect = menuTriggerRef.current.getBoundingClientRect();
    const menuWidth = 230;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
    setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    setMenuOpen(true);
  }, [menuOpen]);

  const currentStatus = lead.sdrStatus || "pending";
  const funnelStages = [...SDR_STAGES, ...SDR_CLOSED_STAGES];

  return (
    <div
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : (e) => { e.dataTransfer.setData("leadId", lead.id); onDragStart?.(); }}
      onDragEnd={readOnly ? undefined : () => onDragEnd?.()}
      className={`group rounded-xl p-3 transition-all duration-200 hover:-translate-y-0.5 relative ${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
      style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)" }}
    >
      <button ref={menuTriggerRef} onClick={toggleMenu} onMouseDown={(e) => e.stopPropagation()} draggable={false} onDragStart={(e) => e.preventDefault()} className="absolute top-2 right-2 z-10 p-1 rounded opacity-0 group-hover:opacity-70 hover:opacity-100" title="Ações">
        <MoreHorizontal className="w-3.5 h-3.5" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
      </button>
      {menuOpen && menuPos && typeof window !== "undefined" && createPortal(
        <div ref={menuPortalRef} className="fixed min-w-[230px] rounded-lg shadow-xl py-1 text-[11px]" style={{ top: menuPos.top, left: menuPos.left, background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)", zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
          {isOportunidade && lead.negocioPrincipal && (
            <>
              <button onClick={() => { onOpenNegocio(lead.negocioPrincipal!.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2 font-medium" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                <Briefcase className="w-3 h-3" style={{ color: "var(--cf2-success-text)" }} /> Abrir oportunidade
              </button>
              <div className="my-1 h-px" style={{ background: "var(--cf2-chrome-border-subtle)" }} />
            </>
          )}
          {readOnly ? (
            <div className="px-3 py-1.5 text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Etapa controlada pelo closer no Pipeline.</div>
          ) : (
            <>
              {!isOportunidade && (
                <button onClick={() => { onMove("qualified"); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2 font-medium" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                  <CheckCircle2 className="w-3 h-3" style={{ color: "var(--cf2-success-text)" }} /> Qualificar (cria oportunidade)
                </button>
              )}
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Mover no funil</div>
              {funnelStages.filter((s) => s.key !== currentStatus).map((s) => (
                <button key={s.key} onClick={() => { onMove(s.key); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} /> {s.label}
                </button>
              ))}
              <div className="my-1 h-px" style={{ background: "var(--cf2-chrome-border-subtle)" }} />
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{view === "estagnados" ? "Reativar / mudar motivo" : "Marcar estagnado"}</div>
              {SDR_STAGNATION_STAGES.filter((s) => s.key !== currentStatus).map((s) => (
                <button key={s.key} onClick={() => { onMove(s.key); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} /> {s.label}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}

      <div onClick={() => onOpenLead(lead.id)} className="cursor-pointer">
        <div className="min-w-0 flex-1 pr-6 flex items-center gap-1.5">
          <p className="font-semibold text-[13px] truncate leading-tight" style={{ color: "var(--cf2-chrome-text-primary)" }}>{nome}</p>
          {isNoShow && <span className="shrink-0 text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wide" style={{ background: "rgba(245,158,11,0.15)", color: "var(--cf2-warning-text)" }} title="Não compareceu à reunião. Retrabalhar e reagendar.">No-show</span>}
          {isOportunidade && !isNoShow && <span className="shrink-0 text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wide" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }} title="Já é oportunidade no Pipeline">Opp</span>}
        </div>

        {(lead.empresa || lead.cargo) && (
          <p className="text-[11px] truncate mt-1" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.empresa || ""}{lead.empresa && lead.cargo ? " · " : ""}{lead.cargo || ""}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {lead.origem && (
            <span className="flex items-center gap-1 text-[9px] font-medium" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
              <OrigemIcon origem={lead.origem} /> {lead.origem}
            </span>
          )}
          {lead.utmCampaign && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(142,39,239,0.18)", color: "#c084fc" }} title={`Campanha: ${lead.utmCampaign}`}>
              <Tag className="w-2.5 h-2.5" /> {lead.utmCampaign}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2.5 gap-2">
          <OwnerChipCf2 nome={owner?.nome} avatarUrl={owner?.avatarUrl} color={stageColor} />
          <div className="flex items-center gap-1.5 shrink-0">
            {age && ageDark && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ageDark.bg, color: ageDark.text }}>{age.text}</span>}
          </div>
        </div>

        {(lead.telefone || (typeof lead.leadScore === "number" && lead.leadScore > 0)) && (
          <div className="flex items-center gap-2.5 mt-2 pt-2" style={{ borderTop: "1px solid var(--cf2-chrome-border-subtle)" }}>
            {lead.telefone && (
              <a href={callfaceCallUrl(lead.telefone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Ligar" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                <Phone className="w-3 h-3" />
              </a>
            )}
            {lead.telefone && (
              <a href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                <MessageCircle className="w-3 h-3" />
              </a>
            )}
            {typeof lead.leadScore === "number" && lead.leadScore > 0 && (
              <span className="ml-auto" title={`Lead score: ${lead.leadScore}`}>
                <Star className="w-3 h-3" style={{ color: "var(--cf2-accent-border)", fill: "var(--cf2-accent-border)" }} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
