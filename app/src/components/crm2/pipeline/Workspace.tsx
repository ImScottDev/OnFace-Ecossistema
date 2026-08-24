"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X, Clock, FileText, FileWarning, CreditCard, Link2, AlertTriangle, Beaker } from "lucide-react";
import { useOrgUsuarios, matchesResponsavel } from "@/components/crm/BoardFilters";
import {
  PIPELINE_OPEN_COLS, PERDIDO_KEYS, FAMILY_LABEL, FAMILY_COLOR,
  negocioValor, tempoNaEtapa, diasSemAvanco, motivoPerdaLabel, resolvePropostaDisplay,
  type NegocioBoard, type PipelineCol,
} from "./shared";
import { Cf2NegocioDrawer } from "./NegocioDrawer";
import { NovaOportunidadeModal } from "./NovaOportunidadeModal";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Resumo { pipelineAberto: number; forecast: number; oportunidadesAbertas: number; ticketMedio: number | null; winRate: number | null; winRateAmostraPequena: boolean; semProximaAcao: number }

/**
 * Board de Pipeline (CRM2, spec+mockups do Kauã 17/08) — Kanban de
 * OPORTUNIDADES (não leads), 4 colunas abertas fixas + resumo operacional +
 * filtros reais. Clique no card abre drawer lateral primeiro (mesmo padrão
 * de Pré-vendas/Prospecção) — "Abrir oportunidade completa" navega pra
 * `/negocios/:id`. Ganho/Perdido são estados finais acessíveis por bucket
 * clicável no rodapé, não colunas do board principal.
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

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-crm2-board"],
    queryFn: async () => {
      const r = await fetch("/api/pipeline-crm2/board");
      if (!r.ok) return { negocios: [] as NegocioBoard[] };
      return (await r.json()) as { negocios: NegocioBoard[] };
    },
  });

  const { data: resumo } = useQuery<Resumo>({
    queryKey: ["pipeline-crm2-resumo", respFilter, periodoFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ periodo: periodoFilter });
      if (respFilter !== "todos" && respFilter !== "meu") params.set("responsavelId", respFilter);
      if (respFilter === "meu" && currentUserId) params.set("responsavelId", currentUserId);
      const r = await fetch(`/api/pipeline-crm2/resumo?${params}`);
      if (!r.ok) return { pipelineAberto: 0, forecast: 0, oportunidadesAbertas: 0, ticketMedio: null, winRate: null, winRateAmostraPequena: false, semProximaAcao: 0 };
      return r.json();
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, status, motivoPerda }: { id: string; status: string; motivoPerda?: string }) => {
      const r = await fetch(`/api/negocios/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(motivoPerda ? { status, motivoPerda } : { status }) });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || "falha ao mover"); }
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline-crm2-board"] }); qc.invalidateQueries({ queryKey: ["pipeline-crm2-resumo"] }); },
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

  const filtered = allNegocios.filter((n) => {
    if (!matchesResponsavel(n.responsavelId, respFilter, currentUserId)) return false;
    if (familiaFilter !== "todas" && (n.serviceFamily || "UNKNOWN") !== familiaFilter) return false;
    if (origemFilter !== "todas" && n.leadOrigem !== origemFilter) return false;
    if (periodoFilter === "mes" && new Date(n.createdAt) < inicioMes) return false;
    if (statusFilter === "abertas" && (n.status === "ganho" || PERDIDO_KEYS.includes(n.status) || n.status === "ativo")) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (n.titulo || "").toLowerCase().includes(q) || (n.leadNome || "").toLowerCase().includes(q) || (n.empresaNome || "").toLowerCase().includes(q);
  });

  const negociosDaColuna = (col: PipelineCol) =>
    filtered.filter((n) => col.keys.includes(n.status)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const ganhoNegocios = filtered.filter((n) => n.status === "ganho");
  const perdidoNegocios = filtered.filter((n) => PERDIDO_KEYS.includes(n.status));
  const ativoNegocios = filtered.filter((n) => n.status === "ativo");

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo operacional */}
      <div className="grid grid-cols-5 gap-3">
        <ResumoCard label="Pipeline aberto" valor={brl(resumo?.pipelineAberto ?? 0)} />
        <ResumoCard label="Forecast" valor={brl(resumo?.forecast ?? 0)} />
        <ResumoCard label="Oportunidades abertas" valor={String(resumo?.oportunidadesAbertas ?? 0)} />
        <ResumoCard label="Ticket médio" valor={resumo?.ticketMedio != null ? brl(resumo.ticketMedio) : "—"} />
        <ResumoCard label="Win rate" valor={resumo?.winRate != null ? `${resumo.winRate}%` : "—"} sub={resumo?.winRateAmostraPequena ? "amostra pequena" : undefined} />
      </div>
      {resumo && resumo.semProximaAcao > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}>
          <AlertTriangle className="w-3.5 h-3.5" /> {resumo.semProximaAcao} oportunidade{resumo.semProximaAcao > 1 ? "s" : ""} aberta{resumo.semProximaAcao > 1 ? "s" : ""} sem próxima ação definida ou com ação atrasada
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar oportunidade, empresa..."
            className="w-56 sm:w-72 pl-8 pr-7 py-1.5 rounded-lg text-[12px] outline-none"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }}><X className="w-3 h-3" /></button>}
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
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {PIPELINE_OPEN_COLS.map((col) => {
              const negociosCol = negociosDaColuna(col);
              const totalCol = negociosCol.reduce((s, n) => s + negocioValor(n), 0);
              const isDragOver = dragOverCol === col.key;
              return (
                <div
                  key={col.key}
                  className="w-[300px] shrink-0 rounded-2xl flex flex-col max-h-full"
                  style={{ background: isDragOver ? `${col.color}10` : "var(--cf2-bg-canvas)", border: isDragOver ? `2px dashed ${col.color}` : "1px solid var(--cf2-border-default)" }}
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
                    <span className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(totalCol)}</span>
                  </div>
                  <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-420px)] overflow-y-auto">
                    {negociosCol.map((n) => (
                      <NegocioCard key={n.id} n={n} onOpen={() => setDrawerNegocioId(n.id)} onDragStart={(e) => e.dataTransfer.setData("negocioId", n.id)} />
                    ))}
                    {negociosCol.length === 0 && <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>vazio</div>}
                  </div>
                </div>
              );
            })}

            {/* Ganho/Perdido — colunas colapsáveis na MESMA linha (24/08,
                referência visual de Pré-vendas), não mais botão+modal por
                cima. Não são drop target: nascem de ação real (aceite de
                proposta, marcar perdido com motivo), nunca de drag cru. */}
            <BucketColumn label="Ganho" color="#22c55e" negocios={ganhoNegocios} expanded={expandedBucket === "ganho"} onToggle={() => setExpandedBucket((b) => (b === "ganho" ? null : "ganho"))} onOpen={setDrawerNegocioId} />
            <BucketColumn label="Perdido" color="#dc2626" negocios={perdidoNegocios} expanded={expandedBucket === "perdido"} onToggle={() => setExpandedBucket((b) => (b === "perdido" ? null : "perdido"))} onOpen={setDrawerNegocioId} showMotivo />
          </div>

          {ativoNegocios.length > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-warning-text)" }} />
              {ativoNegocios.length} negócio{ativoNegocios.length > 1 ? "s" : ""} em status <code className="px-1 rounded" style={{ background: "var(--cf2-bg-surface)" }}>ativo</code> (pós-venda recorrente) — fora do De/Para deste Pipeline; não decidido se deveria viver em Carteira/Clientes. Pendência aberta, não escondida.
            </div>
          )}
        </>
      )}

      <Cf2NegocioDrawer negocioId={drawerNegocioId} open={!!drawerNegocioId} onClose={() => setDrawerNegocioId(null)} onChanged={() => { qc.invalidateQueries({ queryKey: ["pipeline-crm2-board"] }); qc.invalidateQueries({ queryKey: ["pipeline-crm2-resumo"] }); }} />
      <NovaOportunidadeModal open={novaOpen} onClose={() => setNovaOpen(false)} usuarios={usuarios} onCreated={() => qc.invalidateQueries({ queryKey: ["pipeline-crm2-board"] })} />
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
      {children}
    </select>
  );
}

function ResumoCard({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 p-3.5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      <p className="text-[20px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
      {sub && <p className="text-[10px]" style={{ color: "var(--cf2-warning-text)" }}>{sub}</p>}
    </div>
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
        style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}
      >
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}18` }}>{negocios.length}</span>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{label}</span>
      </button>
    );
  }

  return (
    <div className="w-[300px] shrink-0 rounded-2xl flex flex-col max-h-full" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
      <button type="button" onClick={onToggle} className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{label} ({negocios.length})</span>
        </div>
        <span className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(total)}</span>
      </button>
      <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-420px)] overflow-y-auto">
        {negocios.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>vazio</div>
        ) : negocios.map((n) => (
          <div key={n.id}>
            <NegocioCard n={n} onOpen={() => onOpen(n.id)} onDragStart={() => {}} />
            {showMotivo && (
              <p className="text-[11px] mt-1 px-1 truncate" style={{ color: "var(--cf2-danger-text)" }}>{motivoPerdaLabel(n)}</p>
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
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}
    >
      <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{n.empresaNome || nomeLead || n.titulo}</p>
      {(n.empresaNome || nomeLead) && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{nomeLead}{n.serviceFamily ? ` · ${FAMILY_LABEL[n.serviceFamily] || n.serviceFamily}` : ""}</p>}

      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {/* Cores por SEMÂNTICA, não por badge (24/08, achado do Kauã: "cores
            aleatório") — sempre os mesmos 4 tokens do resto do CRM2:
            sucesso/info (accent), atenção (warning), problema (danger),
            neutro (tertiary). Nenhum hex solto novo. */}
        {isTrial && <Badge icon={Beaker} label="Trial ativo" color="var(--cf2-accent-border)" />}
        {isNoShow && <Badge label="No-show" color="var(--cf2-warning-text)" />}
        {propostaDisplay && <Badge icon={FileText} label={`Proposta #${n.proposta!.numero} · ${propostaDisplay.label}`} color={propostaDisplay.tom === "danger" ? "var(--cf2-danger-text)" : propostaDisplay.tom === "success" ? "var(--cf2-success-text)" : propostaDisplay.tom === "warning" ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)"} />}
        {n.contratoPendente && <Badge icon={FileWarning} label="Contrato pendente" color="var(--cf2-warning-text)" />}
        {n.pagamentoPendente && <Badge icon={CreditCard} label="Pagamento pendente" color="var(--cf2-warning-text)" />}
        {!n.proximaAcao && <Badge icon={AlertTriangle} label="Sem próxima ação" color="var(--cf2-danger-text)" />}
        {semAvancoRelevante && <Badge icon={Clock} label={`${dias} dias sem avanço`} color="var(--cf2-danger-text)" />}
        {n.oportunidadesRelacionadas > 0 && <Badge icon={Link2} label={`+${n.oportunidadesRelacionadas} oportunidade${n.oportunidadesRelacionadas > 1 ? "s" : ""}`} color="var(--cf2-text-tertiary)" />}
      </div>

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(negocioValor(n))}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {n.responsavelNome && <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{n.responsavelNome.split(" ")[0]}</span>}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{tempoNaEtapa(n.updatedAt)}</span>
        </div>
      </div>
      {n.proximaAcao && (
        <p className="text-[11px] mt-1.5 truncate" style={{ color: "var(--cf2-success-text)" }}>{n.proximaAcao.titulo}{n.proximaAcao.dataVencimento ? ` · ${new Date(n.proximaAcao.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
      )}
    </div>
  );
}

function Badge({ icon: Icon, label, color }: { icon?: typeof Beaker; label: string; color: string }) {
  // `color-mix` em vez de concatenar alpha no hex (`${color}18`) — os tokens
  // agora são `var(--cf2-*)`, não hex literal, então a concatenação de
  // string quebraria o CSS.
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      {Icon && <Icon className="w-2.5 h-2.5" />} {label}
    </span>
  );
}

