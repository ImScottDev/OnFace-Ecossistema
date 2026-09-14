"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ListTodo } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Skeleton, Cf2ErrorState, Cf2EmptyState } from "@/components/crm2/ui/States";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { FinBarraEmpilhada, FinPainel, FinPulso, FinStat } from "./pecas";
import { fmt, fmtPct } from "./fmt";

type LinhaFila = {
  faturaId: string; leadId: string; nome: string | null; empresa: string | null;
  valor: number; diasAtraso: number; tentativas: number; temRetryAgendado: boolean;
  hostedInvoiceUrl: string | null; status: string; acionado: boolean;
  acionadoEm: string | null; acionadoPorNome: string | null;
};

type Risco = { leadId: string; nome: string | null; empresa: string | null; mrr: number; motivos: string[] };

function situacao(f: LinhaFila): { texto: string; bg: string; cor: string } {
  if (f.status === "uncollectible") return { texto: "Incobrável", bg: "#fecaca", cor: "#991b1b" };
  if (f.temRetryAgendado) return { texto: "Stripe retentando", bg: "#e0f2fe", cor: "#075985" };
  return { texto: "Régua esgotada — cobrar manual", bg: "var(--cf2-warning-bg)", cor: "#b45309" };
}

/**
 * Cobrança e inadimplência — portada de `(crm)/financeiro/components/TabCobranca`
 * (09/09/2026). Aging em faixas, fila priorizada por recuperabilidade, taxa de
 * recuperação e clientes em risco. Mesmas rotas
 * (`/api/financeiro/cobranca`, `PATCH /api/financeiro/cobranca/:id`).
 *
 * 10/09/2026 — recomposição de UI/UX. Esta é a única superfície do Financeiro
 * onde alguém TRABALHA: as outras seis se leem, esta se executa. E era a que
 * menos parecia trabalho — a fila vinha como sétima coluna de uma tabela de
 * sete, com a ação real ("copiar link", "criar tarefa") no fim de um scroll
 * horizontal de 820px, e o aging desenhado como quatro barras independentes
 * que obrigavam a somar de cabeça pra saber quanto ainda é recuperável.
 *
 * Agora: aging vira uma barra única segmentada (a proporção recuperável/crítico
 * se lê de relance) num painel ao lado dos clientes em risco, e a fila deixa de
 * ser tabela pra ser worklist — cada fatura é uma linha com cliente, situação,
 * valor e as duas ações sempre visíveis, sem scroll lateral. O que estava
 * acionado continua marcado e esmaecido, porque a fila é dividida entre pessoas
 * do time e o estado de quem já ligou é o dado mais caro aqui.
 */
export function TabCobranca({ onAbrirLead }: { onAbrirLead: (leadId: string) => void }) {
  const queryClient = useQueryClient();
  const [copiado, setCopiado] = useState<string | null>(null);
  const [tarefaAlvo, setTarefaAlvo] = useState<{ leadId: string; label: string; titulo: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fin-cobranca"],
    queryFn: async () => {
      const r = await fetch("/api/financeiro/cobranca");
      if (!r.ok) throw new Error("Falha ao carregar a cobrança");
      return r.json();
    },
  });

  const alternarAcionado = useMutation({
    mutationFn: async ({ faturaId, acionado }: { faturaId: string; acionado: boolean }) => {
      const r = await fetch(`/api/financeiro/cobranca/${faturaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acionado }),
      });
      if (!r.ok) throw new Error("Falha ao atualizar o acionamento");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fin-cobranca"] }),
  });

  if (isError) return <Cf2ErrorState message="Não foi possível carregar a fila de cobrança." />;
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Cf2Skeleton className="h-40" />
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Cf2Skeleton className="h-52" />
          <Cf2Skeleton className="h-52" />
        </div>
        <Cf2Skeleton className="h-64" />
      </div>
    );
  }

  const aging = data.aging;
  const rec = data.recuperacao;
  const faixas: { faixa: string; count: number; valor: number }[] = aging.faixas;
  const recuperavel = faixas[0].valor + faixas[1].valor;
  const critico = faixas[2].valor + faixas[3].valor;
  const fila: LinhaFila[] = data.fila ?? [];
  const risco: Risco[] = data.risco ?? [];
  const totalFaturas = faixas.reduce((a, f) => a + f.count, 0);
  const pendentes = fila.filter((f) => !f.acionado).length;

  function copiarLink(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <FinPulso
        label="Total em aberto"
        valor={fmt(aging.total)}
        titulo={fmt(aging.total)}
        tom="critico"
        sub={`${totalFaturas} faturas abertas ou incobráveis · ${pendentes} ainda sem acionamento registrado`}
      >
        <FinStat label="Recuperável (até 30 dias)" valor={fmt(recuperavel)} sub="janela boa — agir agora" tom="atencao" />
        <FinStat label="Crítico (31 dias ou mais)" valor={fmt(critico)} sub="recuperabilidade baixa" tom="critico" />
        <FinStat
          label="Recuperação no mês" valor={fmtPct(rec.taxaPct)}
          sub={`${rec.recuperadas} de ${rec.falhadas} faturas que falharam foram pagas`}
          tom={rec.taxaPct >= 50 ? "ok" : "atencao"}
        />
        <FinStat label="Valor recuperado" valor={fmt(rec.valorRecuperado)} sub="pago após nova tentativa no mês" tom="ok" />
      </FinPulso>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <FinPainel
          titulo="Aging da inadimplência"
          dica="dias desde o vencimento (due_date do Stripe; sem due_date, a emissão)"
          corpoClassName="p-4"
          className="xl:self-start"
        >
          <FinBarraEmpilhada
            total={aging.total}
            fatias={faixas.map((f, i) => ({
              chave: f.faixa,
              label: `${f.faixa} dias (${f.count})`,
              valor: f.valor,
              tom: i <= 1 ? "atencao" : "critico",
              nota: fmt(f.valor),
            }))}
          />
        </FinPainel>

        <FinPainel
          titulo="Clientes em risco"
          dica="past_due no Stripe ou atraso recorrente nos últimos 90 dias"
          corpoClassName="max-h-64 overflow-y-auto"
          // A lista rola, e a linha cortada na borda inferior é o único aviso
          // disso. Com a contagem no cabeçalho a pessoa sabe que existe mais
          // antes de descobrir pelo scroll.
          acao={risco.length > 0 ? (
            <span className="text-[11.5px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
              {risco.length} {risco.length === 1 ? "conta" : "contas"}
            </span>
          ) : null}
        >
          {risco.length === 0 ? (
            <p className="p-4 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Nenhum cliente em risco no momento.
            </p>
          ) : (
            <ul>
              {risco.map((r) => (
                <li key={r.leadId} className="border-b last:border-b-0" style={{ borderColor: "var(--cf2-border-default)" }}>
                  <button
                    onClick={() => onAbrirLead(r.leadId)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{r.empresa || r.nome}</p>
                      <p className="text-[11px]" style={{ color: "var(--cf2-warning-text)" }}>{r.motivos.join(" · ")}</p>
                    </div>
                    <span className="text-[12.5px] tabular-nums whitespace-nowrap shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>
                      {fmt(r.mrr)}/mês
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FinPainel>
      </div>

      <FinPainel
        titulo="Fila de cobrança"
        dica="ordenada por recuperabilidade: atraso recente com valor alto vem primeiro"
        acao={
          fila.length > 0 ? (
            <span className="text-[11.5px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
              {pendentes} de {fila.length} a acionar
            </span>
          ) : null
        }
      >
        {fila.length === 0 ? (
          <div className="p-6">
            <Cf2EmptyState title="Nenhuma fatura em aberto" description="Nada a cobrar no momento." />
          </div>
        ) : (
          <ul>
            {fila.map((f) => {
              const s = situacao(f);
              const cliente = f.empresa || f.nome || "Cliente";
              return (
                <li
                  key={f.faturaId}
                  className="border-b transition-colors last:border-b-0 hover:bg-[var(--cf2-bg-surface-muted)]"
                  style={{
                    borderColor: "var(--cf2-border-default)",
                    // Acionado não sai da fila: o time confere o que já foi
                    // feito antes de ligar de novo. Só perde peso visual.
                    opacity: f.acionado ? 0.6 : 1,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                    <label
                      // O alvo era o quadrado de 16px do input, e este é o
                      // controle mais clicado da tela. 44px no toque, onde não
                      // há mira precisa; 36px no ponteiro, que é folgado sem
                      // custar densidade — medido: 44px em toda largura empurrava
                      // a linha de 55 pra 69px, e a fila tem 100 delas.
                      className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 self-start sm:min-h-[36px] sm:self-center"
                      title={f.acionado && f.acionadoPorNome ? `Acionado por ${f.acionadoPorNome}` : "Marcar como já acionado"}
                    >
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-[var(--cf2-accent)]"
                        checked={f.acionado}
                        aria-label={`Marcar ${cliente} como já acionado`}
                        onChange={(e) => alternarAcionado.mutate({ faturaId: f.faturaId, acionado: e.target.checked })}
                      />
                      <span className="text-[11px] sm:hidden" style={{ color: "var(--cf2-text-secondary)" }}>
                        {f.acionado ? "Acionado" : "Acionar"}
                      </span>
                    </label>

                    <div className="min-w-0 flex-1 basis-full sm:basis-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onAbrirLead(f.leadId)}
                          className="rounded-[var(--cf2-radius-sm)] text-left text-[13.5px] font-semibold hover:underline"
                          style={{ color: "var(--cf2-text-primary)" }}
                        >
                          {cliente}
                        </button>
                        <span
                          className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: s.bg, color: s.cor }}
                        >
                          {s.texto}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px]" style={{ color: "var(--cf2-text-secondary)" }}>
                        <span
                          className="tabular-nums font-semibold"
                          style={{ color: f.diasAtraso > 30 ? "var(--cf2-danger-text)" : "var(--cf2-warning-text)" }}
                        >
                          {f.diasAtraso} dias de atraso
                        </span>
                        {" · "}
                        {f.tentativas === 1 ? "1 tentativa" : `${f.tentativas} tentativas`}
                        {f.acionado && f.acionadoPorNome ? ` · acionado por ${f.acionadoPorNome}` : ""}
                      </p>
                    </div>

                    <p
                      className="shrink-0 text-[17px] font-bold tabular-nums whitespace-nowrap"
                      style={{ color: "var(--cf2-danger-text)", fontFamily: "var(--cf2-font-heading)" }}
                    >
                      {fmt(f.valor)}
                    </p>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Cf2Button
                        variant="secondary" size="sm"
                        title="Criar tarefa de cobrança"
                        onClick={() => setTarefaAlvo({
                          leadId: f.leadId,
                          label: cliente,
                          titulo: `Cobrar ${cliente} — ${fmt(f.valor)} vencido há ${f.diasAtraso} dias`,
                        })}
                      >
                        <ListTodo className="size-3" /> Tarefa
                      </Cf2Button>
                      {f.hostedInvoiceUrl ? (
                        <Cf2Button
                          variant="secondary" size="sm"
                          onClick={() => copiarLink(f.hostedInvoiceUrl!, f.faturaId)}
                        >
                          {copiado === f.faturaId ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {copiado === f.faturaId ? "Copiado" : "Link"}
                        </Cf2Button>
                      ) : (
                        <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>sem link</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </FinPainel>

      <TarefaFormModal
        open={!!tarefaAlvo}
        onClose={() => setTarefaAlvo(null)}
        defaultLeadId={tarefaAlvo?.leadId ?? null}
        defaultLeadLabel={tarefaAlvo?.label ?? null}
        defaultTitulo={tarefaAlvo?.titulo ?? ""}
        defaultTipo="follow_up"
        invalidateKeys={[["tarefas"], ["lead", tarefaAlvo?.leadId ?? null]]}
      />
    </div>
  );
}
