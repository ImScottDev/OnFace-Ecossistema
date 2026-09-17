"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle, Building2, ChevronDown,
  ExternalLink, KanbanSquare, List, ListFilter,
  Search, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  matchesDateFilter, matchesResponsavel, type DateFilter, useOrgUsuarios,
} from "@/components/crm/BoardFilters";
import {
  BULK_ACTIONS, PROSPECCAO_STATUS, resolveProspeccaoStatus,
  type BulkActionKey, type ProspeccaoLead,
} from "./shared";
import { porRecenciaDesc } from "@/lib/crm/qualificacao-colunas";
import { ImportModal } from "./ImportModal";
import { NovoProspectModal } from "./NovoProspectModal";
import { ProspeccaoDrawer } from "./ProspeccaoDrawer";
import { OwnerPicker } from "./OwnerPicker";
import { corAvatarEmpresa, iniciaisEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { DarkFilterSelect, DarkItem } from "@/components/crm2/shared/DarkFilterSelect";
import { Cf2SelectBox } from "@/components/crm2/shared/SelectBox";
import {
  Cf2Select, Cf2SelectContent, Cf2SelectItem, Cf2SelectTrigger, Cf2SelectValue,
} from "@/components/crm2/ui/Select";
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

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "7days", label: "7 dias" },
  { value: "30days", label: "30 dias" },
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
  // Prospect arrastado pra coluna Qualificado: precisa escolher destino antes
  // de gravar (Pré-vendas vs criar oportunidade), então fica em espera aqui.
  const [qualificarProspectId, setQualificarProspectId] = useState<string | null>(null);
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
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [allLeads, cadenciaFilter, currentUserId, dateFilter, listaFilter, respFilter, search, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((lead) => selected.has(lead.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((lead) => lead.id)));
  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["prospeccao-board"] });

  // Atribuição individual de responsável direto na linha/card (25/08,
  // pedido do Kauã: "responsável em canto nenhum dá pra editar") — mesmo
  // endpoint já usado pela ação em massa "atribuir_responsavel", só que
  // pra 1 lead de cada vez, sem precisar selecionar.
  const assignOwner = useMutation({
    mutationFn: async ({ leadId, responsavelId }: { leadId: string; responsavelId: string | null }) => {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavelId }),
      });
      if (!response.ok) throw new Error("Não foi possível atribuir o responsável");
    },
    onSuccess: () => { invalidate(); toast.success("Responsável atualizado."); },
    onError: () => toast.error("Não foi possível atribuir o responsável"),
  });

  const moverEtapa = useMutation({
    mutationFn: async ({ leadId, sdrStatus }: { leadId: string; sdrStatus: string }) => {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdrStatus }),
      });
      if (!response.ok) throw new Error("Não foi possível mover o prospect");
    },
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível mover"),
  });

  /**
   * Qualificar prospect pelo board (01/09) — mesmas duas rotas do
   * `ProspeccaoDrawer`, sem duplicar regra: Pré-vendas grava
   * `sdr_status='qualified'`; oportunidade chama `converter-oportunidade`.
   */
  const qualificarProspect = useMutation({
    mutationFn: async ({ leadId, destino }: { leadId: string; destino: "pre_vendas" | "oportunidade" }) => {
      const url = destino === "pre_vendas" ? `/api/leads/${leadId}` : `/api/leads/${leadId}/converter-oportunidade`;
      const init: RequestInit = destino === "pre_vendas"
        ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus: "qualified" }) }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ semReuniao: true }) };
      const response = await fetch(url, init);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Não foi possível qualificar");
      }
      return destino;
    },
    onSuccess: (destino) => {
      toast.success(destino === "pre_vendas" ? "Enviado para Qualificado (SQL) em Pré-vendas." : "Oportunidade criada no Pipeline.");
      setQualificarProspectId(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível qualificar"),
  });

  /** Drop de card numa coluna do Kanban. */
  const handleDropProspect = (leadId: string, statusKey: string) => {
    const status = PROSPECCAO_STATUS.find((item) => item.key === statusKey);
    if (!status) return;
    if (statusKey === "qualificado") { setQualificarProspectId(leadId); return; }
    if (status.dropStatus == null) {
      toast.info("Em cadência não é etapa manual — use \"Adicionar à cadência\".");
      return;
    }
    moverEtapa.mutate({ leadId, sdrStatus: status.dropStatus });
  };

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
        await Promise.all(
          leadIds.map(async (id) =>
            ensureOk(
              await fetch(`/api/leads/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ responsavelId: payload || null }),
              })
            )
          )
        );
      } else if (action === "adicionar_cadencia") {
        await ensureOk(
          await fetch("/api/prospeccao/cadencia/enroll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadIds, cadenceDefinitionId: payload }),
          })
        );
      } else if (action === "trocar_lista") {
        const previousLists = new Map<string, string[]>();
        for (const lead of allLeads) {
          if (selected.has(lead.id) && lead.listaId) {
            previousLists.set(lead.listaId, [...(previousLists.get(lead.listaId) ?? []), lead.id]);
          }
        }
        await Promise.all(
          Array.from(previousLists.entries()).map(async ([listaId, ids]) =>
            ensureOk(
              await fetch("/api/contatos-unified/listas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "remove", listaId, leadIds: ids }),
              })
            )
          )
        );
        await ensureOk(
          await fetch("/api/contatos-unified/listas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add", listaId: payload, leadIds }),
          })
        );
      } else if (action === "adicionar_tag") {
        await Promise.all(
          leadIds.map(async (id) =>
            ensureOk(
              await fetch(`/api/leads/${id}/labels`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ labelId: payload }),
              })
            )
          )
        );
      } else if (action === "pausar") {
        await ensureOk(
          await fetch("/api/prospeccao/cadencia/pausar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadIds }),
          })
        );
      } else if (action === "arquivar") {
        await Promise.all(
          leadIds.map(async (id) =>
            ensureOk(
              await fetch(`/api/leads/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sdrStatus: "disqualified" }),
              })
            )
          )
        );
      }
    },
    onSuccess: () => {
      invalidate();
      setSelected(new Set());
      setBulkMenu(null);
      toast.success("Ação aplicada aos prospects selecionados.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível aplicar a ação"),
  });

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Dashboard REMOVIDO em 01/09 por decisão do Kauã. Tinha 5 cards de
          KPI + painel "Follow-ups em execução" + "Atenção agora". Motivo dele:
          Pré-vendas é o padrão do módulo e mostra SÓ o board (kanban ou
          tabela) com filtros — Prospecção mostrava um dashboard antes do
          board, então trocar de pipeline mudava a natureza da tela.
          O endpoint continua devolvendo `kpis` (contrato intacto, nada
          quebrado pra quem consome), mas a tela não lê mais. Análise de
          outbound é assunto de Insights, não do workspace operacional. */
      }
      {/* MESMO cabeçalho de filtros de Pré-vendas (01/09): busca escura +
          faixa rolável de DarkFilterSelect + alternador Kanban/Tabela.
          Antes era `Cf2Card` no tema CLARO com `Cf2Input`/`FilterSelect`, e
          por isso trocar de pipeline mudava cor, altura e fonte dos controles.
          `DarkFilterSelect` já era compartilhado entre Pré-vendas e Pipeline —
          Prospecção era a única fora do padrão. */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar prospect, empresa, cargo..."
              aria-label="Buscar prospects"
              className="w-56 sm:w-80 pl-8 pr-7 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto cf2-hide-scrollbar">
            <DarkFilterSelect value={listaFilter} onChange={setListaFilter} label="Lista" placeholder="Todas" aria-label="Todas">
              <DarkItem value="todas">Todas</DarkItem>
              {listas.map((lista) => <DarkItem key={lista.id} value={lista.id}>{lista.nome} ({lista.count})</DarkItem>)}
            </DarkFilterSelect>
            <DarkFilterSelect value={statusFilter} onChange={setStatusFilter} label="Status" placeholder="Todos" aria-label="Todos">
              <DarkItem value="todos">Todos</DarkItem>
              {PROSPECCAO_STATUS.map((status) => <DarkItem key={status.key} value={status.key}>{status.label}</DarkItem>)}
            </DarkFilterSelect>
            <DarkFilterSelect value={cadenciaFilter} onChange={(value) => setCadenciaFilter(value as typeof cadenciaFilter)} label="Follow-up" placeholder="Todos" aria-label="Todos">
              <DarkItem value="todas">Todos</DarkItem>
              <DarkItem value="ativas">Ativos</DarkItem>
              <DarkItem value="sem">Sem follow-up</DarkItem>
            </DarkFilterSelect>
            <DarkFilterSelect value={respFilter} onChange={setRespFilter} label="Responsável" placeholder="Todos" aria-label="Todos">
              <DarkItem value="todos">Todos</DarkItem>
              {currentUserId && <DarkItem value="meu">Meus prospects</DarkItem>}
              {usuarios.map((usuario) => <DarkItem key={usuario.id} value={usuario.id}>{usuario.nome}</DarkItem>)}
            </DarkFilterSelect>
            <DarkFilterSelect value={dateFilter} onChange={(value) => setDateFilter(value as DateFilter)} label="Período" placeholder="Todo o período" aria-label="Todo o período">
              {DATE_OPTIONS.map((option) => <DarkItem key={option.value} value={option.value}>{option.label}</DarkItem>)}
            </DarkFilterSelect>
          </div>

          <span className="shrink-0 text-[12px] tabular-nums" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{filtered.length} de {allLeads.length}</span>

          <Link href="/prospeccao/apollo" title="Buscar contatos no Apollo" className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            Apollo <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          {/* Alternador idêntico ao de Pré-vendas: dois ícones num trilho,
              sem rótulo de texto. */}
          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => setView("kanban")} title="Visualização em quadro" aria-label="Visualização em quadro" className="p-1.5 rounded-md" style={{ background: view === "kanban" ? "var(--cf2-chrome-surface-active)" : "transparent", color: view === "kanban" ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}>
              <KanbanSquare className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView("table")} title="Visualização em tabela" aria-label="Visualização em tabela" className="p-1.5 rounded-md" style={{ background: view === "table" ? "var(--cf2-chrome-surface-active)" : "transparent", color: view === "table" ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* `flex flex-col` + `min-h-0` (01/09): a faixa de ações em massa fica
          fixa e SÓ a área da view rola. No Kanban o scroll é por coluna; na
          tabela é esta caixa que rola — a página em si não estica mais. */}
      <div className="flex-1 min-h-0 flex flex-col">
        {selected.size > 0 && (
          <div className="flex flex-col gap-2 border-b px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: "var(--cf2-chrome-border-subtle)", background: "rgba(255,255,255,0.06)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>
              {selected.size} prospect{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {BULK_ACTIONS.map((action) => (
                <BulkButton key={action.key} label={action.label} active={bulkMenu === action.key} onClick={() => setBulkMenu(bulkMenu === action.key ? null : action.key)} />
              ))}
              <button onClick={() => setSelected(new Set())} aria-label="Limpar seleção" className="rounded-[var(--cf2-radius-sm)] p-2 transition-colors hover:bg-[var(--cf2-chrome-surface-active)]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {bulkMenu && (
          <BulkActionPanel
            action={bulkMenu}
            usuarios={usuarios}
            listas={listas}
            cadencias={cadencias}
            labels={labels}
            pending={bulk.isPending}
            onConfirm={(payload) => bulk.mutate({ action: bulkMenu, payload })}
            onCancel={() => setBulkMenu(null)}
          />
        )}

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <AlertTriangle className="h-5 w-5" style={{ color: "var(--cf2-danger-text)" }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>A operação outbound não carregou</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Verifique a API e tente novamente.</p>
            </div>
            <Cf2Button variant="secondary" size="sm" onClick={() => refetch()}>Tentar novamente</Cf2Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <ListFilter className="h-5 w-5" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
            <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>Nenhum prospect neste recorte</p>
            <p className="max-w-sm text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Ajuste os filtros ou importe uma lista para alimentar a operação outbound.</p>
          </div>
        ) : view === "table" ? (
          <div className="flex-1 min-h-0 overflow-auto">
          <ProspectsTable leads={filtered} selected={selected} allSelected={allSelected} usuariosById={usuariosById} usuarios={usuarios} onToggleAll={toggleAll} onToggle={toggleOne} onOpen={setDrawerLeadId} onAssignOwner={(leadId, responsavelId) => assignOwner.mutate({ leadId, responsavelId })} />
          </div>
        ) : (
          <ProspectsKanban leads={filtered} selected={selected} usuariosById={usuariosById} usuarios={usuarios} onToggle={toggleOne} onOpen={setDrawerLeadId} onAssignOwner={(leadId, responsavelId) => assignOwner.mutate({ leadId, responsavelId })} onDrop={handleDropProspect} />
        )}
      </div>

      {qualificarProspectId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setQualificarProspectId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--cf2-bg-surface)" }} onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)" }}>Qualificar prospect</p>
              <p className="text-[13px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Para onde ele vai agora?</p>
            </div>
            <button
              onClick={() => qualificarProspect.mutate({ leadId: qualificarProspectId, destino: "pre_vendas" })}
              disabled={qualificarProspect.isPending}
              className="text-left px-3.5 py-3 rounded-xl disabled:opacity-40"
              style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}
            >
              <span className="block text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Enviar para Pré-vendas</span>
              <span className="block text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Entra como Qualificado (SQL), sem criar oportunidade.</span>
            </button>
            <button
              onClick={() => qualificarProspect.mutate({ leadId: qualificarProspectId, destino: "oportunidade" })}
              disabled={qualificarProspect.isPending}
              className="text-left px-3.5 py-3 rounded-xl disabled:opacity-40"
              style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}
            >
              <span className="block text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Criar oportunidade</span>
              <span className="block text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Vai direto pro Pipeline, pulando Pré-vendas.</span>
            </button>
            <button onClick={() => setQualificarProspectId(null)} className="text-[13px] font-semibold self-end" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          </div>
        </div>
      )}

      <ProspeccaoDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} usuariosById={usuariosById} cadencias={cadencias} onChanged={invalidate} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} listas={listas} usuarios={usuarios} cadencias={cadencias} onImported={() => { invalidate(); qc.invalidateQueries({ queryKey: ["contato-listas"] }); }} />
      <NovoProspectModal open={novoOpen} onClose={() => setNovoOpen(false)} listas={listas} usuarios={usuarios} onCreated={() => { invalidate(); qc.invalidateQueries({ queryKey: ["contato-listas"] }); }} />
    </div>
  );
}

function Avatar({ seed, name, size = 22 }: { seed: string; name?: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42), background: corAvatarEmpresa(seed), color: TEXTO_SOBRE_AVATAR }}
    >
      {iniciaisEmpresa(name || "?")}
    </span>
  );
}

// Lista em linhas únicas agrupadas por status (padrão Linear/Circle — ver
// components/common/issues/issue-line.tsx e group-issues.tsx do projeto de
// referência: NUNCA uma tabela de 9 colunas, uma linha compacta de ~44px
// por prospect, agrupada sob o cabeçalho do próprio status).
function ProspectsTable({ leads, selected, allSelected, usuariosById, usuarios, onToggleAll, onToggle, onOpen, onAssignOwner }: {
  leads: ProspeccaoLead[]; selected: Set<string>; allSelected: boolean; usuariosById: Map<string, { nome: string }>;
  usuarios: { id: string; nome: string }[];
  onToggleAll: () => void; onToggle: (id: string) => void; onOpen: (id: string) => void; onAssignOwner: (leadId: string, userId: string | null) => void;
}) {
  const groups = PROSPECCAO_STATUS.map((status) => ({
    status,
    leads: leads.filter((lead) => resolveProspeccaoStatus(lead).key === status.key),
  })).filter((group) => group.leads.length > 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-6 h-9 shrink-0" style={{ borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}>
        <Cf2SelectBox checked={allSelected} onChange={onToggleAll} label="Selecionar todos os prospects visíveis" stopPropagation={false} />
        <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Selecionar todos</span>
      </div>
      {groups.map((group) => (
        <div key={group.status.key}>
          <div className="flex items-center gap-2 px-6 h-9" style={{ background: "rgba(255,255,255,0.06)" }}>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: group.status.color }} />
            <h3 className="text-[12px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{group.status.label}</h3>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{group.leads.length}</span>
          </div>
          {group.leads.map((lead) => (
            <ProspectRow
              key={lead.id}
              lead={lead}
              owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined}
              usuarios={usuarios}
              selected={selected.has(lead.id)}
              onToggle={() => onToggle(lead.id)}
              onOpen={() => onOpen(lead.id)}
              onAssignOwner={(userId) => onAssignOwner(lead.id, userId)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ProspectRow({ lead, owner, usuarios, selected, onToggle, onOpen, onAssignOwner }: {
  lead: ProspeccaoLead; owner?: { nome: string }; usuarios: { id: string; nome: string }[]; selected: boolean;
  onToggle: () => void; onOpen: () => void; onAssignOwner: (userId: string | null) => void;
}) {
  const fullName = `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}`;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}
      className="group flex w-full items-center gap-3 h-11 px-6 cursor-pointer outline-none hover:bg-[rgba(255,255,255,0.06)]"
      style={{ borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}
    >
      <Cf2SelectBox checked={selected} onChange={onToggle} label={`Selecionar ${lead.nome}`} />
      <Avatar seed={lead.id} name={fullName} size={22} />
      <div className="flex min-w-0 items-baseline gap-2 shrink-0 w-[190px]">
        <span className="truncate text-[13px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{fullName}</span>
      </div>
      <span className="hidden sm:block truncate text-[12px] w-[150px] shrink-0" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.empresa || lead.cargo || "—"}</span>
      <div className="min-w-0 flex-1 hidden md:block">
        <CadenceCell lead={lead} compact />
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {lead.listaNome && <span className="hidden lg:inline-block text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cf2-chrome-text-secondary)" }}>{lead.listaNome}</span>}
        <span className="hidden lg:inline-block text-[11px] tabular-nums w-10 text-right" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.updatedAt ? relTime(lead.updatedAt) : "—"}</span>
        <span className="hidden xl:inline-block text-[11px] tabular-nums w-[92px] text-right" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{formatNextAction(lead)}</span>
        <OwnerPicker ownerId={lead.responsavelId} ownerName={owner?.nome} usuarios={usuarios} onAssign={onAssignOwner} size={22} />
      </div>
    </div>
  );
}

/**
 * Kanban de prospects — reescrito em 01/09 pro MESMO padrão do board de
 * Pré-vendas (regra do Kauã: "pré-vendas é a nossa base"). Três diferenças
 * concretas em relação à versão anterior:
 *  1. coluna com `max-h-full` + área de cards `flex-1 overflow-y-auto min-h-0`
 *     → o scroll vertical é DENTRO da coluna, a página não estica;
 *  2. fundo/borda com os mesmos tokens de Pré-vendas (era `--cf2-chrome-bg`,
 *     que sumia contra o fundo da página);
 *  3. drag & drop real pra mover etapa, que simplesmente não existia aqui.
 */
function ProspectsKanban({ leads, selected, usuariosById, usuarios, onToggle, onOpen, onAssignOwner, onDrop }: {
  leads: ProspeccaoLead[]; selected: Set<string>; usuariosById: Map<string, { nome: string }>;
  usuarios: { id: string; nome: string }[];
  onToggle: (id: string) => void; onOpen: (id: string) => void; onAssignOwner: (leadId: string, userId: string | null) => void;
  onDrop: (leadId: string, statusKey: string) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="h-full flex gap-3 min-h-0 overflow-x-auto pb-1">
      {PROSPECCAO_STATUS.map((status) => {
        const columnLeads = leads
          .filter((lead) => resolveProspeccaoStatus(lead).key === status.key)
          .sort(porRecenciaDesc);
        const aceitaDrop = status.dropStatus !== null;
        const isDragOver = dragOver === status.key;
        return (
          <section
            key={status.key}
            className="w-[300px] shrink-0 rounded-2xl flex flex-col max-h-full"
            style={{
              background: isDragOver ? `${status.color}10` : "var(--cf2-chrome-bg-alt)",
              border: isDragOver ? `2px dashed ${status.color}` : "1px solid var(--cf2-chrome-border-subtle)",
            }}
            onDragOver={(e) => { if (aceitaDrop) e.preventDefault(); }}
            onDragEnter={(e) => { if (aceitaDrop) { e.preventDefault(); setDragOver(status.key); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const leadId = e.dataTransfer.getData("leadId");
              if (leadId) onDrop(leadId, status.key);
            }}
          >
            <div className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>{columnLeads.length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0">
              {columnLeads.map((lead) => (
                <ProspectCard
                  key={lead.id}
                  lead={lead}
                  selected={selected.has(lead.id)}
                  owner={lead.responsavelId ? usuariosById.get(lead.responsavelId)?.nome : undefined}
                  ownerId={lead.responsavelId}
                  usuarios={usuarios}
                  onToggle={() => onToggle(lead.id)}
                  onOpen={() => onOpen(lead.id)}
                  onAssignOwner={(userId) => onAssignOwner(lead.id, userId)}
                />
              ))}
              {columnLeads.length === 0 && (
                <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Vazio</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ProspectCard({ lead, owner, ownerId, usuarios, selected, onToggle, onOpen, onAssignOwner }: {
  lead: ProspeccaoLead; owner?: string; ownerId?: string | null; usuarios: { id: string; nome: string }[]; selected: boolean;
  onToggle: () => void; onOpen: () => void; onAssignOwner: (userId: string | null) => void;
}) {
  const fullName = `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}`;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }}
      // Arraste pra mover etapa (01/09) — mesmo contrato do card de
      // Pré-vendas: a coluna lê `leadId` do dataTransfer no onDrop.
      draggable
      onDragStart={(event) => event.dataTransfer.setData("leadId", lead.id)}
      className="flex flex-col gap-2 rounded-[var(--cf2-radius-md)] border p-2.5 cursor-pointer outline-none transition-colors hover:bg-[rgba(255,255,255,0.06)]"
      style={{ background: "var(--cf2-chrome-surface-active)", borderColor: selected ? "var(--cf2-accent-border)" : "var(--cf2-chrome-border-subtle)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar seed={lead.id} name={fullName} size={20} />
          <h4 className="truncate text-[13px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{fullName}</h4>
        </div>
        <Cf2SelectBox checked={selected} onChange={onToggle} label={`Selecionar ${lead.nome}`} />
      </div>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
        <Building2 className="h-3 w-3 shrink-0" />
        <span className="truncate">{lead.empresa || lead.cargo || "—"}</span>
      </div>
      {(lead.listaNome || lead.labels?.length) && (
        <div className="flex flex-wrap gap-1">
          {lead.listaNome && <MiniTag>{lead.listaNome}</MiniTag>}
          {lead.labels?.slice(0, 2).map((label) => <MiniTag key={label.id}>{label.nome}</MiniTag>)}
        </div>
      )}
      <CadenceCell lead={lead} compact />
      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
        <span>{lead.updatedAt ? relTime(lead.updatedAt) : "—"}</span>
        <OwnerPicker ownerId={ownerId} ownerName={owner} usuarios={usuarios} onAssign={onAssignOwner} size={18} />
      </div>
    </article>
  );
}

function CadenceCell({ lead, compact = false }: { lead: ProspeccaoLead; compact?: boolean }) {
  if (!lead.cadencia) return <span className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Sem follow-up</span>;
  return (
    <div className="min-w-[118px]">
      <p className={`${compact ? "text-[12px]" : "text-[13px]"} truncate font-semibold`} style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.cadencia.definitionNome}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, lead.cadencia.totalSteps ? (lead.cadencia.stepIndex / lead.cadencia.totalSteps) * 100 : 0)}%`, background: "var(--cf2-accent-border)" }} />
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead.cadencia.stepIndex}/{lead.cadencia.totalSteps}</span>
      </div>
    </div>
  );
}


function MiniTag({ children }: { children: React.ReactNode }) {
  return <span className="max-w-[118px] truncate rounded-[var(--cf2-radius-sm)] px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cf2-chrome-text-secondary)" }}>{children}</span>;
}

function LoadingState() {
  return (
    <div className="space-y-2 p-4" aria-label="Carregando prospects">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-[var(--cf2-radius-sm)]" style={{ background: "rgba(255,255,255,0.06)" }} />)}
    </div>
  );
}

function relTime(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function formatNextAction(lead: ProspeccaoLead): string {
  if (!lead.cadencia?.proximaAcaoEm) return "—";
  return new Date(lead.cadencia.proximaAcaoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function BulkButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Cf2Button variant={active ? "primary" : "secondary"} size="sm" onClick={onClick} className="gap-1">
      {label}<ChevronDown className="h-3 w-3" />
    </Cf2Button>
  );
}

function BulkActionPanel({ action, usuarios, listas, cadencias, labels, pending, onConfirm, onCancel }: {
  action: BulkActionKey; usuarios: { id: string; nome: string }[]; listas: Lista[]; cadencias: CadenciaDef[]; labels: LabelDef[];
  pending: boolean; onConfirm: (payload?: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const destructive = action === "pausar" || action === "arquivar";
  const options = action === "atribuir_responsavel"
    ? usuarios.map((item) => ({ value: item.id, label: item.nome }))
    : action === "adicionar_cadencia"
      ? cadencias.map((item) => ({ value: item.id, label: `${item.nome} (${item.totalSteps} toques)` }))
      : action === "trocar_lista"
        ? listas.map((item) => ({ value: item.id, label: item.nome }))
        : action === "adicionar_tag"
          ? labels.map((item) => ({ value: item.id, label: item.nome }))
          : [];

  return (
    <div className="flex flex-col gap-2 border-b px-3.5 py-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
      {destructive ? (
        <p className="flex-1 text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
          {action === "pausar" ? "Pausar as cadências ativas dos prospects selecionados?" : "Desqualificar e retirar estes prospects da operação ativa?"}
        </p>
      ) : (
        <Cf2Select value={value} onValueChange={setValue}>
          <Cf2SelectTrigger className="h-9 min-w-[240px]"><Cf2SelectValue placeholder="Selecione uma opção" aria-label="Selecione uma opção" /></Cf2SelectTrigger>
          <Cf2SelectContent>
            {options.length === 0 && <div className="px-2 py-1.5 text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma opção cadastrada</div>}
            {options.map((option) => <Cf2SelectItem key={option.value} value={option.value}>{option.label}</Cf2SelectItem>)}
          </Cf2SelectContent>
        </Cf2Select>
      )}
      <Cf2Button variant="primary" size="sm" onClick={() => onConfirm(destructive ? undefined : value)} disabled={pending || (!destructive && !value)}>
        {pending ? "Aplicando..." : "Confirmar"}
      </Cf2Button>
      <Cf2Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Cf2Button>
    </div>
  );
}
