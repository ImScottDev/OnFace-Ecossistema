"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Truck, Copy, Check, Star, ArrowRightLeft, Calendar, FileText, Download, AlertTriangle, Clock, Circle } from "lucide-react";
import { toast } from "sonner";
import { useOrgUsuarios, type OrgUsuario } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { Cf2FulfillmentItemDrawer } from "./FulfillmentItemDrawer";

// Metadata aditiva do item de checklist (fulfillment_itens.metadata, jsonb
// já existia nulo no schema — sem migração nova). Hoje só populada pro
// checklist CALLFACE_AI (ver src/lib/crm/fulfillment.ts). Ausente = etapa
// administrativa/preparatória, fora da progressão pedagógica do guia de
// onboarding.
interface ItemMetadata {
  estagioPedagogico?: ("EXPLICAR" | "DEMONSTRAR" | "FAZER_JUNTO" | "CLIENTE_EXECUTA" | "VALIDAR")[];
  milestone?: "FIRST_VALUE";
  marcacaoManual?: boolean;
  handoffCs?: boolean;
}

interface Item {
  id: string;
  workstream: string;
  titulo: string;
  status: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "VALIDATION" | "DONE";
  blockerType: string | null;
  blockerReason: string | null;
  metadata?: ItemMetadata | null;
  completedAt: string | null;
  completedByNome: string | null;
  // Responsável por item (20/08) — null = usa o responsável do fulfillment
  // inteiro como fallback só na exibição (nunca gravado como valor real).
  responsavelId: string | null;
  responsavelNome: string | null;
}

const ESTAGIO_LABEL: Record<string, string> = {
  EXPLICAR: "Explicar",
  DEMONSTRAR: "Demonstrar",
  FAZER_JUNTO: "Fazer junto",
  CLIENTE_EXECUTA: "Cliente executa",
  VALIDAR: "Validar",
};

// Rótulo legível pro workstream livre (texto) — família a família, sem
// travar a lista definitiva em código (workstream continua sendo
// `text` no schema, cresce conforme o processo real). Mantido fiel ao
// vocabulário do processo real de Delivery PABX (não renomeado pra bater
// com o vocabulário de uma referência de UX externa).
const WORKSTREAM_LABEL: Record<string, string> = {
  levantamento: "Levantamento", portabilidade: "Portabilidade", softswitch: "Softswitch",
  infraestrutura: "Infraestrutura", licenciamento: "Licenciamento", configuracao_pbx: "Configuração PBX",
  qa_interno: "QA interno", validacao_cliente: "Validação cliente",
  validacao_contratacao: "Validação da contratação", acessos: "Acessos", explicar_demonstrar: "Explicar/Demonstrar",
  primeira_ligacao: "Primeira ligação", primeiro_valor: "Primeiro valor", primeiro_valor_confirmado: "Primeiro valor confirmado",
  proximos_passos: "Próximos passos", branding: "Branding", ativacao_capacidade: "Ativação de capacidade",
};

const PABX_ABAS = [
  { key: "visao-geral", label: "Visão geral" },
  { key: "checklist", label: "Checklist" },
  { key: "informacoes", label: "Informações coletadas" },
  { key: "portabilidade", label: "Portabilidade" },
  { key: "ura-ramais", label: "URA e Ramais" },
];

interface Formulario {
  id: string;
  status: string;
  submetidoEm: string | null;
  // Respostas reais (jsonb livre) — já vinha completo do backend
  // (db.select() sem projeção), só não estava tipado/lido no frontend.
  respostas?: {
    portabilidade?: { linhas?: { ddd?: string; numero?: string; novaLinha?: boolean }[]; razaoSocialTitular?: string; cnpjCpfTitular?: string; operadoraAtual?: string; responsavelTecnico?: { nome?: string; email?: string; telefone?: string } };
    ramais?: Record<string, unknown>[];
    ura?: { numerosAtendidos?: string[]; diasHorarioAtendimento?: string; opcoes?: { rotulo?: string; destinos?: string[] }[]; vozSelecionada?: string };
    outrasInformacoes?: string;
  };
}

interface ProximaAcao {
  id: string;
  titulo: string;
  venceEm: string | null;
  usuarioNome: string | null;
}

interface AnexoLegado {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number | null;
  criadoEmOriginal: string | null;
  zohoId: string | null;
  arquivoDisponivel: boolean;
}

// Materialização relacional do formulário (20/08) — mesma projeção real
// que o backend grava em fulfillment_linhas_portabilidade/fulfillment_ramais
// a cada submissão (delete+insert idempotente). Fonte mais confiável que o
// jsonb bruto pra exibir em tabela — o jsonb continua sendo só backup.
interface LinhaPortabilidadeRow {
  id: string; ddd: string | null; numero: string | null; tipo: string;
  operadoraAtual: string | null; titular: string | null; anexoUrl: string | null; anexoId: string | null;
}
interface RamalRow {
  id: string; departamento: string | null; numeroExterno: string | null; ramal: string | null; usuario: string | null;
  email: string | null; celular: string | null; modeloAparelho: string | null; usaAparelhoFisico: boolean;
  gravacao: boolean; ligacoesInternacionais: boolean; paisesPermitidos: string[] | null;
}

interface AtividadeEmpresa {
  id: string;
  tipo: string;
  titulo: string | null;
  descricao: string | null;
  createdAt: string;
  autorNome: string | null;
}

interface FulfillmentData {
  fulfillment: { id: string; status: string; serviceFamily: string; responsavelId: string | null; responsavelNome: string | null; startedAt: string | null; targetAt: string | null; completedAt: string | null; servicoCanonicoId: string };
  itens: Item[];
  publicToken?: string;
  escopoVendidoSnapshot?: Record<string, unknown> | null;
  empresaId?: string | null;
  empresaNome?: string | null;
  empresaWebsite?: string | null;
  empresaLogoUrl?: string | null;
  formulario?: Formulario | null;
  linhasPortabilidade?: LinhaPortabilidadeRow[];
  ramaisMaterializados?: RamalRow[];
  proximaAcao?: ProximaAcao | null;
  responsavelComercialNome?: string | null;
  negocioId?: string | null;
  propostaId?: string | null;
  propostaNumero?: number | null;
  atividadesEmpresa?: AtividadeEmpresa[];
}

// Rótulo curto pro tipo de atividade real (mesmo enum cru usado em
// qualquer outra Timeline do CRM) — nunca mostrar o valor cru na UI.
const ATIVIDADE_TIPO_LABEL: Record<string, string> = {
  nota: "Nota", documento: "Documento anexado", tarefa: "Tarefa criada", tarefa_legado: "Tarefa criada",
  ligacao: "Ligação", ligacao_legado: "Ligação", email: "E-mail", email_legado: "E-mail",
  whatsapp: "WhatsApp", reuniao: "Reunião", reuniao_legado: "Reunião",
};

const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
const FORM_STATUS_LABEL: Record<string, string> = {
  NOT_SENT: "Não enviado", SENT: "Enviado, aguardando cliente", IN_PROGRESS: "Cliente preenchendo",
  SUBMITTED: "Enviado pelo cliente", IN_REVIEW: "Em revisão", CORRECTION_REQUIRED: "Correção solicitada", APPROVED: "Aprovado",
};
const STATUS_MACRO_LABEL: Record<string, string> = {
  NOT_STARTED: "Não iniciado", IN_PROGRESS: "Em andamento", BLOCKED_CUSTOMER: "Aguardando cliente",
  BLOCKED_INTERNAL: "Bloqueio interno", BLOCKED_PROVIDER: "Bloqueio (operadora)",
  READY_FOR_VALIDATION: "Pronto pra validação", COMPLETED: "Concluído", CANCELED: "Cancelado",
};
function formatBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Escopo contratado — mesmo dado de `escopoVendidoSnapshot`, chaves variam
// por família/venda (snapshot é jsonb livre). Rótulo cai pra chave crua
// quando não tem tradução, nunca esconde um campo real.
const ESCOPO_LABEL: Record<string, string> = {
  ramais: "Ramais", linhas: "Linhas", troncosSip: "Troncos SIP", ura: "URA",
  filasAtendimento: "Filas de atendimento", gravacao: "Gravação", portabilidade: "Portabilidade",
  hardware: "Hardware", plano: "Plano",
};

/**
 * Workspace específico de Fulfillment (19/08, reconstrução completa 20/08
 * após referência de UX do Kauã; header + navegação por abas reconstruídos
 * em nova referência). Won terminou o comercial; isto é o processo de
 * entrega, com vida própria — nunca uma etapa do Pipeline. "Marcos de
 * ativação"/"Workstreams"/abas por etapa são REPRESENTAÇÕES do MESMO
 * checklist real (fulfillment_itens), nunca uma segunda fonte de dado —
 * as abas por workstream mostram um subconjunto filtrado dos mesmos itens,
 * a aba "Histórico" reusa a mesma atividade de conclusão real (completedAt/
 * completedBy), não um audit log fabricado à parte.
 */
export function Cf2FulfillmentDetail({ fulfillmentId }: { fulfillmentId: string }) {
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<Item | null>(null);
  const [aba, setAba] = useState<string>("visao-geral");
  const { byId: usuariosById } = useOrgUsuarios();

  const { data, isLoading } = useQuery<FulfillmentData>({
    queryKey: ["cf2-fulfillment", fulfillmentId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}`);
      if (!r.ok) throw new Error("não encontrado");
      return r.json();
    },
  });

  const documentos = useQuery<AnexoLegado[]>({
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

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (!data) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Fulfillment não encontrado.</p>;

  const { fulfillment, itens, publicToken, escopoVendidoSnapshot, empresaId, empresaNome, empresaWebsite, empresaLogoUrl, formulario, linhasPortabilidade, ramaisMaterializados, proximaAcao, responsavelComercialNome, propostaId, propostaNumero, atividadesEmpresa } = data;
  const isPabx = fulfillment.serviceFamily === "PABX";
  const isAi = fulfillment.serviceFamily === "CALLFACE_AI";
  const linkPublico = publicToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/impl-pabx/${publicToken}` : null;
  const concluidos = itens.filter((i) => i.status === "DONE").length;
  const primeiroPendente = itens.find((i) => i.status !== "DONE");

  // Workstreams — agrupa os itens reais pelo campo já existente
  // (fulfillment_itens.workstream), preservando a ordem de primeira
  // aparição (mesma ordem do checklist). Vira tanto os cards de "Workstreams"
  // na Visão Geral quanto a lista de abas do header.
  const workstreams: { key: string; itens: Item[] }[] = [];
  for (const item of itens) {
    let grupo = workstreams.find((w) => w.key === item.workstream);
    if (!grupo) { grupo = { key: item.workstream, itens: [] }; workstreams.push(grupo); }
    grupo.itens.push(item);
  }

  const pendencias = itens.filter((i) => i.status === "BLOCKED");
  const atividadesRecentes = [...itens]
    .filter((i) => i.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 8);
  // "Histórico" (aba própria, referência de UX): mesma fonte real, sem
  // limite de 8 — é a mesma atividade de conclusão, só a versão completa.
  const historicoCompleto = [...itens]
    .filter((i) => i.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  // Resumo por status (referência de UX, 18/08) — 5 buckets reais, batem
  // com os 5 status que o backend aceita (PENDING/IN_PROGRESS/BLOCKED/
  // VALIDATION/DONE — VALIDATION somado 20/08, pedido Kauã).
  const contagem = {
    DONE: itens.filter((i) => i.status === "DONE").length,
    VALIDATION: itens.filter((i) => i.status === "VALIDATION").length,
    IN_PROGRESS: itens.filter((i) => i.status === "IN_PROGRESS").length,
    PENDING: itens.filter((i) => i.status === "PENDING").length,
    BLOCKED: itens.filter((i) => i.status === "BLOCKED").length,
  };
  const pct = itens.length > 0 ? Math.round((contagem.DONE / itens.length) * 100) : 0;

  // A timeline mostra fases do mesmo projeto, não cada tarefa como uma
  // etapa visual. Cada fase continua derivada dos itens reais do checklist.
  const fases = workstreams.map((workstream, index) => {
    const faseItens = workstream.itens;
    const temBloqueio = faseItens.some((item) => item.status === "BLOCKED");
    const temAndamento = faseItens.some((item) => item.status === "IN_PROGRESS" || item.status === "VALIDATION");
    const concluida = faseItens.length > 0 && faseItens.every((item) => item.status === "DONE");
    const atual = !concluida && (temBloqueio || temAndamento || !workstreams.slice(0, index).some((anterior) => anterior.itens.some((item) => item.status !== "DONE")));
    return {
      ...workstream,
      label: WORKSTREAM_LABEL[workstream.key] || workstream.key,
      status: temBloqueio ? "blocked" : concluida ? "done" : atual ? "current" : "pending",
      atual,
    };
  });

  // Próximas ações (18/08, pedido do Kauã: "tem que ter as tarefas pra
  // clicar e abrir") — são os PRÓPRIOS itens do checklist real ainda não
  // concluídos, não uma segunda lista fabricada. Cada um abre o mesmo
  // drawer que o checklist completo usa.
  const proximasAcoesChecklist = itens.filter((i) => i.status === "PENDING" || i.status === "IN_PROGRESS").slice(0, 4);

  const diasUteis = (de: Date, ate: Date) => {
    let n = 0;
    const d = new Date(de);
    while (d < ate) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) n++; }
    return n;
  };
  const inicio = fulfillment.startedAt ? new Date(fulfillment.startedAt) : null;
  const previsao = fulfillment.targetAt ? new Date(fulfillment.targetAt) : null;
  const hoje = new Date();
  const tempoDecorrido = inicio ? diasUteis(inicio, hoje) : null;
  const tempoRestante = previsao ? (previsao > hoje ? diasUteis(hoje, previsao) : 0) : null;

  const escopoEntries = escopoVendidoSnapshot ? Object.entries(escopoVendidoSnapshot).filter(([, v]) => v !== null && v !== undefined && v !== "") : [];
  // Resumo curto de capacidade contratada pro header (referência de UX) —
  // pega até 3 campos do MESMO escopoVendidoSnapshot já usado na seção
  // "Escopo contratado" abaixo, nunca uma segunda leitura/fonte.
  const capacidadeResumo = escopoEntries
    .filter(([k]) => ["ramais", "linhas", "troncosSip", "ura"].includes(k))
    .map(([k, v]) => `${v} ${(ESCOPO_LABEL[k] || k).toLowerCase()}`)
    .join(" · ");

  // As fases ficam dentro da página do projeto. Só dados operacionais
  // transversais têm aba própria, evitando transformar cada fase em uma
  // navegação paralela.
  const ABAS = isPabx
    ? PABX_ABAS
    : [
        { key: "visao-geral", label: "Visão geral" },
        { key: "checklist", label: "Checklist" },
        { key: "atividades", label: "Atividades" },
        { key: "historico", label: "Histórico" },
      ];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        <Link href={isPabx ? "/clientes/implantacao" : "/clientes/onboarding"} className="hover:underline">
          {isPabx ? "Implantação" : "Onboarding"}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: "var(--cf2-text-primary)" }}>{empresaNome || "—"}</span>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Implantação PABX</h1>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: fulfillment.status === "COMPLETED" ? "#effaf2" : fulfillment.status === "BLOCKED_PROVIDER" || fulfillment.status === "BLOCKED_INTERNAL" ? "#fff1f2" : "#eef9e8", color: fulfillment.status === "COMPLETED" ? "var(--cf2-success-text)" : fulfillment.status.startsWith("BLOCKED") ? "#dc2626" : "#4d8a1d" }}>
          {STATUS_MACRO_LABEL[fulfillment.status] || fulfillment.status}
        </span>
      </div>
      <p className="-mt-3 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Acompanhe todas as etapas e tarefas da implantação para este cliente.</p>

      {/* Header (reconstruído fiel à referência de UX): card da empresa à
          esquerda (domínio real de empresas.website, responsável, plano
          contratado real de escopoVendidoSnapshot.plano) + estatísticas à
          direita. "E-mail técnico" da referência NÃO tem fonte real hoje —
          sinalizado explicitamente em vez de inventado. */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-start gap-3 lg:w-[410px] shrink-0">
          <div className="flex items-center justify-center rounded-xl shrink-0 w-14 h-14 overflow-hidden" style={{ background: "var(--cf2-bg-inverse)" }}>
            {empresaLogoUrl ? <img src={empresaLogoUrl} alt="" className="w-full h-full object-cover" /> : <Truck className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[17px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{empresaId ? <Link href={`/clientes/${empresaId}`} className="hover:underline">{empresaNome}</Link> : empresaNome || "—"}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{FAMILIA_LABEL[fulfillment.serviceFamily] || fulfillment.serviceFamily}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              <Campo label="Domínio" valor={empresaWebsite || "—"} />
              <div className="min-w-0">
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Responsável interno</p>
                <AssignOwnerControl
                  entityType="fulfillment"
                  entityId={fulfillment.id}
                  currentOwnerId={fulfillment.responsavelId}
                  usuarios={Array.from(usuariosById.values())}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })}
                />
              </div>
              {/* Responsável comercial (19/08) — não é papel novo no modelo,
                  é só quem fechou a venda (negocios.responsavelId), dado
                  real de outra tabela, mostrado pra dar contexto de handoff. */}
              <Campo label="Plano contratado" valor={(escopoVendidoSnapshot?.plano as string) || "—"} />
              <Campo label="E-mail técnico" valor="Sem fonte no modelo hoje" />
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-4 lg:pl-5 lg:border-l" style={{ borderColor: "var(--cf2-border-default)" }}>
          <Campo label="Status da implantação" valor={STATUS_MACRO_LABEL[fulfillment.status] || fulfillment.status} />
          <div>
            <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Progresso geral</p>
            <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{pct}%</p>
            <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cf2-success-text)" }} />
            </div>
          </div>
          <Campo label="Capacidade contratada" valor={capacidadeResumo || "—"} />
          <Campo label="Previsão de conclusão" valor={previsao ? previsao.toLocaleDateString("pt-BR") : "—"} />
          <Campo label="Responsável atual" valor={fulfillment.responsavelNome || "Sem responsável"} />
        </div>
      </div>

      {/* Navegação por abas (referência de UX) — Visão Geral é o conteúdo
          completo de sempre; uma aba por workstream real (nunca uma lista
          fixa — cresce/encolhe com o checklist de cada família); Atividades
          e Histórico reusam a mesma atividade de conclusão real. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className="shrink-0 px-3 py-2 text-[12px] font-semibold whitespace-nowrap"
            style={{
              color: aba === a.key ? "var(--cf2-accent-border)" : "var(--cf2-text-secondary)",
              borderBottom: aba === a.key ? "2px solid var(--cf2-accent-border)" : "2px solid transparent",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "visao-geral" && (
        <>
          {/* Progresso por etapa (referência de UX) + Resumo da implantação —
              mesma linha, mesmos itens reais do checklist (fulfillment_itens),
              nunca uma segunda fonte. Banner de aviso é texto fixo real (o
              processo real permite paralelismo entre workstreams, documentado
              em fulfillment.ts), não um estado calculado. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Progresso por etapa</p>
              <div className="flex items-start overflow-x-auto pb-1">
                {fases.map((fase, i) => {
                  const done = fase.status === "done";
                  const bloqueado = fase.status === "blocked";
                  const destacado = fase.status === "current" || bloqueado;
                  const corDestaque = bloqueado ? "#ef4444" : "var(--cf2-accent)";
                  const corTexto = done ? "var(--cf2-success-text)" : bloqueado ? "#ef4444" : destacado ? "var(--cf2-accent-border)" : "var(--cf2-text-tertiary)";
                  const itemDaFase = fase.itens.find((item) => item.status !== "DONE") || fase.itens[0];
                  return (
                    <div key={fase.key} className="flex items-center shrink-0">
                      <button onClick={() => itemDaFase && setItemSelecionado(itemDaFase)} className="flex flex-col items-center gap-1.5 w-[98px]">
                        <div
                          className="flex items-center justify-center rounded-full w-8 h-8 text-[11px] font-bold shrink-0"
                          style={{
                            background: done ? "var(--cf2-success-text)" : destacado ? corDestaque : "var(--cf2-bg-surface-muted)",
                            color: done || destacado ? "#fff" : "var(--cf2-text-tertiary)",
                            border: destacado && !bloqueado ? "2px solid var(--cf2-accent-border)" : "none",
                          }}
                        >
                          {done ? <Check className="w-3.5 h-3.5" /> : bloqueado ? <AlertTriangle className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <p className="text-[10px] text-center leading-tight font-semibold" style={{ color: done || destacado ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)" }}>{i + 1}. {fase.label}</p>
                        <p className="text-[9px] text-center" style={{ color: corTexto }}>{done ? "Concluído" : bloqueado ? "Bloqueado" : destacado ? "Em andamento" : "Pendente"}</p>
                      </button>
                      {i < fases.length - 1 && <div className="w-5 h-[2px] mt-4 shrink-0" style={{ background: done ? "var(--cf2-success-text)" : "var(--cf2-border-default)" }} />}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-accent-border)" }}>
                Algumas etapas podem ocorrer em paralelo (ex.: portabilidade e softswitch) — acompanhe os blocos abaixo pra mais detalhes.
              </p>
            </div>

            {/* Resumo da implantação — 4 buckets reais, batem exatamente com os
                5 status que o backend suporta (PENDING/IN_PROGRESS/BLOCKED/
                VALIDATION/DONE — VALIDATION somado 20/08). Donut via
                conic-gradient puro, sem lib nova. */}
            <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Resumo da implantação</p>
              <div className="flex items-center gap-5">
                <div
                  className="rounded-full shrink-0 flex items-center justify-center"
                  style={{
                    width: 88, height: 88,
                    background: itens.length === 0 ? "var(--cf2-bg-surface-muted)" : `conic-gradient(
                      var(--cf2-success-text) 0 ${(contagem.DONE / itens.length) * 360}deg,
                      #8e27ef 0 ${((contagem.DONE + contagem.VALIDATION) / itens.length) * 360}deg,
                      var(--cf2-accent-border) 0 ${((contagem.DONE + contagem.VALIDATION + contagem.IN_PROGRESS) / itens.length) * 360}deg,
                      #ef4444 0 ${((contagem.DONE + contagem.VALIDATION + contagem.IN_PROGRESS + contagem.BLOCKED) / itens.length) * 360}deg,
                      var(--cf2-border-default) 0 360deg)`,
                  }}
                >
                  <div className="rounded-full flex items-center justify-center" style={{ width: 62, height: 62, background: "var(--cf2-bg-surface)" }}>
                    <p className="text-[16px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{pct}%</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {[
                    { label: "Concluídas", n: contagem.DONE, cor: "var(--cf2-success-text)" },
                    { label: "Validação", n: contagem.VALIDATION, cor: "#8e27ef" },
                    { label: "Em andamento", n: contagem.IN_PROGRESS, cor: "var(--cf2-accent-border)" },
                    { label: "Pendente", n: contagem.PENDING, cor: "var(--cf2-border-default)" },
                    { label: "Bloqueadas", n: contagem.BLOCKED, cor: "#ef4444" },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5" style={{ color: "var(--cf2-text-secondary)" }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.cor }} />{b.label}
                      </span>
                      <span className="font-bold" style={{ color: "var(--cf2-text-primary)" }}>{b.n} etapa{b.n === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <div className="flex items-start justify-between gap-4 mb-3"><div><p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Checklist da implantação</p><p className="text-[11px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Acompanhe todas as tarefas e entregas necessárias.</p></div><button onClick={() => setAba("checklist")} className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--cf2-accent-border)" }}>Ver checklist completo →</button></div>
              <div className="flex flex-wrap gap-2 mb-3">
                {[{ label: "Todos", n: itens.length }, { label: "Pendentes", n: contagem.PENDING }, { label: "Em andamento", n: contagem.IN_PROGRESS }, { label: "Concluídos", n: contagem.DONE }, { label: "Bloqueados", n: contagem.BLOCKED }].map((f) => <span key={f.label} className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{f.label} <strong>{f.n}</strong></span>)}
              </div>
              <ChecklistLista itens={itens.slice(0, 6)} toggleItem={toggleItem} setItemSelecionado={setItemSelecionado} usuarios={Array.from(usuariosById.values())} fulfillmentResponsavelId={fulfillment.responsavelId} fulfillmentResponsavelNome={fulfillment.responsavelNome} onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })} />
            </div>

            <div className="flex flex-col gap-5">
              <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Bloqueios e pendências</p>
                {pendencias.length === 0 ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pendência bloqueada.</p> : pendencias.slice(0, 3).map((p) => <button key={p.id} onClick={() => setItemSelecionado(p)} className="w-full flex items-start gap-2.5 p-2.5 mb-2 rounded-lg text-left" style={{ background: "var(--cf2-bg-surface-muted)" }}><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--cf2-danger-text)" }} /><span className="min-w-0"><span className="block text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{p.titulo}</span><span className="block text-[11px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{p.blockerReason || "Bloqueio registrado no checklist"}</span></span></button>)}
              </div>
              <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Próximas ações</p>
                {proximasAcoesChecklist.slice(0, 3).map((item) => <button key={item.id} onClick={() => setItemSelecionado(item)} className="w-full flex items-center gap-2.5 p-2.5 mb-2 rounded-lg text-left" style={{ background: "var(--cf2-bg-surface-muted)" }}>{item.status === "IN_PROGRESS" ? <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-accent-border)" }} /> : <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}<span className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.titulo}</span></button>)}
                {proximaAcao && <p className="text-[11px] mt-2 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}>Tarefa vinculada: {proximaAcao.titulo}</p>}
              </div>
            </div>
          </div>

          {/* Informações coletadas e atividades recentes seguem as fontes reais
              do formulário e da Timeline da empresa. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-1" style={{ color: "var(--cf2-text-primary)" }}>Informações coletadas</p>
              <p className="text-[11px] mb-3" style={{ color: "var(--cf2-text-secondary)" }}>Resumo das informações já levantadas no formulário de implantação.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <Campo label="Responsável técnico" valor={formulario?.respostas?.portabilidade?.responsavelTecnico?.nome || "—"} />
                <Campo label="Telefone de contato" valor={formulario?.respostas?.portabilidade?.responsavelTecnico?.telefone || "—"} />
                <Campo label="Linhas de portabilidade" valor={String(linhasPortabilidade?.length ?? formulario?.respostas?.portabilidade?.linhas?.length ?? 0)} />
                <Campo label="Quantidade de ramais" valor={String(ramaisMaterializados?.length ?? formulario?.respostas?.ramais?.length ?? 0)} />
                <Campo label="Opções de URA" valor={String(formulario?.respostas?.ura?.opcoes?.length ?? 0)} />
                <Campo label="Horário de atendimento" valor={formulario?.respostas?.ura?.diasHorarioAtendimento || "—"} />
              </div>
              {linkPublico && <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}><span className="text-[11px] flex-1 truncate" style={{ color: "var(--cf2-text-tertiary)" }}>Formulário: {FORM_STATUS_LABEL[formulario?.status || ""] || formulario?.status || "link disponível"}</span><button onClick={() => { navigator.clipboard.writeText(linkPublico); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{copiado ? "Copiado" : "Copiar link"}</button></div>}
            </div>
            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Atividades recentes</p>
              {(atividadesEmpresa ?? []).length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade registrada pra esta empresa ainda.</p>
              ) : (atividadesEmpresa ?? []).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] truncate" style={{ color: "var(--cf2-text-primary)" }}>
                      {a.autorNome ? `${a.autorNome} · ` : ""}{ATIVIDADE_TIPO_LABEL[a.tipo] || a.tipo}{a.titulo ? ` — ${a.titulo}` : ""}
                    </p>
                    {a.descricao && <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{a.descricao}</p>}
                  </div>
                  <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(a.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} {new Date(a.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>

          </div>

          {/* Documentos e guias (referência de UX) — histórico Zoho real via
              negocioId resolvido no backend + contrato real quando existe
              corpo gerado. Sem seção fingindo ter "guias" que não existem. */}
          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Documentos</p>
            {(documentos.data ?? []).length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum documento histórico encontrado pra este negócio.</p>
            ) : (documentos.data ?? []).map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-secondary)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{d.nomeArquivo}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatBytes(d.tamanhoBytes)}{d.zohoId ? " · histórico (Zoho)" : ""}</p>
                </div>
                {d.arquivoDisponivel && (
                  <a href={`/api/anexos-legado/${d.id}/download`} className="p-1.5 rounded-lg shrink-0" style={{ background: "var(--cf2-bg-surface)" }}>
                    <Download className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {aba === "checklist" && (
        <div className="flex flex-col gap-5">
          <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Checklist da implantação</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Todas as tarefas pertencem ao mesmo projeto. Abra uma tarefa para atualizar status, bloqueio ou responsável.</p>
          </div>
          {fases.map((fase) => (
            <div key={fase.key} className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{fase.label}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{fase.itens.filter((item) => item.status === "DONE").length} de {fase.itens.length} tarefas concluídas</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: fase.status === "blocked" ? "#fff1f2" : fase.status === "done" ? "#effaf2" : "var(--cf2-bg-surface-muted)", color: fase.status === "blocked" ? "#dc2626" : fase.status === "done" ? "var(--cf2-success-text)" : "var(--cf2-text-secondary)" }}>
                  {fase.status === "blocked" ? "Bloqueada" : fase.status === "done" ? "Concluída" : fase.status === "current" ? "Em andamento" : "Pendente"}
                </span>
              </div>
              <ChecklistLista
                itens={fase.itens}
                toggleItem={toggleItem}
                setItemSelecionado={setItemSelecionado}
                usuarios={Array.from(usuariosById.values())}
                fulfillmentResponsavelId={fulfillment.responsavelId}
                fulfillmentResponsavelNome={fulfillment.responsavelNome}
                onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })}
              />
            </div>
          ))}
        </div>
      )}

      {aba === "informacoes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Informações do formulário público</p>
            {!formulario?.respostas ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma resposta recebida do cliente.</p> : (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Responsável técnico" valor={formulario.respostas.portabilidade?.responsavelTecnico?.nome || "—"} />
                <Campo label="Contato técnico" valor={formulario.respostas.portabilidade?.responsavelTecnico?.telefone || "—"} />
                <Campo label="Linhas portadas/novas" valor={String(formulario.respostas.portabilidade?.linhas?.length ?? linhasPortabilidade?.length ?? 0)} />
                <Campo label="Ramais e usuários" valor={String(ramaisMaterializados?.length ?? formulario.respostas.ramais?.length ?? 0)} />
                <Campo label="Opções de URA" valor={String(formulario.respostas.ura?.opcoes?.filter((opcao) => (opcao.destinos?.length ?? 0) > 0).length ?? 0)} />
                <Campo label="Voz da URA" valor={formulario.respostas.ura?.vozSelecionada || "—"} />
                <Campo label="Horário de atendimento" valor={formulario.respostas.ura?.diasHorarioAtendimento || "—"} />
                <Campo label="Status" valor={FORM_STATUS_LABEL[formulario.status] || formulario.status} />
              </div>
            )}
          </div>
          <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Observações técnicas</p>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--cf2-text-secondary)" }}>{formulario?.respostas?.outrasInformacoes || "Nenhuma observação adicional foi registrada pelo cliente."}</p>
          </div>
        </div>
      )}

      {aba === "portabilidade" && (
        <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold mb-1" style={{ color: "var(--cf2-text-primary)" }}>Portabilidade e novas linhas</p>
          <p className="text-[12px] mb-4" style={{ color: "var(--cf2-text-secondary)" }}>Dados materializados a partir do formulário enviado pelo cliente.</p>
          {(linhasPortabilidade ?? []).length === 0 ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma linha submetida ainda.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(linhasPortabilidade ?? []).map((linha) => (
                <div key={linha.id} className="p-4 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <div className="flex items-center justify-between gap-3 mb-2"><span className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{linha.ddd || "—"} {linha.tipo === "nova_linha" ? "· linha nova" : linha.numero || "—"}</span><span className="text-[10px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>{linha.tipo === "nova_linha" ? "Nova" : "Portabilidade"}</span></div>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{linha.operadoraAtual || "Operadora não informada"} · {linha.titular || "Titular não informado"}</p>
                  {linha.anexoUrl && <a href={linha.anexoUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[11px] font-semibold hover:underline" style={{ color: "var(--cf2-accent-border)" }}>Abrir fatura/documento</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "ura-ramais" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Ramais e usuários</p>
            {(ramaisMaterializados ?? []).length === 0 ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum ramal submetido ainda.</p> : <div className="flex flex-col gap-2">{(ramaisMaterializados ?? []).map((ramal) => <div key={ramal.id} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><div><p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{ramal.ramal || "—"} · {ramal.usuario || "Usuário não informado"}</p><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{ramal.departamento || "Departamento não informado"} · {ramal.email || "Sem e-mail"}</p></div><span className="text-[10px] font-semibold" style={{ color: ramal.gravacao ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)" }}>{ramal.gravacao ? "Gravação ativa" : "Sem gravação"}</span></div>)}</div>}
          </div>
          <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>URA e atendimento</p>
            <div className="grid grid-cols-2 gap-3"><Campo label="Números atendidos" valor={String(formulario?.respostas?.ura?.numerosAtendidos?.length ?? 0)} /><Campo label="Opções configuradas" valor={String(formulario?.respostas?.ura?.opcoes?.length ?? 0)} /><Campo label="Voz selecionada" valor={formulario?.respostas?.ura?.vozSelecionada || "—"} /><Campo label="Horário" valor={formulario?.respostas?.ura?.diasHorarioAtendimento || "—"} /></div>
          </div>
        </div>
      )}

      {aba === "testes" && (
        <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold mb-1" style={{ color: "var(--cf2-text-primary)" }}>Testes internos</p>
          <p className="text-[12px] mb-4" style={{ color: "var(--cf2-text-secondary)" }}>Checklist real da fase de QA interno, dentro do mesmo projeto de implantação.</p>
          <ChecklistLista itens={itens.filter((item) => item.workstream === "qa_interno")} toggleItem={toggleItem} setItemSelecionado={setItemSelecionado} usuarios={Array.from(usuariosById.values())} fulfillmentResponsavelId={fulfillment.responsavelId} fulfillmentResponsavelNome={fulfillment.responsavelNome} onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })} />
        </div>
      )}

      {/* Aba por workstream — subconjunto real dos mesmos itens, filtrado.
          Mesma UI de checklist da Visão Geral, reaproveitada. Levantamento/
          Portabilidade/Configuração PBX ganham um bloco extra com o dado
          REAL submetido pelo cliente no formulário público (mesma fonte:
          fulfillment_formularios.respostas) — antes as abas só mostravam o
          checklist genérico sem contexto nenhum. */}
      {workstreams.some((w) => w.key === aba) && (
        <div className="flex flex-col gap-5">
          {aba === "levantamento" && formulario?.respostas && (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>O que o cliente enviou no formulário</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Campo label="Números/linhas informados" valor={String(formulario.respostas.portabilidade?.linhas?.length ?? 0)} />
                <Campo label="Ramais cadastrados" valor={String(formulario.respostas.ramais?.length ?? 0)} />
                <Campo label="Opções de URA" valor={String(formulario.respostas.ura?.opcoes?.filter((o) => (o.destinos?.length ?? 0) > 0).length ?? 0)} />
                <Campo label="Status do formulário" valor={formulario ? FORM_STATUS_LABEL[formulario.status] || formulario.status : "—"} />
              </div>
              {formulario.respostas.outrasInformacoes && (
                <p className="text-[12px] mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
                  <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Observações do cliente: </span>{formulario.respostas.outrasInformacoes}
                </p>
              )}
            </div>
          )}

          {/* Portabilidade — 20/08: fonte passou a ser a tabela relacional
              materializada (fulfillment_linhas_portabilidade), não mais só o
              jsonb bruto. Preenchida na submissão real do formulário
              público (delete+insert idempotente); vazia até isso acontecer. */}
          {aba === "portabilidade" && (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Linhas enviadas pelo cliente ({(linhasPortabilidade ?? []).length})</p>
              {(linhasPortabilidade ?? []).length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum número/linha submetido ainda pelo formulário público.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--cf2-text-tertiary)", textAlign: "left" }}>
                        <th className="pb-2 pr-3 font-semibold">DDD</th>
                        <th className="pb-2 pr-3 font-semibold">Número</th>
                        <th className="pb-2 pr-3 font-semibold">Tipo</th>
                        <th className="pb-2 pr-3 font-semibold">Operadora atual</th>
                        <th className="pb-2 pr-3 font-semibold">Titular</th>
                        <th className="pb-2 font-semibold">Anexo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(linhasPortabilidade ?? []).map((l) => (
                        <tr key={l.id} style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                          <td className="py-1.5 pr-3">{l.ddd || "—"}</td>
                          <td className="py-1.5 pr-3">{l.tipo === "nova_linha" ? "(linha nova)" : l.numero || "—"}</td>
                          <td className="py-1.5 pr-3">{l.tipo === "nova_linha" ? "Linha nova" : "Portabilidade"}</td>
                          <td className="py-1.5 pr-3">{l.operadoraAtual || "—"}</td>
                          <td className="py-1.5 pr-3">{l.titular || "—"}</td>
                          <td className="py-1.5">
                            {l.anexoUrl ? <a href={l.anexoUrl} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--cf2-accent-border)" }}>{l.anexoId || "arquivo"}</a> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Ramais — 20/08: mesma troca, fonte agora é fulfillment_ramais. */}
          {aba === "configuracao_pbx" && (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Ramais enviados pelo cliente ({(ramaisMaterializados ?? []).length})</p>
              {(ramaisMaterializados ?? []).length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum ramal submetido ainda pelo formulário público.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--cf2-text-tertiary)", textAlign: "left" }}>
                        <th className="pb-2 pr-3 font-semibold">Ramal</th>
                        <th className="pb-2 pr-3 font-semibold">Usuário</th>
                        <th className="pb-2 pr-3 font-semibold">Departamento</th>
                        <th className="pb-2 pr-3 font-semibold">Nº externo</th>
                        <th className="pb-2 pr-3 font-semibold">Aparelho</th>
                        <th className="pb-2 pr-3 font-semibold">Gravação</th>
                        <th className="pb-2 font-semibold">Internacional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ramaisMaterializados ?? []).map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                          <td className="py-1.5 pr-3 font-semibold">{r.ramal || "—"}</td>
                          <td className="py-1.5 pr-3">{r.usuario || "—"}</td>
                          <td className="py-1.5 pr-3">{r.departamento || "—"}</td>
                          <td className="py-1.5 pr-3">{r.numeroExterno || "—"}</td>
                          <td className="py-1.5 pr-3">{r.usaAparelhoFisico ? r.modeloAparelho || "Sim" : "Não"}</td>
                          <td className="py-1.5 pr-3">{r.gravacao ? "Sim" : "Não"}</td>
                          <td className="py-1.5">{r.ligacoesInternacionais ? (r.paisesPermitidos?.join(", ") || "Sim") : "Não"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{WORKSTREAM_LABEL[aba] || aba} — checklist</p>
            <ChecklistLista
              itens={itens.filter((i) => i.workstream === aba)}
              toggleItem={toggleItem}
              setItemSelecionado={setItemSelecionado}
              usuarios={Array.from(usuariosById.values())}
              fulfillmentResponsavelId={fulfillment.responsavelId}
              fulfillmentResponsavelNome={fulfillment.responsavelNome}
              onOwnerChanged={() => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] })}
            />
          </div>
        </div>
      )}

      {aba === "atividades" && (
        <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Atividades recentes</p>
          {atividadesRecentes.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma etapa concluída ainda.</p>
          ) : atividadesRecentes.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-success-text)" }} />
              <p className="flex-1 text-[12px] truncate" style={{ color: "var(--cf2-text-primary)" }}>
                {a.completedByNome ? `${a.completedByNome} concluiu ` : "Concluído: "}{a.titulo}
              </p>
              <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(a.completedAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
            </div>
          ))}
        </div>
      )}

      {aba === "historico" && (
        <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Histórico de conclusão</p>
          <p className="text-[11px] mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>Mesma atividade real das etapas concluídas — sem limite de itens.</p>
          {historicoCompleto.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma etapa concluída ainda.</p>
          ) : historicoCompleto.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-success-text)" }} />
              <p className="flex-1 text-[12px] truncate" style={{ color: "var(--cf2-text-primary)" }}>
                {a.completedByNome ? `${a.completedByNome} concluiu ` : "Concluído: "}{a.titulo}
              </p>
              <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(a.completedAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
            </div>
          ))}
        </div>
      )}

      <Cf2FulfillmentItemDrawer
        item={itemSelecionado}
        fulfillmentId={fulfillmentId}
        open={!!itemSelecionado}
        onClose={() => setItemSelecionado(null)}
        fulfillmentResponsavelId={fulfillment.responsavelId}
      />
    </div>
  );
}

// Lista de checklist reaproveitada entre a Visão Geral (todos os itens) e
// as abas por workstream (subconjunto filtrado) — mesma UI, mesma lógica
// de toggle, nunca duas implementações divergentes.
// Status do item como pill colorido (referência de UX: ferramenta de
// tarefas do Kauã — Não iniciado/Em andamento/Pendência/Finalizado), não
// mais um checkbox solto. Mesmos 4 status reais que o backend já aceita
// (PENDING/IN_PROGRESS/BLOCKED/DONE) — só a representação visual muda.
// 7 rótulos exatos do Kauã (20/08) sobre os 5 valores reais do banco
// (PENDING/IN_PROGRESS/BLOCKED/VALIDATION/DONE) — BLOCKED se desdobra em 3
// rótulos (Aguardando cliente/Aguardando fornecedor/Bloqueado) conforme
// blockerType. A chave composta abaixo é só de UI (pra virar um <select>
// com as 7 opções reais de escolha); o PATCH sempre manda {status,
// blockerType} de volta pro backend, nunca essa chave composta.
type StatusEtapaKey = "PENDING" | "IN_PROGRESS" | "BLOCKED_CUSTOMER" | "BLOCKED_PROVIDER" | "BLOCKED_INTERNAL" | "VALIDATION" | "DONE";
const STATUS_ETAPA_LABEL: Record<StatusEtapaKey, string> = {
  PENDING: "Não iniciado", IN_PROGRESS: "Em andamento",
  BLOCKED_CUSTOMER: "Aguardando cliente", BLOCKED_PROVIDER: "Aguardando fornecedor", BLOCKED_INTERNAL: "Bloqueado",
  VALIDATION: "Validação", DONE: "Concluído",
};
const STATUS_ETAPA_COLOR: Record<StatusEtapaKey, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: "var(--cf2-bg-surface)", text: "var(--cf2-text-tertiary)", dot: "var(--cf2-text-tertiary)" },
  IN_PROGRESS: { bg: "var(--cf2-accent-bg-subtle)", text: "var(--cf2-accent-border)", dot: "var(--cf2-accent-border)" },
  BLOCKED_CUSTOMER: { bg: "#f59e0b18", text: "#b45309", dot: "#f59e0b" },
  BLOCKED_PROVIDER: { bg: "#f59e0b18", text: "#b45309", dot: "#f59e0b" },
  BLOCKED_INTERNAL: { bg: "#ef444418", text: "#ef4444", dot: "#ef4444" },
  VALIDATION: { bg: "#8e27ef18", text: "#8e27ef", dot: "#8e27ef" },
  DONE: { bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)", dot: "var(--cf2-success-text)" },
};
// Item real (status + blockerType) → chave composta de UI.
function chaveStatusEtapa(item: { status: string; blockerType?: string | null }): StatusEtapaKey {
  if (item.status === "BLOCKED") {
    if (item.blockerType === "CUSTOMER") return "BLOCKED_CUSTOMER";
    if (item.blockerType === "PROVIDER") return "BLOCKED_PROVIDER";
    return "BLOCKED_INTERNAL";
  }
  return (item.status as StatusEtapaKey) in STATUS_ETAPA_LABEL ? (item.status as StatusEtapaKey) : "PENDING";
}
// Rótulo legado (usado em textos soltos que só têm o status cru, sem
// blockerType à mão) — mantido só pra não quebrar leitura simples.
const STATUS_ITEM_LABEL: Record<string, string> = {
  PENDING: "Não iniciado", IN_PROGRESS: "Em andamento", BLOCKED: "Bloqueado", VALIDATION: "Validação", DONE: "Concluído",
};

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
        className="appearance-none text-[11px] font-bold pl-3 pr-6 py-1.5 rounded-full cursor-pointer outline-none"
        style={{ background: cor.bg, color: cor.text }}
      >
        {Object.entries(STATUS_ETAPA_LABEL).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
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
        // Responsável por item (20/08) — sem valor próprio, cai pro
        // responsável do fulfillment inteiro só na exibição (nunca grava
        // esse fallback de volta no item).
        const semResponsavelProprio = !item.responsavelId;
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2.5 rounded-lg"
            style={{ background: "var(--cf2-bg-surface-muted)", border: isMilestone ? "1px dashed var(--cf2-accent)" : "none" }}
          >
            <StatusPillSelect
              status={item.status}
              blockerType={item.blockerType}
              onChange={(status, blockerType) => toggleItem.mutate({ itemId: item.id, status, blockerType })}
            />
            {isMilestone && <Star className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-accent)" }} />}
            <button onClick={() => setItemSelecionado(item)} className="flex-1 flex flex-col gap-1 text-left">
              <span className="text-[13px]" style={{ color: item.status === "DONE" ? "var(--cf2-text-tertiary)" : "var(--cf2-text-primary)", textDecoration: item.status === "DONE" ? "line-through" : "none" }}>{item.titulo}</span>
              {(estagios.length > 0 || isMilestone || isHandoff) && (
                <div className="flex items-center gap-1 flex-wrap">
                  {estagios.map((e) => (
                    <span key={e} className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)", border: "1px solid var(--cf2-border-default)" }}>{ESTAGIO_LABEL[e] || e}</span>
                  ))}
                  {isMilestone && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#8e27ef18", color: "#8e27ef" }}>Primeiro valor · marco manual</span>}
                  {isHandoff && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1" style={{ background: "#3b82f618", color: "#3b82f6" }}>
                      <ArrowRightLeft className="w-2.5 h-2.5" /> Handoff CS
                    </span>
                  )}
                </div>
              )}
            </button>
            {item.blockerReason && item.status === "BLOCKED" && (
              <span className="text-[10px] max-w-[160px] truncate shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} title={item.blockerReason}>{item.blockerReason}</span>
            )}
            <div className="shrink-0 flex flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
              <AssignOwnerControl
                entityType="fulfillment_item"
                entityId={item.id}
                currentOwnerId={item.responsavelId ?? fulfillmentResponsavelId}
                usuarios={usuarios}
                onChanged={onOwnerChanged}
              />
              {semResponsavelProprio && fulfillmentResponsavelNome && (
                <span className="text-[9px]" style={{ color: "var(--cf2-text-tertiary)" }}>via responsável do projeto</span>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} onClick={() => setItemSelecionado(item)} />
          </div>
        );
      })}
    </>
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
