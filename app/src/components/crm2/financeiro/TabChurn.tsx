"use client";

import { useQuery } from "@tanstack/react-query";
import { Cf2Skeleton, Cf2ErrorState, Cf2EmptyState } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";
import { FinPainel, FinPulso, FinStat, COR_FILL } from "./pecas";
import { fmt, fmtData } from "./fmt";

type Mes = { mes: string; logos: number; mrr: number; voluntarios: number; involuntarios: number; semMotivo: number };

const CATEGORIA: Record<string, { label: string; bg: string; cor: string }> = {
  involuntario: { label: "Cartão recusado", bg: "#fde8e8", cor: "#b91c1c" },
  voluntario: { label: "Cliente cancelou", bg: "var(--cf2-warning-bg)", cor: "#b45309" },
  sem_motivo: { label: "Sem motivo", bg: "#f1f5f9", cor: "#475569" },
};

/**
 * Churn e cancelamentos — portada de `(crm)/financeiro/components/TabChurn`
 * (09/09/2026). Involuntário é problema de COBRANÇA (dunning); voluntário é
 * problema de PRODUTO. A tela mantém os dois separados porque a decisão que
 * cada um exige é diferente. Mesma rota (`/api/financeiro/churn?meses=6`).
 */
export function TabChurn({ onAbrirLead }: { onAbrirLead: (leadId: string) => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["fin-churn"],
    queryFn: async () => {
      const r = await fetch("/api/financeiro/churn?meses=6");
      if (!r.ok) throw new Error("Falha ao carregar o churn");
      return r.json();
    },
  });

  if (isError) return <Cf2ErrorState message="Não foi possível carregar os dados de churn." />;
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3">
        <Cf2Skeleton className="h-32" />
        <Cf2Skeleton className="h-44" />
      </div>
    );
  }

  const tendencia: Mes[] = data.tendencia ?? [];
  const mesAtual = new Date().toISOString().slice(0, 7);
  const doMes = tendencia.find((t) => t.mes === mesAtual)
    ?? { mes: mesAtual, logos: 0, mrr: 0, voluntarios: 0, involuntarios: 0, semMotivo: 0 };
  const maxMes = Math.max(...tendencia.map((t) => t.logos), 1);
  const ALTURA = 96;

  return (
    <div className="flex flex-col gap-4">
      <FinPulso
        label="MRR perdido no mês"
        valor={fmt(doMes.mrr)}
        tom="critico"
        sub={`${doMes.logos} assinaturas canceladas em ${mesAtual}`}
      >
        <FinStat label="Involuntário (cartão)" valor={doMes.involuntarios} sub="recuperável com nova tentativa de cobrança" tom="critico" />
        <FinStat label="Voluntário" valor={doMes.voluntarios} sub="o cliente pediu — conversa de produto" tom="atencao" />
        <FinStat label="Sem motivo registrado" valor={doMes.semMotivo} sub="cancelamentos anteriores à captura de motivo" />
        <FinStat
          label="Total em 6 meses"
          valor={tendencia.reduce((a, t) => a + t.logos, 0)}
          sub={`${fmt(tendencia.reduce((a, t) => a + t.mrr, 0))} de MRR`}
        />
      </FinPulso>

      <FinPainel
        titulo="Tendência mensal"
        dica="cancelamentos por mês, empilhados por categoria"
        corpoClassName="p-4"
      >
        <div className="flex items-end gap-3" style={{ height: 150 }}>
          {tendencia.map((t) => (
            <div key={t.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[11px] tabular-nums whitespace-nowrap font-medium" style={{ color: "var(--cf2-text-secondary)" }}>{t.logos}</span>
              <div
                className="w-full max-w-14 flex flex-col justify-end"
                style={{ height: ALTURA }}
                title={`${t.mes}: ${t.involuntarios} por cartão, ${t.voluntarios} voluntários, ${t.semMotivo} sem motivo`}
              >
                <div className="w-full rounded-t-sm" style={{ height: (t.involuntarios / maxMes) * ALTURA, background: COR_FILL.critico }} />
                <div className="w-full" style={{ height: (t.voluntarios / maxMes) * ALTURA, background: COR_FILL.atencao }} />
                <div className="w-full rounded-b-sm" style={{ height: (t.semMotivo / maxMes) * ALTURA, background: "var(--cf2-border-default)" }} />
              </div>
              <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                {t.mes.slice(5)}/{t.mes.slice(2, 4)}
              </span>
            </div>
          ))}
        </div>
        {/* A legenda não existia: as três cores empilhadas não diziam o que eram. */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          {[
            { cor: COR_FILL.critico, texto: "Cartão recusado" },
            { cor: COR_FILL.atencao, texto: "Cliente cancelou" },
            { cor: "var(--cf2-border-default)", texto: "Sem motivo" },
          ].map((l) => (
            <li key={l.texto} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              <span aria-hidden className="size-2.5 rounded-sm shrink-0" style={{ background: l.cor }} />
              {l.texto}
            </li>
          ))}
        </ul>
      </FinPainel>

      <FinPainel
        titulo="Cancelamentos"
        dica="o motivo vem do Stripe (cancellation_details)"
      >
        {(data.lista ?? []).length === 0 ? (
          <div className="p-6"><Cf2EmptyState title="Nenhum cancelamento no período" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Cf2Table className="min-w-[880px]">
              <Cf2TableHeader>
                <Cf2TableRow>
                  <Cf2TableHead>Cliente</Cf2TableHead>
                  <Cf2TableHead>Plano</Cf2TableHead>
                  <Cf2TableHead className="text-right">MRR perdido</Cf2TableHead>
                  <Cf2TableHead className="text-center">Cancelou em</Cf2TableHead>
                  <Cf2TableHead className="text-right">Vida (meses)</Cf2TableHead>
                  <Cf2TableHead className="text-right">Total pago</Cf2TableHead>
                  <Cf2TableHead>Motivo</Cf2TableHead>
                </Cf2TableRow>
              </Cf2TableHeader>
              <Cf2TableBody>
                {data.lista.map((r: {
                  id: string; leadId: string | null; nome: string | null; empresa: string | null;
                  plano: string; mrr: number; canceladaEm: string; mesesDeVida: number;
                  totalPago: number; motivo: string | null; categoria: string;
                }) => {
                  const cat = CATEGORIA[r.categoria] || CATEGORIA.sem_motivo;
                  return (
                    <Cf2TableRow
                      key={r.id}
                      onClick={() => r.leadId && onAbrirLead(r.leadId)}
                      className={r.leadId ? "cursor-pointer transition-colors hover:bg-[var(--cf2-bg-surface-muted)]" : undefined}
                    >
                      <Cf2TableCell className="text-[12.5px]" style={{ color: "var(--cf2-text-primary)" }}>
                        {r.empresa || r.nome || "cliente sem lead"}
                      </Cf2TableCell>
                      <Cf2TableCell className="text-[11.5px] truncate max-w-[180px]" style={{ color: "var(--cf2-text-secondary)" }}>
                        {r.plano}
                      </Cf2TableCell>
                      <Cf2TableCell className="text-right text-[12.5px] font-medium tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-danger-text)" }}>
                        {fmt(r.mrr)}
                      </Cf2TableCell>
                      <Cf2TableCell className="text-center text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                        {fmtData(r.canceladaEm)}
                      </Cf2TableCell>
                      <Cf2TableCell className="text-right text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
                        {r.mesesDeVida.toLocaleString("pt-BR")}
                      </Cf2TableCell>
                      <Cf2TableCell className="text-right text-[12.5px] tabular-nums whitespace-nowrap font-medium" style={{ color: "var(--cf2-success-text)" }}>
                        {fmt(r.totalPago)}
                      </Cf2TableCell>
                      <Cf2TableCell>
                        <span
                          title={r.motivo || undefined}
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: cat.bg, color: cat.cor }}
                        >
                          {cat.label}
                        </span>
                      </Cf2TableCell>
                    </Cf2TableRow>
                  );
                })}
              </Cf2TableBody>
            </Cf2Table>
          </div>
        )}
      </FinPainel>
    </div>
  );
}
