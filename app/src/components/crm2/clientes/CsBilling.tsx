"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Info } from "lucide-react";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton } from "@/components/crm2/ui/States";

/**
 * Billing na visão do CS — por Service, só leitura.
 *
 * O CS precisa saber o estado da cobrança pra conduzir a conversa, e precisa
 * NÃO conseguir mexer em preço, quantidade ou plano por aqui: mudança
 * comercial vira expansão/redução → proposta → Won → serviço atualizado.
 *
 * Campos que a spec pede e a base não tem hoje aparecem com o motivo, não
 * como traço mudo — a diferença entre "não temos" e "está zerado" muda o que
 * o CS faz em seguida.
 */

interface Fatura {
  id: string; externalId: string | null; valor: string; status: string;
  competencia: string | null; vencimento: string | null; pagaEm: string | null;
  tentativas: number; hostedInvoiceUrl: string | null; diasAtraso: number | null;
}

interface Assinatura {
  id: string; stripeSubscriptionId: string; stripeCustomerId: string | null;
  stripePriceId: string | null; produto: string | null; quantidade: number | null;
  mrr: string | null; moeda: string; status: string;
  iniciadaEm: string | null; canceladaEm: string | null; cancelaNoFimDoPeriodo: boolean | null;
}

interface BlocoBilling {
  servicoId: string | null; serviceFamily: string | null; produtoCanonico: string | null;
  mrrServico: string; revenueNature: string | null;
  assinatura: Assinatura | null; faturas: Fatura[];
  totalEmAberto: string; ultimoPagamento: string | null;
}

interface RespostaBilling {
  porServico: BlocoBilling[];
  naoAtribuido: BlocoBilling | null;
  stripeCustomerId: string | null;
  indisponivel: Record<string, string>;
}

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Produto em revisão",
};

const STATUS_ASSINATURA: Record<string, { rotulo: string; variante: "success" | "warning" | "danger" | "neutral" }> = {
  active: { rotulo: "ativa", variante: "success" },
  trialing: { rotulo: "em teste", variante: "warning" },
  past_due: { rotulo: "em atraso", variante: "danger" },
  unpaid: { rotulo: "não paga", variante: "danger" },
  canceled: { rotulo: "cancelada", variante: "neutral" },
  incomplete_expired: { rotulo: "expirada sem pagar", variante: "neutral" },
};

const STATUS_FATURA: Record<string, { rotulo: string; variante: "success" | "warning" | "danger" | "neutral" }> = {
  paga: { rotulo: "paga", variante: "success" },
  aberta: { rotulo: "em aberto", variante: "warning" },
  falhou: { rotulo: "falhou", variante: "danger" },
  void: { rotulo: "cancelada", variante: "neutral" },
  uncollectible: { rotulo: "incobrável", variante: "danger" },
  rascunho: { rotulo: "rascunho", variante: "neutral" },
};

function brl(v: string | number | null) {
  if (v === null) return "—";
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dataBr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR");
}

async function copiar(texto: string, oque: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${oque} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function Cf2CsBilling({ empresaId }: { empresaId: string }) {
  const { data, isLoading } = useQuery<RespostaBilling>({
    queryKey: ["cs-billing", empresaId],
    queryFn: async () => (await fetch(`/api/cs/clientes/${empresaId}/billing`)).json(),
  });

  if (isLoading) return <Cf2Skeleton className="h-48" />;
  if (!data) return null;

  const blocos = [...data.porServico, ...(data.naoAtribuido ? [data.naoAtribuido] : [])];

  if (blocos.length === 0) {
    return (
      <p className="text-[12.5px] p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
        Nenhuma cobrança registrada para este cliente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.stripeCustomerId && (
        <div className="flex items-center gap-2 flex-wrap text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          <span>Stripe Customer</span>
          <code className="px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{data.stripeCustomerId}</code>
          <button onClick={() => copiar(data.stripeCustomerId!, "ID do cliente")} className="flex items-center gap-1 font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>
            <Copy className="w-3 h-3" /> copiar
          </button>
          <a
            href={`https://dashboard.stripe.com/customers/${data.stripeCustomerId}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 font-semibold" style={{ color: "var(--cf2-text-secondary)" }}
          >
            <ExternalLink className="w-3 h-3" /> abrir no Stripe
          </a>
        </div>
      )}

      {blocos.map((b, i) => <BlocoServico key={b.servicoId ?? `orfao-${i}`} bloco={b} />)}

      <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }} />
        <div className="text-[10.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          <p className="font-semibold mb-0.5">Não exibido porque não existe no dado sincronizado:</p>
          {Object.entries(data.indisponivel).map(([campo, motivo]) => (
            <p key={campo}>· {campo}: {motivo}</p>
          ))}
          <p className="mt-1">Alterar plano, preço ou quantidade não é feito aqui — abra uma expansão ou redução.</p>
        </div>
      </div>
    </div>
  );
}

function BlocoServico({ bloco }: { bloco: BlocoBilling }) {
  const a = bloco.assinatura;
  const statusAss = a ? STATUS_ASSINATURA[a.status] ?? { rotulo: a.status, variante: "neutral" as const } : null;
  const emAberto = Number(bloco.totalEmAberto || 0);

  return (
    <div className="rounded-xl p-3.5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13.5px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>
              {bloco.produtoCanonico ?? (bloco.serviceFamily ? FAMILIA_LABEL[bloco.serviceFamily] ?? bloco.serviceFamily : "Serviço")}
            </p>
            {bloco.serviceFamily && <Cf2Badge variant="neutral">{FAMILIA_LABEL[bloco.serviceFamily] ?? bloco.serviceFamily}</Cf2Badge>}
            {statusAss && <Cf2Badge variant={statusAss.variante}>{statusAss.rotulo}</Cf2Badge>}
            {a?.cancelaNoFimDoPeriodo && <Cf2Badge variant="danger">cancela no fim do período</Cf2Badge>}
          </div>
          {a && (
            <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              <code>{a.stripeSubscriptionId}</code>
              <button onClick={() => copiar(a.stripeSubscriptionId, "ID da assinatura")} className="font-semibold"><Copy className="w-3 h-3 inline" /></button>
              <a href={`https://dashboard.stripe.com/subscriptions/${a.stripeSubscriptionId}`} target="_blank" rel="noreferrer" className="font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>
                <ExternalLink className="w-3 h-3 inline" /> Stripe
              </a>
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{brl(bloco.mrrServico)}</p>
          <p className="text-[10.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>MRR do serviço</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <Campo rotulo="Plano/preço" valor={a?.produto ?? "—"} extra={a?.stripePriceId ?? undefined} />
        <Campo rotulo="Quantidade" valor={a?.quantidade !== null && a?.quantidade !== undefined ? String(a.quantidade) : "—"} />
        <Campo rotulo="Último pagamento" valor={dataBr(bloco.ultimoPagamento)} />
        <Campo
          rotulo="Em aberto"
          valor={brl(bloco.totalEmAberto)}
          destaque={emAberto > 0 ? "var(--cf2-danger-text)" : undefined}
        />
      </div>

      {bloco.faturas.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Faturas</p>
          <div className="flex flex-col gap-1">
            {bloco.faturas.map((f) => {
              const st = STATUS_FATURA[f.status] ?? { rotulo: f.status, variante: "neutral" as const };
              return (
                <div key={f.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <span className="font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(f.valor)}</span>
                  <Cf2Badge variant={st.variante}>{st.rotulo}</Cf2Badge>
                  <span style={{ color: "var(--cf2-text-tertiary)" }}>
                    {f.competencia ? dataBr(f.competencia) : dataBr(f.vencimento)}
                    {f.pagaEm && ` · paga ${dataBr(f.pagaEm)}`}
                  </span>
                  {f.diasAtraso !== null && (
                    <span className="font-semibold" style={{ color: "var(--cf2-danger-text)" }}>{f.diasAtraso}d de atraso</span>
                  )}
                  {f.tentativas > 1 && (
                    <span style={{ color: "var(--cf2-text-tertiary)" }}>{f.tentativas} tentativas</span>
                  )}
                  <span className="flex-1" />
                  {f.hostedInvoiceUrl && (
                    <>
                      <button onClick={() => copiar(f.hostedInvoiceUrl!, "Link da fatura")} className="shrink-0 font-semibold" style={{ color: "var(--cf2-text-tertiary)" }} title="Copiar link de pagamento">
                        <Copy className="w-3 h-3" />
                      </button>
                      <a href={f.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="shrink-0 font-semibold" style={{ color: "var(--cf2-text-secondary)" }} title="Abrir fatura">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, valor, extra, destaque }: { rotulo: string; valor: string; extra?: string; destaque?: string }) {
  return (
    <div className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{rotulo}</p>
      <p className="text-[12px] font-bold truncate" style={{ color: destaque ?? "var(--cf2-text-primary)" }} title={valor}>{valor}</p>
      {extra && <p className="text-[9.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }} title={extra}>{extra}</p>}
    </div>
  );
}
