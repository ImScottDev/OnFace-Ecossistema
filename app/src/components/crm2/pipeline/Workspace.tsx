"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X, Clock, FileText, FileWarning, CreditCard, Link2, Beaker, Download } from "lucide-react";
import { useOrgUsuarios, matchesResponsavel } from "@/components/crm/BoardFilters";
import {
  PIPELINE_OPEN_COLS, PERDIDO_KEYS, FAMILY_LABEL, FAMILY_COLOR,
  negocioValor, tempoNaEtapa, diasSemAvanco, motivoPerdaLabel, resolvePropostaDisplay,
  type NegocioBoard, type PipelineCol,
} from "./shared";
import { Cf2NegocioDrawer } from "./NegocioDrawer";
import { NovaOportunidadeModal } from "./NovaOportunidadeModal";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Chrome escuro (App Shell, ver globals.css) não tem variante própria de
// success/warning legível em fundo escuro — --cf2-success-text/--cf2-warning-text
// são tons pensados pra fundo claro. Mesmo ajuste já usado em
// qualificacao/Workspace.tsx (Pré-vendas) pra manter os dois tabuleiros
// escuros com a mesma paleta semântica de verdade.
const SUCCESS_DARK = "#4ade80";
const WARNING_DARK = "#fbbf24";

/**
 * Board de Pipeline (CRM2, spec+mockups do Kauã 17/08, reskin escuro 24/08
 * "mesma pegada do Pré-vendas") — Kanban de OPORTUNIDADES (não leads), 4
 * colunas abertas fixas + filtros reais (cards de KPI removidos 24/08,
 * pedido do Kauã: "pode sair" — informação redundante com o board). Clique
 * no card abre drawer lateral primeiro (mesmo padrão de Pré-vendas/
 * Prospecção) — "Abrir oportunidade completa" navega pra `/negocios/:id`.
 * Ganho/Perdido são estados finais acessíveis por bucket clicável no
 * rodapé, não colunas do board principal.
 */
export function Cf2PipelineWorkspace() {
  const qc = useQueryClient();
  const { usuarios, currentUserId } = useOrgUsuarios();
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState("todos");
  const [familiaFilter, setFamiliaFilter] = useState("todas");
  const [origemFilter, setOrigemFilter] = useState("todas");
  const [periodoFilter, setPeriodoFilter] = useState<"mes" | "tudo">("mes");
  const [statusFilter, setStatusFilter] = useState<"abertas" | "todas">("abertas");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Ganho/Perdido eram botões que abriam um modal por cima do Kanban — agora
  // são colunas colapsáveis NA MESMA linha das 4 abertas (24/08, mesma
  // referência visual do Kauã pra Pré-vendas: "pegar Pré-vendas como
  // referência e adaptar em Pipeline"). Só visualização, não são drop
  // target (Ganho/Perdido nascem de ações reais — aceite de proposta,
  // marcar perdido com motivo — nunca de um drag cru).
  const [expandedBucket, setExpandedBucket] = useState<"ganho" | "perdido" | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-crm2-board"],
    queryFn: async () => {
      const r = await fetch("/api/pipeline-crm2/board");
      if (!r.ok) return { negocios: [] as NegocioBoard[] };
      return (await r.json()) as { negocios: NegocioBoard[] };
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, status, motivoPerda }: { id: string; status: string; motivoPerda?: string }) => {
      const r = await fetch(`/api/negocios/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(motivoPerda ? { status, motivoPerda } : { status }) });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || "falha ao mover"); }
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline-crm2-board"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const abrir = () => setNovaOpen(true);
    window.addEventListener("pipeline-nova-oportunidade", abrir);
    return () => window.removeEventListener("pipeline-nova-oportunidade", abrir);
  }, []);

  const allNegocios = data?.negocios || [];
  const origensReais = useMemo(() => Array.from(new Set(allNegocios.map((n) => n.leadOrigem).filter(Boolean))) as string[], [allNegocios]);
  const inicioMes = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }, []);

  // Filtros comuns (responsável/família/origem/período/busca) — NÃO exclui
  // ganho/perdido/ativo aqui: os buckets de Ganho/Perdido (24/08, colunas
  // sempre visíveis na mesma linha do board) precisam desses negócios pra
  // aparecer independente do toggle "Status" — achado real do Kauã ("cadê
  // os ganhos e perdidos??" com o filtro padrão "Abertas" selecionado, que
  // antes apagava os dois buckets sem nenhum aviso). `statusFilter` só
  // decide se as 4 colunas abertas somem os negócios "ativo" (pós-venda) da
  // busca por texto — nunca os buckets fixos.
  const passaFiltrosComuns = (n: NegocioBoard) => {
    if (!matchesResponsavel(n.responsavelId, respFilter, currentUserId)) return false;
    if (familiaFilter !== "todas" && (n.serviceFamily || "UNKNOWN") !== familiaFilter) return false;
    if (origemFilter !== "todas" && n.leadOrigem !== origemFilter) return false;
    if (periodoFilter === "mes" && new Date(n.createdAt) < inicioMes) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (n.titulo || "").toLowerCase().includes(q) || (n.leadNome || "").toLowerCase().includes(q) || (n.empresaNome || "").toLowerCase().includes(q);
  };

  const filtered = allNegocios.filter((n) => {
    if (!passaFiltrosComuns(n)) return false;
    if (statusFilter === "abertas" && n.status === "ativo") return false;
    return true;
  });

  const negociosDaColuna = (col: PipelineCol) =>
    filtered.filter((n) => col.keys.includes(n.status)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Ganho/Perdido/ativo vêm de `allNegocios` + filtros comuns, nunca de
  // `filtered` — são buckets sempre visíveis, independentes do toggle
  // "Status: Abertas/Todas" (que só afeta as 4 colunas abertas).
  const ganhoNegocios = allNegocios.filter((n) => n.status === "ganho" && passaFiltrosComuns(n));
  const perdidoNegocios = allNegocios.filter((n) => PERDIDO_KEYS.includes(n.status) && passaFiltrosComuns(n));

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar oportunidade, empresa..."
            className="w-56 sm:w-72 pl-8 pr-7 py-1.5 rounded-lg text-[12px] outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-chrome-text-secondary)" }}><X className="w-3 h-3" /></button>}
        </div>
        <Select value={respFilter} onChange={setRespFilter}>
          <option value="todos">Responsável: Todos</option>
          {currentUserId && <option value="meu">Meus (eu)</option>}
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </Select>
        <Select value={familiaFilter} onChange={setFamiliaFilter}>
          <option value="todas">Família: Todas</option>
          {Object.entries(FAMILY_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <Select value={origemFilter} onChange={setOrigemFilter}>
          <option value="todas">Origem: Todas</option>
          {origensReais.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
        <Select value={periodoFilter} onChange={(v) => setPeriodoFilter(v as "mes" | "tudo")}>
          <option value="mes">Período: Este mês</option>
          <option value="tudo">Período: Todo o período</option>
        </Select>
        <Select value={statusFilter} onChange={(v) => setStatusFilter(v as "abertas" | "todas")}>
          <option value="abertas">Status: Abertas</option>
          <option value="todas">Status: Todas</option>
        </Select>
        <button
          onClick={() => setShowExport(true)}
          title="Exportar oportunidades: escolher responsável e etapas"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}
        >
          <Download className="w-3.5 h-3.5" /> Exportar
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Carregando...</p>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-1">
            {PIPELINE_OPEN_COLS.map((col) => {
              const negociosCol = negociosDaColuna(col);
              const totalCol = negociosCol.reduce((s, n) => s + negocioValor(n), 0);
              const isDragOver = dragOverCol === col.key;
              return (
                <div
                  key={col.key}
                  className="w-[300px] shrink-0 rounded-2xl flex flex-col"
                  style={{ background: isDragOver ? `color-mix(in srgb, ${col.color} 10%, transparent)` : "var(--cf2-chrome-bg-alt)", border: isDragOver ? `2px dashed ${col.color}` : "1px solid var(--cf2-chrome-border-subtle)" }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                  onDrop={(e) => { e.preventDefault(); setDragOverCol(null); const id = e.dataTransfer.getData("negocioId"); if (id) moveStage.mutate({ id, status: col.dropTarget }); }}
                >
                  <div className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: col.color }}>{col.label} ({negociosCol.length})</span>
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(totalCol)}</span>
                  </div>
                  <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
                    {negociosCol.map((n) => (
                      <NegocioCard key={n.id} n={n} onOpen={() => setDrawerNegocioId(n.id)} onDragStart={(e) => e.dataTransfer.setData("negocioId", n.id)} />
                    ))}
                    {negociosCol.length === 0 && <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>vazio</div>}
                  </div>
                </div>
              );
            })}

            {/* Ganho/Perdido — colunas colapsáveis na MESMA linha (24/08,
                referência visual de Pré-vendas), não mais botão+modal por
                cima. Não são drop target: nascem de ação real (aceite de
                proposta, marcar perdido com motivo), nunca de drag cru. */}
            <BucketColumn label="Ganho" color={SUCCESS_DARK} negocios={ganhoNegocios} expanded={expandedBucket === "ganho"} onToggle={() => setExpandedBucket((b) => (b === "ganho" ? null : "ganho"))} onOpen={setDrawerNegocioId} />
            <BucketColumn label="Perdido" color="#f87171" negocios={perdidoNegocios} expanded={expandedBucket === "perdido"} onToggle={() => setExpandedBucket((b) => (b === "perdido" ? null : "perdido"))} onOpen={setDrawerNegocioId} showMotivo />
          </div>
        </div>
      )}

      {showExport && (
        <ExportNegociosModal
          negocios={allNegocios}
          usuarios={usuarios}
          onClose={() => setShowExport(false)}
          onExport={(lista) => { gerarCsvNegocios(lista); setShowExport(false); }}
        />
      )}

      <Cf2NegocioDrawer negocioId={drawerNegocioId} open={!!drawerNegocioId} onClose={() => setDrawerNegocioId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["pipeline-crm2-board"] })} />
      <NovaOportunidadeModal open={novaOpen} onClose={() => setNovaOpen(false)} usuarios={usuarios} onCreated={() => qc.invalidateQueries({ queryKey: ["pipeline-crm2-board"] })} />
    </div>
  );
}

function telefoneDiscador(tel?: string | null): string {
  let d = (tel || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}

function gerarCsvNegocios(lista: NegocioBoard[]) {
  if (lista.length === 0) { toast.error("Nenhuma oportunidade na seleção"); return; }
  const cols: { h: string; get: (n: NegocioBoard) => string }[] = [
    { h: "Telefone", get: (n) => telefoneDiscador(n.leadTelefone) },
    { h: "Nome", get: (n) => [n.leadNome, n.leadSobrenome].filter(Boolean).join(" ") },
    { h: "E-mail", get: (n) => n.leadEmail || "" },
    { h: "Empresa", get: (n) => n.empresaNome || "" },
  ];
  const comTelefone = lista.filter((n) => telefoneDiscador(n.leadTelefone).length >= 10);
  if (comTelefone.length === 0) { toast.error("Nenhuma oportunidade da seleção tem telefone válido"); return; }
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const linhas = [cols.map((c) => c.h).join(","), ...comTelefone.map((n) => cols.map((c) => esc(c.get(n))).join(","))];
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `discador-pipeline-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  const puladas = lista.length - comTelefone.length;
  toast.success(`${comTelefone.length} oportunidades exportadas${puladas > 0 ? ` (${puladas} sem telefone, ignoradas)` : ""}`);
}

// Todas as colunas reais do board (4 abertas + Ganho/Perdido) — mesmo
// princípio do export de Pré-vendas: `match` replica exatamente o filtro
// que a coluna correspondente usa, nenhuma regra nova.
const EXPORT_COLUNAS: { key: string; label: string; color: string; match: (n: NegocioBoard) => boolean }[] = [
  ...PIPELINE_OPEN_COLS.map((col) => ({ key: col.key, label: col.label, color: col.color, match: (n: NegocioBoard) => col.keys.includes(n.status) })),
  { key: "ganho", label: "Ganho", color: SUCCESS_DARK, match: (n: NegocioBoard) => n.status === "ganho" },
  { key: "perdido", label: "Perdido", color: "#f87171", match: (n: NegocioBoard) => PERDIDO_KEYS.includes(n.status) },
];

function ExportNegociosModal({ negocios, usuarios, onClose, onExport }: { negocios: NegocioBoard[]; usuarios: { id: string; nome: string }[]; onClose: () => void; onExport: (lista: NegocioBoard[]) => void }) {
  const [resp, setResp] = useState("todos");
  const [stages, setStages] = useState<Set<string>>(new Set(EXPORT_COLUNAS.map((e) => e.key)));

  const toggle = (k: string) => setStages((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const todasMarcadas = stages.size === EXPORT_COLUNAS.length;
  const selecionados = negocios.filter((n) => {
    if (resp !== "todos" && n.responsavelId !== resp) return false;
    return EXPORT_COLUNAS.some((c) => stages.has(c.key) && c.match(n));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)" }} onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-[15px] mb-1" style={{ color: "var(--cf2-chrome-text-primary)" }}>Exportar oportunidades</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Escolha o responsável e as etapas que quer puxar.</p>

        <label className="block text-[12px] mb-1" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Responsável</label>
        <select value={resp} onChange={(e) => setResp(e.target.value)} className="w-full rounded-lg px-3 py-2 text-[13px] mb-4 outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>
          <option value="todos">Todos</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>

        <div className="flex items-center justify-between mb-1">
          <label className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Etapas</label>
          <button type="button" onClick={() => setStages(todasMarcadas ? new Set() : new Set(EXPORT_COLUNAS.map((e) => e.key)))} className="text-[11px] font-semibold" style={{ color: SUCCESS_DARK }}>
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
          <span className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{selecionados.length} oportunidades na seleção</span>
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

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
      {children}
    </select>
  );
}

/** Coluna colapsável pra Ganho/Perdido — mesma anatomia das colunas
 * auxiliares do Kanban de Pré-vendas (barra estreita recolhida, clique
 * expande e mostra os cards de verdade, reaproveitando `NegocioCard`). */
function BucketColumn({ label, color, negocios, expanded, onToggle, onOpen, showMotivo = false }: {
  label: string; color: string; negocios: NegocioBoard[]; expanded: boolean; onToggle: () => void; onOpen: (id: string) => void; showMotivo?: boolean;
}) {
  const total = negocios.reduce((s, n) => s + negocioValor(n), 0);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={`${label} — ${negocios.length} negócio${negocios.length === 1 ? "" : "s"} (${brl(total)})`}
        className="w-12 shrink-0 rounded-2xl flex flex-col items-center gap-2 pt-3 pb-3"
        style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)" }}
      >
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color, background: `color-mix(in srgb, ${color} 18%, transparent)` }}>{negocios.length}</span>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{label}</span>
      </button>
    );
  }

  return (
    <div className="w-[300px] shrink-0 rounded-2xl flex flex-col" style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
      <button type="button" onClick={onToggle} className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{label} ({negocios.length})</span>
        </div>
        <span className="text-[12px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(total)}</span>
      </button>
      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
        {negocios.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>vazio</div>
        ) : negocios.map((n) => (
          <div key={n.id}>
            <NegocioCard n={n} onOpen={() => onOpen(n.id)} onDragStart={() => {}} />
            {showMotivo && (
              <p className="text-[11px] mt-1 px-1 truncate" style={{ color: "#f87171" }}>{motivoPerdaLabel(n)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NegocioCard({ n, onOpen, onDragStart }: { n: NegocioBoard; onOpen: () => void; onDragStart: (e: React.DragEvent) => void }) {
  const nomeLead = [n.leadNome, n.leadSobrenome].filter(Boolean).join(" ");
  const isTrial = n.status === "trial";
  const isNoShow = n.status === "no_show";
  const dias = diasSemAvanco(n.updatedAt);
  const semAvancoRelevante = dias >= 7;
  const propostaDisplay = n.proposta ? resolvePropostaDisplay(n.proposta) : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-all duration-200"
      style={{ background: "var(--cf2-chrome-surface-active)", border: "1px solid var(--cf2-chrome-border-subtle)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
    >
      <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-chrome-text-primary)" }}>{n.empresaNome || nomeLead || n.titulo}</p>
      {(n.empresaNome || nomeLead) && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{nomeLead}{n.serviceFamily ? ` · ${FAMILY_LABEL[n.serviceFamily] || n.serviceFamily}` : ""}</p>}

      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {/* Cores por SEMÂNTICA, não por badge (24/08, achado do Kauã: "cores
            aleatório") — sempre os mesmos 4 significados do resto do CRM2:
            sucesso/info (accent), atenção (warning), problema (danger),
            neutro. Nenhum hex solto novo, só as variantes dark-safe já
            estabelecidas em Pré-vendas. */}
        {isTrial && <Badge icon={Beaker} label="Trial ativo" color="var(--cf2-accent-border)" />}
        {isNoShow && <Badge label="No-show" color={WARNING_DARK} />}
        {propostaDisplay && <Badge icon={FileText} label={`Proposta #${n.proposta!.numero} · ${propostaDisplay.label}`} color={propostaDisplay.tom === "danger" ? "#f87171" : propostaDisplay.tom === "success" ? SUCCESS_DARK : propostaDisplay.tom === "warning" ? WARNING_DARK : "var(--cf2-chrome-text-secondary)"} />}
        {n.contratoPendente && <Badge icon={FileWarning} label="Contrato pendente" color={WARNING_DARK} />}
        {n.pagamentoPendente && <Badge icon={CreditCard} label="Pagamento pendente" color={WARNING_DARK} />}
        {semAvancoRelevante && <Badge icon={Clock} label={`${dias} dias sem avanço`} color="#f87171" />}
        {n.oportunidadesRelacionadas > 0 && <Badge icon={Link2} label={`+${n.oportunidadesRelacionadas} oportunidade${n.oportunidadesRelacionadas > 1 ? "s" : ""}`} color="var(--cf2-chrome-text-secondary)" />}
      </div>

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-[12px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(negocioValor(n))}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {n.responsavelNome && <span className="text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{n.responsavelNome.split(" ")[0]}</span>}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>{tempoNaEtapa(n.updatedAt)}</span>
        </div>
      </div>
      {n.proximaAcao && (
        <p className="text-[11px] mt-1.5 truncate" style={{ color: SUCCESS_DARK }}>{n.proximaAcao.titulo}{n.proximaAcao.dataVencimento ? ` · ${new Date(n.proximaAcao.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
      )}
    </div>
  );
}

function Badge({ icon: Icon, label, color }: { icon?: typeof Beaker; label: string; color: string }) {
  // `color-mix` em vez de concatenar alpha no hex (`${color}18`) — os tokens
  // agora são `var(--cf2-*)`, não hex literal, então a concatenação de
  // string quebraria o CSS.
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
      {Icon && <Icon className="w-2.5 h-2.5" />} {label}
    </span>
  );
}
