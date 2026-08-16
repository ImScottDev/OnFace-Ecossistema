"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Phone, Mail, Building2, User, CalendarClock, FileText, CheckCircle2, XCircle, History, ShieldCheck } from "lucide-react";
import { Cf2Card, Cf2SectionHeader, Cf2Eyebrow } from "@/components/crm2/ui/Card";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState, Cf2PermissionDenied } from "@/components/crm2/ui/States";
import { Cf2NovaPropostaSlideOver } from "@/components/crm2/negocios/NovaPropostaSlideOver";

const brl = (v: string | number | null | undefined) =>
  parseFloat(String(v || "0")).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FAMILY_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
const NATURE_LABEL: Record<string, string> = { MRR: "Recorrente (MRR)", SETUP: "Setup", PROJECT: "Projeto", ONE_TIME: "Avulso", USAGE: "Uso", HARDWARE: "Hardware", UNKNOWN: "Não classificado" };
const NATURE_VARIANT: Record<string, "success" | "warning" | "neutral"> = { MRR: "success", SETUP: "warning", PROJECT: "warning", ONE_TIME: "neutral", USAGE: "neutral", HARDWARE: "neutral", UNKNOWN: "neutral" };

interface OportunidadeItem {
  id: string; produto: string | null; serviceFamily: string; revenueNature: string;
  quantidade: string; valorTotal: string; servicoCanonicoId: string | null;
}
interface Evidencia { id: string; tipo: string; sourceRef: string | null; verificadoEm: string; verificadoPor: string | null }

export function Cf2NegocioWorkspace({ negocioId }: { negocioId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [novaPropostaAberta, setNovaPropostaAberta] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [erroWon, setErroWon] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["negocio-detalhe", negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/negocios/${negocioId}`);
      if (r.status === 403) throw Object.assign(new Error("Sem permissão"), { permissionDenied: true });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Não foi possível carregar o negócio.");
      return r.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: "ganho" | "perdido") => {
      setErroWon(null);
      const r = await fetch(`/api/negocios/${negocioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "perdido" ? { status, motivoPerda: motivoPerda || "Não informado" } : { status }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao atualizar status.");
      return body;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] }),
    onError: (e: Error) => setErroWon(e.message),
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
  const jaGanho = negocio.status === "ganho";
  const jaPerdido = negocio.status === "perdido";

  const itensPorFamilia = itens.reduce<Record<string, OportunidadeItem[]>>((acc, item) => {
    (acc[item.serviceFamily] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="page-scroll space-y-4 pb-16">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)" }}>{negocio.titulo}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Cf2Badge variant={jaGanho ? "success" : jaPerdido ? "danger" : "neutral"}>{negocio.status}</Cf2Badge>
              {(negocio.mrrFechado || negocio.mrrEstimado) && <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>MRR {brl(negocio.mrrFechado || negocio.mrrEstimado)}</span>}
              {negocio.valorSetup && parseFloat(negocio.valorSetup) > 0 && <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Setup {brl(negocio.valorSetup)}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setNovaPropostaAberta(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Nova proposta
          </button>
          {!jaGanho && !jaPerdido && (
            <>
              <button
                onClick={() => statusMutation.mutate("ganho")}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
                style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar ganho
              </button>
              <button
                onClick={() => { const m = window.prompt("Motivo da perda:"); if (m !== null) { setMotivoPerda(m); statusMutation.mutate("perdido"); } }}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
                style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
              >
                <XCircle className="w-3.5 h-3.5" /> Marcar perdido
              </button>
            </>
          )}
        </div>
      </div>

      {erroWon && (
        <div className="p-3 rounded-lg text-[13px]" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}>
          {erroWon}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
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

          {/* Propostas */}
          <Cf2Card>
            <Cf2SectionHeader title="Propostas" />
            <div className="mt-3 space-y-1.5">
              {propostas?.length === 0 && <Cf2EmptyState title="Nenhuma proposta ainda" />}
              {propostas?.map((p: { id: string; numero: number; versao: number; status: string; totalGeral: string }) => (
                <Link key={p.id} href={`/propostas/${p.id}`} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
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
          {/* Contato/empresa/responsável */}
          <Cf2Card>
            <Cf2SectionHeader title="Contato" />
            <div className="mt-3 space-y-2 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>
              {lead && (
                <>
                  <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{lead.nome}</p>
                  {lead.telefone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{lead.telefone}</p>}
                  {lead.email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />{lead.email}</p>}
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

      {novaPropostaAberta && (
        <Cf2NovaPropostaSlideOver
          negocioId={negocioId}
          onClose={() => {
            setNovaPropostaAberta(false);
            qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] });
          }}
        />
      )}
    </div>
  );
}
