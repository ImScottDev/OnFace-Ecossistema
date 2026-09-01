"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toastDark } from "../shared/toast-dark";
import {
  Plus, Search, Eye, ArrowUpRight, CheckCircle2, FileText, Send, MoreHorizontal, Pencil, Copy, Trash2,
} from "lucide-react";
import { Cf2Badge } from "../ui/Badge";
import { Cf2ChromeCard } from "../shared/ChromeCard";
import { Cf2NotificationBell } from "../NotificationBell";
import {
  Cf2DropdownMenu, Cf2DropdownMenuContent, Cf2DropdownMenuItem, Cf2DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { DarkFilterSelect, DarkItem } from "../shared/DarkFilterSelect";
import { statusDisplay, resolveEtapaNegocio, FAMILY_LABEL, brl, type PropostaRow } from "./shared";
import { Cf2PropostaStatusChart, Cf2PropostaSerieChart } from "./PropostaCharts";
import { Cf2PropostaDrawer } from "./PropostaDrawer";

function timeAgoShort(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  if (mins < 1440) return `há ${Math.floor(mins / 60)}h`;
  return `há ${Math.floor(mins / 1440)}d`;
}

interface Kpis {
  totalPropostas: number; emElaboracao: number; enviadas: number; visualizadas: number; aceitas: number;
  recusadasExpiradas: number; aguardandoAcao: number; valorTotalAtivo: string;
  taxaAceite: number | null; tempoMedioAceiteDias: number | null;
  serieMensal: { mes: string; enviadas: number; aceitas: number; valorAceito: number }[];
  tendencia: { enviadas: number | null; aceitas: number | null };
}

/**
 * Propostas (CRM2). Reconstrução visual 25/08 — referência direta do Kauã
 * (mockup dark: sidebar+topbar escuros, KPIs com tendência, tabela rica,
 * drawer de preview) — página inteira passa de clara pra "chrome" escuro
 * (mesmo esquema do Pipeline), substituindo o header claro genérico
 * "Vendas" que ficava aqui (space reclamado pros KPIs, pedido explícito:
 * "isso pode subir, no lugar do nome Vendas e do outro botão").
 *
 * Clique na linha abre o DRAWER (preview rápido, voltou depois de ter sido
 * removido nesta mesma sessão — o Kauã queria de volta como estilo
 * lista+preview). Gestão completa (Aceitar com conversão em cliente,
 * Recusar com motivo, Excluir, PDF) mora em `/propostas/[id]`
 * (`PropostaDetalhe.tsx`) — acessível pelo menu "..." de cada linha
 * ("Ver página completa") e pelo próprio drawer.
 */
export function Cf2PropostasWorkspace() {
  const router = useRouter();
  const { usuarios } = useOrgUsuarios();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [responsavel, setResponsavel] = useState("todas");
  const [familia, setFamilia] = useState("todas");
  const [periodo, setPeriodo] = useState<"mes" | "todos">("todos");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // KPIs/gráficos respeitam os MESMOS filtros da tabela (achado real 25/08,
  // Kauã: "usando os filtros tinha que atualizar os dados ali presente") —
  // mesmos params que a query da tabela já manda, backend usa a mesma
  // função de condições pras duas rotas.
  const { data: kpis } = useQuery<Kpis>({
    queryKey: ["propostas-kpis", status, responsavel, familia, periodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "todos") params.set("status", status);
      if (responsavel !== "todas") params.set("responsavel", responsavel);
      if (familia !== "todas") params.set("familia", familia);
      if (periodo === "mes") params.set("periodo", "mes");
      const r = await fetch(`/api/propostas/kpis?${params.toString()}`);
      return r.json();
    },
  });

  const { data: propostas = [], isLoading, refetch } = useQuery<PropostaRow[]>({
    queryKey: ["propostas", search, status, responsavel, familia, periodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status !== "todos") params.set("status", status);
      if (responsavel !== "todas") params.set("responsavel", responsavel);
      if (familia !== "todas") params.set("familia", familia);
      if (periodo === "mes") params.set("periodo", "mes");
      const r = await fetch(`/api/propostas?${params.toString()}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  return (
    <div className="-m-6 min-h-full flex flex-col" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
      <div className="flex flex-col gap-5 px-6 pt-6 pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[24px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Propostas</p>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Gerencie, acompanhe e converta suas propostas comerciais.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proposta, cliente ou negócio..."
                className="w-64 text-[13px] pl-8 pr-3 py-2 rounded-full outline-none"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
              />
            </div>
            <Cf2NotificationBell variant="dark" />
            <Link href="/propostas/novo" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="w-3.5 h-3.5" /> Nova proposta</Link>
          </div>
        </header>

        {/* KPIs com tendência mês-a-mês real (deltas de estoque como "valor
            total" e "total de propostas" não têm histórico gravado pra
            comparar — mostrados sem seta em vez de inventar tendência). */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={FileText} label="Total de propostas" value={kpis?.totalPropostas ?? "—"} />
          <KpiCard icon={Send} label="Abertas pelo cliente" value={kpis && kpis.enviadas > 0 ? `${Math.round((kpis.visualizadas / kpis.enviadas) * 100)}%` : "—"} trend={kpis?.tendencia?.enviadas ?? undefined} trendLabel="envios" />
          <KpiCard icon={ArrowUpRight} label="Valor em propostas abertas" value={kpis ? brl(kpis.valorTotalAtivo) : "—"} />
          <KpiCard icon={CheckCircle2} label="Taxa de aceite" value={kpis?.taxaAceite != null ? `${kpis.taxaAceite}%` : "—"} trend={kpis?.tendencia?.aceitas ?? undefined} trendLabel="aceites" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Cf2PropostaStatusChart
            emElaboracao={kpis?.emElaboracao ?? 0}
            enviadas={kpis?.enviadas ?? 0}
            aceitas={kpis?.aceitas ?? 0}
            recusadasExpiradas={kpis?.recusadasExpiradas ?? 0}
          />
          <Cf2PropostaSerieChart dados={kpis?.serieMensal ?? []} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DarkFilterSelect value={status} onChange={setStatus} label="Status" placeholder="Todos">
            <DarkItem value="todos">Todos</DarkItem>
            <DarkItem value="rascunho">Rascunho</DarkItem>
            <DarkItem value="enviada">Enviada</DarkItem>
            <DarkItem value="ajuste_solicitado">Ajuste solicitado</DarkItem>
            <DarkItem value="aceita">Aceita</DarkItem>
            <DarkItem value="recusada">Recusada</DarkItem>
            <DarkItem value="expirada">Expirada</DarkItem>
          </DarkFilterSelect>
          <DarkFilterSelect value={responsavel} onChange={setResponsavel} label="Responsável" placeholder="Todos">
            <DarkItem value="todas">Todos</DarkItem>
            {usuarios.map((u) => <DarkItem key={u.id} value={u.id}>{u.nome}</DarkItem>)}
          </DarkFilterSelect>
          <DarkFilterSelect value={familia} onChange={setFamilia} label="Família" placeholder="Todas">
            <DarkItem value="todas">Todas</DarkItem>
            {Object.entries(FAMILY_LABEL).map(([k, label]) => <DarkItem key={k} value={k}>{label}</DarkItem>)}
          </DarkFilterSelect>
          <DarkFilterSelect value={periodo} onChange={(v) => setPeriodo(v as "mes" | "todos")} label="Período" placeholder="Todo o período">
            <DarkItem value="todos">Todo o período</DarkItem>
            <DarkItem value="mes">Este mês</DarkItem>
          </DarkFilterSelect>
        </div>

        {/* Lista estilo Circle (25/08, pedido explícito do Kauã: "pega as
            tabelas de referência e estilo do Circle") — linha única flat
            (h-12, sem <table>/colunas de grid), igual a
            issue-line.tsx do Circle: cluster fixo à esquerda (família+
            número+status), título flexível no meio, cluster auxiliar
            empurrado pra direita com ml-auto. Isso é estrutural: elimina o
            scroll horizontal por definição (nada aqui tem largura fixa
            somada além do necessário), não é só ajuste de padding. */}
        <Cf2ChromeCard padding="0px" className="overflow-hidden">
          {isLoading ? (
            <p className="text-sm p-6" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Carregando...</p>
          ) : propostas.length === 0 ? (
            <p className="text-sm p-6" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma proposta encontrada.</p>
          ) : (
            <div className="flex flex-col">
              {propostas.map((p) => {
                const badge = statusDisplay(p.status);
                const etapa = resolveEtapaNegocio(p.negocioStatus);
                const visualizada = p.status === "enviada" && p.visualizacoes > 0;
                return (
                  <div
                    key={p.id}
                    className="w-full flex items-center h-12 px-4 gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors border-b"
                    style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}
                    onClick={() => setDrawerId(p.id)}
                  >
                    <span className="text-[12px] font-mono shrink-0 w-[92px] truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>#PROP-{String(p.numero).padStart(4, "0")}{p.versao > 1 ? `v${p.versao}` : ""}</span>
                    <Cf2Badge dark variant={visualizada ? "accent" : badge.tom}>{visualizada ? "Visualizada" : badge.label}</Cf2Badge>

                    <div className="min-w-0 flex items-baseline gap-1.5 mr-2">
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-chrome-text-primary)" }}>{p.leadEmpresa || p.leadNome || "—"}</span>
                      <span className="text-[12px] truncate hidden md:inline" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{p.itensResumo?.[0]?.nome}</span>
                    </div>

                    <div className="flex items-center justify-end gap-3 ml-auto shrink-0">
                      {p.negocioId && (
                        <Link href={`/negocios/${p.negocioId}`} onClick={(e) => e.stopPropagation()} className="text-[11px] hover:underline hidden lg:inline-block max-w-[140px] truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{p.negocioTitulo || "negócio"}</Link>
                      )}
                      {etapa && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 hidden lg:inline-block" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cf2-chrome-text-secondary)" }}>{etapa.label}</span>
                      )}
                      {p.primeiraVisualizacaoEm && (
                        <Eye className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
                      )}
                      <span className="text-[12px] shrink-0 hidden sm:inline-block" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{timeAgoShort(p.ultimaAtividadeEm ?? p.createdAt)}</span>
                      <span className="text-[13px] font-semibold shrink-0 w-[92px] text-right" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(p.totalGeral)}</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <RowMenu proposta={p} router={router} refetch={refetch} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Cf2ChromeCard>
      </div>

      <Cf2PropostaDrawer propostaId={drawerId} open={!!drawerId} onClose={() => setDrawerId(null)} onChanged={() => refetch()} />
    </div>
  );
}

function RowMenu({ proposta, router, refetch }: { proposta: PropostaRow; router: ReturnType<typeof useRouter>; refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const editavel = ["rascunho", "enviada", "ajuste_solicitado"].includes(proposta.status);

  const excluir = async () => {
    const r = await fetch(`/api/propostas/${proposta.id}`, { method: "DELETE" });
    if (r.ok) { toastDark.success("Proposta excluída."); refetch(); }
    else toastDark.error("Erro ao excluir proposta");
    setOpen(false);
  };

  return (
    <Cf2DropdownMenu open={open} onOpenChange={setOpen}>
      <Cf2DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-secondary)" }}><MoreHorizontal className="w-4 h-4" /></button>
      </Cf2DropdownMenuTrigger>
      <Cf2DropdownMenuContent align="end" className="min-w-[180px]" style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
        <Cf2DropdownMenuItem onClick={() => router.push(`/propostas/${proposta.id}`)} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>Ver página completa</Cf2DropdownMenuItem>
        {editavel && (
          <Cf2DropdownMenuItem onClick={() => router.push(`/propostas/novo?propostaId=${proposta.id}`)} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><Pencil className="w-3.5 h-3.5" /> Editar</Cf2DropdownMenuItem>
        )}
        {(proposta.status === "recusada" || proposta.status === "expirada") && (
          <Cf2DropdownMenuItem onClick={async () => { const r = await fetch(`/api/propostas/${proposta.id}/nova-versao`, { method: "POST" }); const j = await r.json(); if (r.ok) router.push(`/propostas/${j.id}`); else toastDark.error("Erro ao criar nova versão"); }} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><Copy className="w-3.5 h-3.5" /> Nova versão</Cf2DropdownMenuItem>
        )}
        {proposta.status !== "aceita" && (
          <Cf2DropdownMenuItem onClick={excluir} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "#f87171" }}><Trash2 className="w-3.5 h-3.5" /> Excluir</Cf2DropdownMenuItem>
        )}
      </Cf2DropdownMenuContent>
    </Cf2DropdownMenu>
  );
}


function KpiCard({ icon: Icon, label, value, trend, trendLabel }: { icon: typeof FileText; label: string; value: string | number; trend?: number; trendLabel?: string }) {
  return (
    <Cf2ChromeCard>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cf2-chrome-text-secondary)" }}><Icon className="w-4 h-4" /></span>
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
      <p className="mt-1 text-[22px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{value}</p>
      {trend != null && (
        <p className="mt-1 text-[11px] font-semibold" style={{ color: trend >= 0 ? "#4ade80" : "#f87171" }}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% {trendLabel ? `de ${trendLabel} ` : ""}vs mês anterior
        </p>
      )}
    </Cf2ChromeCard>
  );
}
