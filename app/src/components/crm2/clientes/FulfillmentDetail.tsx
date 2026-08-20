"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Truck, Copy, Check, Star, ArrowRightLeft, Calendar, FileText, Download, AlertTriangle, Clock, Circle } from "lucide-react";
import { toast } from "sonner";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
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
  status: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  blockerType: string | null;
  blockerReason: string | null;
  metadata?: ItemMetadata | null;
  completedAt: string | null;
  completedByNome: string | null;
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

interface Formulario {
  id: string;
  status: string;
  submetidoEm: string | null;
  // Respostas reais (jsonb livre) — já vinha completo do backend
  // (db.select() sem projeção), só não estava tipado/lido no frontend.
  respostas?: {
    portabilidade?: { linhas?: { ddd?: string; numero?: string; novaLinha?: boolean }[]; razaoSocialTitular?: string; cnpjCpfTitular?: string; operadoraAtual?: string; responsavelTecnico?: { nome?: string; email?: string; telefone?: string } };
    ramais?: Record<string, unknown>[];
    ura?: { numerosAtendidos?: string[]; diasHorarioAtendimento?: string; opcoes?: { rotulo?: string; destinos?: string[] }[] };
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
  formulario?: Formulario | null;
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
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const r = await fetch(`/api/fulfillments/itens/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-fulfillment", fulfillmentId] }),
    onError: () => toast.error("Não foi possível atualizar o item"),
  });

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (!data) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Fulfillment não encontrado.</p>;

  const { fulfillment, itens, publicToken, escopoVendidoSnapshot, empresaId, empresaNome, empresaWebsite, formulario, proximaAcao, responsavelComercialNome, propostaId, propostaNumero, atividadesEmpresa } = data;
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

  // Resumo por status (referência de UX, 18/08) — os 4 buckets do mockup
  // (Concluídas/Em andamento/Pendente/Bloqueadas) batem exatamente com os 4
  // status reais que o backend já aceita (PENDING/IN_PROGRESS/BLOCKED/DONE)
  // — só que a UI nunca expunha IN_PROGRESS como opção antes desta sessão.
  const contagem = {
    DONE: itens.filter((i) => i.status === "DONE").length,
    IN_PROGRESS: itens.filter((i) => i.status === "IN_PROGRESS").length,
    PENDING: itens.filter((i) => i.status === "PENDING").length,
    BLOCKED: itens.filter((i) => i.status === "BLOCKED").length,
  };
  const pct = itens.length > 0 ? Math.round((contagem.DONE / itens.length) * 100) : 0;

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

  const ABAS = [
    { key: "visao-geral", label: "Visão geral" },
    ...workstreams.map((w) => ({ key: w.key, label: WORKSTREAM_LABEL[w.key] || w.key })),
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

      {/* Header (reconstruído fiel à referência de UX): card da empresa à
          esquerda (domínio real de empresas.website, responsável, plano
          contratado real de escopoVendidoSnapshot.plano) + estatísticas à
          direita. "E-mail técnico" da referência NÃO tem fonte real hoje —
          sinalizado explicitamente em vez de inventado. */}
      <div className="flex flex-col lg:flex-row gap-5 p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-start gap-3 lg:w-[280px] shrink-0">
          <div className="flex items-center justify-center rounded-2xl shrink-0 w-11 h-11" style={{ background: "var(--cf2-bg-inverse)" }}>
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{empresaId ? <Link href={`/clientes/${empresaId}`} className="hover:underline">{empresaNome}</Link> : empresaNome || "—"}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{FAMILIA_LABEL[fulfillment.serviceFamily] || fulfillment.serviceFamily}</span>
            </div>
            <div className="flex flex-col gap-1 mt-2">
              <Campo label="Domínio" valor={empresaWebsite || "—"} />
              <div className="flex items-center gap-1.5">
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Responsável:</p>
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
              {responsavelComercialNome && <Campo label="Comercial" valor={responsavelComercialNome} />}
              <Campo label="E-mail técnico" valor="Sem fonte no modelo hoje" />
              <Campo label="Plano contratado" valor={(escopoVendidoSnapshot?.plano as string) || "—"} />
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
              <div className="flex items-center overflow-x-auto pb-1">
                {itens.map((item, i) => {
                  const done = item.status === "DONE";
                  const bloqueado = item.status === "BLOCKED";
                  const emAndamento = item.status === "IN_PROGRESS";
                  const atual = item.id === primeiroPendente?.id;
                  const destacado = atual || emAndamento || bloqueado;
                  const statusLabel = done ? "Concluído" : bloqueado ? "Bloqueado" : emAndamento || atual ? "Em andamento" : "Pendente";
                  return (
                    <div key={item.id} className="flex items-center shrink-0">
                      <button onClick={() => setItemSelecionado(item)} className="flex flex-col items-center gap-1.5 w-[100px]">
                        <div
                          className="flex items-center justify-center rounded-full w-8 h-8 text-[11px] font-bold shrink-0"
                          style={{
                            background: done ? "var(--cf2-success-text)" : bloqueado ? "#ef4444" : destacado ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)",
                            color: done || destacado ? "#fff" : "var(--cf2-text-tertiary)",
                            border: destacado && !bloqueado ? "2px solid var(--cf2-accent-border)" : "none",
                          }}
                        >
                          {done ? <Check className="w-3.5 h-3.5" /> : bloqueado ? <AlertTriangle className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <p className="text-[10px] text-center leading-tight font-semibold" style={{ color: done || destacado ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)" }}>{i + 1}. {WORKSTREAM_LABEL[item.workstream] || item.titulo}</p>
                        <p className="text-[9px] text-center" style={{ color: done ? "var(--cf2-success-text)" : bloqueado ? "#ef4444" : destacado ? "var(--cf2-accent-border)" : "var(--cf2-text-tertiary)" }}>{statusLabel}</p>
                      </button>
                      {i < itens.length - 1 && <div className="w-6 h-[2px] shrink-0" style={{ background: done ? "var(--cf2-success-text)" : "var(--cf2-border-default)" }} />}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-accent-border)" }}>
                Algumas etapas podem ocorrer em paralelo (ex.: portabilidade e softswitch) — acompanhe os blocos abaixo pra mais detalhes.
              </p>
            </div>

            {/* Resumo da implantação — 4 buckets reais, batem exatamente com os
                4 status que o backend já suporta (PENDING/IN_PROGRESS/BLOCKED/
                DONE). Donut via conic-gradient puro, sem lib nova. */}
            <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Resumo da implantação</p>
              <div className="flex items-center gap-5">
                <div
                  className="rounded-full shrink-0 flex items-center justify-center"
                  style={{
                    width: 88, height: 88,
                    background: itens.length === 0 ? "var(--cf2-bg-surface-muted)" : `conic-gradient(var(--cf2-success-text) 0 ${(contagem.DONE / itens.length) * 360}deg, var(--cf2-accent-border) 0 ${((contagem.DONE + contagem.IN_PROGRESS) / itens.length) * 360}deg, #ef4444 0 ${((contagem.DONE + contagem.IN_PROGRESS + contagem.BLOCKED) / itens.length) * 360}deg, var(--cf2-border-default) 0 360deg)`,
                  }}
                >
                  <div className="rounded-full flex items-center justify-center" style={{ width: 62, height: 62, background: "var(--cf2-bg-surface)" }}>
                    <p className="text-[16px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{pct}%</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {[
                    { label: "Concluídas", n: contagem.DONE, cor: "var(--cf2-success-text)" },
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

          {/* Linha de 4 colunas (referência de UX): Escopo contratado /
              Formulário de informações / Pendências e bloqueios / Próximas
              ações — mesma ordem e agrupamento da referência. */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Escopo contratado — origem real: fulfillments.escopoVendidoSnapshot,
                snapshot tirado da Oportunidade Ganha (propostaItens/contrato)
                no momento em que o Won criou este serviço/fulfillment. Não é
                dado do Cliente/Empresa (que não guarda escopo técnico) nem
                editável aqui — reflete o que foi vendido, não o estado atual. */}
            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Escopo contratado</p>
              {escopoEntries.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem snapshot de escopo pra este serviço.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {escopoEntries.map(([chave, valor]) => (
                    <div key={chave} className="flex items-center justify-between text-[12px]">
                      <span style={{ color: "var(--cf2-text-secondary)" }}>{ESCOPO_LABEL[chave] || chave}</span>
                      <span className="font-bold" style={{ color: "var(--cf2-text-primary)" }}>{typeof valor === "boolean" ? (valor ? "Sim" : "Não") : String(valor)}</span>
                    </div>
                  ))}
                </div>
              )}
              {propostaId ? (
                <Link href={`/p/${propostaId}`} className="flex items-center justify-between mt-2 pt-2 text-[12px] font-semibold hover:underline" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-accent-border)" }}>
                  Ver proposta {propostaNumero ? `#${propostaNumero}` : ""} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <p className="text-[11px] mt-2 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}>Sem proposta vinculada a este negócio.</p>
              )}
            </div>

            {/* Formulário de informações — fulfillment_formularios real, link
                público via fulfillments.public_token. "Visualizado pelo
                cliente" (timestamp) da referência NÃO existe no schema hoje
                (só enviadoEm/submetidoEm) — omitido, não inventado. */}
            {isPabx ? (
              <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Formulário de informações</p>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Envie o formulário para coleta de informações técnicas do parceiro.</p>
                <span className="self-start text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
                  {formulario ? FORM_STATUS_LABEL[formulario.status] || formulario.status : "Ainda não criado"}
                </span>
                {linkPublico && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input readOnly value={linkPublico} className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }} />
                    <button
                      onClick={() => { navigator.clipboard.writeText(linkPublico); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
                      className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
                    >
                      {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-1 mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                  {formulario?.submetidoEm && <p>Concluído em {new Date(formulario.submetidoEm).toLocaleDateString("pt-BR")}</p>}
                  {!formulario && <p>Cliente ainda não acessou o link.</p>}
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Formulário de informações</p>
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Só existe pro processo PABX hoje — {FAMILIA_LABEL[fulfillment.serviceFamily]} não tem esse formulário.</p>
              </div>
            )}

            {/* Pendências e bloqueios — itens BLOCKED reais (fulfillment_itens),
                motivo vem de blockerReason real, "desde" vem de updatedAt do
                próprio item (data real da última mudança, não fabricada). */}
            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pendências e bloqueios</p>
              {pendencias.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pendência bloqueada.</p>
              ) : pendencias.map((p) => {
                const alta = p.blockerType === "INTERNAL" || p.blockerType === "PROVIDER";
                return (
                  <button key={p.id} onClick={() => setItemSelecionado(p)} className="flex items-start gap-2.5 p-2.5 rounded-lg text-left" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: alta ? "var(--cf2-danger-text)" : "var(--cf2-warning-text)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{p.titulo}</p>
                      {p.blockerReason && <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{p.blockerReason}</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Próximas ações — itens reais do checklist ainda não concluídos
                (não uma segunda fonte). `proximaAcao` é a tarefa CRM real
                vinculada via lead da empresa, quando existir. */}
            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Próximas ações</p>
              {proximasAcoesChecklist.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada pendente — checklist concluído ou tudo bloqueado.</p>
              ) : proximasAcoesChecklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setItemSelecionado(item)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-left"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                >
                  {item.status === "IN_PROGRESS" ? <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-accent-border)" }} /> : <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}
                  <span className="flex-1 text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.titulo}</span>
                </button>
              ))}
              {proximaAcao && (
                <div className="flex items-center justify-between mt-1 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  <div>
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>TAREFA CRM VINCULADA</p>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{proximaAcao.titulo}</p>
                  </div>
                  <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{proximaAcao.usuarioNome || "sem responsável"}</p>
                </div>
              )}
            </div>
          </div>

          {/* Linha final (referência de UX): Atividades recentes / Informações
              rápidas. Atividades recentes agora usa o feed real e variado da
              tabela `atividades` (mesma fonte de qualquer Timeline do CRM,
              ligada via leads.empresaId) em vez de só conclusão de checklist —
              mais fiel ao que a referência mostra (nota/documento/tarefa). */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

            {/* Informações rápidas — mesmos campos de início/previsão/tempo já
                calculados acima, só reorganizados num box próprio igual à
                referência. */}
            <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Informações rápidas</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Início da implantação" valor={inicio ? inicio.toLocaleDateString("pt-BR") : "—"} />
                <Campo label="Previsão de conclusão" valor={previsao ? previsao.toLocaleDateString("pt-BR") : "—"} />
                <Campo label="Tempo decorrido" valor={tempoDecorrido !== null ? `${tempoDecorrido} dias úteis` : "—"} />
                <Campo label="Tempo restante" valor={tempoRestante !== null ? `${tempoRestante} dias úteis` : "—"} />
              </div>
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

          {aba === "portabilidade" && formulario?.respostas?.portabilidade && (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Dados de portabilidade enviados pelo cliente</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                <Campo label="Titular das linhas" valor={formulario.respostas.portabilidade.razaoSocialTitular || "—"} />
                <Campo label="CNPJ/CPF" valor={formulario.respostas.portabilidade.cnpjCpfTitular || "—"} />
                <Campo label="Operadora atual" valor={formulario.respostas.portabilidade.operadoraAtual || "—"} />
              </div>
              {(formulario.respostas.portabilidade.linhas ?? []).length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum número/linha informado ainda.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {(formulario.respostas.portabilidade.linhas ?? []).map((l, i) => (
                    <p key={i} className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                      {l.novaLinha ? `DDD ${l.ddd} — linha nova` : `${l.ddd} ${l.numero} — a portar`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {aba === "configuracao_pbx" && formulario?.respostas?.ramais && formulario.respostas.ramais.length > 0 && (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Ramais informados pelo cliente ({formulario.respostas.ramais.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {formulario.respostas.ramais.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
                    <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{String(r.ramal ?? "—")}</span> · {String(r.nome ?? "")} {String(r.sobrenome ?? "")} · {String(r.departamento ?? "")}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{WORKSTREAM_LABEL[aba] || aba} — checklist</p>
            <ChecklistLista itens={itens.filter((i) => i.workstream === aba)} toggleItem={toggleItem} setItemSelecionado={setItemSelecionado} />
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
const STATUS_ITEM_LABEL: Record<string, string> = {
  PENDING: "Não iniciado", IN_PROGRESS: "Em andamento", BLOCKED: "Pendência", DONE: "Finalizado",
};
const STATUS_ITEM_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: "var(--cf2-bg-surface)", text: "var(--cf2-text-tertiary)", dot: "var(--cf2-text-tertiary)" },
  IN_PROGRESS: { bg: "var(--cf2-accent-bg-subtle)", text: "var(--cf2-accent-border)", dot: "var(--cf2-accent-border)" },
  BLOCKED: { bg: "#ef444418", text: "#ef4444", dot: "#ef4444" },
  DONE: { bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)", dot: "var(--cf2-success-text)" },
};

function StatusPillSelect({ status, onChange }: { status: string; onChange: (status: string) => void }) {
  const cor = STATUS_ITEM_COLOR[status] || STATUS_ITEM_COLOR.PENDING;
  return (
    <div className="relative shrink-0">
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-[11px] font-bold pl-3 pr-6 py-1.5 rounded-full cursor-pointer outline-none"
        style={{ background: cor.bg, color: cor.text }}
      >
        {Object.entries(STATUS_ITEM_LABEL).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <span className="w-1.5 h-1.5 rounded-full absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ background: cor.dot }} />
    </div>
  );
}

function ChecklistLista({
  itens, toggleItem, setItemSelecionado,
}: {
  itens: Item[];
  toggleItem: ReturnType<typeof useMutation<unknown, Error, { itemId: string; status: string }>>;
  setItemSelecionado: (item: Item) => void;
}) {
  return (
    <>
      {itens.map((item) => {
        const isMilestone = item.metadata?.milestone === "FIRST_VALUE";
        const isHandoff = !!item.metadata?.handoffCs;
        const estagios = item.metadata?.estagioPedagogico ?? [];
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2.5 rounded-lg"
            style={{ background: "var(--cf2-bg-surface-muted)", border: isMilestone ? "1px dashed var(--cf2-accent)" : "none" }}
          >
            <StatusPillSelect status={item.status} onChange={(status) => toggleItem.mutate({ itemId: item.id, status })} />
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
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} onClick={() => setItemSelecionado(item)} />
          </div>
        );
      })}
    </>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{valor}</p>
    </div>
  );
}
