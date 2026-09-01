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
import { OwnerPicker } from "./OwnerPicker";
import { corAvatarEmpresa, iniciaisEmpresa } from "@/components/crm2/shared/avatar";
import { Cf2Card } from "@/components/crm2/ui/Card";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input } from "@/components/crm2/ui/Input";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger } from "@/components/crm2/ui/Tabs";
import {
  Cf2Select, Cf2SelectContent, Cf2SelectItem, Cf2SelectTrigger, Cf2SelectValue,
} from "@/components/crm2/ui/Select";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";

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
    <div className="flex flex-col gap-5 pb-6">
      {/* Conteúdo de DASHBOARD (números, comparativo) usa o vocabulário do
          shadcndashboard — cards elevados com selo de ícone colorido —,
          não o vocabulário de LISTA do Circle (linhas achatadas). São
          referências diferentes pra tipos de conteúdo diferentes; ver
          decisão registrada no mapa mestre CRM2. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric icon={UsersRound} label="Prospects na máquina" value={kpis.ativos} detail={`${listas.length} lista${listas.length === 1 ? "" : "s"}`} />
        <Metric icon={Sparkles} label="Em follow-up" value={kpis.emCadencia} detail={`${kpis.aguardandoResposta} aguardando resposta`} />
        <Metric icon={MessageSquareReply} label="Responderam" value={kpis.responderam} detail="Precisam de decisão" tone="attention" />
        <Metric icon={CheckCircle2} label="Qualificados" value={kpis.qualificados} detail="Enviados para Pré-vendas" tone="success" />
        <Metric icon={ArrowUpRight} label="Conversão outbound" value={`${kpis.conversaoPct}%`} detail="Base → Pré-vendas" accent />
      </div>

      {/* Um único painel "Operação agora" em vez de 2 blocos desbalanceados
          lado a lado — evita o buraco de espaço em branco quando não há
          follow-up com dado (era o problema real do layout anterior). */}
      <div className="rounded-[var(--cf2-radius-lg)] border overflow-hidden" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}>
        <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
          <div className="p-4 lg:border-r" style={{ borderColor: "var(--cf2-border-default)" }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Follow-ups em execução</h2>
              <Link href="/automacoes/cadencias" className="flex items-center gap-1 text-[12px] font-medium shrink-0 transition-opacity hover:opacity-70" style={{ color: "var(--cf2-success-text)" }}>
                Gerenciar <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {data?.cadenciasPerformance?.length ? (
              <Cf2Table className="min-w-[560px]">
                <Cf2TableHeader>
                  <Cf2TableRow className="hover:bg-transparent">
                    <Cf2TableHead>Follow-up</Cf2TableHead>
                    <Cf2TableHead>Inscritos</Cf2TableHead>
                    <Cf2TableHead>Ativos</Cf2TableHead>
                    <Cf2TableHead>Respostas</Cf2TableHead>
                    <Cf2TableHead>Pré-vendas</Cf2TableHead>
                  </Cf2TableRow>
                </Cf2TableHeader>
                <Cf2TableBody>
                  {data.cadenciasPerformance.slice(0, 5).map((cadence) => (
                    <Cf2TableRow key={cadence.id} className="hover:bg-transparent">
                      <Cf2TableCell className="font-semibold">{cadence.nome}</Cf2TableCell>
                      <Cf2TableCell className="tabular-nums">{cadence.matriculados}</Cf2TableCell>
                      <Cf2TableCell className="tabular-nums">{cadence.ativos}</Cf2TableCell>
                      <Cf2TableCell className="tabular-nums">{cadence.responderam}</Cf2TableCell>
                      <Cf2TableCell className="font-semibold tabular-nums" style={{ color: "var(--cf2-success-text)" }}>{cadence.qualificados}</Cf2TableCell>
                    </Cf2TableRow>
                  ))}
                </Cf2TableBody>
              </Cf2Table>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-[var(--cf2-radius-md)] p-3" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <p className="text-[12.5px]" style={{ color: "var(--cf2-text-secondary)" }}>Nenhum follow-up com prospects inscritos ainda.</p>
                <Cf2Button size="sm" variant="secondary" asChild>
                  <Link href="/automacoes/cadencias">Criar follow-up</Link>
                </Cf2Button>
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col gap-1" style={{ background: "var(--cf2-bg-surface-subtle)" }}>
            <h2 className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--cf2-text-primary)" }}>Atenção agora</h2>
            <AlertChip value={kpis.semCadencia} label="prospects sem follow-up" onClick={() => setCadenciaFilter("sem")} />
            <AlertChip value={kpis.semContato} label="sem telefone e e-mail" />
            <AlertChip value={kpis.responderam} label="respostas aguardando decisão" onClick={() => setStatusFilter("respondeu")} />
            <AlertChip value={kpis.errosCadencia} label="follow-ups com falha" />
          </div>
        </div>
      </div>

      <Cf2Card padding="0px" className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b p-3.5" style={{ borderColor: "var(--cf2-border-default)" }}>
          <div className="relative w-full sm:max-w-[360px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none" style={{ color: "var(--cf2-text-tertiary)" }} />
            <Cf2Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pessoa, empresa, cargo ou contato"
              aria-label="Buscar prospects"
              className="h-9 pl-9"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
          {/* Filtros em faixa rolável — evita o wrap desalinhado de 5
              selects de largura variável (achado real 25/08, print do
              Kauã: o 5º item ("Todo o período") sobrava sozinho numa 2ª
              linha). Mesmo espírito do Circle: filtros não competem com o
              resto do header por espaço, ficam na própria faixa. */}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto cf2-hide-scrollbar">
            <FilterSelect value={listaFilter} onChange={setListaFilter} label="Lista" placeholder="Todas">
              <Cf2SelectItem value="todas">Todas</Cf2SelectItem>
              {listas.map((lista) => <Cf2SelectItem key={lista.id} value={lista.id}>{lista.nome} ({lista.count})</Cf2SelectItem>)}
            </FilterSelect>
            <FilterSelect value={statusFilter} onChange={setStatusFilter} label="Status" placeholder="Todos">
              <Cf2SelectItem value="todos">Todos</Cf2SelectItem>
              {PROSPECCAO_STATUS.map((status) => <Cf2SelectItem key={status.key} value={status.key}>{status.label}</Cf2SelectItem>)}
            </FilterSelect>
            <FilterSelect value={cadenciaFilter} onChange={(value) => setCadenciaFilter(value as typeof cadenciaFilter)} label="Follow-up" placeholder="Todos">
              <Cf2SelectItem value="todas">Todos</Cf2SelectItem>
              <Cf2SelectItem value="ativas">Ativos</Cf2SelectItem>
              <Cf2SelectItem value="sem">Sem follow-up</Cf2SelectItem>
            </FilterSelect>
            <FilterSelect value={respFilter} onChange={setRespFilter} label="Responsável" placeholder="Todos">
              <Cf2SelectItem value="todos">Todos</Cf2SelectItem>
              {currentUserId && <Cf2SelectItem value="meu">Meus prospects</Cf2SelectItem>}
              {usuarios.map((usuario) => <Cf2SelectItem key={usuario.id} value={usuario.id}>{usuario.nome}</Cf2SelectItem>)}
            </FilterSelect>
            <FilterSelect value={dateFilter} onChange={(value) => setDateFilter(value as DateFilter)} label="Período" placeholder="Todo o período">
              {DATE_OPTIONS.map((option) => <Cf2SelectItem key={option.value} value={option.value}>{option.label}</Cf2SelectItem>)}
            </FilterSelect>
          </div>

          <div className="flex items-center justify-between gap-2 xl:justify-end">
            <span className="text-[12px] tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{filtered.length} de {allLeads.length}</span>
            <Cf2Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
              <Cf2TabsList>
                <Cf2TabsTrigger value="table" className="gap-1.5"><List className="h-3.5 w-3.5" />Tabela</Cf2TabsTrigger>
                <Cf2TabsTrigger value="kanban" className="gap-1.5"><KanbanSquare className="h-3.5 w-3.5" />Kanban</Cf2TabsTrigger>
              </Cf2TabsList>
            </Cf2Tabs>
            <Link href="/prospeccao-legado" title="Busca Apollo disponível no módulo legado" className="flex h-9 items-center gap-1.5 rounded-[var(--cf2-radius-sm)] border px-3 text-[12px] font-semibold transition-colors hover:bg-[var(--cf2-bg-surface-muted)]" style={{ borderColor: "var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
              Apollo <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-col gap-2 border-b px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface-muted)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
              {selected.size} prospect{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {BULK_ACTIONS.map((action) => (
                <BulkButton key={action.key} label={action.label} active={bulkMenu === action.key} onClick={() => setBulkMenu(bulkMenu === action.key ? null : action.key)} />
              ))}
              <button onClick={() => setSelected(new Set())} aria-label="Limpar seleção" className="rounded-[var(--cf2-radius-sm)] p-2 transition-colors hover:bg-[var(--cf2-bg-surface)]" style={{ color: "var(--cf2-text-tertiary)" }}>
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
              <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>A operação outbound não carregou</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Verifique a API e tente novamente.</p>
            </div>
            <Cf2Button variant="secondary" size="sm" onClick={() => refetch()}>Tentar novamente</Cf2Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <ListFilter className="h-5 w-5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Nenhum prospect neste recorte</p>
            <p className="max-w-sm text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Ajuste os filtros ou importe uma lista para alimentar a operação outbound.</p>
          </div>
        ) : view === "table" ? (
          <ProspectsTable leads={filtered} selected={selected} allSelected={allSelected} usuariosById={usuariosById} usuarios={usuarios} onToggleAll={toggleAll} onToggle={toggleOne} onOpen={setDrawerLeadId} onAssignOwner={(leadId, responsavelId) => assignOwner.mutate({ leadId, responsavelId })} />
        ) : (
          <ProspectsKanban leads={filtered} selected={selected} usuariosById={usuariosById} usuarios={usuarios} onToggle={toggleOne} onOpen={setDrawerLeadId} onAssignOwner={(leadId, responsavelId) => assignOwner.mutate({ leadId, responsavelId })} />
        )}
      </Cf2Card>

      <ProspeccaoDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} usuariosById={usuariosById} cadencias={cadencias} onChanged={invalidate} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} listas={listas} usuarios={usuarios} cadencias={cadencias} onImported={() => { invalidate(); qc.invalidateQueries({ queryKey: ["contato-listas"] }); }} />
      <NovoProspectModal open={novoOpen} onClose={() => setNovoOpen(false)} listas={listas} usuarios={usuarios} onCreated={() => { invalidate(); qc.invalidateQueries({ queryKey: ["contato-listas"] }); }} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, accent, tone }: {
  icon: typeof UsersRound; label: string; value: string | number; detail: string; accent?: boolean; tone?: "attention" | "success";
}) {
  const tint = accent ? "var(--cf2-success-text)" : tone === "attention" ? "var(--cf2-warning-text)" : tone === "success" ? "var(--cf2-success-text)" : "var(--cf2-accent-border)";
  return (
    <div
      className="flex min-h-[108px] flex-col justify-between gap-3 rounded-[var(--cf2-radius-lg)] border p-4"
      style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface)", boxShadow: "var(--cf2-shadow-card-sm)" }}
    >
      <div className="flex items-center justify-center rounded-full size-8" style={{ background: `color-mix(in srgb, ${tint} 15%, transparent)` }}>
        <Icon className="h-4 w-4" style={{ color: tint }} />
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{value}</p>
        <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--cf2-text-secondary)" }}>{label}</p>
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{detail}</p>
      </div>
    </div>
  );
}

// Chip com barra de acento à esquerda (não linha de texto plana) — dá peso
// visual a item acionável de dashboard, na mesma lógica dos cards de KPI
// acima (ícone/cor com significado), em vez de uma lista neutra de números.
function AlertChip({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
  const active = value > 0;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[var(--cf2-radius-sm)] px-2 py-2 text-left transition-colors"
      style={{
        background: active ? "color-mix(in srgb, var(--cf2-warning-text) 8%, transparent)" : "transparent",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: active ? "var(--cf2-warning-text)" : "var(--cf2-border-default)" }} />
      <span className="text-[15px] font-semibold tabular-nums shrink-0" style={{ color: active ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)" }}>{value}</span>
      <span className="flex-1 text-[12.5px]" style={{ color: "var(--cf2-text-secondary)" }}>{label}</span>
      {onClick && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}
    </Comp>
  );
}

// Rótulo dentro do próprio trigger ("Lista: Todas" em vez de só "Todas")
// — sem isso, 3 selects mostrando "Todos" ao mesmo tempo ficam ambíguos
// (achado real 25/08, print do Kauã).
function FilterSelect({ value, onChange, label, placeholder, children }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string; children: React.ReactNode;
}) {
  return (
    <Cf2Select value={value} onValueChange={onChange}>
      <Cf2SelectTrigger aria-label={label} className="h-9 shrink-0 w-auto max-w-none">
        <span style={{ color: "var(--cf2-text-tertiary)" }}>{label}:</span>
        <Cf2SelectValue placeholder={placeholder} />
      </Cf2SelectTrigger>
      <Cf2SelectContent>{children}</Cf2SelectContent>
    </Cf2Select>
  );
}

function Avatar({ seed, name, size = 22 }: { seed: string; name?: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: corAvatarEmpresa(seed), color: "var(--cf2-text-on-accent)" }}
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
      <div className="flex items-center gap-3 px-6 h-9 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        <input aria-label="Selecionar todos os prospects visíveis" type="checkbox" checked={allSelected} onChange={onToggleAll} />
        <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>Selecionar todos</span>
      </div>
      {groups.map((group) => (
        <div key={group.status.key}>
          <div className="flex items-center gap-2 px-6 h-9" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: group.status.color }} />
            <h3 className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{group.status.label}</h3>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{group.leads.length}</span>
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
      className="group flex w-full items-center gap-3 h-11 px-6 cursor-pointer outline-none hover:bg-[var(--cf2-bg-surface-muted)]"
      style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
    >
      <input
        aria-label={`Selecionar ${lead.nome}`}
        type="checkbox"
        checked={selected}
        onClick={(event) => event.stopPropagation()}
        onChange={onToggle}
        className="shrink-0"
      />
      <Avatar seed={lead.id} name={fullName} size={22} />
      <div className="flex min-w-0 items-baseline gap-2 shrink-0 w-[190px]">
        <span className="truncate text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{fullName}</span>
      </div>
      <span className="hidden sm:block truncate text-[12px] w-[150px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.empresa || lead.cargo || "—"}</span>
      <div className="min-w-0 flex-1 hidden md:block">
        <CadenceCell lead={lead} compact />
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {lead.listaNome && <span className="hidden lg:inline-block text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{lead.listaNome}</span>}
        <span className="hidden lg:inline-block text-[11px] tabular-nums w-10 text-right" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.updatedAt ? relTime(lead.updatedAt) : "—"}</span>
        <span className="hidden xl:inline-block text-[11px] tabular-nums w-[92px] text-right" style={{ color: "var(--cf2-text-tertiary)" }}>{formatNextAction(lead)}</span>
        <OwnerPicker ownerId={lead.responsavelId} ownerName={owner?.nome} usuarios={usuarios} onAssign={onAssignOwner} size={22} />
      </div>
    </div>
  );
}

function ProspectsKanban({ leads, selected, usuariosById, usuarios, onToggle, onOpen, onAssignOwner }: {
  leads: ProspeccaoLead[]; selected: Set<string>; usuariosById: Map<string, { nome: string }>;
  usuarios: { id: string; nome: string }[];
  onToggle: (id: string) => void; onOpen: (id: string) => void; onAssignOwner: (leadId: string, userId: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto p-3.5">
      <div className="flex min-w-max gap-3">
        {PROSPECCAO_STATUS.map((status) => {
          const columnLeads = leads.filter((lead) => resolveProspeccaoStatus(lead).key === status.key);
          return (
            <section key={status.key} className="flex w-[272px] flex-col rounded-[var(--cf2-radius-lg)] border" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-canvas)" }}>
              <header className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: "var(--cf2-border-default)" }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
                  <h3 className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{status.label}</h3>
                </div>
                <span className="rounded-[var(--cf2-radius-sm)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>{columnLeads.length}</span>
              </header>
              <div className="flex min-h-[176px] flex-col gap-2 p-2">
                {columnLeads.length === 0 && (
                  <p className="px-2 py-5 text-center text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum prospect</p>
                )}
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
              </div>
            </section>
          );
        })}
      </div>
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
      className="flex flex-col gap-2 rounded-[var(--cf2-radius-md)] border p-2.5 cursor-pointer outline-none transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
      style={{ background: "var(--cf2-bg-surface)", borderColor: selected ? "var(--cf2-accent-border)" : "var(--cf2-border-default)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar seed={lead.id} name={fullName} size={20} />
          <h4 className="truncate text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{fullName}</h4>
        </div>
        <input aria-label={`Selecionar ${lead.nome}`} type="checkbox" checked={selected} onClick={(event) => event.stopPropagation()} onChange={onToggle} className="shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
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
      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        <span>{lead.updatedAt ? relTime(lead.updatedAt) : "—"}</span>
        <OwnerPicker ownerId={ownerId} ownerName={owner} usuarios={usuarios} onAssign={onAssignOwner} size={18} />
      </div>
    </article>
  );
}

function CadenceCell({ lead, compact = false }: { lead: ProspeccaoLead; compact?: boolean }) {
  if (!lead.cadencia) return <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem follow-up</span>;
  return (
    <div className="min-w-[118px]">
      <p className={`${compact ? "text-[12px]" : "text-[13px]"} truncate font-semibold`} style={{ color: "var(--cf2-text-secondary)" }}>{lead.cadencia.definitionNome}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, lead.cadencia.totalSteps ? (lead.cadencia.stepIndex / lead.cadencia.totalSteps) * 100 : 0)}%`, background: "var(--cf2-accent-border)" }} />
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{lead.cadencia.stepIndex}/{lead.cadencia.totalSteps}</span>
      </div>
    </div>
  );
}


function MiniTag({ children }: { children: React.ReactNode }) {
  return <span className="max-w-[118px] truncate rounded-[var(--cf2-radius-sm)] px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{children}</span>;
}

function LoadingState() {
  return (
    <div className="space-y-2 p-4" aria-label="Carregando prospects">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-[var(--cf2-radius-sm)]" style={{ background: "var(--cf2-bg-surface-muted)" }} />)}
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
    <div className="flex flex-col gap-2 border-b px-3.5 py-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--cf2-border-default)" }}>
      {destructive ? (
        <p className="flex-1 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
          {action === "pausar" ? "Pausar as cadências ativas dos prospects selecionados?" : "Desqualificar e retirar estes prospects da operação ativa?"}
        </p>
      ) : (
        <Cf2Select value={value} onValueChange={setValue}>
          <Cf2SelectTrigger className="h-9 min-w-[240px]"><Cf2SelectValue placeholder="Selecione uma opção" /></Cf2SelectTrigger>
          <Cf2SelectContent>
            {options.length === 0 && <div className="px-2 py-1.5 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma opção cadastrada</div>}
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
