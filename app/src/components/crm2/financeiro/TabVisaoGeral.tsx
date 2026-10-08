"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Cf2Skeleton, Cf2ErrorState } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";
import { FinBarra, FinIndicador, FinPainel, FinPulso, FinStat } from "./pecas";
import { fmt, fmtK, fmtPct } from "./fmt";

/**
 * Visão geral do financeiro — portada de `(crm)/financeiro/components/TabVisaoGeral`
 * (09/09/2026). MRR com os 5 componentes, ARR, NRR, churn de logo e de receita,
 * unit economics e forecast. Mesma rota (`/api/financeiro/metricas`), mesmos
 * cálculos: só a superfície mudou.
 *
 * 10/09/2026 — recomposição de UI/UX. Antes: card branco com o MRR, quatro
 * cards brancos iguais, e então cinco seções empilhadas na mesma largura e no
 * mesmo peso (componentes, unit economics, forecast, fluxo, renovações). Todas
 * as grandezas do negócio disputavam o mesmo grau de atenção, e o aviso de
 * divergência entre a base de contratos e a carteira canônica — a informação
 * que efetivamente muda a decisão de quem lê — estava enterrado como quarta
 * linha de um parágrafo de apoio.
 *
 * Agora: faixa de pulso escura com o MRR dominante e os quatro sinais de
 * movimento no rail; a divergência sobe pra um alerta próprio com contraste
 * real; e a página passa a ter duas colunas de peso diferente — o movimento do
 * MRR conduz, e economics/forecast ficam num rail de leitura ao lado, em lista
 * comparável em vez de sete cards soltos.
 */
export function TabVisaoGeral() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["fin-metricas"],
    queryFn: async () => {
      const r = await fetch("/api/financeiro/metricas");
      if (!r.ok) throw new Error("Falha ao carregar as métricas");
      return r.json();
    },
  });

  if (isError) return <Cf2ErrorState message="Não foi possível carregar as métricas financeiras." />;
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Cf2Skeleton className="h-40" />
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Cf2Skeleton className="h-64" />
          <Cf2Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const m = data.mrr;
  const c = data.churn;
  const ue = data.unitEconomics;
  const comp = m.componentes;
  const maxComp = Math.max(comp.novo, comp.expansao, comp.reativacao, comp.contracao, comp.churn, 1);
  // Só vale avisar quando a diferença é material (mais de R$ 1) — arredondamento
  // de centavo entre as duas somas não é notícia.
  // Desde 14/09 o Financeiro lê a MESMA fonte canônica do Início e do CS, então
  // este valor deve ser sempre nulo. Continua calculado como verificação: se
  // alguém reintroduzir uma segunda base, a tela avisa em vez de esconder.
  const divergencia = m.canonico != null && Math.abs(m.canonico - m.atual) > 1 ? m.canonico - m.atual : null;
  // Conciliação com a tabela de contratos: diferença aqui é qualidade de dado
  // (contrato sem serviço materializado, ou serviço sem contrato), não MRR.
  const conciliacao = m.contratado != null && Math.abs(m.contratado - m.atual) > 1 ? m.contratado - m.atual : null;

  const porProduto = (m.porProduto as { produto: string; mrr: number; contratos: number }[])
    .map((p) => `${p.produto.toUpperCase()} ${fmtK(p.mrr)} (${p.contratos})`)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <FinPulso
        label="MRR ativo (carteira de serviços)"
        valor={fmt(m.atual)}
        titulo={fmt(m.atual)}
        sub={<>ARR {fmtK(m.arr)} · início do mês {fmtK(m.inicioPeriodo)}<br />{porProduto}</>}
        rodape={
          <>
            Fonte única de MRR: o recorrente faturado no último fechamento (mais assinaturas ativas de
            quem fechou depois) — a mesma base do Início, da Carteira e do CS. Os componentes abaixo
            reconstroem o movimento a partir de mrr_movimentos.
          </>
        }
      >
        <FinStat label="Net MRR growth (mês)" valor={fmt(comp.netGrowth)} tom={comp.netGrowth >= 0 ? "ok" : "critico"} sub="entradas menos perdas" />
        <FinStat label="NRR" valor={fmtPct(c.nrr)} sub="acima de 100% a expansão supera as perdas" tom={c.nrr >= 100 ? "ok" : "atencao"} />
        <FinStat label="Churn de receita (mês)" valor={fmtPct(c.churnReceitaPct)} sub={`${fmt(c.mrrChurned)} perdidos`} tom="critico" />
        <FinStat label="Churn de logo (mês)" valor={fmtPct(c.churnLogoPct)} sub={`${c.logosChurned} de ${c.logosAtivosInicio} clientes`} tom="atencao" />
      </FinPulso>

      {/* Duas bases de MRR conviventes não é detalhe de rodapé: quem compara
          este número com o do Início precisa saber por que eles diferem antes
          de reportar qualquer um dos dois. */}
      {divergencia && (
        <div
          className="flex items-start gap-2.5 rounded-[var(--cf2-radius-lg)] px-4 py-3"
          style={{
            background: "var(--cf2-warning-bg)",
            border: "1px solid color-mix(in srgb, var(--cf2-warning-text) 35%, transparent)",
          }}
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" style={{ color: "var(--cf2-warning-text)" }} />
          <div className="min-w-0 text-[12px] leading-5" style={{ color: "var(--cf2-warning-text)" }}>
            <p className="font-semibold">
              Duas bases de MRR voltaram a divergir em {fmt(Math.abs(divergencia))}
            </p>
            <p className="mt-0.5">
              Esta tela e o Início deveriam ler a mesma carteira canônica de serviços desde 14/09.
              Divergência aqui significa que uma segunda base de MRR foi reintroduzida — conferir
              lib/financeiro/metricas.ts antes de reportar qualquer um dos dois números.
            </p>
          </div>
        </div>
      )}

      {conciliacao != null && (
        <p className="text-[12px] leading-5" style={{ color: "var(--cf2-text-tertiary)" }}>
          Conciliação: os contratos ativos somam {fmt(m.contratado!)} ({m.contratosAtivos} contratos, já
          deduplicados por assinatura). A diferença de {fmt(Math.abs(conciliacao))} para a carteira é
          qualidade de dado — contrato sem serviço materializado ou serviço sem contrato. Detalhe em
          Ajustes → Qualidade de dados.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <FinPainel
          titulo="Movimento do MRR"
          dica="deltas do mês — a soma reconstrói o MRR cobrado via Stripe"
          corpoClassName="p-4"
          // Sem isso a coluna esquerda esticava até a altura de
          // economics + forecast e sobravam ~100px de área morta sob as barras.
          className="xl:self-start"
        >
          <FinBarra label="Novo" valor={comp.novo} max={maxComp} direita={fmt(comp.novo)} tom="ok" />
          <FinBarra label="Expansão" valor={comp.expansao} max={maxComp} direita={fmt(comp.expansao)} tom="ok" />
          <FinBarra label="Reativação" valor={comp.reativacao} max={maxComp} direita={fmt(comp.reativacao)} tom="info" />
          <FinBarra label="Contração" valor={comp.contracao} max={maxComp} direita={`− ${fmt(comp.contracao)}`} tom="atencao" />
          <FinBarra label="Churn" valor={comp.churn} max={maxComp} direita={`− ${fmt(comp.churn)}`} tom="critico" />

          <div
            className="mt-3 flex items-baseline justify-between gap-3 pt-3"
            style={{ borderTop: "1px solid var(--cf2-border-default)" }}
          >
            <span className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>
              Resultado líquido do mês
            </span>
            <span
              className="text-[17px] font-bold tabular-nums whitespace-nowrap"
              style={{
                color: comp.netGrowth >= 0 ? "var(--cf2-success-text)" : "var(--cf2-danger-text)",
                fontFamily: "var(--cf2-font-heading)",
              }}
            >
              {comp.netGrowth >= 0 ? "+" : "− "}{fmt(Math.abs(comp.netGrowth))}
            </span>
          </div>
        </FinPainel>

        <div className="flex flex-col gap-4 min-w-0">
          <FinPainel titulo="Unit economics" dica="LTV e CAC cruzados com a mídia paga">
            <FinIndicador label="ARPU" sub="receita média por cliente ativo" valor={fmt(ue.arpu)} />
            <FinIndicador
              label="LTV médio"
              sub="ARPU ÷ churn de receita (média de 3 meses)"
              valor={ue.ltvMedio ? fmtK(ue.ltvMedio) : "—"}
              tom={ue.ltvMedio ? "ok" : "neutro"}
            />
            <FinIndicador
              label="LTV : CAC"
              sub={ue.cac ? `CAC ${fmt(ue.cac)} (Meta, no período)` : "sem gasto de mídia casado no período"}
              valor={ue.ltvCac ? `${ue.ltvCac.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"}
              tom={ue.ltvCac == null ? "neutro" : ue.ltvCac >= 3 ? "ok" : "atencao"}
            />
            <FinIndicador
              label="CAC payback"
              sub="meses até o cliente pagar a própria aquisição"
              valor={ue.cacPaybackMeses
                ? `${ue.cacPaybackMeses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses`
                : "—"}
            />
          </FinPainel>

          <FinPainel
            titulo="Forecast de MRR"
            dica="base mais a média do crescimento líquido dos últimos 3 meses"
          >
            {(data.forecast as { mes: string; projetado: number; netHistorico: number }[]).map((f, i) => (
              <div
                key={f.mes}
                className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                style={i > 0 ? { borderTop: "1px solid var(--cf2-border-default)" } : undefined}
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{f.mes}</p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                    {f.netHistorico >= 0 ? "+" : ""}{fmt(f.netHistorico)}/mês no histórico
                  </p>
                </div>
                <p
                  className="text-[15px] font-bold tabular-nums whitespace-nowrap shrink-0"
                  style={{
                    color: f.netHistorico >= 0 ? "var(--cf2-text-primary)" : "var(--cf2-warning-text)",
                    fontFamily: "var(--cf2-font-heading)",
                  }}
                >
                  {fmtK(f.projetado)}
                </p>
              </div>
            ))}
          </FinPainel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Os quatro números são DIFERENTES e a tabela os mostra separados
            (v0.13, Módulo 06). MRR é contrato recorrente ativo; Faturado é o
            que foi emitido no mês; Recebido é dinheiro que entrou. Juntar
            qualquer par deles responde a pergunta errada. */}
        <FinPainel titulo="Fluxo por linha de receita" dica="mês corrente" corpoClassName="overflow-x-auto">
          <Cf2Table className="min-w-[520px]">
            <Cf2TableHeader>
              <Cf2TableRow>
                <Cf2TableHead>Linha</Cf2TableHead>
                <Cf2TableHead className="text-right">MRR ativo</Cf2TableHead>
                <Cf2TableHead className="text-right">Faturado</Cf2TableHead>
                <Cf2TableHead className="text-right">Recebido</Cf2TableHead>
                <Cf2TableHead className="text-right">Em aberto</Cf2TableHead>
              </Cf2TableRow>
            </Cf2TableHeader>
            <Cf2TableBody>
              {(["ai", "pabx"] as const).map((linha) => {
                const f = data.fluxo[linha];
                return (
                  <Cf2TableRow key={linha}>
                    <Cf2TableCell className="text-[12.5px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>
                      {linha === "ai" ? "Callface AI (Stripe)" : "PABX (Wevy)"}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-right text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
                      {fmt(f.receitaPrevista)}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-right text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
                      {fmt(f.faturadoMes)}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-right text-[12.5px] tabular-nums whitespace-nowrap font-medium" style={{ color: "var(--cf2-success-text)" }}>
                      {fmt(f.recebidoMes)}
                    </Cf2TableCell>
                    <Cf2TableCell
                      className="text-right text-[12.5px] tabular-nums whitespace-nowrap"
                      style={{ color: f.emAberto > 0 ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }}
                    >
                      {fmt(f.emAberto)}
                    </Cf2TableCell>
                  </Cf2TableRow>
                );
              })}
            </Cf2TableBody>
          </Cf2Table>
          {/* Fatura marcada paga sem pagamento não é caixa. Aparece aqui em vez
              de entrar no "Recebido" e inflar o mês em silêncio. */}
          {(["ai", "pabx"] as const).some((l) => (data.fluxo[l]?.reconciliar?.faturas ?? 0) > 0) ? (
            <p className="mt-3 text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              {(["ai", "pabx"] as const)
                .filter((l) => (data.fluxo[l]?.reconciliar?.faturas ?? 0) > 0)
                .map((l) => `${data.fluxo[l].reconciliar.faturas} fatura(s) de ${l === "ai" ? "Callface AI" : "PABX"} (${fmt(data.fluxo[l].reconciliar.valor)})`)
                .join(" e ")}{" "}
              estão marcadas como pagas sem pagamento registrado. Não entram no
              recebido: é caso de reconciliação.
            </p>
          ) : null}
        </FinPainel>

        <FinPainel
          titulo="Renovações no radar"
          dica="próximos 90 dias"
          corpoClassName="max-h-72 overflow-y-auto"
        >
          {data.renovacoes.length === 0 ? (
            <p className="p-4 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Nenhuma renovação nos próximos 90 dias.
            </p>
          ) : (
            <ul>
              {data.renovacoes.map((r: {
                contratoId: string; empresa: string | null; nome: string | null;
                produto: string; mrr: number; vencimento: string | null; proximaCobranca: string | null;
              }) => (
                <li
                  key={r.contratoId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                  style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
                >
                  <div className="min-w-0">
                    <p className="text-[12.5px] truncate" style={{ color: "var(--cf2-text-primary)" }}>
                      {r.empresa || r.nome}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {r.produto.toUpperCase()}
                      {r.vencimento
                        ? ` · vence ${new Date(`${r.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}`
                        : r.proximaCobranca
                          ? ` · renova ${new Date(r.proximaCobranca).toLocaleDateString("pt-BR")}`
                          : ""}
                    </p>
                  </div>
                  <span className="text-[12.5px] tabular-nums whitespace-nowrap shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>
                    {fmt(r.mrr)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </FinPainel>
      </div>
    </div>
  );
}
