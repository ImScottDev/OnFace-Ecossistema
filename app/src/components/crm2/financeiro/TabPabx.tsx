"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { FinPulso, FinStat } from "./pecas";
import { fmt } from "./fmt";
import { TabAssinaturas } from "./TabAssinaturas";

/**
 * Importação mensal PABX: alinhada à API do Service Ledger.
 * Nenhuma linha cria lead, contrato, fatura ou MRR automaticamente.
 * Revisão explícita: arquivo + competência -> preview -> lote OPEN/CLOSED.
 */
type Resumo = {
  rows: number;
  total: number;
  confirmed: number;
  ambiguous: number;
  unresolved: number;
  unresolvedTotal: number;
};
type LinhaPreview = {
  rowNumber: number;
  sourceCompanyName: string;
  document: string | null;
  billedValue: number;
  companyName: string | null;
  serviceFamily: string;
  revenueNature: string;
  confidence: "CONFIRMED" | "AMBIGUOUS" | "UNRESOLVED";
  reason: string;
};
type Preview = {
  ok: boolean;
  mode: "preview";
  competencia: string;
  summary: Resumo;
  erros: string[];
  rows: LinhaPreview[];
};
type UltimaCarga = {
  competence: string;
  source_file: string;
  row_count: number;
  imported_total: number;
  unresolved_rows: number;
  unresolved_total: number;
  status: "OPEN" | "CLOSED";
  imported_at: string;
  closed_at: string | null;
};
function competenciaAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function TabPabx({ busca, onAbrirLead }: { busca: string; onAbrirLead: (leadId: string) => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [instanteDeReferencia] = useState(() => Date.now());
  const [competencia, setCompetencia] = useState(competenciaAnterior);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ erro: boolean; texto: string } | null>(null);

  const { data: carga, error: erroConsulta } = useQuery<{ latest: UltimaCarga | null }>({
    queryKey: ["fin-pabx-carga"],
    queryFn: async () => {
      const r = await fetch("/api/financeiro/pabx-import");
      if (!r.ok) throw new Error(r.status === 403 ? "Você não tem permissão para gerenciar o faturamento." : `Falha ao consultar a carga (HTTP ${r.status}).`);
      return r.json();
    },
  });
  const ultima = carga?.latest;
  const diasDesdeCarga = ultima?.imported_at
    ? Math.floor((instanteDeReferencia - new Date(ultima.imported_at).getTime()) / 86400000)
    : null;
  const desatualizada = diasDesdeCarga == null || diasDesdeCarga > 35;

  async function processar(acao: "preview" | "commit", fechar = false) {
    if (!arquivo) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
      setResultado({ erro: true, texto: "Informe uma competência válida no formato AAAA-MM." });
      return;
    }
    if (acao === "commit" && (!preview || preview.competencia !== competencia)) {
      setResultado({ erro: true, texto: "Visualize e revise a prévia desta competência antes de importar." });
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      form.append("competencia", competencia);
      form.append("acao", acao);
      form.append("fechar", String(fechar));
      const r = await fetch("/api/financeiro/pabx-import", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setResultado({ erro: true, texto: j.error || `Falha HTTP ${r.status} na importação.` });
        return;
      }
      if (acao === "preview") {
        setPreview(j as Preview);
        setResultado({ erro: false, texto: "Prévia carregada, sem alterar nenhum dado financeiro." });
      } else {
        setPreview(null);
        setArquivo(null);
        if (inputRef.current) inputRef.current.value = "";
        setResultado({
          erro: false,
          texto: j.idempotente
            ? "Arquivo já importado. Nenhuma linha foi duplicada."
            : `Lote importado em ${fechar ? "competência fechada" : "estado aberto"}: ${j.summary?.rows ?? 0} linhas, ${j.summary?.unresolved ?? 0} não resolvidas e ${j.summary?.ambiguous ?? 0} ambíguas.`,
        });
        queryClient.invalidateQueries({ queryKey: ["fin-pabx-carga"] });
      }
    } catch (e) {
      setResultado({ erro: true, texto: e instanceof Error ? e.message : "Erro ao processar a planilha." });
    } finally {
      setEnviando(false);
    }
  }

  const temPendencias = !!preview && (preview.summary.ambiguous > 0 || preview.summary.unresolved > 0 || preview.erros.length > 0);
  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Arquivo CSV do faturamento mensal"
        onChange={(e) => {
          setArquivo(e.target.files?.[0] ?? null);
          setPreview(null);
          setResultado(null);
        }}
      />
      <FinPulso
        label="Última competência importada"
        valor={ultima?.competence ? ultima.competence.slice(0, 7) : "Nunca"}
        tom={desatualizada ? "critico" : "ok"}
        sub={erroConsulta instanceof Error ? erroConsulta.message : ultima
          ? `${ultima.status === "CLOSED" ? "Fechada" : "Aberta"} · ${ultima.source_file} · importada há ${diasDesdeCarga} dia(s). Valores representam apenas a planilha carregada.`
          : "Sem carga identificada. O faturamento externo ainda não foi confirmado nesta área."}
      >
        <FinStat label="Linhas do lote" valor={ultima?.row_count ?? 0} sub="competência importada" tom="info" />
        <FinStat label="Total faturado" valor={fmt(Number(ultima?.imported_total ?? 0))} sub="não é MRR nem recebido" />
        <FinStat label="Exceções" valor={ultima?.unresolved_rows ?? 0} sub={`${fmt(Number(ultima?.unresolved_total ?? 0))} a conciliar`} tom={Number(ultima?.unresolved_rows) > 0 ? "atencao" : "neutro"} />
      </FinPulso>

      <section className="rounded-xl border border-[var(--cf2-border-default)] p-4 space-y-3" style={{ background: "var(--cf2-bg-surface)" }}>
        <div>
          <h3 className="font-semibold text-sm">Importar faturamento mensal de PABX</h3>
          <p className="text-xs text-[var(--cf2-text-secondary)] mt-1">
            Use o CSV real da cobrança (CardCode; CardName; CPFCNPJ; ValorBruto). A conferência é por documento e Service, nunca por nome ou e-mail.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-end">
          <label className="flex flex-col gap-1 text-xs">
            Competência da cobrança
            <input
              type="month"
              value={competencia}
              onChange={(e) => { setCompetencia(e.target.value); setPreview(null); }}
              className="rounded-md border border-[var(--cf2-border-default)] bg-transparent px-3 py-2"
              aria-label="Competência do faturamento"
            />
          </label>
          <Cf2Button onClick={() => inputRef.current?.click()}>
            <Upload className="size-3.5" />
            {arquivo ? "Trocar CSV" : "Escolher CSV"}
          </Cf2Button>
          <Cf2Button disabled={!arquivo || enviando} loading={enviando} onClick={() => processar("preview")}>
            Gerar prévia
          </Cf2Button>
        </div>
        {arquivo && <p className="text-xs text-[var(--cf2-text-secondary)]">Arquivo selecionado: {arquivo.name}</p>}
        {resultado && <p role="status" className="text-xs" style={{ color: resultado.erro ? "var(--cf2-danger-text)" : "var(--cf2-success-text)" }}>{resultado.texto}</p>}

        {preview && (
          <div className="space-y-3 border-t border-[var(--cf2-border-default)] pt-3">
            <h4 className="text-sm font-semibold">Prévia · {preview.competencia} — nenhum registro foi alterado</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <FinStat label="Linhas" valor={preview.summary.rows} />
              <FinStat label="Total" valor={fmt(preview.summary.total)} />
              <FinStat label="Conciliadas" valor={preview.summary.confirmed} tom="info" />
              <FinStat label="Exceções" valor={preview.summary.ambiguous + preview.summary.unresolved} tom={temPendencias ? "atencao" : "neutro"} />
            </div>
            {temPendencias && (
              <p className="text-xs text-[var(--cf2-warning-text)]">
                Existem linhas sem vínculo confirmado. O lote pode ficar aberto para resolução, mas não deve ser fechado automaticamente.
              </p>
            )}
            {preview.erros.length > 0 && <p className="text-xs text-[var(--cf2-danger-text)]">{preview.erros.length} linha(s) inválida(s): {preview.erros.slice(0, 3).join("; ")}</p>}
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="text-left border-b border-[var(--cf2-border-default)]">
                  <th className="p-2">Linha</th><th className="p-2">Origem</th><th className="p-2">Valor</th><th className="p-2">Estado / motivo</th>
                </tr></thead>
                <tbody>
                  {preview.rows.filter((r) => r.confidence !== "CONFIRMED").slice(0, 20).map((r) => (
                    <tr key={r.rowNumber} className="border-b border-[var(--cf2-border-default)]">
                      <td className="p-2">{r.rowNumber}</td>
                      <td className="p-2">{r.sourceCompanyName}</td>
                      <td className="p-2 whitespace-nowrap">{fmt(r.billedValue)}</td>
                      <td className="p-2">{r.confidence} — {r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.summary.confirmed === preview.summary.rows && <p className="text-xs mt-2 text-[var(--cf2-success-text)]">Todas as linhas foram identificadas com confiança.</p>}
              {preview.summary.ambiguous + preview.summary.unresolved > 20 && <p className="text-xs mt-2">Mostrando as primeiras 20 exceções. Nenhuma foi conciliada automaticamente.</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Cf2Button disabled={enviando} loading={enviando} onClick={() => processar("commit", false)}>Importar como lote aberto</Cf2Button>
              {!temPendencias && <Cf2Button disabled={enviando} loading={enviando} onClick={() => processar("commit", true)}>Importar e fechar competência</Cf2Button>}
            </div>
          </div>
        )}
      </section>

      <TabAssinaturas busca={busca} onAbrirLead={onAbrirLead} produto="pabx" pulso={false} />
    </div>
  );
}
