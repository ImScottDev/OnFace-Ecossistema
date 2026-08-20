"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Building2, FileText, Calendar, Download, Plus } from "lucide-react";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2ClienteFinanceiro } from "./ClienteFinanceiro";
import { Cf2MrrMensalChart } from "./MrrMensalChart";

interface Servico {
  id: string;
  serviceFamily: string;
  canonicalProduct: string | null;
  revenueNature: string;
  commercialLifecycle: string;
  billingStatus: string;
  currentRecurringValue: string;
  portfolioIncluded: boolean;
  confidence: string;
  fulfillment: { id: string; status: string } | null;
  contrato: { id: string; status: string; corpoGerado: string | null; zohoId: string | null } | null;
}

interface Proposta { id: string; numero: number; valorTotal: string | null; status: string; createdAt: string }
interface ProximaAcao { id: string; titulo: string; venceEm: string | null; usuarioNome: string | null }
interface PontoMensal { mes: string; valor: number }

interface Cliente360Data {
  empresa: { id: string; nome: string; setor: string | null; cnpj: string | null };
  pessoas: { id: string; nome: string; cargo: string | null; email: string | null; telefone?: string | null; tipo: string }[];
  servicos: Servico[];
  currentMrr: number;
  timeline: { id: string; conteudo: string; autorNome: string | null; createdAt: string; pessoaNome: string | null }[];
  clienteDesde: string | null;
  statusFinanceiro: string | null;
  proximaFatura: { valor: string; vencimento: string } | null;
  propostas: Proposta[];
  proximasAcoes: ProximaAcao[];
  mrrMensal: PontoMensal[];
  negocioIds: string[];
  contratoIds: string[];
}

interface AnexoLegado {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number | null;
  categoria: string;
  criadoEmOriginal: string | null;
  zohoId: string | null;
  arquivoDisponivel: boolean;
}

const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
const LIFECYCLE_COLOR: Record<string, string> = { ACTIVE: "#059669", CHURNED: "#6B7280", SUPERSEDED: "#9497ab" };
const PROPOSTA_STATUS_BADGE: Record<string, "neutral" | "accent" | "success" | "danger"> = {
  rascunho: "neutral", enviada: "accent", aceita: "success", recusada: "danger", expirada: "neutral",
};
const TABS = ["Visão geral", "Serviços", "Financeiro", "Atividades", "Propostas", "Documentos"] as const;
type Tab = (typeof TABS)[number];

function brl(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function useAnexosLegadoCliente(empresaId: string, negocioIds: string[], contratoIds: string[]) {
  return useQuery<AnexoLegado[]>({
    queryKey: ["anexos-legado-cliente360", empresaId, negocioIds.join(","), contratoIds.join(",")],
    queryFn: async () => {
      const fetchTipo = async (tipo: string, ids: string[]): Promise<AnexoLegado[]> => {
        if (ids.length === 0) return [];
        const res = await fetch(`/api/anexos-legado?entidadeTipo=${tipo}&entidadeIds=${ids.join(",")}`);
        if (!res.ok) return [];
        const j = await res.json();
        return (j.anexos || []) as AnexoLegado[];
      };
      const [empresaAnexos, negocioAnexos, contratoAnexos] = await Promise.all([
        fetchTipo("empresa", [empresaId]),
        fetchTipo("negocio", negocioIds),
        fetchTipo("contrato", contratoIds),
      ]);
      return [...empresaAnexos, ...negocioAnexos, ...contratoAnexos];
    },
  });
}

/**
 * Customer 360 (CRM2, 19/08 → reconstrução completa após referência de UX
 * do Kauã). Company é a âncora relacional; Service é o centro econômico.
 * Nunca "empresa.mrr" — sempre soma de servicosCanonicos.currentRecurringValue.
 * Deliberadamente SEM "Health Score": regra fechada do projeto é nunca
 * inventar essa fórmula sem base real. "Tickets"/"Usuários e acessos" (portal
 * multiusuário por conta) da referência não têm modelo de dado real hoje —
 * não fabricados aqui, ficam registrados como gap de produto, não de UI.
 */
export function Cf2Cliente360({ empresaId }: { empresaId: string }) {
  const [tab, setTab] = useState<Tab>("Visão geral");

  const { data, isLoading } = useQuery<Cliente360Data>({
    queryKey: ["cf2-cliente-360", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/${empresaId}`);
      if (!r.ok) throw new Error("Cliente não encontrado");
      return r.json();
    },
  });

  const documentos = useAnexosLegadoCliente(empresaId, data?.negocioIds ?? [], data?.contratoIds ?? []);

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (!data) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Cliente não encontrado.</p>;

  const {
    empresa, currentMrr, clienteDesde, proximaFatura,
    pessoas = [], servicos = [], timeline = [], propostas = [], proximasAcoes = [], mrrMensal = [],
  } = data;
  const familias = [...new Set(servicos.filter((s) => s.portfolioIncluded).map((s) => s.serviceFamily))];
  const pessoaPrincipal = pessoas.find((p) => p.tipo === "cliente") || pessoas[0] || null;
  const servicosAtivos = servicos.filter((s) => s.portfolioIncluded);

  // Tendência real de MRR (não inventada): diferença entre os 2 últimos
  // pontos da série real de mrr_movimentos. Sem série (cliente PABX-only,
  // ledger ainda não cobre essa família) = sem badge, não fabrica número.
  const tendenciaMrr = mrrMensal.length >= 2
    ? ((mrrMensal[mrrMensal.length - 1].valor - mrrMensal[mrrMensal.length - 2].valor) / (mrrMensal[mrrMensal.length - 2].valor || 1)) * 100
    : null;

  return (
    <>
      <Cf2Topbar orgNome="Callface" />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 pb-8">
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          <Link href="/clientes" className="hover:underline">Clientes</Link>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: "var(--cf2-text-primary)" }}>{empresa.nome}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-2xl shrink-0 w-12 h-12" style={{ background: "var(--cf2-bg-inverse)" }}>
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[20px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{empresa.nome}</p>
                  <Cf2Badge variant={servicosAtivos.length > 0 ? "success" : "neutral"}>{servicosAtivos.length > 0 ? "Ativo" : "Sem serviço ativo"}</Cf2Badge>
                  {familias.map((f) => <Cf2Badge key={f} variant="neutral">{FAMILIA_LABEL[f] || f}</Cf2Badge>)}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                  {clienteDesde ? `Cliente desde ${new Date(clienteDesde).toLocaleDateString("pt-BR")}` : "Data de início não registrada"}
                  {empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}
                </p>
              </div>
            </div>
            {pessoaPrincipal && (
              <Link
                href={`/propostas/novo?leadId=${pessoaPrincipal.id}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold shrink-0"
                style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
              >
                <Plus className="w-3.5 h-3.5" /> Nova proposta
              </Link>
            )}
          </div>

          {/* Stat cards — sem Health Score (regra fechada, nunca inventar) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>MRR ATUAL</p>
              <p className="text-[22px] font-bold" style={{ color: "var(--cf2-success-text)" }}>{brl(currentMrr)}</p>
              {tendenciaMrr !== null && (
                <p className="text-[11px] font-semibold" style={{ color: tendenciaMrr >= 0 ? "var(--cf2-success-text)" : "var(--cf2-danger-text)" }}>
                  {tendenciaMrr >= 0 ? "+" : ""}{tendenciaMrr.toFixed(1)}% vs mês anterior
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>SERVIÇOS ATIVOS</p>
              <p className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{servicosAtivos.length}</p>
            </div>
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PRÓXIMA FATURA</p>
              {proximaFatura ? (
                <>
                  <p className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(proximaFatura.valor)}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(proximaFatura.vencimento).toLocaleDateString("pt-BR")}</p>
                </>
              ) : (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem fatura futura em aberto</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3.5 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0"
              style={{
                background: tab === t ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface)",
                color: tab === t ? "#ffffff" : "var(--cf2-text-secondary)",
                border: tab === t ? "none" : "1px solid var(--cf2-border-default)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Visão geral" && (
          <div className="flex flex-col gap-5">
            {mrrMensal.length > 0 && (
              <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[14px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Desempenho de MRR</p>
                <Cf2MrrMensalChart dados={mrrMensal} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Últimas propostas</p>
                  <button onClick={() => setTab("Propostas")} className="text-[11px] font-semibold" style={{ color: "var(--cf2-accent)" }}>Ver todas →</button>
                </div>
                {propostas.length === 0 ? (
                  <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta.</p>
                ) : propostas.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Proposta #{p.numero}</p>
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.valorTotal || "0")}</p>
                      <Cf2Badge variant={PROPOSTA_STATUS_BADGE[p.status] || "neutral"}>{p.status}</Cf2Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Próximas ações</p>
                {proximasAcoes.length === 0 ? (
                  <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma ação em aberto.</p>
                ) : proximasAcoes.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                    <p className="flex-1 text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{a.titulo}</p>
                    <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{a.venceEm ? new Date(a.venceEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "sem prazo"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pessoas vinculadas</p>
              {pessoas.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa vinculada.</p>
              ) : pessoas.map((p) => (
                <Link key={p.id} href={`/contatos/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)]">
                  <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}{p.cargo ? ` · ${p.cargo}` : ""}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{p.email || "—"}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tab === "Serviços" && (
          <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {servicos.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum serviço.</p>
            ) : servicos.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{FAMILIA_LABEL[s.serviceFamily] || s.serviceFamily}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--cf2-bg-surface)", color: LIFECYCLE_COLOR[s.commercialLifecycle] || "var(--cf2-text-tertiary)" }}>{s.commercialLifecycle}</span>
                    {!s.portfolioIncluded && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>fora do portfólio</span>}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
                    {s.canonicalProduct || s.revenueNature} · Billing: {s.billingStatus}
                    {s.fulfillment && s.fulfillment.status !== "COMPLETED" && ` · Entrega: ${s.fulfillment.status}`}
                  </p>
                  {s.contrato?.corpoGerado && (
                    <a href={`/api/contratos/${s.contrato.id}/pdf`} target="_blank" rel="noreferrer" className="text-[11px] underline inline-flex items-center gap-1 mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
                      <FileText className="w-3 h-3" /> Contrato{s.contrato.zohoId ? " (histórico Zoho)" : ""}
                    </a>
                  )}
                </div>
                <p className="text-[15px] font-bold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(s.currentRecurringValue)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "Financeiro" && <Cf2ClienteFinanceiro empresaId={empresa.id} />}

        {tab === "Atividades" && (
          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {timeline.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem histórico.</p>
            ) : timeline.slice(0, 40).map((n) => (
              <div key={n.id} className="text-[12px] p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <p style={{ color: "var(--cf2-text-primary)" }}>{n.conteudo.length > 240 ? n.conteudo.slice(0, 240) + "…" : n.conteudo}</p>
                <p className="mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>
                  {n.autorNome || "Sistema"}{n.pessoaNome ? ` · via ${n.pessoaNome}` : ""} · {new Date(n.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "Propostas" && (
          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {propostas.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta registrada.</p>
            ) : propostas.map((p) => (
              <Link key={p.id} href={`/propostas/${p.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--cf2-bg-surface-muted)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Proposta #{p.numero}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.valorTotal || "0")}</p>
                  <Cf2Badge variant={PROPOSTA_STATUS_BADGE[p.status] || "neutral"}>{p.status}</Cf2Badge>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "Documentos" && (
          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {/* Histórico Zoho (anexos_legado) + contratos com corpo gerado pela engine nova */}
            {servicos.filter((s) => s.contrato?.corpoGerado).map((s) => (
              <a key={`ct-${s.id}`} href={`/api/contratos/${s.contrato!.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--cf2-bg-surface-muted)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-secondary)" }} />
                <p className="flex-1 text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>Contrato — {FAMILIA_LABEL[s.serviceFamily] || s.serviceFamily}</p>
                <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              </a>
            ))}
            {documentos.isLoading ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando documentos...</p>
            ) : (documentos.data ?? []).length === 0 && servicos.every((s) => !s.contrato?.corpoGerado) ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum documento encontrado.</p>
            ) : (
              (documentos.data ?? []).map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-secondary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{d.nomeArquivo}</p>
                    <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {formatBytes(d.tamanhoBytes)}{d.zohoId ? " · histórico (Zoho)" : ""}{d.criadoEmOriginal ? ` · ${new Date(d.criadoEmOriginal).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                  {d.arquivoDisponivel ? (
                    <a href={`/api/anexos-legado/${d.id}/download`} className="p-1.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface)" }} title="Baixar">
                      <Download className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
                    </a>
                  ) : (
                    <span className="text-[10px] px-2 py-1 rounded-full shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }} title="Arquivo físico não disponível neste ambiente">indisponível</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
