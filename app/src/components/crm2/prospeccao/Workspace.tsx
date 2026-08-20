"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Search, ChevronDown, X, ExternalLink } from "lucide-react";
import { useOrgUsuarios, matchesResponsavel, type DateFilter, matchesDateFilter } from "@/components/crm/BoardFilters";
import { resolveProspeccaoStatus, PROSPECCAO_STATUS, BULK_ACTIONS, type ProspeccaoLead, type BulkActionKey } from "./shared";
import { ImportModal } from "./ImportModal";
import { ProspeccaoDrawer } from "./ProspeccaoDrawer";
import { NovoProspectModal } from "./NovoProspectModal";

/**
 * Prospecção (CRM2, reconstrução 17/08 a partir de spec+mockups do Kauã) —
 * workspace EXCLUSIVO de outbound, separado de Pré-vendas (regra explícita
 * do spec: "o trabalho de pré-venda outbound já aconteceu dentro de
 * Prospecção" — qualificar aqui cria a oportunidade DIRETO no Pipeline, sem
 * passar pelo board de Pré-vendas). Tabela em vez de Kanban (spec: "aqui
 * você vai operar volume"). Todo dado vem de `/api/prospeccao/board`
 * (leads.origem='outbound' reais da org, hoje 78) — nada fabricado; onde o
 * dado real ainda não existe (ex: nenhuma lista/cadência cadastrada ainda),
 * a célula mostra "—" em vez de inventar.
 */

interface Lista { id: string; nome: string; cor: string; count: number }
interface CadenciaDef { id: string; nome: string; totalSteps: number }
interface LabelDef { id: string; nome: string; cor: string }

interface BoardResponse {
  leads: ProspeccaoLead[];
  kpis: { ativos: number; emCadencia: number; contatados: number; responderam: number; qualificados: number; conversaoPct: number };
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

  const { data, isLoading } = useQuery({
    queryKey: ["prospeccao-board"],
    queryFn: async () => {
      const r = await fetch("/api/prospeccao/board");
      if (!r.ok) return { leads: [], kpis: { ativos: 0, emCadencia: 0, contatados: 0, responderam: 0, qualificados: 0, conversaoPct: 0 } } as BoardResponse;
      return (await r.json()) as BoardResponse;
    },
  });

  const { data: listas = [] } = useQuery<Lista[]>({
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

  const { data: labels = [] } = useQuery<LabelDef[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const r = await fetch("/api/labels");
      return r.ok ? r.json() : [];
    },
  });

  const allLeads = data?.leads || [];
  const kpis = data?.kpis || { ativos: 0, emCadencia: 0, contatados: 0, responderam: 0, qualificados: 0, conversaoPct: 0 };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLeads.filter((l) => {
      if (!matchesResponsavel(l.responsavelId, respFilter, currentUserId)) return false;
      if (listaFilter !== "todas" && l.listaId !== listaFilter) return false;
      if (cadenciaFilter === "ativas" && !(l.cadencia && ["active", "waiting"].includes(l.cadencia.status))) return false;
      if (cadenciaFilter === "sem" && l.cadencia) return false;
      if (!matchesDateFilter(l.createdAt || null, dateFilter)) return false;
      if (statusFilter !== "todos" && resolveProspeccaoStatus(l).key !== statusFilter) return false;
      if (!q) return true;
      return l.nome.toLowerCase().includes(q) || (l.empresa || "").toLowerCase().includes(q) || (l.cargo || "").toLowerCase().includes(q);
    });
  }, [allLeads, search, respFilter, listaFilter, cadenciaFilter, dateFilter, statusFilter, currentUserId]);

  const allSelectedOnPage = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggleAll = () => {
    if (allSelectedOnPage) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["prospeccao-board"] });

  // CTAs "+ Novo prospect"/"+ Importar prospects" moram no Topbar (fora
  // dessa árvore — page.tsx é Server Component, o Topbar recebe
  // `<ProspeccaoTopbarActions />` via prop `actions`). Ponte via
  // CustomEvent, mesmo padrão já usado pro command palette
  // ("open-command-palette") em outras telas do CRM2.
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
      if (action === "atribuir_responsavel") {
        await Promise.all(leadIds.map((id) => fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsavelId: payload || null }) })));
      } else if (action === "adicionar_cadencia") {
        await fetch("/api/prospeccao/cadencia/enroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds, cadenceDefinitionId: payload }) });
      } else if (action === "trocar_lista") {
        // Remove da lista anterior (quando conhecida) antes de adicionar na nova — "trocar", não só "adicionar".
        const porListaAntiga = new Map<string, string[]>();
        for (const l of allLeads) {
          if (selected.has(l.id) && l.listaId) {
            if (!porListaAntiga.has(l.listaId)) porListaAntiga.set(l.listaId, []);
            porListaAntiga.get(l.listaId)!.push(l.id);
          }
        }
        await Promise.all(
          Array.from(porListaAntiga.entries()).map(([listaId, ids]) =>
            fetch("/api/contatos-unified/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", listaId, leadIds: ids }) })
          )
        );
        await fetch("/api/contatos-unified/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", listaId: payload, leadIds }) });
      } else if (action === "adicionar_tag") {
        await Promise.all(leadIds.map((id) => fetch(`/api/leads/${id}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelId: payload }) })));
      } else if (action === "pausar") {
        await fetch("/api/prospeccao/cadencia/pausar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds }) });
      } else if (action === "arquivar") {
        // Reaproveita o mesmo bucket real de "Desqualificado" — não existe
        // ainda um estado "arquivado" distinto no domínio; registrado como
        // pendência em vez de inventar um status novo silenciosamente.
        await Promise.all(leadIds.map((id) => fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus: "disqualified" }) })));
      }
    },
    onSuccess: () => {
      invalidate();
      setSelected(new Set());
      setBulkMenu(null);
      toast.success("Ação aplicada.");
    },
    onError: () => toast.error("Não foi possível aplicar a ação."),
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo Operacional de Outbound — dark, mesmo padrão de chrome já usado no Kanban de Pré-vendas */}
      <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
        <div className="flex flex-col gap-1">
          <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Resumo Operacional de Outbound</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Acompanhamento em tempo real da volumetria, cadências e taxa de conversão final</p>
        </div>
        <div className="grid grid-cols-5 gap-4">
          <Kpi label="Prospects ativos" valor={kpis.ativos} sub="Na base de fluxo" />
          <Kpi label="Em cadência" valor={kpis.emCadencia} sub="Sendo acionados" />
          <Kpi label="Contatados" valor={kpis.contatados} sub="1º toque realizado" />
          <Kpi label="Responderam" valor={kpis.responderam} sub="Interação positiva" />
          <Kpi label="Conversão (SQL)" valor={`${kpis.conversaoPct}%`} sub={`${kpis.qualificados} oportunidade${kpis.qualificados === 1 ? "" : "s"} criada${kpis.qualificados === 1 ? "" : "s"}`} accent />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Período: {o.label}</option>)}
          </select>
          <select value={respFilter} onChange={(e) => setRespFilter(e.target.value)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todos">Responsável: Todos</option>
            {currentUserId && <option value="meu">Meus (eu)</option>}
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <select value={listaFilter} onChange={(e) => setListaFilter(e.target.value)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todas">Lista: Todas</option>
            {listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <select value={cadenciaFilter} onChange={(e) => setCadenciaFilter(e.target.value as typeof cadenciaFilter)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
            <option value="todas">Cadência: Todas</option>
            <option value="ativas">Cadência: Ativas</option>
            <option value="sem">Sem cadência</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Fluxo Operacional de Prospects</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar prospect, empresa, cargo..."
              className="w-56 sm:w-72 pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
            <option value="todos">Status: Todos</option>
            {PROSPECCAO_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <Link
            href="/prospeccao-legado"
            className="flex items-center gap-1 text-[12px] font-semibold shrink-0"
            style={{ color: "var(--cf2-text-tertiary)" }}
            title="Ferramenta de busca Apollo (ainda no tema legado — sem Figma aprovado pra migrar)"
          >
            Buscar no Apollo <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{selected.size} selecionado{selected.size > 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {BULK_ACTIONS.map((a) => (
              <BulkButton key={a.key} label={a.label} active={bulkMenu === a.key} onClick={() => setBulkMenu(bulkMenu === a.key ? null : a.key)} />
            ))}
            <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><X className="w-3.5 h-3.5" /></button>
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

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        {isLoading ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum prospect outbound encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" checked={allSelectedOnPage} onChange={toggleAll} />
                  </th>
                  {["Prospect", "Empresa", "Cargo", "Lista/Origem", "Responsável", "Cadência", "Etapa", "Última interação", "Próxima ação", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const status = resolveProspeccaoStatus(l);
                  const owner = l.responsavelId ? usuariosById.get(l.responsavelId) : undefined;
                  return (
                    <tr key={l.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }} onClick={() => setDrawerLeadId(l.id)}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} />
                      </td>
                      <td className="px-3 py-3 text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>{l.nome}{l.sobrenome ? ` ${l.sobrenome}` : ""}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{l.empresa || "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{l.cargo || "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{l.listaNome || l.origem || "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{owner?.nome || "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{l.cadencia?.definitionNome || "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{l.cadencia ? `${l.cadencia.stepIndex}/${l.cadencia.totalSteps}` : "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }} title="Baseado na última atualização real do registro">{l.updatedAt ? relTime(l.updatedAt) : "—"}</td>
                      <td className="px-3 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>{l.cadencia?.proximaAcaoEm ? new Date(l.cadencia.proximaAcaoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: `${status.color}18`, color: status.color }}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Mostrando {filtered.length} de {allLeads.length} prospects</p>

      <ProspeccaoDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} usuariosById={usuariosById} cadencias={cadencias} onChanged={invalidate} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} listas={listas} usuarios={usuarios} cadencias={cadencias} onImported={invalidate} />
      <NovoProspectModal open={novoOpen} onClose={() => setNovoOpen(false)} listas={listas} usuarios={usuarios} onCreated={invalidate} />
    </div>
  );
}

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function Kpi({ label, valor, sub, accent }: { label: string; valor: string | number; sub: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
      <p className="text-[26px] font-bold" style={{ color: accent ? "var(--cf2-accent-border)" : "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
      <p className="text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{sub}</p>
    </div>
  );
}

function BulkButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1" style={{ background: active ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: active ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>
      {label} <ChevronDown className="w-3 h-3" />
    </button>
  );
}

function BulkActionPanel({
  action, usuarios, listas, cadencias, labels, pending, onConfirm, onCancel,
}: {
  action: BulkActionKey;
  usuarios: { id: string; nome: string }[];
  listas: Lista[];
  cadencias: CadenciaDef[];
  labels: LabelDef[];
  pending: boolean;
  onConfirm: (payload?: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  if (action === "pausar" || action === "arquivar") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
          {action === "pausar" ? "Pausar a cadência ativa dos selecionados?" : "Arquivar os selecionados? (reaproveita o bucket de Desqualificado — pendência: estado próprio de arquivado ainda não existe no domínio)"}
        </p>
        <button onClick={() => onConfirm()} disabled={pending} className="px-3 py-1.5 rounded-lg text-[12px] font-bold shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Confirmar</button>
        <button onClick={onCancel} className="text-[12px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button>
      </div>
    );
  }

  const options =
    action === "atribuir_responsavel" ? usuarios.map((u) => ({ value: u.id, label: u.nome })) :
    action === "adicionar_cadencia" ? cadencias.map((c) => ({ value: c.id, label: `${c.nome} (${c.totalSteps} toques)` })) :
    action === "trocar_lista" ? listas.map((l) => ({ value: l.id, label: l.nome })) :
    action === "adicionar_tag" ? labels.map((l) => ({ value: l.id, label: l.nome })) : [];

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <select value={value} onChange={(e) => setValue(e.target.value)} className="px-3 py-1.5 rounded-lg text-[13px] outline-none flex-1 max-w-xs" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        <option value="">Selecione...</option>
        {options.length === 0 && <option value="" disabled>Nenhuma opção cadastrada ainda</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={() => value && onConfirm(value)} disabled={!value || pending} className="px-3 py-1.5 rounded-lg text-[12px] font-bold shrink-0 disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Aplicar</button>
      <button onClick={onCancel} className="text-[12px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button>
    </div>
  );
}
