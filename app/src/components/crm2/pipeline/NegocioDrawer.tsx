"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, Check, X, Beaker, AlertTriangle,
  FileText, Download, MoreHorizontal, NotebookPen, Send, ExternalLink,
} from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { digitsForDialer } from "@/lib/utils/callface-call";
import {
  PIPELINE_OPEN_COLS, MOTIVO_PERDA_ESTRUTURADO, proximoStatusReal, tempoNaEtapa,
  FAMILY_LABEL, resolvePropostaDisplay,
} from "./shared";
import { Section, PropertyRow } from "@/components/crm2/shared/DrawerSection";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger } from "@/components/crm2/ui/Tabs";
import {
  Cf2DropdownMenu, Cf2DropdownMenuContent, Cf2DropdownMenuItem, Cf2DropdownMenuTrigger,
} from "@/components/crm2/ui/DropdownMenu";

const brl = (v: string | null) => (parseFloat(v || "0") || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Chrome escuro não tem variante própria de success/warning legível em
// fundo escuro (mesmo achado já documentado em pipeline/Workspace.tsx) —
// reusa as mesmas 2 constantes dark-safe.
const SUCCESS_DARK = "#4ade80";
const WARNING_DARK = "#fbbf24";

interface Lead { id: string; nome: string; email?: string | null; telefone?: string | null; empresa?: string | null; cargo?: string | null; camposCustom?: Record<string, unknown> | null; stripeCustomerId?: string | null }
interface PropostaItem { id: string; nome: string; tipo: string; quantidade: string; subtotal: string }
interface Proposta { id: string; numero: number; versao: number; status: string; totalGeral: string; totalRecorrente: string | null; totalAvulso: string | null; primeiraVisualizacaoEm: string | null; clienteRespondeuEm: string | null; dataValidade: string | null; itens?: PropostaItem[]; condicaoPagamentoTipo?: string | null; parcelas?: number | null; moeda?: string }
interface Contrato { id: string; status: string; stripeSubscriptionId: string | null }
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
  const router = useRouter();
  const { usuarios: usuariosOrg } = useOrgUsuarios();
  // Tags da oportunidade (01/09, Frente 2A) — mesmos endpoints já usados no
  // lead (`/api/labels`, `/api/negocios/:id/labels`), mesma query key
  // ["labels"], cache compartilhado. Nenhum sistema paralelo de tag.
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  // Nova proposta = NAVEGAÇÃO, não slide-over (01/09, Frente 2A). Ver
  // comentário longo em `negocios/Workspace.tsx`: o painel antigo espremia a
  // tela inteira de composição de proposta num `max-w-2xl` e quebrava.
  const irParaNovaProposta = () => router.push(`/propostas/novo?negocioId=${negocioId}`);
  const [acoesMenuOpen, setAcoesMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (noteOpen) noteRef.current?.focus(); }, [noteOpen]);

  const [cobrancaOpen, setCobrancaOpen] = useState(false);
  const [cobrancaDescricao, setCobrancaDescricao] = useState("");
  const [cobrancaValor, setCobrancaValor] = useState("");
  const [cobrancaVencimento, setCobrancaVencimento] = useState("3");

  const cobrancaMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/negocios/${negocioId}/cobranca-avulsa`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: cobrancaDescricao, valor: Number(cobrancaValor), diasVencimento: Number(cobrancaVencimento) }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Erro ao gerar cobrança");
      return body as { hostedInvoiceUrl: string | null };
    },
    onSuccess: (res) => {
      toast.success("Cobrança avulsa gerada e enviada pelo Stripe");
      if (res.hostedInvoiceUrl) window.open(res.hostedInvoiceUrl, "_blank");
      setCobrancaOpen(false);
      setCobrancaDescricao(""); setCobrancaValor(""); setCobrancaVencimento("3");
      qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const parcelamentoMutation = useMutation({
    mutationFn: async () => {
      if (!propostaParcelavel) throw new Error("Nenhuma proposta parcelada vinculada");
      const r = await fetch(`/api/propostas/${propostaParcelavel.id}/gerar-parcelamento`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Erro ao gerar parcelamento");
      return body;
    },
    onSuccess: () => {
      toast.success("Parcelas restantes geradas no Stripe");
      qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-detalhe", negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/negocios/${negocioId}`);
      if (!r.ok) throw new Error("Negócio não encontrado");
      return r.json() as Promise<{ negocio: Negocio; lead: Lead | null; empresa: { nome: string } | null; propostas: Proposta[]; contratos: Contrato[]; atividades: Atividade[]; notas: Nota[]; reunioes: Reuniao[]; statusChanges: StatusChange[]; oportunidadesIrmas: { id: string; titulo: string; status: string }[] }>;
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

  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const r = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, negocioId }) });
      if (!r.ok) throw new Error("falha ao salvar nota");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] }); setNoteText(""); setNoteOpen(false); },
    onError: () => toast.error("Não foi possível salvar a nota"),
  });

  const { data: labelsNegocio = [], refetch: refetchLabels } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["negocio-labels", negocioId],
    queryFn: async () => { const r = await fetch(`/api/negocios/${negocioId}/labels`); if (!r.ok) return []; return r.json(); },
    enabled: !!negocioId && open,
  });

  const { data: labelsDisponiveis = [] } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["labels"],
    queryFn: async () => { const r = await fetch("/api/labels"); if (!r.ok) return []; return r.json(); },
    enabled: tagPopoverOpen,
  });

  const mudarTag = useMutation({
    mutationFn: async ({ labelId, acao }: { labelId: string; acao: "add" | "remove" }) => {
      const r = await fetch(`/api/negocios/${negocioId}/labels`, {
        method: acao === "add" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => { refetchLabels(); onChanged(); },
    onError: () => toast.error("Não foi possível atualizar a tag"),
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

  // Stripe (25/08, billing avançado) — link direto pro dashboard real (não
  // reconstrói nada do lado do CRM: ajuste de assentos/cartão/cancelamento
  // já existe no Customer Portal nativo do Stripe, só falta o atalho pra
  // achar o cliente certo) + cobrança avulsa / parcelamento restante via
  // Invoice API (ver stripe-invoice.ts). Assinatura vem do contrato mais
  // recente que já tem stripeSubscriptionId — pode não existir ainda.
  const stripeCustomerId = data?.lead?.stripeCustomerId || null;
  const stripeSubscriptionId = data?.contratos?.find((ct) => ct.stripeSubscriptionId)?.stripeSubscriptionId || null;
  const propostaParcelavel = data?.propostas?.find((p) => p.condicaoPagamentoTipo === "boleto_parcelado" && (p.parcelas || 1) > 1) || null;

  const footer = negocio && (
    <div className="p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "var(--cf2-chrome-bg-alt)", borderTop: "1px solid var(--cf2-chrome-border-subtle)" }}>
      <div className="flex items-center gap-3">
        <Cf2DropdownMenu open={moveMenuOpen} onOpenChange={setMoveMenuOpen}>
          <Cf2DropdownMenuTrigger asChild>
            <Cf2Button variant="ghost" className="gap-2" style={{ border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>
              Mover etapa <ChevronDown className="w-3.5 h-3.5" />
            </Cf2Button>
          </Cf2DropdownMenuTrigger>
          <Cf2DropdownMenuContent align="start" className="min-w-[180px]" style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
            {PIPELINE_OPEN_COLS.map((s) => (
              <Cf2DropdownMenuItem key={s.key} onClick={() => patch.mutate({ status: s.dropTarget })} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
              </Cf2DropdownMenuItem>
            ))}
          </Cf2DropdownMenuContent>
        </Cf2DropdownMenu>

        <Cf2DropdownMenu open={perderMenuOpen} onOpenChange={setPerderMenuOpen}>
          <Cf2DropdownMenuTrigger asChild>
            <Cf2Button variant="ghost" className="font-bold" style={{ color: "#f87171" }}>Perder</Cf2Button>
          </Cf2DropdownMenuTrigger>
          <Cf2DropdownMenuContent align="start" className="min-w-[240px]" style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
            {Object.entries(MOTIVO_PERDA_ESTRUTURADO).map(([statusKey, label]) => (
              <Cf2DropdownMenuItem key={statusKey} onClick={() => patch.mutate({ status: statusKey })} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>{label}</Cf2DropdownMenuItem>
            ))}
            <div className="h-px my-1" style={{ background: "var(--cf2-chrome-border-subtle)" }} />
            <div className="flex items-center gap-1.5 px-1 py-1">
              <input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Outro motivo..." aria-label="Outro motivo" className="flex-1 px-2 py-1 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }} />
              <button onClick={() => motivoOutro.trim() && patch.mutate({ status: "perdido", motivoPerda: motivoOutro.trim() })} disabled={!motivoOutro.trim()} className="text-[11px] font-bold px-2 py-1 rounded-lg disabled:opacity-40" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-primary)" }}>OK</button>
            </div>
          </Cf2DropdownMenuContent>
        </Cf2DropdownMenu>
      </div>
      {(() => {
        const proximo = proximoStatusReal(negocio.status);
        if (!proximo) return null;
        return (
          <Cf2Button onClick={() => patch.mutate({ status: proximo })} loading={patch.isPending} className="gap-2">
            <Check className="w-4 h-4" /> Avançar →
          </Cf2Button>
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
    <DetailDrawer open={open && !!negocioId} onClose={onClose} bare panelBg="var(--cf2-chrome-bg-alt)" borderColor="var(--cf2-chrome-border-subtle)" width="w-full sm:w-[500px]" footer={footer}>
      {isLoading && <div className="p-6 text-sm" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Carregando...</div>}
      {negocio && (
        <div className="flex flex-col gap-7 px-6 py-7">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[22px] font-semibold leading-tight" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{data?.empresa?.nome || negocio.titulo}</p>
              <button onClick={onClose} aria-label="Fechar oportunidade" className="rounded-md p-1.5 shrink-0 hover:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-secondary)" }}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{lead ? `${lead.nome}${lead.cargo ? ` · ${lead.cargo}` : ""}` : "Sem contato vinculado"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {stage && <span className="text-[12px] font-medium" style={{ color: stage.color }}>● {stage.label}</span>}
              {negocio.serviceFamily && <span className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>· {FAMILY_LABEL[negocio.serviceFamily] || negocio.serviceFamily}</span>}
              <span className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>· {tempoNaEtapa(negocio.updatedAt)} na etapa</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[15px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(negocio.mrrFechado || negocio.mrrEstimado || negocio.valorTotal)}</span>
              <Link href={`/negocios/${negocioId}`} className="text-[12px] font-medium" style={{ color: SUCCESS_DARK }}>Abrir oportunidade completa →</Link>
            </div>

            {/* Responsável e próxima ação (01/09, Frente 2A): eram os dois
                dados que o closer precisava e o drawer não mostrava — ficavam
                só no card do board ou na página completa. */}
            <div className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
              <span>Responsável: <strong style={{ color: "var(--cf2-chrome-text-primary)" }}>{usuariosOrg.find((u) => u.id === negocio.responsavelId)?.nome || "sem closer"}</strong></span>
              <span>
                Próxima ação:{" "}
                <strong style={{ color: proximaTarefa ? SUCCESS_DARK : "var(--cf2-chrome-text-secondary)" }}>
                  {proximaTarefa
                    ? `${proximaTarefa.titulo}${proximaTarefa.dataVencimento ? ` · ${new Date(proximaTarefa.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}`
                    : "nenhuma agendada"}
                </strong>
              </span>
            </div>

            {/* Tags — contexto, nunca substituto de etapa. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {labelsNegocio.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${l.cor} 18%, transparent)`, color: l.cor, border: `1px solid color-mix(in srgb, ${l.cor} 40%, transparent)` }}>
                  {l.nome}
                  <button onClick={() => mudarTag.mutate({ labelId: l.id, acao: "remove" })} aria-label={`Remover tag ${l.nome}`} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
                </span>
              ))}
              <div className="relative">
                <button onClick={() => setTagPopoverOpen((v) => !v)} aria-expanded={tagPopoverOpen} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ border: "1px dashed var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}>
                  <Plus className="w-3 h-3" /> Tag
                </button>
                {tagPopoverOpen && (
                  <div className="absolute z-30 mt-1 left-0 w-56 max-h-64 overflow-y-auto rounded-xl py-1" style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)", boxShadow: "0 8px 16px rgba(0,0,0,0.4)" }}>
                    {labelsDisponiveis.filter((l) => !labelsNegocio.some((x) => x.id === l.id)).length === 0 ? (
                      <p className="px-3 py-2 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma tag disponível.</p>
                    ) : labelsDisponiveis.filter((l) => !labelsNegocio.some((x) => x.id === l.id)).map((l) => (
                      <button key={l.id} onClick={() => { mudarTag.mutate({ labelId: l.id, acao: "add" }); setTagPopoverOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.cor }} /> {l.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <QuickAction icon={Phone} label="Ligar" href={lead?.telefone ? atendimentoHref("ligacao") : undefined} />
              <QuickAction icon={MessageCircle} label="WhatsApp" href={lead?.telefone ? atendimentoHref("whatsapp") : undefined} />
              <QuickAction icon={Mail} label="E-mail" href={lead?.email ? atendimentoHref("email") : undefined} />
              {/* Agendar/Tarefa/Nota entram no overflow — com as 3 ações de
                  contato mais o botão "..." tudo cabe numa linha só mesmo
                  no drawer estreito (500px); achado real 25/08: com os 5
                  botões antigos direto na linha, quebrava pra 2 linhas. */}
              <Cf2DropdownMenu open={acoesMenuOpen} onOpenChange={setAcoesMenuOpen}>
                <Cf2DropdownMenuTrigger asChild>
                  <button aria-label="Mais ações" className="flex items-center justify-center h-9 w-9 rounded-[var(--cf2-radius-md)] shrink-0 hover:bg-white/[0.06]" style={{ border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}>
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </Cf2DropdownMenuTrigger>
                <Cf2DropdownMenuContent align="end" className="min-w-[180px]" style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
                  <Cf2DropdownMenuItem onClick={() => setTarefaModalOpen(true)} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><Calendar className="w-3.5 h-3.5" /> Agendar</Cf2DropdownMenuItem>
                  <Cf2DropdownMenuItem onClick={() => setTarefaModalOpen(true)} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><Plus className="w-3.5 h-3.5" /> Tarefa</Cf2DropdownMenuItem>
                  <Cf2DropdownMenuItem onClick={() => { setTab("Notas"); setNoteOpen(true); }} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><NotebookPen className="w-3.5 h-3.5" /> Nota</Cf2DropdownMenuItem>
                  {/* Nova proposta SEMPRE disponível (01/09): antes só aparecia
                      na seção Proposta e apenas quando não existia proposta
                      nenhuma — não dava pra criar uma 2ª a partir do drawer. */}
                  <Cf2DropdownMenuItem onClick={irParaNovaProposta} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><FileText className="w-3.5 h-3.5" /> Nova proposta</Cf2DropdownMenuItem>
                  {(stripeCustomerId || stripeSubscriptionId || propostaParcelavel) && (
                    <div className="my-1 h-px" style={{ background: "var(--cf2-chrome-border-subtle)" }} />
                  )}
                  {stripeCustomerId && (
                    <Cf2DropdownMenuItem asChild className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                      <a href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Ver cliente no Stripe</a>
                    </Cf2DropdownMenuItem>
                  )}
                  {stripeSubscriptionId && (
                    <Cf2DropdownMenuItem asChild className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                      <a href={`https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Ver assinatura no Stripe</a>
                    </Cf2DropdownMenuItem>
                  )}
                  {stripeCustomerId && (
                    <Cf2DropdownMenuItem onClick={() => setCobrancaOpen(true)} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><Send className="w-3.5 h-3.5" /> Cobrança avulsa</Cf2DropdownMenuItem>
                  )}
                  {propostaParcelavel && (
                    <Cf2DropdownMenuItem onClick={() => parcelamentoMutation.mutate()} className="gap-2 data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}><Send className="w-3.5 h-3.5" /> Gerar parcelamento restante</Cf2DropdownMenuItem>
                  )}
                </Cf2DropdownMenuContent>
              </Cf2DropdownMenu>
            </div>
            {/* Próxima ação — único callout com cor de fundo que mantive: é
                alerta real (ação em aberto vs. nenhuma definida), não
                informação neutra — mesmo critério do resto do CRM2 de só
                usar cor com significado. */}
            <div className="flex items-center gap-2 rounded-[var(--cf2-radius-md)] px-3 py-2.5" style={proximaTarefa ? { background: "color-mix(in srgb, #4ade80 10%, transparent)" } : { background: "color-mix(in srgb, #fbbf24 10%, transparent)" }}>
              {proximaTarefa ? (
                <>
                  <Calendar className="w-4 h-4 shrink-0" style={{ color: SUCCESS_DARK }} />
                  <p className="text-[12px]" style={{ color: "var(--cf2-chrome-text-primary)" }}>{proximaTarefa.titulo} · {new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: WARNING_DARK }} />
                  <p className="text-[12px]" style={{ color: WARNING_DARK }}>Nenhuma próxima ação definida</p>
                </>
              )}
            </div>
          </div>

          <Cf2DarkCard>
            <Section title="Resumo comercial" dark>
              <div className="flex flex-col gap-2">
                <PropertyRow dark label="Necessidade/Dor" value={qualif.necessidadeDor || "—"} />
                <PropertyRow dark label="Decisor" value={lead?.nome || "—"} />
                <PropertyRow dark label="Data de entrada" value={new Date(negocio.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
                <PropertyRow dark label="Forecast" value={negocio.previsaoFechamento ? new Date(negocio.previsaoFechamento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
              </div>
            </Section>
          </Cf2DarkCard>

          {isTrial && (
            <div className="flex items-center gap-2 rounded-[var(--cf2-radius-md)] px-3 py-2.5" style={{ background: "color-mix(in srgb, #14B8A6 10%, transparent)" }}>
              <Beaker className="w-4 h-4 shrink-0" style={{ color: "#2dd4bf" }} />
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-primary)" }}>Trial ativo{trialDesde ? ` desde ${new Date(trialDesde).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
            </div>
          )}

          <Cf2DarkCard>
            <Section
              title="Proposta"
              dark
              action={!ultimaProposta ? { label: "+ Criar proposta", onClick: irParaNovaProposta } : undefined}
            >
              {ultimaProposta ? (
                <PropostaResumo proposta={ultimaProposta} />
              ) : (
                <p className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nenhuma proposta criada.</p>
              )}
            </Section>
          </Cf2DarkCard>

          {/* Documentos — histórico Zoho (anexos_legado), achado real
              18/08. Baixa direto de ~/Downloads/Attachments, DEV-ONLY —
              ver aviso em src/lib/storage/legacy-attachment-storage.ts. */}
          {anexosLegado.length > 0 && (
            <Cf2DarkCard>
              <Section title={`Documentos (${anexosLegado.length})`} dark>
                <div className="flex flex-col border-t" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                  {anexosLegado.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 h-10 border-b" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-chrome-text-secondary)" }} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: "var(--cf2-chrome-text-primary)" }} title={doc.nomeArquivo}>{doc.nomeArquivo}</p>
                        </div>
                        <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{formatBytesAnexo(doc.tamanhoBytes)}</span>
                      </div>
                      {doc.arquivoDisponivel ? (
                        <a href={`/api/anexos-legado/${doc.id}/download`} className="flex items-center gap-1 text-[11px] font-medium shrink-0" style={{ color: SUCCESS_DARK }}>
                          <Download className="w-3 h-3" /> Baixar
                        </a>
                      ) : (
                        <span title="Arquivo físico não disponível neste ambiente" className="text-[11px] shrink-0 cursor-not-allowed" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                          Indisponível
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </Cf2DarkCard>
          )}

          <Cf2DarkCard>
            <Section title="Timeline unificada" dark>
              <div className="flex flex-col gap-3">
                <Cf2Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                  <Cf2TabsList className="w-full flex-wrap justify-start overflow-x-auto" style={{ background: "rgba(255,255,255,0.06)" }}>
                    {TABS.map((t) => (
                      <Cf2TabsTrigger key={t} value={t} className="whitespace-nowrap data-[state=active]:bg-white/10 data-[state=active]:text-white" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{t}</Cf2TabsTrigger>
                    ))}
                  </Cf2TabsList>
                </Cf2Tabs>
                <TimelineFeed tab={tab} data={data} />
                {tab === "Notas" && (
                  <div className="pt-1 border-t" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                    {noteOpen ? (
                      <div className="flex flex-col gap-1.5 pt-3">
                        <textarea
                          ref={noteRef}
                          value={noteText}
                          onChange={(ev) => setNoteText(ev.target.value)}
                          placeholder="Escreva uma nota..." aria-label="Escreva uma nota"
                          rows={3}
                          className="w-full text-[13px] rounded-[var(--cf2-radius-sm)] px-3 py-2 outline-none resize-y"
                          style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
                          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); if (ev.key === "Escape") { setNoteOpen(false); setNoteText(""); } }}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setNoteOpen(false); setNoteText(""); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Cancelar</button>
                          <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: SUCCESS_DARK }}><Send className="w-3 h-3" /> Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1.5 text-[12px] pt-3 hover:text-white" style={{ color: "var(--cf2-chrome-text-secondary)" }}><Plus className="w-3.5 h-3.5" /> Adicionar nota</button>
                    )}
                  </div>
                )}
                {tarefasAbertas.length > 0 && (
                  <div className="flex flex-col border-t" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] pt-2 pb-1" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Tarefas pendentes</p>
                    {tarefasAbertas.map((t) => (
                      <div key={t.id} className="flex items-center gap-2.5 h-10 border-b" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                        <button onClick={() => toggleTarefa.mutate({ id: t.id, concluida: true })} className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: "1px solid var(--cf2-chrome-border-subtle)" }} />
                        <p className="flex-1 text-[13px] truncate" style={{ color: "var(--cf2-chrome-text-primary)" }}>{t.titulo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          </Cf2DarkCard>
        </div>
      )}
    </DetailDrawer>
    {negocioId && <TarefaFormModal open={tarefaModalOpen} onClose={() => setTarefaModalOpen(false)} defaultNegocioId={negocioId} defaultNegocioLabel={negocio?.titulo || null} defaultTipo="diagnostico" invalidateKeys={[["tarefas", "negocio", negocioId], ["pipeline-crm2-board"]]} />}
    {cobrancaOpen && (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setCobrancaOpen(false)}>
        <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Cobrança avulsa</p>
            <button onClick={() => setCobrancaOpen(false)} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
          </div>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Gera uma cobrança fora do ciclo da assinatura, cobrada direto no cliente Stripe já existente.</p>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Descrição</label>
            <input value={cobrancaDescricao} onChange={(e) => setCobrancaDescricao(e.target.value)} placeholder="Ex.: Ajuste de setup, usuário extra..." className="text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Valor (R$)</label>
              <input type="number" min={0} step="0.01" value={cobrancaValor} onChange={(e) => setCobrancaValor(e.target.value)} className="text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Vencimento (dias)</label>
              <input type="number" min={1} max={60} value={cobrancaVencimento} onChange={(e) => setCobrancaVencimento(e.target.value)} className="text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            </div>
          </div>
          <Cf2Button onClick={() => cobrancaMutation.mutate()} disabled={!cobrancaDescricao.trim() || !cobrancaValor || cobrancaMutation.isPending} className="mt-1">
            {cobrancaMutation.isPending ? "Gerando..." : "Gerar cobrança"}
          </Cf2Button>
        </div>
      </div>
    )}
    </>
  );
}

// Card escuro pra organizar visualmente cada bloco do drawer — achado real
// 25/08 (feedback do Kauã comparando com o drawer antigo do CRM legado):
// seções soltas sem nenhuma caixa ficaram "poluídas"/"bagunçadas" quando
// empilhadas muitas seguidas; uma caixa por bloco (sem virar tabela cheia
// de borda interna) resolve sem voltar ao visual antigo carregado.
function Cf2DarkCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--cf2-radius-md)] p-4" style={{ background: "var(--cf2-chrome-surface-active)" }}>
      {children}
    </div>
  );
}

// Resumo itemizado da proposta — mesmo formato que o drawer antigo (ver
// components/crm/NegocioDrawer.tsx) que o Kauã pediu de volta: item a item,
// depois "Rec: X/mês · Avulso: Y" e "Total: Z", com link pra proposta cheia.
function PropostaResumo({ proposta }: { proposta: Proposta }) {
  const display = resolvePropostaDisplay(proposta);
  const tomColor: Record<string, string> = { success: SUCCESS_DARK, danger: "#f87171", warning: WARNING_DARK, neutral: "var(--cf2-chrome-text-secondary)" };
  const rec = parseFloat(proposta.totalRecorrente || "0") || 0;
  const avulso = parseFloat(proposta.totalAvulso || "0") || 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium font-mono" style={{ color: "var(--cf2-chrome-text-primary)" }}>#P-{String(proposta.numero).padStart(3, "0")}-v{proposta.versao}</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: `color-mix(in srgb, ${tomColor[display.tom]} 18%, transparent)`, color: tomColor[display.tom] }}>{display.label}</span>
      </div>
      {proposta.itens && proposta.itens.length > 0 && (
        <div className="flex flex-col gap-1">
          {proposta.itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{item.nome}</span>
              <span className="shrink-0" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(item.subtotal)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t text-[12px]" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
        <span style={{ color: "var(--cf2-chrome-text-secondary)" }}>
          {rec > 0 && `Rec: ${brl(proposta.totalRecorrente)}/mês`}
          {rec > 0 && avulso > 0 && " · "}
          {avulso > 0 && `Avulso: ${brl(proposta.totalAvulso)}`}
        </span>
        <span className="font-semibold shrink-0" style={{ color: "var(--cf2-chrome-text-primary)" }}>Total: {brl(proposta.totalGeral)}</span>
      </div>
      <Link href={`/propostas/${proposta.id}`} className="text-[12px] font-medium text-center" style={{ color: SUCCESS_DARK }}>Ver proposta completa</Link>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex items-center justify-center gap-1.5 h-9 px-3 rounded-[var(--cf2-radius-md)] text-[13px] font-medium transition-colors hover:bg-white/[0.06]";
  const style = { border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <Link href={href} className={cls} style={style}><Icon className="w-4 h-4" /> {label}</Link>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-4 h-4" /> {label}</button>;
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

  if (feed.length === 0) return <p className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Nada por aqui ainda.</p>;
  return (
    <div className="flex flex-col">
      {feed.map((e) => (
        <div key={e.id} className="flex flex-col gap-1 py-2.5 border-b" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{new Date(e.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}{e.autor ? ` · ${e.autor}` : ""}</span>
            <span className="text-[10px] font-semibold" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
          </div>
          <p className="text-[12px]" style={{ color: "var(--cf2-chrome-text-primary)" }}>{e.titulo}</p>
        </div>
      ))}
    </div>
  );
}
