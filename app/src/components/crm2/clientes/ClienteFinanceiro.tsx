"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";

interface Assinatura {
  id: string;
  produto: string | null;
  status: "active" | "past_due" | "canceled" | "trialing" | "incomplete_expired" | "unpaid" | string;
  mrr: string | null;
  moeda: string;
  stripe_subscription_id: string;
  iniciada_em: string | null;
  cancelada_em: string | null;
  motivo_cancelamento: string | null;
  current_period_end: string | null;
}

interface Fatura {
  id: string;
  origem: string;
  external_id: string | null;
  valor: string;
  moeda: string;
  status: "aberta" | "paga" | "rascunho" | "void" | string;
  competencia: string | null;
  emitida_em: string | null;
  vencimento: string | null;
  hosted_invoice_url: string | null;
  paga_em: string | null;
  tentativas: number | null;
  acionado_cobranca: boolean;
  atrasada: boolean;
}

interface ClienteFinanceiroData {
  assinaturas: Assinatura[];
  faturas: Fatura[];
  resumo: {
    totalFaturasAtrasadas: number;
    valorAtrasado: number;
    totalFaturasEmDia: number;
  };
}

const ASSINATURA_STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  past_due: "Em atraso",
  canceled: "Cancelada",
  trialing: "Trial",
  incomplete_expired: "Expirada (incompleta)",
  unpaid: "Não paga",
};
const ASSINATURA_STATUS_COLOR: Record<string, string> = {
  active: "#059669",
  past_due: "#d97706",
  canceled: "#6B7280",
  trialing: "#2563eb",
  incomplete_expired: "#dc2626",
  unpaid: "#dc2626",
};

const FATURA_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  paga: "Paga",
  rascunho: "Rascunho",
  void: "Anulada",
};

function brl(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

/**
 * Clientes → Financeiro (CRM2, 18/08) — componente standalone, ainda não
 * conectado ao Customer 360 (feito por outro processo depois, pra não
 * conflitar com Cliente360.tsx em edição paralela).
 *
 * Regra fechada do projeto: billing != lifecycle. Fatura atrasada é sinal
 * de cobrança/recovery pro CS, nunca é lido como churn — por isso este
 * componente não toca em commercial_lifecycle nem em Health Score, só
 * mostra o estado real de pagamento.
 */
export function Cf2ClienteFinanceiro({ empresaId }: { empresaId: string }) {
  const { data, isLoading, error } = useQuery<ClienteFinanceiroData>({
    queryKey: ["cf2-cliente-financeiro", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/${empresaId}/financeiro`);
      if (!r.ok) throw new Error("Não foi possível carregar o financeiro");
      return r.json();
    },
  });

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (error || !data) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Não foi possível carregar o financeiro.</p>;

  const { assinaturas, faturas, resumo } = data;
  const temAtraso = resumo.totalFaturasAtrasadas > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo de cobrança — prioridade visual pro CS: recovery antes de tudo */}
      <div
        className="flex items-center gap-4 p-5 rounded-2xl"
        style={{
          background: temAtraso ? "#dc262610" : "var(--cf2-bg-surface)",
          border: `1px solid ${temAtraso ? "#dc262640" : "var(--cf2-border-default)"}`,
        }}
      >
        <div
          className="flex items-center justify-center rounded-2xl shrink-0 w-12 h-12"
          style={{ background: temAtraso ? "#dc262618" : "#05966918" }}
        >
          {temAtraso ? (
            <AlertTriangle className="w-6 h-6" style={{ color: "#dc2626" }} />
          ) : (
            <CheckCircle2 className="w-6 h-6" style={{ color: "#059669" }} />
          )}
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>
            {temAtraso
              ? `${resumo.totalFaturasAtrasadas} fatura${resumo.totalFaturasAtrasadas > 1 ? "s" : ""} em atraso`
              : "Sem faturas em atraso"}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
            {resumo.totalFaturasEmDia} fatura{resumo.totalFaturasEmDia !== 1 ? "s" : ""} em dia
          </p>
        </div>
        {temAtraso && (
          <div className="text-right">
            <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>VALOR EM ATRASO</p>
            <p className="text-[24px] font-bold" style={{ color: "#dc2626" }}>{brl(resumo.valorAtrasado)}</p>
          </div>
        )}
      </div>

      {/* Assinaturas */}
      <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Assinaturas</p>
        {assinaturas.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma assinatura.</p>
        ) : assinaturas.map((a) => (
          <div key={a.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
                <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{a.produto || "Produto não identificado"}</p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: "var(--cf2-bg-surface)", color: ASSINATURA_STATUS_COLOR[a.status] || "var(--cf2-text-tertiary)" }}
                >
                  {ASSINATURA_STATUS_LABEL[a.status] || a.status}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
                {a.status === "canceled" && a.cancelada_em
                  ? `Cancelada em ${fmtData(a.cancelada_em)}${a.motivo_cancelamento ? ` · ${a.motivo_cancelamento}` : ""}`
                  : `Próxima renovação: ${fmtData(a.current_period_end)}`}
              </p>
            </div>
            <p className="text-[15px] font-bold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>
              {a.mrr ? brl(parseFloat(a.mrr)) : "—"}<span className="text-[10px] font-normal" style={{ color: "var(--cf2-text-tertiary)" }}>/mês</span>
            </p>
          </div>
        ))}
      </div>

      {/* Faturas — atrasadas destacadas em vermelho, em dia em neutro/verde */}
      <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Faturas</p>
        {faturas.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma fatura.</p>
        ) : faturas.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{
              background: f.atrasada ? "#dc262610" : "var(--cf2-bg-surface-muted)",
              border: f.atrasada ? "1px solid #dc262640" : "1px solid transparent",
            }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>
                  Vencimento: {fmtData(f.vencimento || f.emitida_em)}
                </p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    background: f.atrasada ? "#dc262618" : "#05966918",
                    color: f.atrasada ? "#dc2626" : "#059669",
                  }}
                >
                  {f.atrasada ? "Atrasada" : FATURA_STATUS_LABEL[f.status] || f.status}
                </span>
                {f.acionado_cobranca && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>
                    já acionada
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
                {f.competencia ? `Competência ${fmtData(f.competencia)} · ` : ""}{f.origem}
                {f.hosted_invoice_url && (
                  <a href={f.hosted_invoice_url} target="_blank" rel="noreferrer" className="underline ml-1">ver fatura</a>
                )}
              </p>
            </div>
            <p
              className="text-[15px] font-bold shrink-0"
              style={{ color: f.atrasada ? "#dc2626" : "var(--cf2-text-primary)" }}
            >
              {brl(parseFloat(f.valor))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
