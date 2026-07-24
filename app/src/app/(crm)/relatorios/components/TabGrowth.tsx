"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./charts/ChartCard";
import { MetaProgress } from "./MetaProgress";
import { AlertasCard, metaEmRisco, type AlertaUi } from "./AlertasCard";
import { Wallet, TrendingUp, Users, Briefcase, Megaphone, Coins, Target, Filter } from "lucide-react";

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
  contentStyle: { background: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 12, color: "#fff" },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
};

// Disciplina de cor (reforma 21/07): número SEMPRE branco; o accent vira um
// tique fino à esquerda e SÓ quando é status (lima/âmbar/vermelho) — cor de
// domínio decorativa foi removida de propósito.
const STATUS_ACCENTS = new Set(["#c8ff00", "#F59E0B", "#EF4444", "#10B981"]);
function Kpi({ label, value, sub, accent, icon: Icon }: { label: string; value: string; sub?: string; accent?: string; icon?: React.ComponentType<{ className?: string }> }) {
  const tick = accent && STATUS_ACCENTS.has(accent) ? accent : "rgba(255,255,255,0.16)";
  return (
    <div className="relative min-w-0 rounded-2xl border border-white/[0.07] overflow-hidden transition-colors hover:border-white/[0.12]" style={{ background: "var(--surface, #121212)" }}>
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: tick }} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium leading-snug pt-1">{label}</p>
          {Icon && (
            <span className="w-7 h-7 rounded-md border border-white/[0.12] flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-white/45" />
            </span>
          )}
        </div>
        <p className="text-[1.6rem] font-bold mt-2 tabular-nums leading-none break-words text-white" style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}>{value}</p>
        {sub && <p className="text-[11px] text-white/35 mt-2 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <span className="h-[3px] w-6 rounded-full" style={{ background: "rgba(255,255,255,0.16)" }} />
      <h3 className="text-[12px] uppercase tracking-[0.18em] text-white/60 font-semibold whitespace-nowrap">{children}</h3>
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
      <p className="text-[12px] text-white/40">Visão de growth para decisão. Use o período no topo da página pra analisar a janela que importa.</p>

      {isLoading ? (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 text-center text-[12px] text-white/40">Carregando…</div>
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
              className="relative min-w-0 rounded-2xl border border-white/[0.09] p-5 lg:p-6 overflow-hidden"
              style={{ background: "var(--surface-2, #1A1A1A)" }}
            >
              <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: "rgba(255,255,255,0.16)" }} />
              <div className="flex items-start justify-between gap-2 pl-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 font-medium pt-1.5">MRR ativo</p>
                <span className="w-9 h-9 rounded-lg border border-white/[0.12] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-white/45" />
                </span>
              </div>
              <p className="font-bold tabular-nums mt-2 pl-2 break-words" style={{ color: "#fff", fontFamily: "var(--font-heading)", fontSize: "clamp(1.8rem,3vw,2.6rem)", lineHeight: 1.05, letterSpacing: "-0.015em" }}>
                {brl(ret?.mrrAtivo ?? 0)}
              </p>
              <p className="text-[11px] text-white/40 mt-2 pl-2">{ret?.contratosAtivos ?? 0} contratos vigentes</p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 content-stretch">
              <Kpi label="MRR novo (período)" value={brl(r?.mrrNovoFechado ?? 0)} sub={`${f?.ganhos ?? 0} negócio(s) ganho(s)`} accent="#c8ff00" icon={TrendingUp} />
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
                      <span className="text-[12px] text-white/60 w-32 truncate">{c.origem}</span>
                      <div className="flex-1 h-5 rounded-md bg-white/[0.05] overflow-hidden">
                        <div className="h-5 rounded-md" style={{ width: `${(c.total / max) * 100}%`, background: "rgba(255,255,255,0.35)" }} />
                      </div>
                      <span className="text-[12px] text-white/70 w-10 text-right">{c.total}</span>
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
            <Kpi label="No-show" value={String(f?.noShow ?? 0)} accent="#F59E0B" />
            <Kpi label="Clientes" value={String(f?.ganhos ?? 0)} sub={pct(f?.taxaFechamento ?? null) + " do qualif."} accent="#10B981" />
          </div>
          {funilBars.length > 0 && (
            <ChartCard title="Conversão do pipeline" subtitle="Reunião → proposta → negociação → ganho" loading={false} empty={funilBars.length === 0} delay={0.1}>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funilBars} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...darkTooltip} formatter={(v) => [Number(v), "negócios"]} />
                    <Bar dataKey="valor" fill="rgba(255,255,255,0.45)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* RECEITA & EFICIÊNCIA */}
          <SectionTitle>Receita & eficiência</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi label="Receita fechada" value={brl(r?.receitaFechada ?? 0)} sub="no período" accent="#c8ff00" />
            <Kpi label="Win rate" value={pct(r?.winRate ?? null)} sub={r?.winAmostraPequena ? `base pequena · n=${r?.winN}` : `${r?.winN ?? 0} decididos`} accent={r?.winAmostraPequena ? "#F59E0B" : "#fff"} />
            <Kpi label="Ticket médio" value={r?.ticketMedio != null ? brl(r.ticketMedio) : "—"} />
            <Kpi label="Ciclo médio" value={r?.cicloMedio != null ? `${r.cicloMedio}d` : "—"} sub="até fechar" />
            <Kpi label="Fechamento" value={pct(f?.taxaFechamento ?? null)} sub="qualificado → cliente" accent="#10B981" />
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
                      <span className="text-[12px] text-white/60 w-36 truncate">{STAGE_LABELS[e.status] ?? e.status}</span>
                      <div className="flex-1 h-5 rounded-md bg-white/[0.05] overflow-hidden">
                        <div className="h-5 rounded-md" style={{ width: `${(e.valor / max) * 100}%`, background: "rgba(255,255,255,0.35)" }} />
                      </div>
                      <span className="text-[12px] text-white/70 w-24 text-right">{brl(e.valor)}</span>
                      <span className="text-[11px] text-white/30 w-8 text-right">{e.count}</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
            <ChartCard title="Negócios esfriando" subtitle="Abertos parados há dias — risco de morrer" loading={false} empty={(p?.esfriando?.length ?? 0) === 0} emptyText="Pipeline em dia" delay={0.14}>
              <div className="space-y-1.5 py-1">
                {(p?.esfriando ?? []).slice(0, 10).map((n) => (
                  <div key={n.id} className="flex items-center gap-3 py-1">
                    <span className="text-[12px] text-white/70 flex-1 truncate">{n.titulo}</span>
                    <span className="text-[11px] text-white/40">{brl(n.valor)}</span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: n.diasParado >= 14 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", color: n.diasParado >= 14 ? "#EF4444" : "#F59E0B" }}>
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
            <Kpi label="No-show" value={String(data?.time.sdr.noShow ?? 0)} accent="#F59E0B" />
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>Closers no período</h3>
            </div>
            {(data?.time.closers?.length ?? 0) === 0 ? (
              <div className="px-4 py-6 text-center text-white/30 text-sm">Nenhum fechamento no período</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-y border-white/[0.06] text-[10px] uppercase tracking-wider text-white/40">
                      <th className="text-left font-medium px-4 py-2.5">Closer</th>
                      <th className="text-right font-medium px-3 py-2.5">Ganhos</th>
                      <th className="text-right font-medium px-3 py-2.5">Perdidos</th>
                      <th className="text-right font-medium px-3 py-2.5">Win rate</th>
                      <th className="text-right font-medium px-4 py-2.5">Receita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(data?.time.closers ?? []).map((m) => (
                      <tr key={m.nome} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-white/80 font-medium truncate max-w-[160px]">{m.nome}</td>
                        <td className="px-3 py-2.5 text-right text-[#c8ff00] font-semibold">{m.ganhos}</td>
                        <td className="px-3 py-2.5 text-right text-white/40">{m.perdidos}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: (m.winRate ?? 0) >= 30 ? "#10B981" : "#F59E0B" }}>{pct(m.winRate)}</td>
                        <td className="px-4 py-2.5 text-right text-[#e23752] font-semibold">{brl(m.receita)}</td>
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
