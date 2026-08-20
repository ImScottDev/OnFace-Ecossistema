"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, Eye, Clock } from "lucide-react";
import { Cf2Badge } from "../ui/Badge";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { statusDisplay, FAMILY_LABEL, FAMILY_COLOR, brl, type PropostaRow } from "./shared";
import { Cf2PropostaDrawer } from "./PropostaDrawer";

interface Kpis {
  emElaboracao: number; enviadas: number; visualizadas: number; aceitas: number;
  recusadasExpiradas: number; aguardandoAcao: number; valorTotalAtivo: string;
  taxaAceite: number | null; tempoMedioAceiteDias: number | null;
}

/**
 * Propostas (CRM2, reconstrução 18/08 — spec + mockups + correção do Kauã:
 * "Propostas é o configurador comercial + gerador da proposta + orquestrador
 * do próximo passo", não só uma tela de listagem achatada). Esta tela é o
 * contexto de GESTÃO (encontrar propostas existentes); criar/editar mora em
 * `NovaProposta.tsx` (3 painéis: família → configurador → resumo comercial,
 * já real desde antes desta rodada — só ganhou modo de edição e rótulos
 * explícitos hoje). Clique na linha abre drawer primeiro (mesmo padrão de
 * Pré-vendas/Prospecção/Pipeline) — "Abrir" (link público) e "Abrir
 * oportunidade" continuam sendo navegação explícita, não o clique da linha.
 */
export function Cf2PropostasWorkspace() {
  const { usuarios } = useOrgUsuarios();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [responsavel, setResponsavel] = useState("todas");
  const [familia, setFamilia] = useState("");
  const [periodo, setPeriodo] = useState<"mes" | "todos">("todos");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const { data: kpis } = useQuery<Kpis>({
    queryKey: ["propostas-kpis"],
    queryFn: async () => {
      const r = await fetch("/api/propostas/kpis");
      return r.json();
    },
  });

  const { data: propostas = [], isLoading, refetch } = useQuery<PropostaRow[]>({
    queryKey: ["propostas", search, status, responsavel, familia, periodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status) params.set("status", status);
      if (responsavel !== "todas") params.set("responsavel", responsavel);
      if (familia) params.set("familia", familia);
      if (periodo === "mes") params.set("periodo", "mes");
      const r = await fetch(`/api/propostas?${params.toString()}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Pulso de Propostas — mesmo padrão escuro já usado em Prospecção/Pipeline/Pré-vendas */}
      <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pulso de Propostas</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Acompanhamento em tempo real da volumetria, andamento e conversão de propostas enviadas</p>
          </div>
          <Link href="/propostas/novo" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            <Plus className="w-3.5 h-3.5" /> Nova proposta
          </Link>
        </div>
        <div className="grid grid-cols-6 gap-4">
          <ChromeKpi label="Valor total ativo" valor={kpis ? brl(kpis.valorTotalAtivo) : "—"} />
          <ChromeKpi label="Enviadas" valor={kpis?.enviadas ?? "—"} />
          <ChromeKpi label="Aguardando ação" valor={kpis?.aguardandoAcao ?? "—"} />
          <ChromeKpi label="Aceitas" valor={kpis?.aceitas ?? "—"} accent />
          <ChromeKpi label="Taxa de aceite" valor={kpis?.taxaAceite != null ? `${kpis.taxaAceite}%` : "—"} accent />
          <ChromeKpi label="Tempo médio até aceite" valor={kpis?.tempoMedioAceiteDias != null ? `${kpis.tempoMedioAceiteDias}d` : "—"} />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Gestão Operacional de Propostas</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proposta, empresa, oportunidade..."
              className="w-64 text-[12px] pl-8 pr-3 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
          </div>
          <Select value={status} onChange={setStatus}>
            <option value="">Status: Todos</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviada">Enviada</option>
            <option value="ajuste_solicitado">Ajuste solicitado</option>
            <option value="aceita">Aceita</option>
            <option value="recusada">Recusada</option>
            <option value="expirada">Expirada</option>
          </Select>
          <Select value={responsavel} onChange={setResponsavel}>
            <option value="todas">Responsável: Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
          <Select value={familia} onChange={setFamilia}>
            <option value="">Família: Todas</option>
            {Object.entries(FAMILY_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
          <Select value={periodo} onChange={(v) => setPeriodo(v as "mes" | "todos")}>
            <option value="todos">Período: Todo o período</option>
            <option value="mes">Período: Este mês</option>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        {isLoading ? (
          <p className="text-sm p-6" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
        ) : propostas.length === 0 ? (
          <p className="text-sm p-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  {["Proposta", "Empresa", "Oportunidade", "Responsável", "Valor", "Recorrência", "Enviada em", "Validade", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => {
                  const badge = statusDisplay(p.status);
                  const aguardando = p.status === "enviada" && !p.clienteRespondeuEm;
                  return (
                    <tr key={p.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }} onClick={() => setDrawerId(p.id)}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>#PROP-{String(p.numero).padStart(4, "0")}{p.versao > 1 ? ` v${p.versao}` : ""}</span>
                        {(p.familias || []).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {p.familias.map((f) => <span key={f} className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${FAMILY_COLOR[f] || "#9ca3af"}18`, color: FAMILY_COLOR[f] || "#9ca3af" }}>{FAMILY_LABEL[f] || f}</span>)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>{p.leadEmpresa || p.leadNome || "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
                        {p.negocioId ? <Link href={`/negocios/${p.negocioId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{p.negocioTitulo || "Ver negócio"}</Link> : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{p.criadoPorNome || "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.totalAvulso)}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{Number(p.totalRecorrente) > 0 ? `${brl(p.totalRecorrente)}/mês` : "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{p.enviadaEm ? new Date(p.enviadaEm).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{p.dataValidade ? new Date(p.dataValidade).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap"><Cf2Badge variant={badge.tom}>{badge.label}</Cf2Badge></td>
                      <td className="px-3 py-3 whitespace-nowrap">
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
      </div>

      <Cf2PropostaDrawer propostaId={drawerId} open={!!drawerId} onClose={() => setDrawerId(null)} onChanged={() => { refetch(); }} />
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

function ChromeKpi({ label, valor, accent }: { label: string; valor: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
      <p className="text-[20px] font-bold" style={{ color: accent ? "var(--cf2-accent-border)" : "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
    </div>
  );
}
