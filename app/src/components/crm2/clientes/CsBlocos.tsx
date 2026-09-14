"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Flag, RefreshCw, TrendingUp, UserX, Wallet } from "lucide-react";
import { Cf2Skeleton } from "@/components/crm2/ui/States";

/**
 * Blocos operacionais da coluna lateral do dashboard de CS.
 *
 * Cada bloco responde uma pergunta que a fila sozinha não responde — "quanto
 * dinheiro está em jogo no financeiro?", "quantos checkpoints venceram?" — e
 * leva de volta pra fila filtrada. Nenhum é decorativo: todos são clicáveis
 * e todos somem quando não têm dado (não viram card vazio).
 */

export interface PainelCs {
  semOwner: { total: number; mrr: string; top: { empresaId: string; nome: string; mrr: string }[] };
  financeiro: {
    clientes: number; mrrImpactado: string; valorEmAberto: string;
    porTipo: { tipo: string; rotulo: string; clientes: number; severidade: string }[];
  };
  checkpoints: {
    atrasados: number; hoje: number; semana: number;
    lista: {
      marcoId: string; empresaId: string; empresa: string; codigo: string; titulo: string;
      dueDate: string; ciclo: number; ownerNome: string | null; mrr: string; estado: "atrasado" | "hoje" | "semana";
    }[];
  };
  renovacoes: {
    d30: number; d60: number; d90: number; total: number;
    lista: { id: string; empresaId: string; empresa: string; vencimento: string; dias: number; valor: string | null; status: string }[];
  };
  expansoes: { total: number; valorTotal: string; porStatus: { status: string; n: number; valor: string }[] };
  /** Contexto de CS por empresa, consumido pela tabela da Carteira. */
  porEmpresa: Record<string, {
    checkpoint: { codigo: string; dueDate: string; atrasado: boolean } | null;
    renovacao: { dias: number; status: string } | null;
    risco: { severidade: string; sinais: number } | null;
  }>;
}

function brl(v: string | number) {
  const n = Number(v || 0);
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function Bloco({
  titulo, icone: Icone, alerta, acao, children,
}: {
  titulo: string; icone: React.ElementType; alerta?: boolean;
  acao?: { texto: string; onClick: () => void }; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-3.5 flex flex-col gap-2.5"
      style={{
        background: "var(--cf2-bg-surface)",
        border: `1px solid ${alerta ? "color-mix(in srgb, var(--cf2-danger-text) 35%, transparent)" : "var(--cf2-border-default)"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icone className="w-3.5 h-3.5" style={{ color: alerta ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }} />
        <p className="text-[11px] font-bold uppercase tracking-wide flex-1" style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.6px" }}>
          {titulo}
        </p>
        {acao && (
          <button onClick={acao.onClick} className="flex items-center gap-0.5 text-[10.5px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>
            {acao.texto} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function Cf2CsBlocos({
  painel, carregando, onSegmento, onEscopoSemDono, onVisao,
}: {
  painel?: PainelCs; carregando: boolean;
  onSegmento: (s: string) => void;
  onEscopoSemDono: () => void;
  onVisao: (v: "renovacoes" | "expansoes" | "carteira" | "agenda") => void;
}) {
  const router = useRouter();

  if (carregando || !painel) {
    return <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Cf2Skeleton key={i} className="h-32" />)}</div>;
  }

  const semOwner = painel.semOwner;
  const fin = painel.financeiro;
  const check = painel.checkpoints;
  const renov = painel.renovacoes;
  const exp = painel.expansoes;

  const checkpointsUrgentes = check.lista.filter((c) => c.estado !== "semana").slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      {/* Sem responsável — hoje é o maior buraco operacional da carteira, e
          por isso vem primeiro e com CTA, não como rodapé cinza. */}
      {semOwner.total > 0 && (
        <Bloco titulo="Sem responsável" icone={UserX} alerta acao={{ texto: "atribuir", onClick: onEscopoSemDono }}>
          <div className="flex items-baseline gap-2">
            <p className="text-[28px] font-semibold leading-none" style={{ color: "var(--cf2-danger-text)", fontFamily: "var(--cf2-font-heading)", letterSpacing: "-1px" }}>
              {semOwner.total}
            </p>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
              clientes · {brl(semOwner.mrr)}/mês sem dono
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            {semOwner.top.slice(0, 3).map((c) => (
              <button
                key={c.empresaId}
                onClick={() => router.push(`/clientes/cs/${c.empresaId}`)}
                className="flex items-center justify-between gap-2 text-[11.5px] text-left hover:underline"
                style={{ color: "var(--cf2-text-secondary)" }}
              >
                <span className="truncate">{c.nome}</span>
                <span className="shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{brl(c.mrr)}</span>
              </button>
            ))}
          </div>
        </Bloco>
      )}

      {/* Financeiro */}
      {fin.clientes > 0 && (
        <Bloco titulo="Financeiro" icone={Wallet} alerta acao={{ texto: "ver fila", onClick: () => onSegmento("financeiro") }}>
          <div className="flex items-baseline gap-2">
            <p className="text-[28px] font-semibold leading-none" style={{ color: "var(--cf2-danger-text)", fontFamily: "var(--cf2-font-heading)", letterSpacing: "-1px" }}>
              {fin.clientes}
            </p>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>clientes com cobrança irregular</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] uppercase" style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.5px" }}>MRR em risco</p>
              <p className="text-[14px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(fin.mrrImpactado)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase" style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.5px" }}>Em aberto</p>
              <p className="text-[14px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(fin.valorEmAberto)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 pt-1" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
            {fin.porTipo.map((t) => (
              <div key={t.tipo} className="flex items-center justify-between text-[11.5px]">
                <span className="truncate" style={{ color: "var(--cf2-text-secondary)" }}>{t.rotulo}</span>
                <span className="shrink-0 font-semibold" style={{ color: t.severidade === "CRITICO" ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }}>
                  {t.clientes}
                </span>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      {/* Checkpoints */}
      {(check.atrasados + check.hoje + check.semana) > 0 && (
        <Bloco titulo="Checkpoints" icone={Flag} alerta={check.atrasados > 0} acao={{ texto: "agenda", onClick: () => onVisao("agenda") }}>
          <div className="flex gap-4">
            {[
              { rotulo: "Atrasados", valor: check.atrasados, alerta: true },
              { rotulo: "Hoje", valor: check.hoje, alerta: false },
              { rotulo: "7 dias", valor: check.semana, alerta: false },
            ].map((c) => (
              <div key={c.rotulo}>
                <p className="text-[10px] uppercase" style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.5px" }}>{c.rotulo}</p>
                <p
                  className="text-[20px] font-semibold leading-none"
                  style={{ color: c.alerta && c.valor > 0 ? "var(--cf2-danger-text)" : "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}
                >
                  {c.valor}
                </p>
              </div>
            ))}
          </div>
          {checkpointsUrgentes.length > 0 && (
            <div className="flex flex-col gap-1 pt-1" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
              {checkpointsUrgentes.map((c) => (
                <button
                  key={c.marcoId}
                  onClick={() => router.push(`/clientes/cs/${c.empresaId}?marco=${c.marcoId}`)}
                  className="flex items-center gap-2 text-left group"
                >
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                    style={{
                      background: c.estado === "atrasado" ? "#fceded" : "var(--cf2-bg-surface-muted)",
                      color: c.estado === "atrasado" ? "var(--cf2-danger-text)" : "var(--cf2-text-secondary)",
                    }}
                  >
                    {c.codigo}
                  </span>
                  <span className="text-[11.5px] truncate flex-1" style={{ color: "var(--cf2-text-secondary)" }}>{c.empresa}</span>
                  <span className="text-[10.5px] shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 font-semibold" style={{ color: "var(--cf2-accent-text, var(--cf2-text-primary))" }}>
                    executar
                  </span>
                </button>
              ))}
            </div>
          )}
        </Bloco>
      )}

      {/* Renovações */}
      {(renov.d30 + renov.d60 + renov.d90) > 0 && (
        <Bloco titulo="Renovações" icone={RefreshCw} acao={{ texto: "ver todas", onClick: () => onVisao("renovacoes") }}>
          <div className="flex gap-4">
            {[["30d", renov.d30], ["60d", renov.d60], ["90d", renov.d90]].map(([rotulo, valor]) => (
              <div key={String(rotulo)}>
                <p className="text-[10px] uppercase" style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.5px" }}>{rotulo}</p>
                <p className="text-[20px] font-semibold leading-none" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {/* Só as que estão dentro da janela de 90 dias. Listar uma que
                vence em 365 dias embaixo de "30d/60d/90d: 0" dava a
                impressão de contador quebrado. */}
            {renov.lista.filter((r) => r.dias <= 90).slice(0, 3).map((r) => (
              <button
                key={r.id}
                onClick={() => router.push(`/clientes/cs/${r.empresaId}`)}
                className="flex items-center justify-between gap-2 text-[11.5px] text-left hover:underline"
                style={{ color: "var(--cf2-text-secondary)" }}
              >
                <span className="truncate">{r.empresa}</span>
                <span className="shrink-0" style={{ color: r.dias <= 30 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }}>{r.dias}d</span>
              </button>
            ))}
          </div>
        </Bloco>
      )}

      {/* Expansões */}
      {exp.total > 0 && (
        <Bloco titulo="Expansões" icone={TrendingUp} acao={{ texto: "ver todas", onClick: () => onVisao("expansoes") }}>
          <div className="flex items-baseline gap-2">
            <p className="text-[28px] font-semibold leading-none" style={{ color: "var(--cf2-success-text)", fontFamily: "var(--cf2-font-heading)", letterSpacing: "-1px" }}>
              {exp.total}
            </p>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
              em aberto{Number(exp.valorTotal) > 0 ? ` · ${brl(exp.valorTotal)}` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            {exp.porStatus.slice(0, 4).map((s) => (
              <div key={s.status} className="flex items-center justify-between text-[11.5px]">
                <span className="truncate" style={{ color: "var(--cf2-text-secondary)" }}>{s.status.replace(/_/g, " ")}</span>
                <span className="shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{s.n}</span>
              </div>
            ))}
          </div>
        </Bloco>
      )}
    </div>
  );
}
