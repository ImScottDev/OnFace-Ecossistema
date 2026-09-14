"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  SDR_STAGES, SDR_CLOSED_STAGES, SDR_MIRROR_KEYS, SDR_STAGNATION_STAGES,
} from "@/lib/crm/pipeline";
import {
  Search, X, MoreHorizontal, Tag, Briefcase, CheckCircle2, Download,
  List as ListIcon, LayoutGrid, Globe, Megaphone, Instagram, Linkedin, UserPlus, PhoneOutgoing,
  Phone, MessageCircle, Calendar, Clock,
} from "lucide-react";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { Cf2AgendarReuniaoModal, type AgendarReuniaoPayload } from "./AgendarReuniaoModal";
import { useOrgUsuarios, matchesResponsavel, matchesOrigem, buildOrigemOptions, type OrgUsuario } from "@/components/crm/BoardFilters";
import { OwnerPicker } from "@/components/crm2/prospeccao/OwnerPicker";
import { DarkFilterSelect, DarkItem } from "@/components/crm2/shared/DarkFilterSelect";

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
  SEM_RESPOSTA_COL, NUTRICAO_MERGED_COL, DESQUALIFICADO_ESTAGNADOS_COL, porRecenciaDesc } from "@/lib/crm/qualificacao-colunas";
import { Cf2LeadDrawer } from "./LeadDrawerCf2";
import { Cf2NovoLeadModal } from "./NovoLeadModal";
import { ImportModal } from "@/components/crm2/prospeccao/ImportModal";

interface ContatoLista { id: string; nome: string }
interface CadenciaDef { id: string; nome: string; totalSteps: number }

export function Cf2QualificacaoWorkspace() {
  const qc = useQueryClient();
  const { usuarios, byId: usuariosById, currentUserId } = useOrgUsuarios();
  const [searchQuery, setSearchQuery] = useState("");
  const [respFilter, setRespFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [slaFilter, setSlaFilter] = useState<"todos" | "dentro" | "fora">("todos");
  const [layout, setLayout] = useState<"kanban" | "lista">("kanban");
  const [showExport, setShowExport] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [novoLeadOpen, setNovoLeadOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pre-vendas-leads"],
    queryFn: async () => {
      const r = await fetch("/api/leads?tipo=lead&context=pre_vendas&limit=2000&sort=createdAt&order=desc");
      if (!r.ok) return { leads: [] as Lead[] };
      return (await r.json()) as { leads: Lead[] };
    },
  });

  const { data: listas = [] } = useQuery<ContatoLista[]>({
    queryKey: ["contato-listas"],
    queryFn: async () => {
      const r = await fetch("/api/contatos-unified/listas");
      return r.ok ? r.json() : [];
    },
  });

  const { data: cadencias = [] } = useQuery<CadenciaDef[]>({
    queryKey: ["prospeccao-cadencias"],
    queryFn: async () => {
      const r = await fetch("/api/prospeccao/cadencias");
      return r.ok ? r.json() : [];
    },
  });

  // CTAs "+ Novo lead"/"Importar leads" moram no Topbar (fora dessa árvore —
  // page.tsx é Server Component, o Topbar recebe `<PreVendasTopbarActions
  // />` via prop `actions`). Ponte via CustomEvent, mesmo padrão já usado
  // pela Prospecção (`prospeccao-novo-prospect`/`prospeccao-importar-prospects`).
  useEffect(() => {
    const abrirNovo = () => setNovoLeadOpen(true);
    const abrirImportar = () => setImportarOpen(true);
    window.addEventListener("pre-vendas-novo-lead", abrirNovo);
    window.addEventListener("pre-vendas-importar-leads", abrirImportar);
    return () => {
      window.removeEventListener("pre-vendas-novo-lead", abrirNovo);
      window.removeEventListener("pre-vendas-importar-leads", abrirImportar);
    };
  }, []);

  const allLeads = useMemo(() => data?.leads || [], [data]);
  const origemOptions = useMemo(() => buildOrigemOptions(allLeads), [allLeads]);

  // Opções do dropdown "Status" do toolbar — só os 5 estágios abertos do
  // funil principal (os 4 buckets auxiliares já ficam sempre visíveis como
  // colunas no próprio Kanban, não precisam de filtro extra pra aparecer).
  const statusColumns = OPEN_COLS_QUALIFICACAO;

  const matchesStatus = (l: Lead): boolean => {
    if (statusFilter === "todos") return true;
    const col = statusColumns.find((c) => c.key === statusFilter);
    if (!col) return true;
    if (!col.keys.includes(sdrBoardColumn(l))) return false;
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
      if (!q) return true;
      return (
        l.nome.toLowerCase().includes(q) ||
        (l.empresa || "").toLowerCase().includes(q) ||
        (l.utmCampaign || "").toLowerCase().includes(q) ||
        (l.origem || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads, searchQuery, respFilter, origemFilter, statusFilter, slaFilter, currentUserId]);

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

  // Atribuição individual de responsável direto no card/linha (25/08,
  // mesmo padrão já aplicado em Prospecção — "responsável em canto nenhum
  // dá pra editar").
  const assignOwner = useMutation({
    mutationFn: async ({ leadId, responsavelId }: { leadId: string; responsavelId: string | null }) => {
      const r = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavelId }),
      });
      if (!r.ok) throw new Error("falha ao atribuir responsável");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] }); toast.success("Responsável atualizado."); },
    onError: () => toast.error("Não foi possível atribuir o responsável"),
  });

  const [agendarLead, setAgendarLead] = useState<Lead | null>(null);

  /**
   * Mover etapa do board. Duas intenções DIFERENTES chegam aqui e não podem
   * ser confundidas (01/09, spec do Kauã):
   *
   *  - `qualified`    = "Marcar como Qualificado SQL". NÃO abre modal de
   *                     reunião, NÃO cria oportunidade. Só grava o
   *                     `sdr_status`, que é o que mantém o lead contado como
   *                     qualificado nos relatórios.
   *  - `m_qualified`  = "Agenda confirmada". Precisa de compromisso marcado,
   *                     então abre o modal de reunião, que é quem cria a
   *                     oportunidade (`converter-oportunidade`).
   *
   * Antes desta data as duas chaves caíam no mesmo `if` e QUALQUER tentativa
   * de qualificar abria o modal de reunião — não existia caminho pra marcar
   * SQL sem agendar.
   */
  const handleMove = (leadId: string, targetStatus: string) => {
    const lead = allLeads.find((l) => l.id === leadId);
    if (!lead) return;
    const isNoShowRecovery = lead.negocioPrincipal?.status === "no_show";
    if (targetStatus === "m_qualified" && (!lead.negocioCount || isNoShowRecovery)) {
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
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lead, empresa, campanha..." aria-label="Buscar lead, empresa, campanha"
              className="w-56 sm:w-80 pl-8 pr-7 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Faixa rolável em vez de wrap — mesmo ajuste feito em Prospecção
              25/08 (5 selects de largura variável quebravam linha de forma
              desalinhada). */}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto cf2-hide-scrollbar">
            <DarkFilterSelect value={respFilter} onChange={setRespFilter} label="Responsável" placeholder="Todos" aria-label="Todos">
              <DarkItem value="todos">Todos</DarkItem>
              {currentUserId && <DarkItem value="meu">Meus (eu)</DarkItem>}
              <DarkItem value="sem">Sem responsável</DarkItem>
              {usuarios.map((u) => <DarkItem key={u.id} value={u.id}>{u.nome}</DarkItem>)}
            </DarkFilterSelect>

            <DarkFilterSelect value={origemFilter} onChange={setOrigemFilter} label="Origem" placeholder="Todas" aria-label="Todas">
              <DarkItem value="todos">Todas</DarkItem>
              {origemOptions.map((o) => <DarkItem key={o.value} value={o.value}>{o.label} ({o.count})</DarkItem>)}
            </DarkFilterSelect>

            <DarkFilterSelect value={statusFilter} onChange={setStatusFilter} label="Status" placeholder="Todos" aria-label="Todos">
              <DarkItem value="todos">Todos</DarkItem>
              {statusColumns.map((c) => <DarkItem key={c.key} value={c.key}>{c.label}</DarkItem>)}
            </DarkFilterSelect>

            <DarkFilterSelect value={slaFilter} onChange={(v) => setSlaFilter(v as typeof slaFilter)} label="SLA" placeholder="Todos" aria-label="Todos">
              <DarkItem value="todos">Todos</DarkItem>
              <DarkItem value="dentro">Dentro do SLA</DarkItem>
              <DarkItem value="fora">Fora do SLA</DarkItem>
            </DarkFilterSelect>
          </div>

          <button onClick={() => setShowExport(true)} title="Exportar leads: escolher responsável e etapas" className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>

          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
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
          // Caixa rolável própria (01/09): a página agora tem altura fechada,
          // então a lista precisa rolar aqui dentro em vez de esticar a tela.
          <div className="h-full min-h-0 overflow-y-auto">
            <SdrListView
              leads={filteredLeads}
              usuariosById={usuariosById}
              usuarios={usuarios}
              onOpenLead={(id) => setDrawerLeadId(id)}
              onAssignOwner={(leadId, userId) => assignOwner.mutate({ leadId, responsavelId: userId })}
            />
          </div>
        ) : (
          <SdrKanbanView
            leads={filteredLeads}
            usuariosById={usuariosById}
            usuarios={usuarios}
            onDrop={handleMove}
            onOpenLead={(id) => setDrawerLeadId(id)}
            onOpenNegocio={(id) => setDrawerNegocioId(id)}
            onAssignOwner={(leadId, userId) => assignOwner.mutate({ leadId, responsavelId: userId })}
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

      <Cf2NovoLeadModal
        open={novoLeadOpen}
        onClose={() => setNovoLeadOpen(false)}
        usuarios={usuarios}
        onCreated={() => qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] })}
        onImportar={() => { setNovoLeadOpen(false); setImportarOpen(true); }}
      />
      <ImportModal
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        listas={listas}
        usuarios={usuarios}
        cadencias={cadencias}
        onImported={() => qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] })}
        title="Importar Leads"
        entityLabel="leads"
        defaultOrigem="site"
        allowOrigemChange
      />
    </div>
  );
}

// Todas as 9 colunas reais do Kanban (5 do funil principal + os 4 buckets
// auxiliares que ficam do lado, pedido do Kauã 24/08: "o exportar tem que
// ter todas as opções do kanban... todas as colunas"). Cada `match` replica
// exatamente o filtro que a coluna correspondente usa pra decidir quem
// aparece nela — nenhuma regra nova, só reaproveitando a mesma lógica.
const EXPORT_COLUNAS: { key: string; label: string; color: string; match: (l: Lead) => boolean }[] = [
  { key: NOVO_COL.key, label: NOVO_COL.label, color: NOVO_COL.color, match: (l) => NOVO_COL.keys.includes(sdrBoardColumn(l)) },
  { key: EM_CONTATO_COL.key, label: EM_CONTATO_COL.label, color: EM_CONTATO_COL.color, match: (l) => EM_CONTATO_COL.keys.includes(sdrBoardColumn(l)) },
  { key: QUALIFICACAO_COL.key, label: QUALIFICACAO_COL.label, color: QUALIFICACAO_COL.color, match: (l) => QUALIFICACAO_COL.keys.includes(sdrBoardColumn(l)) },
  { key: QUALIFICADO_SQL_COL.key, label: QUALIFICADO_SQL_COL.label, color: QUALIFICADO_SQL_COL.color, match: (l) => QUALIFICADO_SQL_COL.keys.includes(sdrBoardColumn(l)) && !l.temReuniaoAgendada },
  { key: AGENDA_CONFIRMADA_COL.key, label: AGENDA_CONFIRMADA_COL.label, color: AGENDA_CONFIRMADA_COL.color, match: (l) => AGENDA_CONFIRMADA_COL.keys.includes(sdrBoardColumn(l)) && !!l.temReuniaoAgendada },
  { key: "sdr_sem_retorno", label: SEM_RESPOSTA_COL.label, color: SEM_RESPOSTA_COL.color, match: (l) => (l.sdrStatus || "pending") === "sdr_sem_retorno" },
  { key: "no_show", label: "No-show", color: "var(--cf2-warning-text)", match: (l) => l.negocioPrincipal?.status === "no_show" },
  { key: "nutricao", label: NUTRICAO_MERGED_COL.label, color: NUTRICAO_MERGED_COL.color, match: (l) => ["sdr_sem_interesse", "sdr_retomar_depois"].includes(l.sdrStatus || "") },
  { key: "disqualified", label: DESQUALIFICADO_ESTAGNADOS_COL.label, color: DESQUALIFICADO_ESTAGNADOS_COL.color, match: (l) => (l.sdrStatus || "pending") === "disqualified" },
];

function ExportLeadsModal({ leads, usuarios, onClose, onExport }: { leads: Lead[]; usuarios: OrgUsuario[]; onClose: () => void; onExport: (lista: Lead[]) => void }) {
  const [resp, setResp] = useState("todos");
  const [stages, setStages] = useState<Set<string>>(new Set(EXPORT_COLUNAS.map((e) => e.key)));

  const toggle = (k: string) => setStages((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const todasMarcadas = stages.size === EXPORT_COLUNAS.length;
  const selecionados = leads.filter((l) => {
    if (resp !== "todos" && l.responsavelId !== resp) return false;
    return EXPORT_COLUNAS.some((c) => stages.has(c.key) && c.match(l));
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onClose}>
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
          <button type="button" onClick={() => setStages(todasMarcadas ? new Set() : new Set(EXPORT_COLUNAS.map((e) => e.key)))} className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>
            {todasMarcadas ? "Limpar" : "Todas"}
          </button>
        </div>
        <div className="space-y-1.5 mb-5 max-h-52 overflow-y-auto">
          {EXPORT_COLUNAS.map((e) => (
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

// Responsável editável direto no card (25/08, mesmo pedido/padrão já
// aplicado em Prospecção) — reaproveita o OwnerPicker compartilhado em vez
// de inventar um segundo dropdown de atribuição.
function OwnerChipCf2({ ownerId, nome, usuarios, onAssign }: {
  ownerId?: string | null; nome?: string | null; usuarios: OrgUsuario[]; onAssign: (userId: string | null) => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] min-w-0" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
      <OwnerPicker ownerId={ownerId} ownerName={nome} usuarios={usuarios} onAssign={onAssign} size={20} align="start" />
      <span className="truncate max-w-[80px]">{nome ? nome.split(/\s+/)[0] : "Sem dono"}</span>
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

// Ordem de exibição dos grupos — mesma ordem das colunas do Kanban, pra não
// ler como uma lista solta sem hierarquia.
const LIST_STAGE_ORDER = [
  NOVO_COL, EM_CONTATO_COL, QUALIFICACAO_COL, QUALIFICADO_SQL_COL, AGENDA_CONFIRMADA_COL,
  SEM_RESPOSTA_COL, NUTRICAO_MERGED_COL, DESQUALIFICADO_ESTAGNADOS_COL,
];

/** Visualização em lista (toggle do toolbar) — mesmo dataset filtrado do
 * Kanban, sem drag-and-drop. Linhas únicas agrupadas por etapa (padrão
 * Circle: issue-line.tsx — nunca uma tabela de colunas fixas), mesmo
 * espírito já aplicado em Prospecção 25/08. */
function SdrListView({ leads, usuariosById, usuarios, onOpenLead, onAssignOwner }: {
  leads: Lead[]; usuariosById: Map<string, OrgUsuario>; usuarios: OrgUsuario[];
  onOpenLead: (id: string) => void; onAssignOwner: (leadId: string, userId: string | null) => void;
}) {
  const groups = LIST_STAGE_ORDER
    .map((col) => ({ stage: col, leads: leads.filter((l) => resolveDisplayStage(l).label === col.label) }))
    .filter((group) => group.leads.length > 0);
  const grouped = new Set(groups.flatMap((g) => g.leads.map((l) => l.id)));
  const outros = leads.filter((l) => !grouped.has(l.id));

  if (leads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center rounded-2xl text-[13px]" style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
        Nenhum lead nessa seleção.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto rounded-2xl" style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
      {groups.map((group) => (
        <div key={group.stage.key}>
          <div className="flex items-center gap-2 px-4 h-9 sticky top-0" style={{ background: "var(--cf2-chrome-surface-active)" }}>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: group.stage.color }} />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: group.stage.color }}>{group.stage.label}</h3>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{group.leads.length}</span>
          </div>
          {group.leads.map((lead) => (
            <SdrListRow key={lead.id} lead={lead} owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined} usuarios={usuarios} onOpenLead={onOpenLead} onAssignOwner={onAssignOwner} />
          ))}
        </div>
      ))}
      {outros.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-4 h-9 sticky top-0" style={{ background: "var(--cf2-chrome-surface-active)" }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Outros</h3>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{outros.length}</span>
          </div>
          {outros.map((lead) => (
            <SdrListRow key={lead.id} lead={lead} owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined} usuarios={usuarios} onOpenLead={onOpenLead} onAssignOwner={onAssignOwner} />
          ))}
        </div>
      )}
    </div>
  );
}

function SdrListRow({ lead, owner, usuarios, onOpenLead, onAssignOwner }: {
  lead: Lead; owner?: OrgUsuario; usuarios: OrgUsuario[]; onOpenLead: (id: string) => void; onAssignOwner: (leadId: string, userId: string | null) => void;
}) {
  const age = stageAge(lead.updatedAt, lead.sdrStatus || "pending");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenLead(lead.id)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpenLead(lead.id); }}
      className="flex items-center gap-3 h-11 px-4 cursor-pointer outline-none hover:bg-white/[0.03]"
      style={{ borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}
    >
      <span className="text-[12.5px] font-semibold truncate w-[180px] shrink-0" style={{ color: "var(--cf2-chrome-text-primary)" }}>{lead.nome}{lead.sobrenome ? ` ${lead.sobrenome}` : ""}</span>
      <span className="text-[12px] truncate w-[160px] shrink-0 hidden sm:block" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.empresa || "—"}</span>
      <span className="text-[11px] items-center gap-1.5 hidden md:flex" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
        <OrigemIcon origem={lead.origem} /> {lead.origem || "—"}
      </span>
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        <span className="text-[11px] tabular-nums hidden lg:inline-block" style={{ color: age?.breached ? "var(--cf2-danger-text)" : "var(--cf2-chrome-text-secondary)" }}>{age?.text || "—"}</span>
        <span onClick={(e) => e.stopPropagation()}>
          <OwnerPicker ownerId={lead.responsavelId} ownerName={owner?.nome} usuarios={usuarios} onAssign={(userId) => onAssignOwner(lead.id, userId)} size={22} />
        </span>
      </div>
    </div>
  );
}

/* ═══ KANBAN ═══ */

function SdrKanbanView({ leads, usuariosById, usuarios, onDrop, onOpenLead, onOpenNegocio, onAssignOwner }: {
  leads: Lead[]; usuariosById: Map<string, OrgUsuario>; usuarios: OrgUsuario[];
  onDrop: (id: string, sdrStatus: string) => void; onOpenLead: (id: string) => void; onOpenNegocio: (id: string) => void;
  onAssignOwner: (leadId: string, userId: string | null) => void;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [expandedEstagnado, setExpandedEstagnado] = useState<string | null>(null);

  // 5 colunas abertas do fluxo principal (Novo/Em Contato/Qualificação/
  // Qualificado SQL/Agenda Confirmada, De/Para aprovado 17/08) — todas
  // largura igual, sem barra colapsada. Os 4 buckets auxiliares (pedido do
  // Kauã 24/08: "não é pra ficar embaixo, é pra ficar do lado, na mesma
  // estrutura") ficam NA MESMA linha, depois de Agenda Confirmada — cada um
  // é uma coluna estreita recolhida por padrão, clique expande e mostra os
  // leads com o mesmo LeadCard das colunas principais. `dropTarget` reusa os
  // mesmos valores reais de OPEN_COLS_ESTAGNADOS (nenhuma regra de negócio
  // nova); "No-show" não tem dropTarget próprio — é um espelho de status de
  // negócio, não um sdr_status gravável. A view "Estagnados" separada foi
  // removida (24/08, pedido do Kauã: "já tá no kanban") — esses 4 buckets
  // agora são a ÚNICA forma de ver leads estagnados, sempre visíveis aqui.
  const estagnadosBuckets: { key: string; label: string; color: string; dropTarget: string | null; leads: Lead[] }[] = [
    { key: "sdr_sem_retorno", label: "Sem resposta", color: SEM_RESPOSTA_COL.color, dropTarget: SEM_RESPOSTA_COL.dropTarget, leads: leads.filter((l) => (l.sdrStatus || "pending") === "sdr_sem_retorno") },
    { key: "no_show", label: "No-show", color: "var(--cf2-warning-text)", dropTarget: null, leads: leads.filter((l) => l.negocioPrincipal?.status === "no_show") },
    { key: "nutricao", label: "Nutrição / Retomar", color: NUTRICAO_MERGED_COL.color, dropTarget: NUTRICAO_MERGED_COL.dropTarget, leads: leads.filter((l) => ["sdr_sem_interesse", "sdr_retomar_depois"].includes(l.sdrStatus || "")) },
    { key: "disqualified", label: "Desqualificado", color: DESQUALIFICADO_ESTAGNADOS_COL.color, dropTarget: DESQUALIFICADO_ESTAGNADOS_COL.dropTarget, leads: leads.filter((l) => (l.sdrStatus || "pending") === "disqualified") },
  ];
  const openCols = OPEN_COLS_QUALIFICACAO;

  const renderColumnCards = (stage: KanbanCol) => {
    const matchKeys = stage.keys || [stage.key];
    const mirror = SDR_MIRROR_KEYS.includes(stage.key);
    return leads
      .filter((l) => matchKeys.includes(sdrBoardColumn(l)))
      .filter((l) => (stage.filter ? stage.filter(l) : true))
      // No-show continua com prioridade (pedido anterior do Kauã), e DENTRO
      // de cada grupo o mais recente fica em cima (01/09).
      .sort((a, b) =>
        (Number(b.negocioPrincipal?.status === "no_show") - Number(a.negocioPrincipal?.status === "no_show"))
        || porRecenciaDesc(a, b)
      )
      .map((lead) => (
        <LeadCard
          key={lead.id} lead={lead} readOnly={mirror}
          owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined}
          usuarios={usuarios} onAssignOwner={onAssignOwner}
          onOpenLead={onOpenLead} onOpenNegocio={onOpenNegocio} onMove={(s) => onDrop(lead.id, s)}
        />
      ));
  };

  return (
    <div className="relative h-full flex flex-col gap-3">
      <div className="flex-1 flex min-h-0 flex-col gap-3">
        <div className="flex-1 flex gap-3 min-h-0 overflow-x-auto pb-1">
          {openCols.map((stage) => {
            const cards = renderColumnCards(stage);
            const isDragOver = dragOverStage === stage.key;
            return (
              <div
                key={stage.key}
                className="w-[300px] shrink-0 rounded-2xl flex flex-col max-h-full"
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

          {estagnadosBuckets.map((item) => (
            <AuxKanbanColumn
              key={item.key}
              item={item}
              expanded={expandedEstagnado === item.key}
              onToggle={() => setExpandedEstagnado((current) => (current === item.key ? null : item.key))}
              isDragOver={dragOverStage === item.key}
              setDragOverStage={setDragOverStage}
              onOpenLead={onOpenLead}
              onOpenNegocio={onOpenNegocio}
              onDrop={onDrop}
              usuariosById={usuariosById}
              usuarios={usuarios}
              onAssignOwner={onAssignOwner}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ COLUNA AUXILIAR (Sem resposta / No-show / Nutrição / Desqualificado) ═══ */
// Pedido do Kauã 24/08: mesma estrutura das colunas principais, na mesma
// linha — recolhida (barra estreita, clique expande) em vez do grid 2x2
// que ficava embaixo do kanban.

function AuxKanbanColumn({
  item, expanded, onToggle, isDragOver, setDragOverStage, onOpenLead, onOpenNegocio, onDrop, usuariosById, usuarios, onAssignOwner,
}: {
  item: { key: string; label: string; color: string; dropTarget: string | null; leads: Lead[] };
  expanded: boolean;
  onToggle: () => void;
  isDragOver: boolean;
  setDragOverStage: (v: string | null) => void;
  onOpenLead: (id: string) => void;
  onOpenNegocio: (id: string) => void;
  onDrop: (id: string, status: string) => void;
  usuariosById: Map<string, OrgUsuario>;
  usuarios: OrgUsuario[];
  onAssignOwner: (leadId: string, userId: string | null) => void;
}) {
  const canDrop = !!item.dropTarget;
  const dragProps = canDrop
    ? {
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setDragOverStage(item.key); },
        onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOverStage(null);
          const leadId = e.dataTransfer.getData("leadId");
          if (leadId && item.dropTarget) onDrop(leadId, item.dropTarget);
        },
      }
    : {};

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={`${item.label} (${item.leads.length})${canDrop ? " — solte um lead aqui" : ""}`}
        aria-expanded={false}
        aria-label={`Expandir ${item.label}`}
        className="w-12 shrink-0 rounded-2xl flex flex-col items-center gap-2 pt-3 pb-3"
        style={{ background: isDragOver ? `${item.color}10` : "var(--cf2-chrome-bg-alt)", border: isDragOver ? `2px dashed ${item.color}` : "1px solid var(--cf2-chrome-border-subtle)" }}
        {...dragProps}
      >
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: item.color, background: `${item.color}18` }}>{item.leads.length}</span>
        <span
          className="flex-1 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
          style={{ color: item.color, writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {item.label}
        </span>
      </button>
    );
  }

  return (
    <div
      className="w-[300px] shrink-0 rounded-2xl flex flex-col max-h-full"
      style={{ background: isDragOver ? `${item.color}10` : "var(--cf2-chrome-bg-alt)", border: isDragOver ? `2px dashed ${item.color}` : "1px solid var(--cf2-chrome-border-subtle)" }}
      {...dragProps}
    >
      <button type="button" onClick={onToggle} className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between text-left" aria-expanded={true} aria-label={`Recolher ${item.label}`}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: item.color }}>{item.label}</span>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>{item.leads.length}</span>
      </button>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0">
        {item.leads.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Vazio</div>
        ) : item.leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined}
            usuarios={usuarios}
            onAssignOwner={onAssignOwner}
            onOpenLead={onOpenLead}
            onOpenNegocio={onOpenNegocio}
            onMove={(s) => onDrop(lead.id, s)}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══ CARD ═══ */

/** Última ação real no lead (24/08, pedido do Kauã: "tem que ter 2 tempos,
 * um pro estágio e outro pra ação" — ex: 3 dias no estágio, mas mandou
 * mensagem há 2min). Usa os timestamps reais já carregados no lead —
 * `lastContactAt` (toque de cadência/ligação), `whatsappUltimaMsgAt`
 * (mensagem, enviada ou recebida) e `updatedAt` (qualquer mudança registrada,
 * inclusive nota — `POST /notas` já toca `updatedAt` de propósito) — sem
 * fabricar um sinal novo, só pega o mais recente dos três.
 */
function ultimaAcaoIso(lead: Lead): string | null {
  const candidatos = [lead.lastContactAt, lead.whatsappUltimaMsgAt, lead.updatedAt].filter(Boolean) as string[];
  if (candidatos.length === 0) return null;
  return candidatos.reduce((max, cur) => (new Date(cur).getTime() > new Date(max).getTime() ? cur : max));
}

function relativeShort(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function LeadCard({ lead, readOnly = false, owner, usuarios, onAssignOwner, onOpenLead, onOpenNegocio, onMove, onDragStart, onDragEnd }: {
  lead: Lead; readOnly?: boolean; owner?: OrgUsuario; usuarios: OrgUsuario[];
  onAssignOwner: (leadId: string, userId: string | null) => void;
  onOpenLead: (id: string) => void; onOpenNegocio: (id: string) => void; onMove: (status: string) => void;
  onDragStart?: () => void; onDragEnd?: () => void;
}) {
  const age = stageAge(lead.updatedAt, lead.sdrStatus || "pending");
  const ultimaAcao = ultimaAcaoIso(lead);
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
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Marcar estagnado</div>
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
            <span className="flex items-center gap-0.5 text-[9px] font-medium truncate max-w-[160px]" style={{ color: "var(--cf2-chrome-text-secondary)" }} title={`Campanha: ${lead.utmCampaign}`}>
              <Tag className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{lead.utmCampaign}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2.5 gap-2">
          <OwnerChipCf2 ownerId={lead.responsavelId} nome={owner?.nome} usuarios={usuarios} onAssign={(userId) => onAssignOwner(lead.id, userId)} />
          <div className="flex items-center gap-1 shrink-0">
            {/* 2 tempos distintos (24/08, pedido do Kauã): tempo NO ESTÁGIO
                (colorido por SLA, já existia) vs. última AÇÃO real — nota,
                ligação, mensagem — que pode ser bem mais recente. */}
            {ultimaAcao && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--cf2-chrome-bg)", color: "var(--cf2-chrome-text-secondary)" }} title={`Última ação registrada: há ${relativeShort(ultimaAcao)}`}>
                <Clock className="w-2.5 h-2.5" /> {relativeShort(ultimaAcao)}
              </span>
            )}
            {age && ageDark && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ageDark.bg, color: ageDark.text }} title="Tempo no estágio atual">{age.text}</span>}
          </div>
        </div>

        {lead.telefone && (
          <div className="flex items-center gap-2.5 mt-2 pt-2" style={{ borderTop: "1px solid var(--cf2-chrome-border-subtle)" }}>
            <Link href={`/atendimento?leadId=${lead.id}&canal=ligacao&telefone=${digitsForDialer(lead.telefone)}`} onClick={(e) => e.stopPropagation()} title="Ligar (abre em Atendimento)" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
              <Phone className="w-3 h-3" />
            </Link>
            <Link href={`/atendimento?leadId=${lead.id}&canal=whatsapp&telefone=${digitsForDialer(lead.telefone)}`} onClick={(e) => e.stopPropagation()} title="WhatsApp (abre em Atendimento)" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
              <MessageCircle className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
