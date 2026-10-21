"use client";
import { FinStat } from "./pecas";
import { fmt } from "./fmt";

type Fila = {
  lote: { competencia: string; status: string } | null;
  resumo: { quantidade: number; valor: number };
  pendencias: {
    id: string; linha: number; empresa: string; valor: number;
    familia: string; natureza: string; confianca: string; motivo: string | null;
  }[];
  parcial: boolean;
};

export function FilaExcecoesPabx({ fila, erro }: { fila?: Fila; erro: unknown }) {
  return (
    <section className="rounded-xl border border-[var(--cf2-border-default)] p-4 space-y-3" style={{ background: "var(--cf2-bg-surface)" }}>
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Exceções da última competência</h3>
          <p className="text-xs text-[var(--cf2-text-secondary)]">Pendências persistidas, inclusive de lotes históricos. Nenhuma correção automática.</p>
        </div>
        {fila?.lote && <span className="text-xs text-[var(--cf2-text-secondary)]">{fila.lote.competencia} · {fila.lote.status}</span>}
      </div>
      {erro instanceof Error && <p role="alert" className="text-xs">{erro.message}</p>}
      {!fila?.lote && !erro && <p className="text-xs">Nenhum lote encontrado.</p>}
      {fila?.lote && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FinStat label="Pendências" valor={fila.resumo.quantidade} tom={fila.resumo.quantidade ? "atencao" : "neutro"} />
            <FinStat label="Valor em revisão" valor={fmt(fila.resumo.valor)} sub="não adicionar ao MRR" />
          </div>
          {fila.lote.status === "CLOSED" && fila.resumo.quantidade > 0 &&
            <p role="alert" className="text-xs">Atenção: lote legado fechado ainda possui pendências. Requer retificação auditada.</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="text-left border-b border-[var(--cf2-border-default)]">
                <th className="p-2">Linha</th><th className="p-2">Empresa</th><th className="p-2">Valor</th><th className="p-2">Pendência</th>
              </tr></thead>
              <tbody>{fila.pendencias.map((p) => (
                <tr key={p.id} className="border-b border-[var(--cf2-border-default)]">
                  <td className="p-2">{p.linha}</td><td className="p-2">{p.empresa}</td>
                  <td className="p-2 whitespace-nowrap">{fmt(p.valor)}</td>
                  <td className="p-2">{p.motivo || p.confianca} · {p.familia}/{p.natureza}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {fila.parcial && <p className="text-xs">Exibidas as primeiras 100 exceções.</p>}
          {fila.resumo.quantidade === 0 && <p className="text-xs">Sem pendências neste lote.</p>}
        </>
      )}
    </section>
  );
}
