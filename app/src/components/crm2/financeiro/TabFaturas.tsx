"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Cf2Skeleton, Cf2ErrorState, Cf2EmptyState } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";
import { FinPainel } from "./pecas";
import { Cf2Paginacao, usePaginacao } from "./Paginacao";
import { fmt, fmtData, PillStatus, ProdutoBadge, STATUS_FATURA } from "./fmt";

const FILTROS = [
  { key: "", label: "Todas" },
  { key: "paga", label: "Pagas" },
  { key: "aberta", label: "Em aberto" },
  { key: "uncollectible", label: "Incobráveis" },
  { key: "void", label: "Canceladas" },
] as const;

/**
 * Faturas — portada de `(crm)/financeiro/components/TabFaturas` (09/09/2026).
 * Lista bruta com o status REAL do Stripe, vencimento, dias em atraso e link
 * da fatura hospedada. Mesma rota (`/api/financeiro/vendas`).
 *
 * 10/09/2026 — recomposição de UI/UX. Esta aba é o ledger bruto e não tem
 * rota de KPI própria, então não recebe faixa de pulso: inventar um total
 * "do mês" a partir das linhas carregadas seria fabricar métrica, que o
 * PRODUCT.md proíbe. O que dá pra afirmar com honestidade é o tamanho e o
 * valor DO RECORTE aberto — e é isso que a régua de resumo diz, com esse
 * rótulo. Os filtros de status saíram de cinco pílulas soltas pra um
 * segmentado sobre superfície muted, igual ao rail de abas do módulo, e a
 * tabela ganhou cabeçalho de painel.
 */
export function TabFaturas({ busca, onAbrirLead }: { busca: string; onAbrirLead: (leadId: string) => void }) {
  const [status, setStatus] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fin-vendas", status, busca],
    queryFn: async () => {
      const r = await fetch(
        `/api/financeiro/vendas?produto=todos&visao=fatura&status=${status}&q=${encodeURIComponent(busca)}`);
      if (!r.ok) throw new Error("Falha ao carregar as faturas");
      return r.json();
    },
  });

  const linhas: Record<string, unknown>[] = data?.rows || [];
  const pag = usePaginacao(linhas);

  // Agregado DO RECORTE, não do mês nem da base: `rows` é o resultado inteiro
  // do filtro (a paginação é client-side), então somar aqui é exato pro que
  // está na tela — e o rótulo diz exatamente isso.
  const totalRecorte = linhas.reduce((a, r) => a + Number(r.valor || 0), 0);
  const rotuloFiltro = FILTROS.find((f) => f.key === status)?.label ?? "Todas";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap gap-1 rounded-[var(--cf2-radius-lg)] p-1"
        role="group"
        aria-label="Filtrar faturas por status"
        style={{ background: "var(--cf2-bg-surface-muted)" }}
      >
        {FILTROS.map((f) => {
          const ativo = status === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              aria-pressed={ativo}
              className="rounded-[var(--cf2-radius-md)] px-3 py-1.5 text-[12px] font-semibold transition-colors"
              style={ativo
                ? {
                  background: "var(--cf2-bg-surface)",
                  color: "var(--cf2-text-primary)",
                  boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.04)",
                }
                : { background: "transparent", color: "var(--cf2-text-secondary)" }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isError ? (
        <Cf2ErrorState message="Não foi possível carregar as faturas." />
      ) : (
        <FinPainel
          titulo={`Faturas · ${rotuloFiltro.toLowerCase()}`}
          dica="status real do Stripe, com competência, vencimento e link da fatura hospedada"
          acao={!isLoading && linhas.length > 0 ? (
            <div className="text-right">
              <p className="text-[13.5px] font-bold tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
                {fmt(totalRecorte)}
              </p>
              <p className="text-[11px] whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>
                {linhas.length.toLocaleString("pt-BR")} {linhas.length === 1 ? "fatura" : "faturas"} neste recorte
              </p>
            </div>
          ) : null}
        >
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => <Cf2Skeleton key={i} className="h-9" />)}
            </div>
          ) : linhas.length === 0 ? (
            <div className="p-6">
              <Cf2EmptyState
                title="Nenhuma fatura"
                description={busca || status ? "Nenhuma fatura bate com esse filtro." : undefined}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <Cf2Table className="min-w-[980px]">
                <Cf2TableHeader>
                  <Cf2TableRow>
                    <Cf2TableHead>Cliente</Cf2TableHead>
                    <Cf2TableHead>Produto</Cf2TableHead>
                    <Cf2TableHead className="text-right">Valor</Cf2TableHead>
                    <Cf2TableHead>Status</Cf2TableHead>
                    <Cf2TableHead>Competência</Cf2TableHead>
                    <Cf2TableHead>Vencimento</Cf2TableHead>
                    <Cf2TableHead>Pagamento</Cf2TableHead>
                    <Cf2TableHead className="text-right">Atraso</Cf2TableHead>
                    <Cf2TableHead className="text-right">Fatura</Cf2TableHead>
                  </Cf2TableRow>
                </Cf2TableHeader>
                <Cf2TableBody>
                  {pag.fatia.map((r, idx) => {
                    const st = STATUS_FATURA[r.status as string]
                      ?? { label: String(r.status), bg: "#f1f5f9", texto: "#475569" };
                    const dias = Number(r.dias_atraso) || 0;
                    return (
                      <Cf2TableRow
                        key={(r.id as string) || `${r.lead_id}-${idx}`}
                        onClick={() => onAbrirLead(r.lead_id as string)}
                        className="cursor-pointer transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
                      >
                        <Cf2TableCell>
                          <p className="text-[12.5px]" style={{ color: "var(--cf2-text-primary)" }}>
                            {(r.empresa || r.nome) as string}
                          </p>
                          <p className="text-[11px] truncate max-w-[200px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                            {(r.email || "") as string}
                          </p>
                        </Cf2TableCell>
                        <Cf2TableCell><ProdutoBadge produto={r.produto as string} /></Cf2TableCell>
                        <Cf2TableCell className="text-right text-[12.5px] font-medium tabular-nums whitespace-nowrap" style={{ color: "var(--cf2-text-primary)" }}>
                          {fmt(r.valor as number)}
                        </Cf2TableCell>
                        <Cf2TableCell><PillStatus estilo={st} /></Cf2TableCell>
                        <Cf2TableCell className="text-[11.5px]" style={{ color: "var(--cf2-text-secondary)" }}>{fmtData(r.competencia)}</Cf2TableCell>
                        <Cf2TableCell className="text-[11.5px]" style={{ color: "var(--cf2-text-secondary)" }}>{fmtData(r.vencimento || r.emitida_em)}</Cf2TableCell>
                        <Cf2TableCell className="text-[11.5px]" style={{ color: "var(--cf2-text-secondary)" }}>{fmtData(r.paga_em)}</Cf2TableCell>
                        <Cf2TableCell
                          className="text-right text-[12.5px] tabular-nums whitespace-nowrap"
                          style={{
                            color: dias > 30 ? "var(--cf2-danger-text)" : dias > 0 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)",
                          }}
                        >
                          {dias > 0 ? `${dias} d` : "—"}
                        </Cf2TableCell>
                        <Cf2TableCell className="text-right">
                          {r.hosted_invoice_url ? (
                            <a
                              href={r.hosted_invoice_url as string}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11.5px] font-medium rounded-[var(--cf2-radius-sm)] hover:underline"
                              style={{ color: "var(--cf2-accent)" }}
                            >
                              Abrir <ExternalLink className="size-3" aria-hidden />
                            </a>
                          ) : (
                            <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>—</span>
                          )}
                        </Cf2TableCell>
                      </Cf2TableRow>
                    );
                  })}
                </Cf2TableBody>
              </Cf2Table>
              </div>
              {/* Fora do `overflow-x-auto`: dentro, a barra herdava a largura
                  mínima da tabela e só aparecia depois de rolar pro lado. */}
              <Cf2Paginacao {...pag} rotulo="faturas" />
            </>
          )}
        </FinPainel>
      )}
    </div>
  );
}
