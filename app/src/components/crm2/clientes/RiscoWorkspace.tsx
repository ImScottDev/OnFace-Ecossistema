"use client";

/**
 * Risco / Churn (Documento Mestre v0.13, Módulo 08).
 *
 * Substitui o `ModuloPendente` que ocupava esta rota. O placeholder listava
 * duas dependências e as duas já estavam resolvidas: `lib/cs/riscos` mantém
 * 491 riscos abertos, e o tipo do risco já separa cobrança de relacionamento.
 *
 * A TELA TEM UMA DECISÃO: separar por QUEM RESOLVE, não por gravidade só.
 * Fatura vencida e assinatura irregular o Financeiro resolve, e o cliente pode
 * nem saber que está em risco. Silêncio e falta de próxima ação o CS resolve,
 * ligando. Numa lista única, o time ataca as 249 contas de "sem próxima ação"
 * e não vê as 15 prestes a cair por cobrança.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Cf2Skeleton, Cf2ErrorState } from "@/components/crm2/ui/States";

type Severidade = "CRITICO" | "EM_RISCO" | "ATENCAO";
type Natureza = "cobranca" | "relacionamento" | "entrega";

interface Conta {
  empresaId: string; empresaNome: string;
  severidade: Severidade; peso: number; mrr: number;
  naturezas: Natureza[];
  riscos: Array<{ tipo: string; rotulo: string; severidade: Severidade; desdeDias: number | null; motivo: string | null }>;
  responsavelId: string | null; responsavelNome: string | null;
}

interface Carteira {
  contas: Conta[];
  resumo: {
    contas: number;
    porSeveridade: Record<Severidade, number>;
    mrrPorSeveridade: Record<Severidade, number>;
    porNatureza: Record<Natureza, number>;
    semResponsavel: number;
  };
}

const SEVERIDADE = {
  CRITICO: { rotulo: "Crítico", cor: "var(--cf2-danger-text)" },
  EM_RISCO: { rotulo: "Em risco", cor: "var(--cf2-warning-text)" },
  ATENCAO: { rotulo: "Atenção", cor: "var(--cf2-text-secondary)" },
} as const;

const NATUREZA = {
  cobranca: { rotulo: "Cobrança", quem: "o Financeiro resolve" },
  relacionamento: { rotulo: "Relacionamento", quem: "o CS resolve, ligando" },
  entrega: { rotulo: "Entrega", quem: "a Implantação resolve" },
} as const;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function Cf2RiscoWorkspace() {
  const router = useRouter();
  const [natureza, setNatureza] = useState<Natureza | null>(null);
  const [severidade, setSeveridade] = useState<Severidade | null>(null);

  const { data, isLoading, isError } = useQuery<Carteira>({
    queryKey: ["cs-riscos"],
    queryFn: async () => {
      const r = await fetch("/api/cs/riscos");
      if (!r.ok) throw new Error("Falha ao carregar a carteira em risco");
      return r.json();
    },
  });

  if (isError) return <Cf2ErrorState message="Não foi possível carregar a carteira em risco." />;
  if (isLoading || !data) return <div className="flex flex-col gap-4"><Cf2Skeleton className="h-32" /><Cf2Skeleton className="h-96" /></div>;

  const { resumo } = data;
  const contas = data.contas.filter((c) =>
    (!natureza || c.naturezas.includes(natureza)) && (!severidade || c.severidade === severidade));

  return (
    <div className="flex flex-col gap-5">
      {/* MRR POR SEVERIDADE, nunca um total. Somar tudo daria a carteira
          inteira, porque quase toda conta tem algum risco de atenção aberto —
          um número que assusta e não orienta. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["CRITICO", "EM_RISCO", "ATENCAO"] as const).map((s) => (
          <button
            key={s} type="button"
            onClick={() => setSeveridade(severidade === s ? null : s)}
            aria-pressed={severidade === s}
            className="rounded-xl p-4 text-left transition-colors"
            style={{
              background: "var(--cf2-bg-surface)",
              border: `1px solid ${severidade === s ? SEVERIDADE[s].cor : "var(--cf2-border-default)"}`,
            }}
          >
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>
              {SEVERIDADE[s].rotulo}
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: SEVERIDADE[s].cor }}>
              {resumo.porSeveridade[s]}
            </p>
            <p className="text-[12px] tabular-nums" style={{ color: "var(--cf2-text-secondary)" }}>
              {brl(resumo.mrrPorSeveridade[s])} de MRR
            </p>
          </button>
        ))}
      </div>

      {/* A separação que o módulo existe para fazer. */}
      <div className="rounded-xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--cf2-text-primary)" }}>Quem resolve</p>
        <p className="text-[11.5px] mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>
          Uma conta pode aparecer nos dois: são times diferentes precisando agir nela.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["cobranca", "relacionamento", "entrega"] as const)
            .filter((n) => resumo.porNatureza[n] > 0)
            .map((n) => (
              <button
                key={n} type="button"
                onClick={() => setNatureza(natureza === n ? null : n)}
                aria-pressed={natureza === n}
                className="px-3 py-2 rounded-lg text-[12px] text-left transition-colors"
                style={{
                  background: natureza === n ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)",
                  color: natureza === n ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
                  border: "1px solid var(--cf2-border-default)",
                }}
              >
                <strong className="tabular-nums">{resumo.porNatureza[n]}</strong> {NATUREZA[n].rotulo}
                <span className="block text-[10.5px] opacity-80">{NATUREZA[n].quem}</span>
              </button>
            ))}
        </div>
        {resumo.semResponsavel > 0 && (
          // Conta sem dono não é detalhe: ninguém vai agir nela.
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--cf2-warning-text)" }}>
            {resumo.semResponsavel} de {resumo.contas} contas em risco estão sem responsável. Sem dono, ninguém age.
          </p>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--cf2-border-default)" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
            {contas.length} {contas.length === 1 ? "conta" : "contas"}
            {(natureza || severidade) && (
              <button type="button" onClick={() => { setNatureza(null); setSeveridade(null); }}
                className="ml-2 text-[11.5px] font-normal underline" style={{ color: "var(--cf2-text-tertiary)" }}>
                limpar recorte
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--cf2-border-default)" }}>
          {contas.map((c) => (
            <button
              key={c.empresaId} type="button"
              onClick={() => router.push(`/clientes/${c.empresaId}`)}
              className="flex flex-col gap-1 px-4 py-3 text-left hover:opacity-80 transition-opacity"
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{c.empresaNome}</span>
                <span className="text-[11px] font-medium" style={{ color: SEVERIDADE[c.severidade].cor }}>
                  {SEVERIDADE[c.severidade].rotulo}
                </span>
                {c.mrr > 0 && (
                  <span className="text-[11.5px] tabular-nums ml-auto" style={{ color: "var(--cf2-text-secondary)" }}>
                    {brl(c.mrr)} de MRR
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {c.riscos.map((r, i) => (
                  <span key={`${r.tipo}-${i}`} className="text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                    {r.rotulo}
                    {/* Há quanto tempo o risco está aberto muda a urgência. */}
                    {r.desdeDias !== null && r.desdeDias > 0 ? ` · há ${r.desdeDias}d` : ""}
                  </span>
                ))}
              </div>
              <span className="text-[11px]" style={{ color: c.responsavelNome ? "var(--cf2-text-tertiary)" : "var(--cf2-warning-text)" }}>
                {c.responsavelNome ?? "sem responsável"}
              </span>
            </button>
          ))}
          {contas.length === 0 && (
            <p className="px-4 py-6 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Nenhuma conta neste recorte.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
