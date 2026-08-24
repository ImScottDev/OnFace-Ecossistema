"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, Eye, Clock, ArrowUpRight, FileText, Send, CheckCircle2 } from "lucide-react";
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
  // Deep link `?propostaId=X` (24/08, achado real: 5 lugares no CRM2
  // — Negócio, Cliente 360, Atendimento — ainda apontavam pra rota
  // `/propostas/:id` legada, que só existe em `(crm)`, porque o CRM2 nunca
  // criou essa página e usa drawer em vez de página de detalhe). Ajuste de
  // estado durante o render (não useEffect) — mesmo padrão já usado no
  // Atendimento pra resolver deep link sem setState-em-efeito.
  const searchParams = useSearchParams();
  const propostaIdParam = searchParams.get("propostaId");
  const [drawerId, setDrawerId] = useState<string | null>(propostaIdParam);
  const [propostaIdAplicado, setPropostaIdAplicado] = useState<string | null>(propostaIdParam);
  if (propostaIdParam && propostaIdParam !== propostaIdAplicado) {
    setPropostaIdAplicado(propostaIdParam);
    setDrawerId(propostaIdParam);
  }

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Propostas</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Acompanhe a negociação do envio ao aceite, contrato e pagamento.</p>
        </div>
        <Link href="/propostas/novo" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="w-3.5 h-3.5" /> Nova proposta</Link>
      </header>
      <div className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-5" style={{ background: "var(--cf2-border-default)", border: "1px solid var(--cf2-border-default)" }}>
        <ProposalMetric icon={FileText} label="Em rascunho" value={kpis?.emElaboracao ?? "—"} />
        <ProposalMetric icon={Send} label="Aguardando retorno" value={kpis?.aguardandoAcao ?? "—"} />
        <ProposalMetric icon={Eye} label="Visualizadas" value={kpis?.visualizadas ?? "—"} />
        <ProposalMetric icon={CheckCircle2} label="Aceitas" value={kpis?.aceitas ?? "—"} />
        <ProposalMetric icon={ArrowUpRight} label="Valor em propostas abertas" value={kpis ? brl(kpis.valorTotalAtivo) : "—"} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Em negociação</p>
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
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  {["Cliente", "Proposta e serviços", "Investimento", "Responsável", "Última atividade", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => {
                  const badge = statusDisplay(p.status);
                  const aguardando = p.status === "enviada" && !p.clienteRespondeuEm;
                  const itens = p.itensResumo ?? [];
                  const ultimaAtividadeEm = p.ultimaAtividadeEm ?? p.createdAt;
                  const ultimaAtividadeTipo = p.ultimaAtividadeTipo ?? "criou";
                  return (
                    <tr key={p.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }} onClick={() => setDrawerId(p.id)}>
                      <td className="px-4 py-3.5 whitespace-nowrap"><p className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{p.leadEmpresa || p.leadNome || "—"}</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{p.leadEmpresa && p.leadNome ? p.leadNome : "Contato comercial"}</p></td>
                      <td className="px-4 py-3.5"><p className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>#PROP-{String(p.numero).padStart(4, "0")}{p.versao > 1 ? ` v${p.versao}` : ""}</p><p className="mt-0.5 max-w-[260px] truncate text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{itens.length ? itens.slice(0, 2).map((item) => `${item.nome}${Number(item.quantidade) > 1 ? ` · ${item.quantidade}x` : ""}`).join(" · ") : "Sem serviços adicionados"}{itens.length > 2 ? ` +${itens.length - 2}` : ""}</p>{(p.familias || []).length > 0 && <div className="mt-1.5 flex gap-1">{p.familias.map((f) => <span key={f} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: `${FAMILY_COLOR[f] || "#9ca3af"}18`, color: FAMILY_COLOR[f] || "#9ca3af" }}>{FAMILY_LABEL[f] || f}</span>)}</div>}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><p className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{Number(p.totalAvulso) > 0 ? brl(p.totalAvulso) : "Sem valor inicial"}</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{Number(p.totalRecorrente) > 0 ? `${brl(p.totalRecorrente)}/mês` : "Sem recorrência"}</p></td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><p style={{ color: "var(--cf2-text-secondary)" }}>{p.criadoPorNome || "—"}</p>{p.negocioId && <Link href={`/negocios/${p.negocioId}`} onClick={(e) => e.stopPropagation()} className="mt-1 inline-block text-[11px] font-semibold hover:underline" style={{ color: "var(--cf2-success-text)" }}>{p.negocioTitulo || "Abrir negócio"}</Link>}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{activityLabel(ultimaAtividadeTipo)}</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(ultimaAtividadeEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p></td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><Cf2Badge variant={p.status === "enviada" && p.visualizacoes > 0 ? "accent" : badge.tom}>{p.status === "enviada" && p.visualizacoes > 0 ? "Visualizada" : badge.label}</Cf2Badge>{p.dataValidade && <p className="mt-1 text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Válida até {new Date(p.dataValidade).toLocaleDateString("pt-BR")}</p>}</td>
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

function ProposalMetric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-[var(--cf2-bg-surface)] px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}><Icon className="size-4" /></span>
      <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p><p className="mt-0.5 truncate text-[17px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{value}</p></div>
    </div>
  );
}

function activityLabel(type: PropostaRow["ultimaAtividadeTipo"] | undefined) {
  return { criou: "Proposta criada", enviou: "Enviada ao cliente", visualizou: "Cliente visualizou", respondeu: "Cliente respondeu" }[type ?? "criou"];
}
