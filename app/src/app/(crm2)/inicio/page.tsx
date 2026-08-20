import Link from "next/link";
import { db } from "@/lib/db";
import { organizacoes, tarefas, usuarios } from "@/lib/db/schema";
import { eq, and, or, lte, isNull } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { getMetaComercialAgregada, getMetasPorVendedor } from "@/lib/metas";
import { getPipelineAtual } from "@/lib/relatorios/comercial";
import {
  getMrrComparativo,
  getDesempenhoMensalTrend,
  getFunilLeads,
  getPipelineComercial,
  getComunicacoesResumo,
  getAtividadeRecente,
  getAquisicaoPeriodo,
  getPreVendasAtrasados,
  getNegociosTravadosResumo,
  getMrrLedgerPeriodo,
  getSaudeBaseClientes,
  diasUteisRestantesNoMes,
} from "@/lib/analytics/command-center";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2Card, Cf2SectionHeader, Cf2Eyebrow } from "@/components/crm2/ui/Card";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2EmptyState, Cf2UnavailableMetric } from "@/components/crm2/ui/States";
import { Cf2Gauge } from "@/components/crm2/ui/Gauge";
import { DesempenhoChart } from "@/components/crm2/DesempenhoChart";
import { Phone, MessageCircle, Mail } from "lucide-react";

const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const brl2 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ACTION_BY_TIPO: Record<string, string> = {
  ligacao: "Ligar",
  whatsapp: "Responder",
  proposta_enviada: "Enviar",
  reuniao: "Preparar",
  follow_up: "Retomar",
  email: "Enviar",
};

function tempoRelativo(venc: Date | null): { texto: string; atrasado: boolean } {
  if (!venc) return { texto: "Sem prazo", atrasado: false };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((venc.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return { texto: "Atrasado", atrasado: true };
  if (dias === 0) return { texto: "Hoje", atrasado: false };
  if (dias === 1) return { texto: "Amanhã", atrasado: false };
  return { texto: venc.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), atrasado: false };
}

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "pipeline" || params.tab === "pendencias" ? params.tab : "geral";
  const hoje = new Date();

  const [
    org,
    metaMes,
    pipelineAtivo,
    mrrComparativo,
    desempenhoMensal,
    funilLeads,
    pipelineComercial,
    vendedores,
    comunicacoes,
    atividadeRecente,
    tarefasPendentesLista,
    aquisicao,
    preVendasAtrasados,
    negociosTravados,
    mrrLedger,
    saudeBase,
  ] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getMetaComercialAgregada(ctx.organizacaoId, hoje),
    getPipelineAtual(ctx.organizacaoId),
    getMrrComparativo(ctx.organizacaoId, hoje),
    getDesempenhoMensalTrend(ctx.organizacaoId, hoje, 6),
    getFunilLeads(ctx.organizacaoId, hoje),
    getPipelineComercial(ctx.organizacaoId, hoje),
    getMetasPorVendedor(ctx.organizacaoId),
    getComunicacoesResumo(ctx.organizacaoId, hoje),
    getAtividadeRecente(ctx.organizacaoId, 3),
    db.select({
      id: tarefas.id, titulo: tarefas.titulo, dataVencimento: tarefas.dataVencimento,
      usuarioNome: usuarios.nome,
    }).from(tarefas)
      .leftJoin(usuarios, eq(usuarios.id, tarefas.usuarioId))
      .where(and(
        eq(tarefas.organizacaoId, ctx.organizacaoId),
        eq(tarefas.concluida, false),
        or(lte(tarefas.dataVencimento, new Date().toISOString().split("T")[0]), isNull(tarefas.dataVencimento)),
      ))
      .orderBy(tarefas.dataVencimento)
      .limit(50),
    getAquisicaoPeriodo(ctx.organizacaoId, hoje),
    getPreVendasAtrasados(ctx.organizacaoId),
    getNegociosTravadosResumo(ctx.organizacaoId, 5),
    getMrrLedgerPeriodo(ctx.organizacaoId, hoje),
    getSaudeBaseClientes(ctx.organizacaoId),
  ]);

  const orgNome = org[0]?.nome || "Callface";
  const pipelineTotalCount = pipelineAtivo.etapas.reduce((s, e) => s + e.count, 0);
  const rankingOrdenado = [...vendedores].sort((a, b) => b.realizado - a.realizado).slice(0, 3);

  const metaPct = metaMes.valorAlvo > 0 ? Math.round((metaMes.realizado / metaMes.valorAlvo) * 100) : 0;
  const faltantes = Math.max(metaMes.valorAlvo - metaMes.realizado, 0);
  const diasUteisRestantes = diasUteisRestantesNoMes(hoje);
  const metaPorDia = diasUteisRestantes > 0 ? faltantes / diasUteisRestantes : null;
  const coberturaRatio = faltantes > 0 ? pipelineAtivo.ponderado / faltantes : null;
  const totalContasSaude = saudeBase.ativo + saudeBase.inadimplente + saudeBase.churned;

  const tabHref = (t: string) => (t === "geral" ? "/inicio" : `/inicio?tab=${t}`);
  const avatarColors = ["var(--cf2-avatar-1)", "var(--cf2-avatar-2)", "var(--cf2-avatar-3)", "var(--cf2-avatar-4)", "var(--cf2-avatar-5)"];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero escuro full-bleed — só o Topbar agora (17/08, pedido do Kauã:
          "descer o Pulso do Negócio"). -m-6 escapa do padding p-6 do shell
          (mesmo valor, 24px) sem tocar no layout global, que continua
          servindo todas as outras telas crm2 sem mudança. */}
      <div className="-m-6 mb-0 flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
        <Cf2Topbar orgNome={orgNome} variant="dark" />
      </div>

      {/* Tabs flutuantes (17/08, 4ª correção) — UM card branco compartilhado
          (com sombra) por baixo de tudo, não pills individuais. Só o item
          ATIVO ganha sua própria pill (verde, com sombra própria); os
          inativos são só texto direto sobre o card branco, sem fundo
          nenhum. O recorte escuro (notch-bump real do Figma, 10px côncavo
          nos 2 cantos de baixo) fica por trás do card branco, preenchendo
          a costura com o hero. Sem seletor de mês — não existe no frame. */}
      <div className="-mt-12 flex justify-center relative z-10">
        <div className="relative">
          <div className="absolute bottom-0 -left-2.5 w-2.5 h-2.5" style={{ background: "radial-gradient(circle at top left, transparent 10px, var(--cf2-bg-canvas) 10px)" }} />
          <div className="absolute bottom-0 -right-2.5 w-2.5 h-2.5" style={{ background: "radial-gradient(circle at top right, transparent 10px, var(--cf2-bg-canvas) 10px)" }} />
          <div className="relative flex gap-3 p-3 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", boxShadow: "var(--cf2-shadow-card-md)" }}>
            {[{ key: "geral", label: "Visão Geral" }, { key: "pipeline", label: "Pipeline" }, { key: "pendencias", label: "Pendências", badge: tarefasPendentesLista.length }].map((t) => (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                scroll={false}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
                style={{
                  background: tab === t.key ? "var(--cf2-accent)" : "transparent",
                  color: tab === t.key ? "var(--cf2-text-on-accent)" : "var(--cf2-text-primary)",
                  fontWeight: tab === t.key ? 700 : 500,
                  boxShadow: tab === t.key ? "0 2px 4px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {t.label}
                {t.badge !== undefined && t.badge > 0 && <Cf2Badge variant={tab === t.key ? "neutral" : "accent"}>{t.badge}</Cf2Badge>}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Pulso do Negócio (17/08) — descido pra baixo das tabs (Figma novo),
          não mais colado no Topbar. Só na aba Visão Geral (pedido do Kauã:
          em Pipeline/Pendências ele não precisa estar visível). */}
      {tab === "geral" && (
        <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pulso do Negócio</p>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Visão executiva unificada da performance e ritmo do período comercial</p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Equipe</span>
              <div className="flex">
                {rankingOrdenado.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold"
                    style={{ width: 28, height: 28, marginLeft: i > 0 ? -8 : 0, background: avatarColors[i], color: "var(--cf2-text-on-accent)", zIndex: 3 - i }}
                  >
                    {v.nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                ))}
              </div>
              {mrrComparativo.deltaPct !== null ? (
                <Cf2Badge variant={mrrComparativo.deltaPct >= 0 ? "success" : "danger"}>
                  {mrrComparativo.deltaPct >= 0 ? "+" : ""}{mrrComparativo.deltaPct.toFixed(1)}% vs anterior
                </Cf2Badge>
              ) : (
                <Cf2UnavailableMetric reason="Sem MRR no mês anterior pra comparar" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-3 w-[340px]">
              <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Meta Mensal de Receita</p>
              <div className="flex items-center gap-5">
                <Cf2Gauge pct={metaPct} label={`${metaPct}%`} />
                <div className="flex flex-col gap-1">
                  <p className="text-[32px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl0(metaMes.realizado)}</p>
                  <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>de {brl0(metaMes.valorAlvo)} (meta do período)</p>
                </div>
              </div>
            </div>

            <div className="w-px self-stretch" style={{ background: "var(--cf2-chrome-border-subtle)" }} />

            <div className="flex-1 flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Cadência em Andamento</p>
              <div className="flex gap-6">
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Faltantes</p>
                  <p className="text-[20px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl0(faltantes)}</p>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Dias úteis restantes</p>
                  <p className="text-[20px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{diasUteisRestantes} dias</p>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Meta/dia necessária</p>
                  {metaPorDia !== null ? (
                    <p className="text-[20px] font-bold" style={{ color: "var(--cf2-accent-border)", fontFamily: "var(--cf2-font-heading)" }}>{brl0(metaPorDia)}/dia</p>
                  ) : (
                    <Cf2UnavailableMetric reason="Sem dias úteis restantes no período" />
                  )}
                </div>
              </div>
            </div>

            <div className="w-px self-stretch" style={{ background: "var(--cf2-chrome-border-subtle)" }} />

            <div className="flex flex-col gap-3 w-[300px]">
              <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Projeção de Resultado</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Pipeline aberto:</span>
                  <span className="text-sm font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl0(pipelineAtivo.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Forecast mapeado:</span>
                  <span className="text-sm font-bold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl0(pipelineAtivo.ponderado)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Cobertura de meta:</span>
                  {faltantes <= 0 ? (
                    <span className="text-sm font-bold" style={{ color: "var(--cf2-accent-border)" }}>Meta batida</span>
                  ) : coberturaRatio !== null ? (
                    <span className="text-sm font-bold" style={{ color: "var(--cf2-accent-border)" }}>{coberturaRatio.toFixed(1)}x</span>
                  ) : (
                    <Cf2UnavailableMetric reason="Sem faltante calculável" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "geral" && (
        <div className="flex gap-8 items-stretch">
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Desempenho Mensal</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
                  <span className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>Realizado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: "var(--cf2-text-tertiary)" }} />
                  <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Meta</span>
                </div>
              </div>
            </div>
            <Cf2Card padding="16px">
              <DesempenhoChart dados={desempenhoMensal} meta={metaMes.valorAlvo} />
            </Cf2Card>
          </div>
          <div className="w-[420px] shrink-0">
            <TopVendedores rankingOrdenado={rankingOrdenado} avatarColors={avatarColors} />
          </div>
        </div>
      )}

      {tab === "pipeline" && (
        <div className="flex flex-col gap-4">
          <Cf2Eyebrow>Pipeline — só etapas abertas</Cf2Eyebrow>
          <div className="flex gap-2">
            {pipelineComercial.map((etapa) => (
              <Cf2Card key={etapa.label} className="flex-1">
                <p className="text-sm font-semibold mb-2" style={{ color: "var(--cf2-text-primary)" }}>{etapa.label}</p>
                <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl0(etapa.valor)}</p>
                <p className="text-xs mt-1" style={{ color: "var(--cf2-text-secondary)" }}>{etapa.total} negócios</p>
              </Cf2Card>
            ))}
          </div>
          <Link href="/pipeline" className="text-sm font-semibold" style={{ color: "var(--cf2-success-text)" }}>Abrir o board completo →</Link>
        </div>
      )}

      {tab === "pendencias" && (
        <div className="flex flex-col gap-3">
          <Cf2Eyebrow>{tarefasPendentesLista.length} tarefas atrasadas ou sem prazo, da organização toda</Cf2Eyebrow>
          {tarefasPendentesLista.length === 0 ? (
            <Cf2EmptyState title="Nada pendente" description="Todas as tarefas da organização estão em dia." />
          ) : (
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {tarefasPendentesLista.slice(0, 20).map((t) => {
                const venc = tempoRelativo(t.dataVencimento ? new Date(t.dataVencimento) : null);
                return (
                  <Cf2Card key={t.id} padding="12px">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                        <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{t.usuarioNome || "Sem responsável"} · {venc.texto}</p>
                      </div>
                      {venc.atrasado && <Cf2Badge variant="warning">Atrasado</Cf2Badge>}
                    </div>
                  </Cf2Card>
                );
              })}
            </div>
          )}
          <Link href="/tarefas" className="text-sm font-semibold" style={{ color: "var(--cf2-success-text)" }}>Ver todas em /tarefas →</Link>
        </div>
      )}

      {/* Jornada Operacional — flow Aquisição → Pré-vendas → Vendas →
          Entrega → Clientes. Substitui os antigos "Funil de Leads" e
          "Pipeline Comercial" sempre-visíveis (não fazem parte do frame
          novo do Figma) — as funções que os alimentavam continuam
          existindo em command-center.ts/comercial.ts, só não renderizam
          mais aqui. Cada estágio documenta se o número é real ou pendente. */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Jornada Operacional</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Flow operacional unificado e conversão entre as frentes de Revenue Operations</p>
        </div>
        <Cf2Card padding="24px">
          <div className="flex gap-3 items-stretch">
            <EstagioCard titulo="AQUISIÇÃO" valor={`${aquisicao.total} leads`} sub={`${aquisicao.inbound} inbound · ${aquisicao.outbound} outbound`} />
            <Seta />
            <EstagioCard
              titulo="PRÉ-VENDAS"
              valor={`${funilLeads.emQualificacao.total} ativos`}
              linhas={[
                { texto: `${funilLeads.qualificados.total} qualificados` },
                { texto: `${preVendasAtrasados} atrasados`, tom: preVendasAtrasados > 0 ? "warning" : undefined },
              ]}
            />
            <Seta />
            <EstagioCard
              titulo="VENDAS"
              valor={brl0(pipelineAtivo.total)}
              linhas={[
                { texto: `${pipelineTotalCount} oportunidades` },
                { texto: `${brl0(negociosTravados.valor)} travados (${negociosTravados.total}, ${negociosTravados.diasMin}+ dias sem atividade)`, tom: negociosTravados.total > 0 ? "warning" : undefined },
              ]}
            />
            <Seta />
            <EstagioCard titulo="ENTREGA" indisponivel="Onboarding de serviço ainda sem status estruturado no domínio novo (Commercial Core) — pendência desta rodada" />
            <Seta />
            <EstagioCard
              titulo="CLIENTES"
              valor={`${saudeBase.ativo} ativos`}
              linhas={[
                { texto: `${saudeBase.inadimplente} inadimplentes`, tom: saudeBase.inadimplente > 0 ? "warning" : undefined },
                { texto: `${saudeBase.churned} churned`, tom: saudeBase.churned > 0 ? "danger" : undefined },
              ]}
            />
          </div>
        </Cf2Card>
      </div>

      {/* Saúde da Receita & Base + Comunicações */}
      <div className="flex gap-8 items-start">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Saúde da Receita &amp; Base</p>
            <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Movimentação financeira mensal e distribuição de integridade da base</p>
          </div>
          <Cf2Card>
            <div className="flex flex-col gap-2.5">
              <LedgerLinha label="MRR Atual Ativo" valor={brl0(mrrComparativo.atual)} />
              <LedgerLinha label="+ Novo MRR Adicionado" valor={`+ ${brl0(mrrLedger.novo)}`} tom="success" />
              <LedgerLinha label="+ Expansão de Contas" valor={`+ ${brl0(mrrLedger.expansao)}`} tom="teal" />
              <LedgerLinha label="- Downgrades e Churn" valor={brl0(mrrLedger.churn)} tom="danger" />
            </div>
            <div className="h-px my-4" style={{ background: "var(--cf2-border-default)" }} />
            <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: "rgba(254,242,242,0.6)" }}>
              <span className="text-[13px] font-bold" style={{ color: "var(--cf2-danger-text)" }}>MRR Total em Risco Ativo</span>
              <Cf2UnavailableMetric reason="Sem conceito estruturado de risco de MRR ainda (payment_failed hoje é só texto de auditoria, não flag por cliente) — pendência desta rodada" />
            </div>
            <div className="h-px my-4" style={{ background: "var(--cf2-border-default)" }} />
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>Distribuição de Saúde de Contas</p>
              {totalContasSaude === 0 ? (
                <Cf2UnavailableMetric reason="Nenhum cliente cadastrado ainda" />
              ) : (
                <>
                  <div className="flex gap-[3px] h-4 w-full">
                    {saudeBase.ativo > 0 && <div className="rounded-l h-full" style={{ background: "var(--cf2-chrome-bg)", width: `${(saudeBase.ativo / totalContasSaude) * 100}%` }} />}
                    {saudeBase.inadimplente > 0 && <div className="h-full" style={{ background: "var(--cf2-warning-text)", width: `${(saudeBase.inadimplente / totalContasSaude) * 100}%` }} />}
                    {saudeBase.churned > 0 && <div className="rounded-r h-full" style={{ background: "var(--cf2-danger-text)", width: `${(saudeBase.churned / totalContasSaude) * 100}%` }} />}
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <span style={{ color: "var(--cf2-chrome-bg)" }}>● {saudeBase.ativo} Saudáveis</span>
                    <span style={{ color: "var(--cf2-warning-text)" }}>● {saudeBase.inadimplente} Atenção</span>
                    <span style={{ color: "var(--cf2-danger-text)" }}>● {saudeBase.churned} Risco</span>
                  </div>
                </>
              )}
            </div>
          </Cf2Card>
        </div>

        <div className="flex flex-col gap-4 w-[420px] shrink-0">
          <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>COMUNICAÇÕES</p>
          <div className="flex gap-3">
            <Cf2Card padding="12px" className="flex-1">
              <ComunicacaoMiniCard icon={Phone} label="Ligações" total={comunicacoes.ligacoes} />
            </Cf2Card>
            <Cf2Card padding="12px" className="flex-1">
              <ComunicacaoMiniCard icon={MessageCircle} label="WhatsApp" total={comunicacoes.whatsapp} />
            </Cf2Card>
            <Cf2Card padding="12px" className="flex-1">
              <ComunicacaoMiniCard icon={Mail} label="E-mail" total={comunicacoes.email} />
            </Cf2Card>
          </div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Canais</p>
          <Cf2Card padding="12px">
            <p className="text-[13px] font-semibold mb-2.5" style={{ color: "var(--cf2-text-primary)" }}>Atividade em Tempo Real</p>
            {atividadeRecente.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade registrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {atividadeRecente.map((a, i) => (
                  <div key={a.id}>
                    <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>• {a.texto}</p>
                    {i < atividadeRecente.length - 1 && <div className="h-px my-2" style={{ background: "var(--cf2-border-default)" }} />}
                  </div>
                ))}
              </div>
            )}
          </Cf2Card>
        </div>
      </div>
    </div>
  );
}

function Seta() {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 w-4 self-stretch">
      <span className="text-base" style={{ color: "var(--cf2-text-tertiary)" }}>→</span>
    </div>
  );
}

function EstagioCard({
  titulo, valor, sub, linhas, indisponivel,
}: {
  titulo: string;
  valor?: string;
  sub?: string;
  linhas?: { texto: string; tom?: "warning" | "danger" | "success" }[];
  indisponivel?: string;
}) {
  const tomCor: Record<string, string> = {
    warning: "var(--cf2-warning-text)",
    danger: "var(--cf2-danger-text)",
    success: "var(--cf2-success-text)",
  };
  return (
    <div className="flex-1 flex flex-col gap-3 p-4 rounded-lg border min-w-0" style={{ borderColor: "var(--cf2-border-default)" }}>
      <p className="text-xs font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{titulo}</p>
      {valor && <p className="text-[22px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>}
      {sub && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{sub}</p>}
      {linhas && (
        <div className="flex flex-col gap-0.5">
          {linhas.map((l, i) => (
            <p key={i} className="text-[11px]" style={{ color: l.tom ? tomCor[l.tom] : "var(--cf2-text-secondary)", fontWeight: l.tom ? 600 : 400 }}>{l.texto}</p>
          ))}
        </div>
      )}
      {indisponivel && <Cf2UnavailableMetric reason={indisponivel} />}
    </div>
  );
}

function LedgerLinha({ label, valor, tom }: { label: string; valor: string; tom?: "success" | "danger" | "teal" }) {
  const cor = tom === "success" ? "var(--cf2-success-text)" : tom === "danger" ? "var(--cf2-danger-text)" : tom === "teal" ? "#0d9488" : "var(--cf2-text-primary)";
  return (
    <div className="flex items-center justify-between text-[13px]" style={{ color: cor }}>
      <span style={{ fontWeight: tom ? 600 : 400 }}>{label}</span>
      <span className="font-bold">{valor}</span>
    </div>
  );
}

function TopVendedores({
  rankingOrdenado, avatarColors,
}: {
  rankingOrdenado: { id: string; nome: string; valorAlvo: number; realizado: number; pct: number }[];
  avatarColors: string[];
}) {
  return (
    <Cf2Card padding="0px" className="overflow-hidden h-full flex flex-col" style={{ background: "var(--cf2-chrome-bg)" }}>
      <div className="flex items-center justify-center p-5 shrink-0" style={{ background: "var(--cf2-chrome-bg)" }}>
        <p className="text-xl font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}># TOP Vendedores</p>
      </div>
      <div className="flex-1 flex flex-col gap-2.5 px-4 pb-4 overflow-y-auto" style={{ background: "var(--cf2-chrome-bg)" }}>
        {rankingOrdenado.length === 0 ? (
          <Cf2EmptyState title="Ninguém com meta cadastrada ainda" />
        ) : (
          rankingOrdenado.map((v, i) => (
            <div key={v.id} className="flex flex-col gap-2.5 p-3 rounded-2xl" style={{ border: "1px solid var(--cf2-chrome-border)" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-full text-xs font-extrabold shrink-0" style={{ width: 36, height: 36, background: avatarColors[i], color: "var(--cf2-text-on-accent)" }}>
                  {v.nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--cf2-chrome-text-primary)" }}>{v.nome}</p>
                  <p className="text-xs" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Meta: {brl2(v.valorAlvo)}</p>
                </div>
                <p className="text-sm font-extrabold whitespace-nowrap" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl2(v.realizado)}</p>
              </div>
              <div className="rounded-full overflow-hidden h-1.5 w-full" style={{ background: "rgba(255,255,255,0.17)" }}>
                <div className="h-full" style={{ width: `${Math.min(v.pct, 100)}%`, background: "var(--cf2-success-fill)" }} />
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between p-3 shrink-0" style={{ background: "var(--cf2-chrome-bg)", borderTop: "1px solid var(--cf2-chrome-border)" }}>
        <p className="text-xs" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Atualizado há 3 min</p>
        <Link href="/relatorios" className="px-4 py-2 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}>
          Ver Ranking Completo
        </Link>
      </div>
    </Cf2Card>
  );
}

function ComunicacaoMiniCard({ icon: Icon, label, total }: { icon: React.ElementType; label: string; total: number }) {
  return (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{label}</p>
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
      </div>
      <p className="text-2xl font-bold mb-1" style={{ color: "var(--cf2-text-primary)" }}>{total}</p>
      <Cf2UnavailableMetric reason="Taxa de sucesso ainda sem regra formal — ver ADR do Command Center" />
    </>
  );
}
