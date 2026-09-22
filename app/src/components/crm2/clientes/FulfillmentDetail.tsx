"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight, Truck, Check, Star, ArrowRightLeft, FileText, Download, AlertTriangle,
  Phone, MessageCircle, Mail, Plus, ExternalLink, Users, Rocket, ListChecks, Building2, ShieldAlert, History, Paperclip, X,
} from "lucide-react";
import { toast } from "sonner";
import { useOrgUsuarios, type OrgUsuario } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { Cf2Card } from "@/components/crm2/ui/Card";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger, Cf2TabsContent } from "@/components/crm2/ui/Tabs";
import { Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle } from "@/components/crm2/ui/Dialog";
import { Cf2FulfillmentItemDrawer, type FulfillmentItem } from "./FulfillmentItemDrawer";

// Metadata aditiva do item de checklist (fulfillment_itens.metadata, jsonb já
// existia nulo no schema). Hoje só populada pro checklist CALLFACE_AI (ver
// src/lib/crm/fulfillment.ts). Ausente = etapa administrativa/preparatória.
interface ItemMetadata {
  estagioPedagogico?: ("EXPLICAR" | "DEMONSTRAR" | "FAZER_JUNTO" | "CLIENTE_EXECUTA" | "VALIDAR")[];
  milestone?: "FIRST_VALUE";
  handoffCs?: boolean;
}

interface Item extends FulfillmentItem {
  metadata?: ItemMetadata | null;
}

const ESTAGIO_LABEL: Record<string, string> = {
  EXPLICAR: "Explicar", DEMONSTRAR: "Demonstrar", FAZER_JUNTO: "Fazer junto", CLIENTE_EXECUTA: "Cliente executa", VALIDAR: "Validar",
};

// Rótulo legível pro workstream livre (texto) — família a família, sem
// travar a lista definitiva em código (workstream continua `text` no
// schema). As 8 macroetapas reais de Delivery PABX + as de onboarding AI.
const WORKSTREAM_LABEL: Record<string, string> = {
  levantamento: "Levantamento", portabilidade: "Portabilidade", softswitch: "Softswitch",
  infraestrutura: "Infraestrutura", licenciamento: "Licenciamento", configuracao_pbx: "Configuração PBX",
  qa_interno: "QA interno", validacao_cliente: "Validação cliente",
  validacao_contratacao: "Validação da contratação", acessos: "Acessos", explicar_demonstrar: "Explicar/Demonstrar",
  primeira_ligacao: "Primeira ligação", primeiro_valor: "Primeiro valor", primeiro_valor_confirmado: "Primeiro valor confirmado",
  proximos_passos: "Próximos passos", branding: "Branding", ativacao_capacidade: "Ativação de capacidade",
  abertura: "Abertura", comunicacao: "Comunicação com o cliente", materiais: "Materiais e configuração",
  ambiente: "Ambiente White Label", dominio: "Domínio e DNS", go_live: "Go-live", handoff: "Handoff",
  onboarding: "Onboarding do ambiente", conclusao: "Conclusão",
  // Chaves do checklist White Label de produção (gerações anteriores do seed
  // ainda têm itens gravados com elas): sem rótulo a etapa vira slug cru.
  coleta: "Coleta e validação", configuracao: "Configuração", qualidade: "Qualidade",
};

interface Formulario {
  id: string;
  status: string;
  enviadoEm: string | null;
  submetidoEm: string | null;
  respostas?: {
    portabilidade?: { linhas?: { ddd?: string; numero?: string; novaLinha?: boolean }[]; razaoSocialTitular?: string; cnpjCpfTitular?: string; operadoraAtual?: string; responsavelTecnico?: { nome?: string; email?: string; telefone?: string } };
    ramais?: Record<string, unknown>[];
    ura?: { numerosAtendidos?: string[]; diasHorarioAtendimento?: string; opcoes?: { rotulo?: string; destinos?: string[] }[]; vozSelecionada?: string };
    outrasInformacoes?: string;
    whiteLabel?: {
      dominio?: string;
      // O formulário público de produção grava `contatoTecnico*`/`fechamentoDia`;
      // as chaves curtas são de respostas antigas ainda no jsonb.
      tecnicoNome?: string;
      tecnicoEmail?: string;
      contatoTecnicoNome?: string;
      contatoTecnicoEmail?: string;
      faturamentoEmail?: string;
      logo?: { url?: string; nomeOriginal?: string } | null;
      favicon?: { url?: string; nomeOriginal?: string } | null;
    };
  };
}
interface ProximaAcao { id: string; titulo: string; venceEm: string | null; usuarioId: string | null; usuarioNome: string | null; }
interface AnexoLegado { id: string; nomeArquivo: string; tamanhoBytes: number | null; criadoEmOriginal: string | null; zohoId: string | null; arquivoDisponivel: boolean; }
interface AnexoReal { id: string; nomeArquivo: string; url: string; tipoMime: string | null; tamanhoBytes: number | null; createdAt: string; }
interface LinhaPortabilidadeRow { id: string; ddd: string | null; numero: string | null; tipo: string; operadoraAtual: string | null; titular: string | null; anexoUrl: string | null; anexoId: string | null; }
interface RamalRow { id: string; departamento: string | null; numeroExterno: string | null; ramal: string | null; usuario: string | null; email: string | null; celular: string | null; modeloAparelho: string | null; usaAparelhoFisico: boolean; gravacao: boolean; ligacoesInternacionais: boolean; paisesPermitidos: string[] | null; }
interface AtividadeEmpresa { id: string; tipo: string; titulo: string | null; descricao: string | null; createdAt: string; autorNome: string | null; }
interface Pessoa { leadId: string; nome: string; telefone: string | null; email: string | null; cargo: string | null; papel: string | null; }
interface TarefaAvulsa { id: string; titulo: string; prioridade: string | null; venceEm: string | null; concluida: boolean; concluidaEm: string | null; usuarioId: string | null; usuarioNome: string | null; }
interface Assinatura { status: string; mrr: number | null; moeda: string | null; currentPeriodEnd: string | null; stripeSubscriptionId: string | null; canceladaEm: string | null; }

interface FulfillmentData {
  fulfillment: { id: string; status: string; serviceFamily: string; responsavelId: string | null; responsavelNome: string | null; startedAt: string | null; targetAt: string | null; completedAt: string | null; servicoCanonicoId: string };
  itens: Item[];
  publicToken?: string;
  escopoVendidoSnapshot?: Record<string, unknown> | null;
  empresaId?: string | null;
  empresaNome?: string | null;
  empresaWebsite?: string | null;
  empresaLogoUrl?: string | null;
  leadId?: string | null;
  leadNome?: string | null;
  leadTelefone?: string | null;
  leadEmail?: string | null;
  leadCargo?: string | null;
  formulario?: Formulario | null;
  linhasPortabilidade?: LinhaPortabilidadeRow[];
  ramaisMaterializados?: RamalRow[];
  proximaAcao?: ProximaAcao | null;
  responsavelComercialNome?: string | null;
  negocioId?: string | null;
  negocioTitulo?: string | null;
  propostaId?: string | null;
  propostaNumero?: number | null;
  atividadesEmpresa?: AtividadeEmpresa[];
  pessoasEnvolvidas?: Pessoa[];
  contextoVenda?: string | null;
  tarefasOnboarding?: TarefaAvulsa[];
  assinatura?: Assinatura | null;
}

const ATIVIDADE_TIPO_LABEL: Record<string, string> = {
  nota: "Nota", documento: "Documento anexado", tarefa: "Tarefa criada", tarefa_legado: "Tarefa criada",
  ligacao: "Ligação", ligacao_legado: "Ligação", email: "E-mail", email_legado: "E-mail",
  whatsapp: "WhatsApp", reuniao: "Reunião", reuniao_legado: "Reunião",
  responsavel_alterado: "Responsável alterado", implantacao_concluida: "Implantação concluída", onboarding_concluido: "Onboarding concluído",
};
const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };

const WHITE_LABEL_TASK_GUIDANCE: Record<string, string> = {
  "Iniciar implantação e confirmar responsável interno": "Confirme quem conduz a implantação e registre a data de início.",
  "Revisar o escopo vendido e os contatos do cliente": "Confirme o que foi contratado, o decisor, o contato técnico e o e-mail de faturamento antes de falar com o cliente.",
  "Fazer o primeiro contato de boas-vindas": "Use a mensagem padrão no WhatsApp ou e-mail e apresente-se como responsável pela implantação.",
  "Apresentar as etapas e o prazo estimado da implantação": "Explique que primeiro coletamos materiais, depois configuramos o ambiente, DNS e QA antes da reunião de onboarding.",
  "Enviar o formulário de materiais e configuração": "Abra o canal de atendimento pelo botão abaixo; a mensagem já leva o link individual do formulário.",
  "Acompanhar o preenchimento do formulário pelo cliente": "Faça um follow-up se o formulário não for enviado e registre qualquer bloqueio do cliente.",
  "Receber e validar materiais e informações do cliente": "Confira domínio, contatos, identidade visual e faturamento; deixe em revisão quando chegar.",
  "Solicitar correções ou complementos, quando necessário": "Liste objetivamente o que falta e reenvie o mesmo link para correção.",
  "Configurar ambiente White Label e identidade da marca": "Aplique domínio, logotipo, favicon e cores aprovadas no ambiente.",
  "Enviar instruções de DNS/CNAME e acompanhar a configuração": "Passe os registros necessários e acompanhe até o cliente concluir a publicação.",
  "Validar DNS, TLS e domínio de e-mail (SPF/DKIM quando aplicável)": "Teste resolução, certificado e autenticação de e-mail somente se o domínio for usado para envio.",
  "Executar QA interno do ambiente": "Valide marca, navegação, fluxos críticos e permissões antes de envolver o cliente.",
  "Agendar e conduzir a reunião de onboarding do ambiente": "Só agende após o QA interno: apresente o ambiente pronto, explique os acessos e registre as dúvidas do cliente.",
  "Validar ambiente com o cliente e liberar acesso administrativo": "Durante ou após a reunião, colete o aceite e libere os administradores indicados.",
  "Confirmar go-live do ambiente White Label": "Registre a data de entrada em operação e eventuais pendências pós-lançamento.",
  "Concluir implantação e realizar handoff para Customer Success": "Somente depois do go-live: transfira contexto, contatos, decisões e pendências para Customer Success.",
};
// 5 estados pedidos no redesign (26/08) — achatados a partir dos 7 reais do
// banco (IN_REVIEW/CORRECTION_REQUIRED/APPROVED nunca são gravados hoje,
// nenhuma rota de revisão grava isso ainda — mapeamento honesto, não uma
// mudança de schema).
const FORM_STATUS_LABEL: Record<string, string> = {
  NOT_SENT: "Não enviado", SENT: "Enviado", IN_PROGRESS: "Em preenchimento",
  SUBMITTED: "Recebido", IN_REVIEW: "Recebido", CORRECTION_REQUIRED: "Recebido", APPROVED: "Validado",
};
const STATUS_MACRO_LABEL: Record<string, string> = {
  NOT_STARTED: "Não iniciado", IN_PROGRESS: "Em andamento", BLOCKED_CUSTOMER: "Aguardando cliente",
  BLOCKED_INTERNAL: "Bloqueio interno", BLOCKED_PROVIDER: "Bloqueio (fornecedor)", BLOCKED_CARRIER: "Bloqueio (operadora)",
  READY_FOR_VALIDATION: "Pronto pra Go Live", COMPLETED: "Concluída", CANCELED: "Cancelada",
};
const PAPEL_LABEL: Record<string, string> = { decisor: "Decisor", tecnico: "Responsável técnico", influenciador: "Influenciador", contato: "Contato" };
const PRIORIDADE_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa", urgente: "Urgente" };
const ESCOPO_LABEL: Record<string, string> = {
  ramais: "Ramais", linhas: "Linhas", troncosSip: "Troncos SIP", ura: "URA",
  filasAtendimento: "Filas de atendimento", gravacao: "Gravação", portabilidade: "Portabilidade",
  hardware: "Hardware", plano: "Plano",
};

function formatBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
function toDateInputValue(iso?: string | null) {
  return iso ? iso.slice(0, 10) : "";
}
function kindDeArquivo(nome: string, tipoMime?: string | null): "imagem" | "pdf" | "outro" {
  if (tipoMime?.startsWith("image/")) return "imagem";
  if (tipoMime === "application/pdf") return "pdf";
  const ext = (nome.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "imagem";
  if (ext === "pdf") return "pdf";
  return "outro";
}

function CardTitulo({ icon: Icon, tint, title, subtitle }: { icon: React.ElementType; tint: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)` }}>
        <Icon className="w-4 h-4" style={{ color: tint }} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{title}</p>
        {subtitle && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      <p className="text-[13px] font-bold break-words" style={{ color: "var(--cf2-text-primary)" }}>{valor}</p>
    </div>
  );
}

/**
 * Workspace de Fulfillment (redesign 26/08 — Implantação PABX vira workspace
 * operacional em vez de checklist disperso em 5 abas; ver plano em
 * decisoes/crm2-implantacao-pabx-redesign no vault). Compartilhado com
 * onboarding Callface AI/White Label: PABX ganha a IA nova completa
 * (Jornada por macroetapa, Tarefas, Documentos, Linha do tempo); as outras
 * famílias continuam na visão antiga (fora do escopo deste redesign, só
 * precisa continuar funcionando).
 */
export function Cf2FulfillmentDetail({ fulfillmentId }: { fulfillmentId: string }) {
  const { data, isLoading } = useQuery<FulfillmentData>({
    queryKey: ["cf2-fulfillment", fulfillmentId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}`);
      if (!r.ok) throw new Error("não encontrado");
      return r.json();
    },
  });

  const documentosLegado = useQuery<AnexoLegado[]>({
    queryKey: ["anexos-legado-fulfillment", data?.negocioId],
    queryFn: async () => {
      if (!data?.negocioId) return [];
      const r = await fetch(`/api/anexos-legado?entidadeTipo=negocio&entidadeId=${data.negocioId}`);
      if (!r.ok) return [];
      const j = await r.json();
      return j.anexos || [];
    },
    enabled: !!data?.negocioId,
  });

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (!data) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Fulfillment não encontrado.</p>;

  if (data.fulfillment.serviceFamily !== "PABX") {
    return <OnboardingLegacyView fulfillmentId={fulfillmentId} data={data} documentosLegado={documentosLegado.data ?? []} />;
  }
  return <PabxWorkspace fulfillmentId={fulfillmentId} data={data} documentosLegado={documentosLegado.data ?? []} />;
}

// ============================================================================
// PABX — workspace novo (redesign 26/08)
// ============================================================================

interface Macroetapa { key: string; label: string; itens: Item[]; status: "blocked" | "done" | "current" | "pending"; responsavel: string | null; prazo: string | null; bloqueio: Item | null; }
interface PreviewArquivo { nome: string; url: string; tipoMime?: string | null; }

function PabxWorkspace({ fulfillmentId, data, documentosLegado }: { fulfillmentId: string; data: FulfillmentData; documentosLegado: AnexoLegado[] }) {
  // Esta tela é montada por dois shells com rotas próprias: /clientes/* (CRM2)
  // e /pos-venda/* (produção). Cada destino abaixo segue o shell atual em vez
  // de ser hardcodado — hardcodar um lado quebrava o outro.
  const emPosVenda = usePathname().startsWith("/pos-venda");
  const base = emPosVenda ? "/pos-venda" : "/clientes";
  const qc = useQueryClient();
  const { byId: usuariosById } = useOrgUsuarios();
  const usuarios = Array.from(usuariosById.values());
  const [aba, setAba] = useState("visao-geral");
  const [copiado, setCopiado] = useState(false);
  const [drawerWorkstream, setDrawerWorkstream] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewArquivo | null>(null);
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [notaOpen, setNotaOpen] = useState(false);
  const [notaTexto, setNotaTexto] = useState("");
  const [respostasOpen, setRespostasOpen] = useState(false);
  const [portabilidadeOpen, setPortabilidadeOpen] = useState(false);
  const [ramaisOpen, setRamaisOpen] = useState(false);

  const { fulfillment, itens, publicToken, escopoVendidoSnapshot, empresaId, empresaNome, empresaLogoUrl, leadId, leadNome, leadTelefone, leadCargo, formulario, linhasPortabilidade, ramaisMaterializados, proximaAcao, responsavelComercialNome, negocioId, negocioTitulo, propostaId, propostaNumero, atividadesEmpresa, pessoasEnvolvidas, contextoVenda, tarefasOnboarding, assinatura } = data;

  const anexosReais = useQuery<AnexoReal[]>({
    queryKey: ["anexos-fulfillment", negocioId],
    queryFn: async () => {
      if (!negocioId) return [];
      const r = await fetch(`/api/anexos?negocioId=${negocioId}`);
      if (!r.ok) return [];
      const j = await r.json();
      return j.anexos || [];
    },
    enabled: !!negocioId,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] });

  const patchItem = useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/fulfillments/itens/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: invalidar,
    onError: () => toast.error("Não foi possível atualizar a tarefa"),
  });

  const criarItem = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}/itens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { invalidar(); setNovaTarefaOpen(false); toast.success("Tarefa adicionada"); },
    onError: () => toast.error("Não foi possível criar a tarefa"),
  });

  const criarTarefaAvulsa = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/tarefas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { invalidar(); setNovaTarefaOpen(false); toast.success("Tarefa adicionada"); },
    onError: () => toast.error("Não foi possível criar a tarefa"),
  });

  const patchTarefaAvulsa = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: invalidar,
    onError: () => toast.error("Não foi possível atualizar a tarefa"),
  });

  const criarNota = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/notas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo: notaTexto, negocioId: negocioId || null, empresaId: empresaId || null }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { setNotaTexto(""); setNotaOpen(false); toast.success("Nota adicionada"); invalidar(); },
    onError: () => toast.error("Não foi possível criar a nota"),
  });

  const editarPrevisao = useMutation({
    mutationFn: async (targetAt: string | null) => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetAt }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: invalidar,
    onError: () => toast.error("Não foi possível atualizar a previsão"),
  });

  const goLive = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}/concluir`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "concluir_onboarding" }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "falha"); }
      return r.json();
    },
    onSuccess: () => { invalidar(); toast.success("Implantação concluída"); },
    onError: (e: Error) => toast.error(e.message || "Não foi possível concluir a implantação"),
  });

  // Macroetapas — agrupa os itens reais por workstream (mesmo dado real do
  // checklist), preservando ordem de aparição. 9ª etapa (Go Live) é
  // sintética, sem itens próprios — reflete só o status macro do fulfillment.
  const grupos: { key: string; itens: Item[] }[] = [];
  for (const item of itens) {
    let g = grupos.find((x) => x.key === item.workstream);
    if (!g) { g = { key: item.workstream, itens: [] }; grupos.push(g); }
    g.itens.push(item);
  }
  const macroetapas: Macroetapa[] = grupos.map((g, index) => {
    const bloqueio = g.itens.find((i) => i.status === "BLOCKED") ?? null;
    const concluida = g.itens.length > 0 && g.itens.every((i) => i.status === "DONE" || i.status === "NOT_APPLICABLE");
    const emAndamento = g.itens.some((i) => i.status === "IN_PROGRESS" || i.status === "VALIDATION");
    const anteriorPendente = grupos.slice(0, index).some((ant) => ant.itens.some((i) => i.status !== "DONE" && i.status !== "NOT_APPLICABLE"));
    const atual = !concluida && !bloqueio && (emAndamento || !anteriorPendente);
    const responsaveis = new Set(g.itens.map((i) => i.responsavelId).filter(Boolean));
    const prazos = g.itens.map((i) => i.dueDate).filter(Boolean) as string[];
    return {
      key: g.key, label: WORKSTREAM_LABEL[g.key] || g.key, itens: g.itens,
      status: bloqueio ? "blocked" : concluida ? "done" : atual ? "current" : "pending",
      responsavel: responsaveis.size === 1 ? (usuariosById.get(g.itens.find((i) => i.responsavelId)!.responsavelId!)?.nome ?? null) : responsaveis.size > 1 ? "Vários" : null,
      prazo: prazos.length > 0 ? prazos.sort()[0] : null,
      bloqueio,
    };
  });
  const totalItens = itens.length;
  const concluidosOuNA = itens.filter((i) => i.status === "DONE" || i.status === "NOT_APPLICABLE").length;
  const pct = totalItens > 0 ? Math.round((concluidosOuNA / totalItens) * 100) : 0;
  const bloqueioPrincipal = itens.find((i) => i.status === "BLOCKED") ?? null;
  const eventoConclusao = (atividadesEmpresa ?? []).find((a) => a.tipo === "implantacao_concluida") ?? null;

  const linkPublico = publicToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/impl-pabx/${publicToken}` : null;
  const escopoEntries = escopoVendidoSnapshot ? Object.entries(escopoVendidoSnapshot).filter(([, v]) => v !== null && v !== undefined && v !== "") : [];

  const documentos: { id: string; nome: string; url: string | null; tamanho: number | null; origem: string; download?: string }[] = [
    ...documentosLegado.map((d) => ({ id: `legado-${d.id}`, nome: d.nomeArquivo, url: d.arquivoDisponivel ? `/api/anexos-legado/${d.id}/download` : null, tamanho: d.tamanhoBytes, origem: "Histórico migrado", download: d.arquivoDisponivel ? `/api/anexos-legado/${d.id}/download` : undefined })),
    ...(anexosReais.data ?? []).map((a) => ({ id: `anexo-${a.id}`, nome: a.nomeArquivo, url: a.url, tamanho: a.tamanhoBytes, origem: "Anexo", download: a.url })),
    ...(linhasPortabilidade ?? []).filter((l) => l.anexoUrl).map((l) => ({ id: `porta-${l.id}`, nome: l.anexoId || "Comprovante de portabilidade", url: l.anexoUrl, tamanho: null, origem: "Portabilidade", download: l.anexoUrl || undefined })),
  ];

  // Linha do tempo semântica (26/08) — só eventos com sinal real, nunca
  // fabricado. "Retorno da operadora"/"portabilidade solicitada" citados no
  // brief não têm fonte hoje — ficam de fora até existir uma ação real.
  const timelineEventos: { id: string; tipo: "tarefa" | "comunicacao" | "portabilidade" | "sistema" | "nota"; titulo: string; data: string }[] = [
    { id: "criada", tipo: "sistema" as const, titulo: "Implantação criada", data: fulfillment.startedAt || "" },
    ...(formulario?.enviadoEm ? [{ id: "form-enviado", tipo: "comunicacao" as const, titulo: "Formulário enviado ao cliente", data: formulario.enviadoEm }] : []),
    ...(formulario?.submetidoEm ? [{ id: "form-recebido", tipo: "portabilidade" as const, titulo: "Formulário recebido do cliente", data: formulario.submetidoEm }] : []),
    ...itens.filter((i) => i.completedAt).map((i) => ({ id: `item-${i.id}`, tipo: "tarefa" as const, titulo: `${i.completedByNome ? `${i.completedByNome} concluiu` : "Concluído:"} ${i.titulo}`, data: i.completedAt! })),
    ...itens.filter((i) => i.blockedAt).map((i) => ({ id: `bloq-${i.id}`, tipo: "tarefa" as const, titulo: `Bloqueio criado: ${i.titulo}`, data: i.blockedAt! })),
    ...(atividadesEmpresa ?? []).filter((a) => a.tipo === "responsavel_alterado" || a.tipo === "implantacao_concluida" || a.tipo === "nota").map((a) => ({ id: `ativ-${a.id}`, tipo: (a.tipo === "nota" ? "nota" : "sistema") as "nota" | "sistema", titulo: a.titulo || ATIVIDADE_TIPO_LABEL[a.tipo] || a.tipo, data: a.createdAt })),
  ].filter((e) => e.data).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const [filtroTimeline, setFiltroTimeline] = useState<"todos" | "tarefa" | "comunicacao" | "portabilidade" | "sistema" | "nota">("todos");
  const timelineFiltrada = filtroTimeline === "todos" ? timelineEventos : timelineEventos.filter((e) => e.tipo === filtroTimeline);

  // Tarefas — unifica itens do checklist (com etapa/prazo/prioridade) e
  // tarefas avulsas (leadId, sem etapa) na mesma tabela operacional.
  type TarefaRow = { id: string; origem: "checklist" | "avulsa"; titulo: string; etapa: string | null; statusLabel: string; concluida: boolean; item?: Item; avulsa?: TarefaAvulsa };
  const tarefaRows: TarefaRow[] = [
    ...itens.map((i) => ({ id: i.id, origem: "checklist" as const, titulo: i.titulo, etapa: WORKSTREAM_LABEL[i.workstream] || i.workstream, statusLabel: "", concluida: i.status === "DONE" || i.status === "NOT_APPLICABLE", item: i })),
    ...(tarefasOnboarding ?? []).map((t) => ({ id: t.id, origem: "avulsa" as const, titulo: t.titulo, etapa: null, statusLabel: t.concluida ? "Concluída" : "Pendente", concluida: t.concluida, avulsa: t })),
  ].sort((a, b) => Number(a.concluida) - Number(b.concluida));

  const acaoAtendimento = (canal: "ligacao" | "whatsapp" | "email") => {
    if (!leadId) return undefined;
    const params = new URLSearchParams({ leadId, canal });
    if (leadTelefone) params.set("telefone", digitsForDialer(leadTelefone));
    // /atendimento (inbox unificado) só existe no shell CRM2; no shell de
    // produção o canal fica na página do contato.
    return emPosVenda ? `/contatos/${leadId}` : `/atendimento?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        <Link href={`${base}/implantacao`} className="hover:underline">Implantação</Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: "var(--cf2-text-primary)" }}>{empresaNome || "—"}</span>
      </div>

      {/* Header — identidade, status, ações e panorama num só bloco escuro
          (mesmo padrão de contraste já usado no header de Empresa/Negócio). */}
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--cf2-chrome-bg-alt)", border: "1px solid var(--cf2-chrome-border)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex items-center justify-center rounded-xl shrink-0 w-12 h-12 overflow-hidden" style={{ background: "var(--cf2-chrome-surface-active)" }}>
              {empresaLogoUrl ? <img src={empresaLogoUrl} alt="" className="w-full h-full object-cover" /> : <Truck className="w-5 h-5" style={{ color: "var(--cf2-chrome-text-primary)" }} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[19px] font-bold truncate" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{empresaNome || "—"}</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "var(--cf2-chrome-surface-active)", color: "var(--cf2-chrome-text-secondary)" }}>{FAMILIA_LABEL[fulfillment.serviceFamily]}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: fulfillment.status === "COMPLETED" ? "var(--cf2-accent-bg-subtle)" : fulfillment.status.startsWith("BLOCKED") ? "#ef444422" : "var(--cf2-chrome-surface-active)", color: fulfillment.status === "COMPLETED" ? "var(--cf2-accent-text)" : fulfillment.status.startsWith("BLOCKED") ? "#ff8e83" : "var(--cf2-chrome-text-primary)" }}>
                  {STATUS_MACRO_LABEL[fulfillment.status] || fulfillment.status}
                </span>
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Implantação PABX{leadNome ? ` · contato principal ${leadNome}${leadCargo ? ` (${leadCargo})` : ""}` : ""}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <AcaoHeader href={acaoAtendimento("ligacao")} icon={Phone} label="Ligar" />
            <AcaoHeader href={acaoAtendimento("whatsapp")} icon={MessageCircle} label="WhatsApp" />
            <AcaoHeader href={acaoAtendimento("email")} icon={Mail} label="E-mail" />
            <button onClick={() => setNovaTarefaOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-chrome-surface-active)", color: "var(--cf2-chrome-text-primary)" }}><Plus className="w-3.5 h-3.5" />Tarefa</button>
            <button onClick={() => setNotaOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-chrome-surface-active)", color: "var(--cf2-chrome-text-primary)" }}><FileText className="w-3.5 h-3.5" />Nota</button>
            {empresaId && <Link href={emPosVenda ? `/empresas/${empresaId}` : `/clientes/${empresaId}`} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><ExternalLink className="w-3.5 h-3.5" />Cliente 360</Link>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3" style={{ borderTop: "1px solid var(--cf2-chrome-border-subtle)" }}>
          <CampoChrome label="Responsável atual" valor={fulfillment.responsavelNome || "Sem responsável"} />
          <CampoChrome label="Início" valor={fulfillment.startedAt ? new Date(fulfillment.startedAt).toLocaleDateString("pt-BR") : "—"} />
          <label className="min-w-0 cursor-pointer">
            <p className="text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Previsão de conclusão</p>
            <input
              type="date" defaultValue={toDateInputValue(fulfillment.targetAt)}
              onBlur={(e) => editarPrevisao.mutate(e.target.value || null)}
              className="text-[13px] font-bold outline-none bg-transparent"
              style={{ color: "var(--cf2-chrome-text-primary)", colorScheme: "dark" }}
            />
          </label>
          <div>
            <p className="text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Progresso</p>
            <p className="text-[15px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{pct}% <span className="text-[11px] font-normal" style={{ color: "var(--cf2-chrome-text-secondary)" }}>({concluidosOuNA}/{totalItens})</span></p>
          </div>
          <CampoChrome label="Última atividade" valor={atividadesEmpresa && atividadesEmpresa.length > 0 ? formatDataHora(atividadesEmpresa[0].createdAt) : "—"} />
          <CampoChrome label="Principal bloqueio" valor={bloqueioPrincipal ? bloqueioPrincipal.titulo : "Nenhum"} destaque={!!bloqueioPrincipal} />
        </div>
      </div>

      <Cf2Tabs value={aba} onValueChange={setAba}>
        <Cf2TabsList>
          <Cf2TabsTrigger value="visao-geral">Visão geral</Cf2TabsTrigger>
          <Cf2TabsTrigger value="tarefas">Tarefas</Cf2TabsTrigger>
          <Cf2TabsTrigger value="documentos">Documentos ({documentos.length})</Cf2TabsTrigger>
          <Cf2TabsTrigger value="timeline">Linha do tempo</Cf2TabsTrigger>
        </Cf2TabsList>

        <Cf2TabsContent value="visao-geral">
          <div className="flex flex-col gap-5">
            {/* Contexto da venda */}
            <Cf2Card>
              <CardTitulo icon={Building2} tint="#3B82F6" title="Contexto da venda" subtitle="Negócio, proposta e escopo que originaram esta implantação" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Negócio</p>
                  {negocioId ? <Link href={`/negocios/${negocioId}`} className="text-[13px] font-bold hover:underline" style={{ color: "var(--cf2-accent-text)" }}>{negocioTitulo || "Ver negócio"} →</Link> : <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>—</p>}
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Proposta aceita</p>
                  {propostaId ? <Link href={`/propostas/${propostaId}`} className="text-[13px] font-bold hover:underline" style={{ color: "var(--cf2-accent-text)" }}>Proposta #{propostaNumero} →</Link> : <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>—</p>}
                </div>
                <Campo label="Responsável comercial" valor={responsavelComercialNome || "—"} />
                <Campo label="Plano contratado" valor={(escopoVendidoSnapshot?.plano as string) || "—"} />
                {assinatura && <Campo label="Assinatura" valor={`${assinatura.status}${assinatura.mrr ? ` · ${assinatura.moeda || "BRL"} ${assinatura.mrr}/mês` : ""}`} />}
              </div>
              {escopoEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  {escopoEntries.filter(([k]) => k !== "plano").map(([k, v]) => (
                    <span key={k} className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{String(v)} {(ESCOPO_LABEL[k] || k).toLowerCase()}</span>
                  ))}
                </div>
              )}
              {contextoVenda && <p className="text-[12px] mt-3 pt-3 leading-relaxed" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}><span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Observações da venda: </span>{contextoVenda}</p>}
            </Cf2Card>

            {/* Pessoas envolvidas */}
            <Cf2Card>
              <CardTitulo icon={Users} tint="#06B6D4" title="Pessoas envolvidas" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(pessoasEnvolvidas ?? []).map((p) => <PessoaCard key={p.leadId} nome={p.nome} cargo={p.cargo} telefone={p.telefone} email={p.email} papel={PAPEL_LABEL[p.papel || ""] || p.papel} leadId={p.leadId} />)}
                {formulario?.respostas?.portabilidade?.responsavelTecnico?.nome && (
                  <PessoaCard nome={formulario.respostas.portabilidade.responsavelTecnico.nome} cargo="Informado pelo cliente" telefone={formulario.respostas.portabilidade.responsavelTecnico.telefone ?? null} email={formulario.respostas.portabilidade.responsavelTecnico.email ?? null} papel="Contato técnico (formulário)" leadId={null} />
                )}
                {(pessoasEnvolvidas ?? []).length === 0 && !formulario?.respostas?.portabilidade?.responsavelTecnico?.nome && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa vinculada ainda.</p>}
              </div>
            </Cf2Card>

            {/* Jornada da implantação — 9 macroetapas */}
            <Cf2Card>
              <CardTitulo icon={ListChecks} tint="var(--cf2-accent-border)" title="Jornada da implantação" subtitle="Algumas etapas podem ocorrer em paralelo (ex.: portabilidade e preparação técnica)" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {macroetapas.map((m) => <MacroetapaCard key={m.key} m={m} onContinuar={() => setDrawerWorkstream(m.key)} />)}
                <GoLiveCard fulfillment={fulfillment} evento={eventoConclusao} onConcluir={() => goLive.mutate()} loading={goLive.isPending} />
              </div>
            </Cf2Card>

            {/* Próxima ação */}
            <Cf2Card>
              <CardTitulo icon={Rocket} tint="var(--cf2-success-text)" title="Próxima ação" />
              {proximaAcao ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{proximaAcao.titulo}</p>
                    <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{proximaAcao.usuarioNome ? `${proximaAcao.usuarioNome} · ` : ""}{proximaAcao.venceEm ? `prazo ${new Date(proximaAcao.venceEm).toLocaleDateString("pt-BR")}` : "sem prazo"}</p>
                  </div>
                  <button onClick={() => patchTarefaAvulsa.mutate({ id: proximaAcao.id, body: { concluida: true } })} className="text-[12px] font-bold px-3 py-1.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}>Concluir</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma próxima ação definida.</p>
                  <button onClick={() => setNovaTarefaOpen(true)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}>Criar ação</button>
                </div>
              )}
            </Cf2Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Formulário */}
              <Cf2Card>
                <CardTitulo icon={FileText} tint="var(--cf2-accent-border)" title="Formulário técnico" subtitle={FORM_STATUS_LABEL[formulario?.status || ""] || "—"} />
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <Campo label="Contato técnico" valor={formulario?.respostas?.portabilidade?.responsavelTecnico?.nome || "—"} />
                  <Campo label="Linhas de portabilidade" valor={String(linhasPortabilidade?.length ?? 0)} />
                  <Campo label="Ramais" valor={String(ramaisMaterializados?.length ?? 0)} />
                  <Campo label="Voz da URA" valor={formulario?.respostas?.ura?.vozSelecionada || "—"} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkPublico && <button onClick={() => { navigator.clipboard.writeText(linkPublico); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{copiado ? "Copiado" : "Copiar link"}</button>}
                  <button onClick={() => setRespostasOpen(true)} disabled={!formulario?.respostas} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>Abrir respostas</button>
                </div>
              </Cf2Card>

              {/* Bloqueios e dependências */}
              <Cf2Card>
                <CardTitulo icon={ShieldAlert} tint="var(--cf2-danger-text)" title="Bloqueios e dependências" />
                {itens.filter((i) => i.status === "BLOCKED").length === 0 ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum bloqueio ativo.</p> : (
                  <div className="flex flex-col gap-2">
                    {itens.filter((i) => i.status === "BLOCKED").map((i) => <BloqueioRow key={i.id} item={i} onAbrir={() => setDrawerWorkstream(i.workstream)} />)}
                  </div>
                )}
              </Cf2Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Cf2Card>
                <div className="flex items-center justify-between mb-1"><CardTitulo icon={Phone} tint="#8B5CF6" title="Portabilidade" subtitle={`${(linhasPortabilidade ?? []).length} linha(s)`} /><button onClick={() => setPortabilidadeOpen(true)} className="text-[11px] font-bold" style={{ color: "var(--cf2-accent-text)" }}>Ver tudo →</button></div>
                {(linhasPortabilidade ?? []).length === 0 ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma linha submetida ainda.</p> : (
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{(linhasPortabilidade ?? []).filter((l) => !l.anexoUrl).length} pendente(s) de comprovante · operadoras: {[...new Set((linhasPortabilidade ?? []).map((l) => l.operadoraAtual).filter(Boolean))].join(", ") || "—"}</p>
                )}
              </Cf2Card>
              <Cf2Card>
                <div className="flex items-center justify-between mb-1"><CardTitulo icon={ListChecks} tint="var(--cf2-warning-text)" title="Ramais e URA" subtitle={`${(ramaisMaterializados ?? []).length} ramal(is)`} /><button onClick={() => setRamaisOpen(true)} className="text-[11px] font-bold" style={{ color: "var(--cf2-accent-text)" }}>Ver tudo →</button></div>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Horário: {formulario?.respostas?.ura?.diasHorarioAtendimento || "—"} · {formulario?.respostas?.ura?.opcoes?.length ?? 0} opção(ões) de URA</p>
              </Cf2Card>
            </div>
          </div>
        </Cf2TabsContent>

        <Cf2TabsContent value="tarefas">
          <Cf2Card padding="0px" className="overflow-hidden">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Tarefas ({tarefaRows.length})</p>
              <button onClick={() => setNovaTarefaOpen(true)} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}><Plus className="w-3.5 h-3.5" />Nova tarefa</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                <thead><tr style={{ color: "var(--cf2-text-tertiary)", textAlign: "left" }}>
                  <th className="py-2 px-4 font-semibold">Tarefa</th><th className="py-2 px-3 font-semibold">Etapa</th><th className="py-2 px-3 font-semibold">Status</th><th className="py-2 px-3 font-semibold">Responsável</th><th className="py-2 px-3 font-semibold">Prazo</th><th className="py-2 px-3 font-semibold">Prioridade</th>
                </tr></thead>
                <tbody>
                  {tarefaRows.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                      <td className="py-2 px-4 font-semibold" style={{ color: row.concluida ? "var(--cf2-text-tertiary)" : "var(--cf2-text-primary)", textDecoration: row.concluida ? "line-through" : "none" }}>{row.titulo}</td>
                      <td className="py-2 px-3" style={{ color: "var(--cf2-text-secondary)" }}>{row.etapa || <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface-muted)" }}>Avulsa</span>}</td>
                      <td className="py-2 px-3">
                        {row.item ? <StatusPillSelect status={row.item.status} blockerType={row.item.blockerType} onChange={(status, blockerType) => patchItem.mutate({ itemId: row.item!.id, body: { status, blockerType } })} /> : (
                          <button onClick={() => patchTarefaAvulsa.mutate({ id: row.avulsa!.id, body: { concluida: !row.avulsa!.concluida } })} className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: row.concluida ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)", color: row.concluida ? "var(--cf2-success-text)" : "var(--cf2-text-secondary)" }}>{row.statusLabel}</button>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {row.item ? <AssignOwnerControl entityType="fulfillment_item" entityId={row.item.id} currentOwnerId={row.item.responsavelId ?? fulfillment.responsavelId} usuarios={usuarios} onChanged={invalidar} /> : <span style={{ color: "var(--cf2-text-secondary)" }}>{row.avulsa!.usuarioNome || "—"}</span>}
                      </td>
                      <td className="py-2 px-3">
                        {row.item ? <input type="date" aria-label="Data" defaultValue={toDateInputValue(row.item.dueDate)} onBlur={(e) => patchItem.mutate({ itemId: row.item!.id, body: { dueDate: e.target.value || null } })} className="text-[11px] rounded px-1.5 py-1 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }} /> : <span style={{ color: "var(--cf2-text-secondary)" }}>{row.avulsa!.venceEm ? new Date(row.avulsa!.venceEm!).toLocaleDateString("pt-BR") : "—"}</span>}
                      </td>
                      <td className="py-2 px-3">
                        {row.item ? (
                          <select defaultValue={row.item.priority || ""} onChange={(e) => patchItem.mutate({ itemId: row.item!.id, body: { priority: e.target.value || null } })} className="text-[11px] rounded px-1.5 py-1 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }}>
                            <option value="">—</option>{Object.entries(PRIORIDADE_LABEL).filter(([k]) => k !== "urgente").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        ) : <span style={{ color: "var(--cf2-text-secondary)" }}>{PRIORIDADE_LABEL[row.avulsa!.prioridade || ""] || "—"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cf2Card>
        </Cf2TabsContent>

        <Cf2TabsContent value="documentos">
          <Cf2Card>
            {documentos.length === 0 ? <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum documento ainda.</p> : (
              <div className="flex flex-col gap-2">
                {documentos.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <Paperclip className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-secondary)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{d.nome}</p>
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{d.origem}{d.tamanho ? ` · ${formatBytes(d.tamanho)}` : ""}</p>
                    </div>
                    {d.url && <button onClick={() => setPreview({ nome: d.nome, url: d.url! })} className="text-[11px] font-bold px-2 py-1 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>Visualizar</button>}
                    {d.download && <a href={d.download} className="p-1.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface)" }}><Download className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></a>}
                  </div>
                ))}
              </div>
            )}
          </Cf2Card>
        </Cf2TabsContent>

        <Cf2TabsContent value="timeline">
          <Cf2Card>
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
              {([["todos", "Tudo"], ["tarefa", "Tarefas"], ["comunicacao", "Comunicação"], ["portabilidade", "Portabilidade"], ["sistema", "Sistema"], ["nota", "Notas"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFiltroTimeline(key)} className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: filtroTimeline === key ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface-muted)", color: filtroTimeline === key ? "#fff" : "var(--cf2-text-secondary)" }}>{label}</button>
              ))}
            </div>
            {timelineFiltrada.length === 0 ? <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum evento neste filtro.</p> : (
              <div className="flex flex-col gap-1.5">
                {timelineFiltrada.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <History className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                    <p className="flex-1 text-[12px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{e.titulo}</p>
                    <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{formatDataHora(e.data)}</p>
                  </div>
                ))}
              </div>
            )}
          </Cf2Card>
        </Cf2TabsContent>
      </Cf2Tabs>

      {drawerWorkstream && (
        <Cf2FulfillmentItemDrawer
          items={itens.filter((i) => i.workstream === drawerWorkstream)}
          workstreamLabel={WORKSTREAM_LABEL[drawerWorkstream] || drawerWorkstream}
          fulfillmentId={fulfillmentId}
          open={!!drawerWorkstream}
          onClose={() => setDrawerWorkstream(null)}
          fulfillmentResponsavelId={fulfillment.responsavelId}
        />
      )}

      <NovaTarefaDialog
        open={novaTarefaOpen}
        onClose={() => setNovaTarefaOpen(false)}
        workstreams={macroetapas.map((m) => ({ key: m.key, label: m.label }))}
        usuarios={usuarios}
        onCriarChecklist={(body) => criarItem.mutate(body)}
        onCriarAvulsa={(body) => criarTarefaAvulsa.mutate({ ...body, leadId: leadId || null, negocioId: negocioId || null, tipo: "geral" })}
        loading={criarItem.isPending || criarTarefaAvulsa.isPending}
      />

      <Cf2Dialog open={notaOpen} onOpenChange={setNotaOpen}>
        <Cf2DialogContent>
          <Cf2DialogHeader><Cf2DialogTitle>Nova nota</Cf2DialogTitle></Cf2DialogHeader>
          <textarea autoFocus value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} rows={4} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-none" style={{ border: "1px solid var(--cf2-border-default)" }} placeholder="Escreva a nota..." aria-label="Escreva a nota" />
          <button onClick={() => criarNota.mutate()} disabled={!notaTexto.trim() || criarNota.isPending} className="mt-3 text-[12px] font-bold px-3 py-2 rounded-lg" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}>Salvar nota</button>
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={respostasOpen} onOpenChange={setRespostasOpen}>
        <Cf2DialogContent className="max-w-lg">
          <Cf2DialogHeader><Cf2DialogTitle>Respostas do formulário</Cf2DialogTitle></Cf2DialogHeader>
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Responsável técnico" valor={formulario?.respostas?.portabilidade?.responsavelTecnico?.nome || "—"} />
              <Campo label="Telefone" valor={formulario?.respostas?.portabilidade?.responsavelTecnico?.telefone || "—"} />
              <Campo label="Titular" valor={formulario?.respostas?.portabilidade?.razaoSocialTitular || "—"} />
              <Campo label="Operadora atual" valor={formulario?.respostas?.portabilidade?.operadoraAtual || "—"} />
              <Campo label="Voz da URA" valor={formulario?.respostas?.ura?.vozSelecionada || "—"} />
              <Campo label="Horário de atendimento" valor={formulario?.respostas?.ura?.diasHorarioAtendimento || "—"} />
            </div>
            {formulario?.respostas?.outrasInformacoes && <p className="text-[12px] pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}><span className="font-semibold">Observações: </span>{formulario.respostas.outrasInformacoes}</p>}
          </div>
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={portabilidadeOpen} onOpenChange={setPortabilidadeOpen}>
        <Cf2DialogContent className="max-w-2xl">
          <Cf2DialogHeader><Cf2DialogTitle>Portabilidade e novas linhas</Cf2DialogTitle></Cf2DialogHeader>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead><tr style={{ color: "var(--cf2-text-tertiary)", textAlign: "left" }}><th className="pb-2 pr-3">DDD</th><th className="pb-2 pr-3">Número</th><th className="pb-2 pr-3">Tipo</th><th className="pb-2 pr-3">Operadora</th><th className="pb-2 pr-3">Titular</th><th className="pb-2">Anexo</th></tr></thead>
              <tbody>{(linhasPortabilidade ?? []).map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  <td className="py-1.5 pr-3">{l.ddd || "—"}</td><td className="py-1.5 pr-3">{l.tipo === "nova_linha" ? "(nova)" : l.numero || "—"}</td><td className="py-1.5 pr-3">{l.tipo === "nova_linha" ? "Linha nova" : "Portabilidade"}</td><td className="py-1.5 pr-3">{l.operadoraAtual || "—"}</td><td className="py-1.5 pr-3">{l.titular || "—"}</td>
                  <td className="py-1.5">{l.anexoUrl ? <button onClick={() => setPreview({ nome: l.anexoId || "comprovante", url: l.anexoUrl! })} className="hover:underline" style={{ color: "var(--cf2-accent-text)" }}>Ver</button> : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={ramaisOpen} onOpenChange={setRamaisOpen}>
        <Cf2DialogContent className="max-w-2xl">
          <Cf2DialogHeader><Cf2DialogTitle>Ramais e usuários</Cf2DialogTitle></Cf2DialogHeader>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead><tr style={{ color: "var(--cf2-text-tertiary)", textAlign: "left" }}><th className="pb-2 pr-3">Ramal</th><th className="pb-2 pr-3">Usuário</th><th className="pb-2 pr-3">Depto</th><th className="pb-2 pr-3">Nº externo</th><th className="pb-2">Gravação</th></tr></thead>
              <tbody>{(ramaisMaterializados ?? []).map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  <td className="py-1.5 pr-3 font-semibold">{r.ramal || "—"}</td><td className="py-1.5 pr-3">{r.usuario || "—"}</td><td className="py-1.5 pr-3">{r.departamento || "—"}</td><td className="py-1.5 pr-3">{r.numeroExterno || "—"}</td><td className="py-1.5">{r.gravacao ? "Sim" : "Não"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Cf2DialogContent>
      </Cf2Dialog>

      {preview && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/60" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl w-full max-h-full rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{preview.nome}</p>
              <button onClick={() => setPreview(null)}><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
            </div>
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center min-h-[300px]">
              {kindDeArquivo(preview.nome, preview.tipoMime) === "imagem" ? <img src={preview.url} alt={preview.nome} className="max-w-full max-h-[70vh] object-contain" /> :
                kindDeArquivo(preview.nome, preview.tipoMime) === "pdf" ? <iframe src={preview.url} className="w-full h-[70vh]" /> :
                  <div className="flex flex-col items-center gap-3 py-10"><p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Pré-visualização não disponível para este tipo de arquivo.</p><a href={preview.url} target="_blank" rel="noreferrer" className="text-[12px] font-bold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}>Baixar arquivo</a></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AcaoHeader({ href, icon: Icon, label }: { href: string | undefined; icon: React.ElementType; label: string }) {
  if (!href) return <span title="Sem contato cadastrado" className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg opacity-40 cursor-not-allowed" style={{ background: "var(--cf2-chrome-surface-active)", color: "var(--cf2-chrome-text-secondary)" }}><Icon className="w-3.5 h-3.5" />{label}</span>;
  return <Link href={href} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-chrome-surface-active)", color: "var(--cf2-chrome-text-primary)" }}><Icon className="w-3.5 h-3.5" />{label}</Link>;
}

function CampoChrome({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
      <p className="text-[13px] font-bold truncate" style={{ color: destaque ? "#ff8e83" : "var(--cf2-chrome-text-primary)" }}>{valor}</p>
    </div>
  );
}

function PessoaCard({ nome, cargo, telefone, email, papel, leadId }: { nome: string; cargo: string | null; telefone: string | null; email: string | null; papel: string | null; leadId: string | null }) {
  return (
    <div className="p-3 rounded-xl flex flex-col gap-1.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{nome}</p>
        {leadId && <Link href={`/contatos/${leadId}`} title="Abrir perfil"><ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} /></Link>}
      </div>
      {papel && <span className="text-[10px] font-bold self-start px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-accent-text)" }}>{papel}</span>}
      {cargo && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{cargo}</p>}
      <div className="flex items-center gap-2 mt-1">
        {telefone && <a href={`tel:${telefone}`} title="Ligar"><Phone className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></a>}
        {telefone && <a href={`https://wa.me/${digitsForDialer(telefone)}`} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></a>}
        {email && <a href={`mailto:${email}`} title="E-mail"><Mail className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></a>}
        {!telefone && !email && <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem contato cadastrado</span>}
      </div>
    </div>
  );
}

function MacroetapaCard({ m, onContinuar }: { m: Macroetapa; onContinuar: () => void }) {
  const done = m.itens.filter((i) => i.status === "DONE" || i.status === "NOT_APPLICABLE").length;
  const corStatus = m.status === "blocked" ? "var(--cf2-danger-text)" : m.status === "done" ? "var(--cf2-success-text)" : m.status === "current" ? "var(--cf2-accent-border)" : "var(--cf2-text-tertiary)";
  const rotulo = m.status === "blocked" ? "Bloqueada" : m.status === "done" ? "Concluída" : m.status === "current" ? "Em andamento" : "Pendente";
  return (
    <div className="p-3.5 rounded-xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: m.status === "blocked" ? "1px solid var(--cf2-danger-border)" : "1px solid transparent" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{m.label}</p>
        <span className="text-[10px] font-bold shrink-0" style={{ color: corStatus }}>{rotulo}</span>
      </div>
      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{done}/{m.itens.length} tarefas · {m.responsavel || "sem responsável"}{m.prazo ? ` · prazo ${new Date(m.prazo).toLocaleDateString("pt-BR")}` : ""}</p>
      {m.bloqueio && <p className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "color-mix(in srgb, var(--cf2-danger-text) 10%, transparent)", color: "var(--cf2-danger-text)" }}>{m.bloqueio.blockerReason || "Etapa bloqueada"}</p>}
      <button onClick={onContinuar} className="text-[11px] font-bold self-start mt-1" style={{ color: "var(--cf2-accent-text)" }}>Continuar etapa →</button>
    </div>
  );
}

function GoLiveCard({ fulfillment, evento, onConcluir, loading }: { fulfillment: FulfillmentData["fulfillment"]; evento: AtividadeEmpresa | null; onConcluir: () => void; loading: boolean }) {
  const concluida = fulfillment.status === "COMPLETED";
  const pronta = fulfillment.status === "READY_FOR_VALIDATION";
  return (
    <div className="p-3.5 rounded-xl flex flex-col gap-2" style={{ background: concluida ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4" style={{ color: concluida ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)" }} />
        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Go Live / Conclusão</p>
      </div>
      {concluida ? (
        <p className="text-[11px]" style={{ color: "var(--cf2-success-text)" }}>Concluída{evento?.autorNome ? ` por ${evento.autorNome}` : ""} em {fulfillment.completedAt ? new Date(fulfillment.completedAt).toLocaleDateString("pt-BR") : "—"}</p>
      ) : pronta ? (
        <>
          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Todas as etapas estão prontas — confirme o Go Live.</p>
          <button onClick={onConcluir} disabled={loading} className="text-[12px] font-bold px-3 py-1.5 rounded-lg self-start" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}>Confirmar Go Live</button>
        </>
      ) : (
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Aguardando conclusão das etapas anteriores.</p>
      )}
    </div>
  );
}

function BloqueioRow({ item, onAbrir }: { item: Item; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir} className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--cf2-danger-text)" }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{item.titulo}</span>
        <span className="block text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{item.blockerReason || "Sem motivo registrado"} · {WORKSTREAM_LABEL[item.workstream] || item.workstream}</span>
      </span>
      <span className="shrink-0 flex flex-col items-end gap-0.5 text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        <span className="font-bold" style={{ color: "var(--cf2-danger-text)" }}>{item.blockerType === "CARRIER" ? "Operadora" : item.blockerType === "CUSTOMER" ? "Cliente" : item.blockerType === "PROVIDER" ? "Fornecedor" : "Interno"}{item.blockerImpact ? ` · impacto ${item.blockerImpact}` : ""}</span>
        {item.blockedAt && <span>desde {new Date(item.blockedAt).toLocaleDateString("pt-BR")}</span>}
      </span>
    </button>
  );
}

function NovaTarefaDialog({ open, onClose, workstreams, usuarios, onCriarChecklist, onCriarAvulsa, loading }: {
  open: boolean; onClose: () => void; workstreams: { key: string; label: string }[]; usuarios: OrgUsuario[];
  onCriarChecklist: (body: Record<string, unknown>) => void; onCriarAvulsa: (body: Record<string, unknown>) => void; loading: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [destino, setDestino] = useState<"checklist" | "avulsa">("avulsa");
  const [workstream, setWorkstream] = useState(workstreams[0]?.key ?? "");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("");

  function submit() {
    if (!titulo.trim()) return;
    if (destino === "checklist") {
      onCriarChecklist({ workstream, titulo, responsavelId: responsavelId || null, dueDate: prazo || null, priority: prioridade || null });
    } else {
      onCriarAvulsa({ titulo, responsavelId: responsavelId || null, venceEm: prazo ? new Date(prazo).toISOString() : null, prioridade: prioridade || undefined });
    }
    setTitulo(""); setPrazo(""); setPrioridade(""); setResponsavelId("");
  }

  return (
    <Cf2Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <Cf2DialogContent>
        <Cf2DialogHeader><Cf2DialogTitle>Nova tarefa</Cf2DialogTitle></Cf2DialogHeader>
        <div className="flex flex-col gap-3">
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da tarefa" aria-label="Título da tarefa" className="text-[13px] rounded-lg px-3 py-2 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }} />
          <div className="flex gap-2">
            <button onClick={() => setDestino("avulsa")} className="flex-1 text-[12px] font-bold py-1.5 rounded-lg" style={{ background: destino === "avulsa" ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface-muted)", color: destino === "avulsa" ? "#fff" : "var(--cf2-text-secondary)" }}>Avulsa</button>
            <button onClick={() => setDestino("checklist")} className="flex-1 text-[12px] font-bold py-1.5 rounded-lg" style={{ background: destino === "checklist" ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface-muted)", color: destino === "checklist" ? "#fff" : "var(--cf2-text-secondary)" }}>Numa etapa do checklist</button>
          </div>
          {destino === "checklist" && (
            <select value={workstream} onChange={(e) => setWorkstream(e.target.value)} className="text-[12px] rounded-lg px-3 py-2 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }}>
              {workstreams.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
          )}
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="text-[12px] rounded-lg px-3 py-2 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }}>
            <option value="">Sem responsável</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Data" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="text-[12px] rounded-lg px-3 py-2 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }} />
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="text-[12px] rounded-lg px-3 py-2 outline-none" style={{ border: "1px solid var(--cf2-border-default)" }}>
              <option value="">Prioridade —</option>{Object.entries(PRIORIDADE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={!titulo.trim() || loading} className="text-[12px] font-bold px-3 py-2 rounded-lg" style={{ background: "var(--cf2-bg-inverse)", color: "#fff" }}>Criar tarefa</button>
        </div>
      </Cf2DialogContent>
    </Cf2Dialog>
  );
}

// ============================================================================
// Onboarding (Callface AI / White Label) — visão antiga, fora do escopo
// deste redesign (que cobriu só Implantação PABX). Mantida praticamente
// intacta, só adaptada à nova API do Cf2FulfillmentItemDrawer (que passou a
// receber uma lista de itens em vez de 1 item fixo).
// ============================================================================

type StatusEtapaKey = "PENDING" | "IN_PROGRESS" | "BLOCKED_CUSTOMER" | "BLOCKED_PROVIDER" | "BLOCKED_INTERNAL" | "BLOCKED_CARRIER" | "VALIDATION" | "DONE";
const STATUS_ETAPA_LABEL: Record<StatusEtapaKey, string> = {
  PENDING: "Não iniciado", IN_PROGRESS: "Em andamento",
  BLOCKED_CUSTOMER: "Aguardando cliente", BLOCKED_PROVIDER: "Aguardando fornecedor", BLOCKED_CARRIER: "Aguardando operadora", BLOCKED_INTERNAL: "Bloqueado",
  VALIDATION: "Validação", DONE: "Concluído",
};
const STATUS_ETAPA_COLOR: Record<StatusEtapaKey, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: "var(--cf2-bg-surface)", text: "var(--cf2-text-tertiary)", dot: "var(--cf2-text-tertiary)" },
  IN_PROGRESS: { bg: "var(--cf2-accent-bg-subtle)", text: "var(--cf2-accent-border)", dot: "var(--cf2-accent-border)" },
  BLOCKED_CUSTOMER: { bg: "#f59e0b18", text: "#b45309", dot: "#f59e0b" },
  BLOCKED_PROVIDER: { bg: "#f59e0b18", text: "#b45309", dot: "#f59e0b" },
  BLOCKED_CARRIER: { bg: "#f59e0b18", text: "#b45309", dot: "#f59e0b" },
  BLOCKED_INTERNAL: { bg: "#ef444418", text: "#ef4444", dot: "#ef4444" },
  VALIDATION: { bg: "#8e27ef18", text: "#8e27ef", dot: "#8e27ef" },
  DONE: { bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)", dot: "var(--cf2-success-text)" },
};
function chaveStatusEtapa(item: { status: string; blockerType?: string | null }): StatusEtapaKey {
  if (item.status === "BLOCKED") {
    if (item.blockerType === "CUSTOMER") return "BLOCKED_CUSTOMER";
    if (item.blockerType === "PROVIDER") return "BLOCKED_PROVIDER";
    if (item.blockerType === "CARRIER") return "BLOCKED_CARRIER";
    return "BLOCKED_INTERNAL";
  }
  return (item.status as StatusEtapaKey) in STATUS_ETAPA_LABEL ? (item.status as StatusEtapaKey) : "PENDING";
}

function StatusPillSelect({ status, blockerType, onChange }: { status: string; blockerType?: string | null; onChange: (status: string, blockerType: string | null) => void }) {
  const chave = chaveStatusEtapa({ status, blockerType });
  const cor = STATUS_ETAPA_COLOR[chave];
  return (
    <div className="relative shrink-0">
      <select
        value={chave}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const nova = e.target.value as StatusEtapaKey;
          if (nova.startsWith("BLOCKED_")) onChange("BLOCKED", nova.replace("BLOCKED_", ""));
          else onChange(nova, null);
        }}
        className="cf2-select-custom appearance-none text-[11px] font-bold pl-3 pr-6 py-1.5 rounded-full cursor-pointer outline-none"
        style={{ background: cor.bg, color: cor.text }}
      >
        {Object.entries(STATUS_ETAPA_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <span className="w-1.5 h-1.5 rounded-full absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ background: cor.dot }} />
    </div>
  );
}

function ChecklistLista({
  itens, toggleItem, setItemSelecionado, usuarios, fulfillmentResponsavelId, fulfillmentResponsavelNome, onOwnerChanged,
}: {
  itens: Item[];
  toggleItem: ReturnType<typeof useMutation<unknown, Error, { itemId: string; status: string; blockerType?: string | null }>>;
  setItemSelecionado: (item: Item) => void;
  usuarios: OrgUsuario[];
  fulfillmentResponsavelId: string | null;
  fulfillmentResponsavelNome: string | null;
  onOwnerChanged: () => void;
}) {
  return (
    <>
      {itens.map((item) => {
        const isMilestone = item.metadata?.milestone === "FIRST_VALUE";
        const isHandoff = !!item.metadata?.handoffCs;
        const estagios = item.metadata?.estagioPedagogico ?? [];
        const semResponsavelProprio = !item.responsavelId;
        return (
          <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)", border: isMilestone ? "1px dashed var(--cf2-accent)" : "none" }}>
            <StatusPillSelect status={item.status} blockerType={item.blockerType} onChange={(status, blockerType) => toggleItem.mutate({ itemId: item.id, status, blockerType })} />
            {isMilestone && <Star className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-accent)" }} />}
            <button onClick={() => setItemSelecionado(item)} className="flex-1 flex flex-col gap-1 text-left">
              <span className="text-[13px]" style={{ color: item.status === "DONE" ? "var(--cf2-text-tertiary)" : "var(--cf2-text-primary)", textDecoration: item.status === "DONE" ? "line-through" : "none" }}>{item.titulo}</span>
              {WHITE_LABEL_TASK_GUIDANCE[item.titulo] && <span className="text-[11px] leading-relaxed" style={{ color: "var(--cf2-text-tertiary)" }}>{WHITE_LABEL_TASK_GUIDANCE[item.titulo]}</span>}
              {(estagios.length > 0 || isMilestone || isHandoff) && (
                <div className="flex items-center gap-1 flex-wrap">
                  {estagios.map((e) => <span key={e} className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)", border: "1px solid var(--cf2-border-default)" }}>{ESTAGIO_LABEL[e] || e}</span>)}
                  {isMilestone && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#8e27ef18", color: "#8e27ef" }}>Primeiro valor · marco manual</span>}
                  {isHandoff && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1" style={{ background: "var(--cf2-informativo-bg)", color: "var(--cf2-informativo-fg)" }}><ArrowRightLeft className="w-2.5 h-2.5" /> Handoff CS</span>}
                </div>
              )}
            </button>
            {item.blockerReason && item.status === "BLOCKED" && <span className="text-[10px] max-w-[160px] truncate shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} title={item.blockerReason}>{item.blockerReason}</span>}
            <div className="shrink-0 flex flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
              <AssignOwnerControl entityType="fulfillment_item" entityId={item.id} currentOwnerId={item.responsavelId ?? fulfillmentResponsavelId} usuarios={usuarios} onChanged={onOwnerChanged} />
              {semResponsavelProprio && fulfillmentResponsavelNome && <span className="text-[9px]" style={{ color: "var(--cf2-text-tertiary)" }}>via responsável do projeto</span>}
            </div>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} onClick={() => setItemSelecionado(item)} />
          </div>
        );
      })}
    </>
  );
}

function TemplateContato({ titulo, texto, href, acao }: { titulo: string; texto: string; href: string | null; acao: string }) {
  return <div className="rounded-xl p-3" style={{ background: "var(--cf2-bg-surface-muted)" }}>
    <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
    <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[11px] leading-relaxed" style={{ color: "var(--cf2-text-secondary)" }}>{texto}</p>
    {href ? <Link href={href} className="inline-flex mt-3 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{acao}</Link> : <p className="mt-3 text-[11px]" style={{ color: "var(--cf2-danger-text)" }}>O contato do cliente não está disponível para este canal.</p>}
  </div>;
}

function OnboardingLegacyView({ fulfillmentId, data, documentosLegado }: { fulfillmentId: string; data: FulfillmentData; documentosLegado: AnexoLegado[] }) {
  // Dois shells montam esta tela (/clientes/* do CRM2 e /pos-venda/* de
  // produção) e cada um tem a sua fila de jornada e o seu canal de mensagem.
  const emPosVenda = usePathname().startsWith("/pos-venda");
  const qc = useQueryClient();
  const [itemSelecionado, setItemSelecionado] = useState<Item | null>(null);
  const [aba, setAba] = useState<string>("visao-geral");
  const { byId: usuariosById } = useOrgUsuarios();

  const { fulfillment, itens, empresaId, empresaNome, empresaLogoUrl, atividadesEmpresa, formulario, publicToken, leadId, leadTelefone, leadEmail } = data;
  const isWhiteLabel = fulfillment.serviceFamily === "WHITE_LABEL";
  const jornadaTitulo = isWhiteLabel ? "Implantação White Label" : "Onboarding";
  // A fila de White Label tem rota própria em cada shell: /pos-venda/white-label
  // em produção, /clientes/implantacao?familia=WHITE_LABEL no CRM2.
  const jornadaHref = emPosVenda
    ? (isWhiteLabel ? "/pos-venda/white-label" : "/pos-venda/onboarding")
    : (isWhiteLabel ? "/clientes/implantacao?familia=WHITE_LABEL" : "/clientes/onboarding");
  const linkFormulario = isWhiteLabel && publicToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/impl-white-label/${publicToken}` : null;
  const primeiroNome = (empresaNome || "").split(" ")[0] || "tudo bem";
  const nomeResponsavel = fulfillment.responsavelNome || "[seu nome]";
  // Sem link gerado o template ainda é legível (placeholder), como em produção.
  const mensagemWhatsApp = `Olá, ${primeiroNome}! Tudo bem?\n\nEu sou ${nomeResponsavel}, da Callface, e vou acompanhar sua implantação White Label por aqui.\n\nPara começarmos, preciso que você preencha as informações de domínio, identidade visual, contato técnico e faturamento neste formulário: ${linkFormulario || "{{link_implantacao}}"}\n\nDepois que recebermos os dados, validamos o material, configuramos o ambiente e te orientamos sobre DNS. No final, marcamos uma reunião para apresentar o ambiente pronto.\n\nQualquer dúvida, pode me chamar por aqui.`;
  const mensagemEmail = `Olá, ${primeiroNome}.\n\nTudo bem? Eu sou ${nomeResponsavel}, da Callface, e serei o responsável por acompanhar sua implantação White Label.\n\nPara iniciarmos a configuração do ambiente, peço que preencha as informações de domínio, identidade visual, contato técnico e faturamento no formulário abaixo:\n\n${linkFormulario || "{{link_implantacao}}"}\n\nDepois que recebermos os dados, validaremos o material, configuraremos o ambiente e enviaremos as orientações de DNS quando necessário. Ao final dessa etapa, agendaremos uma reunião para apresentar o ambiente pronto e liberar os acessos administrativos.\n\nFico à disposição caso precise de ajuda.\n\nAtenciosamente,\n${nomeResponsavel}\nCallface`;
  const atendimentoHref = (canal: "whatsapp" | "email", texto: string) => {
    if (!leadId) return null;
    const params = new URLSearchParams({ leadId, canal, texto });
    if (canal === "whatsapp" && leadTelefone) params.set("telefone", digitsForDialer(leadTelefone));
    if (canal === "email" && leadEmail) params.set("email", leadEmail);
    return emPosVenda ? `/${canal}?${params.toString()}` : `/atendimento?${params.toString()}`;
  };

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, status, blockerType }: { itemId: string; status: string; blockerType?: string | null }) => {
      const body: Record<string, unknown> = { status };
      if (status === "BLOCKED") body.blockerType = blockerType ?? "INTERNAL";
      const r = await fetch(`/api/fulfillments/itens/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] }),
    onError: () => toast.error("Não foi possível atualizar o item"),
  });

  const workstreams: { key: string; itens: Item[] }[] = [];
  for (const item of itens) {
    let grupo = workstreams.find((w) => w.key === item.workstream);
    if (!grupo) { grupo = { key: item.workstream, itens: [] }; workstreams.push(grupo); }
    grupo.itens.push(item);
  }
  const atividadesRecentes = [...itens].filter((i) => i.completedAt).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()).slice(0, 8);
  const historicoCompleto = [...itens].filter((i) => i.completedAt).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  const contagem = {
    DONE: itens.filter((i) => i.status === "DONE").length, VALIDATION: itens.filter((i) => i.status === "VALIDATION").length,
    IN_PROGRESS: itens.filter((i) => i.status === "IN_PROGRESS").length, PENDING: itens.filter((i) => i.status === "PENDING").length,
    BLOCKED: itens.filter((i) => i.status === "BLOCKED").length,
  };
  const pct = itens.length > 0 ? Math.round((contagem.DONE / itens.length) * 100) : 0;
  const ABAS = [{ key: "visao-geral", label: "Visão geral" }, { key: "checklist", label: "Checklist" }, { key: "atividades", label: "Atividades" }, { key: "historico", label: "Histórico" }];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        <Link href={jornadaHref} className="hover:underline">{jornadaTitulo}</Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: "var(--cf2-text-primary)" }}>{empresaNome || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{jornadaTitulo}</h1>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: fulfillment.status === "COMPLETED" ? "#effaf2" : fulfillment.status.startsWith("BLOCKED") ? "#fff1f2" : "#eef9e8", color: fulfillment.status === "COMPLETED" ? "var(--cf2-success-text)" : fulfillment.status.startsWith("BLOCKED") ? "#dc2626" : "#4d8a1d" }}>
          {STATUS_MACRO_LABEL[fulfillment.status] || fulfillment.status}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-start gap-3 lg:w-[410px] shrink-0">
          <div className="flex items-center justify-center rounded-xl shrink-0 w-14 h-14 overflow-hidden" style={{ background: "var(--cf2-bg-inverse)" }}>
            {empresaLogoUrl ? <img src={empresaLogoUrl} alt="" className="w-full h-full object-cover" /> : <Truck className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{empresaId ? <Link href={emPosVenda ? `/empresas/${empresaId}` : `/clientes/${empresaId}`} className="hover:underline">{empresaNome}</Link> : empresaNome || "—"}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              <div className="min-w-0">
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Responsável interno</p>
                <AssignOwnerControl entityType="fulfillment" entityId={fulfillment.id} currentOwnerId={fulfillment.responsavelId} usuarios={Array.from(usuariosById.values())} onChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 lg:pl-5 lg:border-l" style={{ borderColor: "var(--cf2-border-default)" }}>
          <Campo label="Status" valor={STATUS_MACRO_LABEL[fulfillment.status] || fulfillment.status} />
          <div>
            <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Progresso geral</p>
            <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{pct}%</p>
          </div>
          <Campo label="Previsão de conclusão" valor={fulfillment.targetAt ? new Date(fulfillment.targetAt).toLocaleDateString("pt-BR") : "—"} />
          <Campo label="Responsável atual" valor={fulfillment.responsavelNome || "Sem responsável"} />
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        {ABAS.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)} className="shrink-0 px-3 py-2 text-[12px] font-semibold whitespace-nowrap" style={{ color: aba === a.key ? "var(--cf2-accent-text)" : "var(--cf2-text-secondary)", borderBottom: aba === a.key ? "2px solid var(--cf2-accent-border)" : "2px solid transparent" }}>{a.label}</button>
        ))}
      </div>

      {aba === "visao-geral" && (
        <div className="flex flex-col gap-5">
          {isWhiteLabel && <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Contato e formulário do cliente</p><p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Escolha o canal: a mensagem abre pronta no Atendimento para revisão antes do envio.</p></div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: formulario?.status === "SUBMITTED" ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)", color: formulario?.status === "SUBMITTED" ? "var(--cf2-success-text)" : "var(--cf2-text-secondary)" }}>{formulario?.status === "SUBMITTED" ? "Formulário recebido" : "Aguardando envio do cliente"}</span>
            </div>
            {linkFormulario ? <>
              <div className="mt-4 flex items-center gap-2 rounded-lg p-2.5" style={{ background: "var(--cf2-bg-surface-muted)" }}><span className="flex-1 truncate text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{linkFormulario}</span><a href={linkFormulario} target="_blank" rel="noreferrer" className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-accent-text)", border: "1px solid var(--cf2-border-default)" }}>Abrir formulário</a></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><TemplateContato titulo="WhatsApp" texto={mensagemWhatsApp} href={atendimentoHref("whatsapp", mensagemWhatsApp)} acao="Enviar pelo WhatsApp" /><TemplateContato titulo="E-mail" texto={mensagemEmail} href={atendimentoHref("email", mensagemEmail)} acao="Enviar por e-mail" /></div>
            </> : <p className="mt-4 text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>O link público ainda não foi gerado para este projeto.</p>}
          </div>}
          <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>{isWhiteLabel ? "Próximas etapas da implantação" : "Checklist do onboarding"}</p>
            <ChecklistLista itens={itens.slice(0, 8)} toggleItem={toggleItem} setItemSelecionado={setItemSelecionado} usuarios={Array.from(usuariosById.values())} fulfillmentResponsavelId={fulfillment.responsavelId} fulfillmentResponsavelNome={fulfillment.responsavelNome} onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })} />
          </div>
        </div>
      )}

      {aba === "checklist" && (
        <div className="flex flex-col gap-5">
          {workstreams.map((w) => (
            <div key={w.key} className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>{WORKSTREAM_LABEL[w.key] || w.key}</p>
              <ChecklistLista itens={w.itens} toggleItem={toggleItem} setItemSelecionado={setItemSelecionado} usuarios={Array.from(usuariosById.values())} fulfillmentResponsavelId={fulfillment.responsavelId} fulfillmentResponsavelNome={fulfillment.responsavelNome} onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })} />
            </div>
          ))}
        </div>
      )}

      {aba === "atividades" && (
        <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Atividades recentes</p>
          {atividadesRecentes.length === 0 ? <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma etapa concluída ainda.</p> : atividadesRecentes.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-success-text)" }} />
              <p className="flex-1 text-[12px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{a.completedByNome ? `${a.completedByNome} concluiu ` : "Concluído: "}{a.titulo}</p>
              <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(a.completedAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
            </div>
          ))}
          {(atividadesEmpresa ?? []).length > 0 && <p className="text-[11px] mt-2 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}>{atividadesEmpresa!.length} atividade(s) da empresa também disponíveis no Cliente 360.</p>}
        </div>
      )}

      {aba === "historico" && (
        <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Histórico de conclusão</p>
          {historicoCompleto.length === 0 ? <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma etapa concluída ainda.</p> : historicoCompleto.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-success-text)" }} />
              <p className="flex-1 text-[12px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{a.completedByNome ? `${a.completedByNome} concluiu ` : "Concluído: "}{a.titulo}</p>
              <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(a.completedAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
            </div>
          ))}
        </div>
      )}

      {documentosLegado.length > 0 && aba === "visao-geral" && (
        <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Documentos</p>
          {documentosLegado.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-secondary)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{d.nomeArquivo}</p>
                <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatBytes(d.tamanhoBytes)}</p>
              </div>
              {d.arquivoDisponivel && <a href={`/api/anexos-legado/${d.id}/download`} className="p-1.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface)" }}><Download className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></a>}
            </div>
          ))}
        </div>
      )}

      {itemSelecionado && (
        <Cf2FulfillmentItemDrawer
          items={[itemSelecionado]}
          workstreamLabel={WORKSTREAM_LABEL[itemSelecionado.workstream] || itemSelecionado.workstream}
          fulfillmentId={fulfillmentId}
          open={!!itemSelecionado}
          onClose={() => setItemSelecionado(null)}
          fulfillmentResponsavelId={fulfillment.responsavelId}
        />
      )}
    </div>
  );
}
