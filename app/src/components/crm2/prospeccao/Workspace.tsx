"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle, ArrowUpRight, Building2, CheckCircle2, ChevronDown,
  ExternalLink, KanbanSquare, List, ListFilter, MessageSquareReply,
  Search, Sparkles, UsersRound, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  matchesDateFilter, matchesResponsavel, type DateFilter, useOrgUsuarios,
} from "@/components/crm/BoardFilters";
import {
  BULK_ACTIONS, PROSPECCAO_STATUS, resolveProspeccaoStatus,
  type BulkActionKey, type ProspeccaoLead,
} from "./shared";
import { ImportModal } from "./ImportModal";
import { NovoProspectModal } from "./NovoProspectModal";
import { ProspeccaoDrawer } from "./ProspeccaoDrawer";

interface Lista { id: string; nome: string; cor: string; count: number }
interface CadenciaDef { id: string; nome: string; totalSteps: number }
interface LabelDef { id: string; nome: string; cor: string }
interface CadenciaPerformance {
  id: string; nome: string; matriculados: number; ativos: number;
  responderam: number; qualificados: number; falhas: number;
}
interface BoardResponse {
  leads: ProspeccaoLead[];
  kpis: {
    ativos: number; emCadencia: number; aguardandoResposta: number;
    responderam: number; qualificados: number; conversaoPct: number;
    semContato: number; semCadencia: number; errosCadencia: number;
  };
  cadenciasPerformance: CadenciaPerformance[];
}

const EMPTY_KPIS: BoardResponse["kpis"] = {
  ativos: 0, emCadencia: 0, aguardandoResposta: 0, responderam: 0,
  qualificados: 0, conversaoPct: 0, semContato: 0, semCadencia: 0,
  errosCadencia: 0,
};
const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "Todo o período" }, { value: "today", label: "Hoje" },
  { value: "7days", label: "7 dias" }, { value: "30days", label: "30 dias" },
];

export function Cf2ProspeccaoWorkspace() {
  const qc = useQueryClient();
  const { usuarios, byId: usuariosById, currentUserId } = useOrgUsuarios();
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState("todos");
  const [listaFilter, setListaFilter] = useState("todas");
  const [cadenciaFilter, setCadenciaFilter] = useState<"todas" | "ativas" | "sem">("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [bulkMenu, setBulkMenu] = useState<BulkActionKey | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<BoardResponse>({
    queryKey: ["prospeccao-board"],
    queryFn: async () => {
      const response = await fetch("/api/prospeccao/board");
      if (!response.ok) throw new Error("Não foi possível carregar a operação outbound");
      return response.json();
    },
  });
  const { data: listas = [] } = useQuery<Lista[]>({
    queryKey: ["contato-listas"],
    queryFn: async () => {
      const response = await fetch("/api/contatos-unified/listas");
      if (!response.ok) throw new Error("Não foi possível carregar as listas");
      return response.json();
    },
  });
  const { data: cadencias = [] } = useQuery<CadenciaDef[]>({
    queryKey: ["prospeccao-cadencias"],
    queryFn: async () => {
      const response = await fetch("/api/prospeccao/cadencias");
      if (!response.ok) throw new Error("Não foi possível carregar as cadências");
      return response.json();
    },
  });
  const { data: labels = [] } = useQuery<LabelDef[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const response = await fetch("/api/labels");
      if (!response.ok) throw new Error("Não foi possível carregar as tags");
      return response.json();
    },
  });

  const allLeads = useMemo(() => data?.leads ?? [], [data?.leads]);
  // Compatível com uma API local que ainda esteja reiniciando sobre o
  // contrato anterior: nunca deixa `undefined` vazar para a interface.
  const kpis = { ...EMPTY_KPIS, ...(data?.kpis ?? {}) };
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allLeads.filter((lead) => {
      if (!matchesResponsavel(lead.responsavelId, respFilter, currentUserId)) return false;
      if (listaFilter !== "todas" && lead.listaId !== listaFilter) return false;
      if (cadenciaFilter === "ativas" && !(lead.cadencia && ["active", "waiting"].includes(lead.cadencia.status))) return false;
      if (cadenciaFilter === "sem" && lead.cadencia) return false;
      if (!matchesDateFilter(lead.createdAt || null, dateFilter)) return false;
      if (statusFilter !== "todos" && resolveProspeccaoStatus(lead).key !== statusFilter) return false;
      if (!query) return true;
      return [lead.nome, lead.sobrenome, lead.empresa, lead.cargo, lead.email, lead.telefone, lead.listaNome]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [allLeads, cadenciaFilter, currentUserId, dateFilter, listaFilter, respFilter, search, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((lead) => selected.has(lead.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((lead) => lead.id)));
  const toggleOne = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["prospeccao-board"] });

  useEffect(() => {
    const abrirNovo = () => setNovoOpen(true);
    const abrirImportar = () => setImportOpen(true);
    window.addEventListener("prospeccao-novo-prospect", abrirNovo);
    window.addEventListener("prospeccao-importar-prospects", abrirImportar);
    return () => {
      window.removeEventListener("prospeccao-novo-prospect", abrirNovo);
      window.removeEventListener("prospeccao-importar-prospects", abrirImportar);
    };
  }, []);

  const bulk = useMutation({
    mutationFn: async ({ action, payload }: { action: BulkActionKey; payload?: string }) => {
      const leadIds = Array.from(selected);
      const ensureOk = async (response: Response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "A operação não pôde ser concluída");
        }
      };
      if (action === "atribuir_responsavel") {
        await Promise.all(leadIds.map(async (id) => ensureOk(await fetch(`/api/leads/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsavelId: payload || null }),
        }))));
      } else if (action === "adicionar_cadencia") {
        await ensureOk(await fetch("/api/prospeccao/cadencia/enroll", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds, cadenceDefinitionId: payload }),
        }));
      } else if (action === "trocar_lista") {
        const previousLists = new Map<string, string[]>();
        for (const lead of allLeads) if (selected.has(lead.id) && lead.listaId) previousLists.set(lead.listaId, [...(previousLists.get(lead.listaId) ?? []), lead.id]);
        await Promise.all(Array.from(previousLists.entries()).map(async ([listaId, ids]) => ensureOk(await fetch("/api/contatos-unified/listas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove", listaId, leadIds: ids }),
        }))));
        await ensureOk(await fetch("/api/contatos-unified/listas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", listaId: payload, leadIds }),
        }));
      } else if (action === "adicionar_tag") {
        await Promise.all(leadIds.map(async (id) => ensureOk(await fetch(`/api/leads/${id}/labels`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelId: payload }),
        }))));
      } else if (action === "pausar") {
        await ensureOk(await fetch("/api/prospeccao/cadencia/pausar", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds }),
        }));
      } else if (action === "arquivar") {
        await Promise.all(leadIds.map(async (id) => ensureOk(await fetch(`/api/leads/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdrStatus: "disqualified" }),
        }))));
      }
    },
    onSuccess: () => {
      invalidate(); setSelected(new Set()); setBulkMenu(null);
      toast.success("Ação aplicada aos prospects selecionados.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível aplicar a ação"),
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="overflow-hidden rounded-2xl border" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-5 lg:divide-y-0">
          <Metric icon={UsersRound} label="Prospects na máquina" value={kpis.ativos} detail={`${listas.length} lista${listas.length === 1 ? "" : "s"}`} />
          <Metric icon={Sparkles} label="Em follow-up" value={kpis.emCadencia} detail={`${kpis.aguardandoResposta} aguardando resposta`} />
          <Metric icon={MessageSquareReply} label="Responderam" value={kpis.responderam} detail="Precisam de decisão" tone="attention" />
          <Metric icon={CheckCircle2} label="Qualificados" value={kpis.qualificados} detail="Enviados para Pré-vendas" tone="success" />
          <Metric icon={ArrowUpRight} label="Conversão outbound" value={`${kpis.conversaoPct}%`} detail="Base → Pré-vendas" accent />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <div className="rounded-2xl border p-4" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Follow-ups em execução</h2><p className="mt-0.5 text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Desempenho real das inscrições, sem estimar entrega ou abertura.</p></div>
            <Link href="/automacoes/cadencias" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--cf2-success-text)" }}>Gerenciar <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
          {data?.cadenciasPerformance?.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--cf2-text-tertiary)" }}><th className="pb-2">Follow-up</th><th className="pb-2">Inscritos</th><th className="pb-2">Ativos</th><th className="pb-2">Respostas</th><th className="pb-2">Pré-vendas</th></tr></thead><tbody>
              {data.cadenciasPerformance.slice(0, 5).map((cadence) => <tr key={cadence.id} className="border-t text-xs" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}><td className="py-2.5 font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{cadence.nome}</td><td className="py-2.5">{cadence.matriculados}</td><td className="py-2.5">{cadence.ativos}</td><td className="py-2.5">{cadence.responderam}</td><td className="py-2.5 font-semibold">{cadence.qualificados}</td></tr>)}
            </tbody></table></div>
          ) : <p className="rounded-xl border border-dashed px-4 py-5 text-xs" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}>Nenhum follow-up possui prospects inscritos ainda.</p>}
        </div>
        <div className="rounded-2xl border p-4" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
          <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: "var(--cf2-warning-text)" }} /><h2 className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Atenção agora</h2></div>
          <div className="divide-y"><AlertRow value={kpis.semCadencia} label="prospects sem follow-up" onClick={() => setCadenciaFilter("sem")} /><AlertRow value={kpis.semContato} label="sem telefone e e-mail" /><AlertRow value={kpis.responderam} label="respostas aguardando decisão" onClick={() => setStatusFilter("respondeu")} /><AlertRow value={kpis.errosCadencia} label="follow-ups com falha" /></div>
        </div>
      </section>

      <section className="rounded-2xl border" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <div className="flex flex-col gap-3 border-b p-3.5 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: "var(--cf2-border-default)" }}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 xl:max-w-[340px]"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pessoa, empresa, cargo ou contato" aria-label="Buscar prospects" className="h-9 w-full rounded-lg border bg-transparent pl-9 pr-3 text-xs outline-none focus-visible:ring-2" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} /></div>
            <FilterSelect value={listaFilter} onChange={setListaFilter} label="Lista"><option value="todas">Todas as listas</option>{listas.map((lista) => <option key={lista.id} value={lista.id}>{lista.nome} ({lista.count})</option>)}</FilterSelect>
            <FilterSelect value={statusFilter} onChange={setStatusFilter} label="Status"><option value="todos">Todos os status</option>{PROSPECCAO_STATUS.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}</FilterSelect>
            <FilterSelect value={cadenciaFilter} onChange={(value) => setCadenciaFilter(value as typeof cadenciaFilter)} label="Follow-up"><option value="todas">Todos</option><option value="ativas">Ativos</option><option value="sem">Sem follow-up</option></FilterSelect>
            <FilterSelect value={respFilter} onChange={setRespFilter} label="Responsável"><option value="todos">Todos</option>{currentUserId && <option value="meu">Meus prospects</option>}{usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}</FilterSelect>
            <FilterSelect value={dateFilter} onChange={(value) => setDateFilter(value as DateFilter)} label="Período">{DATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect>
          </div>
          <div className="flex items-center justify-between gap-2 xl:justify-end"><span className="text-xs tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{filtered.length} de {allLeads.length}</span><div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface-muted)" }}><ViewButton active={view === "table"} label="Tabela" icon={List} onClick={() => setView("table")} /><ViewButton active={view === "kanban"} label="Kanban" icon={KanbanSquare} onClick={() => setView("kanban")} /></div><Link href="/prospeccao-legado" title="Busca Apollo disponível no módulo legado" className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>Apollo <ExternalLink className="h-3.5 w-3.5" /></Link></div>
        </div>

        {selected.size > 0 && <div className="flex flex-col gap-2 border-b px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface-muted)" }}><p className="text-xs font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{selected.size} prospect{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}</p><div className="flex flex-wrap items-center gap-1.5">{BULK_ACTIONS.map((action) => <BulkButton key={action.key} label={action.label} active={bulkMenu === action.key} onClick={() => setBulkMenu(bulkMenu === action.key ? null : action.key)} />)}<button onClick={() => setSelected(new Set())} aria-label="Limpar seleção" className="rounded-lg p-2" style={{ color: "var(--cf2-text-tertiary)" }}><X className="h-3.5 w-3.5" /></button></div></div>}
        {bulkMenu && <BulkActionPanel action={bulkMenu} usuarios={usuarios} listas={listas} cadencias={cadencias} labels={labels} pending={bulk.isPending} onConfirm={(payload) => bulk.mutate({ action: bulkMenu, payload })} onCancel={() => setBulkMenu(null)} />}

        {isLoading ? <LoadingState /> : isError ? <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><AlertTriangle className="h-5 w-5" style={{ color: "var(--cf2-danger-text)" }} /><div><p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>A operação outbound não carregou</p><p className="mt-1 text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Verifique a API e tente novamente.</p></div><button onClick={() => refetch()} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>Tentar novamente</button></div> : filtered.length === 0 ? <div className="flex flex-col items-center gap-2 px-6 py-14 text-center"><ListFilter className="h-5 w-5" style={{ color: "var(--cf2-text-tertiary)" }} /><p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Nenhum prospect neste recorte</p><p className="max-w-sm text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Ajuste os filtros ou importe uma lista para alimentar a operação outbound.</p></div> : view === "table" ? <ProspectsTable leads={filtered} selected={selected} allSelected={allSelected} usuariosById={usuariosById} onToggleAll={toggleAll} onToggle={toggleOne} onOpen={setDrawerLeadId} /> : <ProspectsKanban leads={filtered} selected={selected} usuariosById={usuariosById} onToggle={toggleOne} onOpen={setDrawerLeadId} />}
      </section>

      <ProspeccaoDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} usuariosById={usuariosById} cadencias={cadencias} onChanged={invalidate} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} listas={listas} usuarios={usuarios} cadencias={cadencias} onImported={() => { invalidate(); qc.invalidateQueries({ queryKey: ["contato-listas"] }); }} />
      <NovoProspectModal open={novoOpen} onClose={() => setNovoOpen(false)} listas={listas} usuarios={usuarios} onCreated={() => { invalidate(); qc.invalidateQueries({ queryKey: ["contato-listas"] }); }} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, accent, tone }: { icon: typeof UsersRound; label: string; value: string | number; detail: string; accent?: boolean; tone?: "attention" | "success" }) {
  const iconColor = accent ? "var(--cf2-accent-border)" : tone === "attention" ? "var(--cf2-warning-text)" : tone === "success" ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)";
  return <div className="flex min-h-[106px] flex-col justify-between gap-3 p-4 lg:min-h-[116px]"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{label}</span><Icon className="h-4 w-4" style={{ color: iconColor }} /></div><div><p className="text-2xl font-bold tabular-nums" style={{ color: accent ? "var(--cf2-success-text)" : "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{value}</p><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{detail}</p></div></div>;
}
function AlertRow({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
  const content = <><span className="font-bold tabular-nums" style={{ color: value > 0 ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)" }}>{value}</span><span className="flex-1" style={{ color: "var(--cf2-text-secondary)" }}>{label}</span>{onClick && <ArrowUpRight className="h-3.5 w-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />}</>;
  return onClick ? <button onClick={onClick} className="flex w-full items-center gap-2 py-2.5 text-left text-xs hover:opacity-75">{content}</button> : <div className="flex items-center gap-2 py-2.5 text-xs">{content}</div>;
}
function FilterSelect({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 max-w-[180px] rounded-lg border bg-transparent px-2.5 text-xs font-medium outline-none focus-visible:ring-2" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>{children}</select>;
}
function ViewButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof List; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={active} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold" style={{ background: active ? "var(--cf2-bg-surface)" : "transparent", color: active ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)", boxShadow: active ? "0 1px 3px rgba(15,23,42,.08)" : "none" }}><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function ProspectsTable({ leads, selected, allSelected, usuariosById, onToggleAll, onToggle, onOpen }: { leads: ProspeccaoLead[]; selected: Set<string>; allSelected: boolean; usuariosById: Map<string, { nome: string }>; onToggleAll: () => void; onToggle: (id: string) => void; onOpen: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left"><thead className="sticky top-0 z-[1]" style={{ background: "var(--cf2-bg-surface-muted)" }}><tr><th className="w-10 px-3.5 py-2.5"><input aria-label="Selecionar todos os prospects visíveis" type="checkbox" checked={allSelected} onChange={onToggleAll} /></th>{["Prospect", "Empresa", "Contato", "Lista / origem", "Follow-up", "Último toque", "Próxima ação", "Responsável", "Status"].map((heading) => <th key={heading} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>{heading}</th>)}</tr></thead><tbody>{leads.map((lead) => {
    const status = resolveProspeccaoStatus(lead); const owner = lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined;
    return <tr key={lead.id} className="group cursor-pointer border-t hover:bg-black/[0.018]" style={{ borderColor: "var(--cf2-border-default)" }} onClick={() => onOpen(lead.id)}><td className="px-3.5 py-3" onClick={(event) => event.stopPropagation()}><input aria-label={`Selecionar ${lead.nome}`} type="checkbox" checked={selected.has(lead.id)} onChange={() => onToggle(lead.id)} /></td><td className="px-3 py-3"><p className="text-xs font-bold" style={{ color: "var(--cf2-text-primary)" }}>{lead.nome}{lead.sobrenome ? ` ${lead.sobrenome}` : ""}</p><p className="mt-0.5 max-w-[170px] truncate text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.cargo || "Cargo não informado"}</p></td><td className="px-3 py-3"><p className="max-w-[180px] truncate text-xs font-medium" style={{ color: "var(--cf2-text-secondary)" }}>{lead.empresa || "—"}</p></td><td className="px-3 py-3"><p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{lead.telefone || lead.email || "—"}</p><p className="mt-0.5 max-w-[160px] truncate text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.telefone && lead.email ? lead.email : ""}</p></td><td className="px-3 py-3"><p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{lead.listaNome || "Sem lista"}</p><p className="mt-0.5 text-[11px] uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.origem || "outbound"}</p></td><td className="px-3 py-3"><CadenceCell lead={lead} /></td><td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{lead.updatedAt ? relTime(lead.updatedAt) : "—"}</td><td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{formatNextAction(lead)}</td><td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{owner?.nome || "Sem responsável"}</td><td className="px-3 py-3"><StatusBadge status={status} /></td></tr>;
  })}</tbody></table></div>;
}

function ProspectsKanban({ leads, selected, usuariosById, onToggle, onOpen }: { leads: ProspeccaoLead[]; selected: Set<string>; usuariosById: Map<string, { nome: string }>; onToggle: (id: string) => void; onOpen: (id: string) => void }) {
  return <div className="overflow-x-auto p-3.5"><div className="flex min-w-max gap-3">{PROSPECCAO_STATUS.map((status) => {
    const columnLeads = leads.filter((lead) => resolveProspeccaoStatus(lead).key === status.key);
    return <section key={status.key} className="flex w-[272px] flex-col rounded-xl border" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-canvas)" }}><header className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: "var(--cf2-border-default)" }}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: status.color }} /><h3 className="text-xs font-bold" style={{ color: "var(--cf2-text-primary)" }}>{status.label}</h3></div><span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>{columnLeads.length}</span></header><div className="flex min-h-[176px] flex-col gap-2 p-2">{columnLeads.length === 0 && <p className="px-2 py-5 text-center text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum prospect</p>}{columnLeads.map((lead) => <ProspectCard key={lead.id} lead={lead} selected={selected.has(lead.id)} owner={lead.responsavelId ? usuariosById.get(lead.responsavelId)?.nome : undefined} onToggle={() => onToggle(lead.id)} onOpen={() => onOpen(lead.id)} />)}</div></section>;
  })}</div></div>;
}

function ProspectCard({ lead, owner, selected, onToggle, onOpen }: { lead: ProspeccaoLead; owner?: string; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return <article role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }} className="cursor-pointer rounded-xl border p-3 outline-none transition-shadow hover:shadow-sm focus-visible:ring-2" style={{ background: "var(--cf2-bg-surface)", borderColor: selected ? "var(--cf2-accent-border)" : "var(--cf2-border-default)" }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-xs font-bold" style={{ color: "var(--cf2-text-primary)" }}>{lead.nome}{lead.sobrenome ? ` ${lead.sobrenome}` : ""}</h4><p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.cargo || "Cargo não informado"}</p></div><input aria-label={`Selecionar ${lead.nome}`} type="checkbox" checked={selected} onClick={(event) => event.stopPropagation()} onChange={onToggle} /></div><div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{lead.empresa || "Empresa não informada"}</span></div><div className="mt-3 flex flex-wrap gap-1">{lead.listaNome && <MiniTag>{lead.listaNome}</MiniTag>}{lead.labels?.slice(0, 2).map((label) => <MiniTag key={label.id}>{label.nome}</MiniTag>)}</div><div className="mt-3"><CadenceCell lead={lead} compact /></div><div className="mt-3 grid grid-cols-2 gap-2 border-t pt-2.5 text-[10px]" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}><div><span className="block">Último toque</span><strong className="mt-0.5 block truncate font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{lead.updatedAt ? relTime(lead.updatedAt) : "—"}</strong></div><div><span className="block">Responsável</span><strong className="mt-0.5 block truncate font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{owner || "Não atribuído"}</strong></div></div></article>;
}
function CadenceCell({ lead, compact = false }: { lead: ProspeccaoLead; compact?: boolean }) {
  if (!lead.cadencia) return <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem follow-up</span>;
  return <div className="min-w-[118px]"><p className={`${compact ? "text-[11px]" : "text-xs"} truncate font-semibold`} style={{ color: "var(--cf2-text-secondary)" }}>{lead.cadencia.definitionNome}</p><div className="mt-1 flex items-center gap-2"><div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--cf2-bg-surface-muted)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, lead.cadencia.totalSteps ? (lead.cadencia.stepIndex / lead.cadencia.totalSteps) * 100 : 0)}%`, background: "var(--cf2-accent-border)" }} /></div><span className="text-[10px] tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.cadencia.stepIndex}/{lead.cadencia.totalSteps}</span></div></div>;
}
function StatusBadge({ status }: { status: { label: string; color: string } }) { return <span className="inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: `${status.color}16`, color: status.color }}>{status.label}</span>; }
function MiniTag({ children }: { children: React.ReactNode }) { return <span className="max-w-[118px] truncate rounded-md px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{children}</span>; }
function LoadingState() { return <div className="space-y-2 p-4" aria-label="Carregando prospects">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }} />)}</div>; }
function relTime(iso: string): string { const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)); if (minutes < 1) return "agora"; if (minutes < 60) return `${minutes}min`; if (minutes < 1440) return `${Math.floor(minutes / 60)}h`; return `${Math.floor(minutes / 1440)}d`; }
function formatNextAction(lead: ProspeccaoLead): string { if (!lead.cadencia?.proximaAcaoEm) return "—"; return new Date(lead.cadencia.proximaAcaoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function BulkButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button onClick={onClick} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: active ? "var(--cf2-accent)" : "var(--cf2-bg-surface)", color: active ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>{label}<ChevronDown className="h-3 w-3" /></button>; }

function BulkActionPanel({ action, usuarios, listas, cadencias, labels, pending, onConfirm, onCancel }: { action: BulkActionKey; usuarios: { id: string; nome: string }[]; listas: Lista[]; cadencias: CadenciaDef[]; labels: LabelDef[]; pending: boolean; onConfirm: (payload?: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(""); const destructive = action === "pausar" || action === "arquivar";
  const options = action === "atribuir_responsavel" ? usuarios.map((item) => ({ value: item.id, label: item.nome })) : action === "adicionar_cadencia" ? cadencias.map((item) => ({ value: item.id, label: `${item.nome} (${item.totalSteps} toques)` })) : action === "trocar_lista" ? listas.map((item) => ({ value: item.id, label: item.nome })) : action === "adicionar_tag" ? labels.map((item) => ({ value: item.id, label: item.nome })) : [];
  return <div className="flex flex-col gap-2 border-b px-3.5 py-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--cf2-border-default)" }}>{destructive ? <p className="flex-1 text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{action === "pausar" ? "Pausar as cadências ativas dos prospects selecionados?" : "Desqualificar e retirar estes prospects da operação ativa?"}</p> : <select value={value} onChange={(event) => setValue(event.target.value)} className="h-9 min-w-[240px] rounded-lg border bg-transparent px-3 text-xs outline-none" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}><option value="">Selecione uma opção</option>{options.length === 0 && <option disabled>Nenhuma opção cadastrada</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}<button onClick={() => onConfirm(destructive ? undefined : value)} disabled={pending || (!destructive && !value)} className="h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{pending ? "Aplicando..." : "Confirmar"}</button><button onClick={onCancel} className="h-9 px-2 text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button></div>;
}
