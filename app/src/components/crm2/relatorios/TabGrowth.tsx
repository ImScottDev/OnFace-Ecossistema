"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./charts/ChartCard";
import { MetaProgress } from "./MetaProgress";
import { AlertasCard, metaEmRisco, type AlertaUi } from "./AlertasCard";
import { Wallet, TrendingUp, Users, Briefcase, Megaphone, Coins, Target, Filter } from "lucide-react";
import { TIQUE_NEUTRO } from "./paleta";

const STAGE_LABELS: Record<string, string> = {
  reuniao_agendada: "Reunião Agendada",
  reuniao_realizada: "Reunião Realizada",
  trial: "Trial",
  proposta_apresentada: "Proposta",
  negociacao_iniciada: "Negociação",
};

/**
 * Aba Growth — visão de CEO/estratégia. Agrega aquisição + funil + receita +
 * pipeline + retenção + time pra decisão. Fonte: GET /api/relatorios/growth.
 * Período vem da página (compartilhado com as outras abas).
 */

interface FunilEtapa { status: string; label: string; atingiu: number; taxaDoAnterior: number | null }
interface EtapaPipeline { status: string; count: number; recorrente: number; avulso: number; valor: number }
interface Esfriando { id: string; titulo: string; valor: number; diasParado: number }
interface CloserRow { nome: string; ganhos: number; perdidos: number; receita: number; winRate: number | null }

interface GrowthData {
  aquisicao: {
    leads: number; leadsDelta: number | null;
    porCanal: { origem: string; total: number }[];
    midia: { gasto: number; leadsPagos: number; cpl: number | null; configurado: boolean };
    cac: number | null;
  };
  funil: {
    leads: number; qualificados: number; reunioesAgendadas: number; reunioesRealizadas: number;
    noShow: number; ganhos: number; taxaQualificacao: number | null; taxaFechamento: number | null;
    etapas: FunilEtapa[];
  };
  receita: {
    mrrNovoFechado: number; receitaFechada: number; mrrAtivo: number;
    ticketMedio: number | null; cicloMedio: number | null;
    winRate: number | null; winN: number; winAmostraPequena: boolean;
  };
  pipeline: { total: number; ponderado: number; negociosAbertos: number; etapas: EtapaPipeline[]; esfriando: Esfriando[] };
  retencao: {
    mrrAtivo: number; contratosAtivos: number; npsMedia: number | null; nps: number | null;
    npsDistrib: { promotores: number; neutros: number; detratores: number };
    contratosVencendo: { count: number; mrr: number };
  };
  time: { sdr: { agendadas: number; realizadas: number; noShow: number }; closers: CloserRow[] };
  metaComercial: { valorAlvo: number; realizado: number; closers: number } | null;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number | null) => (v == null ? "—" : `${v}%`);

const darkTooltip = {
  contentStyle: { background: "rgba(15,15,20,0.95)", border: "1px solid var(--cf2-border-default)", borderRadius: 10, fontSize: 12, color: "#fff" },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "var(--cf2-text-secondary)", fontSize: 11 },
};

// Disciplina de cor (reforma 21/07): número SEMPRE branco; o accent vira um
// tique fino à esquerda e SÓ quando é status (lima/âmbar/vermelho) — cor de
// domínio decorativa foi removida de propósito.
const STATUS_ACCENTS = new Set(["var(--cf2-success-text)", "var(--cf2-warning-text)", "var(--cf2-danger-text)"]);
function Kpi({ label, value, sub, accent, icon: Icon }: { label: string; value: string; sub?: string; accent?: string; icon?: React.ComponentType<{ className?: string }> }) {
  const tick = accent && STATUS_ACCENTS.has(accent) ? accent : TIQUE_NEUTRO;
  return (
    <div className="relative min-w-0 rounded-2xl border border-[var(--cf2-border-default)] overflow-hidden transition-colors hover:border-[var(--cf2-border-default)]" style={{ background: "var(--cf2-bg-surface)" }}>
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: tick }} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--cf2-text-tertiary)] font-medium leading-snug pt-1">{label}</p>
          {Icon && (
            <span className="w-7 h-7 rounded-md border border-[var(--cf2-border-default)] flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
            </span>
          )}
        </div>
        <p className="text-[1.6rem] font-bold mt-2 tabular-nums leading-none break-words text-[var(--cf2-text-primary)]" style={{ fontFamily: "var(--cf2-font-heading)", letterSpacing: "-0.01em" }}>{value}</p>
        {sub && <p className="text-[11px] text-[var(--cf2-text-tertiary)] mt-2 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <span className="h-[3px] w-6 rounded-full" style={{ background: TIQUE_NEUTRO }} />
      <h3 className="text-[12px] uppercase tracking-[0.18em] text-[var(--cf2-text-secondary)] font-semibold whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}

export default function TabGrowth({ periodo }: { periodo: string }) {
  const { data, isLoading } = useQuery<GrowthData>({
    queryKey: ["relatorios", "growth", periodo],
    queryFn: () => fetch(`/api/relatorios/growth?periodo=${periodo}`).then((r) => r.json()),
  });

  const a = data?.aquisicao;
  const f = data?.funil;
  const r = data?.receita;
  const p = data?.pipeline;
  const ret = data?.retencao;
  const meta = data?.metaComercial;

  const funilBars = (f?.etapas ?? []).map((e) => ({ label: e.label, valor: e.atingiu }));
  const aquisicaoCanal = (a?.porCanal ?? []).slice(0, 8);

  // ── Alertas acionáveis (derivados dos dados já carregados — "bata o olho e saiba o que fazer") ──
  const alertas: AlertaUi[] = [];
  if (data) {
    const mr = meta ? metaEmRisco(meta.valorAlvo, meta.realizado) : null;
    if (mr) alertas.push(mr);
    // gargalo = pior conversão entre etapas do pipeline (ignora a 1ª, que não tem anterior)
    const gargalo = (f?.etapas ?? []).filter((e) => e.taxaDoAnterior != null).sort((x, y) => (x.taxaDoAnterior ?? 100) - (y.taxaDoAnterior ?? 100))[0];
    if (gargalo && (gargalo.taxaDoAnterior ?? 100) < 40) {
      alertas.push({ nivel: "amarelo", texto: `Gargalo do funil: só ${gargalo.taxaDoAnterior}% chegam em "${gargalo.label}" — é aí que os negócios morrem.` });
    }
    const esfriando = p?.esfriando ?? [];
    if (esfriando.length >= 5) {
      const valorParado = esfriando.reduce((s, n) => s + n.valor, 0);
      alertas.push({ nivel: "vermelho", texto: `${esfriando.length} negócios parados há 5+ dias (${brl(valorParado)} em risco no pipeline) — ver lista abaixo.` });
    }
    const ag = f?.reunioesAgendadas ?? 0;
    const ns = f?.noShow ?? 0;
    if (ag >= 10 && ns / ag > 0.25) {
      alertas.push({ nivel: "amarelo", texto: `No-show alto: ${ns} de ${ag} reuniões (${Math.round((ns / ag) * 100)}%) — reforçar confirmação na véspera.` });
    }
    if (r?.winAmostraPequena) alertas.push({ nivel: "amarelo", texto: `Win rate com base pequena (n=${r.winN}) — não usar pra decisão ainda.` });
  }

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-[var(--cf2-text-tertiary)]">Visão de growth para decisão. Use o período no topo da página pra analisar a janela que importa.</p>

      {isLoading ? (
        <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-8 text-center text-[12px] text-[var(--cf2-text-tertiary)]">Carregando…</div>
      ) : (
        <>
          {/* O que fazer agora — antes de qualquer número */}
          <AlertasCard alertas={alertas} />

          {/* Meta comercial do mês */}
          {meta && meta.valorAlvo > 0 && (
            <MetaProgress tipo="mrr_fechado" valorAlvo={meta.valorAlvo} realizado={meta.realizado} label={`Meta comercial do mês · soma de ${meta.closers} closer${meta.closers === 1 ? "" : "s"}`} />
          )}

          {/* North-star: MRR ativo dominante + apoio */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div
              className="relative min-w-0 rounded-2xl border border-[var(--cf2-border-default)] p-5 lg:p-6 overflow-hidden"
              style={{ background: "var(--cf2-bg-surface-muted)" }}
            >
              <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: TIQUE_NEUTRO }} />
              <div className="flex items-start justify-between gap-2 pl-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--cf2-text-secondary)] font-medium pt-1.5">MRR ativo</p>
                <span className="w-9 h-9 rounded-lg border border-[var(--cf2-border-default)] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />
                </span>
              </div>
              <p className="font-bold tabular-nums mt-2 pl-2 break-words" style={{ color: "#fff", fontFamily: "var(--cf2-font-heading)", fontSize: "clamp(1.8rem,3vw,2.6rem)", lineHeight: 1.05, letterSpacing: "-0.015em" }}>
                {brl(ret?.mrrAtivo ?? 0)}
              </p>
              <p className="text-[11px] text-[var(--cf2-text-tertiary)] mt-2 pl-2">{ret?.contratosAtivos ?? 0} contratos vigentes</p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 content-stretch">
              <Kpi label="MRR novo (período)" value={brl(r?.mrrNovoFechado ?? 0)} sub={`${f?.ganhos ?? 0} negócio(s) ganho(s)`} accent="var(--cf2-success-text)" icon={TrendingUp} />
              <Kpi label="Leads (período)" value={String(a?.leads ?? 0)} sub={a?.leadsDelta != null ? `${a.leadsDelta > 0 ? "+" : ""}${a.leadsDelta}% vs anterior` : "sem base p/ comparar"} icon={Users} />
              <Kpi label="Pipeline aberto" value={brl(p?.total ?? 0)} sub={`forecast ${brl(p?.ponderado ?? 0)}`} icon={Briefcase} />
            </div>
          </div>

          {/* AQUISIÇÃO */}
          <SectionTitle>Aquisição</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Investimento (mídia)" value={a?.midia.configurado ? brl(a.midia.gasto) : "—"} sub={a?.midia.configurado ? `${a.midia.leadsPagos} leads pagos` : "Meta não configurado"} icon={Megaphone} />
            <Kpi label="CPL" value={a?.midia.cpl != null ? brl(a.midia.cpl) : "—"} sub="custo por lead (mídia)" icon={Coins} />
            <Kpi label="CAC" value={a?.cac != null ? brl(a.cac) : "—"} sub="custo por cliente ganho" icon={Target} />
            <Kpi label="Qualificação" value={pct(f?.taxaQualificacao ?? null)} sub="leads → qualificado" icon={Filter} />
          </div>
          {aquisicaoCanal.length > 0 && (
            <ChartCard title="Leads por canal" subtitle="De onde vem a demanda no período" loading={false} empty={aquisicaoCanal.length === 0} delay={0.05}>
              <div className="space-y-2 py-1">
                {aquisicaoCanal.map((c) => {
                  const max = Math.max(...aquisicaoCanal.map((x) => x.total), 1);
                  return (
                    <div key={c.origem} className="flex items-center gap-3">
                      <span className="text-[12px] text-[var(--cf2-text-secondary)] w-32 truncate">{c.origem}</span>
                      <div className="flex-1 h-5 rounded-md bg-[var(--cf2-bg-surface-muted)] overflow-hidden">
                        <div className="h-5 rounded-md" style={{ width: `${(c.total / max) * 100}%`, background: "var(--cf2-text-tertiary)" }} />
                      </div>
                      <span className="text-[12px] text-[var(--cf2-text-secondary)] w-10 text-right">{c.total}</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          )}

          {/* FUNIL COMPLETO */}
          <SectionTitle>Funil completo</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Kpi label="Leads" value={String(f?.leads ?? 0)} />
            <Kpi label="Qualificados" value={String(f?.qualificados ?? 0)} sub="marcou call" accent="#8e27ef" />
            <Kpi label="Reun. agendadas" value={String(f?.reunioesAgendadas ?? 0)} />
            <Kpi label="Reun. realizadas" value={String(f?.reunioesRealizadas ?? 0)} accent="#3B82F6" />
            <Kpi label="No-show" value={String(f?.noShow ?? 0)} accent="var(--cf2-warning-text)" />
            <Kpi label="Clientes" value={String(f?.ganhos ?? 0)} sub={pct(f?.taxaFechamento ?? null) + " do qualif."} accent="var(--cf2-success-text)" />
          </div>
          {funilBars.length > 0 && (
            <ChartCard title="Conversão do pipeline" subtitle="Reunião → proposta → negociação → ganho" loading={false} empty={funilBars.length === 0} delay={0.1}>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funilBars} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--cf2-bg-surface-muted)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "var(--cf2-text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fill: "var(--cf2-text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...darkTooltip} formatter={(v) => [Number(v), "negócios"]} />
                    <Bar dataKey="valor" fill="var(--cf2-text-tertiary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* RECEITA & EFICIÊNCIA */}
          <SectionTitle>Receita & eficiência</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi label="Receita fechada" value={brl(r?.receitaFechada ?? 0)} sub="no período" accent="var(--cf2-success-text)" />
            <Kpi label="Win rate" value={pct(r?.winRate ?? null)} sub={r?.winAmostraPequena ? `base pequena · n=${r?.winN}` : `${r?.winN ?? 0} decididos`} accent={r?.winAmostraPequena ? "var(--cf2-warning-text)" : "#fff"} />
            <Kpi label="Ticket médio" value={r?.ticketMedio != null ? brl(r.ticketMedio) : "—"} />
            <Kpi label="Ciclo médio" value={r?.cicloMedio != null ? `${r.cicloMedio}d` : "—"} sub="até fechar" />
            <Kpi label="Fechamento" value={pct(f?.taxaFechamento ?? null)} sub="qualificado → cliente" accent="var(--cf2-success-text)" />
          </div>

          {/* PIPELINE & FORECAST */}
          <SectionTitle>Pipeline & forecast</SectionTitle>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Pipeline por etapa" subtitle="Valor aberto em cada estágio (snapshot)" loading={false} empty={(p?.etapas?.length ?? 0) === 0} delay={0.12}>
              <div className="space-y-2 py-1">
                {(p?.etapas ?? []).map((e) => {
                  const max = Math.max(...(p?.etapas ?? []).map((x) => x.valor), 1);
                  return (
                    <div key={e.status} className="flex items-center gap-3">
                      <span className="text-[12px] text-[var(--cf2-text-secondary)] w-36 truncate">{STAGE_LABELS[e.status] ?? e.status}</span>
                      <div className="flex-1 h-5 rounded-md bg-[var(--cf2-bg-surface-muted)] overflow-hidden">
                        <div className="h-5 rounded-md" style={{ width: `${(e.valor / max) * 100}%`, background: "var(--cf2-text-tertiary)" }} />
                      </div>
                      <span className="text-[12px] text-[var(--cf2-text-secondary)] w-24 text-right">{brl(e.valor)}</span>
                      <span className="text-[11px] text-[var(--cf2-text-tertiary)] w-8 text-right">{e.count}</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
            <ChartCard title="Negócios esfriando" subtitle="Abertos parados há dias — risco de morrer" loading={false} empty={(p?.esfriando?.length ?? 0) === 0} emptyText="Pipeline em dia" delay={0.14}>
              <div className="space-y-1.5 py-1">
                {(p?.esfriando ?? []).slice(0, 10).map((n) => (
                  <div key={n.id} className="flex items-center gap-3 py-1">
                    <span className="text-[12px] text-[var(--cf2-text-secondary)] flex-1 truncate">{n.titulo}</span>
                    <span className="text-[11px] text-[var(--cf2-text-tertiary)]">{brl(n.valor)}</span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: n.diasParado >= 14 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", color: n.diasParado >= 14 ? "var(--cf2-danger-text)" : "var(--cf2-warning-text)" }}>
                      {n.diasParado}d
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* TIME */}
          <SectionTitle>Time</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Reuniões agendadas" value={String(data?.time.sdr.agendadas ?? 0)} sub="SDR (período)" />
            <Kpi label="Realizadas" value={String(data?.time.sdr.realizadas ?? 0)} accent="#3B82F6" />
            <Kpi label="No-show" value={String(data?.time.sdr.noShow ?? 0)} accent="var(--cf2-warning-text)" />
          </div>
          <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-[var(--cf2-text-primary)]" style={{ fontFamily: "var(--cf2-font-heading)" }}>Closers no período</h3>
            </div>
            {(data?.time.closers?.length ?? 0) === 0 ? (
              <div className="px-4 py-6 text-center text-[var(--cf2-text-tertiary)] text-sm">Nenhum fechamento no período</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-y border-[var(--cf2-border-default)] text-[10px] uppercase tracking-wider text-[var(--cf2-text-tertiary)]">
                      <th className="text-left font-medium px-4 py-2.5">Closer</th>
                      <th className="text-right font-medium px-3 py-2.5">Ganhos</th>
                      <th className="text-right font-medium px-3 py-2.5">Perdidos</th>
                      <th className="text-right font-medium px-3 py-2.5">Win rate</th>
                      <th className="text-right font-medium px-4 py-2.5">Receita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(data?.time.closers ?? []).map((m) => (
                      <tr key={m.nome} className="hover:bg-[var(--cf2-bg-surface)] transition-colors">
                        <td className="px-4 py-2.5 text-[var(--cf2-text-primary)] font-medium truncate max-w-[160px]">{m.nome}</td>
                        <td className="px-3 py-2.5 text-right text-[var(--cf2-success-text)] font-semibold">{m.ganhos}</td>
                        <td className="px-3 py-2.5 text-right text-[var(--cf2-text-tertiary)]">{m.perdidos}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: (m.winRate ?? 0) >= 30 ? "var(--cf2-success-text)" : "var(--cf2-warning-text)" }}>{pct(m.winRate)}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--cf2-accent)] font-semibold">{brl(m.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
