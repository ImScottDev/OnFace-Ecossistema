"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, Check, X, Beaker, AlertTriangle, FileText, Download } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { digitsForDialer } from "@/lib/utils/callface-call";
import {
  PIPELINE_OPEN_COLS, MOTIVO_PERDA_ESTRUTURADO, proximoStatusReal, tempoNaEtapa,
  FAMILY_LABEL, resolvePropostaDisplay,
} from "./shared";

const brl = (v: string | null) => (parseFloat(v || "0") || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
import { Cf2NovaPropostaSlideOver } from "@/components/crm2/negocios/NovaPropostaSlideOver";

interface Lead { id: string; nome: string; email?: string | null; telefone?: string | null; empresa?: string | null; cargo?: string | null; camposCustom?: Record<string, unknown> | null }
interface Proposta { id: string; numero: number; versao: number; status: string; totalGeral: string; primeiraVisualizacaoEm: string | null; clienteRespondeuEm: string | null; dataValidade: string | null }
interface StatusChange { id: string; deStatus: string | null; paraStatus: string; motivo: string | null; createdAt: string; autorNome: string | null }
interface Atividade { id: string; tipo: string; titulo?: string | null; descricao?: string | null; createdAt: string }
interface Nota { id: string; conteudo: string; autorNome?: string | null; createdAt: string }
interface Reuniao { id: string; titulo: string; data: string; status: string }
interface Negocio {
  id: string; titulo: string; status: string; valorTotal: string | null; mrrEstimado: string | null; mrrFechado: string | null;
  serviceFamily: string | null; leadId: string | null; empresaId: string | null; responsavelId: string | null;
  previsaoFechamento: string | null; motivoPerda: string | null; createdAt: string; updatedAt: string;
}
interface Tarefa { id: string; titulo: string; dataVencimento: string | null; concluida: boolean }
interface AnexoLegado { id: string; nomeArquivo: string; tamanhoBytes: number | null; criadoEmOriginal: string | null; zohoId: string | null; arquivoDisponivel: boolean }

function formatBytesAnexo(bytes: number | null): string {
  if (!bytes) return "tamanho desconhecido";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TABS = ["Tudo", "Reuniões", "Ligações", "WhatsApp", "E-mails", "Notas", "Etapas"] as const;
type Tab = (typeof TABS)[number];

/**
 * Drawer de oportunidade (CRM2, spec+mockups do Kauã 17/08) — entidade é
 * NEGÓCIO, não lead. Todo o dado vem de `/api/negocios/:id` (endpoint já
 * riquíssimo: propostas/contratos/atividades/notas/reuniões/statusChanges/
 * oportunidadesIrmãs) + `/api/tarefas?negocioId=`. Escrita de etapa/perda
 * SEMPRE via `/api/negocios/:id` (PATCH) — nunca bypassa os gates reais
 * (evidência de Won, valor de proposta antes de Proposta Enviada).
 */
export function Cf2NegocioDrawer({ negocioId, open, onClose, onChanged }: { negocioId: string | null; open: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Tudo");
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [perderMenuOpen, setPerderMenuOpen] = useState(false);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [novaPropostaOpen, setNovaPropostaOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-detalhe", negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/negocios/${negocioId}`);
      if (!r.ok) throw new Error("Negócio não encontrado");
      return r.json() as Promise<{ negocio: Negocio; lead: Lead | null; empresa: { nome: string } | null; propostas: Proposta[]; atividades: Atividade[]; notas: Nota[]; reunioes: Reuniao[]; statusChanges: StatusChange[]; oportunidadesIrmas: { id: string; titulo: string; status: string }[] }>;
    },
    enabled: !!negocioId && open,
  });

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas", "negocio", negocioId],
    queryFn: async () => { const r = await fetch(`/api/tarefas?negocioId=${negocioId}`); if (!r.ok) return []; const j = await r.json(); return j.tarefas || []; },
    enabled: !!negocioId && open,
  });

  // Documentos históricos (Zoho) vinculados a este negócio — tabela
  // `anexos_legado`, achado real 18/08: 615 docs de negócio recuperados
  // da migração, sem superfície até aqui.
  const { data: anexosLegado = [] } = useQuery<AnexoLegado[]>({
    queryKey: ["anexos-legado", "negocio", negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/anexos-legado?entidadeTipo=negocio&entidadeId=${negocioId}`);
      if (!r.ok) return [];
      const j = await r.json();
      return j.anexos || [];
    },
    enabled: !!negocioId && open,
  });

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/negocios/${negocioId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "falha");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] }); onChanged(); setMoveMenuOpen(false); setPerderMenuOpen(false); setMotivoOutro(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas", "negocio", negocioId] }),
  });

  const negocio = data?.negocio;
  if (!negocio && !isLoading) return null;

  const lead = data?.lead;
  const tarefasAbertas = tarefas.filter((t) => !t.concluida);
  const proximaTarefa = [...tarefasAbertas].filter((t) => t.dataVencimento).sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())[0];
  const ultimaProposta = data?.propostas?.[0] || null;
  const qualif = (lead?.camposCustom?.qualificacaoSdr as Record<string, string>) || {};
  const isTrial = negocio?.status === "trial";
  const trialDesde = data?.statusChanges?.find((s) => s.paraStatus === "trial")?.createdAt;

  const footer = negocio && (
    <div className="p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "var(--cf2-bg-surface)", borderTop: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center gap-3 relative">
        <button onClick={() => setMoveMenuOpen((v) => !v)} className="flex items-center gap-2 h-10 px-3 rounded-xl text-[13px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          Mover etapa <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {moveMenuOpen && (
          <div className="absolute bottom-12 left-0 min-w-[180px] rounded-xl py-1 z-10" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.12)" }}>
            {PIPELINE_OPEN_COLS.map((s) => (
              <button key={s.key} onClick={() => patch.mutate({ status: s.dropTarget })} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <button onClick={() => setPerderMenuOpen((v) => !v)} className="text-[13px] font-bold" style={{ color: "#dc2626" }}>Perder</button>
          {perderMenuOpen && (
            <div className="absolute bottom-8 left-0 min-w-[240px] rounded-xl p-2 z-10 flex flex-col gap-1" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.12)" }}>
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
      </div>
      {(() => {
        const proximo = proximoStatusReal(negocio.status);
        if (!proximo) return null;
        return (
          <button onClick={() => patch.mutate({ status: proximo })} disabled={patch.isPending} className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-60" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            <Check className="w-4 h-4" /> Avançar →
          </button>
        );
      })()}
    </div>
  );

  const stage = negocio ? PIPELINE_OPEN_COLS.find((c) => c.keys.includes(negocio.status)) : null;

  // Ligar/WhatsApp/E-mail abrem em Atendimento (não link externo tel:/wa.me/
  // mailto:) — mesmo achado real 24/08 de todo o resto do CRM2: o telefone
  // vai em qualquer canal, é o que permite achar a conversa certa quando
  // `contatos.leadId` não está preenchido no banco.
  const telefoneDialer = lead?.telefone ? digitsForDialer(lead.telefone) : "";
  const atendimentoHref = (canal: "whatsapp" | "email" | "ligacao") => {
    if (!lead?.id) return undefined;
    const params = new URLSearchParams({ leadId: lead.id, canal });
    if (telefoneDialer) params.set("telefone", telefoneDialer);
    return `/atendimento?${params.toString()}`;
  };

  return (
    <>
    <DetailDrawer open={open && !!negocioId} onClose={onClose} bare panelBg="#ffffff" width="w-full sm:w-[500px]" footer={footer}>
      {isLoading && <div className="p-6 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</div>}
      {negocio && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{data?.empresa?.nome || negocio.titulo}</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>{lead ? `${lead.nome}${lead.cargo ? ` · ${lead.cargo}` : ""}` : "Sem contato vinculado"}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {negocio.serviceFamily && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{FAMILY_LABEL[negocio.serviceFamily] || negocio.serviceFamily}</span>}
              <span className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(negocio.mrrFechado || negocio.mrrEstimado || negocio.valorTotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              {stage && <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${stage.color}18`, color: stage.color }}>{stage.label}</span>}
              <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Tempo na etapa: {tempoNaEtapa(negocio.updatedAt)}</span>
            </div>
            <Link href={`/negocios/${negocioId}`} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Abrir oportunidade completa →</Link>
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Ações rápidas</p>
            <div className="flex gap-2 flex-wrap">
              <QuickAction icon={Phone} label="Ligar" href={lead?.telefone ? atendimentoHref("ligacao") : undefined} />
              <QuickAction icon={MessageCircle} label="WhatsApp" href={lead?.telefone ? atendimentoHref("whatsapp") : undefined} />
              <QuickAction icon={Mail} label="E-mail" href={lead?.email ? atendimentoHref("email") : undefined} />
              <QuickAction icon={Calendar} label="Agendar" onClick={() => setTarefaModalOpen(true)} />
              <QuickAction icon={Plus} label="Tarefa" onClick={() => setTarefaModalOpen(true)} />
            </div>
          </div>

          {/* Próxima ação — destaque, spec explícita */}
          <div className="p-4 rounded-2xl" style={proximaTarefa ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" } : { background: "var(--cf2-warning-bg)", border: "1px solid rgba(245,158,11,0.3)" }}>
            {proximaTarefa ? (
              <>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-success-text)" }}>Próxima ação</p>
                <p className="text-[14px] font-bold mt-0.5" style={{ color: "var(--cf2-text-primary)" }}>{proximaTarefa.titulo}</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}</p>
              </>
            ) : (
              <p className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: "var(--cf2-warning-text)" }}><AlertTriangle className="w-4 h-4" /> Nenhuma próxima ação definida</p>
            )}
          </div>

          {/* Jornada comercial */}
          <div className="flex items-center justify-between px-1">
            {PIPELINE_OPEN_COLS.concat([{ key: "ganho", label: "Ganho", color: "#22c55e", keys: ["ganho"], dropTarget: "ganho" }]).map((s) => {
              const ativo = stage?.key === s.key || (s.key === "ganho" && negocio.status === "ganho");
              const passou = stage ? PIPELINE_OPEN_COLS.findIndex((c) => c.key === s.key) < PIPELINE_OPEN_COLS.findIndex((c) => c.key === stage.key) : false;
              return (
                <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: ativo || passou ? s.color : "var(--cf2-border-default)" }} />
                  <span className="text-[10px] text-center" style={{ color: ativo ? s.color : "var(--cf2-text-tertiary)", fontWeight: ativo ? 700 : 400 }}>{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Resumo comercial */}
          <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Resumo comercial</p>
            <div className="flex flex-col gap-2 text-[12px]">
              <KV label="Necessidade/Dor" value={qualif.necessidadeDor || "—"} />
              <KV label="Decisor" value={lead?.nome || "—"} />
              <KV label="Data de entrada" value={new Date(negocio.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
              <KV label="Forecast" value={negocio.previsaoFechamento ? new Date(negocio.previsaoFechamento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
            </div>
          </div>

          {isTrial && (
            <div className="flex items-center gap-2 p-4 rounded-2xl" style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)" }}>
              <Beaker className="w-4 h-4 shrink-0" style={{ color: "#14B8A6" }} />
              <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>Trial ativo{trialDesde ? ` desde ${new Date(trialDesde).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
            </div>
          )}

          {/* Proposta */}
          <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Proposta</p>
              {!ultimaProposta && <button onClick={() => setNovaPropostaOpen(true)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>+ Criar proposta</button>}
            </div>
            {ultimaProposta ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}><FileText className="w-3.5 h-3.5" /> #{ultimaProposta.numero} · {brl(ultimaProposta.totalGeral)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{resolvePropostaDisplay(ultimaProposta).label}</p>
                </div>
                <a href={`/propostas?propostaId=${ultimaProposta.id}`} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Ver →</a>
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta criada.</p>
            )}
          </div>

          {/* Documentos — histórico Zoho (anexos_legado), achado real
              18/08. Baixa direto de ~/Downloads/Attachments, DEV-ONLY —
              ver aviso em src/lib/storage/legacy-attachment-storage.ts. */}
          {anexosLegado.length > 0 && (
            <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Documentos ({anexosLegado.length})</p>
              <div className="flex flex-col gap-1.5">
                {anexosLegado.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }} title={doc.nomeArquivo}>{doc.nomeArquivo}</p>
                        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatBytesAnexo(doc.tamanhoBytes)}</p>
                      </div>
                    </div>
                    {doc.arquivoDisponivel ? (
                      <a href={`/api/anexos-legado/${doc.id}/download`} className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: "var(--cf2-success-text)" }}>
                        <Download className="w-3 h-3" /> Baixar
                      </a>
                    ) : (
                      <span title="Arquivo físico não disponível neste ambiente" className="text-[11px] shrink-0 cursor-not-allowed" style={{ color: "var(--cf2-text-tertiary)" }}>
                        Indisponível
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Timeline unificada</p>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0" style={{ background: tab === t ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface)", color: tab === t ? "#ffffff" : "var(--cf2-text-secondary)", border: tab === t ? "none" : "1px solid var(--cf2-border-default)" }}>{t}</button>
              ))}
            </div>
            <TimelineFeed tab={tab} data={data} />
            {tarefasAbertas.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>Tarefas pendentes</p>
                {tarefasAbertas.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                    <button onClick={() => toggleTarefa.mutate({ id: t.id, concluida: true })} className="w-4 h-4 rounded-full shrink-0" style={{ border: "1px solid var(--cf2-border-default)" }} />
                    <p className="flex-1 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DetailDrawer>
    {negocioId && <TarefaFormModal open={tarefaModalOpen} onClose={() => setTarefaModalOpen(false)} defaultNegocioId={negocioId} defaultNegocioLabel={negocio?.titulo || null} defaultTipo="diagnostico" invalidateKeys={[["tarefas", "negocio", negocioId], ["pipeline-crm2-board"]]} />}
    {negocioId && novaPropostaOpen && <Cf2NovaPropostaSlideOver negocioId={negocioId} onClose={() => { setNovaPropostaOpen(false); qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] }); onChanged(); }} />}
    </>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold";
  const style = { border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <Link href={href} className={cls} style={style}><Icon className="w-4 h-4" /> {label}</Link>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-4 h-4" /> {label}</button>;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--cf2-text-tertiary)" }}>{label}</span>
      <span className="font-semibold text-right truncate max-w-[220px]" style={{ color: "var(--cf2-text-primary)" }}>{value}</span>
    </div>
  );
}

const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", reuniao: "Reunião" };

function TimelineFeed({ tab, data }: { tab: Tab; data: { atividades: Atividade[]; notas: Nota[]; reunioes: Reuniao[]; statusChanges: StatusChange[] } | undefined }) {
  if (!data) return null;
  const feed = [
    ...(tab === "Tudo" || tab === "Etapas" ? data.statusChanges.map((s) => ({ id: `sc-${s.id}`, tipo: "etapa", titulo: `${s.deStatus || "início"} → ${s.paraStatus}${s.motivo ? ` (${s.motivo})` : ""}`, createdAt: s.createdAt, autor: s.autorNome })) : []),
    ...(tab === "Tudo" || tab === "Reuniões" ? data.reunioes.map((r) => ({ id: `r-${r.id}`, tipo: "reuniao", titulo: `${r.titulo} — ${r.status}`, createdAt: r.data, autor: null })) : []),
    ...(tab === "Tudo" || tab === "Notas" ? data.notas.map((n) => ({ id: `n-${n.id}`, tipo: "nota", titulo: n.conteudo, createdAt: n.createdAt, autor: n.autorNome })) : []),
    ...(tab === "Tudo" || tab === "Ligações" || tab === "WhatsApp" || tab === "E-mails"
      ? data.atividades.filter((a) => tab === "Tudo" || (tab === "Ligações" && a.tipo === "ligacao") || (tab === "WhatsApp" && a.tipo === "whatsapp") || (tab === "E-mails" && a.tipo === "email")).map((a) => ({ id: `a-${a.id}`, tipo: a.tipo, titulo: a.titulo || TIPO_LABEL[a.tipo] || a.tipo, createdAt: a.createdAt, autor: null }))
      : []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (feed.length === 0) return <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada por aqui ainda.</p>;
  return (
    <div className="flex flex-col gap-2">
      {feed.map((e) => (
        <div key={e.id} className="flex flex-col gap-1 p-2.5 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(e.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}{e.autor ? ` · ${e.autor}` : ""}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
          </div>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{e.titulo}</p>
        </div>
      ))}
    </div>
  );
}
