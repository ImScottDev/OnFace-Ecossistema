"use client";

import { useQuery } from "@tanstack/react-query";
import { Cf2Skeleton, Cf2ErrorState, Cf2EmptyState } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";
import { FinPainel, FinPulso, FinStat } from "./pecas";
import { Cf2Paginacao, usePaginacao } from "./Paginacao";
import { fmt, fmtData, ProdutoBadge } from "./fmt";

/**
 * Clientes e assinaturas — portada de `(crm)/financeiro/components/TabClientes`
 * (09/09/2026). Mensalidade × total pago (LTV realizado) × último pagamento ×
 * em atraso, por contrato. Mesma rota (`/api/financeiro/inadimplencia`).
 *
 * `produto` separa a linha de receita: "ai" (Stripe) e "pabx" (Wevy) — a aba
 * de PABX reusa este mesmo componente com o outro valor.
 *
 * 10/09/2026 — recomposição de UI/UX. Os cinco KPIs vinham como cinco cards
 * brancos de peso idêntico: previsto, recebido e em atraso são o mesmo dinheiro
 * em três estados, e desenhados como iguais não deixavam ver qual é o total e
 * quanto dele já entrou. Passam a ser faixa de pulso, com a receita prevista do
 * mês como leitura dominante e os outros quatro em rail. A tabela ganhou
 * cabeçalho de painel — antes era uma caixa branca sem título, num módulo em
 * que sete abas mostram tabelas parecidas.
 */
export function TabAssinaturas({
  busca, onAbrirLead, produto = "ai", pulso = true,
}: {
  busca: string;
  onAbrirLead: (leadId: string) => void;
  produto?: "ai" | "pabx";
  /**
   * A aba PABX embute este componente abaixo do próprio pulso (frescor da
   * planilha). Duas faixas escuras empilhadas dariam dois elementos dominantes
   * na mesma tela — lá a carteira entra só como painel.
   */
  pulso?: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["fin-inadimplencia", produto],
    queryFn: async () => {
      const r = await fetch(`/api/financeiro/inadimplencia?produto=${produto}`);
      if (!r.ok) throw new Error("Falha ao carregar as assinaturas");
      return r.json();
    },
  });

  const k = data?.kpis;
  const termo = busca.trim().toLowerCase();
  const linhas: Record<string, unknown>[] = (data?.contratos || []).filter((c: Record<string, unknown>) => {
    if (!termo) return true;
    return [c.nome, c.email, c.empresa, c.contrato].some((s) => String(s || "").toLowerCase().includes(termo));
  });

  const pag = usePaginacao(linhas);

  if (isError) return <Cf2ErrorState message="Não foi possível carregar as assinaturas." />;

  return (
    <div className="flex flex-col gap-4">
      {pulso && (
      <FinPulso
        label="Receita prevista no mês"
        valor={isLoading ? "…" : fmt(k?.receitaPrevista)}
        sub={isLoading
          ? "Carregando a carteira de assinaturas."
          : `${k?.contratosAtivos ?? 0} assinaturas ativas de ${k?.contratosTotal ?? "—"} contratos registrados.`}
      >
        <FinStat
          label="Recebido no mês" valor={isLoading ? "…" : fmt(k?.recebidoMes)} tom="ok"
          sub={!isLoading && Number(k?.receitaPrevista) > 0
            ? `${Math.round((Number(k?.recebidoMes) / Number(k.receitaPrevista)) * 100)}% do previsto`
            : undefined}
        />
        <FinStat
          label="Em atraso" valor={isLoading ? "…" : fmt(k?.valorEmAtraso)}
          sub={isLoading ? undefined : `${k?.clientesEmAtraso ?? 0} clientes`} tom="critico"
        />
        <FinStat
          label="Pendência antiga" valor={isLoading ? "…" : fmt(k?.naoCobradoHistorico)}
          sub="nunca cobrado, fora do mês" tom="atencao"
        />
        <FinStat label="Cancelamentos no mês" valor={isLoading ? "…" : k?.churnsMes ?? 0} tom="atencao" sub="assinaturas encerradas" />
      </FinPulso>
      )}

      <FinPainel
        titulo={produto === "pabx" ? "Carteira PABX" : "Carteira de assinaturas"}
        dica="mensalidade, LTV realizado e atraso por contrato"
        acao={!isLoading && linhas.length > 0 ? (
          <span className="text-[11.5px] whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>
            {linhas.length.toLocaleString("pt-BR")} {linhas.length === 1 ? "contrato" : "contratos"}
          </span>
        ) : null}
      >
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => <Cf2Skeleton key={i} className="h-9" />)}
          </div>
        ) : linhas.length === 0 ? (
          <div className="p-6">
            <Cf2EmptyState
              title={termo ? "Nenhum contrato encontrado" : "Nenhum contrato nesta linha de receita"}
              description={termo ? "Nenhum cliente, e-mail ou contrato bate com essa busca." : undefined}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <Cf2Table className="min-w-[900px]">
              <Cf2TableHeader>
                <Cf2TableRow>
                  <Cf2TableHead>Cliente</Cf2TableHead>
                  <Cf2TableHead>Contrato</Cf2TableHead>
                  <Cf2TableHead className="text-right">Mensalidade</Cf2TableHead>
                  <Cf2TableHead className="text-right">Total pago</Cf2TableHead>
                  <Cf2TableHead className="text-center">Últ. pagamento</Cf2TableHead>
                  <Cf2TableHead className="text-right">Em atraso</Cf2TableHead>
                  <Cf2TableHead className="text-right">Dias</Cf2TableHead>
                  <Cf2TableHead className="text-right">Pendência antiga</Cf2TableHead>
                </Cf2TableRow>
              </Cf2TableHeader>
              <Cf2TableBody>
                {pag.fatia.map((c) => (
                  <Cf2TableRow
                    key={c.contratoId as string}
                    onClick={() => onAbrirLead(c.leadId as string)}
                    className="cursor-pointer transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
                  >
                    <Cf2TableCell>
                      <p className="text-[12.5px]" style={{ color: "var(--cf2-text-primary)" }}>
                        {(c.empresa || c.nome) as string}
                      </p>
                      <p className="text-[11px] truncate max-w-[200px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                        {(c.email || "") as string}
                      </p>
                    </Cf2TableCell>
                    <Cf2TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <ProdutoBadge produto={c.produto as string} />
                        <span className="text-[11.5px] truncate max-w-[200px]" style={{ color: "var(--cf2-text-secondary)" }}>
                          {c.contrato as string}
                        </span>
                      </div>
                    </Cf2TableCell>
                    <Cf2TableCell className="text-right text-[12.5px] font-medium tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>
                      {Number(c.valor) > 0 ? fmt(c.valor as number) : "—"}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-right text-[12.5px] font-medium tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-success-text)" }}>
                      {Number(c.totalPago) > 0 ? fmt(c.totalPago as number) : "—"}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-center text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                      {fmtData(c.ultimoPagamento)}
                    </Cf2TableCell>
                    <Cf2TableCell
                      className="text-right text-[12.5px] tabular-nums whitespace-nowrap"
                      style={{
                        color: Number(c.emAtraso) > 0 ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)",
                        fontWeight: Number(c.emAtraso) > 0 ? 600 : 400,
                      }}
                    >
                      {Number(c.emAtraso) > 0 ? fmt(c.emAtraso as number) : "—"}
                    </Cf2TableCell>
                    <Cf2TableCell
                      className="text-right text-[12.5px] tabular-nums whitespace-nowrap"
                      style={{
                        color: Number(c.diasAtraso) > 30
                          ? "var(--cf2-danger-text)"
                          : Number(c.diasAtraso) > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)",
                      }}
                    >
                      {Number(c.diasAtraso) > 0 ? (c.diasAtraso as number) : "—"}
                    </Cf2TableCell>
                    <Cf2TableCell
                      className="text-right text-[12.5px] tabular-nums whitespace-nowrap"
                      style={{ color: Number(c.naoCobrado) > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }}
                    >
                      {Number(c.naoCobrado) > 0 ? fmt(c.naoCobrado as number) : "—"}
                    </Cf2TableCell>
                  </Cf2TableRow>
                ))}
              </Cf2TableBody>
            </Cf2Table>
            </div>
            {/* Fora do `overflow-x-auto` — ver TabFaturas. */}
            <Cf2Paginacao {...pag} rotulo="contratos" />
          </>
        )}
      </FinPainel>
    </div>
  );
}
