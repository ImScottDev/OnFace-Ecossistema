import Link from "next/link";
import { db } from "@/lib/db";
import { organizacoes, tarefas } from "@/lib/db/schema";
import { eq, and, or, lte, isNull } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { getMetaComercialAgregada, getMetasPorVendedor } from "@/lib/metas";
import { getPipelineAtual } from "@/lib/relatorios/comercial";
import {
  getMrrComparativo,
  getDesempenhoDiario,
  getFunilLeads,
  getPipelineComercial,
  getComunicacoesResumo,
  getAtividadeRecente,
} from "@/lib/analytics/command-center";
import { gerarInsights } from "@/lib/insights";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2Card, Cf2SectionHeader, Cf2Eyebrow } from "@/components/crm2/ui/Card";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2EmptyState, Cf2UnavailableMetric } from "@/components/crm2/ui/States";
import { DesempenhoChart } from "@/components/crm2/DesempenhoChart";
import { Sparkles, Phone, MessageCircle, Mail, Users } from "lucide-react";

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

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ tab?: string; mes?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "pipeline" || params.tab === "pendencias" ? params.tab : "geral";
  const hoje = params.mes ? new Date(`${params.mes}-01T00:00:00`) : new Date();

  const [
    org,
    metaMes,
    pipelineAtivo,
    mrrComparativo,
    desempenho,
    funilLeads,
    pipelineComercial,
    vendedores,
    comunicacoes,
    atividadeRecente,
    minhasTarefas,
    tarefasPendentesCount,
  ] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getMetaComercialAgregada(ctx.organizacaoId, hoje),
    getPipelineAtual(ctx.organizacaoId),
    getMrrComparativo(ctx.organizacaoId, hoje),
    getDesempenhoDiario(ctx.organizacaoId, hoje),
    getFunilLeads(ctx.organizacaoId),
    getPipelineComercial(ctx.organizacaoId, hoje),
    getMetasPorVendedor(ctx.organizacaoId),
    getComunicacoesResumo(ctx.organizacaoId, hoje),
    getAtividadeRecente(ctx.organizacaoId, 3),
    db.select().from(tarefas)
      .where(and(eq(tarefas.usuarioId, ctx.userId), eq(tarefas.concluida, false)))
      .orderBy(tarefas.dataVencimento)
      .limit(4),
    db.select({ id: tarefas.id }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, ctx.organizacaoId),
        eq(tarefas.concluida, false),
        or(lte(tarefas.dataVencimento, new Date().toISOString().split("T")[0]), isNull(tarefas.dataVencimento)),
      )),
  ]);

  const orgNome = org[0]?.nome || "Callface";
  const pipelineTotalCount = pipelineAtivo.etapas.reduce((s, e) => s + e.count, 0);
  const rankingOrdenado = [...vendedores].sort((a, b) => b.realizado - a.realizado).slice(0, 3);
  const insights = gerarInsights({ vendedores: vendedores.map((v) => ({ id: v.id, nome: v.nome, valorAlvo: v.valorAlvo, realizado: v.realizado, pct: v.pct })) });

  const metaPct = metaMes.valorAlvo > 0 ? Math.round((metaMes.realizado / metaMes.valorAlvo) * 100) : 0;

  const tabHref = (t: string) => `/inicio${t === "geral" ? "" : `?tab=${t}`}`;
  const avatarColors = ["var(--cf2-avatar-1)", "var(--cf2-avatar-2)", "var(--cf2-avatar-3)", "var(--cf2-avatar-4)", "var(--cf2-avatar-5)"];

  return (
    <div className="flex flex-col gap-5">
      <Cf2Topbar orgNome={orgNome} />

      {/* Hero metrics */}
      <Cf2Card padding="20px">
        <div className="flex gap-4 items-stretch">
          <div className="flex-1 flex flex-col gap-3">
            <Cf2Eyebrow>MRR Atual</Cf2Eyebrow>
            <p className="text-[32px] font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl0(mrrComparativo.atual)}</p>
            <div className="flex items-center gap-3 h-7">
              <span className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Equipe</span>
              <div className="flex">
                {rankingOrdenado.slice(0, 3).map((v, i) => (
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
          <div className="w-px self-stretch" style={{ background: "var(--cf2-border-default)" }} />
          <div className="flex-1 flex flex-col gap-3">
            <Cf2Eyebrow>Meta do Mês</Cf2Eyebrow>
            <p className="text-[32px] font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl2(metaMes.valorAlvo)}</p>
            <div className="flex items-center gap-2">
              <span className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Progresso: {metaPct}%</span>
              <div className="rounded-full overflow-hidden h-1.5 w-[100px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="h-full" style={{ width: `${Math.min(metaPct, 100)}%`, background: "var(--cf2-accent)" }} />
              </div>
            </div>
          </div>
          <div className="w-px self-stretch" style={{ background: "var(--cf2-border-default)" }} />
          <div className="flex-1 flex flex-col gap-3">
            <Cf2Eyebrow>Pipeline Ativo</Cf2Eyebrow>
            <p className="text-[32px] font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl2(pipelineAtivo.total)}</p>
            <div className="flex items-center gap-2">
              <Cf2Badge variant="neutral">Mês Corrente</Cf2Badge>
              <Cf2Badge variant="success">{pipelineTotalCount} negócios abertos</Cf2Badge>
            </div>
          </div>
        </div>
      </Cf2Card>

      {/* Tabs + month switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[{ key: "geral", label: "Visão Geral" }, { key: "pipeline", label: "Pipeline" }, { key: "pendencias", label: "Pendências", badge: tarefasPendentesCount.length }].map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
              style={{
                background: tab === t.key ? "var(--cf2-bg-surface)" : "transparent",
                border: tab === t.key ? "1px solid var(--cf2-border-default)" : "none",
                color: tab === t.key ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
                fontWeight: tab === t.key ? 600 : 500,
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && <Cf2Badge variant="accent">{t.badge}</Cf2Badge>}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl text-sm font-semibold" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <span style={{ color: "var(--cf2-text-primary)" }}>
            {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      {tab === "geral" && (
        <>
          <div className="flex gap-8 items-start">
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <Cf2Eyebrow>Desempenho Diário (Acumulado Mês)</Cf2Eyebrow>
              <Cf2Card padding="16px">
                <DesempenhoChart atual={desempenho.atual} anterior={desempenho.anterior} />
              </Cf2Card>
            </div>
            <div className="w-[420px] shrink-0">
              <Cf2Card padding="0px" className="overflow-hidden">
                <div className="flex flex-col gap-3 p-4" style={{ background: "var(--cf2-bg-surface-subtle)", borderBottom: "1px solid var(--cf2-border-default)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}># TOP Vendedores</p>
                    <Link href="/relatorios" className="text-[13px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Metas Pendentes</Link>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center rounded-full text-sm font-bold text-white" style={{ width: 40, height: 40, background: "var(--cf2-bg-inverse)" }}>
                        {orgNome[0]?.toUpperCase()}
                      </div>
                      <p className="text-[15px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{orgNome}</p>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Equipe de Vendas</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 p-4">
                  {rankingOrdenado.length === 0 ? (
                    <Cf2EmptyState title="Ninguém com meta cadastrada ainda" />
                  ) : (
                    rankingOrdenado.map((v, i) => (
                      <div key={v.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ border: "1px solid var(--cf2-border-default)" }}>
                        <div className="flex items-center justify-center rounded-full text-sm font-extrabold shrink-0" style={{ width: 28, height: 28, background: "var(--cf2-bg-surface-subtle)", color: "var(--cf2-text-primary)" }}>{i + 1}</div>
                        <div className="flex items-center justify-center rounded-full text-xs font-extrabold shrink-0" style={{ width: 36, height: 36, background: avatarColors[i], color: "var(--cf2-text-on-accent)" }}>
                          {v.nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{v.nome}</p>
                          <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>Meta: {brl2(v.valorAlvo)}</p>
                        </div>
                        <div className="flex flex-col gap-1 items-end w-[110px] shrink-0">
                          <p className="text-sm font-extrabold whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>{brl2(v.realizado)}</p>
                          <div className="rounded-full overflow-hidden h-1 w-full" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                            <div className="h-full" style={{ width: `${Math.min(v.pct, 100)}%`, background: "var(--cf2-success-fill)" }} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between p-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>Dado ao vivo</p>
                  <Link href="/relatorios" className="px-4 py-2 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}>
                    Ver Ranking Completo
                  </Link>
                </div>
              </Cf2Card>
            </div>
          </div>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "var(--cf2-text-primary)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Callface AI - Insights de Gestão</p>
                </div>
                <span className="px-2 py-1 rounded text-[10px] font-extrabold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-success-text)" }}>HEURÍSTICA</span>
              </div>
              <div className="flex flex-col gap-3">
                {insights.map((ins) => (
                  <div key={ins.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--cf2-text-on-accent)" }} />
                    <p className="flex-1 text-[13px]" style={{ color: "#000" }}>{ins.texto}</p>
                    {ins.acaoLabel && <Link href="/relatorios" className="text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--cf2-success-text)" }}>{ins.acaoLabel}</Link>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Funil de Leads */}
          <div className="flex flex-col gap-4">
            <Cf2SectionHeader title="Funil de Leads" subtitle="Progressão de leads por etapa do funil (snapshot atual)" />
            <div className="flex gap-2">
              <Cf2Card highlight="success" className="flex-1"><FunilCard label="Novos" total={funilLeads.novos} /></Cf2Card>
              <Cf2Card highlight="success" className="flex-1"><FunilCard label="Em Qualificação" total={funilLeads.emQualificacao} /></Cf2Card>
              <Cf2Card className="flex-1"><FunilCard label="Qualificados" total={funilLeads.qualificados} /></Cf2Card>
              <Cf2Card highlight="danger" className="flex-1"><FunilCard label="No Show" total={funilLeads.noShow} danger /></Cf2Card>
            </div>
          </div>

          {/* Pipeline Comercial */}
          <div className="flex flex-col gap-4">
            <Cf2SectionHeader title="Pipeline Comercial" subtitle="Distribuição e conversão por estágio do funil" />
            <div className="flex gap-2">
              {pipelineComercial.map((etapa, i) => (
                <Cf2Card key={etapa.label} highlight={i < 2 ? "success" : undefined} className="flex-1">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{etapa.label}</p>
                    <p className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{etapa.total} deals</p>
                  </div>
                  <p className="text-lg font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>{brl0(etapa.valor)}</p>
                  <Cf2UnavailableMetric reason="Conversão real precisa de coorte (mesmo negócio acompanhado no tempo) — snapshot atual não é confiável pra isso, ver ADR" />
                </Cf2Card>
              ))}
            </div>
          </div>

          {/* Atividades + Comunicações */}
          <div className="flex gap-8">
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div className="flex items-center justify-between">
                <Cf2Eyebrow>Minhas Atividades</Cf2Eyebrow>
                <Link href="/tarefas" className="text-[13px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Ver todas →</Link>
              </div>
              <div className="flex flex-col gap-2.5">
                {minhasTarefas.length === 0 ? (
                  <Cf2EmptyState title="Nenhuma tarefa pendente" description="Bom trabalho!" />
                ) : (
                  minhasTarefas.map((t) => {
                    const venc = tempoRelativo(t.dataVencimento ? new Date(t.dataVencimento) : null);
                    return (
                      <Cf2Card key={t.id} padding="12px">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-medium" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: "var(--cf2-text-secondary)" }}>{venc.texto}</span>
                              {venc.atrasado && <Cf2Badge variant="warning">Atrasado</Cf2Badge>}
                            </div>
                          </div>
                          <Link
                            href={t.negocioId ? `/negocios/${t.negocioId}` : t.leadId ? `/contatos/${t.leadId}` : "/tarefas"}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: "var(--cf2-bg-surface-subtle)", color: "var(--cf2-text-primary)" }}
                          >
                            {ACTION_BY_TIPO[t.tipo] || "Abrir"}
                          </Link>
                        </div>
                      </Cf2Card>
                    );
                  })
                )}
              </div>
            </div>
            <div className="w-[420px] shrink-0 flex flex-col gap-4">
              <Cf2Eyebrow>Comunicações</Cf2Eyebrow>
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
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Canais</p>
                <Link href="/whatsapp" className="text-[13px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Ver todas →</Link>
              </div>
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
        </>
      )}

      {tab === "pipeline" && (
        <div className="flex flex-col gap-4">
          <Cf2SectionHeader title="Pipeline" subtitle="Mesmo recorte comercial, foco só nas etapas abertas" />
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
        <div className="flex flex-col gap-4">
          <Cf2SectionHeader title="Pendências" subtitle={`${tarefasPendentesCount.length} tarefas atrasadas ou sem prazo, da organização toda`} />
          {tarefasPendentesCount.length === 0 ? (
            <Cf2EmptyState title="Nada pendente" description="Todas as tarefas da organização estão em dia." />
          ) : (
            <Cf2Card>
              <p className="text-sm" style={{ color: "var(--cf2-text-secondary)" }}>
                {tarefasPendentesCount.length} tarefa{tarefasPendentesCount.length === 1 ? "" : "s"} vencida{tarefasPendentesCount.length === 1 ? "" : "s"} ou sem data em toda a organização.
              </p>
              <Link href="/tarefas" className="text-sm font-semibold mt-2 inline-block" style={{ color: "var(--cf2-success-text)" }}>Ver todas em /tarefas →</Link>
            </Cf2Card>
          )}
        </div>
      )}
    </div>
  );
}

function FunilCard({ label, total, danger }: { label: string; total: number; danger?: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{label}</p>
        <Users className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
      </div>
      <p className="text-[28px] font-bold" style={{ color: danger ? "var(--cf2-danger-text)" : "var(--cf2-text-primary)" }}>{total}</p>
    </>
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
