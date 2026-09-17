"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChartCard } from "./charts/ChartCard";
import { MetaProgress } from "./MetaProgress";

interface GanhoItem { id: string; titulo: string; leadNome: string | null; leadEmpresa: string | null; mrrFechado: string | null; valorTotal: string | null; tipoReceita: string | null; ganhoAt: string | null }
interface FunilEtapa { status: string; label: string; atingiu: number; taxaDoAnterior: number | null }
interface WinRateInfo { ganhos: number; perdidos: number; n: number; taxa: number | null; amostraPequena: boolean }
interface MotivoItem { motivo: string; count: number; pct: number }
interface Esfriando { id: string; titulo: string; status: string; valor: number; diasParado: number }
interface ComercialCloser {
  funilConversao: { etapas: FunilEtapa[] };
  winRateInfo: WinRateInfo;
  motivosInfo: { itens: MotivoItem[]; total: number; semClassificacao: number; semClassificacaoPct: number };
  fechado: { ganhos: number; receita: number; recorrente: number; avulso: number };
  cicloMedio: number | null;
  ticketMedio: number | null;
  pipelineEsfriando: Esfriando[];
  ganhosList?: GanhoItem[];
}
interface MetaRow { tipo: string; valorAlvo: string | number; realizado: number }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function TabComercialCloser({ periodo }: { periodo: string }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const { data: com, isLoading } = useQuery<ComercialCloser>({
    queryKey: ["relatorios", "comercial-closer", periodo],
    queryFn: () => fetch(`/api/relatorios/comercial?periodo=${periodo}`).then((r) => r.json()),
  });

  const { data: metasData } = useQuery<{ metas: MetaRow[] }>({
    queryKey: ["metas-closer", userId, mesAtualISO()],
    enabled: !!userId,
    queryFn: () => fetch(`/api/metas/usuario/${userId}?periodo=${mesAtualISO()}`).then((r) => r.json()),
  });
  const metaMrr = metasData?.metas?.find((m) => m.tipo === "mrr_fechado");

  const etapas = com?.funilConversao?.etapas ?? [];
  const maxFunil = Math.max(...etapas.map((e) => e.atingiu), 1);
  const wr = com?.winRateInfo;

  return (
    <div className="space-y-4">
      {/* Meta do mês (north-star do closer = MRR fechado) */}
      {metaMrr ? (
        <MetaProgress tipo="mrr_fechado" valorAlvo={Number(metaMrr.valorAlvo)} realizado={Number(metaMrr.realizado) || 0} label="Minha meta do mês (MRR fechado)" />
      ) : (
        <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4 text-[12px] text-[var(--cf2-text-tertiary)]">
          Nenhuma meta de MRR definida pra este mês. Peça ao admin pra configurar em Admin · Usuários.
        </div>
      )}

      {/* Mini KPIs pessoais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4">
          <p className="text-[11px] text-[var(--cf2-text-tertiary)] uppercase tracking-wider font-medium">Fechado (período)</p>
          <p className="text-2xl font-bold text-[var(--cf2-success-text)] mt-2" style={{ fontFamily: "var(--cf2-font-heading)" }}>{isLoading ? "..." : brl(com?.fechado?.receita ?? 0)}</p>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">{com?.fechado?.ganhos ?? 0} negócio(s)</p>
        </div>
        <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4">
          <p className="text-[11px] text-[var(--cf2-text-tertiary)] uppercase tracking-wider font-medium">Win Rate</p>
          <p className="text-2xl font-bold text-[var(--cf2-text-primary)] mt-2" style={{ fontFamily: "var(--cf2-font-heading)" }}>{isLoading ? "..." : wr?.taxa != null ? `${wr.taxa}%` : "n/a"}</p>
          <p className="text-[10px] mt-1" style={{ color: wr?.amostraPequena ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }}>
            {wr?.amostraPequena ? `base pequena · n=${wr.n}` : `${wr?.n ?? 0} decididos`}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4">
          <p className="text-[11px] text-[var(--cf2-text-tertiary)] uppercase tracking-wider font-medium">Ciclo médio</p>
          <p className="text-2xl font-bold text-[var(--cf2-text-primary)] mt-2" style={{ fontFamily: "var(--cf2-font-heading)" }}>{isLoading ? "..." : com?.cicloMedio != null ? `${com.cicloMedio}d` : "—"}</p>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">até fechar</p>
        </div>
        <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4">
          <p className="text-[11px] text-[var(--cf2-text-tertiary)] uppercase tracking-wider font-medium">Ticket médio</p>
          <p className="text-2xl font-bold text-[var(--cf2-text-primary)] mt-2" style={{ fontFamily: "var(--cf2-font-heading)" }}>{isLoading ? "..." : com?.ticketMedio != null ? brl(com.ticketMedio) : "—"}</p>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">por negócio ganho</p>
        </div>
      </div>

      {/* Histórico do que foi FECHADO — clica e abre o negócio ganho */}
      <ChartCard title="Fechados no período" subtitle="O que de fato virou ganho. Clique para abrir o negócio." loading={isLoading} empty={(com?.ganhosList?.length ?? 0) === 0} emptyText="Nenhum negócio fechado no período" delay={0.05}>
        <div className="py-1">
          {(com?.ganhosList ?? []).map((g) => {
            const mrr = parseFloat(g.mrrFechado || "0");
            const rec = g.tipoReceita !== "avulso" && mrr > 0;
            const val = rec ? mrr : parseFloat(g.valorTotal || "0");
            return (
              <Link key={g.id} href={`/negocios/${g.id}`}
                className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)] transition-colors">
                <span className="text-[13px] text-[var(--cf2-text-primary)] flex-1 truncate">{g.leadEmpresa || g.leadNome || g.titulo}</span>
                <span className="text-[11px] text-[var(--cf2-text-tertiary)] hidden sm:block">{g.ganhoAt ? new Date(g.ganhoAt).toLocaleDateString("pt-BR") : ""}</span>
                <span className="text-[13px] font-semibold text-[var(--cf2-success-text)] text-right whitespace-nowrap">
                  {brl(val)}{rec ? <span className="text-[10px] text-[var(--cf2-text-tertiary)] font-normal">/mês</span> : null}
                </span>
              </Link>
            );
          })}
        </div>
      </ChartCard>

      {/* Meu funil — onde estou perdendo */}
      <ChartCard title="Meu funil" subtitle="Reunião → proposta → fechado, com a conversão de cada passo" loading={isLoading} empty={etapas.length === 0} delay={0.1}>
        <div className="space-y-2 py-1">
          {etapas.map((e) => (
            <div key={e.status} className="flex items-center gap-3">
              <span className="text-[12px] text-[var(--cf2-text-secondary)] w-40 truncate">{e.label}</span>
              <div className="flex-1 h-6 rounded-md bg-[var(--cf2-bg-surface-muted)] overflow-hidden">
                <div className="h-6 rounded-md transition-all duration-500" style={{ width: `${(e.atingiu / maxFunil) * 100}%`, background: e.status === "ganho" ? "var(--cf2-success-text)" : "#3B82F6" }} />
              </div>
              <span className="text-[12px] text-[var(--cf2-text-secondary)] w-10 text-right">{e.atingiu}</span>
              <span className="text-[11px] w-14 text-right" style={{ color: e.taxaDoAnterior == null ? "var(--cf2-text-tertiary)" : e.taxaDoAnterior >= 50 ? "#10B981" : "var(--cf2-warning-text)" }}>
                {e.taxaDoAnterior == null ? "" : `${e.taxaDoAnterior}%`}
              </span>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Por que EU perco */}
        <ChartCard title="Por que perco" subtitle="Motivos dos meus negócios perdidos" loading={isLoading} empty={(com?.motivosInfo?.itens?.length ?? 0) === 0} emptyText="Nenhum negócio perdido no período" delay={0.15}>
          <div className="space-y-2 py-1">
            {com?.motivosInfo?.semClassificacaoPct ? (
              <p className="text-[11px] mb-2" style={{ color: "var(--cf2-warning-text)" }}>
                {com.motivosInfo.semClassificacaoPct}% sem motivo classificado — registre o motivo pra enxergar o padrão.
              </p>
            ) : null}
            {(com?.motivosInfo?.itens ?? []).map((m) => (
              <div key={m.motivo} className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--cf2-text-secondary)] flex-1 truncate">{m.motivo}</span>
                <div className="w-28 h-2 rounded-full bg-[var(--cf2-bg-surface-muted)] overflow-hidden">
                  <div className="h-2 rounded-full bg-[var(--cf2-danger-text)]" style={{ width: `${m.pct}%` }} />
                </div>
                <span className="text-[12px] text-[var(--cf2-text-secondary)] w-8 text-right">{m.count}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Pipeline esfriando — o que cobrar */}
        <ChartCard title="Esfriando" subtitle="Meus negócios abertos parados há dias" loading={isLoading} empty={(com?.pipelineEsfriando?.length ?? 0) === 0} emptyText="Nada parado — pipeline em dia" delay={0.2}>
          <div className="space-y-1.5 py-1">
            {(com?.pipelineEsfriando ?? []).map((n) => (
              <div key={n.id} className="flex items-center gap-3 py-1">
                <span className="text-[12px] text-[var(--cf2-text-secondary)] flex-1 truncate">{n.titulo}</span>
                <span className="text-[11px] text-[var(--cf2-text-tertiary)]">{brl(n.valor)}</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: n.diasParado >= 14 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", color: n.diasParado >= 14 ? "var(--cf2-danger-text)" : "var(--cf2-warning-text)" }}>
                  {n.diasParado}d parado
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
