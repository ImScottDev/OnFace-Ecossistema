"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone, Mail, MessageCircle, CheckSquare,
  CheckCircle2, Circle, Clock, AlertTriangle, CalendarClock, Activity, Video,
  Lock, ChevronDown, ChevronRight, MoreHorizontal, FileText, ExternalLink,
} from "lucide-react";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { toastDark } from "@/components/crm2/shared/toast-dark";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { Cf2DropdownMenu, Cf2DropdownMenuTrigger, Cf2DropdownMenuContent, Cf2DropdownMenuItem } from "@/components/crm2/ui/DropdownMenu";
import { Cf2Card } from "@/components/crm2/ui/Card";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle, Cf2DialogFooter } from "@/components/crm2/ui/Dialog";
import { Cf2Input, Cf2Textarea, Cf2Label } from "@/components/crm2/ui/Input";

interface Item {
  id: string;
  workstream: string;
  titulo: string;
  status: string;
  blockerType: string | null;
  blockerReason: string | null;
  ordem: number;
  completedAt: string | null;
  completedByNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
}

interface Pessoa { leadId: string; nome: string; telefone: string | null; email: string | null; cargo: string | null; papel: string | null }
interface TarefaOnboarding { id: string; titulo: string; prioridade: string; venceEm: string | null; concluida: boolean; concluidaEm: string | null; usuarioId: string | null; usuarioNome: string | null }
interface ProximaReuniao { id: string; titulo: string; data: string; duracao: number | null; link: string | null; participantes: string[] | null; tipo: string | null }
interface ReuniaoHistorico { id: string; titulo: string; data: string; status: string; createdAt: string }
interface MensagemWhatsapp { id: string; direcao: string; createdAt: string; enviadoPorNome: string | null }
interface PropostaItem { id: string; nome: string; subtotal: string | number; quantidade?: number }
interface PropostaResumo { id: string; numero: number; versao: number; status: string; totalRecorrente: string | number | null; totalAvulso: string | number | null; valorTotal: string | number | null; itens: PropostaItem[] }

interface FulfillmentDetalhe {
  fulfillment: {
    id: string; status: string; serviceFamily: string; responsavelId: string | null; responsavelNome: string | null;
    startedAt: string | null; targetAt: string | null; completedAt: string | null; servicoCanonicoId: string;
  };
  itens: Item[];
  canonicalProduct: string | null;
  currentRecurringValue: string | number | null;
  empresaId: string | null; empresaNome: string | null; empresaWebsite: string | null; empresaLogoUrl: string | null;
  leadId: string | null; leadNome: string | null; leadTelefone: string | null; leadEmail: string | null; leadCargo: string | null;
  proximaAcao: { id: string; titulo: string; venceEm: string | null; usuarioId: string | null; usuarioNome: string | null } | null;
  responsavelComercialNome: string | null;
  negocioId: string | null; negocioTitulo: string | null; propostaId: string | null; propostaNumero: number | null;
  atividadesEmpresa: { id: string; tipo: string; titulo: string; descricao: string | null; createdAt: string; autorNome: string | null }[];
  assinatura: { status: string; mrr: string | number | null; moeda: string | null; currentPeriodEnd: string | null; stripeSubscriptionId: string | null; canceladaEm: string | null } | null;
  pessoasEnvolvidas: Pessoa[];
  contextoVenda: string | null;
  proximaReuniao: ProximaReuniao | null;
  tarefasOnboarding: TarefaOnboarding[];
  todasReunioes: ReuniaoHistorico[];
  mensagensWhatsapp: MensagemWhatsapp[];
}

// Duplicado de lib/crm/fulfillment.ts (não pode importar aqui — aquele
// módulo carrega o driver do Postgres, quebraria o bundle do client).
const MARCOS_AI = [
  { key: "abertura_validacao", label: "Abertura e validação" },
  { key: "acessos_integracao", label: "Acessos e integração" },
  { key: "usuarios_times", label: "Usuários e times" },
  { key: "primeira_ligacao", label: "Primeira ligação" },
  { key: "scorecard_insights", label: "Scorecard e Insights" },
  { key: "campanhas", label: "Tarefas, relatórios e campanhas" },
  { key: "agente_ia", label: "Agente de IA" },
  { key: "first_message_testes", label: "First Message e testes" },
  { key: "sla_canais", label: "SLA e canais" },
  { key: "validacao_final", label: "Validação final" },
] as const;
const MARCO_POR_WORKSTREAM: Record<string, string> = {
  abertura: "abertura_validacao", dados_empresa: "abertura_validacao",
  crm_integracao: "acessos_integracao", acessos: "acessos_integracao",
  usuarios_times: "usuarios_times",
  primeira_ligacao: "primeira_ligacao",
  scorecard_insights: "scorecard_insights", proximos_passos: "scorecard_insights", relatorios: "scorecard_insights",
  reunioes_online: "campanhas", campanhas: "campanhas",
  agente_prompt: "agente_ia", agente_config: "agente_ia",
  first_message: "first_message_testes", bateria_testes: "first_message_testes",
  sla_canais: "sla_canais",
  validacao_final: "validacao_final",
};

const ITEM_STATUS_INFO: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  DONE: { label: "Concluído", color: "var(--cf2-success-text)", icon: CheckCircle2 },
  IN_PROGRESS: { label: "Em andamento", color: "var(--cf2-informativo-fg)", icon: Clock },
  VALIDATION: { label: "Validação", color: "#8b5cf6", icon: Clock },
  BLOCKED: { label: "Bloqueado", color: "var(--cf2-danger-text)", icon: AlertTriangle },
  PENDING: { label: "Não iniciado", color: "var(--cf2-text-tertiary)", icon: Circle },
  NOT_APPLICABLE: { label: "Não aplicável", color: "var(--cf2-text-tertiary)", icon: Lock },
};
const BLOCKER_LABEL: Record<string, string> = { CUSTOMER: "Aguardando cliente", INTERNAL: "Aguardando interno", PROVIDER: "Aguardando fornecedor" };
const PAPEL_LABEL: Record<string, string> = { decisor: "Decisor", tecnico: "Responsável técnico", influenciador: "Influenciador", contato: "Contato principal" };
const ESTADO_BADGE: Record<string, "success" | "warning" | "danger" | "neutral" | "accent"> = {
  NOT_STARTED: "neutral", IN_PROGRESS: "accent", READY_FOR_VALIDATION: "accent",
  BLOCKED_CUSTOMER: "warning", BLOCKED_INTERNAL: "danger", BLOCKED_PROVIDER: "danger", COMPLETED: "success",
};
const ESTADO_LABEL: Record<string, string> = {
  NOT_STARTED: "Aguardando primeiro contato", IN_PROGRESS: "Em andamento", READY_FOR_VALIDATION: "Aguardando validação final",
  BLOCKED_CUSTOMER: "Aguardando cliente", BLOCKED_INTERNAL: "Bloqueado (interno)", BLOCKED_PROVIDER: "Bloqueado (fornecedor)", COMPLETED: "Concluído",
};
const MARCO_BADGE: Record<string, "success" | "warning" | "danger" | "neutral" | "accent"> = {
  concluido: "success", em_andamento: "accent", bloqueado: "danger", nao_aplicavel: "neutral", pendente: "neutral",
};
const MARCO_LABEL: Record<string, string> = { concluido: "Concluído", em_andamento: "Em andamento", bloqueado: "Bloqueado", nao_aplicavel: "Não aplicável", pendente: "Pendente" };

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function brl(v: string | number | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}
function diasDesde(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}
function atendimentoHref(leadId: string, canal: "whatsapp" | "email" | "ligacao", telefone?: string | null, texto?: string) {
  const params = new URLSearchParams({ leadId, canal });
  if (telefone) params.set("telefone", telefone);
  if (texto) params.set("texto", texto);
  return `/atendimento?${params.toString()}`;
}

const secLabel = { color: "var(--cf2-text-tertiary)" };

/**
 * Detalhe DEDICADO de Onboarding (Callface AI) — 3ª reconstrução, 25/08.
 * A 2ª versão ainda usava divs cruas com style inline em vez do design
 * system real do CRM2 (Cf2Card/Cf2Button/Cf2Badge/Cf2Dialog), era
 * mx-auto/max-w (desalinhado das outras telas, que vão full-width), abria
 * um mini-modal próprio pra WhatsApp em vez de levar pro Atendimento (que
 * já resolve isso de verdade), e não mostrava o que foi contratado de
 * verdade (só um campo de catálogo quase sempre vazio). Esta versão corrige
 * os 4 pontos: componentes reais, largura igual às telas vizinhas
 * (negócio/cliente), Ligar/WhatsApp/E-mail levam pro Atendimento (com
 * mensagem pronta quando aplicável), e "o que foi contratado" reusa a
 * proposta de verdade (mesmo padrão PropostaResumo do drawer de negócio),
 * não um campo de catálogo isolado.
 */
export function Cf2OnboardingDetail({ fulfillmentId }: { fulfillmentId: string }) {
  const queryClient = useQueryClient();
  const { usuarios } = useOrgUsuarios();

  const [marcoExpandido, setMarcoExpandido] = useState<string | null>(null);
  const [blockerAberto, setBlockerAberto] = useState<Item | null>(null);
  const [blockerReasonInput, setBlockerReasonInput] = useState("");
  const [tarefaAberta, setTarefaAberta] = useState(false);
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [reuniaoAberta, setReuniaoAberta] = useState(false);
  const [reuniaoData, setReuniaoData] = useState("");
  const [reuniaoHora, setReuniaoHora] = useState("10:00");
  const [reuniaoDuracao, setReuniaoDuracao] = useState(30);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cf2-onboarding-detail", fulfillmentId] });

  const { data, isLoading } = useQuery<FulfillmentDetalhe>({
    queryKey: ["cf2-onboarding-detail", fulfillmentId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}`);
      if (!r.ok) throw new Error("Onboarding não encontrado");
      return r.json();
    },
  });

  // "O que foi contratado" real (25/08, achado do Kauã: "não tenho os
  // produtos que foram contratados" — o campo de catálogo isolado
  // (canonicalProduct) quase sempre está vazio; a proposta aceita É a
  // fonte real do que foi vendido, mesmo dado que o drawer de Negócio já
  // usa via PropostaResumo). Reusa GET /negocios/:id, que já retorna
  // propostas com itens — nenhum endpoint novo.
  const { data: negocioDetail } = useQuery<{ propostas?: PropostaResumo[] }>({
    queryKey: ["cf2-onboarding-negocio", data?.negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/negocios/${data!.negocioId}`);
      if (!r.ok) return { propostas: [] };
      return r.json();
    },
    enabled: !!data?.negocioId,
  });
  const ultimaProposta = negocioDetail?.propostas?.[0] ?? null;

  const patchItem = useMutation({
    mutationFn: async (vars: { itemId: string; status: string; blockerType?: string | null; blockerReason?: string | null }) => {
      const r = await fetch(`/api/fulfillments/itens/${vars.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status, blockerType: vars.blockerType ?? null, blockerReason: vars.blockerReason ?? null }),
      });
      if (!r.ok) throw new Error("Falha ao atualizar item");
      return r.json();
    },
    onSuccess: () => invalidate(),
    onError: () => toastDark.error("Não foi possível atualizar o item"),
  });

  const marcarMarcoNaoAplicavel = useMutation({
    mutationFn: async (itemIds: string[]) => {
      await Promise.all(itemIds.map((id) => fetch(`/api/fulfillments/itens/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "NOT_APPLICABLE" }),
      })));
    },
    onSuccess: () => { invalidate(); toastDark.success("Etapa marcada como não aplicável"); },
    onError: () => toastDark.error("Não foi possível marcar a etapa"),
  });

  const concluirOnboarding = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}/concluir`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "concluir_onboarding" }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Falha ao concluir");
      return json;
    },
    onSuccess: () => { invalidate(); toastDark.success("Onboarding concluído e enviado para CS"); },
    onError: (e: Error) => toastDark.error(e.message),
  });

  const criarTarefa = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/tarefas", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: data!.leadId, titulo: tarefaTitulo, tipo: "geral", prioridade: "media" }),
      });
      if (!r.ok) throw new Error("Falha ao criar tarefa");
      return r.json();
    },
    onSuccess: () => { setTarefaAberta(false); setTarefaTitulo(""); invalidate(); toastDark.success("Tarefa criada"); },
    onError: () => toastDark.error("Não foi possível criar a tarefa"),
  });

  const agendarReuniao = useMutation({
    mutationFn: async () => {
      const iso = new Date(`${reuniaoData}T${reuniaoHora}:00`).toISOString();
      const r = await fetch("/api/reunioes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: data!.leadId, titulo: `Reunião de onboarding — ${data!.empresaNome || data!.leadNome}`,
          data: iso, duracao: reuniaoDuracao, tipo: "video", attendeeEmail: data!.leadEmail || undefined,
        }),
      });
      if (!r.ok) throw new Error("Falha ao agendar reunião");
      return r.json();
    },
    onSuccess: () => { setReuniaoAberta(false); invalidate(); toastDark.success("Reunião agendada"); },
    onError: () => toastDark.error("Não foi possível agendar a reunião"),
  });

  // Timeline unificada (25/08) — mescla atividades genéricas + reuniões +
  // WhatsApp reais, mesmas fontes já usadas em Atendimento/Página da
  // Pessoa. Lista vertical (não cards horizontais — achado do Kauã: "a
  // timeline não ficou boa" na versão em cards cortados).
  const timeline = useMemo(() => {
    if (!data) return [];
    type Evento = { id: string; titulo: string; data: string; autor: string | null; icon: typeof Activity };
    const eventos: Evento[] = [
      ...data.atividadesEmpresa.map((a) => ({ id: a.id, titulo: a.titulo, data: a.createdAt, autor: a.autorNome, icon: Activity })),
      ...data.todasReunioes.map((r) => ({ id: `r-${r.id}`, titulo: r.status === "realizada" ? `${r.titulo} — realizada` : r.status === "cancelada" ? `${r.titulo} — cancelada` : `${r.titulo} — agendada`, data: r.createdAt, autor: null, icon: Video })),
      ...data.mensagensWhatsapp.map((m) => ({ id: `w-${m.id}`, titulo: m.direcao === "out" ? "WhatsApp enviado" : "WhatsApp recebido", data: m.createdAt, autor: m.enviadoPorNome, icon: MessageCircle })),
    ];
    return eventos.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
  }, [data]);

  if (isLoading || !data) {
    return <p className="text-[13px]" style={secLabel}>Carregando...</p>;
  }

  const { fulfillment, itens, proximaReuniao, pessoasEnvolvidas, tarefasOnboarding, contextoVenda } = data;
  const totalItens = itens.length;
  const concluidosOuNA = itens.filter((i) => i.status === "DONE" || i.status === "NOT_APPLICABLE").length;
  const pct = totalItens > 0 ? Math.round((concluidosOuNA / totalItens) * 100) : 0;
  const ultimaAtividade = data.atividadesEmpresa[0] ?? null;
  const tarefasAbertas = tarefasOnboarding.filter((t) => !t.concluida);
  const proximaTarefaAberta = tarefasAbertas[0] ?? null;
  const podeConcluir = fulfillment.status === "READY_FOR_VALIDATION";
  const jaConcluido = fulfillment.status === "COMPLETED";

  const porMarco = new Map<string, Item[]>();
  for (const m of MARCOS_AI) porMarco.set(m.key, []);
  for (const item of itens) porMarco.get(MARCO_POR_WORKSTREAM[item.workstream] ?? MARCOS_AI[0].key)?.push(item);

  const marcos = MARCOS_AI.map((m) => {
    const lista = porMarco.get(m.key) ?? [];
    const total = lista.length;
    const done = lista.filter((i) => i.status === "DONE").length;
    const na = lista.filter((i) => i.status === "NOT_APPLICABLE").length;
    const bloqueado = lista.some((i) => i.status === "BLOCKED");
    const naoAplicavel = total > 0 && na === total;
    const completo = total > 0 && done + na === total;
    const emAndamento = !completo && (done > 0 || lista.some((i) => i.status === "IN_PROGRESS" || i.status === "VALIDATION"));
    const status = naoAplicavel ? "nao_aplicavel" : completo ? "concluido" : bloqueado ? "bloqueado" : emAndamento ? "em_andamento" : "pendente";
    return { ...m, itens: lista, total, done, na, status };
  });
  const marcoAtualKey = marcos.find((m) => m.status !== "concluido" && m.status !== "nao_aplicavel")?.key ?? null;

  const templateWhatsapp = `Oi, ${data.leadNome ?? ""}! 👋 Sou do time de onboarding da Callface e vou conduzir os próximos passos da sua ativação. Vamos agendar nossa reunião?`;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex items-center justify-between">
        <p className="text-[12px] flex items-center gap-1" style={secLabel}>
          Onboarding <ChevronRight className="w-3 h-3" /> <span style={{ color: "var(--cf2-text-primary)", fontWeight: 600 }}>{data.empresaNome || data.leadNome}</span>
        </p>
        <Cf2DropdownMenu>
          <Cf2DropdownMenuTrigger asChild>
            <Cf2Button variant="secondary" size="sm">Mais ações <MoreHorizontal className="w-3.5 h-3.5" /></Cf2Button>
          </Cf2DropdownMenuTrigger>
          <Cf2DropdownMenuContent align="end">
            {data.leadId && <Cf2DropdownMenuItem onSelect={() => setTarefaAberta(true)}><CheckSquare className="w-3.5 h-3.5" /> Criar tarefa</Cf2DropdownMenuItem>}
            {data.leadId && <Cf2DropdownMenuItem onSelect={() => setReuniaoAberta(true)}><CalendarClock className="w-3.5 h-3.5" /> Agendar reunião</Cf2DropdownMenuItem>}
          </Cf2DropdownMenuContent>
        </Cf2DropdownMenu>
      </div>

      <Cf2Card className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-bold" style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}>{(data.empresaNome || data.leadNome || "—").slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{data.empresaNome || data.leadNome || "—"}</p>
              <Cf2Badge variant={ESTADO_BADGE[fulfillment.status] ?? "neutral"}>{ESTADO_LABEL[fulfillment.status] ?? fulfillment.status}</Cf2Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
              {data.negocioTitulo && data.negocioId ? <>Negócio: <a href={`/negocios/${data.negocioId}`} className="font-semibold" style={{ color: "var(--cf2-accent-border)" }}>{data.negocioTitulo}</a></> : <span style={secLabel}>Sem negócio vinculado</span>}
              {data.propostaId && <>· Proposta: <a href={`/propostas/${data.propostaId}`} className="font-semibold" style={{ color: "var(--cf2-accent-border)" }}>{data.propostaNumero ? `#P-${data.propostaNumero}` : "ver"}</a></>}
            </div>
            <div className="flex items-center gap-2 mt-3">
              {data.leadId && <Cf2Button asChild variant="secondary" size="sm"><a href={atendimentoHref(data.leadId, "ligacao", data.leadTelefone)}><Phone className="w-3.5 h-3.5" /> Ligar</a></Cf2Button>}
              {data.leadId && <Cf2Button asChild variant="secondary" size="sm"><a href={atendimentoHref(data.leadId, "whatsapp", data.leadTelefone)}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a></Cf2Button>}
              {data.leadId && data.leadEmail && <Cf2Button asChild variant="secondary" size="sm"><a href={atendimentoHref(data.leadId, "email")}><Mail className="w-3.5 h-3.5" /> E-mail</a></Cf2Button>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="text-[10px] font-bold uppercase" style={secLabel}>Responsável</p>
          <AssignOwnerControl entityType="fulfillment" entityId={fulfillment.id} currentOwnerId={fulfillment.responsavelId} usuarios={usuarios} onChanged={invalidate} />
        </div>
      </Cf2Card>

      <div className="grid grid-cols-5 gap-3">
        <Cf2Card className="flex flex-col gap-1.5" padding="14px">
          <p className="text-[9px] font-bold uppercase" style={secLabel}>Progresso geral</p>
          <p className="text-[20px] font-bold" style={{ color: "var(--cf2-success-text)" }}>{pct}%</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cf2-success-text)" }} /></div>
          <p className="text-[10px]" style={secLabel}>{marcos.filter((m) => m.status === "concluido").length} de {marcos.length} etapas concluídas</p>
        </Cf2Card>
        <Cf2Card className="flex flex-col gap-1.5" padding="14px">
          <p className="text-[9px] font-bold uppercase" style={secLabel}>Tempo no onboarding</p>
          <p className="text-[20px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{diasDesde(fulfillment.startedAt) ?? "—"} {diasDesde(fulfillment.startedAt) === 1 ? "dia" : "dias"}</p>
          <p className="text-[10px]" style={secLabel}>Desde {formatarData(fulfillment.startedAt)}</p>
        </Cf2Card>
        <Cf2Card className="flex flex-col gap-1.5" padding="14px">
          <p className="text-[9px] font-bold uppercase" style={secLabel}>Próxima ação</p>
          <p className="text-[12px] font-semibold truncate mt-1" style={{ color: "var(--cf2-text-primary)" }}>{proximaTarefaAberta?.titulo ?? (proximaReuniao ? "Reunião de onboarding" : "Agendar primeiro contato")}</p>
          <p className="text-[10px]" style={secLabel}>{proximaTarefaAberta?.venceEm ? formatarData(proximaTarefaAberta.venceEm) : proximaReuniao ? formatarDataHora(proximaReuniao.data) : ""}</p>
        </Cf2Card>
        <Cf2Card className="flex flex-col gap-1.5" padding="14px">
          <p className="text-[9px] font-bold uppercase" style={secLabel}>Última atividade</p>
          <p className="text-[12px] font-semibold truncate mt-1" style={{ color: "var(--cf2-text-primary)" }}>{ultimaAtividade?.titulo ?? "Sem registro"}</p>
          <p className="text-[10px]" style={secLabel}>{ultimaAtividade ? formatarDataHora(ultimaAtividade.createdAt) : "—"}</p>
        </Cf2Card>
        <Cf2Card className="flex flex-col gap-1.5" padding="14px">
          <p className="text-[9px] font-bold uppercase" style={secLabel}>Reunião agendada</p>
          <p className="text-[12px] font-semibold truncate mt-1" style={{ color: "var(--cf2-text-primary)" }}>{proximaReuniao ? formatarDataHora(proximaReuniao.data) : "Sem reunião"}</p>
          <p className="text-[10px]" style={secLabel}>{proximaReuniao?.duracao ? `${proximaReuniao.duracao}min` : ""}</p>
        </Cf2Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Cf2Card className="col-span-2 flex flex-col gap-3">
          <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Próxima ação</p>
          {proximaReuniao ? (
            <>
              <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{proximaReuniao.titulo} — {formatarDataHora(proximaReuniao.data)}{proximaReuniao.duracao ? ` · ${proximaReuniao.duracao}min` : ""}</p>
              <div className="flex items-center gap-2">
                {proximaReuniao.link && <Cf2Button asChild size="sm"><a href={proximaReuniao.link} target="_blank" rel="noreferrer"><Video className="w-3.5 h-3.5" /> Entrar na reunião</a></Cf2Button>}
                <Cf2Button variant="secondary" size="sm" onClick={() => setReuniaoAberta(true)}>Reagendar</Cf2Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Agendar e conduzir reunião de onboarding com o cliente — é onde a maior parte do onboarding acontece.</p>
              <Cf2Button size="sm" className="self-start" onClick={() => setReuniaoAberta(true)}><CalendarClock className="w-3.5 h-3.5" /> Agendar reunião</Cf2Button>
            </>
          )}
          {data.leadId && (
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "var(--cf2-success-bg)" }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-success-text)" }}>Template WhatsApp</p>
              <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{templateWhatsapp}</p>
              <Cf2Button asChild size="sm" className="self-start" style={{ background: "var(--cf2-success-text)" }}>
                <a href={atendimentoHref(data.leadId, "whatsapp", data.leadTelefone, templateWhatsapp)}>Usar template</a>
              </Cf2Button>
            </div>
          )}
        </Cf2Card>

        <Cf2Card className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase" style={secLabel}>O que foi contratado</p>
          {ultimaProposta ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-mono font-semibold" style={{ color: "var(--cf2-text-primary)" }}>#P-{String(ultimaProposta.numero).padStart(3, "0")}-v{ultimaProposta.versao}</span>
                <Cf2Badge variant={ultimaProposta.status === "aceita" ? "success" : ultimaProposta.status === "recusada" ? "danger" : "neutral"}>{ultimaProposta.status}</Cf2Badge>
              </div>
              {ultimaProposta.itens.length > 0 && (
                <div className="flex flex-col gap-1">
                  {ultimaProposta.itens.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate" style={{ color: "var(--cf2-text-secondary)" }}>{item.nome}</span>
                      <span className="shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-2 text-[12px]" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                <span style={secLabel}>
                  {parseFloat(String(ultimaProposta.totalRecorrente ?? 0)) > 0 && `Rec: ${brl(ultimaProposta.totalRecorrente)}/mês`}
                  {parseFloat(String(ultimaProposta.totalAvulso ?? 0)) > 0 && ` · Avulso: ${brl(ultimaProposta.totalAvulso)}`}
                </span>
                <span className="font-bold" style={{ color: "var(--cf2-text-primary)" }}>Total: {brl(ultimaProposta.valorTotal)}</span>
              </div>
              <a href={`/propostas/${ultimaProposta.id}`} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--cf2-accent-border)" }}>Ver proposta completa <ExternalLink className="w-3 h-3" /></a>
            </>
          ) : (
            <p className="text-[11px]" style={secLabel}>Nenhuma proposta vinculada a este onboarding.</p>
          )}
          {contextoVenda && (
            <div>
              <p className="text-[9px] font-bold uppercase" style={secLabel}>Observações comerciais</p>
              <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{contextoVenda}</p>
            </div>
          )}
          {data.responsavelComercialNome && <p className="text-[10px]" style={secLabel}>Fechado por {data.responsavelComercialNome}</p>}
        </Cf2Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Cf2Card className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Jornada do onboarding</p>
            <p className="text-[11px] font-semibold" style={secLabel}>{marcos.filter((m) => m.status === "concluido").length} de {marcos.length} etapas concluídas</p>
          </div>
          <div className="flex flex-col gap-1">
            {marcos.map((m, i) => {
              const expandido = marcoExpandido === m.key;
              const atual = m.key === marcoAtualKey;
              return (
                <div key={m.key} style={{ borderTop: i > 0 ? "1px solid var(--cf2-border-default)" : "none" }}>
                  <button onClick={() => setMarcoExpandido(expandido ? null : m.key)} className="w-full flex items-center gap-3 py-2.5 text-left">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{
                      background: m.status === "concluido" ? "var(--cf2-success-text)" : atual ? "var(--cf2-accent-bg)" : "var(--cf2-bg-surface-muted)",
                      color: m.status === "concluido" ? "#fff" : atual ? "var(--cf2-accent-border)" : "var(--cf2-text-tertiary)",
                      border: atual ? "2px solid var(--cf2-accent-border)" : "none",
                    }}>
                      {m.status === "concluido" ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    {expandido ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={secLabel} /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={secLabel} />}
                    <p className="text-[12px] font-semibold truncate flex-1" style={{ color: "var(--cf2-text-primary)" }}>{m.label}</p>
                    <Cf2Badge variant={MARCO_BADGE[m.status]}>{MARCO_LABEL[m.status]}</Cf2Badge>
                    <span className="text-[11px] font-semibold shrink-0 w-10 text-right" style={secLabel}>{m.status === "nao_aplicavel" ? "–" : `${m.done}/${m.total}`}</span>
                  </button>
                  {expandido && (
                    <div className="pl-9 pb-3 flex flex-col gap-1">
                      {m.status !== "concluido" && m.status !== "nao_aplicavel" && (
                        <button onClick={() => marcarMarcoNaoAplicavel.mutate(m.itens.filter((i) => i.status !== "DONE").map((i) => i.id))} className="self-end text-[11px] font-semibold mb-1" style={{ color: "var(--cf2-accent-border)" }}>Marcar etapa inteira como não aplicável</button>
                      )}
                      {m.itens.map((item) => {
                        const itemInfo = ITEM_STATUS_INFO[item.status] ?? ITEM_STATUS_INFO.PENDING;
                        const Icon = itemInfo.icon;
                        const concluidoOuNA = item.status === "DONE" || item.status === "NOT_APPLICABLE";
                        return (
                          <div key={item.id} className="flex items-center gap-2.5 rounded-lg" style={{ background: item.status === "BLOCKED" ? "#ef444410" : "transparent" }}>
                            <button
                              onClick={() => {
                                if (item.status === "BLOCKED") { setBlockerAberto(item); setBlockerReasonInput(item.blockerReason ?? ""); return; }
                                patchItem.mutate({ itemId: item.id, status: concluidoOuNA ? "PENDING" : "DONE" });
                              }}
                              className="flex-1 flex items-center gap-2.5 py-1.5 text-left"
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: itemInfo.color }} />
                              <p className="text-[12px]" style={{ color: concluidoOuNA ? "var(--cf2-text-tertiary)" : "var(--cf2-text-primary)", textDecoration: item.status === "DONE" ? "line-through" : "none" }}>{item.titulo}</p>
                              {item.blockerType && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#ef444418", color: "var(--cf2-danger-text)" }}>{BLOCKER_LABEL[item.blockerType] ?? item.blockerType}</span>}
                            </button>
                            {!concluidoOuNA && item.status !== "BLOCKED" && (
                              <Cf2DropdownMenu>
                                <Cf2DropdownMenuTrigger asChild>
                                  <button className="shrink-0 p-1" aria-label="Mais ações"><MoreHorizontal className="w-3.5 h-3.5" style={secLabel} /></button>
                                </Cf2DropdownMenuTrigger>
                                <Cf2DropdownMenuContent align="end">
                                  <Cf2DropdownMenuItem onSelect={() => patchItem.mutate({ itemId: item.id, status: "NOT_APPLICABLE" })}>Marcar não aplicável</Cf2DropdownMenuItem>
                                  <Cf2DropdownMenuItem onSelect={() => { setBlockerAberto(item); setBlockerReasonInput(""); }}>Bloquear etapa</Cf2DropdownMenuItem>
                                </Cf2DropdownMenuContent>
                              </Cf2DropdownMenu>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: jaConcluido ? "var(--cf2-success-text)" : "var(--cf2-bg-surface-muted)", color: jaConcluido ? "#fff" : "var(--cf2-text-tertiary)" }}>
                {jaConcluido ? <CheckCircle2 className="w-3.5 h-3.5" /> : MARCOS_AI.length + 1}
              </div>
              <p className="text-[12px] font-semibold flex-1" style={{ color: "var(--cf2-text-primary)" }}>Concluir onboarding</p>
              <Cf2Badge variant={jaConcluido ? "success" : podeConcluir ? "accent" : "neutral"}>{jaConcluido ? "Concluído" : podeConcluir ? "Pronto pra concluir" : "Pendente"}</Cf2Badge>
              <span className="text-[11px] font-semibold w-10 text-right" style={secLabel}>{jaConcluido ? "1/1" : "0/1"}</span>
            </div>
          </div>
        </Cf2Card>

        <div className="flex flex-col gap-4">
          <Cf2Card className="flex flex-col gap-2" padding="16px">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pendências e tarefas</p>
              {data.leadId && <button onClick={() => setTarefaAberta(true)} className="text-[11px] font-semibold" style={{ color: "var(--cf2-accent-border)" }}>+ Nova</button>}
            </div>
            {tarefasAbertas.length === 0 ? (
              <p className="text-[11px]" style={secLabel}>Nenhuma pendência aberta.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tarefasAbertas.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                      <p className="text-[10px] truncate" style={secLabel}>{t.usuarioNome ?? "—"}</p>
                    </div>
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--cf2-danger-text)" }}>{t.venceEm ? formatarData(t.venceEm) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </Cf2Card>

          <Cf2Card className="flex flex-col gap-2" padding="16px">
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pessoas envolvidas</p>
            {pessoasEnvolvidas.length === 0 && data.leadNome && (
              <div><p className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{data.leadNome}</p><p className="text-[10px]" style={secLabel}>Contato principal</p></div>
            )}
            {pessoasEnvolvidas.map((p) => (
              <div key={p.leadId} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}</p>
                    {p.papel === "contato" && <Cf2Badge variant="success">Contato principal</Cf2Badge>}
                  </div>
                  <p className="text-[10px]" style={secLabel}>{PAPEL_LABEL[p.papel ?? "contato"] ?? p.papel}{p.cargo ? ` · ${p.cargo}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.telefone && <a href={atendimentoHref(p.leadId, "ligacao", p.telefone)}><Phone className="w-3 h-3" style={secLabel} /></a>}
                  {p.email && <a href={`mailto:${p.email}`}><Mail className="w-3 h-3" style={secLabel} /></a>}
                </div>
              </div>
            ))}
          </Cf2Card>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Cf2Card className="col-span-2">
          <p className="text-[13px] font-bold mb-3 flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}><Activity className="w-3.5 h-3.5" /> Linha do tempo</p>
          {timeline.length === 0 ? (
            <p className="text-[11px]" style={secLabel}>Sem eventos ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {timeline.map((e) => (
                <div key={e.id} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--cf2-bg-surface-muted)" }}><e.icon className="w-3 h-3" style={secLabel} /></div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{e.titulo}</p>
                    <p className="text-[10px]" style={secLabel}>{formatarDataHora(e.data)}{e.autor ? ` · ${e.autor}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cf2Card>

        <Cf2Card className="flex flex-col items-center gap-2 text-center">
          {jaConcluido ? <CheckCircle2 className="w-6 h-6" style={{ color: "var(--cf2-success-text)" }} /> : <Lock className="w-6 h-6" style={secLabel} />}
          <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{jaConcluido ? "Onboarding concluído" : "Concluir onboarding"}</p>
          <p className="text-[10px]" style={secLabel}>{jaConcluido ? `Concluído em ${formatarData(fulfillment.completedAt)}` : "Todos os requisitos obrigatórios precisam estar concluídos antes de finalizar."}</p>
          {!jaConcluido && (
            <Cf2Button className="w-full" disabled={!podeConcluir} loading={concluirOnboarding.isPending} onClick={() => concluirOnboarding.mutate()}>
              <Lock className="w-3 h-3" /> Concluir e enviar para CS
            </Cf2Button>
          )}
          {jaConcluido && data.propostaId && <a href={`/propostas/${data.propostaId}`} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--cf2-accent-border)" }}><FileText className="w-3 h-3" /> Ver proposta</a>}
        </Cf2Card>
      </div>

      <Cf2Dialog open={!!blockerAberto} onOpenChange={(open) => !open && setBlockerAberto(null)}>
        <Cf2DialogContent>
          <Cf2DialogHeader>
            <Cf2DialogTitle>{blockerAberto?.status === "BLOCKED" ? "Editar bloqueio" : "Bloquear item"}</Cf2DialogTitle>
          </Cf2DialogHeader>
          <p className="text-[12px] mb-3" style={{ color: "var(--cf2-text-secondary)" }}>{blockerAberto?.titulo}</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["CUSTOMER", "INTERNAL", "PROVIDER"] as const).map((tipo) => (
              <Cf2Button key={tipo} variant="secondary" size="sm" onClick={() => blockerAberto && patchItem.mutate({ itemId: blockerAberto.id, status: "BLOCKED", blockerType: tipo, blockerReason: blockerReasonInput || null }, { onSuccess: () => setBlockerAberto(null) })}>{BLOCKER_LABEL[tipo]}</Cf2Button>
            ))}
          </div>
          <Cf2Textarea value={blockerReasonInput} onChange={(e) => setBlockerReasonInput(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo (opcional)" rows={3} />
          {blockerAberto?.status === "BLOCKED" && (
            <Cf2DialogFooter>
              <Cf2Button variant="ghost" size="sm" onClick={() => patchItem.mutate({ itemId: blockerAberto.id, status: "PENDING" }, { onSuccess: () => setBlockerAberto(null) })}>Remover bloqueio</Cf2Button>
            </Cf2DialogFooter>
          )}
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={tarefaAberta} onOpenChange={setTarefaAberta}>
        <Cf2DialogContent>
          <Cf2DialogHeader><Cf2DialogTitle>Nova tarefa</Cf2DialogTitle></Cf2DialogHeader>
          <Cf2Label>O que precisa ser feito?</Cf2Label>
          <Cf2Input value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)} className="mt-1.5" />
          <Cf2DialogFooter>
            <Cf2Button disabled={!tarefaTitulo.trim()} loading={criarTarefa.isPending} onClick={() => criarTarefa.mutate()}>Criar tarefa</Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={reuniaoAberta} onOpenChange={setReuniaoAberta}>
        <Cf2DialogContent>
          <Cf2DialogHeader><Cf2DialogTitle>Agendar reunião de onboarding</Cf2DialogTitle></Cf2DialogHeader>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Cf2Label>Data</Cf2Label><Cf2Input type="date" aria-label="Data" value={reuniaoData} onChange={(e) => setReuniaoData(e.target.value)} className="mt-1.5" /></div>
            <div><Cf2Label>Hora</Cf2Label><Cf2Input type="time" value={reuniaoHora} onChange={(e) => setReuniaoHora(e.target.value)} className="mt-1.5" /></div>
          </div>
          <Cf2Label>Duração</Cf2Label>
          <div className="flex gap-2 mt-1.5">
            {[15, 30, 45, 60].map((d) => (
              <Cf2Button key={d} variant={reuniaoDuracao === d ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setReuniaoDuracao(d)}>{d}min</Cf2Button>
            ))}
          </div>
          <Cf2DialogFooter>
            <Cf2Button disabled={!reuniaoData} loading={agendarReuniao.isPending} onClick={() => agendarReuniao.mutate()}>Agendar</Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>
    </div>
  );
}
