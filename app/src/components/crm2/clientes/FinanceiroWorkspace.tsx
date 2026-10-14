"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  Database,
  FileCheck2,
  Receipt,
  RefreshCw,
  Server,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type MrrSummary = {
  atual: string;
  services: number;
  activeServices: number;
  implementingServices: number;
};

type StripeRow = {
  status: string;
  subscriptions: number;
  mrr: string;
  linked_services: number;
};

type InvoiceRow = {
  origem: string;
  status: string;
  invoices: number;
  total: string;
};

type LedgerBatch = {
  id: string;
  competence: string;
  version: string;
  source_file: string;
  expected_total: string;
  imported_total: string;
  row_count: number;
  status: string;
  imported_at: string;
};

type LedgerFamily = {
  service_family: string;
  entries: number;
  billed_total: string;
  linked_services: number;
  unresolved: number;
};

type FinanceiroPayload = {
  mrr: MrrSummary;
  stripe: StripeRow[];
  invoices: InvoiceRow[];
  ledger: {
    batch: LedgerBatch | null;
    families: LedgerFamily[];
    quality: { entries: number; linked_services: number; unresolved: number };
  };
};

type UploadSummary = {
  rows: number;
  total: number;
  confirmed: number;
  ambiguous: number;
  unresolved: number;
  unresolvedTotal: number;
};

type UploadResponse = { summary?: UploadSummary; erros?: string[] };

const FAMILY_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
  UNKNOWN: "Produto em revisão",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Trial",
  past_due: "Em atraso",
  unpaid: "Não paga",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  open: "Aberta",
  paid: "Paga",
  void: "Anulada",
  uncollectible: "Incobrável",
};

function money(value: string | number | null | undefined): string {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function label(value: string | null | undefined): string {
  if (!value) return "Não informado";
  return STATUS_LABEL[value] ?? value.replaceAll("_", " ");
}

function competence(value: string | null | undefined): string {
  if (!value) return "Sem competência";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function shortSource(value: string | null | undefined): string {
  if (!value) return "Sem arquivo de origem";
  return value.split("/").pop() || value;
}

function toneForStatus(value: string): "success" | "warning" | "danger" | "neutral" {
  if (["active", "paid", "CLOSED"].includes(value)) return "success";
  if (["past_due", "unpaid", "open", "incomplete"].includes(value)) return "warning";
  if (["canceled", "void", "uncollectible"].includes(value)) return "danger";
  return "neutral";
}

const TONE: Record<string, { text: string; bg: string }> = {
  success: { text: "var(--cf2-success-text)", bg: "color-mix(in srgb, var(--cf2-success-text) 10%, transparent)" },
  warning: { text: "var(--cf2-warning-text)", bg: "color-mix(in srgb, var(--cf2-warning-text) 11%, transparent)" },
  danger: { text: "var(--cf2-danger-text)", bg: "color-mix(in srgb, var(--cf2-danger-text) 10%, transparent)" },
  neutral: { text: "var(--cf2-text-secondary)", bg: "var(--cf2-bg-surface-muted)" },
};

function StatusPill({ value }: { value: string }) {
  const tone = TONE[toneForStatus(value)];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ color: tone.text, background: tone.bg }}
    >
      {label(value)}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  color,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div
      className="flex min-h-[122px] items-start justify-between gap-3 rounded-2xl p-4"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--cf2-text-tertiary)" }}>
          {title}
        </p>
        <p className="mt-2 truncate text-[22px] font-bold" style={{ color }}>
          {value}
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          {detail}
        </p>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
    </div>
  );
}

export function FinanceiroWorkspace() {
  const queryClient = useQueryClient();
  const [arquivoFaturamento, setArquivoFaturamento] = useState<File | null>(null);
  const [competencia, setCompetencia] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
  });
  const [preview, setPreview] = useState<UploadSummary | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<FinanceiroPayload>({
    queryKey: ["cf2-financeiro-operacional"],
    queryFn: async () => {
      const response = await fetch("/api/clientes-crm2/financeiro/operacional");
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (response.status === 401 || response.status === 403) {
        throw new Error("Sua sessão expirou. Entre novamente para acessar o Financeiro.");
      }
      if (!response.ok) throw new Error(body?.error || "Não foi possível carregar o financeiro");
      return body as FinanceiroPayload;
    },
  });
  const uploadMutation = useMutation({
    mutationFn: async ({ acao, fechar }: { acao: "preview" | "commit"; fechar: boolean }) => {
      if (!arquivoFaturamento) throw new Error("Selecione a planilha mensal");
      const form = new FormData();
      form.set("file", arquivoFaturamento);
      form.set("competencia", competencia);
      form.set("acao", acao);
      form.set("fechar", String(fechar));
      const response = await fetch("/api/financeiro/pabx-import", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível processar a planilha");
      return body as UploadResponse;
    },
    onSuccess: (body, variables) => {
      setUploadError(null);
      if (variables.acao === "preview") {
        setPreview(body.summary || null);
      } else {
        setPreview(null);
        setArquivoFaturamento(null);
        void queryClient.invalidateQueries({ queryKey: ["cf2-financeiro-operacional"] });
      }
    },
    onError: (error) => setUploadError(error instanceof Error ? error.message : "Falha ao processar planilha"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--cf2-text-tertiary)" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <AlertTriangle className="h-6 w-6" style={{ color: "var(--cf2-warning-text)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{error instanceof Error ? error.message : "Não foi possível carregar o financeiro"}</p>
        {error instanceof Error && error.message.startsWith("Sua sessão expirou") ? (
          <a className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ color: "var(--cf2-text-on-accent)", background: "var(--cf2-accent)" }} href={`/login?callbackUrl=${encodeURIComponent("/clientes/financeiro")}`}>
            Entrar novamente
          </a>
        ) : (
          <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ color: "var(--cf2-text-primary)", background: "var(--cf2-bg-surface-muted)" }} onClick={() => refetch()}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  const batch = data.ledger.batch;
  const quality = data.ledger.quality;
  const invoiceTotal = data.invoices.reduce((sum, row) => sum + Number(row.total || 0), 0);
  /* Só assinatura que COBRA entra no total. Somando todo status, `canceled`,
     `incomplete_expired` e `unpaid` entravam juntos e o card mostrava
     R$ 153.708 onde o real era R$ 51.058 — três vezes, num número rotulado
     como MRR (auditoria de 14/10/2026). */
  const STATUS_QUE_COBRA = new Set(["active", "trialing"]);
  const stripeTotal = data.stripe
    .filter((row) => STATUS_QUE_COBRA.has(String(row.status ?? "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.mrr || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--cf2-success-text)" }}>Financeiro operacional</p>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Receita, cobrança e conciliação</h1>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--cf2-text-secondary)" }}>
            Uma visão das fontes reais do CRM. MRR vem de Services, Stripe mostra billing e o ledger mostra faturamento externo conciliado.
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ color: "var(--cf2-text-secondary)", background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
          onClick={() => refetch()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} title="MRR canônico" value={money(data.mrr.atual)} detail="Services incluídos no portfolio" color="var(--cf2-success-text)" />
        <MetricCard icon={Server} title="Services ativos" value={String(data.mrr.activeServices)} detail={`${data.mrr.services} Services cadastrados`} color="var(--cf2-text-primary)" />
        <MetricCard icon={RefreshCw} title="Em implantação" value={String(data.mrr.implementingServices)} detail="Fulfillments não concluídos" color="var(--cf2-text-primary)" />
        <MetricCard icon={Database} title="Último ledger" value={batch ? money(batch.imported_total) : "—"} detail={batch ? `${competence(batch.competence)} · ${batch.row_count} linhas` : "Nenhum lote importado"} color="var(--cf2-text-primary)" />
      </div>

      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--cf2-warning-text) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--cf2-warning-text) 24%, transparent)" }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--cf2-warning-text)" }} />
        <p className="text-xs leading-5" style={{ color: "var(--cf2-text-secondary)" }}>
          <strong style={{ color: "var(--cf2-text-primary)" }}>Fontes separadas:</strong> billing Stripe não é o mesmo que faturamento mensal conciliado. Uma fatura autorizada não é automaticamente pagamento confirmado, e past_due não transforma o serviço em churn.
        </p>
      </div>

      <section className="rounded-3xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" style={{ color: "#8e27ef" }} /><h2 className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Importar faturamento mensal</h2></div>
            <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: "var(--cf2-text-secondary)" }}>Use a planilha Callface para registrar a competência no ledger. O CRM concilia por CPF/CNPJ e nunca classifica AI/PABX pelo nome da empresa.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Competência
              <input type="month" value={competencia} onChange={(event) => { setCompetencia(event.target.value); setPreview(null); }} className="rounded-xl px-3 py-2 text-xs font-normal outline-none" style={{ color: "var(--cf2-text-primary)", background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            </label>
            <label className="inline-flex max-w-[230px] cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ color: "var(--cf2-text-primary)", background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={(event) => { setArquivoFaturamento(event.target.files?.[0] || null); setPreview(null); setUploadError(null); }} />
              <span className="truncate">{arquivoFaturamento ? arquivoFaturamento.name : "Escolher CSV"}</span>
            </label>
            <button type="button" disabled={!arquivoFaturamento || uploadMutation.isPending} onClick={() => uploadMutation.mutate({ acao: "preview", fechar: false })} className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ color: "var(--cf2-text-primary)", background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>{uploadMutation.isPending ? "Processando..." : "Pré-visualizar"}</button>
          </div>
        </div>
        {preview && (
          <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[["Linhas", preview.rows], ["Total", money(preview.total)], ["Conciliadas", preview.confirmed], ["Ambíguas", preview.ambiguous], ["Pendentes", preview.unresolved]].map(([title, value]) => <div key={String(title)}><p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{title}</p><p className="mt-1 text-sm font-bold" style={{ color: title === "Pendentes" || title === "Ambíguas" ? "var(--cf2-warning-text)" : "var(--cf2-text-primary)" }}>{String(value)}</p></div>)}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{preview.unresolved > 0 ? `${money(preview.unresolvedTotal)} ficará visível como pendência de conciliação.` : "Todas as linhas têm vínculo confirmado."}</p>
              <div className="flex gap-2">
                <button type="button" disabled={uploadMutation.isPending} onClick={() => uploadMutation.mutate({ acao: "commit", fechar: false })} className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ color: "var(--cf2-text-primary)", background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>Importar lote aberto</button>
                <button type="button" disabled={uploadMutation.isPending} onClick={() => uploadMutation.mutate({ acao: "commit", fechar: true })} className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ color: "var(--cf2-text-on-accent)", background: "var(--cf2-accent)" }}>Importar e fechar competência</button>
              </div>
            </div>
          </div>
        )}
        {uploadError && <p className="mt-3 text-xs font-semibold" style={{ color: "var(--cf2-danger-text)" }}>{uploadError}</p>}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-3xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center justify-between gap-3 border-b p-5" style={{ borderColor: "var(--cf2-border-default)" }}>
            <div className="flex items-center gap-3"><Wallet className="h-4 w-4" style={{ color: "var(--cf2-success-text)" }} /><div><h2 className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Stripe / Billing</h2><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{data.stripe.length} status · {money(stripeTotal)} em MRR ativo (assinatura que cobra)</p></div></div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--cf2-border-default)" }}>
            {data.stripe.length === 0 ? <p className="p-5 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma assinatura Stripe encontrada.</p> : data.stripe.map((row) => (
              <div key={row.status} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div><StatusPill value={row.status} /><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{row.subscriptions} assinatura(s) · {row.linked_services} Service(s) vinculado(s)</p></div>
                <p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>{money(row.mrr)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center justify-between gap-3 border-b p-5" style={{ borderColor: "var(--cf2-border-default)" }}>
            <div className="flex items-center gap-3"><Receipt className="h-4 w-4" style={{ color: "#3b82f6" }} /><div><h2 className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Faturas no CRM</h2><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{data.invoices.length} combinações de origem/status · {money(invoiceTotal)} registrados</p></div></div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--cf2-border-default)" }}>
            {data.invoices.length === 0 ? <p className="p-5 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma fatura encontrada.</p> : data.invoices.map((row) => (
              <div key={`${row.origem}-${row.status}`} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div><p className="text-xs font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{row.origem || "Origem não informada"}</p><div className="mt-1 flex items-center gap-2"><StatusPill value={row.status} /><span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{row.invoices} fatura(s)</span></div></div>
                <p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>{money(row.total)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-3xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--cf2-border-default)" }}>
          <div className="flex items-center gap-3"><FileCheck2 className="h-4 w-4" style={{ color: "#8e27ef" }} /><div><h2 className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Conciliação de faturamento</h2><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{batch ? `${shortSource(batch.source_file)} · ${competence(batch.competence)}` : "Nenhum lote de faturamento disponível"}</p></div></div>
          {batch && <div className="flex items-center gap-2"><StatusPill value={batch.status} /><span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{quality.linked_services}/{quality.entries} vínculos resolvidos</span></div>}
        </div>
        {!batch ? <p className="p-5 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>O CRM ainda não tem um lote de ledger para exibir.</p> : (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Esperado", money(batch.expected_total)], ["Importado", money(batch.imported_total)], ["Linhas", String(batch.row_count)], ["Pendências", String(quality.unresolved)]] .map(([title, value]) => <div key={title} className="rounded-2xl p-3" style={{ background: "var(--cf2-bg-surface-muted)" }}><p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{title}</p><p className="mt-1 text-sm font-bold" style={{ color: title === "Pendências" && Number(value) > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-primary)" }}>{value}</p></div>)}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.ledger.families.map((row) => <div key={row.service_family} className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface-muted)" }}><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold" style={{ color: "var(--cf2-text-primary)" }}>{FAMILY_LABEL[row.service_family] ?? row.service_family}</p>{row.unresolved > 0 && <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--cf2-warning-text)" }} />}</div><p className="mt-2 text-base font-bold" style={{ color: "var(--cf2-text-primary)" }}>{money(row.billed_total)}</p><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{row.entries} lançamento(s) · {row.linked_services} vinculados{row.unresolved > 0 ? ` · ${row.unresolved} sem Service` : ""}</p></div>)}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}><Database className="h-3.5 w-3.5" /> A visão não cria dados: lê Services, assinaturas, faturas e batches já persistidos no CRM.</div>
    </div>
  );
}
