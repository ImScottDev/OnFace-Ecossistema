"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, AlertTriangle } from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";
import { iniciaisEmpresa, corAvatarEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { Cf2ClienteDrawer } from "./ClienteDrawer";

type StatusGeral = "ativo" | "em_risco" | "implantacao" | "onboarding" | "inadimplente" | "cancelado";

interface ClienteLinha {
  id: string;
  nome: string;
  setor: string | null;
  total_servicos: number;
  current_mrr: string;
  familias: string[];
  entregas_em_andamento: number;
  faturas_atrasadas: number;
  fatura_venceu_em: string | null;
  status_financeiro: "ativo" | "em_atraso" | "inadimplente" | "churned" | "indefinido";
  ultima_atividade_tipo: string | null;
  ultima_atividade_em: string | null;
  proxima_acao_titulo: string | null;
  proxima_acao_vence_em: string | null;
  cs_owner_id: string | null;
  cs_owner_nome: string | null;
  risco: "alto" | "baixo";
  status_geral: StatusGeral;
}

// Bucket sintético criado na reconciliação (Zoho/Stripe) pra agregar serviços
// sem empresa resolvida — dado real de gap, não erro de UI. Sinalizado
// visualmente em vez de escondido: esconder mascararia o mesmo problema de
// vínculo Stripe já identificado no fechamento comercial de julho.
const EMPRESA_NAO_RESOLVIDA = "Unresolved billing identity";

function diasAtraso(venceuEm: string | null): number {
  if (!venceuEm) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(venceuEm).getTime()) / 86400000));
}

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
  UNKNOWN: "Produto em revisão",
};

/**
 * Colunas da carteira em ordem de prioridade. Num celular a tabela inteira não
 * cabe, e antes só sobrava a coluna "Cliente" com o resto atrás de um scroll
 * horizontal que ninguém descobre. Cada coluna declara a partir de que largura
 * aparece: nome, MRR e situação ficam sempre; o apoio entra conforme a tela
 * cresce. A classe é aplicada no `th` e na `td` correspondente.
 */
const COLUNAS = [
  { label: "Cliente", visivel: "" },
  { label: "Serviços", visivel: "hidden md:table-cell" },
  { label: "MRR", visivel: "" },
  { label: "Status Geral", visivel: "" },
  { label: "Financeiro", visivel: "hidden lg:table-cell" },
  { label: "Responsável CS", visivel: "hidden lg:table-cell" },
  { label: "Última Atividade", visivel: "hidden xl:table-cell" },
  { label: "Próxima Ação", visivel: "hidden xl:table-cell" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  ativo: "Em dia",
  em_atraso: "Em atraso",
  inadimplente: "Inadimplente",
  churned: "Encerrado",
  indefinido: "Indefinido",
};

const STATUS_COLOR: Record<string, string> = {
  ativo: "var(--cf2-success-text)",
  em_atraso: "var(--cf2-warning-text)",
  inadimplente: "var(--cf2-danger-text)",
  churned: "var(--cf2-text-tertiary)",
  indefinido: "var(--cf2-text-tertiary)",
};

// Status Geral (20/08) — coluna nova que substitui Lifecycle+Billing+Entrega
// na tabela (as 3 mostravam sinal fraco/constante ou já cabem aqui, ver
// comentário no backend, GET /clientes-crm2). MESMOS 7 baldes da barra de
// abas abaixo, precedência idêntica (cancelado > inadimplente > em_risco >
// implantação > onboarding > ativo).
const STATUS_GERAL_LABEL: Record<StatusGeral, string> = {
  cancelado: "Cancelado",
  inadimplente: "Inadimplente",
  em_risco: "Em risco",
  implantacao: "Em implantação",
  onboarding: "Onboarding",
  ativo: "Ativo",
};

// Cores reaproveitadas do que já existe no produto (nunca inventadas pra
// esta coluna): roxo/azul são os mesmos de Cf2EntregaWorkspace (READY_FOR_
// VALIDATION / IN_PROGRESS), sucesso/perigo/atenção/terciário são os tokens
// --cf2-* já usados no resto desta mesma tela.
const STATUS_GERAL_COLOR: Record<StatusGeral, string> = {
  cancelado: "var(--cf2-text-tertiary)",
  inadimplente: "var(--cf2-danger-text)",
  em_risco: "var(--cf2-warning-text)",
  implantacao: "var(--cf2-informativo-fg)",
  onboarding: "#6d28d9",
  ativo: "var(--cf2-success-text)",
};

// Barra de abas de contagem por status (mockup do Kauã, 20/08) — filtra a
// lista real, mesmos critérios já usados nos cards/coluna Status Geral,
// nunca uma fórmula nova. "" = Todos (sem filtro de aba).
const ABAS: { key: string; label: string; contagemKey: keyof AbaCounts }[] = [
  { key: "", label: "Todos", contagemKey: "todos" },
  // "Sem pendência" e não "Ativos": a aba filtra quem NÃO tem onboarding,
  // implantação, risco, inadimplência nem cancelamento em aberto. Chamada de
  // "Ativos" ela contradizia o card "CLIENTES ATIVOS: 299" logo acima — dois
  // sentidos de "ativo" na mesma tela, um deles marcando zero.
  { key: "ativos", label: "Sem pendência", contagemKey: "ativos" },
  { key: "onboarding", label: "Onboarding", contagemKey: "onboarding" },
  { key: "implantacao", label: "Implantação", contagemKey: "implantacao" },
  { key: "risco", label: "Em Risco", contagemKey: "emRisco" },
  { key: "inadimplentes", label: "Inadimplentes", contagemKey: "inadimplentes" },
  { key: "cancelados", label: "Cancelados", contagemKey: "cancelados" },
];

interface AbaCounts {
  todos: number; ativos: number; onboarding: number; implantacao: number;
  emRisco: number; inadimplentes: number; cancelados: number;
}

// Rótulo curto pro canal da última atividade real (`atividades.tipo`,
// valores crus do banco, inclusive variantes `_legado` da recuperação
// Zoho) — nunca mostrar o enum cru na UI.
const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  email_legado: "E-mail",
  ligacao: "Ligação",
  ligacao_legado: "Ligação",
  reuniao: "Reunião",
  reuniao_legado: "Reunião",
  nota: "Nota",
  tarefa: "Tarefa",
  tarefa_legado: "Tarefa",
  cadencia: "Cadência",
  proposta_enviada: "Proposta enviada",
  diagnostico: "Diagnóstico",
  follow_up: "Follow-up",
};

function formatarQuando(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (data.toDateString() === hoje.toDateString()) return `Hoje às ${hora}`;
  if (data.toDateString() === ontem.toDateString()) return `Ontem às ${hora}`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function brl(v: string | number) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Sem centavos — pro KPI, onde "R$ 425.919,86" não cabe e virava reticências. */
function brl0(v: string | number) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/**
 * Clientes / Carteira (CRM2, 19/08 → 20/08 alinhado ao mockup do Kauã).
 * Unidade é Empresa + Serviços — nunca Oportunidade. MRR vem de
 * `servicos_canonicos.current_recurring_value` (fonte fechada), nunca de
 * contrato/oportunidade.
 *
 * 20/08 — Health Score NUNCA entra aqui (decisão fechada, sem esse dado no
 * produto): nem card, nem filtro, nem coluna. Onde o mockup pedia Health
 * Score, a coluna/filtro simplesmente não existe nesta versão.
 */
export function Cf2ClientesWorkspace() {
  const qc = useQueryClient();
  const { usuarios } = useOrgUsuarios();
  const [busca, setBusca] = useState("");
  const [familia, setFamilia] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [aba, setAba] = useState("");
  const [pagina, setPagina] = useState(1);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ clientes: ClienteLinha[]; total: number; totalPages: number }>({
    queryKey: ["cf2-clientes", busca, familia, status, owner, aba, pagina],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2?search=${encodeURIComponent(busca)}&familia=${familia}&status=${status}&owner=${owner}&aba=${aba}&page=${pagina}&limit=20`);
      if (!r.ok) return { clientes: [], total: 0, totalPages: 0 };
      return r.json();
    },
  });

  // Cards de topo: total REAL da base, não só da página atual. "Em risco"
  // testou 2 critérios mais amplos (fatura atrasada OU sem próxima ação OU
  // sem atividade — os 2 últimos são ruído verificado no banco: 0% e 71%
  // de cobertura respectivamente) e ficou só com fatura atrasada, o único
  // sinal real e diferenciante hoje (13 clientes).
  const { data: resumo } = useQuery<{
    clientesAtivos: number; servicosAtivos: number; mrrTotal: string; emRisco: number;
    mrrDelta30d: string; clientesNovos30d: number; familias: Record<string, number>;
    emImplantacao: number; onboarding: number; inadimplentes: number; abaCounts: AbaCounts;
  }>({
    queryKey: ["cf2-clientes-resumo"],
    queryFn: async () => {
      const r = await fetch("/api/clientes-crm2/resumo");
      if (!r.ok) {
        return {
          clientesAtivos: 0, servicosAtivos: 0, mrrTotal: "0", emRisco: 0, mrrDelta30d: "0", clientesNovos30d: 0, familias: {},
          emImplantacao: 0, onboarding: 0, inadimplentes: 0,
          abaCounts: { todos: 0, ativos: 0, onboarding: 0, implantacao: 0, emRisco: 0, inadimplentes: 0, cancelados: 0 },
        };
      }
      return r.json();
    },
  });

  const clientes = data?.clientes ?? [];
  const abaCounts = resumo?.abaCounts;

  const mrrDelta = resumo ? parseFloat(resumo.mrrDelta30d) : 0;
  const mrrBase = resumo ? Number(resumo.mrrTotal) - mrrDelta : 0;
  const mrrDeltaPct = mrrBase > 0 ? (mrrDelta / mrrBase) * 100 : null;

  // Os sinais são independentes: uma empresa pode estar em onboarding e em
  // risco ao mesmo tempo. A faixa evita a falsa sensação de etapas exclusivas.
  const SINAIS = [
    {
      label: "MRR atual", valor: resumo ? brl0(resumo.mrrTotal) : "Dados carregando",
      titulo: resumo ? brl(resumo.mrrTotal) : undefined,
      sub: mrrDeltaPct !== null ? `${mrrDeltaPct >= 0 ? "+" : ""}${mrrDeltaPct.toFixed(1)}% vs 30 dias atrás` : null,
    },
    {
      label: "Clientes ativos", valor: resumo ? resumo.clientesAtivos.toLocaleString("pt-BR") : "Dados carregando",
      sub: resumo ? `+${resumo.clientesNovos30d} novos (30d)` : null,
    },
    {
      label: "Em implantação", valor: resumo ? resumo.emImplantacao.toLocaleString("pt-BR") : "Dados carregando",
      sub: "PABX pós-Won",
    },
    {
      label: "Onboarding", valor: resumo ? resumo.onboarding.toLocaleString("pt-BR") : "Dados carregando",
      sub: "Callface AI pós-Won",
    },
    { label: "Em risco", valor: resumo ? resumo.emRisco.toLocaleString("pt-BR") : "Dados carregando", sub: "fatura em atraso", tone: "warning" },
    { label: "Inadimplentes", valor: resumo ? resumo.inadimplentes.toLocaleString("pt-BR") : "Dados carregando", sub: "status financeiro", tone: "danger" },
  ];

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <section
        aria-label="Sinais da carteira"
        className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] shrink-0 md:grid-cols-3 xl:grid-cols-[1.55fr_repeat(5,minmax(0,1fr))]"
        style={{ background: "var(--cf2-bg-inverse)", border: "1px solid var(--cf2-bg-inverse)" }}
      >
        {SINAIS.map((sinal, index) => {
          const isMrr = index === 0;
          const valueColor = sinal.tone === "warning"
            ? "var(--cf2-warning-text)"
            : sinal.tone === "danger"
              ? "var(--cf2-danger-text)"
              : isMrr
                ? "var(--cf2-accent)"
                : "var(--cf2-text-on-inverse)";
          return (
            <div
              key={sinal.label}
              className={`min-w-0 px-4 py-4 sm:px-5 border-white/15 ${index === 1 || index === 3 || index === 5 ? "border-l" : ""} ${index === 2 || index === 4 ? "md:border-l" : ""} ${index === 3 ? "md:border-l-0" : ""} ${index > 0 ? "xl:border-l" : ""} ${index >= 2 ? "border-t" : ""} ${index >= 3 ? "md:border-t" : "md:border-t-0"} xl:border-t-0`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 58%, transparent)" }}>{sinal.label}</p>
              <p className={`${isMrr ? "mt-2 text-[25px] sm:text-[30px]" : "mt-2 text-[20px]"} font-bold leading-none tabular-nums truncate`} style={{ color: valueColor }} title={sinal.titulo}>{sinal.valor}</p>
              {sinal.sub && <p className="mt-2 text-[11px] truncate" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 62%, transparent)" }}>{sinal.sub}</p>}
            </div>
          );
        })}
      </section>

      <div className="grid flex-1 min-h-0 gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 rounded-[var(--radius-card)] p-5 xl:sticky xl:top-0 xl:self-start" style={{ background: "var(--cf2-bg-inverse)", color: "var(--cf2-text-on-inverse)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 55%, transparent)" }}>Triagem da carteira</p>
            <p className="mt-2 text-[17px] font-bold">Onde agir agora</p>
            <p className="mt-1 text-[12px] leading-5" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 64%, transparent)" }}>Use o recorte para encontrar contas que pedem acompanhamento.</p>
          </div>
          <nav aria-label="Filtrar carteira por estado" className="grid grid-cols-2 gap-1 xl:grid-cols-1">
            {ABAS.map((a) => {
              const ativo = aba === a.key;
              const n = abaCounts ? abaCounts[a.contagemKey] : null;
              return (
                <button
                  key={a.key || "todos"}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => { setAba(a.key); setPagina(1); }}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-[12px] font-semibold transition-colors"
                  style={{ background: ativo ? "var(--cf2-accent)" : "transparent", color: ativo ? "var(--cf2-text-on-accent)" : "var(--cf2-text-on-inverse)" }}
                >
                  <span>{a.label}</span>
                  <span className="tabular-nums" style={{ color: ativo ? "inherit" : "color-mix(in srgb, var(--cf2-text-on-inverse) 55%, transparent)" }}>{n?.toLocaleString("pt-BR") ?? "..."}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/15 pt-4">
            <p className="text-[11px] leading-5" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 58%, transparent)" }}>As contagens são independentes. Uma conta pode exigir atenção em mais de um ponto.</p>
          </div>
        </aside>

        <div className="min-h-0 flex flex-col overflow-hidden rounded-[var(--radius-card)]" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="p-4 shrink-0 flex flex-col gap-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--cf2-text-tertiary)" }}>Worklist</p>
              <h2 className="mt-1 text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{aba ? ABAS.find((item) => item.key === aba)?.label : "Toda a carteira"}</h2>
            </div>
            <p className="hidden text-[12px] sm:block" style={{ color: "var(--cf2-text-secondary)" }}>{data ? `${data.total.toLocaleString("pt-BR")} contas neste recorte` : "Atualizando recorte"}</p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              placeholder="Buscar cliente..." aria-label="Buscar cliente"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <div className="flex gap-2">
            {/* "Serviço" do mockup = famílias (PABX/Callface AI/White Label)
                já existentes — mesmo filtro, só relabelado pro nome que o
                Kauã usa. Health Score NÃO entra como filtro (regra
                fechada, sem esse dado no produto). */}
            <select
              value={familia}
              onChange={(e) => { setFamilia(e.target.value); setPagina(1); }}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todos os serviços</option>
              {Object.entries(FAMILIA_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPagina(1); }}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todos os status financeiros</option>
              {Object.entries(STATUS_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={owner}
              onChange={(e) => { setOwner(e.target.value); setPagina(1); }}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todos os responsáveis CS</option>
              <option value="sem_dono">Sem dono</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
          ) : clientes.length === 0 ? (
            <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum cliente encontrado com esses filtros.</p>
          ) : (
            <table className="w-full text-left">
              {/* Cabeçalho fixo: a carteira tem 302 linhas e, ao rolar, não dava
                  mais pra saber que coluna era qual. */}
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  {COLUNAS.map((col) => (
                    <th
                      key={col.label}
                      className={`px-3 sm:px-4 py-2.5 text-[11px] font-bold whitespace-nowrap ${col.visivel}`}
                      style={{ color: "var(--cf2-text-tertiary)", background: "var(--cf2-bg-surface-muted)", boxShadow: "inset 0 -1px 0 var(--cf2-border-default)" }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((cl) => {
                  const naoResolvida = cl.nome === EMPRESA_NAO_RESOLVIDA;
                  const iniciais = iniciaisEmpresa(cl.nome);
                  return (
                  <tr
                    key={cl.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
                    style={{ borderTop: "1px solid var(--cf2-border-default)", background: naoResolvida ? "var(--cf2-warning-bg, rgba(234,179,8,0.08))" : undefined }}
                    onClick={() => setDrawerEmpresaId(cl.id)}
                  >
                    <td className="px-3 sm:px-4 py-3 max-w-[190px] sm:max-w-none">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8"
                          style={{ background: naoResolvida ? "var(--cf2-warning-text)" : corAvatarEmpresa(cl.id), color: TEXTO_SOBRE_AVATAR }}
                        >
                          {naoResolvida ? (
                            <AlertTriangle className="w-4 h-4 text-white" />
                          ) : (
                            <span className="text-[11px] font-extrabold">{iniciais || "—"}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold truncate" style={{ color: naoResolvida ? "var(--cf2-warning-text)" : "var(--cf2-text-primary)" }}>
                            {naoResolvida ? "Sem empresa vinculada (billing não resolvido)" : cl.nome}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{cl.setor || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 py-3">
                      <p className="text-[12px] font-semibold mb-1 whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>
                        {cl.total_servicos} {cl.total_servicos === 1 ? "serviço" : "serviços"}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {cl.familias.map((f) => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{FAMILIA_LABEL[f] || f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-[13px] font-bold whitespace-nowrap tabular-nums" style={{ color: "var(--cf2-success-text)" }}>{brl(cl.current_mrr)}</td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap" style={{ color: STATUS_GERAL_COLOR[cl.status_geral] }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "currentColor" }} />
                        {STATUS_GERAL_LABEL[cl.status_geral]}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-4 py-3">
                      <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: STATUS_COLOR[cl.status_financeiro] }}>
                        {STATUS_LABEL[cl.status_financeiro] || cl.status_financeiro}
                      </span>
                      {cl.faturas_atrasadas > 0 && (
                        <p className="text-[11px] font-semibold" style={{ color: "var(--cf2-danger-text)" }}>Atrasado · {diasAtraso(cl.fatura_venceu_em)}d</p>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-4 py-3">
                      <AssignOwnerControl
                        entityType="cliente"
                        entityId={cl.id}
                        currentOwnerId={cl.cs_owner_id}
                        usuarios={usuarios}
                        onChanged={() => qc.invalidateQueries({ queryKey: ["cf2-clientes"] })}
                      />
                    </td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                      {cl.ultima_atividade_em ? (
                        <>
                          <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
                            {CANAL_LABEL[cl.ultima_atividade_tipo || ""] || cl.ultima_atividade_tipo}
                          </span>
                          {" · "}{formatarQuando(cl.ultima_atividade_em)}
                        </>
                      ) : (
                        <span style={{ color: "var(--cf2-text-tertiary)" }}>Sem atividade registrada</span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-[12px] max-w-[200px]" style={{ color: "var(--cf2-text-secondary)" }}>
                      {cl.proxima_acao_titulo ? (
                        <>
                          <p className="font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{cl.proxima_acao_titulo}</p>
                          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                            {cl.proxima_acao_vence_em ? new Date(cl.proxima_acao_vence_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "sem prazo"}
                          </p>
                        </>
                      ) : (
                        <span style={{ color: "var(--cf2-text-tertiary)" }}>Sem próxima ação</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
            {data ? `Mostrando ${(pagina - 1) * 20 + 1}-${Math.min(pagina * 20, data.total)} de ${data.total}` : "—"}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>Anterior</button>
            <button onClick={() => setPagina((p) => (data && p < data.totalPages ? p + 1 : p))} disabled={!data || pagina >= data.totalPages} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>Próximo</button>
          </div>
        </div>
        </div>
      </div>

      <Cf2ClienteDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
      />
    </div>
  );
}
