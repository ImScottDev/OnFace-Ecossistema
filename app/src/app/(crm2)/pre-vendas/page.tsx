import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { getPulsoPreVendas, getDistribuicaoPorOrigem, getDistribuicaoPorStatus } from "@/lib/analytics/pre-vendas";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ModuleTabs } from "@/components/crm2/ModuleTabs";
import { VENDAS_TABS } from "@/components/crm2/vendas-tabs";
import { Cf2UnavailableMetric } from "@/components/crm2/ui/States";
import { Cf2QualificacaoWorkspace } from "@/components/crm2/qualificacao/Workspace";

const ORIGEM_CORES: Record<string, string> = {
  inbound: "#1c1f26", outbound: "#88d600", indicacao: "#3b82f6", parceiro: "#f59e0b",
};
const CORES_FALLBACK = ["#1c1f26", "#88d600", "#3b82f6", "#f59e0b", "#9ca3af"];

const STATUS_CORES: Record<string, string> = {
  novo: "#1c1f26", em_contato: "#3b82f6", qualificacao: "#8e27ef", qualificado: "#88d600",
  desqualificado: "#9ca3af", sem_resposta: "#dc2626", nutricao_retomar: "#f59e0b",
};

function monthBounds(ref: Date) {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { inicio, fim };
}

export default async function PreVendasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const hoje = new Date();
  const { inicio, fim } = monthBounds(hoje);
  const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const { inicio: inicioAnt, fim: fimAnt } = monthBounds(mesAnteriorRef);

  const [org, pulso, pulsoAnterior, distOrigem, distStatus] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getPulsoPreVendas(ctx.organizacaoId, inicio, fim),
    getPulsoPreVendas(ctx.organizacaoId, inicioAnt, fimAnt),
    getDistribuicaoPorOrigem(ctx.organizacaoId),
    getDistribuicaoPorStatus(ctx.organizacaoId),
  ]);

  const orgNome = org[0]?.nome || "Callface";
  const deltaTaxaPct =
    pulso.taxaQualificacao !== null && pulsoAnterior.taxaQualificacao !== null && pulsoAnterior.taxaQualificacao > 0
      ? ((pulso.taxaQualificacao - pulsoAnterior.taxaQualificacao) / pulsoAnterior.taxaQualificacao) * 100
      : null;

  const totalOrigem = distOrigem.reduce((s, o) => s + o.total, 0);
  const totalStatus = distStatus.reduce((s, o) => s + o.total, 0);
  const maxStatus = Math.max(...distStatus.map((s) => s.total), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* top-zone claro (Figma: node 211:93 "top-zone") — mesma cor de fundo
          do top-zone de Vendas Visão Geral (var(--cf2-bg-canvas)), não o
          bg-white cru do Figma: o card de abas (ModuleTabs) é compartilhado
          entre os dois módulos e usa essa mesma variável de fundo, então
          manter a mesma cor aqui evita a costura visível que aparecia
          quando o topo ficava branco puro contra o card canvas.
          `-m-6 mb-0` escapa só o padding do shell pro topo ficar full-bleed,
          igual o hero da Home — o corpo abaixo fica em fluxo normal (sem
          -m-6, sem cor própria) pra herdar o fundo claro + grid que o
          próprio layout do CRM2 já pinta pra toda tela, igualzinho a Início. */}
      <div className="-m-6 mb-0 relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-bg-canvas)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Vendas" subtitle="Gestão de pré-vendas, qualificação e distribuição de leads" />
        <Cf2ModuleTabs items={VENDAS_TABS} notchFillColor="var(--cf2-bg-canvas)" />
      </div>

      {/* pb-10 (não só o p-6 padrão do layout): o Kanban é a última seção e
          fica colado na barra da Carol sem essa folga extra — pedido
          explícito do Kauã ("ta colado na Carol precisa ter um respiro"). */}
      <div className="flex flex-col gap-5 pt-10 pb-10">
        {/* Pulso da Pré-Venda */}
        <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pulso da Pré-Venda</p>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Desempenho do funil de qualificação de leads no período</p>
            </div>
            {deltaTaxaPct !== null ? (
              <div className="px-2 py-1 rounded-md" style={{ background: "#153723" }}>
                <p className="text-[11px] font-bold" style={{ color: "#4ade80" }}>{deltaTaxaPct >= 0 ? "+" : ""}{deltaTaxaPct.toFixed(1)}% conversão vs mês anterior</p>
              </div>
            ) : (
              <Cf2UnavailableMetric reason="Sem taxa de qualificação no mês anterior pra comparar" />
            )}
          </div>
          <div className="flex items-center gap-6">
            <MetricGroup label="Leads no Período" valor={String(pulso.leadsNoPeriodo)} sub="Total inbound e outbound" />
            <Divider />
            <MetricGroup label="Em Qualificação" valor={String(pulso.emQualificacao)} sub="Triagem ativa pelos SDRs" subTom="accent" />
            <Divider />
            <MetricGroup label="Qualificados (SQL)" valor={String(pulso.qualificadosSQL)} sub="Prontos para executivos" subTom="accent" />
            <Divider />
            {pulso.taxaQualificacao !== null ? (
              <MetricGroup label="Taxa de Qualificação" valor={`${pulso.taxaQualificacao.toFixed(0)}%`} sub="Conversão interna do período" subTom="accent" />
            ) : (
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Taxa de Qualificação</p>
                <Cf2UnavailableMetric reason="Sem leads no período pra calcular taxa" />
              </div>
            )}
            <Divider />
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <SubStat label="Tempo Quali:" valor={pulso.tempoQualificacaoDias !== null ? `${pulso.tempoQualificacaoDias.toFixed(1)} dias` : undefined} indisponivel={pulso.tempoQualificacaoDias === null ? "Nenhum lead qualificado (com negócio criado) no período" : undefined} />
              <SubStat label="1º Contato SLA:" valor={pulso.primeiroContatoSlaMinutos !== null ? formatMinutos(pulso.primeiroContatoSlaMinutos) : undefined} indisponivel={pulso.primeiroContatoSlaMinutos === null ? "Sem registro de contato no período" : undefined} />
              <SubStat label="Sem Contato:" valor={`${pulso.semContato} leads`} />
            </div>
          </div>
        </div>

        {/* Distribuição de Leads */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Distribuição de Leads</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Divisão por origem e status atual do funil de pré-vendas</p>
          </div>
          <div className="rounded-2xl p-6 flex gap-6 items-start" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Por Origem</p>
              <div className="flex flex-col gap-3">
                <div className="flex gap-0.5 h-4 rounded-lg overflow-hidden w-full">
                  {distOrigem.map((o, i) => (
                    <div key={o.key} style={{ background: ORIGEM_CORES[o.key] || CORES_FALLBACK[i % CORES_FALLBACK.length], width: totalOrigem > 0 ? `${(o.total / totalOrigem) * 100}%` : 0 }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  {distOrigem.map((o, i) => (
                    <p key={o.key} style={{ color: ORIGEM_CORES[o.key] || CORES_FALLBACK[i % CORES_FALLBACK.length] }}>● {o.label} ({o.total})</p>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-px self-stretch" style={{ background: "var(--cf2-border-default)" }} />
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Por Status</p>
              <div className="flex flex-col gap-2">
                {distStatus.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3 w-full">
                    <p className="text-[13px] w-[150px] shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>{s.label}</p>
                    <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <div className="h-full" style={{ width: `${(s.total / maxStatus) * 100}%`, background: STATUS_CORES[s.key] || "#9ca3af" }} />
                    </div>
                    <p className="text-[13px] font-bold w-10 text-right shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{s.total}</p>
                  </div>
                ))}
                {totalStatus === 0 && <p className="text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum lead migrado ainda.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Kanban de Qualificação — board funcional real (drag-and-drop,
            filtros, drawers, converter-oportunidade), reaproveitado sem
            alteração de lógica. Card escuro (17/08, pedido do Kauã: "tenta
            melhorar, coloca como escuro que a gente tá usando no projeto")
            — mesma linguagem visual do card "Pulso da Pré-Venda" acima
            (--cf2-chrome-*), só essa seção; Distribuição de Leads continua
            clara conforme o Figma original. */}
        <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Kanban de Qualificação</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Gestão visual do fluxo de pré-vendas e qualificação de leads</p>
          </div>
          <div style={{ height: 780 }}>
            <Cf2QualificacaoWorkspace />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMinutos(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} d`;
}

function Divider() {
  return <div className="w-px self-stretch" style={{ background: "var(--cf2-chrome-border-subtle)" }} />;
}

function MetricGroup({ label, valor, sub, subTom }: { label: string; valor: string; sub: string; subTom?: "accent" }) {
  return (
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
      <p className="text-[28px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
      <p className="text-xs" style={{ color: subTom === "accent" ? "var(--cf2-accent-border)" : "var(--cf2-chrome-text-secondary)" }}>{sub}</p>
    </div>
  );
}

function SubStat({ label, valor, indisponivel }: { label: string; valor?: string; indisponivel?: string }) {
  return (
    <div className="flex items-center justify-between w-full gap-3">
      <span className="text-xs" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</span>
      {valor !== undefined ? (
        <span className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</span>
      ) : (
        <Cf2UnavailableMetric reason={indisponivel || "Sem dado suficiente"} />
      )}
    </div>
  );
}
