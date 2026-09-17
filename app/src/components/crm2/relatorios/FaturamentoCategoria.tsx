"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Cf2Skeleton, Cf2ErrorState, Cf2EmptyState } from "@/components/crm2/ui/States";
import { Secao, Stat } from "./kit";

type Linha = { mes?: string; nome?: string; mrr: number; setup: number; total: number; negocios: number };
type Payload = { series: Linha[]; porPessoa: Linha[]; negociosSemValor: number };

const COR_MRR = "#1f7a4d";
const COR_SETUP = "#c8871a";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/**
 * Rótulo do mês em português. Vinha do Postgres via `to_char(..., 'TMMon/YY')`,
 * mas o banco roda com `lc_time = en_US.UTF-8` e o TM não tem efeito: saía
 * "Jul/26", "Aug/26", "Sep/26" numa interface em português.
 */
const rotuloMes = (aaaaMm: string) => {
  const [a, m] = aaaaMm.split("-");
  // `toLocaleDateString` com month/year em pt-BR devolve "jul de 26"; o eixo
  // quer "jul/26", então o mês vem sozinho e o ano é concatenado.
  const mes = new Date(Number(a), Number(m) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  return `${mes}/${a.slice(2)}`;
};
const brlCheio = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Faturamento fechado por categoria (09/09/2026).
 *
 * A meta comercial virou uma só — "faturamento fechado", mensalidade mais
 * setup — porque medir só MRR deixava um terço do valor vendido fora do
 * painel de quem vendeu. Em troca, o relatório passa a mostrar a COMPOSIÇÃO:
 * a meta é um número, mas mês a mês dá pra ver de que ele foi feito, e por
 * pessoa também.
 *
 * Barra empilhada e não duas séries lado a lado: o que interessa aqui é a
 * proporção dentro do mês, não comparar mensalidade e setup como se fossem
 * grandezas independentes.
 */
export function FaturamentoCategoria({ meses = 12 }: { meses?: number }) {
  const { data, isLoading, isError } = useQuery<Payload>({
    queryKey: ["relatorios", "faturamento-categoria", meses],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/faturamento-categoria?meses=${meses}`);
      if (!r.ok) throw new Error("Falha ao carregar o faturamento por categoria");
      return r.json();
    },
  });

  if (isError) return <Cf2ErrorState message="Não foi possível carregar o faturamento por categoria." />;
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3">
        <Cf2Skeleton className="h-20" />
        <Cf2Skeleton className="h-56" />
      </div>
    );
  }

  const series = data.series ?? [];
  const totalMrr = series.reduce((s, l) => s + l.mrr, 0);
  const totalSetup = series.reduce((s, l) => s + l.setup, 0);
  const total = totalMrr + totalSetup;
  const maxMes = Math.max(...series.map((l) => l.total), 1);
  const pctSetup = total > 0 ? Math.round((totalSetup / total) * 100) : 0;
  const ALTURA = 132;

  if (series.length === 0) {
    return <Cf2EmptyState title="Nenhum negócio ganho no período" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Rotula os meses que EXISTEM, não os pedidos: o piso do go-live corta
            a janela, e "12 meses" sobre 3 meses de dado seria mentira. */}
        <Stat destaque
              label={series.length === 1 ? "Faturamento fechado · 1 mês" : `Faturamento fechado · ${series.length} meses`}
              value={brlCheio(total)} cor="ganho"
              sub={`${series.reduce((s, l) => s + l.negocios, 0)} negócios ganhos`} />
        <Stat label="Mensalidade (MRR)" value={brlCheio(totalMrr)}
              sub={`${100 - pctSetup}% do fechado`} />
        <Stat label="Setup e avulso" value={brlCheio(totalSetup)} cor="atencao"
              sub={`${pctSetup}% do fechado — não recorre no mês seguinte`} />
      </div>

      {data.negociosSemValor > 0 && (
        <p
          className="flex items-start gap-2 text-[12px] leading-relaxed rounded-[var(--cf2-radius-md)] px-3 py-2.5"
          style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}
        >
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden />
          {data.negociosSemValor} {data.negociosSemValor === 1 ? "negócio ganho está" : "negócios ganhos estão"} sem
          valor cadastrado e {data.negociosSemValor === 1 ? "não entra" : "não entram"} nestes totais.
        </p>
      )}

      <Secao hint="por mês de ganho — a altura é o faturamento, a divisão mostra de que ele foi feito">
        Composição mês a mês
      </Secao>
      {/* A série começa em 01/07/2026 (go-live). Antes disso os negócios vieram
          da migração do Zoho, com data de reconciliação e não de fechamento —
          plotá-los daria uma curva plausível e errada. Melhor dizer o recorte
          do que fingir 12 meses. */}
      <p className="text-[11px] -mt-2" style={{ color: "var(--cf2-text-tertiary)" }}>
        A série começa no go-live do CRM (julho de 2026). Negócios anteriores vieram da migração do
        Zoho, com data de reconciliação em vez de data real de fechamento.
      </p>
      <div
        className="rounded-2xl border p-4 overflow-x-auto"
        style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}
      >
        {/* `max-w` por coluna: com poucos meses (a janela começa no go-live), o
            `flex-1` puro espalhava 3 barras finas por 1300px de largura. */}
        <div className="flex items-end justify-start gap-4" style={{ height: ALTURA + 46 }}>
          {series.map((l) => (
            <div key={l.mes} className="flex-1 max-w-[120px] min-w-[52px] flex flex-col items-center gap-1">
              <span className="text-[10.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>
                {brl(l.total)}
              </span>
              <div
                className="w-full max-w-16 flex flex-col justify-end"
                style={{ height: ALTURA }}
                title={`${rotuloMes(l.mes!)}: ${brlCheio(l.mrr)} de mensalidade + ${brlCheio(l.setup)} de setup em ${l.negocios} negócios`}
              >
                <div className="w-full rounded-t-sm" style={{ height: (l.setup / maxMes) * ALTURA, background: COR_SETUP }} />
                <div className="w-full rounded-b-sm" style={{ height: (l.mrr / maxMes) * ALTURA, background: COR_MRR }} />
              </div>
              <span className="text-[10.5px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>{rotuloMes(l.mes!)}</span>
            </div>
          ))}
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          {[{ cor: COR_MRR, texto: "Mensalidade" }, { cor: COR_SETUP, texto: "Setup e avulso" }].map((l) => (
            <li key={l.texto} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              <span aria-hidden className="size-2.5 rounded-sm shrink-0" style={{ background: l.cor }} />
              {l.texto}
            </li>
          ))}
        </ul>
      </div>

      <Secao hint="mesmo recorte, por quem fechou">Por pessoa</Secao>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                {["Pessoa", "Mensalidade", "Setup e avulso", "Total", "Negócios"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[10px] font-bold uppercase ${i === 0 ? "" : "text-right"}`}
                    style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.6px" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.porPessoa.map((p) => (
                <tr key={p.nome} className="transition-colors hover:bg-[var(--cf2-bg-surface-muted)]" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                  <td className="px-4 py-2.5 text-[12.5px]" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}</td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
                    {brlCheio(p.mrr)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: p.setup > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }}>
                    {p.setup > 0 ? brlCheio(p.setup) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>
                    {brlCheio(p.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>
                    {p.negocios}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
