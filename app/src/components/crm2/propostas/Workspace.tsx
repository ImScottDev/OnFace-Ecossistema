"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, Eye, Clock } from "lucide-react";
import { Cf2Badge } from "../ui/Badge";
import { Cf2Card } from "../ui/Card";
import { Cf2EmptyState } from "../ui/States";

interface PropostaRow {
  id: string; numero: number; versao: number; status: string;
  leadNome: string | null; leadEmpresa: string | null;
  negocioId: string | null; negocioTitulo: string | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  dataValidade: string | null; criadoPorNome: string | null;
  proximoPasso: string | null; visualizacoes: number; clienteRespondeuEm: string | null;
  createdAt: string;
}

interface Kpis {
  emElaboracao: number; enviadas: number; visualizadas: number; aceitas: number;
  recusadasExpiradas: number; aguardandoAcao: number; valorTotalAtivo: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "accent" }> = {
  rascunho: { label: "Em elaboração", variant: "neutral" },
  enviada: { label: "Enviada", variant: "warning" },
  aceita: { label: "Aceita", variant: "success" },
  recusada: { label: "Recusada", variant: "danger" },
  expirada: { label: "Expirada", variant: "danger" },
};

const brl = (v: string | number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Kpi({ label, valor, destaque }: { label: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className="flex-1 min-w-[120px] p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <p className="text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      <p className="text-[18px] font-extrabold mt-0.5" style={{ color: destaque ? "var(--cf2-accent-border)" : "var(--cf2-text-primary)" }}>{valor}</p>
    </div>
  );
}

export function Cf2PropostasWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [periodo, setPeriodo] = useState<"mes" | "todos">("todos");

  const { data: kpis } = useQuery<Kpis>({
    queryKey: ["propostas-kpis"],
    queryFn: async () => {
      const r = await fetch("/api/propostas/kpis");
      return r.json();
    },
  });

  const { data: propostas = [], isLoading } = useQuery<PropostaRow[]>({
    queryKey: ["propostas", search, status, periodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status) params.set("status", status);
      if (periodo === "mes") params.set("periodo", "mes");
      const r = await fetch(`/api/propostas?${params.toString()}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  return (
    <div className="page-scroll space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Propostas</h1>
          <p className="text-xs mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Do rascunho ao pagamento/contrato — ciclo de vida completo da proposta.</p>
        </div>
        <Link
          href="/propostas/novo"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          <Plus className="w-4 h-4" /> Nova Proposta
        </Link>
      </div>

      <div className="flex gap-2.5 flex-wrap">
        <Kpi label="Em elaboração" valor={kpis?.emElaboracao ?? "—"} />
        <Kpi label="Enviadas" valor={kpis?.enviadas ?? "—"} />
        <Kpi label="Visualizadas" valor={kpis?.visualizadas ?? "—"} />
        <Kpi label="Aceitas" valor={kpis?.aceitas ?? "—"} destaque />
        <Kpi label="Recusadas/Expiradas" valor={kpis?.recusadasExpiradas ?? "—"} />
        <Kpi label="Aguardando ação" valor={kpis?.aguardandoAcao ?? "—"} destaque />
        <Kpi label="Valor total ativo" valor={kpis ? brl(kpis.valorTotalAtivo) : "—"} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente..."
            className="w-full text-sm pl-8 pr-3 py-2 rounded-lg outline-none"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          <option value="">Todos os status</option>
          <option value="rascunho">Em elaboração</option>
          <option value="enviada">Enviada</option>
          <option value="aceita">Aceita</option>
          <option value="recusada">Recusada</option>
          <option value="expirada">Expirada</option>
        </select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as "mes" | "todos")} className="text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          <option value="todos">Todo período</option>
          <option value="mes">Este mês</option>
        </select>
      </div>

      <Cf2Card padding="0">
        {isLoading ? (
          <p className="text-sm p-6" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
        ) : propostas.length === 0 ? (
          <div className="p-6"><Cf2EmptyState title="Nenhuma proposta encontrada" description="Crie a primeira proposta ou ajuste os filtros." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                  {["Proposta", "Cliente / Empresa", "Negócio", "Responsável", "Status", "Valor", "Validade", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => {
                  const badge = STATUS_BADGE[p.status] || { label: p.status, variant: "neutral" as const };
                  const aguardando = p.status === "enviada" && !p.clienteRespondeuEm;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                      <td className="px-4 py-3">
                        <Link href={`/propostas/${p.id}`} className="font-semibold hover:underline" style={{ color: "var(--cf2-text-primary)" }}>
                          #P-{String(p.numero).padStart(3, "0")}-v{p.versao}
                        </Link>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--cf2-text-primary)" }}>
                        {p.leadEmpresa || p.leadNome || "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--cf2-text-secondary)" }}>
                        {p.negocioId ? <Link href={`/negocios/${p.negocioId}`} className="hover:underline">{p.negocioTitulo || "Ver negócio"}</Link> : "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--cf2-text-secondary)" }}>{p.criadoPorNome || "—"}</td>
                      <td className="px-4 py-3"><Cf2Badge variant={badge.variant}>{badge.label}</Cf2Badge></td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.totalGeral)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--cf2-text-secondary)" }}>
                        {p.dataValidade ? new Date(p.dataValidade).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {p.visualizacoes > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }} title={`${p.visualizacoes} visualização(ões)`}>
                              <Eye className="w-3.5 h-3.5" /> {p.visualizacoes}
                            </span>
                          )}
                          {aguardando && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}>
                              <Clock className="w-3 h-3" /> aguardando
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cf2Card>
    </div>
  );
}
