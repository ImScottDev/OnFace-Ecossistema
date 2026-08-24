"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus, Phone, Mail, MessageCircle, Building2, User, CalendarClock, FileText, ChevronRight, ChevronDown,
  Check, History, ShieldCheck, AlertTriangle, Beaker, Calendar,
} from "lucide-react";
import { Cf2Card, Cf2SectionHeader, Cf2Eyebrow } from "@/components/crm2/ui/Card";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState, Cf2PermissionDenied } from "@/components/crm2/ui/States";
import { Cf2NovaPropostaSlideOver } from "@/components/crm2/negocios/NovaPropostaSlideOver";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { PIPELINE_OPEN_COLS, MOTIVO_PERDA_ESTRUTURADO, proximoStatusReal, tempoNaEtapa } from "@/components/crm2/pipeline/shared";

const brl = (v: string | number | null | undefined) =>
  parseFloat(String(v || "0")).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FAMILY_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
const NATURE_LABEL: Record<string, string> = { MRR: "Recorrente (MRR)", SETUP: "Setup", PROJECT: "Projeto", ONE_TIME: "Avulso", USAGE: "Uso", HARDWARE: "Hardware", UNKNOWN: "Não classificado" };
const NATURE_VARIANT: Record<string, "success" | "warning" | "neutral"> = { MRR: "success", SETUP: "warning", PROJECT: "warning", ONE_TIME: "neutral", USAGE: "neutral", HARDWARE: "neutral", UNKNOWN: "neutral" };
const MODEL_LABEL: Record<string, string> = { PAGAMENTO_DIRETO: "Pagamento direto", CONTRATO_OBRIGATORIO: "Contrato obrigatório", CONTRATO_FIDELIDADE_OPCIONAL: "Contrato com fidelidade" };
const GRUPO_STATUS_LABEL: Record<string, string> = {
  aguardando_aceite: "Aguardando aceite", aguardando_contrato: "Preparando contrato", contrato_enviado_assinatura: "Aguardando assinatura",
  contrato_assinado: "Contrato assinado", aguardando_checkout: "Preparando pagamento", checkout_gerado: "Aguardando pagamento",
  pagamento_pendente: "Pagamento em processamento", pago: "Pago", concluido: "Concluído", falhou: "Falhou",
};
const GRUPO_STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  aguardando_aceite: "neutral", aguardando_contrato: "neutral", contrato_enviado_assinatura: "warning",
  contrato_assinado: "success", aguardando_checkout: "neutral", checkout_gerado: "warning",
  pagamento_pendente: "warning", pago: "success", concluido: "success", falhou: "danger",
};

interface OportunidadeItem {
  id: string; produto: string | null; serviceFamily: string; revenueNature: string;
  quantidade: string; valorTotal: string; servicoCanonicoId: string | null;
}
interface Evidencia { id: string; tipo: string; sourceRef: string | null; verificadoEm: string; verificadoPor: string | null }
interface GrupoComercial { id: string; commercialModel: string; status: string }
interface OportunidadeIrma { id: string; titulo: string; status: string; valorTotal: string | null; mrrFechado: string | null; mrrEstimado: string | null }
interface Tarefa { id: string; titulo: string; dataVencimento: string | null; concluida: boolean }

/**
 * Página completa da oportunidade (spec+mockups do Kauã, 17/08). Reaproveita
 * 100% da lógica comercial real que já existia aqui (Composição Comercial/
 * Fulfillment/Evidências Won/Oportunidades Irmãs/Nova Proposta — Commercial
 * Core v2/v3, ADR-EXEC-020/021/022) — nenhuma dessas seções está no mockup
 * mas são reais e continuam. O que muda: App Shell (breadcrumb+faixa de
 * ação, mesmo padrão de `Cf2LeadPaginaCompleta`), + Próxima Ação/Jornada
 * Comercial/Trial/Tarefas Pendentes/Dados do Contato, e a barra de rodapé
 * (Mover etapa/Perder/Avançar) substitui o antigo par "Marcar ganho/Marcar
 * perdido" com motivo via `window.prompt` — mesmos gates reais do endpoint
 * (`/api/negocios/:id` PATCH), só a UI virou séria.
 */
export function Cf2NegocioWorkspace({ negocioId }: { negocioId: string }) {
  const qc = useQueryClient();
  const [novaPropostaAberta, setNovaPropostaAberta] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [perderMenuOpen, setPerderMenuOpen] = useState(false);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["negocio-detalhe", negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/negocios/${negocioId}`);
      if (r.status === 403) throw Object.assign(new Error("Sem permissão"), { permissionDenied: true });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Não foi possível carregar o negócio.");
      return r.json();
    },
  });

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas", "negocio", negocioId],
    queryFn: async () => { const r = await fetch(`/api/tarefas?negocioId=${negocioId}`); if (!r.ok) return []; const j = await r.json(); return j.tarefas || []; },
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas", "negocio", negocioId] }),
  });

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/negocios/${negocioId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Falha ao atualizar status.");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] }); setMoveMenuOpen(false); setPerderMenuOpen(false); setMotivoOutro(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="page-scroll space-y-3">
        <Cf2Skeleton className="h-10 w-64" />
        <Cf2Skeleton className="h-32 w-full" />
        <Cf2Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    if ((error as { permissionDenied?: boolean })?.permissionDenied) {
      return <div className="page-scroll"><Cf2PermissionDenied message="Você não tem permissão para ver este negócio." /></div>;
    }
    return <div className="page-scroll"><Cf2ErrorState message={(error as Error).message} /></div>;
  }

  if (!data?.negocio) {
    return <div className="page-scroll"><Cf2EmptyState title="Negócio não encontrado" description="Ele pode ter sido removido ou o link está errado." /></div>;
  }

  const { negocio, lead, empresa, propostas, atividades, reunioes, statusChanges, comercial } = data;
  const itens: OportunidadeItem[] = comercial?.itens ?? [];
  const evidencias: Evidencia[] = comercial?.evidencias ?? [];
  const grupos: GrupoComercial[] = comercial?.grupos ?? [];
  const oportunidadesIrmas: OportunidadeIrma[] = data.oportunidadesIrmas ?? [];
  const jaGanho = negocio.status === "ganho";
  const jaPerdido = negocio.status === "perdido";
  const stage = PIPELINE_OPEN_COLS.find((c) => c.keys.includes(negocio.status));
  const proximoStatus = proximoStatusReal(negocio.status);
  const isTrial = negocio.status === "trial";
  const trialDesde = statusChanges?.find((s: { paraStatus: string }) => s.paraStatus === "trial")?.createdAt as string | undefined;
  const tarefasAbertas = tarefas.filter((t) => !t.concluida);
  const proximaTarefa = [...tarefasAbertas].filter((t) => t.dataVencimento).sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())[0];

  // Ligar/WhatsApp/E-mail abrem em Atendimento (não link externo tel:/wa.me/
  // mailto:) — mesmo achado real 24/08 de todo o resto do CRM2.
  const telefoneDialer = lead?.telefone ? digitsForDialer(lead.telefone) : "";
  const atendimentoHref = (canal: "whatsapp" | "email" | "ligacao") => {
    if (!lead?.id) return undefined;
    const params = new URLSearchParams({ leadId: lead.id, canal });
    if (telefoneDialer) params.set("telefone", telefoneDialer);
    return `/atendimento?${params.toString()}`;
  };

  const itensPorFamilia = itens.reduce<Record<string, OportunidadeItem[]>>((acc, item) => {
    (acc[item.serviceFamily] ||= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <div className="-m-6 mb-0 flex flex-col">
        <div className="rounded-tl-2xl px-8 pt-7 pb-5" style={{ background: "var(--cf2-bg-canvas)" }}>
          <Cf2Topbar orgNome="Callface" variant="light" title="Vendas" subtitle="Pipeline comercial — oportunidades reais, do primeiro contato ao contrato" />
        </div>

        <div className="px-8 py-6 flex flex-col gap-4" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
            <Link href="/vendas" className="hover:underline">Vendas</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/pipeline" className="hover:underline">Pipeline</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "var(--cf2-chrome-text-primary)" }}>{empresa?.nome || negocio.titulo}</span>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-[26px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{empresa?.nome || negocio.titulo}</p>
                {stage && <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${stage.color}22`, color: stage.color }}>{stage.label}</span>}
                {jaGanho && <Cf2Badge variant="success">Ganho</Cf2Badge>}
                {jaPerdido && <Cf2Badge variant="danger">Perdido</Cf2Badge>}
                {negocio.serviceFamily && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>{FAMILY_LABEL[negocio.serviceFamily] || negocio.serviceFamily}</span>}
              </div>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead?.nome || "Sem contato vinculado"}{(negocio.mrrFechado || negocio.mrrEstimado) ? ` · MRR ${brl(negocio.mrrFechado || negocio.mrrEstimado)}` : ""}{negocio.valorSetup && parseFloat(negocio.valorSetup) > 0 ? ` · Setup ${brl(negocio.valorSetup)}` : ""} · Tempo na etapa: {tempoNaEtapa(negocio.updatedAt)}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <HeaderAction icon={Phone} label="Ligar" href={lead?.telefone && lead.id ? atendimentoHref("ligacao") : undefined} />
                <HeaderAction icon={MessageCircle} label="WhatsApp" href={lead?.telefone && lead.id ? atendimentoHref("whatsapp") : undefined} />
                <HeaderAction icon={Mail} label="E-mail" href={lead?.email && lead.id ? atendimentoHref("email") : undefined} />
                <HeaderAction icon={Calendar} label="Agendar" onClick={() => setTarefaModalOpen(true)} />
                <HeaderAction icon={Plus} label="Tarefa" onClick={() => setTarefaModalOpen(true)} />
                <HeaderAction icon={FileText} label="Nova proposta" onClick={() => setNovaPropostaAberta(true)} accent />
              </div>
            </div>
          </div>

          {!jaGanho && !jaPerdido && (
            <div className="flex items-center gap-4 relative">
              <button onClick={() => setMoveMenuOpen((v) => !v)} className="flex items-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-semibold" style={{ background: "var(--cf2-bg-canvas)", color: "var(--cf2-text-primary)" }}>
                Mover etapa <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {moveMenuOpen && (
                <div className="absolute top-12 left-0 min-w-[180px] rounded-xl py-1 z-10" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.2)" }}>
                  {PIPELINE_OPEN_COLS.map((s) => (
                    <button key={s.key} onClick={() => patch.mutate({ status: s.dropTarget })} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <button onClick={() => setPerderMenuOpen((v) => !v)} className="text-[13px] font-bold" style={{ color: "#f87171" }}>Perder Oportunidade</button>
                {perderMenuOpen && (
                  <div className="absolute top-8 left-0 min-w-[240px] rounded-xl p-2 z-10 flex flex-col gap-1" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.2)" }}>
                    {Object.entries(MOTIVO_PERDA_ESTRUTURADO).map(([statusKey, label]) => (
                      <button key={statusKey} onClick={() => patch.mutate({ status: statusKey })} className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{label}</button>
                    ))}
                    <div className="h-px my-1" style={{ background: "var(--cf2-border-default)" }} />
                    <div className="flex items-center gap-1.5 px-1">
                      <input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} placeholder="Outro motivo..." className="flex-1 px-2 py-1 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      <button onClick={() => motivoOutro.trim() && patch.mutate({ status: "perdido", motivoPerda: motivoOutro.trim() })} disabled={!motivoOutro.trim()} className="text-[11px] font-bold px-2 py-1 rounded-lg disabled:opacity-40" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>OK</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1" />
              {proximoStatus && (
                <button onClick={() => patch.mutate({ status: proximoStatus })} disabled={patch.isPending} className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-60" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
                  <Check className="w-4 h-4" /> Avançar etapa →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-8 space-y-4 pb-16">
      {/* Oportunidades irmãs (ADR-EXEC-022) — mesma negociação, linhas
          comerciais independentes, resultado próprio de cada uma. Agregação,
          nunca status: "1 de 2 ganhas" é informativo, não define nada aqui. */}
      {oportunidadesIrmas.length > 0 && (
        <div className="p-3 rounded-lg flex items-center gap-2 flex-wrap" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Esta negociação também inclui:</span>
          {oportunidadesIrmas.map((o) => (
            <Link key={o.id} href={`/negocios/${o.id}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <span className="text-[12px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{o.titulo}</span>
              <Cf2Badge variant={o.status === "ganho" ? "success" : o.status === "perdido" ? "danger" : "neutral"}>{o.status}</Cf2Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Próxima ação — destaque, spec explícita */}
          <div className="p-4 rounded-2xl" style={proximaTarefa ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" } : { background: "var(--cf2-warning-bg)", border: "1px solid rgba(245,158,11,0.3)" }}>
            {proximaTarefa ? (
              <>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-success-text)" }}>Próxima Ação Mapeada</p>
                <p className="text-[14px] font-bold mt-0.5" style={{ color: "var(--cf2-text-primary)" }}>{proximaTarefa.titulo}</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}</p>
              </>
            ) : (
              <p className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: "var(--cf2-warning-text)" }}><AlertTriangle className="w-4 h-4" /> Nenhuma próxima ação definida</p>
            )}
          </div>

          {/* Jornada comercial */}
          <Cf2Card>
            <Cf2SectionHeader title="Jornada comercial" />
            <div className="mt-3 flex items-center justify-between px-1">
              {PIPELINE_OPEN_COLS.concat([{ key: "ganho", label: "Ganho", color: "#22c55e", keys: ["ganho"], dropTarget: "ganho" }]).map((s) => {
                const ativo = stage?.key === s.key || (s.key === "ganho" && jaGanho);
                const passou = stage ? PIPELINE_OPEN_COLS.findIndex((c) => c.key === s.key) < PIPELINE_OPEN_COLS.findIndex((c) => c.key === stage.key) : false;
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ativo || passou ? s.color : "var(--cf2-border-default)" }} />
                    <span className="text-[11px] text-center" style={{ color: ativo ? s.color : "var(--cf2-text-tertiary)", fontWeight: ativo ? 700 : 400 }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </Cf2Card>

          {isTrial && (
            <div className="flex items-center gap-2 p-4 rounded-2xl" style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)" }}>
              <Beaker className="w-4 h-4 shrink-0" style={{ color: "#14B8A6" }} />
              <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>Trial ativo{trialDesde ? ` desde ${new Date(trialDesde).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
            </div>
          )}

          {/* Composição comercial — ADR-EXEC-020: 1 negócio, N itens, família/natureza por item */}
          <Cf2Card>
            <Cf2SectionHeader title="Composição comercial" subtitle="O que está sendo vendido nesta oportunidade" />
            <div className="mt-3 space-y-3">
              {itens.length === 0 ? (
                <Cf2EmptyState title="Sem itens ainda" description="Crie uma proposta pra definir a composição comercial deste negócio." />
              ) : (
                Object.entries(itensPorFamilia).map(([familia, itensDaFamilia]) => (
                  <div key={familia}>
                    <Cf2Eyebrow>{FAMILY_LABEL[familia] || familia}</Cf2Eyebrow>
                    <div className="mt-1.5 space-y-1.5">
                      {itensDaFamilia.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.produto || "Item sem nome"}</span>
                            <Cf2Badge variant={NATURE_VARIANT[item.revenueNature] || "neutral"}>{NATURE_LABEL[item.revenueNature] || item.revenueNature}</Cf2Badge>
                            {item.servicoCanonicoId && (
                              <span title="Serviço canônico ativado">
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-accent-border)" }} />
                              </span>
                            )}
                          </div>
                          <span className="text-[13px] font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(item.valorTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Cf2Card>

          {/* Fulfillment por grupo comercial — ADR-EXEC-021: venda mista tem
              estados INDEPENDENTES (AI pago não precisa esperar PABX assinar). */}
          {grupos.length > 0 && (
            <Cf2Card>
              <Cf2SectionHeader title="Fulfillment" subtitle="Estado de cada composição comercial, independente entre si" />
              <div className="mt-3 space-y-1.5">
                {grupos.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <span className="text-[13px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{MODEL_LABEL[g.commercialModel] || g.commercialModel}</span>
                    <Cf2Badge variant={GRUPO_STATUS_VARIANT[g.status] || "neutral"}>{GRUPO_STATUS_LABEL[g.status] || g.status}</Cf2Badge>
                  </div>
                ))}
              </div>
            </Cf2Card>
          )}

          {/* Propostas */}
          <Cf2Card>
            <Cf2SectionHeader title="Propostas" />
            <div className="mt-3 space-y-1.5">
              {propostas?.length === 0 && <Cf2EmptyState title="Nenhuma proposta ainda" />}
              {propostas?.map((p: { id: string; numero: number; versao: number; status: string; totalGeral: string }) => (
                <Link key={p.id} href={`/propostas?propostaId=${p.id}`} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}>
                    <FileText className="w-3.5 h-3.5" /> #P-{String(p.numero).padStart(3, "0")}-v{p.versao}
                  </span>
                  <div className="flex items-center gap-2">
                    <Cf2Badge variant={p.status === "aceita" ? "success" : p.status === "recusada" ? "danger" : "neutral"}>{p.status}</Cf2Badge>
                    <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{brl(p.totalGeral)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Cf2Card>

          {/* Atividades */}
          <Cf2Card>
            <Cf2SectionHeader title="Atividades" />
            <div className="mt-3 space-y-1.5">
              {atividades?.length === 0 && <Cf2EmptyState title="Sem atividades registradas" />}
              {atividades?.slice(0, 15).map((a: { id: string; titulo: string; descricao: string | null; createdAt: string }) => (
                <div key={a.id} className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <p className="text-[13px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{a.titulo}</p>
                  {a.descricao && <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{a.descricao}</p>}
                </div>
              ))}
            </div>
          </Cf2Card>

          {/* Reuniões */}
          <Cf2Card>
            <Cf2SectionHeader title="Reuniões" />
            <div className="mt-3 space-y-1.5">
              {reunioes?.length === 0 && <Cf2EmptyState title="Sem reuniões agendadas" />}
              {reunioes?.map((r: { id: string; titulo: string; data: string; status: string }) => (
                <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <span className="text-[13px] flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}><CalendarClock className="w-3.5 h-3.5" /> {r.titulo}</span>
                  <Cf2Badge variant={r.status === "realizada" ? "success" : "neutral"}>{r.status}</Cf2Badge>
                </div>
              ))}
            </div>
          </Cf2Card>
        </div>

        <div className="space-y-4">
          {/* Tarefas pendentes */}
          <Cf2Card>
            <div className="flex items-center justify-between">
              <Cf2SectionHeader title="Tarefas pendentes" />
              <button onClick={() => setTarefaModalOpen(true)} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>+ Nova tarefa</button>
            </div>
            <div className="mt-3 space-y-1.5">
              {tarefasAbertas.length === 0 && <Cf2EmptyState title="Nenhuma tarefa em aberto" />}
              {tarefasAbertas.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <button onClick={() => toggleTarefa.mutate({ id: t.id, concluida: true })} className="w-4 h-4 rounded-full shrink-0" style={{ border: "1px solid var(--cf2-border-default)" }} />
                  <p className="flex-1 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                  {t.dataVencimento && <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(t.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                </div>
              ))}
            </div>
          </Cf2Card>

          {/* Dados do contato/empresa */}
          <Cf2Card>
            <Cf2SectionHeader title="Dados do contato" />
            <div className="mt-3 space-y-2 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>
              {lead && (
                <>
                  <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{lead.nome}{lead.cargo ? ` · ${lead.cargo}` : ""}</p>
                  {lead.telefone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{lead.telefone}</p>}
                  {lead.email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{lead.email}</p>}
                  {lead.empresaCnpj && <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />CNPJ {lead.empresaCnpj}</p>}
                  <Link href={`/contatos/${lead.id}`} className="text-[12px] underline" style={{ color: "var(--cf2-text-secondary)" }}>Ver perfil completo</Link>
                </>
              )}
              {empresa && <p className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}><Building2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{empresa.nome}</p>}
              {!lead && !empresa && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem contato vinculado.</p>}
            </div>
          </Cf2Card>

          {/* Comunicação — bridge pro módulo de Atendimento já existente */}
          <Cf2Card>
            <Cf2SectionHeader title="Comunicação" />
            <div className="mt-3">
              {lead ? (
                <Link href={`/atendimento?leadId=${lead.id}`} className="text-[13px] underline" style={{ color: "var(--cf2-accent-border)" }}>Ver conversas (WhatsApp/e-mail/ligações)</Link>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem contato vinculado pra abrir conversas.</p>
              )}
            </div>
          </Cf2Card>

          {/* Evidências Won */}
          <Cf2Card>
            <Cf2SectionHeader title="Evidências de fechamento" subtitle="Commercial Evidence Policy" />
            <div className="mt-3 space-y-1.5">
              {evidencias.length === 0 && <Cf2EmptyState title="Nenhuma evidência registrada" description="Sem evidência válida, este negócio não pode ser marcado como ganho." />}
              {evidencias.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <span className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{e.tipo}</span>
                  <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(e.verificadoEm).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </Cf2Card>

          {/* Histórico */}
          <Cf2Card>
            <Cf2SectionHeader title="Histórico" />
            <div className="mt-3 space-y-1.5">
              {statusChanges?.length === 0 && <Cf2EmptyState title="Sem histórico ainda" />}
              {statusChanges?.map((s: { id: string; deStatus: string | null; paraStatus: string; createdAt: string; autorNome: string | null }) => (
                <div key={s.id} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                  <History className="w-3 h-3 shrink-0" />
                  <span>{s.deStatus || "início"} → {s.paraStatus}{s.autorNome ? ` · ${s.autorNome}` : ""}</span>
                </div>
              ))}
            </div>
          </Cf2Card>
        </div>
      </div>
      </div>

      {novaPropostaAberta && (
        <Cf2NovaPropostaSlideOver
          negocioId={negocioId}
          onClose={() => {
            setNovaPropostaAberta(false);
            qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] });
          }}
        />
      )}
      <TarefaFormModal
        open={tarefaModalOpen}
        onClose={() => setTarefaModalOpen(false)}
        defaultNegocioId={negocioId}
        defaultNegocioLabel={negocio.titulo}
        defaultTipo="diagnostico"
        invalidateKeys={[["tarefas", "negocio", negocioId]]}
      />
    </>
  );
}

function HeaderAction({ icon: Icon, label, href, onClick, accent }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void; accent?: boolean }) {
  const disabled = !href && !onClick;
  const cls = "flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold";
  const style = accent
    ? { background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)", opacity: disabled ? 0.4 : 1 }
    : { background: "var(--cf2-bg-canvas)", color: "var(--cf2-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <Link href={href} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</Link>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</button>;
}
