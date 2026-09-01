"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Building2, FileText, Calendar, Download, Plus, ArrowUpRight, Tag, X, AlertTriangle, Plug, ChevronDown, RotateCw } from "lucide-react";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { NovaOportunidadeModal } from "@/components/crm2/pipeline/NovaOportunidadeModal";
import { Cf2NovaPessoaModal } from "@/components/crm2/contatos/NovaPessoaModal";
import { Cf2ClienteFinanceiro } from "./ClienteFinanceiro";
import { Cf2MrrMensalChart } from "./MrrMensalChart";
import { Cf2FulfillmentDetail } from "./FulfillmentDetail";
import { motivos as motivosAtencao, type Conta as ContaAtencao } from "./SucessoWorkspace";

interface Servico {
  id: string;
  serviceFamily: string;
  canonicalProduct: string | null;
  revenueNature: string;
  commercialLifecycle: string;
  billingStatus: string;
  billingSource?: string | null;
  stripeSubscriptionId?: string | null;
  currentRecurringValue: string;
  ledger?: { latestCompetence: string; billedValue: string; entries: number; sourceFile: string } | null;
  portfolioIncluded: boolean;
  confidence: string;
  fulfillment: { id: string; status: string; totalItens: number; itensConcluidos: number } | null;
  contrato: { id: string; status: string; corpoGerado: string | null; zohoId: string | null } | null;
  // Fundação de integração Callface AI (20/08, ver crm2-decisoes-pendentes.md
  // item 9) — null quando o serviço não é da família CALLFACE_AI; nas 4
  // tabelas novas (external_identities/tenant_snapshots/usage_events/
  // reconciliation_candidates) ainda não existe nenhuma linha, então
  // `conectado` é sempre false hoje. Estrutura pronta, zero dado fabricado.
  callfaceAiIntegracao: { conectado: boolean; organizationId: string | null; confidence: string | null; source: string | null; verifiedAt: string | null } | null;
}

interface Proposta { id: string; numero: number; valorTotal: string | null; status: string; createdAt: string }
interface ProximaAcao { id: string; titulo: string; venceEm: string | null; usuarioNome: string | null }
interface AtividadeRecente { id: string; tipo: string; titulo: string | null; createdAt: string; autorNome: string | null; pessoaNome: string | null }
interface PontoMensal { mes: string; valor: number }
interface Pessoa {
  // `id` permanece compatível com links legados; `pessoaId` é a identidade
  // canônica e `leadId` é o contexto comercial usado por telas antigas.
  id: string; pessoaId: string | null; leadId: string | null; leadIds: string[];
  nome: string; cargo: string | null; email: string | null; telefone: string | null;
  tipo: string; papel: string | null;
}

function PessoaResumoLink({ pessoa }: { pessoa: Pessoa }) {
  const className = "flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)]";
  const content = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{pessoa.nome}{pessoa.cargo ? ` · ${pessoa.cargo}` : ""}</p>
        <Cf2Badge variant="neutral">{PAPEL_LABEL[pessoa.papel ?? ""] || "sem papel definido"}</Cf2Badge>
      </div>
      <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{pessoa.email || "—"}</p>
    </>
  );
  return pessoa.leadId
    ? <Link href={`/contatos/${pessoa.leadId}`} className={className}>{content}</Link>
    : <div className={className} title="Pessoa canônica sem lead comercial vinculado">{content}</div>;
}
interface NegocioComercial {
  id: string; titulo: string; status: string; temperatura: string | null;
  valorTotal: string | null; commercialMotion: string; responsavelId: string | null;
  vendedorNome: string | null; createdAt: string; ganhoAt: string | null;
}
interface EventoTimeline { id: string; tipo: string; titulo: string; subtitulo: string | null; quando: string }
interface ContratoCliente {
  id: string; tipo: string; descricao: string | null; status: string; moeda: string;
  mrr: string | null; currentRecurringValue: string | null; servicos: string[] | null;
  inicio: string | null; vencimento: string | null; renovacaoAuto: boolean | null;
  assinaturaStatus: string; assinadoEm: string | null; createdAt: string;
  signatureStatus: string | null;
  emailEntrega?: { status?: "sent" | "failed" | "skipped"; recipients?: string[]; attempts?: number; error?: string; lastAttemptAt?: string; sentAt?: string } | null;
  temCorpoGerado: boolean; zohoId: string | null; negocioId: string | null; leadId: string;
  propostaOrigem: { id: string; numero: number } | null; diasParaVencer: number | null;
  stripeSubscriptionId: string | null; billingStatus: string | null;
  // Compatibilidade defensiva: contratos legados/servidor em atualização podem
  // chegar sem o agregado de faturas. A ausência de payload não pode derrubar
  // o Cliente 360.
  faturas?: { total: number; abertas: number; atrasadas: number; pagas: number };
  itens?: { nome: string; descricao: string | null; quantidade: string; valorUnitario: string; subtotal: string }[];
}
interface OrigemAquisicao {
  origem: string | null; campanha: string | null; conjunto: string | null; criativo: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; landingPage: string | null;
  firstTouch: string; lastTouch: string | null;
  vendaOrigem: { negocioId: string | null; valor: string | null; mrr: string | null; ganhoAt: string | null } | null;
}

interface Executivo { id: string; nome: string | null; email: string | null }

interface Cliente360Data {
  empresa: {
    id: string; nome: string; setor: string | null; cnpj: string | null;
    porte: string | null; cidade: string | null; estado: string | null; tags: string[] | null;
  };
  pessoas: Pessoa[];
  servicos: Servico[];
  currentMrr: number;
  clienteDesde: string | null;
  statusFinanceiro: string | null;
  responsavel: { id: string; nome: string; email: string | null } | null;
  executivo: Executivo | null;
  faturasAtrasadas: number;
  faturasAbertas: number;
  faturasAbertasValor: string;
  proximaFatura: { valor: string; vencimento: string } | null;
  propostas: Proposta[];
  proximasAcoes: ProximaAcao[];
  atividadesRecentes: AtividadeRecente[];
  mrrMensal: PontoMensal[];
  negocios: NegocioComercial[];
  timelineEventos: EventoTimeline[];
  origemAquisicao: OrigemAquisicao | null;
  negocioIds: string[];
  contratoIds: string[];
  contratos: ContratoCliente[];
  contratoVencendoEmBreve: ContratoCliente | null;
}

interface AnexoLegado {
  id: string;
  entidadeId: string;
  nomeArquivo: string;
  tamanhoBytes: number | null;
  categoria: string;
  criadoEmOriginal: string | null;
  zohoId: string | null;
  arquivoDisponivel: boolean;
}

const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Não classificado" };
const LIFECYCLE_COLOR: Record<string, string> = { ACTIVE: "#059669", CHURNED: "#6B7280", SUPERSEDED: "#9497ab" };
// Label do botão de entrega por família (mesma convenção de EntregaWorkspace.tsx/clientes-tabs.ts):
// Callface AI = onboarding, PABX/White Label = implantação.
const ENTREGA_LABEL: Record<string, string> = { CALLFACE_AI: "Abrir onboarding", PABX: "Abrir implantação", WHITE_LABEL: "Abrir implantação" };
// Papel real de negocio_leads.papel — campo texto livre no schema (sem enum
// de banco). Reestruturação 20/08: Kauã pediu "financeiro" e "usuário" como
// valores possíveis além de contato/decisor/influenciador/tecnico — passam
// a ser aceitos/exibidos aqui daqui pra frente; NÃO há backfill retroativo
// (nenhum dado real sustenta marcar histórico existente com esses valores).
const PAPEL_LABEL: Record<string, string> = {
  contato: "Contato", decisor: "Decisor", influenciador: "Influenciador", tecnico: "Técnico",
  financeiro: "Financeiro", usuario: "Usuário",
};
const PROPOSTA_STATUS_BADGE: Record<string, "neutral" | "accent" | "success" | "danger"> = {
  rascunho: "neutral", enviada: "accent", aceita: "success", recusada: "danger", expirada: "neutral",
};
// Fase real = clientes.status_financeiro (mesma fonte/rótulo da coluna
// "Financeiro" da Carteira, Workspace.tsx) — nunca inventar uma fase nova.
const STATUS_FINANCEIRO_LABEL: Record<string, string> = { ativo: "Ativo", inadimplente: "Inadimplente", churned: "Churned", indefinido: "Indefinido" };
// Status de negócio: chaves reais do pipeline padrão (lib/crm/pipeline.ts,
// DEFAULT_STAGES + DEFAULT_CLOSED_STAGES). Pipeline pode ter stages custom
// por org — fallback mostra o valor cru em vez de escondê-lo.
const NEGOCIO_STATUS_LABEL: Record<string, string> = {
  reuniao_agendada: "Reunião agendada", reuniao_realizada: "Reunião realizada", trial: "Trial",
  proposta_apresentada: "Proposta enviada", negociacao_iniciada: "Negociação",
  ganho: "Ganho", perdido: "Perdido", no_show: "No-show",
};
const NEGOCIO_STATUS_COR: Record<string, string> = { ganho: "var(--cf2-success-text)", perdido: "var(--cf2-danger-text)", no_show: "var(--cf2-warning-text, #d97706)" };
const COMMERCIAL_MOTION_LABEL: Record<string, string> = { NEW_BUSINESS: "Novo negócio", EXPANSION: "Expansão", RENEWAL: "Renovação", REACTIVATION: "Reativação" };
// Rótulo do tipo de evento na Timeline consolidada — mesma convenção de
// CANAL_LABEL (Workspace.tsx da Carteira), estendida com os tipos que só
// existem aqui (proposta/venda/contrato/pagamento/implantacao vêm de
// tabelas diferentes de `atividades.tipo`, nunca fabricados).
const EVENTO_TIPO_LABEL: Record<string, string> = {
  nota: "Nota", whatsapp: "WhatsApp", email: "E-mail", email_legado: "E-mail",
  ligacao: "Ligação", ligacao_legado: "Ligação", reuniao: "Reunião", reuniao_legado: "Reunião",
  tarefa: "Tarefa", tarefa_legado: "Tarefa", cadencia: "Cadência", proposta_enviada: "Proposta enviada",
  diagnostico: "Diagnóstico", follow_up: "Follow-up",
  proposta: "Proposta", venda: "Venda", contrato: "Contrato", pagamento: "Pagamento", implantacao: "Entrega/Onboarding",
};
// Ordem 20/08 (referência de UX densa do Kauã) — Onboarding/Implantação/CS
// entram como abas embutidas: MESMO conteúdo/componente já usado nas
// páginas de módulo (Cf2FulfillmentDetail / fila de Sucesso), só filtrado
// pra esta empresa, nunca uma segunda implementação.
const TABS = ["Resumo", "Pessoas", "Comercial", "Serviços", "Contratos", "Financeiro", "Onboarding", "Implantação", "CS", "Atividades", "Timeline", "Documentos"] as const;
type Tab = (typeof TABS)[number];

// Status real de `contratos.status` (schema confirmado) — badge reusa as
// mesmas variantes já usadas no resto do cf2 (Cf2Badge), nenhuma paleta nova.
const CONTRATO_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo", pausado: "Pausado", concluido: "Concluído", churned: "Churned",
  cancelado: "Cancelado", renovado: "Renovado", pendente_assinatura: "Pendente de assinatura",
};
const CONTRATO_STATUS_BADGE: Record<string, "neutral" | "accent" | "success" | "danger" | "warning"> = {
  ativo: "success", pausado: "warning", concluido: "neutral", churned: "danger",
  cancelado: "danger", renovado: "success", pendente_assinatura: "warning",
};
// Alerta de vencimento (90/60/30 dias, item 3 da rodada) — 3 níveis de
// urgência crescente com as MESMAS variantes de badge do resto do cf2
// (nenhuma cor nova): 61-90d é sinal leve (neutral), 31-60d é atenção
// (warning), <=30d é urgente (danger). Só existe pra contrato com status
// ATIVO e vencimento futuro dentro da janela — vencido ou sem vencimento
// nunca cai aqui (calculado no backend, ver diasAteVencimento).
function badgeVencimento(dias: number): "neutral" | "warning" | "danger" {
  if (dias <= 30) return "danger";
  if (dias <= 60) return "warning";
  return "neutral";
}

// Título do card de contrato (24/08, Kauã: "não quero nada falando legado
// zoho ou esse lixo, preciso dos dados e das informações") — `tipo` às
// vezes é a origem interna do registro ("legado_zoho"), não um produto;
// prioriza produto(s) reais (servicos, recém-preenchido via backfill do
// export do Zoho) e cai pra descrição/tipo só quando não tem produto
// nenhum pra mostrar, nunca expõe a origem técnica do dado.
function tituloContrato(ct: ContratoCliente): string {
  if (ct.itens && ct.itens.length > 0) return ct.itens.map((i) => i.nome).join(" + ");
  if (ct.servicos && ct.servicos.length > 0) return ct.servicos.join(" + ");
  if (ct.descricao) return ct.descricao;
  if (ct.tipo && ct.tipo !== "legado_zoho") return ct.tipo;
  return "Contrato";
}

function brl(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function data(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
/**
 * Data de CALENDÁRIO pura (colunas `date` do Postgres, ex.: contratos.inicio/
 * vencimento — sem hora/timezone) — bug real encontrado nesta rodada:
 * `new Date("2026-08-12")` é interpretado como UTC-meia-noite, e em BRT
 * (UTC-3) `toLocaleDateString` imprimia "11/08/2026", um dia antes do valor
 * real gravado no banco. `data()` continua certo pra timestamps de verdade
 * (assinadoEm/createdAt, que já vêm com instante+timezone reais do backend);
 * esta função é só pra strings "YYYY-MM-DD" cruas.
 */
function dataCalendario(diaISO: string | null): string {
  if (!diaISO) return "—";
  const [y, m, d] = diaISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}
function formatBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Par label/valor compacto reusado no card "Visão geral" e no "Saúde do
// Cliente" — mesmo estilo já usado em vários pontos do cf2, só extraído
// pra não repetir o className/style toda vez que a densidade do mockup
// (20/08) multiplicou o número de campos pequenos na tela.
function Campo360({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{label.toUpperCase()}</p>
      <p className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{valor}</p>
    </div>
  );
}

/**
 * Componente individual do card "Saúde do Cliente" — três modos honestos:
 * `semDado` (Uso do Produto/Engajamento/NPS: sem integração real hoje, sem
 * número/barra nenhuma, só o texto explícito), `pct` (Onboarding: barra
 * real vinda de fulfillment_itens), ou `texto`+`tom` (Financeiro: badge/
 * texto real, nunca forçado a virar porcentagem sem fonte fácil de
 * validar — regra explícita desta rodada).
 */
function SaudeComponente({
  label, semDado, texto, tom, pct,
}: {
  label: string;
  semDado?: boolean;
  texto?: string;
  tom?: "success" | "danger" | "neutral";
  pct?: number | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{label.toUpperCase()}</p>
      {semDado ? (
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem dado disponível — depende de integração futura</p>
      ) : pct !== undefined && pct !== null ? (
        <>
          <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{pct}%</p>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cf2-bg-surface)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cf2-success-text)" }} />
          </div>
          {texto && <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{texto}</p>}
        </>
      ) : (
        <p className="text-[12px] font-semibold" style={{ color: tom === "danger" ? "var(--cf2-danger-text)" : tom === "success" ? "var(--cf2-success-text)" : "var(--cf2-text-primary)" }}>{texto}</p>
      )}
    </div>
  );
}

/**
 * Link de documento pra UM contrato — MESMA lógica já usada na aba
 * Documentos (não duplicada, só extraída): corpo gerado pela engine nova
 * (`temCorpoGerado`) vira link pra `/api/contratos/:id/pdf`; senão, procura
 * nos anexos_legado (Zoho) já buscados via `useAnexosLegadoCliente` um
 * anexo tipo "contrato" com `entidadeId` igual ao id do contrato — e, na
 * falta desse, um anexo tipo "negócio" no negócio de origem do contrato
 * (achado real 24/08: 9 contratos com zoho_id tinham o PDF real anexado
 * no negócio em vez do contrato durante a importação do Zoho; a tela só
 * olhava o nível do contrato e mostrava "Sem documento" com o arquivo
 * existindo). Sem os dois, honesto: "sem documento".
 */
function DocumentoContrato({ contrato, anexosLegado }: { contrato: ContratoCliente; anexosLegado: AnexoLegado[] }) {
  if (contrato.temCorpoGerado) {
    return (
      <a href={`/api/contratos/${contrato.id}/pdf`} target="_blank" rel="noreferrer" className="text-[11px] underline inline-flex items-center gap-1" style={{ color: "var(--cf2-text-secondary)" }}>
        <FileText className="w-3 h-3" /> Ver contrato
      </a>
    );
  }
  const anexo = anexosLegado.find((a) => a.entidadeId === contrato.id)
    ?? (contrato.negocioId ? anexosLegado.find((a) => a.entidadeId === contrato.negocioId) : undefined);
  if (!anexo) {
    return <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem documento</span>;
  }
  if (!anexo.arquivoDisponivel) {
    return <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }} title="Arquivo físico não disponível neste ambiente">{anexo.nomeArquivo} · indisponível</span>;
  }
  return (
    <a href={`/api/anexos-legado/${anexo.id}/download`} className="text-[11px] underline inline-flex items-center gap-1" style={{ color: "var(--cf2-text-secondary)" }}>
      <Download className="w-3 h-3" /> {anexo.nomeArquivo}
    </a>
  );
}

function ConciliacaoPill({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const styles = {
    ok: { background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" },
    warn: { background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" },
    muted: { background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" },
  }[tone];
  return <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold" style={styles}>{children}</span>;
}

function ContratosConciliacao({ contratos, anexosLegado }: { contratos: ContratoCliente[]; anexosLegado: AnexoLegado[] }) {
  const comercial = contratos.filter((c) => c.negocioId || c.propostaOrigem).length;
  const stripe = contratos.filter((c) => c.stripeSubscriptionId).length;
  const cobranca = contratos.filter((c) => (c.faturas?.total ?? 0) > 0).length;
  const documentos = contratos.filter((c) =>
    c.temCorpoGerado || anexosLegado.some((a) => a.entidadeId === c.id || (c.negocioId && a.entidadeId === c.negocioId))
  ).length;
  const legadoSemStripe = contratos.filter((c) => !c.stripeSubscriptionId && Boolean(c.zohoId)).length;
  // Falta de Stripe em contrato migrado do Zoho é contexto histórico, não uma
  // falha de conciliação. Só sinalizamos como pendência quando o contrato não
  // possui vínculo comercial ou é um registro atual sem assinatura vinculada.
  const pendencias = contratos.filter((c) => (!c.propostaOrigem && !c.negocioId) || (!c.stripeSubscriptionId && !c.zohoId)).length;
  const metricas = [
    ["Comercial", comercial, contratos.length, "contrato → negócio/proposta"],
    ["Stripe", stripe, contratos.length, "assinatura vinculada"],
    ["Cobrança", cobranca, contratos.length, "com fatura registrada"],
    ["Documento", documentos, contratos.length, "gerado ou anexado"],
  ];
  return (
    <div className="p-4 rounded-xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface-subtle)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Conciliação comercial e financeira</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>Cada vínculo abaixo vem do banco: não confundimos contrato legado, proposta, assinatura Stripe e fatura.</p>
        </div>
        <ConciliacaoPill tone={pendencias === 0 ? "ok" : "warn"}>{pendencias === 0 ? "Tudo conciliado" : `${pendencias} com pendência`}</ConciliacaoPill>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {metricas.map(([label, valor, total, detalhe]) => (
          <div key={String(label)} className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
            <p className="text-[17px] font-bold mt-1" style={{ color: "var(--cf2-text-primary)" }}>{valor}<span className="text-[11px] font-normal" style={{ color: "var(--cf2-text-tertiary)" }}>/{total}</span></p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{detalhe}</p>
          </div>
        ))}
      </div>
      {legadoSemStripe > 0 && (
        <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          {legadoSemStripe} contrato(s) legado(s) sem Stripe foram mantidos como histórico, sem serem tratados como erro de cobrança.
        </p>
      )}
    </div>
  );
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
 * Feed de eventos (Atividades/Timeline) — os 2 nomes de aba apontam PRA
 * MESMA fonte de dado (`timelineEventos`, já consolidado no backend a
 * partir de nota/atividade/proposta/venda/contrato/pagamento/tarefa/
 * entrega). Reestruturação 20/08 pediu uma aba "Timeline" separada de
 * "Atividades" na referência de UX, mas seria fabricar uma segunda fonte
 * pra ter 2 abas visualmente diferentes — não fazemos isso. Documentado
 * aqui em vez de duplicar o componente.
 */
function EventosFeed({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) {
    return <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem histórico.</p>;
  }
  return (
    <>
      {eventos.slice(0, 60).map((e) => (
        <div key={e.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 mt-0.5" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>
            {EVENTO_TIPO_LABEL[e.tipo] || e.tipo}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{e.titulo}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
              {e.subtitulo ? `${e.subtitulo} · ` : ""}{new Date(e.quando).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Customer 360 (CRM2, 19/08 → reconstrução completa após referência de UX
 * do Kauã; reestruturação de abas 20/08). Company é a âncora relacional;
 * Service é o centro econômico. Nunca "empresa.mrr" — sempre soma de
 * servicosCanonicos.currentRecurringValue. "Health Score" numérico (0-100
 * ponderado) NUNCA existe aqui — regra fechada do projeto é nunca inventar
 * essa fórmula. O mockup denso de 20/08 pede o campo, mas o que existe de
 * real é RISCO (fatura atrasada, mesmo critério binário já usado na
 * Carteira) — é isso que aparece, rotulado honestamente como "Risco
 * financeiro", nunca maquiado de score. O card "Saúde do Cliente" mostra
 * cada componente separado com a fonte real que tem (Onboarding = %
 * fulfillment_itens, Financeiro = status real de faturas) e "sem dado
 * disponível" explícito pros 3 que dependem de integração que não existe
 * (Uso do Produto, Engajamento, NPS). "Tickets"/"Usuários e acessos"
 * (portal multiusuário por conta) da referência não têm modelo de dado
 * real hoje — não fabricados aqui, ficam registrados como gap de produto,
 * não de UI.
 */

interface AtividadePessoa { id: string; tipo: string; titulo: string | null; descricao: string | null; createdAt: string; autorNome: string | null; duracaoSegundos: number | null }

/**
 * Histórico de relacionamento POR PESSOA (pedido do Kauã, 20/08). A aba
 * "Pessoas" hoje é construída a partir de `leads` (leads.empresaId) — cada
 * linha da lista É um `lead`, mesmo id. `atividades.leadId` referencia esse
 * mesmo id direto, então filtrar por pessoa individual é um FK real, sem
 * bridge/legado: MESMA fonte da timeline agregada da empresa
 * (`atividades`), só filtrada por um leadId em vez de todos os leads da
 * empresa — não é uma segunda implementação. Lazy: só busca quando expandida
 * (enabled), não carrega histórico de todo mundo de uma vez.
 */
function PessoaHistorico({ personId }: { personId: string }) {
  const { data, isLoading } = useQuery<{ leadId: string | null; pessoaId: string | null; pessoaNome: string; atividades: AtividadePessoa[] }>({
    queryKey: ["cf2-pessoa-atividades", personId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/pessoa/${personId}/atividades`);
      if (!r.ok) throw new Error("Falha ao buscar histórico da pessoa");
      return r.json();
    },
  });

  return (
    <div className="px-3 pb-3 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
      {isLoading ? (
        <p className="text-[11px] pt-2" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando histórico...</p>
      ) : !data || data.atividades.length === 0 ? (
        <p className="text-[11px] pt-2" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade registrada para esta pessoa ainda.</p>
      ) : (
        <div className="flex flex-col gap-1.5 pt-2">
          {data.atividades.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
                    {EVENTO_TIPO_LABEL[a.tipo] || a.tipo}
                  </span>
                  {a.titulo && <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{a.titulo}</p>}
                </div>
                {a.descricao && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--cf2-text-secondary)" }}>{a.descricao}</p>}
                {a.autorNome && <p className="text-[10px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>por {a.autorNome}</p>}
              </div>
              <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Cf2Cliente360({ empresaId }: { empresaId: string }) {
  const [tab, setTab] = useState<Tab>("Resumo");
  const [novaOportunidadeOpen, setNovaOportunidadeOpen] = useState(false);
  const [novaPessoaOpen, setNovaPessoaOpen] = useState(false);
  const [novaTag, setNovaTag] = useState("");
  const [onboardingSelecionado, setOnboardingSelecionado] = useState<string | null>(null);
  const [implantacaoSelecionado, setImplantacaoSelecionado] = useState<string | null>(null);
  // Histórico por pessoa (aba Pessoas, 20/08) — só uma pessoa expandida por
  // vez, busca lazy (ver PessoaHistorico) só quando o card abre.
  const [pessoaExpandidaId, setPessoaExpandidaId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { usuarios } = useOrgUsuarios();

  const { data: cliente, isLoading } = useQuery<Cliente360Data>({
    queryKey: ["cf2-cliente-360", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/${empresaId}`);
      if (!r.ok) throw new Error("Cliente não encontrado");
      return r.json();
    },
  });

  const documentos = useAnexosLegadoCliente(empresaId, cliente?.negocioIds ?? [], cliente?.contratoIds ?? []);

  // Aba "CS" embutida (mockup 20/08) — MESMA query/critério da fila de
  // atenção cross-cliente (Cf2SucessoWorkspace), só filtrada pra esta
  // empresa via ?empresaId= (backend relaxa o WHERE "só quem precisa de
  // atenção" nesse caso, ver GET /clientes-crm2/sucesso). Sempre retorna
  // o sinal real desta empresa, esteja ela na fila ou não.
  const { data: contaCs, isLoading: contaCsLoading } = useQuery<{ contas: ContaAtencao[] }>({
    queryKey: ["cf2-cliente-cs", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/sucesso?empresaId=${empresaId}`);
      if (!r.ok) return { contas: [] };
      return r.json();
    },
  });

  // Tags (item "ID Cliente/Tags" do header, 20/08) — PATCH manda o array
  // inteiro já editado (adicionar/remover), nunca um endpoint de "+1 item".
  // Nasce vazio pra toda empresa (regra fechada: nunca popular sozinho).
  const salvarTags = useMutation({
    mutationFn: async (tags: string[]) => {
      const r = await fetch(`/api/clientes-crm2/${empresaId}/tags`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }),
      });
      if (!r.ok) throw new Error("falha ao salvar tags");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-cliente-360", empresaId] }),
  });

  const reenviarEmailContrato = useMutation({
    mutationFn: async (contratoId: string) => {
      const r = await fetch(`/api/contratos/${contratoId}/email-final/retry`, { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Não foi possível reenviar a cópia final");
      return body;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-cliente-360", empresaId] }),
  });

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (!cliente) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Cliente não encontrado.</p>;

  const {
    empresa, currentMrr, clienteDesde, proximaFatura, statusFinanceiro, responsavel, executivo,
    faturasAtrasadas, faturasAbertas, faturasAbertasValor,
    pessoas = [], servicos = [], propostas = [], proximasAcoes = [], atividadesRecentes = [],
    mrrMensal = [], negocios = [], timelineEventos = [], origemAquisicao,
    contratos: contratosCliente = [], contratoVencendoEmBreve = null,
  } = cliente;
  const familias = [...new Set(servicos.filter((s) => s.portfolioIncluded).map((s) => s.serviceFamily))];
  const pessoaPrincipal = pessoas.find((p) => p.tipo === "cliente") || pessoas[0] || null;
  const servicosAtivos = servicos.filter((s) => s.portfolioIncluded);
  // "Serviços Ativos" do header (item 3, 20/08) — contagem real de
  // commercial_lifecycle = 'ACTIVE' sobre o total de serviços da empresa
  // (distinto do filtro portfolioIncluded usado no badge "Ativo" acima:
  // um serviço pode estar fora do portfólio mas ainda ACTIVE, ou vice-versa
  // — são dois conceitos reais e diferentes, não confundir).
  const servicosComLifecycleAtivo = servicos.filter((s) => s.commercialLifecycle === "ACTIVE").length;
  // Lead sugerido pra "Nova oportunidade" (item 4): decisor real (negocio_leads.papel),
  // fallback pra pessoa principal quando não há decisor mapeado.
  const decisorSugerido = pessoas.find((p) => p.papel === "decisor") || pessoaPrincipal;
  const ultimaAtividade = atividadesRecentes[0] ?? null;
  const proximaAcao = proximasAcoes[0] ?? null;

  // Tendência real de MRR (não inventada): diferença entre os 2 últimos
  // pontos da série real de mrr_movimentos. Sem série (cliente PABX-only,
  // ledger ainda não cobre essa família) = sem badge, não fabrica número.
  const tendenciaMrr = mrrMensal.length >= 2
    ? ((mrrMensal[mrrMensal.length - 1].valor - mrrMensal[mrrMensal.length - 2].valor) / (mrrMensal[mrrMensal.length - 2].valor || 1)) * 100
    : null;

  const origemTemAlgumDado = !!origemAquisicao && (
    origemAquisicao.origem || origemAquisicao.campanha || origemAquisicao.conjunto || origemAquisicao.criativo ||
    origemAquisicao.utmSource || origemAquisicao.utmMedium || origemAquisicao.utmCampaign || origemAquisicao.landingPage
  );

  // Risco financeiro (item "Health Score" do mockup, resolvido conforme
  // regra fechada do projeto): MESMO critério binário já usado na Carteira
  // (Workspace.tsx) e em /clientes-crm2/sucesso — fatura vencida em aberto.
  // Nunca um score 0-100 inventado; rótulo sempre "Risco financeiro".
  const risco: "alto" | "baixo" = faturasAtrasadas > 0 ? "alto" : "baixo";

  // ID Cliente (item do header, 20/08) — UUID real da empresa, só formatado
  // pra ficar legível (8 primeiros caracteres, caixa alta, prefixo "CLI-").
  // Não é sequencial inventado, é o mesmo id de sempre, só exibido diferente.
  const idClienteFormatado = `CLI-${empresa.id.slice(0, 8).toUpperCase()}`;

  // Moeda (item do header/Resumo, 20/08) — contrato mais recente desta
  // empresa (contratosCliente já vem ordenado desc por createdAt do
  // backend); sem nenhum contrato, "BRL" é o default real do schema
  // (contratos.moeda default), não uma invenção de UI.
  const moeda = contratosCliente[0]?.moeda || "BRL";

  // Fulfillment relevante por família, pras abas Onboarding/Implantação
  // embutidas — prioriza o que está EM ANDAMENTO (nem COMPLETED nem
  // CANCELED); sem nenhum em andamento, cai pro mais recente concluído (a
  // aba ainda é útil pra ver o histórico). Cliente com múltiplos
  // fulfillments na mesma família (raro, mas real — ex.: reativação) ganha
  // um seletor simples em vez de esconder os outros.
  // Onboarding = só Callface AI; Implantação = PABX + White Label (25/08,
  // correção do Kauã depois de instrução equivocada — White Label é
  // implantação mesmo, não onboarding).
  const fulfillmentsOnboarding = servicos.filter((s) => s.serviceFamily === "CALLFACE_AI" && s.fulfillment).map((s) => s.fulfillment!);
  const fulfillmentsImplantacao = servicos.filter((s) => (s.serviceFamily === "PABX" || s.serviceFamily === "WHITE_LABEL") && s.fulfillment).map((s) => s.fulfillment!);
  const emAndamento = (f: { status: string }) => f.status !== "COMPLETED" && f.status !== "CANCELED";
  const onboardingAtivoId = onboardingSelecionado ?? fulfillmentsOnboarding.find(emAndamento)?.id ?? fulfillmentsOnboarding[0]?.id ?? null;
  const implantacaoAtivoId = implantacaoSelecionado ?? fulfillmentsImplantacao.find(emAndamento)?.id ?? fulfillmentsImplantacao[0]?.id ?? null;
  // Fulfillment relevante pro componente "Onboarding" do card "Saúde do
  // Cliente" (Resumo) — qualquer família, prioriza o que está em andamento
  // (mesmo critério de emAndamento acima), fallback pro mais recente
  // concluído; sem nenhum fulfillment, fica null (estado vazio honesto).
  const todosFulfillments = [...fulfillmentsOnboarding, ...fulfillmentsImplantacao];
  const fulfillmentSaude = todosFulfillments.find(emAndamento) ?? todosFulfillments[0] ?? null;

  return (
    <>
      <Cf2Topbar
        orgNome="Callface"
        compact
        actions={
          <Link
            href="/negocios/novo"
            className="flex items-center gap-1.5 px-[18px] py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Nova oportunidade
          </Link>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 pb-8">
        {/* Breadcrumb honesto (25/08): "Carteira" só faz sentido pra quem
            tem serviço de verdade — pra empresa sem venda ainda (aberta a
            partir de Contatos & Empresas), volta pra lá em vez de mentir
            que ela está na Carteira. */}
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          {servicos.length > 0 ? (
            <>
              <Link href="/clientes" className="hover:underline">Clientes</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/clientes" className="hover:underline">Carteira</Link>
            </>
          ) : (
            <Link href="/contatos" className="hover:underline">Contatos & Empresas</Link>
          )}
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
                  {/* Lifecycle+Fase (item 3, 20/08): lifecycle era sempre
                      "Cliente" aqui, premissa válida enquanto essa página só
                      era alcançável a partir da Carteira (que só lista
                      empresa com serviço real). Deixou de ser verdade 25/08,
                      quando a página passou a ser a "página de empresa" do
                      CRM2 pra QUALQUER empresa (Contatos & Empresas, sem
                      filtro de venda) — corrigido pra refletir dado real:
                      só fala "Cliente" quando existe serviço de verdade,
                      "Prospect" quando tem negócio mas nenhum serviço, e
                      nem mostra o badge quando não tem nada disso ainda. */}
                  {servicos.length > 0 ? (
                    <Cf2Badge variant="neutral">Cliente · {STATUS_FINANCEIRO_LABEL[statusFinanceiro ?? ""] || "Indefinido"}</Cf2Badge>
                  ) : negocios.length > 0 ? (
                    <Cf2Badge variant="neutral">Prospect · em negociação</Cf2Badge>
                  ) : (
                    <Cf2Badge variant="neutral">Sem negócio ainda</Cf2Badge>
                  )}
                  {familias.map((f) => <Cf2Badge key={f} variant="neutral">{FAMILIA_LABEL[f] || f}</Cf2Badge>)}
                  {/* Alerta agregado de vencimento (item 3, 21/08) — só aparece com
                      contrato ATIVO vencendo em <=30 dias (real, calculado no backend
                      a partir de vencimento - hoje); sem sinal real, sem badge. */}
                  {contratoVencendoEmBreve && contratoVencendoEmBreve.diasParaVencer !== null && contratoVencendoEmBreve.diasParaVencer <= 30 && (
                    <button onClick={() => setTab("Contratos")}>
                      <Cf2Badge variant="danger">
                        Contrato vence em {contratoVencendoEmBreve.diasParaVencer === 0 ? "hoje" : `${contratoVencendoEmBreve.diasParaVencer}d`}
                      </Cf2Badge>
                    </button>
                  )}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                  {clienteDesde ? `Cliente desde ${data(clienteDesde)}` : "Data de início não registrada"}
                </p>
                {/* Linha de dados (mockup 20/08): CNPJ / Segmento / Porte /
                    Localização — campos reais de `empresas` (confirmados no
                    schema: setor/porte/cidade/estado), "—" honesto quando
                    a empresa não tem o campo preenchido. */}
                <div className="flex items-center gap-3 flex-wrap mt-1.5">
                  {[
                    ["CNPJ", empresa.cnpj],
                    ["Segmento", empresa.setor],
                    ["Porte", empresa.porte],
                    ["Localização", empresa.cidade && empresa.estado ? `${empresa.cidade}/${empresa.estado}` : empresa.cidade || empresa.estado],
                  ].map(([label, valor]) => (
                    <span key={label as string} className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                      <span className="font-semibold">{label}:</span> {valor || "—"}
                    </span>
                  ))}
                </div>
                {/* ID Cliente + Tags (mockup 20/08) — ID é o UUID real só
                    formatado; tags são campo novo (`empresas.tags`), nasce
                    vazio, editável aqui direto (PATCH real, sem fabricar
                    valor nenhum de saída). */}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>{idClienteFormatado}</span>
                  {(empresa.tags ?? []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-accent-border)" }}>
                      <Tag className="w-2.5 h-2.5" /> {t}
                      <button
                        onClick={() => salvarTags.mutate((empresa.tags ?? []).filter((x) => x !== t))}
                        title="Remover tag"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = novaTag.trim();
                      if (!v) return;
                      salvarTags.mutate([...(empresa.tags ?? []), v]);
                      setNovaTag("");
                    }}
                    className="inline-flex items-center"
                  >
                    <input
                      value={novaTag}
                      onChange={(e) => setNovaTag(e.target.value)}
                      placeholder="+ Adicionar tag"
                      className="text-[11px] px-2 py-0.5 rounded-full outline-none w-[110px]"
                      style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)", border: "1px dashed var(--cf2-border-default)" }}
                    />
                  </form>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setNovaOportunidadeOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold"
                style={{ background: "var(--cf2-bg-inverse)", color: "#ffffff" }}
              >
                <Plus className="w-3.5 h-3.5" /> Nova oportunidade
              </button>
              {pessoaPrincipal?.leadId && (
                <Link
                  href={`/propostas/novo?leadId=${pessoaPrincipal.leadId}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold"
                  style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
                >
                  <Plus className="w-3.5 h-3.5" /> Nova proposta
                </Link>
              )}
            </div>
          </div>

          {/* Cards inline (mockup 20/08, exatamente na ordem pedida):
              Responsável CS · Executivo · MRR Atual · Risco financeiro ·
              Próxima ação · Status. CS Owner e Executivo são PESSOAS
              diferentes e reais: CS = clientes.responsavel_id (dono de
              conta pós-venda); Executivo = vendedor/closer do negócio Won
              mais antigo desta empresa (negocios.responsavel_id) — nunca a
              mesma fonte, nunca confundir. "Risco financeiro" substitui o
              "Health Score" do mockup (regra fechada: nunca inventar score
              — ver docstring do componente). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>RECEITA MENSAL</p>
              <p className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(currentMrr)}</p>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{proximaFatura ? `Próxima cobrança: ${data(proximaFatura.vencimento)}` : "Sem cobrança futura registrada"}</p>
            </div>
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>CONTRATOS ATIVOS</p>
              <p className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contratosCliente.filter((c) => c.status === "ativo").length}</p>
              <button onClick={() => setTab("Contratos")} className="text-left text-[11px] font-semibold" style={{ color: "var(--cf2-accent)" }}>Ver contratos →</button>
            </div>
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>IMPLANTAÇÃO</p>
              <p className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{fulfillmentSaude && fulfillmentSaude.totalItens > 0 ? `${Math.round((fulfillmentSaude.itensConcluidos / fulfillmentSaude.totalItens) * 100)}%` : "—"}</p>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{fulfillmentSaude ? (emAndamento(fulfillmentSaude) ? "Em andamento" : "Concluído") : "Sem implantação vinculada"}</p>
            </div>
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>BILLING</p>
              <Cf2Badge variant={risco === "alto" ? "danger" : "success"}>{risco === "alto" ? `${faturasAtrasadas} em atraso` : "Em dia"}</Cf2Badge>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{faturasAbertas} fatura(s) em aberto</p>
            </div>
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PRÓXIMA AÇÃO</p>
              <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{proximaAcao?.titulo || "Nenhuma ação em aberto"}</p>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{proximaAcao?.venceEm ? data(proximaAcao.venceEm) : "Sem prazo"}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 overflow-x-auto border-b shrink-0" style={{ borderColor: "var(--cf2-border-default)" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-1 py-3 text-[13px] font-semibold whitespace-nowrap shrink-0 border-b-2 -mb-px"
              style={{
                color: tab === t ? "var(--cf2-accent)" : "var(--cf2-text-secondary)",
                borderColor: tab === t ? "var(--cf2-accent)" : "transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Resumo" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)] gap-5">
              <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Jornada do cliente</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>Status operacional consolidado a partir dos registros reais.</p>
                  </div>
                  {implantacaoAtivoId && <button onClick={() => setTab("Implantação")} className="text-[11px] font-semibold shrink-0" style={{ color: "var(--cf2-accent)" }}>Ver implantação →</button>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "Aquisição", value: clienteDesde ? "Concluída" : "Sem data", tone: clienteDesde ? "success" : "neutral" },
                    { label: "Implantação", value: fulfillmentSaude ? (emAndamento(fulfillmentSaude) ? "Em andamento" : "Concluída") : "Não vinculada", tone: fulfillmentSaude ? "success" : "neutral" },
                    { label: "Financeiro", value: risco === "alto" ? "Em atenção" : "Regular", tone: risco === "alto" ? "danger" : "success" },
                    { label: "Comercial", value: negocios.some((n) => !["ganho", "perdido"].includes(n.status)) ? "Oportunidade aberta" : "Sem oportunidade aberta", tone: "neutral" },
                    { label: "Contratos", value: `${contratosCliente.filter((c) => c.status === "ativo").length} ativo(s)`, tone: contratosCliente.some((c) => c.status === "ativo") ? "success" : "neutral" },
                  ].map((item) => (
                    <div key={item.label} className="relative pl-3" style={{ borderLeft: `2px solid ${item.tone === "danger" ? "var(--cf2-danger-text)" : item.tone === "success" ? "var(--cf2-success-text)" : "var(--cf2-border-default)"}` }}>
                      <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{item.label.toUpperCase()}</p>
                      <p className="text-[12px] font-semibold mt-1" style={{ color: "var(--cf2-text-primary)" }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pessoas principais</p>
                  <button onClick={() => setTab("Pessoas")} className="text-[11px] font-semibold" style={{ color: "var(--cf2-accent)" }}>Ver todas →</button>
                </div>
                <div className="flex flex-col gap-2">
                  {pessoas.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}</p>
                        <p className="text-[10px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{p.cargo || PAPEL_LABEL[p.papel ?? ""] || "Sem função registrada"}</p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{p.telefone || p.email || "—"}</span>
                    </div>
                  ))}
                  {pessoas.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa vinculada.</p>}
                </div>
              </div>
            </div>

            {/* Visão Geral (mockup 20/08) — MRR Total já existe no header
                (currentMrr); Receita Anual é a mesma métrica padrão SaaS
                (MRR × 12, não uma segunda fonte); Faturamento em Aberto é
                real (soma de faturas.valor com status='aberta' desta
                empresa, calculado no backend). Segmento/Porte/Localização
                já aparecem na linha de dados do header — repetidos aqui
                dentro do resumo consolidado, mesmo dado, mesma fonte. */}
            <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Visão geral</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>MRR TOTAL</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--cf2-success-text)" }}>{brl(currentMrr)}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>RECEITA ANUAL (MRR × 12)</p>
                  <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(currentMrr * 12)}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>FATURAMENTO EM ABERTO</p>
                  <p className="text-[16px] font-bold" style={{ color: faturasAtrasadas > 0 ? "var(--cf2-danger-text)" : "var(--cf2-text-primary)" }}>{brl(faturasAbertasValor)}</p>
                  <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{faturasAbertas} fatura(s) em aberto</p>
                </div>
              </div>
              {/* Tags já aparecem editáveis na identidade do header (linha
                  ID Cliente/Tags) — não duplicado aqui de propósito. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                <Campo360 label="Segmento" valor={empresa.setor || "—"} />
                <Campo360 label="Porte" valor={empresa.porte || "—"} />
                <Campo360 label="Localização" valor={empresa.cidade && empresa.estado ? `${empresa.cidade}/${empresa.estado}` : empresa.cidade || empresa.estado || "—"} />
                <Campo360 label="Moeda" valor={moeda} />
              </div>
            </div>

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
                  <button onClick={() => setTab("Comercial")} className="text-[11px] font-semibold" style={{ color: "var(--cf2-accent)" }}>Ver todas →</button>
                </div>
                {propostas.length === 0 ? (
                  <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta.</p>
                ) : propostas.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Proposta #{p.numero}</p>
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{data(p.createdAt)}</p>
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
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pessoas vinculadas</p>
                <button onClick={() => setTab("Pessoas")} className="text-[11px] font-semibold" style={{ color: "var(--cf2-accent)" }}>Ver todas →</button>
              </div>
              {pessoas.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa vinculada.</p>
              ) : pessoas.slice(0, 5).map((p) => <PessoaResumoLink key={p.id} pessoa={p} />)}
            </div>

            {/* Origem e Aquisição (item 4, 20/08) — lead de origem: vinculado ao
                primeiro negócio GANHO desta empresa, fallback pro lead mais
                antigo. Campo sem nome legível no schema (conjunto/criativo só
                têm o ID real da Meta) aparece como ID; UTM ausente = "—"
                honesto. Sem NENHUM lead de origem = estado vazio explícito. */}
            <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Origem e aquisição</p>
              {!origemAquisicao ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem dado de origem registrado.</p>
              ) : (
                <>
                  {!origemTemAlgumDado && (
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem dado de UTM/campanha para o contato de origem — só a data de entrada é conhecida.</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      ["Origem", origemAquisicao.origem],
                      ["Campanha", origemAquisicao.campanha],
                      ["Conjunto (ID Meta)", origemAquisicao.conjunto],
                      ["Criativo (ID Meta)", origemAquisicao.criativo],
                      ["UTM source", origemAquisicao.utmSource],
                      ["UTM medium", origemAquisicao.utmMedium],
                      ["UTM campaign", origemAquisicao.utmCampaign],
                      ["Landing page", origemAquisicao.landingPage],
                      ["First touch", data(origemAquisicao.firstTouch)],
                      ["Last touch", origemAquisicao.lastTouch ? data(origemAquisicao.lastTouch) : "—"],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{(label as string).toUpperCase()}</p>
                        <p className="text-[12px] truncate" title={value || "—"} style={{ color: "var(--cf2-text-primary)" }}>{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  {/* Fecha a cadeia campanha → dinheiro: a venda que originou
                      este cliente, clicável pro negócio. Sem o valor, o card
                      dizia de onde veio mas não quanto valeu. Só aparece
                      quando existe vínculo real (clientes.oportunidade_origem_id). */}
                  {origemAquisicao.vendaOrigem && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 mt-1" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                      <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>VENDA DE ORIGEM</p>
                      {origemAquisicao.vendaOrigem.valor && (
                        <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(origemAquisicao.vendaOrigem.valor)}</p>
                      )}
                      {origemAquisicao.vendaOrigem.mrr && (
                        <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>MRR {brl(origemAquisicao.vendaOrigem.mrr)}</p>
                      )}
                      {origemAquisicao.vendaOrigem.ganhoAt && (
                        <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>ganho em {data(origemAquisicao.vendaOrigem.ganhoAt)}</p>
                      )}
                      {origemAquisicao.vendaOrigem.negocioId && (
                        <a href={`/negocios/${origemAquisicao.vendaOrigem.negocioId}`} className="text-[12px] font-semibold" style={{ color: "var(--cf2-accent-border)" }}>abrir negócio →</a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Saúde do Cliente (mockup 20/08) — NUNCA um score composto
                0-100 (regra fechada). Cada componente mostra a fonte real
                que tem: Risco = mesmo critério binário de fatura atrasada
                (Carteira/sucesso); Onboarding = % real de fulfillment_itens
                do fulfillment relevante desta empresa; Financeiro = status
                textual real (não uma barra fabricada). Uso do
                Produto/Engajamento/NPS não têm fonte real hoje (dependem
                de integração Callface AI/NPS que não existe) — aparecem
                com "sem dado disponível" explícito, sem número/barra. */}
            <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Saúde do cliente</p>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                  <span>Risco: <Cf2Badge variant={risco === "alto" ? "danger" : "success"}>{risco === "alto" ? "Alto" : "Baixo"}</Cf2Badge></span>
                  <span>Tendência: {tendenciaMrr !== null ? `${tendenciaMrr >= 0 ? "+" : ""}${tendenciaMrr.toFixed(1)}% MRR` : "sem série suficiente"}</span>
                  <span>Última avaliação: sem avaliação estruturada registrada</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <SaudeComponente
                  label="Uso do produto"
                  semDado
                />
                <SaudeComponente
                  label="Engajamento"
                  semDado
                />
                <SaudeComponente
                  label="Financeiro"
                  texto={faturasAtrasadas > 0 ? `${faturasAtrasadas} fatura(s) atrasada(s)` : faturasAbertas > 0 ? `${faturasAbertas} fatura(s) em aberto` : "Em dia"}
                  tom={faturasAtrasadas > 0 ? "danger" : "success"}
                />
                <SaudeComponente
                  label="Onboarding"
                  texto={fulfillmentSaude ? (fulfillmentSaude.totalItens > 0 ? `${Math.round((fulfillmentSaude.itensConcluidos / fulfillmentSaude.totalItens) * 100)}% concluído` : "Checklist sem etapas") : "Sem onboarding/implantação vinculada"}
                  pct={fulfillmentSaude && fulfillmentSaude.totalItens > 0 ? Math.round((fulfillmentSaude.itensConcluidos / fulfillmentSaude.totalItens) * 100) : null}
                />
                <SaudeComponente
                  label="Satisfação (NPS)"
                  semDado
                />
              </div>
            </div>
          </div>
        )}

        {tab === "Pessoas" && (
          <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Pessoas ({pessoas.length})</p>
              <button
                onClick={() => setNovaPessoaOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
                style={{ background: "var(--cf2-bg-inverse)", color: "#ffffff" }}
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar pessoa
              </button>
            </div>
            {pessoas.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa vinculada.</p>
            ) : pessoas.map((p) => {
              const expandida = pessoaExpandidaId === p.id;
              return (
                <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <button
                    type="button"
                    onClick={() => setPessoaExpandidaId(expandida ? null : p.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}</p>
                        <Cf2Badge variant="neutral">{PAPEL_LABEL[p.papel ?? ""] || "sem papel definido"}</Cf2Badge>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{p.cargo || "Cargo não informado"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{p.telefone || "—"}</p>
                        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{p.email || "—"}</p>
                      </div>
                      {p.leadId && (
                        <Link
                          href={`/contatos/${p.leadId}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir perfil da pessoa"
                          className="p-1 rounded hover:bg-[var(--cf2-bg-surface)]"
                          style={{ color: "var(--cf2-text-tertiary)" }}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <ChevronDown
                        className="w-3.5 h-3.5 shrink-0 transition-transform"
                        style={{ color: "var(--cf2-text-tertiary)", transform: expandida ? "rotate(180deg)" : "none" }}
                      />
                    </div>
                  </button>
                  {/* Histórico de relacionamento desta pessoa específica
                      (pedido do Kauã, 20/08) — lazy, só busca quando abre. */}
                  {expandida && <PessoaHistorico personId={p.id} />}
                </div>
              );
            })}
          </div>
        )}

        {tab === "Comercial" && (
          <div className="flex flex-col gap-5">
            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Negócios</p>
              {negocios.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum negócio registrado pra esta empresa.</p>
              ) : negocios.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{n.titulo}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {COMMERCIAL_MOTION_LABEL[n.commercialMotion] || n.commercialMotion}
                      {n.vendedorNome ? ` · Vendedor: ${n.vendedorNome}` : " · sem vendedor atribuído"}
                      {n.status === "ganho" && n.ganhoAt ? ` · Fechado em ${data(n.ganhoAt)}` : ` · Criado em ${data(n.createdAt)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{n.valorTotal ? brl(n.valorTotal) : "—"}</p>
                    <span className="text-[11px] font-semibold" style={{ color: NEGOCIO_STATUS_COR[n.status] || "var(--cf2-text-secondary)" }}>{NEGOCIO_STATUS_LABEL[n.status] || n.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Propostas</p>
              {propostas.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma proposta registrada.</p>
              ) : propostas.map((p) => (
                <Link key={p.id} href={`/propostas/${p.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--cf2-bg-surface-muted)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Proposta #{p.numero}</p>
                    <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{data(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(p.valorTotal || "0")}</p>
                    <Cf2Badge variant={PROPOSTA_STATUS_BADGE[p.status] || "neutral"}>{p.status}</Cf2Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tab === "Contratos" && (
          <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {contratosCliente.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum contrato registrado pra esta empresa.</p>
            ) : (
              <>
                <ContratosConciliacao contratos={contratosCliente} anexosLegado={documentos.data ?? []} />
                {contratosCliente.map((ct) => (
                <div key={ct.id} className="flex flex-col gap-2 p-3.5 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>
                      {tituloContrato(ct)}
                    </p>
                    <Cf2Badge variant={CONTRATO_STATUS_BADGE[ct.status] || "neutral"}>{CONTRATO_STATUS_LABEL[ct.status] || ct.status}</Cf2Badge>
                    {/* Alerta de vencimento (90/60/30d) — só existe pra contrato ATIVO
                        com vencimento futuro dentro da janela (calculado no backend);
                        contrato vencido ou sem vencimento nunca ganha este badge. */}
                    {ct.diasParaVencer !== null && ct.diasParaVencer >= 0 && ct.diasParaVencer <= 90 && (
                      <Cf2Badge variant={badgeVencimento(ct.diasParaVencer)}>
                        Vence em {ct.diasParaVencer === 0 ? "hoje" : `${ct.diasParaVencer} dias`}
                      </Cf2Badge>
                    )}
                  </div>
                  <p className="text-[14px] font-bold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>
                    {brl(ct.currentRecurringValue || ct.mrr || "0")}<span className="text-[10px] font-normal" style={{ color: "var(--cf2-text-tertiary)" }}>/mês</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  {ct.negocioId || ct.propostaOrigem ? (
                    <ConciliacaoPill tone="ok">Comercial conciliado</ConciliacaoPill>
                  ) : (
                    <ConciliacaoPill tone="warn">Sem proposta/negócio conciliado</ConciliacaoPill>
                  )}
                  {ct.stripeSubscriptionId ? (
                    <ConciliacaoPill tone="ok">Stripe · {ct.billingStatus || "vinculado"}</ConciliacaoPill>
                  ) : ct.zohoId ? (
                    <ConciliacaoPill tone="muted">Sem Stripe · legado/manual</ConciliacaoPill>
                  ) : (
                    <ConciliacaoPill tone="warn">Sem Stripe · revisar vínculo</ConciliacaoPill>
                  )}
                  {(ct.faturas?.total ?? 0) > 0 ? (
                    <ConciliacaoPill tone={(ct.faturas?.atrasadas ?? 0) > 0 ? "warn" : "ok"}>{(ct.faturas?.atrasadas ?? 0) > 0 ? `${ct.faturas?.atrasadas ?? 0} fatura(s) atrasada(s)` : `${ct.faturas?.total ?? 0} fatura(s) vinculada(s)`}</ConciliacaoPill>
                  ) : (
                    <ConciliacaoPill tone="muted">Sem fatura vinculada</ConciliacaoPill>
                  )}
                  {ct.signatureStatus === "signed" && (
                    ct.emailEntrega?.status === "sent" ? (
                      <ConciliacaoPill tone="ok">Cópia final enviada</ConciliacaoPill>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "#b45309" }}>
                        Cópia final {ct.emailEntrega?.status === "failed" ? "com falha" : "pendente"}
                        <button
                          type="button"
                          onClick={() => reenviarEmailContrato.mutate(ct.id)}
                          disabled={reenviarEmailContrato.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold disabled:opacity-50"
                          style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}
                          title={ct.emailEntrega?.error || "Tentar envio novamente"}
                        >
                          <RotateCw className={`w-3 h-3 ${reenviarEmailContrato.isPending ? "animate-spin" : ""}`} />
                          Reenviar
                        </button>
                      </span>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PROPOSTA ORIGEM</p>
                    {ct.propostaOrigem ? (
                      <Link href={`/propostas/${ct.propostaOrigem.id}`} className="text-[12px] underline" style={{ color: "var(--cf2-text-secondary)" }}>
                        Proposta #{ct.propostaOrigem.numero}
                      </Link>
                    ) : (
                      <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>—</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {/* Data de assinatura real (aceite_simples) vs aproximação honesta
                        (createdAt) — rótulo deixa explícito qual das duas é, nunca
                        mistura como se fosse a mesma coisa. */}
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {ct.assinaturaStatus === "aceite_simples" && ct.assinadoEm ? "ASSINADO EM" : "CRIADO EM (aprox.)"}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>
                      {ct.assinaturaStatus === "aceite_simples" && ct.assinadoEm ? data(ct.assinadoEm) : data(ct.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>INÍCIO</p>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{dataCalendario(ct.inicio)}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>FIM / VENCIMENTO</p>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{dataCalendario(ct.vencimento)}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>RENOVAÇÃO AUTO.</p>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>{ct.renovacaoAuto ? "Sim" : "Não"}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>DOCUMENTO</p>
                    <DocumentoContrato contrato={ct} anexosLegado={documentos.data ?? []} />
                  </div>
                </div>

                {ct.itens && ct.itens.length > 0 && (
                  <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                    <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PRODUTOS</p>
                    {ct.itens.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                        <p className="truncate" style={{ color: "var(--cf2-text-secondary)" }}>
                          {item.nome}{parseFloat(item.quantidade) !== 1 ? ` (x${parseFloat(item.quantidade)})` : ""}
                        </p>
                        <p className="shrink-0 tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{brl(parseFloat(item.subtotal))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "Serviços" && (
          <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            {servicos.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum serviço.</p>
            ) : servicos.map((s) => (
              <div key={s.id} className="flex flex-col gap-2.5 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{FAMILIA_LABEL[s.serviceFamily] || s.serviceFamily}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--cf2-bg-surface)", color: LIFECYCLE_COLOR[s.commercialLifecycle] || "var(--cf2-text-tertiary)" }}>{s.commercialLifecycle}</span>
                      {!s.portfolioIncluded && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>fora do portfólio</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
                        {s.canonicalProduct || s.revenueNature}
                      </p>
                      <ConciliacaoPill tone={s.stripeSubscriptionId ? "ok" : "muted"}>
                        {s.stripeSubscriptionId ? `Stripe · ${s.billingStatus}` : `CRM/legado · ${s.billingStatus}`}
                      </ConciliacaoPill>
                    </div>
                    {s.ledger && (
                      <p className="text-[10px] mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>
                        Ledger {new Date(`${s.ledger.latestCompetence}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })} · {brl(s.ledger.billedValue)} · {s.ledger.entries} lançamento(s)
                      </p>
                    )}
                    {/* Botão real pra entrega (item 1, 20/08) — só aparece quando existe
                        fulfillment de fato; serviço sem entrega em andamento (ex: já ativo
                        há tempo) não ganha botão nenhum, não fabrica estado. */}
                    {s.fulfillment && (
                      <Link
                        href={s.serviceFamily === "CALLFACE_AI" ? `/clientes/onboarding/${s.fulfillment.id}` : `/clientes/entrega/${s.fulfillment.id}`}
                        className="text-[11px] underline inline-flex items-center gap-1 mt-1"
                        style={{ color: "var(--cf2-text-secondary)" }}
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        {ENTREGA_LABEL[s.serviceFamily] || "Abrir entrega"} · {s.fulfillment.status}
                      </Link>
                    )}
                    {s.contrato?.corpoGerado && (
                      <a href={`/api/contratos/${s.contrato.id}/pdf`} target="_blank" rel="noreferrer" className="text-[11px] underline inline-flex items-center gap-1 mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
                        <FileText className="w-3 h-3" /> Contrato
                      </a>
                    )}
                  </div>
                  <p className="text-[15px] font-bold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(s.currentRecurringValue)}</p>
                </div>

                {/* Integração Callface AI (fundação 20/08, ver
                    crm2-decisoes-pendentes.md item 9) — só aparece pra
                    serviços da família CALLFACE_AI. Estado sempre honesto:
                    hoje a estrutura (external_identities/tenant_snapshots/
                    usage_events/reconciliation_candidates) existe, mas está
                    100% vazia porque o acesso de sync recorrente ao banco do
                    SaaS ainda não foi decidido com o Kauã. Nenhum número é
                    fabricado; quando `conectado` for true (dado real chegar),
                    o card mostra o organization_id/confiança/fonte reais. */}
                {s.callfaceAiIntegracao && (
                  <div className="p-2.5 rounded-lg flex items-start gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px dashed var(--cf2-border-default)" }}>
                    <Plug className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>Integração Callface AI</p>
                      {s.callfaceAiIntegracao.conectado ? (
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
                          Tenant vinculado: <span className="font-semibold">{s.callfaceAiIntegracao.organizationId}</span>
                          {" "}· confiança {s.callfaceAiIntegracao.confidence}
                          {s.callfaceAiIntegracao.source ? ` · fonte ${s.callfaceAiIntegracao.source}` : ""}
                        </p>
                      ) : (
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                          Ainda não conectado ao produto Callface AI — aguardando decisão de acesso (ver crm2-decisoes-pendentes.md #9).
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "Financeiro" && <Cf2ClienteFinanceiro empresaId={empresa.id} />}

        {/* Onboarding / Implantação embutidos (mockup 20/08) — REUSO
            DIRETO de Cf2FulfillmentDetail (mesmo componente da página
            standalone /clientes/entrega/:id, mesmo fetch /api/fulfillments/
            :id), só que renderizado dentro da aba em vez de navegar pra
            fora. Zero lógica/schema duplicado — é literalmente o mesmo
            workspace de fulfillment, filtrado pro(s) fulfillment(s) desta
            empresa. Sem fulfillment nessa família = estado vazio honesto,
            nunca a lista cross-cliente inteira (isso é o que o pedido do
            Kauã queria trocar). */}
        {tab === "Onboarding" && (
          fulfillmentsOnboarding.length === 0 ? (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum onboarding (Callface AI) em andamento ou histórico pra este cliente.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {fulfillmentsOnboarding.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fulfillmentsOnboarding.map((f, i) => (
                    <button
                      key={f.id}
                      onClick={() => setOnboardingSelecionado(f.id)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
                      style={{
                        background: onboardingAtivoId === f.id ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface-muted)",
                        color: onboardingAtivoId === f.id ? "#fff" : "var(--cf2-text-secondary)",
                      }}
                    >
                      Onboarding {i + 1} · {f.status}
                    </button>
                  ))}
                </div>
              )}
              {onboardingAtivoId && <Cf2FulfillmentDetail fulfillmentId={onboardingAtivoId} />}
            </div>
          )
        )}

        {tab === "Implantação" && (
          fulfillmentsImplantacao.length === 0 ? (
            <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma implantação (PABX/White Label) em andamento ou histórico pra este cliente.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {fulfillmentsImplantacao.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fulfillmentsImplantacao.map((f, i) => (
                    <button
                      key={f.id}
                      onClick={() => setImplantacaoSelecionado(f.id)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
                      style={{
                        background: implantacaoAtivoId === f.id ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface-muted)",
                        color: implantacaoAtivoId === f.id ? "#fff" : "var(--cf2-text-secondary)",
                      }}
                    >
                      Implantação {i + 1} · {f.status}
                    </button>
                  ))}
                </div>
              )}
              {implantacaoAtivoId && <Cf2FulfillmentDetail fulfillmentId={implantacaoAtivoId} />}
            </div>
          )
        )}

        {/* CS embutido (mockup 20/08) — MESMO sinal/motivo real da fila de
            atenção cross-cliente (Cf2SucessoWorkspace/`motivos()`), filtrado
            pra esta empresa via ?empresaId=. Sempre mostra um estado real:
            ou a empresa tem motivo de atenção (mesmos 3 sinais de sempre),
            ou está explicitamente "sem sinal de atenção" — nunca escondida
            por não estar na fila. */}
        {tab === "CS" && (
          <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Sinal de sucesso/atenção</p>
            {contaCsLoading ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
            ) : (() => {
              const conta = contaCs?.contas?.[0] ?? null;
              const razoes = conta ? motivosAtencao(conta) : [];
              if (!conta || razoes.length === 0) {
                return (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <Cf2Badge variant="success">Sem sinal de atenção</Cf2Badge>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Nenhuma fatura atrasada, atividade recente e próxima ação registrada — mesmo critério da fila de Sucesso.</p>
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "#ef444412" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-danger-text)" }} />
                  <div className="flex gap-1.5 flex-wrap">
                    {razoes.map((m, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>{m}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p className="text-[11px] pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}>
              Mesmos 3 sinais reais da fila de Sucesso (fatura atrasada, dias sem atividade, sem próxima ação) — sem score numérico fabricado.
            </p>
          </div>
        )}

        {(tab === "Atividades" || tab === "Timeline") && (
          <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <EventosFeed eventos={timelineEventos} />
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
                      {formatBytes(d.tamanhoBytes)}{d.criadoEmOriginal ? ` · ${data(d.criadoEmOriginal)}` : ""}
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

      <NovaOportunidadeModal
        open={novaOportunidadeOpen}
        onClose={() => setNovaOportunidadeOpen(false)}
        usuarios={usuarios}
        onCreated={() => qc.invalidateQueries({ queryKey: ["cf2-cliente-360", empresaId] })}
        fromCliente={{ empresaId: empresa.id, leadId: decisorSugerido?.leadId ?? null, leadLabel: decisorSugerido?.nome ?? null }}
      />

      {novaPessoaOpen && (
        <Cf2NovaPessoaModal
          empresaId={empresa.id}
          empresaNome={empresa.nome}
          onClose={() => setNovaPessoaOpen(false)}
          onCriada={() => {
            setNovaPessoaOpen(false);
            qc.invalidateQueries({ queryKey: ["cf2-cliente-360", empresaId] });
          }}
        />
      )}
    </>
  );
}
