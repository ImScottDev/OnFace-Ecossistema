"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus, Phone, Mail, MessageCircle, FileText, ChevronRight, ChevronDown,
  Check, ShieldCheck, AlertTriangle, Beaker, Calendar, NotebookPen, Send, Download, Clock,
  MoreHorizontal, Pencil, TrendingUp, Target, CheckCircle2, Circle, User, Paperclip, Trash2,
  Users, Package, Building2, Sparkles, ClipboardCheck, Megaphone, Tag as TagIcon, X,
} from "lucide-react";
import { Cf2Card, Cf2SectionHeader, Cf2Eyebrow } from "@/components/crm2/ui/Card";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState, Cf2PermissionDenied } from "@/components/crm2/ui/States";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger, Cf2TabsContent } from "@/components/crm2/ui/Tabs";
import { Cf2DropdownMenu, Cf2DropdownMenuTrigger, Cf2DropdownMenuContent, Cf2DropdownMenuItem } from "@/components/crm2/ui/DropdownMenu";
import { Cf2Sheet, Cf2SheetContent } from "@/components/crm2/ui/Sheet";
import { Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle } from "@/components/crm2/ui/Dialog";
import { OwnerPicker } from "@/components/crm2/prospeccao/OwnerPicker";
import { Section, PropertyRow } from "@/components/crm2/shared/DrawerSection";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { TarefaFormModal, type Tarefa } from "@/components/crm/tarefas/TarefaFormModal";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { derivarEstadoFechamento, ESTADO_FECHAMENTO_LABEL, ESTADO_FECHAMENTO_VARIANT } from "@/lib/crm/estado-fechamento";
import { Cf2CallDetail } from "@/components/crm2/atendimento/CallDetail";
import { iniciais, type ConversaItem } from "@/components/crm2/atendimento/types";
import {
  PIPELINE_OPEN_COLS, MOTIVO_PERDA_ESTRUTURADO, proximoStatusReal, tempoNaEtapa, resolvePropostaDisplay,
} from "@/components/crm2/pipeline/shared";

const brl = (v: string | number | null | undefined) =>
  parseFloat(String(v || "0")).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FAMILY_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
const NATURE_LABEL: Record<string, string> = { MRR: "Recorrente (MRR)", SETUP: "Setup", PROJECT: "Projeto", ONE_TIME: "Avulso", USAGE: "Uso", HARDWARE: "Hardware", UNKNOWN: "Não classificado" };
const NATURE_VARIANT: Record<string, "success" | "warning" | "neutral"> = { MRR: "success", SETUP: "warning", PROJECT: "warning", ONE_TIME: "neutral", USAGE: "neutral", HARDWARE: "neutral", UNKNOWN: "neutral" };
const MODEL_LABEL: Record<string, string> = { PAGAMENTO_DIRETO: "Pagamento direto", CONTRATO_OBRIGATORIO: "Contrato obrigatório", CONTRATO_FIDELIDADE_OPCIONAL: "Contrato com fidelidade" };
const PAPEL_LABEL: Record<string, string> = { contato: "Contato", decisor: "Decisor", influenciador: "Influenciador", tecnico: "Técnico" };
const PAPEL_VARIANT: Record<string, "success" | "warning" | "neutral" | "accent"> = { contato: "neutral", decisor: "accent", influenciador: "warning", tecnico: "neutral" };
const MOTION_LABEL: Record<string, string> = { NEW_BUSINESS: "Novo negócio", EXPANSION: "Expansão", RENEWAL: "Renovação", REACTIVATION: "Reativação" };
const TIPO_EVENTO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", reuniao: "Reunião", etapa: "Etapa", proposta: "Proposta", tarefa: "Tarefa" };
const HISTORICO_FILTROS = ["Tudo", "Etapas", "Ligações", "WhatsApp", "E-mails", "Propostas", "Notas", "Tarefas"] as const;
type HistoricoFiltro = (typeof HISTORICO_FILTROS)[number];

interface ContatoEnvolvido {
  id: string; nome: string; email: string | null; telefone: string | null; empresa: string | null; cargo: string | null;
  leadScore: number | null; tipo: string; papel: string | null;
}
interface OportunidadeItem {
  id: string; produto: string | null; serviceFamily: string; revenueNature: string;
  quantidade: string; valorTotal: string; servicoCanonicoId: string | null;
}
interface PropostaItemDetalhe { id: string; nome: string; tipo: string; quantidade: string; valorUnitario: string; desconto: string | null; subtotal: string }
interface PropostaCompleta {
  id: string; numero: number; versao: number; status: string; totalGeral: string; totalRecorrente: string | null; totalAvulso: string | null;
  dataEmissao: string | null; dataValidade: string | null; enviadaEm: string | null; primeiraVisualizacaoEm: string | null;
  ultimaVisualizacaoEm: string | null; visualizacoes: number; clienteRespondeuEm: string | null; motivoRecusa: string | null;
  negocioId?: string | null;
  itens?: PropostaItemDetalhe[];
}
interface Evidencia { id: string; tipo: string; sourceRef: string | null; verificadoEm: string; verificadoPor: string | null }
interface GrupoComercial {
  id: string; commercialModel: string; status: string;
  // Frente 2C.1 — o que permite mostrar o estado REAL de fechamento (família
  // decide a evidência; entrega liberada != pagamento confirmado).
  serviceFamily?: string | null;
  pagamentoStatus?: string | null;
  pagamentoVenceEm?: string | null;
  entregaLiberadaEm?: string | null;
  entregaLiberadaPor?: string | null;
  contratoAssinadoEm?: string | null;
  contratoId?: string | null;
}
interface OportunidadeIrma { id: string; titulo: string; status: string; valorTotal: string | null; mrrFechado: string | null; mrrEstimado: string | null }
interface Contrato { id: string; status: string; mrr: string | null; valorSetup: string | null; vencimento: string | null; produto: string | null }
interface Atividade { id: string; leadId: string; negocioId?: string | null; tipo: string; titulo: string | null; descricao: string | null; createdAt: string; dados?: { ligacaoId?: string; audioUrl?: string | null } | null; duracaoSegundos?: number | null }
interface Nota { id: string; conteudo: string; autorNome: string | null; createdAt: string; negocioId?: string | null }
interface Reuniao { id: string; titulo: string; data: string; status: string; transcript?: unknown; resumoTranscript?: string | null }
interface StatusChange { id: string; deStatus: string | null; paraStatus: string; motivo: string | null; createdAt: string; autorNome: string | null; negocioId?: string | null }
interface AnexoLegado { id: string; nomeArquivo: string; tamanhoBytes: number | null; arquivoDisponivel: boolean }
interface Anexo { id: string; nomeArquivo: string; url: string; tipoMime: string | null; tamanhoBytes: number | null; notaId: string | null; createdAt: string }
type EventoFeed = { id: string; tipo: string; titulo: string; data: string; autor: string | null; ref: Atividade | null };

interface PreviewArquivo { url: string; nome: string; tipo: "imagem" | "pdf" | "outro" }

// Preview inline (25/08, pedido do Kauã: "não só baixar") — imagem e PDF o
// navegador renderiza nativo (img/iframe), sem precisar de lib nenhuma;
// resto (doc/xls/zip) não tem como pré-visualizar sem um viewer de Office
// (fora do escopo de um time de 6 pessoas) — cai pra baixar mesmo, mas
// avisando explicitamente em vez de fingir que abriu.
function kindDeArquivo(nomeArquivo: string, tipoMime?: string | null): "imagem" | "pdf" | "outro" {
  if (tipoMime?.startsWith("image/")) return "imagem";
  if (tipoMime === "application/pdf") return "pdf";
  if (!tipoMime) {
    const ext = nomeArquivo.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return "imagem";
    if (ext === "pdf") return "pdf";
  }
  return "outro";
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ultimoContato(atividades: Atividade[], reunioes: Reuniao[], notas: Nota[]): { quando: string; canal: string } | null {
  const eventos: { data: string; canal: string }[] = [
    ...atividades.map((a) => ({ data: a.createdAt, canal: TIPO_EVENTO_LABEL[a.tipo] || a.tipo })),
    ...reunioes.map((r) => ({ data: r.data, canal: "Reunião" })),
    ...notas.map((n) => ({ data: n.createdAt, canal: "Nota" })),
  ].filter((e) => e.data);
  if (eventos.length === 0) return null;
  eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const mais = eventos[0];
  const dias = Math.floor((Date.now() - new Date(mais.data).getTime()) / 86_400_000);
  const quando = dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias}d`;
  return { quando, canal: mais.canal };
}

function tempoDesde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias < 1) return "hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
}

// Data + hora (25/08, pedido do Kauã: "melhorar data e hora" — antes as
// notas/timeline mostravam só o dia, sem horário, ruim pra reconstruir a
// sequência de um dia com várias interações).
function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Página completa da oportunidade — redesign 25/08 (pedido do Kauã: workspace
 * de verdade, não ficha). Reaproveita 100% da lógica comercial real que já
 * existia (Composição Comercial/Fulfillment/Evidências Won/Oportunidades
 * Irmãs — Commercial Core v2/v3, ADR-EXEC-020/021/022) e todos os endpoints
 * já existentes (`/api/negocios/:id`, `/api/tarefas`, `/api/notas`,
 * `/api/anexos-legado`, `/api/propostas/:id/pdf`) — nada de backend novo.
 *
 * Dois campos do brief NÃO existem como dado real e foram propositalmente
 * omitidos em vez de inventados: "probabilidade" (não existe coluna/regra
 * no schema) e "segmento" (idem). "Tempo no estágio vs média do time"
 * também foi omitido do bloco de Insights pelo mesmo motivo — não existe
 * agregado real pra comparar.
 */
export function Cf2NegocioWorkspace({ negocioId }: { negocioId: string }) {
  const qc = useQueryClient();
  const { usuarios, byId: usuariosById } = useOrgUsuarios();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [historicoFiltro, setHistoricoFiltro] = useState<HistoricoFiltro>("Tudo");
  const router = useRouter();
  /**
   * Nova proposta a partir da oportunidade (01/09, Frente 2A) — NAVEGA pra
   * `/propostas/novo?negocioId=...` em vez de abrir slide-over.
   *
   * O slide-over anterior (`Cf2NovaPropostaSlideOver`, removido) embutia o
   * `Cf2NovaPropostaWorkspace` inteiro — catálogo + carrinho + composição —
   * dentro de um painel `max-w-2xl`, e ainda reescrevia a query string da
   * página atual. Resultado: layout quebrado e contexto confuso. A tela de
   * nova proposta já sabe ler `negocioId` da query e, depois de salvar, volta
   * pra oportunidade de origem.
   */
  const irParaNovaProposta = () => router.push(`/propostas/novo?negocioId=${negocioId}`);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [perderMenuOpen, setPerderMenuOpen] = useState(false);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);
  const [editandoSobre, setEditandoSobre] = useState(false);
  const [sobreForm, setSobreForm] = useState({ titulo: "", descricao: "", responsavelId: "", previsaoFechamento: "" });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteArquivos, setNoteArquivos] = useState<File[]>([]);
  const [callSheet, setCallSheet] = useState<ConversaItem | null>(null);
  const [preview, setPreview] = useState<PreviewArquivo | null>(null);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

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
  const { data: tarefasConcluidas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas", "negocio", negocioId, "concluidas"],
    queryFn: async () => { const r = await fetch(`/api/tarefas?negocioId=${negocioId}&concluida=true`); if (!r.ok) return []; const j = await r.json(); return j.tarefas || []; },
    enabled: mostrarConcluidas,
  });
  const { data: anexosLegado = [] } = useQuery<AnexoLegado[]>({
    queryKey: ["anexos-legado", "negocio", negocioId],
    queryFn: async () => { const r = await fetch(`/api/anexos-legado?entidadeTipo=negocio&entidadeId=${negocioId}`); if (!r.ok) return []; const j = await r.json(); return j.anexos || []; },
  });
  // Anexos reais (upload de verdade, 25/08) — arquivo/imagem anexado numa
  // nota ou direto na aba Documentos, mesmo mecanismo do upload de avatar.
  const { data: anexosReais = [] } = useQuery<Anexo[]>({
    queryKey: ["anexos", "negocio", negocioId],
    queryFn: async () => { const r = await fetch(`/api/anexos?negocioId=${negocioId}`); if (!r.ok) return []; const j = await r.json(); return j.anexos || []; },
  });

  // Histórico/Notas "do lado do contato" (25/08, pedido do Kauã: ver dos 2
  // lados — o que é deste negócio e o que é do lead/cliente em geral,
  // incluindo outros negócios que ele já teve). `GET /api/leads/:id` já
  // devolve atividades/statusChanges/propostas do lead INTEIRO (sem filtro
  // de negócio) — mesmo endpoint que a página de contato usa, reaproveitado
  // aqui em vez de inventar uma 2ª query.
  const leadPrincipalId = data?.lead?.id as string | undefined;
  const { data: leadHistorico } = useQuery({
    queryKey: ["lead-historico-completo", leadPrincipalId],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadPrincipalId}`);
      if (!r.ok) return null;
      return r.json() as Promise<{ atividades: Atividade[]; statusChanges: StatusChange[]; propostas: PropostaCompleta[] }>;
    },
    enabled: !!leadPrincipalId,
  });
  const { data: notasDoContato = [] } = useQuery<Nota[]>({
    queryKey: ["notas-lead", leadPrincipalId],
    queryFn: async () => { const r = await fetch(`/api/notas?leadId=${leadPrincipalId}`); if (!r.ok) return []; return r.json(); },
    enabled: !!leadPrincipalId,
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tarefas", "negocio", negocioId] }); qc.invalidateQueries({ queryKey: ["tarefas", "negocio", negocioId, "concluidas"] }); },
  });

  async function uploadArquivo(file: File, notaId?: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("negocioId", negocioId);
    if (notaId) form.append("notaId", notaId);
    const r = await fetch("/api/anexos", { method: "POST", body: form });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `Falha ao enviar ${file.name}`);
  }

  const addNota = useMutation({
    mutationFn: async ({ conteudo, arquivos }: { conteudo: string; arquivos: File[] }) => {
      const r = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, negocioId }) });
      if (!r.ok) throw new Error("falha ao salvar nota");
      const nota = await r.json();
      for (const arquivo of arquivos) await uploadArquivo(arquivo, nota.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] });
      qc.invalidateQueries({ queryKey: ["anexos", "negocio", negocioId] });
      setNoteText(""); setNoteArquivos([]); setNoteOpen(false);
    },
    onError: () => toast.error("Não foi possível salvar a nota"),
  });

  const uploadDocumento = useMutation({
    mutationFn: async (file: File) => uploadArquivo(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["anexos", "negocio", negocioId] }); toast.success("Arquivo anexado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirAnexo = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/anexos/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("falha ao excluir"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anexos", "negocio", negocioId] }),
    onError: () => toast.error("Não foi possível excluir o anexo"),
  });

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/negocios/${negocioId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Falha ao atualizar.");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-detalhe", negocioId] }); setMotivoOutro(""); setEditandoSobre(false); setMoveMenuOpen(false); setPerderMenuOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Tags da oportunidade (01/09, Frente 2A) ────────────────────────────
  // Mesmos endpoints do drawer e do lead (`/api/labels`,
  // `/api/negocios/:id/labels`), mesma query key ["labels"]. Zero sistema
  // paralelo de tag. Declarados ANTES dos early returns — regra de hooks.
  const { data: labelsNegocio = [], refetch: refetchLabels } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["negocio-labels", negocioId],
    queryFn: async () => { const r = await fetch(`/api/negocios/${negocioId}/labels`); if (!r.ok) return []; return r.json(); },
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
    onSuccess: () => refetchLabels(),
    onError: () => toast.error("Não foi possível atualizar a tag"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Cf2Skeleton className="h-10 w-64" />
        <Cf2Skeleton className="h-32 w-full" />
        <Cf2Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    if ((error as { permissionDenied?: boolean })?.permissionDenied) {
      return <div className=""><Cf2PermissionDenied message="Você não tem permissão para ver este negócio." /></div>;
    }
    return <div className=""><Cf2ErrorState message={(error as Error).message} /></div>;
  }

  if (!data?.negocio) {
    return <div className=""><Cf2EmptyState title="Negócio não encontrado" description="Ele pode ter sido removido ou o link está errado." /></div>;
  }

  const { negocio, lead, empresa, propostas, atividades, reunioes, statusChanges, notas, contratos, comercial } = data as {
    negocio: {
      id: string; titulo: string; descricao: string | null; status: string; motivoPerda: string | null; serviceFamily: string | null;
      valorTotal: string | null; mrrEstimado: string | null; mrrFechado: string | null; valorSetup: string | null;
      previsaoFechamento: string | null; responsavelId: string | null; commercialMotion: string; origemNegocio: string;
      createdAt: string; updatedAt: string;
    };
    // `GET /negocios/:id` faz `db.select().from(leads)` — devolve a LINHA
    // INTEIRA. O tipo aqui estava estreito em 6 campos, então origem, UTM,
    // criativo e a qualificação (`camposCustom`) existiam no payload e
    // simplesmente nunca eram lidos. Ampliado em 01/09 (Frente 2A).
    lead: {
      id: string; nome: string; email: string | null; telefone: string | null;
      cargo: string | null; empresaCnpj: string | null;
      origem: string | null; utmSource: string | null; utmMedium: string | null;
      utmCampaign: string | null; utmContent: string | null; utmTerm: string | null;
      metaAdId: string | null; landingPage: string | null;
      responsavelId: string | null; createdAt: string;
      camposCustom: Record<string, unknown> | null;
      sdrStatus: string | null;
    } | null;
    empresa: { nome: string } | null;
    propostas: PropostaCompleta[];
    atividades: Atividade[];
    reunioes: Reuniao[];
    statusChanges: StatusChange[];
    notas: Nota[];
    contratos: Contrato[];
    leads?: ContatoEnvolvido[];
    comercial: { itens: OportunidadeItem[]; evidencias: Evidencia[]; grupos: GrupoComercial[] };
  };
  // `data.leads` só traz quem está no vínculo N:N (`negocio_leads`) — negócios
  // mais antigos podem ter só o lead primário (`negocio.leadId`) sem nunca
  // terem sido linkados nessa tabela. Garante que o contato principal
  // sempre apareça, sem duplicar se ele já estiver na lista N:N.
  const contatosBase: ContatoEnvolvido[] = (data.leads ?? []) as ContatoEnvolvido[];
  const contatos: ContatoEnvolvido[] = lead && !contatosBase.some((c) => c.id === lead.id)
    ? [{ id: lead.id, nome: lead.nome, email: lead.email, telefone: lead.telefone, empresa: empresa?.nome ?? null, cargo: lead.cargo, leadScore: null, tipo: "lead", papel: null }, ...contatosBase]
    : contatosBase;
  const itens: OportunidadeItem[] = comercial?.itens ?? [];
  const evidencias: Evidencia[] = comercial?.evidencias ?? [];
  const grupos: GrupoComercial[] = comercial?.grupos ?? [];
  const oportunidadesIrmas: OportunidadeIrma[] = data.oportunidadesIrmas ?? [];
  // ── Qualificação SDR herdada do lead (01/09, Frente 2A) ────────────────
  // Os 4 campos oficiais vivem em `leads.camposCustom` (contrato fechado no
  // mapa mestre: CNPJ, Cargo, Necessidade/Dor, Tomador de decisão). CNPJ e
  // Cargo têm coluna própria no lead e ganham dela quando preenchida.
  const qualif = (lead?.camposCustom || {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const qualificacaoSdr = {
    cnpj: lead?.empresaCnpj || txt(qualif.cnpj),
    cargo: lead?.cargo || txt(qualif.cargo),
    necessidadeDor: txt(qualif.necessidadeDor),
    tomadorDecisao: txt(qualif.tomadorDecisao),
  };
  const TOMADOR_LABEL: Record<string, string> = { sim: "Sim", nao: "Não", nao_identificado: "Não identificado" };

  /**
   * Quem qualificou e quando — DERIVADO, sem migration.
   *
   * Não existe coluna `qualificado_por` no schema. O que existe é
   * `status_changes` com `usuario_id` + `motivo`, gravado tanto pelo
   * `converterLeadEmOportunidade` ("Convertido em oportunidade (handover SDR
   * → vendas)" / "Qualificação direta sem reunião") quanto pelo PATCH de
   * `sdr_status` ("Qualificado por X"). Pego a mudança MAIS ANTIGA que casa,
   * porque é a primeira qualificação — requalificar depois não reescreve
   * quem fez o trabalho. Agente de IA não tem linha em `usuarios`, então
   * `usuario_id` vem nulo e o crédito fica no texto do motivo.
   */
  const MARCADORES_QUALIFICACAO = ["Qualificado por", "Convertido em oportunidade", "Qualificação direta"];
  const mudancaQualificacao = [...(leadHistorico?.statusChanges || [])]
    .filter((sc) => {
      const motivo = sc.motivo || "";
      return MARCADORES_QUALIFICACAO.some((m) => motivo.includes(m))
        || ["qualified", "m_qualified"].includes(sc.paraStatus);
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] || null;
  const qualificadorNome = mudancaQualificacao
    ? (mudancaQualificacao.autorNome
        || usuarios.find((u) => u.id === (mudancaQualificacao as unknown as { usuarioId?: string | null }).usuarioId)?.nome
        || (mudancaQualificacao.motivo?.includes("Qualificado por") ? mudancaQualificacao.motivo.replace("Qualificado por", "").trim() : null)
        || "Agente de IA ou autor não registrado")
    : null;

  const jaGanho = negocio.status === "ganho";
  const jaPerdido = negocio.status === "perdido";
  const stage = PIPELINE_OPEN_COLS.find((c) => c.keys.includes(negocio.status));
  const proximoStatus = proximoStatusReal(negocio.status);
  const isTrial = negocio.status === "trial";
  const trialDesde = statusChanges?.find((s) => s.paraStatus === "trial")?.createdAt;
  const tarefasAbertas = tarefas.filter((t) => !t.concluida);
  const tarefasAtrasadas = tarefasAbertas.filter((t) => t.dataVencimento && t.dataVencimento < new Date().toISOString().slice(0, 10));
  const proximaTarefa = [...tarefasAbertas].filter((t) => t.dataVencimento).sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())[0];
  const responsavelNome = negocio.responsavelId ? usuariosById.get(negocio.responsavelId)?.nome ?? null : null;
  const ultimoContatoInfo = ultimoContato(atividades ?? [], reunioes ?? [], notas ?? []);
  const previsaoVencida = !!negocio.previsaoFechamento && !jaGanho && !jaPerdido && negocio.previsaoFechamento < new Date().toISOString().slice(0, 10);
  // Proposta mais relevante pra detalhamento item a item: prioriza uma que
  // TENHA itens (aceita primeiro, senão a mais recente) — sem isso, uma
  // proposta aceita mas sem itens carregados escondia o detalhamento de
  // uma proposta mais recente que tinha os itens.
  const propostaDetalhada = propostas?.find((p) => p.status === "aceita" && p.itens && p.itens.length > 0)
    ?? propostas?.find((p) => p.itens && p.itens.length > 0)
    ?? propostas?.[0] ?? null;
  // "Composição comercial" (Commercial Core) é uma tabela separada
  // (oportunidade_itens) que só existe quando o dual-write rodou pra este
  // negócio — pode estar vazia mesmo com uma proposta real já aceita/enviada.
  // Achado 25/08 (Kauã, vendo a tela vazia com proposta já existindo): sem
  // fallback, a seção mostrava "sem itens" mesmo tendo proposta com itens
  // reais. Usa a proposta como fallback nesse caso, com o rótulo deixando
  // claro que é a composição DA PROPOSTA, não a oficial sincronizada.
  const usarFallbackProposta = itens.length === 0 && !!propostaDetalhada?.itens && propostaDetalhada.itens.length > 0;

  const telefoneDialer = lead?.telefone ? digitsForDialer(lead.telefone) : "";
  const atendimentoHref = (canal: "whatsapp" | "email" | "ligacao", contatoId?: string, telefone?: string | null) => {
    const id = contatoId ?? lead?.id;
    if (!id) return undefined;
    const params = new URLSearchParams({ leadId: id, canal });
    const tel = telefone !== undefined ? (telefone ? digitsForDialer(telefone) : "") : telefoneDialer;
    if (tel) params.set("telefone", tel);
    return `/atendimento?${params.toString()}`;
  };

  const itensPorFamilia = itens.reduce<Record<string, OportunidadeItem[]>>((acc, item) => {
    (acc[item.serviceFamily] ||= []).push(item);
    return acc;
  }, {});
  const totalMrr = itens.filter((i) => i.revenueNature === "MRR").reduce((s, i) => s + parseFloat(i.valorTotal || "0"), 0);
  const totalAvulsoItens = itens.filter((i) => i.revenueNature !== "MRR").reduce((s, i) => s + parseFloat(i.valorTotal || "0"), 0);

  function abrirTarefa(t: Tarefa | null) { setTarefaEditando(t); setTarefaModalOpen(true); }
  function abrirPreview(nome: string, url: string, tipoMime?: string | null) {
    setPreview({ url, nome, tipo: kindDeArquivo(nome, tipoMime) });
  }

  function abrirLigacao(a: Atividade) {
    const ligacaoId = a.dados?.ligacaoId;
    const leadIdDaLigacao = a.leadId || lead?.id;
    if (!ligacaoId || !leadIdDaLigacao) return;
    // A ligação pode ser de qualquer contato do negócio, não só o lead
    // primário — o fetch interno do Cf2CallDetail é por leadId, então
    // precisa ser o leadId REAL da atividade, senão não acha o registro.
    const contatoDaLigacao = contatos.find((c) => c.id === leadIdDaLigacao) ?? (lead?.id === leadIdDaLigacao ? lead : null);
    setCallSheet({
      id: ligacaoId, tipo: "ligacao", nome: contatoDaLigacao?.nome || lead?.nome || "Contato", empresaNome: empresa?.nome ?? null, preview: a.descricao || "",
      timestamp: a.createdAt, naoLidas: 0, leadId: leadIdDaLigacao, responsavelId: null, handoffStatus: null,
      duracaoSegundos: a.duracaoSegundos ?? null, callStatus: null, emailThreadId: null, telefone: contatoDaLigacao?.telefone ?? lead?.telefone ?? null,
      conversationSummary: null, status: "", snoozedUntil: null, isCliente: false,
    });
  }

  // Timeline unificada — mesmos dados de statusChanges/reunioes/notas/atividades
  // do drawer (NegocioDrawer.tsx), + propostas sintetizadas em eventos reais
  // (criada/enviada/visualizada/aceita/recusada — todos timestamps que já
  // existem na proposta, não é dado novo) + tarefas concluídas.
  function eventosDePropostas(lista: PropostaCompleta[]): EventoFeed[] {
    return lista.flatMap((p) => {
      const nome = `#P-${String(p.numero).padStart(3, "0")}-v${p.versao}`;
      const evs: EventoFeed[] = [
        { id: `p-criada-${p.id}`, tipo: "proposta", titulo: `Proposta ${nome} criada`, data: p.dataEmissao || "", autor: null, ref: null },
      ];
      if (p.enviadaEm) evs.push({ id: `p-enviada-${p.id}`, tipo: "proposta", titulo: `Proposta ${nome} enviada`, data: p.enviadaEm, autor: null, ref: null });
      if (p.primeiraVisualizacaoEm) evs.push({ id: `p-vista-${p.id}`, tipo: "proposta", titulo: `Proposta ${nome} visualizada pelo cliente`, data: p.primeiraVisualizacaoEm, autor: null, ref: null });
      if (p.status === "aceita" && p.clienteRespondeuEm) evs.push({ id: `p-aceita-${p.id}`, tipo: "proposta", titulo: `Proposta ${nome} aceita`, data: p.clienteRespondeuEm, autor: null, ref: null });
      if (p.status === "recusada" && p.clienteRespondeuEm) evs.push({ id: `p-recusada-${p.id}`, tipo: "proposta", titulo: `Proposta ${nome} recusada${p.motivoRecusa ? `: ${p.motivoRecusa}` : ""}`, data: p.clienteRespondeuEm, autor: null, ref: null });
      return evs.filter((e) => e.data);
    });
  }

  const feedCompleto: EventoFeed[] = [
    ...statusChanges.map((s) => ({ id: `sc-${s.id}`, tipo: "etapa", titulo: `${s.deStatus || "início"} → ${s.paraStatus}${s.motivo ? ` (${s.motivo})` : ""}`, data: s.createdAt, autor: s.autorNome, ref: null })),
    ...reunioes.map((r) => ({ id: `r-${r.id}`, tipo: "reuniao", titulo: `${r.titulo} — ${r.status}`, data: r.data, autor: null, ref: null })),
    ...notas.map((n) => ({ id: `n-${n.id}`, tipo: "nota", titulo: n.conteudo, data: n.createdAt, autor: n.autorNome, ref: null })),
    ...atividades.filter((a) => ["ligacao", "whatsapp", "email"].includes(a.tipo)).map((a) => ({ id: `a-${a.id}`, tipo: a.tipo, titulo: a.titulo || TIPO_EVENTO_LABEL[a.tipo] || a.tipo, data: a.createdAt, autor: null, ref: a })),
    ...eventosDePropostas(propostas),
    ...tarefas.filter((t) => t.concluida).map((t) => ({ id: `t-${t.id}`, tipo: "tarefa", titulo: `Tarefa concluída: ${t.titulo}`, data: t.dataVencimento || "", autor: t.responsavelNome, ref: null })),
  ].filter((e) => e.data).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  // "Do lado do contato" (25/08, pedido do Kauã: ver dos 2 lados) — mesmo
  // formato, mas fonte é `GET /api/leads/:id` (TODOS os negócios do lead,
  // sem filtro), excluindo o que já é DESTE negócio pra não duplicar com a
  // aba "Deste negócio".
  const feedContato: EventoFeed[] = [
    ...(leadHistorico?.statusChanges || []).filter((s) => s.negocioId !== negocioId).map((s) => ({ id: `csc-${s.id}`, tipo: "etapa", titulo: `${s.deStatus || "início"} → ${s.paraStatus}${s.motivo ? ` (${s.motivo})` : ""}`, data: s.createdAt, autor: s.autorNome, ref: null })),
    ...notasDoContato.filter((n) => n.negocioId !== negocioId).map((n) => ({ id: `cn-${n.id}`, tipo: "nota", titulo: n.conteudo, data: n.createdAt, autor: n.autorNome, ref: null })),
    ...(leadHistorico?.atividades || []).filter((a) => a.negocioId !== negocioId && ["ligacao", "whatsapp", "email"].includes(a.tipo)).map((a) => ({ id: `ca-${a.id}`, tipo: a.tipo, titulo: a.titulo || TIPO_EVENTO_LABEL[a.tipo] || a.tipo, data: a.createdAt, autor: null, ref: a })),
    ...eventosDePropostas((leadHistorico?.propostas || []).filter((p) => p.negocioId !== negocioId)),
  ].filter((e) => e.data).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  function aplicarFiltroTipo(lista: EventoFeed[]): EventoFeed[] {
    return lista.filter((e) => {
      if (historicoFiltro === "Tudo") return true;
      if (historicoFiltro === "Etapas") return e.tipo === "etapa";
      if (historicoFiltro === "Ligações") return e.tipo === "ligacao";
      if (historicoFiltro === "WhatsApp") return e.tipo === "whatsapp";
      if (historicoFiltro === "E-mails") return e.tipo === "email";
      if (historicoFiltro === "Propostas") return e.tipo === "proposta";
      if (historicoFiltro === "Notas") return e.tipo === "nota";
      if (historicoFiltro === "Tarefas") return e.tipo === "tarefa";
      return true;
    });
  }
  const feedFiltradoNegocio = aplicarFiltroTipo(feedCompleto);
  const feedFiltradoContato = aplicarFiltroTipo(feedContato);
  const notasDoOutroLado = notasDoContato.filter((n) => n.negocioId !== negocioId);

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────────────
          Topo no PADRÃO do sistema (01/09, correção do Kauã): branco, altura
          compacta, sem título grande e sem CTA. `compact` existe exatamente
          pra tela de detalhe — a página já tem o nome da oportunidade como
          heading logo abaixo, então repetir "Vendas" em 28px era ruído.
          `actions={null}` remove o "Novo negócio", que não faz sentido dentro
          de uma oportunidade aberta (a checagem no Topbar é por `undefined`,
          então `null` de verdade apaga o CTA em vez de cair no default). */}
      <div className="-m-6 mb-0 flex flex-col">
        <div className="rounded-tl-2xl px-8 py-3.5" style={{ background: "var(--cf2-bg-surface)", borderBottom: "1px solid var(--cf2-border-default)" }}>
          <Cf2Topbar orgNome="Callface" variant="light" compact actions={null} />
        </div>

        <div data-cf2-superficie="escura" className="px-8 py-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
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
                <p className="text-[26px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{negocio.titulo}</p>
                {stage && <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${stage.color}22`, color: stage.color }}>{stage.label}</span>}
                {jaGanho && <Cf2Badge variant="success">Ganho</Cf2Badge>}
                {jaPerdido && <Cf2Badge variant="danger">Perdido</Cf2Badge>}
                {negocio.serviceFamily && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>{FAMILY_LABEL[negocio.serviceFamily] || negocio.serviceFamily}</span>}
              </div>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                {empresa?.nome ? `${empresa.nome} · ` : ""}{lead?.nome || "Sem contato vinculado"}{responsavelNome ? ` · ${responsavelNome}` : ""} · Criado em {new Date(negocio.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <HeaderAction icon={Phone} label="Ligar" href={lead?.telefone && lead.id ? atendimentoHref("ligacao") : undefined} />
              <HeaderAction icon={MessageCircle} label="WhatsApp" href={lead?.telefone && lead.id ? atendimentoHref("whatsapp") : undefined} />
              <HeaderAction icon={Mail} label="E-mail" href={lead?.email && lead.id ? atendimentoHref("email") : undefined} />
              <HeaderAction icon={Calendar} label="Agendar" onClick={() => abrirTarefa(null)} />
              <HeaderAction icon={Plus} label="Tarefa" onClick={() => abrirTarefa(null)} />
              <HeaderAction icon={NotebookPen} label="Nota" onClick={() => { setActiveTab("notas"); setNoteOpen(true); }} />
              <HeaderAction icon={Pencil} label="Editar" onClick={() => { setActiveTab("visao-geral"); setSobreForm({ titulo: negocio.titulo, descricao: negocio.descricao || "", responsavelId: negocio.responsavelId || "", previsaoFechamento: negocio.previsaoFechamento || "" }); setEditandoSobre(true); }} />
              <Cf2DropdownMenu>
                <Cf2DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)" }} aria-label="Mais ações"><MoreHorizontal className="w-4 h-4" /></button>
                </Cf2DropdownMenuTrigger>
                <Cf2DropdownMenuContent align="end">
                  <Cf2DropdownMenuItem onClick={() => irParaNovaProposta()} className="gap-2"><FileText className="w-3.5 h-3.5" /> Nova proposta</Cf2DropdownMenuItem>
                  {lead?.id && <Cf2DropdownMenuItem asChild className="gap-2"><Link href={`/contatos/${lead.id}`}><User className="w-3.5 h-3.5" /> Ver contato</Link></Cf2DropdownMenuItem>}
                </Cf2DropdownMenuContent>
              </Cf2DropdownMenu>
            </div>
          </div>

          {/* Tags (01/09, Frente 2A) — contexto/segmentação, nunca substituto
              de etapa. Mesma estrutura `labels` já usada em lead e no drawer. */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {labelsNegocio.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cf2-accent)]" style={{ background: `color-mix(in srgb, ${l.cor} 15%, transparent)`, color: l.cor, border: `1px solid color-mix(in srgb, ${l.cor} 35%, transparent)` }}>
                {l.nome}
                <button onClick={() => mudarTag.mutate({ labelId: l.id, acao: "remove" })} aria-label={`Remover tag ${l.nome}`} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <div className="relative">
              <button onClick={() => setTagPopoverOpen((v) => !v)} aria-expanded={tagPopoverOpen} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ border: "1px dashed var(--cf2-chrome-border)", color: "var(--cf2-chrome-text-secondary)" }}>
                <TagIcon className="w-3 h-3" /> Tag
              </button>
              {tagPopoverOpen && (
                <div className="absolute z-30 mt-1 left-0 w-56 max-h-64 overflow-y-auto rounded-xl py-1" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "var(--cf2-shadow-shell)" }}>
                  {labelsDisponiveis.filter((l) => !labelsNegocio.some((x) => x.id === l.id)).length === 0 ? (
                    <p className="px-3 py-2 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma tag disponível.</p>
                  ) : labelsDisponiveis.filter((l) => !labelsNegocio.some((x) => x.id === l.id)).map((l) => (
                    <button key={l.id} onClick={() => { mudarTag.mutate({ labelId: l.id, acao: "add" }); setTagPopoverOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.cor }} /> {l.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Métricas do header — spec: valor, MRR, tempo etapa, tempo no funil, previsão, último contato */}
          <div className="flex items-center gap-6 flex-wrap pt-1">
            <HeaderMetric hero label="Valor do negócio" value={brl(negocio.mrrFechado || negocio.mrrEstimado || negocio.valorTotal)} sub={negocio.valorSetup && parseFloat(negocio.valorSetup) > 0 ? `+ Setup ${brl(negocio.valorSetup)}` : undefined} />
            {(negocio.mrrFechado || negocio.mrrEstimado) && <HeaderMetric label="MRR" value={`${brl(negocio.mrrFechado || negocio.mrrEstimado)}/mês`} />}
            <HeaderMetric label="Tempo na etapa" value={tempoNaEtapa(negocio.updatedAt)} />
            <HeaderMetric label="Tempo no funil" value={tempoDesde(negocio.createdAt)} />
            <HeaderMetric label="Previsão de fechamento" value={negocio.previsaoFechamento ? new Date(negocio.previsaoFechamento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"} warn={previsaoVencida} />
            <HeaderMetric label="Último contato" value={ultimoContatoInfo ? `${ultimoContatoInfo.quando} · ${ultimoContatoInfo.canal}` : "Nenhum ainda"} />
          </div>

          {!jaGanho && !jaPerdido && (
            <div className="flex items-center gap-4">
              <Cf2DropdownMenu open={moveMenuOpen} onOpenChange={setMoveMenuOpen}>
                <Cf2DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-semibold" style={{ background: "var(--cf2-bg-canvas)", color: "var(--cf2-text-primary)" }}>Mover etapa</button>
                </Cf2DropdownMenuTrigger>
                <Cf2DropdownMenuContent align="start">
                  {PIPELINE_OPEN_COLS.map((s) => (
                    <Cf2DropdownMenuItem key={s.key} onClick={() => patch.mutate({ status: s.dropTarget })} className="gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
                    </Cf2DropdownMenuItem>
                  ))}
                </Cf2DropdownMenuContent>
              </Cf2DropdownMenu>
              <Cf2DropdownMenu open={perderMenuOpen} onOpenChange={setPerderMenuOpen}>
                <Cf2DropdownMenuTrigger asChild>
                  <button className="text-[13px] font-bold" style={{ color: "#f87171" }}>Perder Oportunidade</button>
                </Cf2DropdownMenuTrigger>
                <Cf2DropdownMenuContent align="start" className="min-w-[240px]">
                  {Object.entries(MOTIVO_PERDA_ESTRUTURADO).map(([statusKey, label]) => (
                    <Cf2DropdownMenuItem key={statusKey} onClick={() => patch.mutate({ status: statusKey })} destructive>{label}</Cf2DropdownMenuItem>
                  ))}
                  <div className="h-px my-1" style={{ background: "var(--cf2-border-default)" }} />
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} placeholder="Outro motivo…" aria-label="Outro motivo" onClick={(e) => e.stopPropagation()} className="flex-1 px-2 py-1 rounded-lg text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                    <button onClick={(e) => { e.stopPropagation(); if (motivoOutro.trim()) patch.mutate({ status: "perdido", motivoPerda: motivoOutro.trim() }); }} disabled={!motivoOutro.trim()} className="text-[11px] font-bold px-2 py-1 rounded-lg disabled:opacity-40" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>OK</button>
                  </div>
                </Cf2DropdownMenuContent>
              </Cf2DropdownMenu>
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

      {/* ── Corpo (claro) — abas ── */}
      <div className="pt-6 pb-16">
        {oportunidadesIrmas.length > 0 && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2 flex-wrap" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <span className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Esta negociação também inclui:</span>
            {oportunidadesIrmas.map((o) => (
              <Link key={o.id} href={`/negocios/${o.id}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <span className="text-[12px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{o.titulo}</span>
                <Cf2Badge variant={o.status === "ganho" ? "success" : o.status === "perdido" ? "danger" : "neutral"}>{o.status}</Cf2Badge>
              </Link>
            ))}
          </div>
        )}

        <Cf2Tabs value={activeTab} onValueChange={setActiveTab}>
          <Cf2TabsList className="w-full flex-wrap justify-start overflow-x-auto mb-4">
            <Cf2TabsTrigger value="visao-geral">Visão geral</Cf2TabsTrigger>
            <Cf2TabsTrigger value="propostas">Propostas{propostas.length > 0 ? ` (${propostas.length})` : ""}</Cf2TabsTrigger>
            <Cf2TabsTrigger value="produtos">Produtos & Serviços</Cf2TabsTrigger>
            <Cf2TabsTrigger value="historico">Histórico</Cf2TabsTrigger>
            <Cf2TabsTrigger value="notas">Notas{notas.length > 0 ? ` (${notas.length})` : ""}</Cf2TabsTrigger>
            <Cf2TabsTrigger value="tarefas">Tarefas{tarefasAbertas.length > 0 ? ` (${tarefasAbertas.length})` : ""}</Cf2TabsTrigger>
            <Cf2TabsTrigger value="documentos">Documentos</Cf2TabsTrigger>
          </Cf2TabsList>

          {/* ═══ VISÃO GERAL ═══ */}
          <Cf2TabsContent value="visao-geral">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Building2} tint="#3B82F6" title="Sobre o negócio" />
                    {!editandoSobre && <button onClick={() => { setSobreForm({ titulo: negocio.titulo, descricao: negocio.descricao || "", responsavelId: negocio.responsavelId || "", previsaoFechamento: negocio.previsaoFechamento || "" }); setEditandoSobre(true); }} className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}><Pencil className="w-3 h-3" /> Editar</button>}
                  </div>
                  {editandoSobre ? (
                    <div className="mt-3 flex flex-col gap-2.5">
                      <input value={sobreForm.titulo} onChange={(e) => setSobreForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título do negócio" className="w-full text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      <textarea value={sobreForm.descricao} onChange={(e) => setSobreForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" rows={3} className="w-full text-[13px] px-2.5 py-2 rounded-lg outline-none resize-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      <div className="flex gap-2">
                        <select aria-label="Responsável" value={sobreForm.responsavelId} onChange={(e) => setSobreForm((f) => ({ ...f, responsavelId: e.target.value }))} className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                          <option value="">Sem responsável</option>
                          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                        <input type="date" aria-label="Previsão de fechamento" value={sobreForm.previsaoFechamento} onChange={(e) => setSobreForm((f) => ({ ...f, previsaoFechamento: e.target.value }))} className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditandoSobre(false)} className="text-[12px] px-3 py-1.5" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
                        <button onClick={() => patch.mutate({ titulo: sobreForm.titulo, descricao: sobreForm.descricao || null, responsavelId: sobreForm.responsavelId || null, previsaoFechamento: sobreForm.previsaoFechamento || null })} disabled={patch.isPending} className="text-[12px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <p className="text-[13px]" style={{ color: negocio.descricao ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)" }}>{negocio.descricao || "Sem descrição."}</p>
                      <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                        <PropertyRow label="Origem" value={negocio.origemNegocio === "carteira" ? "Carteira de clientes" : "Prospecção outbound"} />
                        <PropertyRow label="Tipo de negócio" value={MOTION_LABEL[negocio.commercialMotion] || negocio.commercialMotion} />
                        {/* Editável direto, sem precisar abrir "Editar" —
                            mesmo `OwnerPicker` já usado em Prospecção/Pré-
                            vendas/Pipeline (achado do Kauã, 25/08: "responsável
                            não tá editável" — nesta página só dava pra trocar
                            entrando no modo de edição do card inteiro). */}
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span style={{ color: "var(--cf2-text-tertiary)" }}>Responsável</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <OwnerPicker ownerId={negocio.responsavelId} ownerName={responsavelNome} usuarios={usuarios} onAssign={(userId) => patch.mutate({ responsavelId: userId })} size={20} align="end" />
                            <span className="font-medium truncate max-w-[160px]" style={{ color: "var(--cf2-text-primary)" }}>{responsavelNome || "Sem responsável"}</span>
                          </div>
                        </div>
                        <PropertyRow label="Criado em" value={new Date(negocio.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
                      </div>
                    </div>
                  )}
                </Cf2Card>

                {/* ── Qualificação SDR herdada do lead (01/09, Frente 2A) ──
                    Vive AQUI e não no drawer, por regra explícita do Kauã:
                    "drawer é resumo operacional, a qualificação completa
                    aparece na página completa". Só leitura — quem edita é
                    Pré-vendas, que é a dona do lead. */}
                <Cf2Card>
                  <CardTitulo icon={ClipboardCheck} tint="#8B5CF6" title="Qualificação SDR" subtitle="Herdada do lead de origem, editável em Pré-vendas" />
                  <div className="mt-3 flex flex-col gap-1.5">
                    <PropertyRow label="CNPJ" value={qualificacaoSdr.cnpj || "—"} />
                    <PropertyRow label="Cargo" value={qualificacaoSdr.cargo || "—"} />
                    <PropertyRow label="Necessidade / Dor" value={qualificacaoSdr.necessidadeDor || "—"} />
                    <PropertyRow label="Tomador de decisão" value={qualificacaoSdr.tomadorDecisao ? (TOMADOR_LABEL[qualificacaoSdr.tomadorDecisao] || qualificacaoSdr.tomadorDecisao) : "—"} />
                    <div className="pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                      <PropertyRow label="Qualificado por" value={qualificadorNome || "Sem registro"} />
                      <PropertyRow
                        label="Qualificado em"
                        value={mudancaQualificacao ? new Date(mudancaQualificacao.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                      />
                    </div>
                    {!qualificacaoSdr.necessidadeDor && !qualificacaoSdr.tomadorDecisao && (
                      <p className="text-[12px] pt-1" style={{ color: "var(--cf2-text-tertiary)" }}>
                        Esta oportunidade não tem qualificação registrada no lead de origem.
                      </p>
                    )}
                  </div>
                </Cf2Card>

                {/* ── Aquisição / origem (01/09, Frente 2A) ──────────────────
                    Requisito do mapa mestre que estava furado: origem,
                    campanha, UTM e criativo precisam persistir do lead até a
                    oportunidade. Nada é copiado pra coluna nova — é o mesmo
                    lead vinculado, exibido por join. Copiar viraria dado
                    duplicado que desincroniza. */}
                <Cf2Card>
                  <CardTitulo icon={Megaphone} tint="var(--cf2-warning-text)" title="Aquisição" subtitle="Contexto comercial de origem, vindo do lead" />
                  <div className="mt-3 flex flex-col gap-1.5">
                    <PropertyRow label="Origem do lead" value={lead?.origem || "—"} />
                    {/* SDR = responsável do LEAD (quem trabalhou a pré-venda),
                        distinto do closer, que é o responsável do NEGÓCIO. */}
                    <PropertyRow label="SDR responsável" value={usuarios.find((u) => u.id === lead?.responsavelId)?.nome || "—"} />
                    <PropertyRow label="Campanha" value={lead?.utmCampaign || "—"} />
                    <PropertyRow label="Fonte / meio" value={[lead?.utmSource, lead?.utmMedium].filter(Boolean).join(" · ") || "—"} />
                    <PropertyRow label="Criativo" value={lead?.utmContent || lead?.metaAdId || "—"} />
                    <PropertyRow label="Termo" value={lead?.utmTerm || "—"} />
                    <PropertyRow label="Página de entrada" value={lead?.landingPage || "—"} />
                    <div className="pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span style={{ color: "var(--cf2-text-tertiary)" }}>Lead de origem</span>
                        {lead ? (
                          <Link href={`/contatos/${lead.id}`} className="font-medium truncate max-w-[200px]" style={{ color: "var(--cf2-accent-text)" }}>{lead.nome} →</Link>
                        ) : (
                          <span style={{ color: "var(--cf2-text-tertiary)" }}>—</span>
                        )}
                      </div>
                      <PropertyRow label="Lead criado em" value={lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
                    </div>
                  </div>
                </Cf2Card>

                {/* "Jornada comercial" removida (25/08) — pedido explícito
                    e repetido do Kauã, mesmo achado já aplicado antes no
                    drawer do Pipeline: é redundante com o badge de etapa e
                    o "Tempo na etapa" que já estão no header desta mesma
                    página. Não reconstruir sem pedido novo. */}
                {isTrial && (
                  <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)" }}>
                    <Beaker className="w-4 h-4 shrink-0" style={{ color: "#14B8A6" }} />
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>Trial ativo{trialDesde ? ` desde ${new Date(trialDesde).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}</p>
                  </div>
                )}

                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Users} tint="#06B6D4" title="Contatos envolvidos" subtitle={`${contatos.length} pessoa${contatos.length === 1 ? "" : "s"} nesta oportunidade`} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {contatos.length === 0 && <Cf2EmptyState title="Nenhum contato vinculado" />}
                    {contatos.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <Link href={`/contatos/${c.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-[12px] font-bold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>{iniciais(c.nome)}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}>{c.nome} {c.papel && <Cf2Badge variant={PAPEL_VARIANT[c.papel] || "neutral"}>{PAPEL_LABEL[c.papel] || c.papel}</Cf2Badge>}</p>
                            <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{[c.cargo, c.empresa].filter(Boolean).join(" · ") || "—"}</p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MiniAction icon={Phone} href={c.telefone ? atendimentoHref("ligacao", c.id, c.telefone) : undefined} label={`Ligar para ${c.nome}`} />
                          <MiniAction icon={MessageCircle} href={c.telefone ? atendimentoHref("whatsapp", c.id, c.telefone) : undefined} label={`WhatsApp com ${c.nome}`} />
                          <MiniAction icon={Mail} href={c.email ? atendimentoHref("email", c.id, null) : undefined} label={`E-mail para ${c.nome}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Cf2Card>

                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Package} tint="var(--cf2-accent-border)" title="Composição comercial" subtitle="O que está sendo vendido nesta oportunidade" />
                    <button onClick={() => setActiveTab("produtos")} className="text-[12px] font-semibold shrink-0" style={{ color: "var(--cf2-accent-text)" }}>Ver detalhes →</button>
                  </div>
                  <div className="mt-3">
                    {itens.length > 0 ? (
                      <div className="flex items-center gap-4 flex-wrap text-[13px]">
                        {totalMrr > 0 && <span style={{ color: "var(--cf2-text-primary)" }}><b>{brl(totalMrr)}</b>/mês recorrente</span>}
                        {totalAvulsoItens > 0 && <span style={{ color: "var(--cf2-text-secondary)" }}><b style={{ color: "var(--cf2-text-primary)" }}>{brl(totalAvulsoItens)}</b> avulso/setup</span>}
                        <span style={{ color: "var(--cf2-text-tertiary)" }}>{itens.length} item{itens.length === 1 ? "" : "s"} em {Object.keys(itensPorFamilia).length} família{Object.keys(itensPorFamilia).length === 1 ? "" : "s"}</span>
                      </div>
                    ) : usarFallbackProposta && propostaDetalhada ? (
                      <PropostaComposicaoCard p={propostaDetalhada} />
                    ) : (
                      <Cf2EmptyState title="Sem itens ainda" description="Crie uma proposta pra definir a composição comercial deste negócio." />
                    )}
                  </div>
                </Cf2Card>

                <InsightsNegocio propostasCount={propostas.length} interacoes={atividades.length + reunioes.length + notas.length} ultimoContato={ultimoContatoInfo} semProximaAcao={!proximaTarefa} previsaoVencida={previsaoVencida} />
              </div>

              <div className="space-y-4">
                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Calendar} tint="var(--cf2-success-text)" title="Próxima atividade" />
                    <button onClick={() => abrirTarefa(null)} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>+ Nova</button>
                  </div>
                  <div className="mt-3">
                    {proximaTarefa ? (
                      <div className="p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{proximaTarefa.titulo}</p>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}{proximaTarefa.responsavelNome ? ` · ${proximaTarefa.responsavelNome}` : ""}{proximaTarefa.prioridade && proximaTarefa.prioridade !== "media" ? ` · ${proximaTarefa.prioridade}` : ""}</p>
                        <div className="flex gap-3 mt-2">
                          <button onClick={() => toggleTarefa.mutate({ id: proximaTarefa.id, concluida: true })} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Concluir</button>
                          <button onClick={() => abrirTarefa(proximaTarefa)} className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Editar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl flex items-center gap-2" style={{ background: "var(--cf2-warning-bg)", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-warning-text)" }} />
                        <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-warning-text)" }}>Sem próxima ação — crie uma</p>
                      </div>
                    )}
                  </div>
                </Cf2Card>

                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={FileText} tint="var(--cf2-accent-border)" title="Propostas" />
                    <button onClick={() => irParaNovaProposta()} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>+ Nova</button>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {propostas.length === 0 && <Cf2EmptyState title="Nenhuma proposta ainda" />}
                    {propostas.slice(0, 3).map((p) => <PropostaRow key={p.id} p={p} />)}
                    {propostas.length > 3 && <button onClick={() => setActiveTab("propostas")} className="text-[12px] font-semibold pt-1" style={{ color: "var(--cf2-accent-text)" }}>Ver todas ({propostas.length}) →</button>}
                  </div>
                </Cf2Card>

                <Cf2Card>
                  <CardTitulo icon={FileText} tint="var(--cf2-warning-text)" title="Documentos" />
                  <div className="mt-3 space-y-1.5">
                    {propostas.length === 0 && anexosLegado.length === 0 && <Cf2EmptyState title="Nenhum documento ainda" />}
                    {propostas.slice(0, 2).map((p) => (
                      <a key={p.id} href={`/api/propostas/${p.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 p-2 rounded-lg text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} /> Proposta #{String(p.numero).padStart(3, "0")}-v{p.versao}.pdf
                      </a>
                    ))}
                    {(propostas.length > 2 || anexosLegado.length > 0) && <button onClick={() => setActiveTab("documentos")} className="text-[12px] font-semibold pt-1" style={{ color: "var(--cf2-accent-text)" }}>Ver todos →</button>}
                  </div>
                </Cf2Card>

                <Cf2Card>
                  <CardTitulo icon={ShieldCheck} tint="var(--cf2-success-text)" title="Evidências de fechamento" subtitle="Commercial Evidence Policy" />
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
              </div>
            </div>
          </Cf2TabsContent>

          {/* ═══ PROPOSTAS ═══ */}
          <Cf2TabsContent value="propostas">
            <Cf2Card>
              <div className="flex items-center justify-between">
                <Cf2SectionHeader title="Propostas desta oportunidade" />
                <button onClick={() => irParaNovaProposta()} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="w-3.5 h-3.5" /> Nova proposta</button>
              </div>
              <div className="mt-3 space-y-2">
                {propostas.length === 0 && <Cf2EmptyState title="Nenhuma proposta ainda" description="Crie a primeira proposta pra esta oportunidade." />}
                {propostas.map((p) => <PropostaRow key={p.id} p={p} detalhada />)}
              </div>
            </Cf2Card>
          </Cf2TabsContent>

          {/* ═══ PRODUTOS & SERVIÇOS ═══ */}
          <Cf2TabsContent value="produtos">
            <div className="space-y-4">
              <Cf2Card>
                <Cf2SectionHeader title="Composição comercial" subtitle="Itens da oportunidade (Commercial Core), por família e natureza de receita" />
                <div className="mt-3 flex items-center gap-6 flex-wrap pb-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                  <SummaryStat label="Recorrência mensal" value={usarFallbackProposta ? brl(propostaDetalhada!.totalRecorrente || 0) + "/mês" : totalMrr > 0 ? `${brl(totalMrr)}/mês` : "—"} />
                  <SummaryStat label="Setup / Avulso" value={usarFallbackProposta ? brl(propostaDetalhada!.totalAvulso || 0) : totalAvulsoItens > 0 ? brl(totalAvulsoItens) : "—"} />
                  <SummaryStat label="Total comercial" value={usarFallbackProposta ? brl(propostaDetalhada!.totalGeral) : brl(totalMrr + totalAvulsoItens)} />
                </div>
                <div className="mt-3 space-y-3">
                  {usarFallbackProposta && propostaDetalhada ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Ainda não sincronizado como composição comercial oficial — mostrando os itens da proposta.</p>
                      <PropostaComposicaoCard p={propostaDetalhada} />
                    </div>
                  ) : itens.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <Cf2EmptyState title="Sem composição comercial ainda" description="Crie ou aceite uma proposta pra definir o que está sendo vendido." />
                      <button onClick={() => irParaNovaProposta()} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Criar proposta</button>
                    </div>
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
                                <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>× {item.quantidade}</span>
                                {item.servicoCanonicoId && <span title="Serviço canônico ativado"><ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-accent-text)" }} /></span>}
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

              {grupos.length > 0 && (
                <Cf2Card>
                  <Cf2SectionHeader title="Fechamento e entrega" subtitle="Estado de cada composição comercial, independente entre si" />
                  <div className="mt-3 space-y-1.5">
                    {grupos.map((g) => {
                      const estado = derivarEstadoFechamento(g);
                      // Pagamento em aberto aparece como badge SEPARADA, nunca
                      // substituindo o estado comercial: em PABX/White Label a
                      // venda está ganha de verdade E o dinheiro está em
                      // aberto — os dois fatos ao mesmo tempo.
                      const pagamentoEmAberto = g.pagamentoStatus === "pendente" && !!g.entregaLiberadaEm;
                      return (
                        <div key={g.id} className="flex items-center justify-between gap-2 p-2.5 rounded-chip" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                          <div className="flex flex-col min-w-0">
                            <span className="text-corpo font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>
                              {g.serviceFamily && FAMILY_LABEL[g.serviceFamily] ? FAMILY_LABEL[g.serviceFamily] : MODEL_LABEL[g.commercialModel] || g.commercialModel}
                            </span>
                            <span className="text-micro" style={{ color: "var(--cf2-text-tertiary)" }}>{MODEL_LABEL[g.commercialModel] || g.commercialModel}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {pagamentoEmAberto && (
                              <Cf2Badge variant="warning">
                                {g.pagamentoVenceEm ? `Pagamento pendente · vence ${new Date(g.pagamentoVenceEm).toLocaleDateString("pt-BR")}` : "Pagamento pendente"}
                              </Cf2Badge>
                            )}
                            <Cf2Badge variant={ESTADO_FECHAMENTO_VARIANT[estado]}>{ESTADO_FECHAMENTO_LABEL[estado]}</Cf2Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Cf2Card>
              )}

              {/* Só mostra separado quando NÃO é o mesmo conteúdo do card de
                  fallback acima (evita duplicar a mesma proposta 2x) —
                  aqui é o detalhamento com valor unitário/desconto por
                  item, útil quando a Composição Comercial oficial já existe
                  mas o vendedor quer ver a economia unitária da proposta. */}
              {!usarFallbackProposta && propostaDetalhada && propostaDetalhada.itens && propostaDetalhada.itens.length > 0 && (
                <Cf2Card>
                  <Cf2SectionHeader title={`Detalhamento da proposta #P-${String(propostaDetalhada.numero).padStart(3, "0")}-v${propostaDetalhada.versao}`} subtitle="Valor unitário e desconto por item, como configurado na proposta" />
                  <div className="mt-3 space-y-1.5">
                    {propostaDetalhada.itens.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <span className="min-w-0 truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.nome} <span style={{ color: "var(--cf2-text-tertiary)" }}>× {item.quantidade}</span></span>
                        <span className="shrink-0 flex items-center gap-2" style={{ color: "var(--cf2-text-secondary)" }}>
                          {brl(item.valorUnitario)}/un {item.desconto && parseFloat(item.desconto) > 0 && <span style={{ color: "var(--cf2-warning-text)" }}>−{item.desconto}</span>}
                          <b style={{ color: "var(--cf2-text-primary)" }}>{brl(item.subtotal)}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </Cf2Card>
              )}
            </div>
          </Cf2TabsContent>

          {/* ═══ HISTÓRICO (timeline semântica unificada) ═══ */}
          <Cf2TabsContent value="historico">
            <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto mb-3">
              {HISTORICO_FILTROS.map((f) => (
                <button key={f} onClick={() => setHistoricoFiltro(f)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap" style={{ background: historicoFiltro === f ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: historicoFiltro === f ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>{f}</button>
              ))}
            </div>
            {/* De um lado o do negócio, do outro o do contato (25/08,
                pedido explícito do Kauã com referência desenhada) — não é
                toggle, os 2 lados ficam visíveis ao mesmo tempo. "Do
                contato" exclui o que já é deste negócio, pra não duplicar. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FeedColuna titulo="Deste negócio" eventos={feedFiltradoNegocio} onAbrirLigacao={abrirLigacao} vazio="Nada por aqui ainda" />
              <FeedColuna titulo={`Do contato${lead ? ` — ${lead.nome}` : ""}`} eventos={feedFiltradoContato} onAbrirLigacao={abrirLigacao} vazio={lead ? "Sem histórico deste contato em outros negócios." : "Sem contato vinculado."} />
            </div>
          </Cf2TabsContent>

          {/* ═══ NOTAS ═══ */}
          <Cf2TabsContent value="notas">
            <Cf2Card>
              <div className="flex items-center justify-between">
                <Cf2SectionHeader title="Notas internas — deste negócio" />
                {!noteOpen && <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}><Plus className="w-3.5 h-3.5" /> Adicionar nota</button>}
              </div>
              {noteOpen && (
                <div className="mt-3 flex flex-col gap-1.5 pb-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                  <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Escreva uma nota…" aria-label="Escreva uma nota" rows={3} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && noteText.trim()) addNota.mutate({ conteudo: noteText.trim(), arquivos: noteArquivos }); if (e.key === "Escape") { setNoteOpen(false); setNoteText(""); setNoteArquivos([]); } }} />
                  {noteArquivos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {noteArquivos.map((f, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
                          <Paperclip className="w-3 h-3 shrink-0" /> {f.name}
                          <button type="button" onClick={() => setNoteArquivos((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`Remover ${f.name}`} style={{ color: "var(--cf2-danger-text)" }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[12px] font-medium cursor-pointer focus-within:ring-2 focus-within:ring-[var(--cf2-accent-border)] rounded-lg px-1" style={{ color: "var(--cf2-text-secondary)" }}>
                      <Paperclip className="w-3.5 h-3.5" /> Anexar arquivo
                      <input type="file" multiple className="sr-only" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) setNoteArquivos((prev) => [...prev, ...files]); e.target.value = ""; }} />
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => { setNoteOpen(false); setNoteText(""); setNoteArquivos([]); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
                      <button onClick={() => noteText.trim() && addNota.mutate({ conteudo: noteText.trim(), arquivos: noteArquivos })} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> {addNota.isPending ? "Salvando…" : "Salvar"}</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3 space-y-2">
                {notas.length === 0 && !noteOpen && <Cf2EmptyState title="Nenhuma nota ainda" />}
                {notas.map((n) => <NotaRow key={n.id} n={n} anexos={anexosReais.filter((a) => a.notaId === n.id)} onPreview={abrirPreview} />)}
              </div>
            </Cf2Card>

            {/* De um lado o do negócio (acima), do outro o do contato
                (abaixo) — mesma referência desenhada, aqui não faz sentido
                lado a lado (composer ocupa a largura), então empilhado com
                título claro de qual é qual. */}
            <Cf2Card className="mt-4">
              <Cf2SectionHeader title={`Notas do contato${lead ? ` — ${lead.nome}` : ""}`} subtitle="De outros negócios deste mesmo contato, ou anteriores a este negócio existir" />
              <div className="mt-3 space-y-2">
                {!lead ? (
                  <Cf2EmptyState title="Sem contato vinculado" />
                ) : notasDoOutroLado.length === 0 ? (
                  <Cf2EmptyState title="Nenhuma nota do contato em outros negócios" />
                ) : (
                  notasDoOutroLado.map((n) => <NotaRow key={n.id} n={n} anexos={anexosReais.filter((a) => a.notaId === n.id)} onPreview={abrirPreview} />)
                )}
              </div>
            </Cf2Card>
          </Cf2TabsContent>

          {/* ═══ TAREFAS ═══ */}
          <Cf2TabsContent value="tarefas">
            <Cf2Card>
              <div className="flex items-center justify-between">
                <Cf2SectionHeader title="Tarefas" />
                <button onClick={() => abrirTarefa(null)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="w-3.5 h-3.5" /> Nova tarefa</button>
              </div>
              {tarefasAtrasadas.length > 0 && (
                <div className="mt-3">
                  <Cf2Eyebrow>Atrasadas ({tarefasAtrasadas.length})</Cf2Eyebrow>
                  <div className="mt-1.5 space-y-1.5">
                    {tarefasAtrasadas.map((t) => <TarefaRow key={t.id} t={t} atrasada onToggle={() => toggleTarefa.mutate({ id: t.id, concluida: true })} onEdit={() => abrirTarefa(t)} />)}
                  </div>
                </div>
              )}
              <div className="mt-3">
                <Cf2Eyebrow>Em aberto ({tarefasAbertas.length - tarefasAtrasadas.length})</Cf2Eyebrow>
                <div className="mt-1.5 space-y-1.5">
                  {tarefasAbertas.filter((t) => !tarefasAtrasadas.includes(t)).length === 0 && <Cf2EmptyState title="Nenhuma tarefa em aberto" />}
                  {tarefasAbertas.filter((t) => !tarefasAtrasadas.includes(t)).map((t) => <TarefaRow key={t.id} t={t} onToggle={() => toggleTarefa.mutate({ id: t.id, concluida: true })} onEdit={() => abrirTarefa(t)} />)}
                </div>
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                <button onClick={() => setMostrarConcluidas((v) => !v)} className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{mostrarConcluidas ? "Ocultar concluídas" : "Ver tarefas concluídas"}</button>
                {mostrarConcluidas && (
                  <div className="mt-1.5 space-y-1.5">
                    {tarefasConcluidas.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma ainda.</p>}
                    {tarefasConcluidas.map((t) => <TarefaRow key={t.id} t={t} concluida onToggle={() => toggleTarefa.mutate({ id: t.id, concluida: false })} onEdit={() => abrirTarefa(t)} />)}
                  </div>
                )}
              </div>
            </Cf2Card>
          </Cf2TabsContent>

          {/* ═══ DOCUMENTOS ═══ */}
          <Cf2TabsContent value="documentos">
            <div className="space-y-4">
              <Cf2Card>
                <Cf2SectionHeader title="Propostas comerciais" />
                <div className="mt-3 space-y-1.5">
                  {propostas.length === 0 && <Cf2EmptyState title="Nenhuma proposta ainda" />}
                  {propostas.map((p) => {
                    const nomeArq = `Proposta #P-${String(p.numero).padStart(3, "0")}-v${p.versao}.pdf`;
                    const url = `/api/propostas/${p.id}/pdf`;
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <button type="button" onClick={() => abrirPreview(nomeArq, url, "application/pdf")} className="flex items-center gap-1.5 min-w-0 text-[13px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ color: "var(--cf2-text-primary)" }}>
                          <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{nomeArq}</span>
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" aria-label={`Baixar ${nomeArq}`} className="shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}><Download className="w-3.5 h-3.5" /></a>
                      </div>
                    );
                  })}
                </div>
              </Cf2Card>

              {contratos.length > 0 && (
                <Cf2Card>
                  <Cf2SectionHeader title="Contratos" />
                  <div className="mt-3 space-y-1.5">
                    {contratos.map((ct) => (
                      <div key={ct.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <span className="text-[13px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{ct.produto || "Contrato"}{ct.mrr ? ` · ${brl(ct.mrr)}/mês` : ct.valorSetup ? ` · ${brl(ct.valorSetup)}` : ""}</span>
                        <Cf2Badge variant={ct.status === "ativo" ? "success" : ct.status === "churned" || ct.status === "cancelado" ? "danger" : "neutral"}>{ct.status}</Cf2Badge>
                      </div>
                    ))}
                  </div>
                </Cf2Card>
              )}

              <Cf2Card>
                <div className="flex items-center justify-between">
                  <Cf2SectionHeader title={`Anexos (${anexosReais.length})`} subtitle="Arquivos e imagens enviados direto no CRM" />
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-[var(--cf2-accent-border)] rounded-lg px-1" style={{ color: "var(--cf2-success-text)" }}>
                    <Paperclip className="w-3.5 h-3.5" /> {uploadDocumento.isPending ? "Enviando…" : "Anexar arquivo"}
                    <input type="file" multiple className="sr-only" disabled={uploadDocumento.isPending} onChange={(e) => { const files = Array.from(e.target.files || []); files.forEach((f) => uploadDocumento.mutate(f)); e.target.value = ""; }} />
                  </label>
                </div>
                <div className="mt-3 space-y-1.5">
                  {anexosReais.length === 0 && <Cf2EmptyState title="Nenhum anexo ainda" description="Envie contratos, prints ou qualquer arquivo relevante pra esta oportunidade." />}
                  {anexosReais.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <button type="button" onClick={() => abrirPreview(a.nomeArquivo, a.url, a.tipoMime)} className="flex items-center gap-1.5 min-w-0 text-[13px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ color: "var(--cf2-text-primary)" }}>
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                        <span className="truncate">{a.nomeArquivo}</span>
                        <span className="shrink-0 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatBytes(a.tamanhoBytes)} · {formatDataHora(a.createdAt)}{a.notaId ? " · via nota" : ""}</span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <a href={a.url} target="_blank" rel="noreferrer" aria-label={`Baixar ${a.nomeArquivo}`} style={{ color: "var(--cf2-text-tertiary)" }}><Download className="w-3.5 h-3.5" /></a>
                        <button onClick={() => excluirAnexo.mutate(a.id)} aria-label={`Excluir ${a.nomeArquivo}`} style={{ color: "var(--cf2-danger-text)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </Cf2Card>

              <Cf2Card>
                <Cf2SectionHeader title={`Histórico migrado (${anexosLegado.length})`} subtitle="Importado do Zoho — pode não estar disponível pra baixar dependendo do ambiente" />
                <div className="mt-3 space-y-1.5">
                  {anexosLegado.length === 0 && <Cf2EmptyState title="Nenhum anexo" />}
                  {anexosLegado.map((doc) => {
                    const url = `/api/anexos-legado/${doc.id}/download`;
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        {doc.arquivoDisponivel ? (
                          <button type="button" onClick={() => abrirPreview(doc.nomeArquivo, url)} className="text-[13px] truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ color: "var(--cf2-text-primary)" }}>{doc.nomeArquivo}</button>
                        ) : (
                          <span className="text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{doc.nomeArquivo}</span>
                        )}
                        {doc.arquivoDisponivel ? (
                          <a href={url} className="flex items-center gap-1 text-[12px] font-medium shrink-0" style={{ color: "var(--cf2-success-text)" }}><Download className="w-3 h-3" /> Baixar</a>
                        ) : (
                          <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>Indisponível</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Cf2Card>
            </div>
          </Cf2TabsContent>
        </Cf2Tabs>
      </div>

      <TarefaFormModal
        open={tarefaModalOpen}
        onClose={() => { setTarefaModalOpen(false); setTarefaEditando(null); }}
        tarefa={tarefaEditando}
        defaultNegocioId={negocioId}
        defaultNegocioLabel={negocio.titulo}
        defaultTipo="diagnostico"
        invalidateKeys={[["tarefas", "negocio", negocioId]]}
      />
      <Cf2Sheet open={!!callSheet} onOpenChange={(v) => !v && setCallSheet(null)}>
        <Cf2SheetContent side="right" className="sm:!w-[600px] p-4" showCloseButton>
          {callSheet && <Cf2CallDetail conversa={callSheet} />}
        </Cf2SheetContent>
      </Cf2Sheet>

      {/* Preview inline de anexo/documento (25/08, pedido do Kauã: "não só
          baixar") — imagem e PDF o próprio navegador renderiza (img/iframe),
          sem lib nenhuma; resto não tem como (sem viewer de Office), cai
          pra baixar com aviso explícito em vez de fingir que abriu algo. */}
      <Cf2Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <Cf2DialogContent className="max-w-4xl w-[92vw] h-[85vh] flex flex-col">
          <Cf2DialogHeader className="flex-row items-center justify-between gap-3 pr-6">
            <Cf2DialogTitle className="truncate">{preview?.nome}</Cf2DialogTitle>
            {preview && <a href={preview.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] font-semibold shrink-0" style={{ color: "var(--cf2-accent-text)" }}><Download className="w-3.5 h-3.5" /> Baixar</a>}
          </Cf2DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto rounded-lg flex items-center justify-center" style={{ background: "var(--cf2-bg-canvas)" }}>
            {preview?.tipo === "imagem" && <img src={preview.url} alt={preview.nome} className="max-w-full max-h-full object-contain" />}
            {preview?.tipo === "pdf" && <iframe src={preview.url} title={preview.nome} className="w-full h-full" style={{ border: "none" }} />}
            {preview?.tipo === "outro" && (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <FileText className="w-8 h-8" style={{ color: "var(--cf2-text-tertiary)" }} />
                <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Pré-visualização não disponível pra este tipo de arquivo.</p>
                {preview && <a href={preview.url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}>Baixar {preview.nome}</a>}
              </div>
            )}
          </div>
        </Cf2DialogContent>
      </Cf2Dialog>
    </>
  );
}

function HeaderAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold";
  const style = { background: "var(--cf2-bg-canvas)", color: "var(--cf2-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <Link href={href} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</Link>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</button>;
}

// Badge de ícone colorido por seção (25/08, pedido do Kauã: "olha como a
// Início é rica em detalhe e cor, essa tela tá um lixo") — mesmo padrão já
// usado nos KPIs de Prospecção (ícone num quadrado com tinta translúcida da
// própria cor), reaproveitado aqui pra dar identidade visual a cada card
// da Visão Geral, em vez de título solto sem nenhum elemento gráfico.
function CardTitulo({ icon: Icon, tint, title, subtitle, dark }: { icon: typeof Phone; tint: string; title: string; subtitle?: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-[15px] font-semibold" style={{ color: dark ? "var(--cf2-chrome-text-primary)" : "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{title}</p>
        {subtitle && <p className="text-[12px]" style={{ color: dark ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-secondary)" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function HeaderMetric({ label, value, sub, warn, hero }: { label: string; value: string; sub?: string; warn?: boolean; hero?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</span>
      {/* Métrica principal em destaque com a cor de marca (25/08, mesmo
          tratamento do número hero de "Pulso do Negócio" na Início — o
          resto das métricas fica no branco padrão do header escuro). */}
      <span className={hero ? "text-[26px] font-bold" : "text-[14px] font-bold"} style={{ color: warn ? "#fbbf24" : hero ? "var(--cf2-accent)" : "var(--cf2-chrome-text-primary)", fontFamily: hero ? "var(--cf2-font-heading)" : undefined }}>{value}{warn && " ⚠"}</span>
      {sub && <span className="text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{sub}</span>}
    </div>
  );
}

function MiniAction({ icon: Icon, href, label }: { icon: typeof Phone; href?: string; label: string }) {
  if (!href) return <span className="flex items-center justify-center w-7 h-7 rounded-lg opacity-30" style={{ color: "var(--cf2-text-tertiary)" }}><Icon className="w-3.5 h-3.5" /></span>;
  return <Link href={href} aria-label={label} title={label} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5" style={{ color: "var(--cf2-text-secondary)" }}><Icon className="w-3.5 h-3.5" /></Link>;
}

function FeedColuna({ titulo, eventos, onAbrirLigacao, vazio }: { titulo: string; eventos: EventoFeed[]; onAbrirLigacao: (a: Atividade) => void; vazio: string }) {
  return (
    <Cf2Card>
      <Cf2Eyebrow>{titulo}</Cf2Eyebrow>
      <div className="mt-3">
        {eventos.length === 0 ? (
          <Cf2EmptyState title={vazio} />
        ) : (
          <div className="flex flex-col max-h-[560px] overflow-y-auto">
            {eventos.map((e) => {
              const clicavel = e.tipo === "ligacao" && !!e.ref?.dados?.ligacaoId;
              return (
                <button
                  key={e.id}
                  onClick={clicavel ? () => onAbrirLigacao(e.ref!) : undefined}
                  disabled={!clicavel}
                  className="flex items-start justify-between gap-3 py-2.5 text-left w-full disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]"
                  style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{e.titulo}{clicavel && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}>Ver detalhes →</span>}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{formatDataHora(e.data)}{e.autor ? ` · ${e.autor}` : ""}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>{TIPO_EVENTO_LABEL[e.tipo] || e.tipo}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Cf2Card>
  );
}

function NotaRow({ n, anexos, onPreview }: { n: Nota; anexos: Anexo[]; onPreview: (nome: string, url: string, tipoMime?: string | null) => void }) {
  return (
    <div className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{n.autorNome || "—"}</span>
        <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatDataHora(n.createdAt)}</span>
      </div>
      <p className="text-[13px] mt-1" style={{ color: "var(--cf2-text-primary)" }}>{n.conteudo}</p>
      {anexos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {anexos.map((a) => (
            <button key={a.id} type="button" onClick={() => onPreview(a.nomeArquivo, a.url, a.tipoMime)} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
              <Paperclip className="w-3 h-3 shrink-0" /> {a.nomeArquivo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</span>
      <span className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{value}</span>
    </div>
  );
}


function InsightsNegocio({ propostasCount, interacoes, ultimoContato, semProximaAcao, previsaoVencida }: {
  propostasCount: number; interacoes: number; ultimoContato: { quando: string; canal: string } | null; semProximaAcao: boolean; previsaoVencida: boolean;
}) {
  const items: { icon: typeof Target; label: string; tom: "neutral" | "warning" }[] = [
    { icon: FileText, label: `${propostasCount} proposta${propostasCount === 1 ? "" : "s"} nesta oportunidade`, tom: "neutral" },
    { icon: TrendingUp, label: `${interacoes} interação${interacoes === 1 ? "" : "ões"} registrada${interacoes === 1 ? "" : "s"}`, tom: "neutral" },
    { icon: Clock, label: ultimoContato ? `Último contato ${ultimoContato.quando} (${ultimoContato.canal})` : "Nenhum contato registrado ainda", tom: "neutral" },
  ];
  if (semProximaAcao) items.push({ icon: AlertTriangle, label: "Sem próxima ação definida", tom: "warning" });
  if (previsaoVencida) items.push({ icon: AlertTriangle, label: "Previsão de fechamento vencida", tom: "warning" });
  // Card escuro de propósito (25/08, pedido do Kauã comparando com a
  // Início: "olha como é rica em cor, preto e branco" — lá o card "TOP
  // Vendedores" quebra o branco corrido da página do mesmo jeito). Mesmo
  // tom de fundo já usado no chrome escuro do header desta página
  // (`--cf2-chrome-bg-alt`), não é cor nova.
  return (
    <div data-cf2-superficie="escura" className="rounded-2xl p-5" style={{ background: "var(--cf2-chrome-bg-alt)", boxShadow: "var(--cf2-shadow-card-sm)" }}>
      <CardTitulo icon={Sparkles} tint="var(--cf2-accent)" title="Insights do negócio" dark />
      <div className="mt-3 space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: it.tom === "warning" ? "color-mix(in srgb, var(--cf2-warning-text) 14%, transparent)" : "rgba(255,255,255,0.06)" }}>
            <it.icon className="w-3.5 h-3.5 shrink-0" style={{ color: it.tom === "warning" ? "var(--cf2-warning-text)" : "var(--cf2-chrome-text-secondary)" }} />
            <span className="text-[12px]" style={{ color: it.tom === "warning" ? "var(--cf2-warning-text)" : "var(--cf2-chrome-text-primary)" }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Card expansível de composição comercial baseada numa proposta — mesmo
// formato do `PropostaResumo` do NegocioDrawer (item a item + "Rec: X/mês ·
// Avulso: Y" + Total + link), só em tema claro (aqui é corpo claro da
// página, não o chrome escuro do drawer). Pedido explícito do Kauã (25/08,
// com referência visual) pro fallback de "Composição comercial" quando o
// Commercial Core ainda não sincronizou os itens dessa proposta.
function PropostaComposicaoCard({ p }: { p: PropostaCompleta }) {
  const [aberto, setAberto] = useState(true);
  const display = resolvePropostaDisplay({ numero: p.numero, status: p.status, totalGeral: p.totalGeral, primeiraVisualizacaoEm: p.primeiraVisualizacaoEm, clienteRespondeuEm: p.clienteRespondeuEm, dataValidade: p.dataValidade });
  const tomVariant: Record<string, "success" | "warning" | "neutral" | "danger"> = { success: "success", warning: "warning", neutral: "neutral", danger: "danger" };
  const rec = parseFloat(p.totalRecorrente || "0") || 0;
  const avulso = parseFloat(p.totalAvulso || "0") || 0;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cf2-border-default)" }}>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)" }} aria-expanded={aberto}>
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ color: "var(--cf2-text-tertiary)", transform: aberto ? "rotate(0deg)" : "rotate(-90deg)" }} />
          <span className="font-mono font-semibold text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>#P-{String(p.numero).padStart(3, "0")}-v{p.versao}</span>
          <Cf2Badge variant={tomVariant[display.tom]}>{display.label}</Cf2Badge>
        </span>
        <span className="text-[13px] font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.totalGeral)}</span>
      </button>
      {aberto && p.itens && p.itens.length > 0 && (
        <div className="p-3 flex flex-col gap-1.5">
          {p.itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</span>
              <span className="shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>{parseFloat(item.quantidade) > 1 ? `${item.quantidade}x ` : ""}{brl(item.valorUnitario)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1.5 mt-0.5 text-[12px]" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
            <span>{rec > 0 && `Rec: ${brl(rec)}/mês`}{rec > 0 && avulso > 0 && " · "}{avulso > 0 && `Avulso: ${brl(avulso)}`}</span>
            <span className="font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>Total: {brl(p.totalGeral)}</span>
          </div>
          <Link href={`/propostas/${p.id}`} className="text-[12px] font-medium text-center mt-0.5" style={{ color: "var(--cf2-accent-text)" }}>Ver proposta completa</Link>
        </div>
      )}
    </div>
  );
}

function PropostaRow({ p, detalhada }: { p: PropostaCompleta; detalhada?: boolean }) {
  const display = resolvePropostaDisplay({ numero: p.numero, status: p.status, totalGeral: p.totalGeral, primeiraVisualizacaoEm: p.primeiraVisualizacaoEm, clienteRespondeuEm: p.clienteRespondeuEm, dataValidade: p.dataValidade });
  const tomVariant: Record<string, "success" | "warning" | "neutral" | "danger"> = { success: "success", warning: "warning", neutral: "neutral", danger: "danger" };
  return (
    <Link href={`/propostas/${p.id}`} className="block p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}><FileText className="w-3.5 h-3.5" /> #P-{String(p.numero).padStart(3, "0")}-v{p.versao}</span>
        <div className="flex items-center gap-2 shrink-0">
          <Cf2Badge variant={tomVariant[display.tom]}>{display.label}</Cf2Badge>
          <span className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.totalGeral)}</span>
        </div>
      </div>
      {detalhada && (
        <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap" style={{ color: "var(--cf2-text-tertiary)" }}>
          {p.enviadaEm && <span>Enviada {new Date(p.enviadaEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
          {p.dataValidade && <span>Válida até {new Date(p.dataValidade).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
          {p.visualizacoes > 0 && <span>{p.visualizacoes} visualização{p.visualizacoes === 1 ? "" : "ões"}</span>}
        </div>
      )}
    </Link>
  );
}

function TarefaRow({ t, atrasada, concluida, onToggle, onEdit }: { t: Tarefa; atrasada?: boolean; concluida?: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: atrasada ? "color-mix(in srgb, var(--cf2-danger-text) 10%, transparent)" : "var(--cf2-bg-surface-muted)" }}>
      <button onClick={onToggle} aria-label={concluida ? "Reabrir tarefa" : "Concluir tarefa"} className="shrink-0">
        {concluida ? <CheckCircle2 className="w-4 h-4" style={{ color: "var(--cf2-success-text)" }} /> : <Circle className="w-4 h-4" style={{ color: atrasada ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }} />}
      </button>
      <button onClick={onEdit} className="flex-1 text-left min-w-0">
        <p className="text-[13px] truncate" style={{ color: "var(--cf2-text-primary)", textDecoration: concluida ? "line-through" : "none" }}>{t.titulo}</p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {t.responsavelNome && <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{t.responsavelNome}</span>}
        {t.dataVencimento && <span className="text-[11px]" style={{ color: atrasada ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }}>{new Date(t.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
      </div>
    </div>
  );
}
