"use client";

import { useQuery } from "@tanstack/react-query";
import { Secao } from "@/components/crm2/relatorios/kit";

type Gestao = {
  tempoPorEtapa: {
    etapa: string;
    encerradas: { n: number; medianaDias: number; mediaDias: number };
    abertas: { n: number; medianaDias: number; maisAntigaDias: number };
  }[];
  conversaoPorOrigem: { origem: string; leads: number; comOportunidade: number; ganhos: number; conversaoPct: number }[];
  tarefasVencidas: { usuarioId: string | null; nome: string; abertas: number; vencidas: number; maisAntigaDias: number }[];
};

const ETAPA: Record<string, string> = { entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação" };
const dias = (d: number) => `${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`;
const TH = "text-right font-medium px-3 py-2.5";
const TD = "px-3 py-2.5 text-right tabular-nums text-[var(--cf2-text-secondary)]";
const CAIXA = "rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-x-auto";
const CAB = "border-y border-[var(--cf2-border-default)] text-[10px] uppercase tracking-wider text-[var(--cf2-text-tertiary)]";

/** Tempo por etapa, conversão por origem e tarefas vencidas (gestão). Fonte: /api/relatorios/gestao. */
export function BlocoGestao({ periodo }: { periodo: string }) {
  const { data, isLoading, isError } = useQuery<Gestao>({
    queryKey: ["relatorios", "gestao", periodo],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/gestao?periodo=${periodo}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });
  if (isError) return <p className="text-sm text-[var(--cf2-text-tertiary)]">Não foi possível carregar tempo por etapa, origem e tarefas vencidas.</p>;
  const vazio = (t: string) => <div className="px-4 py-6 text-center text-sm text-[var(--cf2-text-tertiary)]">{t}</div>;

  return (
    <div className="space-y-4">
      <Secao cor="neutro" hint="quanto o negócio fica em cada etapa; passagens que começaram no período e negócios parados agora">Tempo por etapa do pipeline</Secao>
      <div className={CAIXA}>
        {isLoading ? vazio("Carregando...") : (
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className={CAB}>
              <th className="text-left font-medium px-4 py-2.5">Etapa</th>
              <th className={TH} title="Passagens que começaram no período e já terminaram">Saíram · mediana</th>
              <th className={TH}>Saíram · média</th>
              <th className={TH}>Na etapa agora</th>
              <th className={TH}>Parados · mediana</th>
              <th className={TH}>Mais antigo</th>
            </tr></thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data!.tempoPorEtapa.map((e) => (
                <tr key={e.etapa}>
                  <td className="px-4 py-2.5 font-medium text-[var(--cf2-text-primary)]">{ETAPA[e.etapa] ?? e.etapa}</td>
                  <td className={TD}>{e.encerradas.n > 0 ? `${dias(e.encerradas.medianaDias)} (${e.encerradas.n})` : "—"}</td>
                  <td className={TD}>{e.encerradas.n > 0 ? dias(e.encerradas.mediaDias) : "—"}</td>
                  <td className={TD}>{e.abertas.n}</td>
                  <td className={TD}>{e.abertas.n > 0 ? dias(e.abertas.medianaDias) : "—"}</td>
                  <td className={TD}>{e.abertas.n > 0 ? dias(e.abertas.maisAntigaDias) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Secao cor="neutro" hint="leads criados no período, por origem; conversão = ganhos ÷ leads">Conversão por origem</Secao>
      <div className={CAIXA}>
        {isLoading ? vazio("Carregando...") : data!.conversaoPorOrigem.length === 0 ? vazio("Nenhum lead criado no período") : (
          <table className="w-full text-sm min-w-[480px]">
            <thead><tr className={CAB}>
              <th className="text-left font-medium px-4 py-2.5">Origem</th>
              <th className={TH}>Leads</th><th className={TH}>Viraram oportunidade</th><th className={TH}>Ganhos</th><th className={TH}>Conversão</th>
            </tr></thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data!.conversaoPorOrigem.map((o) => (
                <tr key={o.origem}>
                  <td className="px-4 py-2.5 font-medium text-[var(--cf2-text-primary)]">{o.origem}</td>
                  <td className={TD}>{o.leads}</td><td className={TD}>{o.comOportunidade}</td><td className={TD}>{o.ganhos}</td>
                  <td className={TD}>{o.conversaoPct.toLocaleString("pt-BR")}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Secao cor="neutro" hint="mesmo critério da tela de Atividades: aberta com prazo anterior a hoje">Tarefas vencidas por pessoa</Secao>
      <div className={CAIXA}>
        {isLoading ? vazio("Carregando...") : data!.tarefasVencidas.length === 0 ? vazio("Nenhuma tarefa vencida") : (
          <table className="w-full text-sm min-w-[420px]">
            <thead><tr className={CAB}>
              <th className="text-left font-medium px-4 py-2.5">Pessoa</th>
              <th className={TH}>Abertas</th><th className={TH}>Vencidas</th><th className={TH}>Mais antiga</th>
            </tr></thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data!.tarefasVencidas.map((t) => (
                <tr key={t.usuarioId ?? "sem"}>
                  <td className="px-4 py-2.5 font-medium text-[var(--cf2-text-primary)]">{t.nome}</td>
                  <td className={TD}>{t.abertas}</td><td className={TD}>{t.vencidas}</td><td className={TD}>{t.maisAntigaDias}d em atraso</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
