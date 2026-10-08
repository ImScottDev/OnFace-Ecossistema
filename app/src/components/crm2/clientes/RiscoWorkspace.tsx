"use client";

/**
 * Risco / Churn (Documento Mestre v0.13, Módulo 08).
 *
 * Substitui o `ModuloPendente` que ocupava esta rota. O placeholder listava
 * duas dependências e as duas já estavam resolvidas: `lib/cs/riscos` mantém
 * os riscos abertos (`cs_riscos`, reavaliados pelo job `cs-sweep`), e o tipo
 * do risco já separa cobrança de relacionamento.
 *
 * A TELA TEM UMA DECISÃO: separar por QUEM RESOLVE, não por gravidade só.
 * Fatura vencida e assinatura irregular o Financeiro resolve, e o cliente pode
 * nem saber que está em risco. Silêncio e falta de próxima ação o CS resolve,
 * ligando. Numa lista única, o time ataca as contas de "sem próxima ação" e
 * não vê as que estão prestes a cair por cobrança.
 *
 * 01/10: casca ONFACE. Resumo com hierarquia (`PaginaResumo`: o crítico domina
 * e cada severidade recorta a lista), "quem resolve" no trilho de abas das
 * telas de vendas e a lista no vocabulário do protótipo. A linha abre o CS da
 * conta (`/clientes/cs/:empresaId`), que é onde o risco se trata e se resolve;
 * risco de cobrança leva também à fila de cobrança do Financeiro.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PaginaResumo } from "@/components/onface/shell/Pagina";
import { Cf2Skeleton } from "@/components/crm2/ui/States";
import "@/components/onface/vendas/vendas.css";

type Severidade = "CRITICO" | "EM_RISCO" | "ATENCAO";
type Natureza = "cobranca" | "relacionamento" | "entrega";

interface Conta {
  empresaId: string; empresaNome: string;
  severidade: Severidade; peso: number; mrr: number;
  naturezas: Natureza[];
  riscos: Array<{ tipo: string; rotulo: string; severidade: Severidade; desdeDias: number | null; motivo: string | null }>;
  responsavelId: string | null; responsavelNome: string | null;
}

interface Carteira {
  contas: Conta[];
  resumo: {
    contas: number;
    porSeveridade: Record<Severidade, number>;
    mrrPorSeveridade: Record<Severidade, number>;
    porNatureza: Record<Natureza, number>;
    semResponsavel: number;
  };
}

/* Tom da pílula: o mesmo par fundo/texto semântico do DataGrid do DS. */
const SEVERIDADE = {
  CRITICO: { rotulo: "Crítico", bg: "var(--cf2-negativo-bg)", fg: "var(--cf2-negativo-fg)" },
  EM_RISCO: { rotulo: "Em risco", bg: "var(--cf2-atencao-bg)", fg: "var(--cf2-atencao-fg)" },
  ATENCAO: { rotulo: "Atenção", bg: "var(--surface-sunken)", fg: "var(--text-muted)" },
} as const;

const NATUREZA = {
  cobranca: { rotulo: "Cobrança", quem: "O Financeiro resolve: fatura vencida, pagamento recusado, assinatura irregular. O cliente pode nem saber que está em risco." },
  relacionamento: { rotulo: "Relacionamento", quem: "O CS resolve, ligando: silêncio, falta de próxima ação, tarefa vencida, renovação sem contato." },
  entrega: { rotulo: "Entrega", quem: "A Implantação resolve: entrega parada antes de o cliente começar a usar." },
} as const;

/* A lista de atenção passa de 250 contas. Paginar por "mostrar mais" mantém a
   ordem (crítico primeiro, depois MRR) sem a pessoa perder o lugar. */
const PASSO = 40;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const iniciais = (nome: string) =>
  nome.replace(/[|·\-]/g, " ").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export function Cf2RiscoWorkspace() {
  const [natureza, setNatureza] = useState<Natureza | null>(null);
  const [severidade, setSeveridade] = useState<Severidade | null>(null);
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PASSO);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Carteira>({
    queryKey: ["cs-riscos"],
    queryFn: async () => {
      const r = await fetch("/api/cs/riscos");
      if (!r.ok) throw new Error("Falha ao carregar a carteira em risco");
      return r.json();
    },
  });

  const contas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.contas ?? []).filter((c) =>
      (!natureza || c.naturezas.includes(natureza)) &&
      (!severidade || c.severidade === severidade) &&
      (!q || c.empresaNome.toLowerCase().includes(q)));
  }, [data, natureza, severidade, busca]);

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card p-6" style={{ boxShadow: "inset 0 0 0 1px var(--line-hairline)", background: "var(--surface-card)" }}>
        <p className="text-corpo font-semibold" style={{ color: "var(--text-strong)" }}>Não foi possível carregar a carteira em risco.</p>
        <p className="text-apoio" style={{ color: "var(--text-muted)" }}>A leitura vem de /api/cs/riscos. Tente de novo; se persistir, a API pode estar fora do ar.</p>
        <button type="button" onClick={() => refetch()} disabled={isFetching}
          className="inline-flex h-8 items-center rounded-control px-3 text-apoio font-semibold text-white bg-[#d93c1a] hover:bg-[#c2330f] disabled:opacity-60">
          {isFetching ? "Tentando…" : "Tentar de novo"}
        </button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando carteira em risco">
        <Cf2Skeleton className="h-20" /><Cf2Skeleton className="h-10" /><Cf2Skeleton className="h-96" />
      </div>
    );
  }

  const { resumo } = data;
  const alternarSev = (s: Severidade) => { setSeveridade(severidade === s ? null : s); setLimite(PASSO); };
  const filtrado = !!(natureza || severidade || busca.trim());
  const limpar = () => { setNatureza(null); setSeveridade(null); setBusca(""); setLimite(PASSO); };

  // Carteira sem nenhum risco aberto é boa notícia, e a tela diz de onde ela vem.
  if (resumo.contas === 0) {
    return (
      <div className="rounded-card p-6" style={{ boxShadow: "inset 0 0 0 1px var(--line-hairline)", background: "var(--surface-card)" }}>
        <p className="text-corpo font-semibold" style={{ color: "var(--text-strong)" }}>Nenhuma conta com sinal de risco aberto.</p>
        <p className="mt-1 max-w-[68ch] text-apoio" style={{ color: "var(--text-muted)" }}>
          A reavaliação roda de hora em hora a partir de faturas, interações, tarefas e entregas. Quando um sinal aparecer,
          a conta entra aqui separada por quem resolve. Para marcar um risco à mão, abra a conta no Customer Success.
        </p>
        <Link href="/clientes/cs?aba=carteira" className="mt-4 inline-flex h-8 items-center rounded-control px-3 text-apoio font-semibold text-white bg-[#d93c1a] hover:bg-[#c2330f]">
          Abrir carteira do CS
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* MRR POR SEVERIDADE, nunca um total. Somar tudo daria a carteira
          inteira, porque quase toda conta tem algum risco de atenção aberto —
          um número que assusta e não orienta. */}
      <PaginaResumo
        itens={[
          { rotulo: "Crítico", valor: resumo.porSeveridade.CRITICO, detalhe: `${brl(resumo.mrrPorSeveridade.CRITICO)} de MRR`,
            destaque: true, sinal: true, aoSelecionar: () => alternarSev("CRITICO"), ativo: severidade === "CRITICO" },
          { rotulo: "Em risco", valor: resumo.porSeveridade.EM_RISCO, detalhe: `${brl(resumo.mrrPorSeveridade.EM_RISCO)} de MRR`,
            aoSelecionar: () => alternarSev("EM_RISCO"), ativo: severidade === "EM_RISCO" },
          { rotulo: "Atenção", valor: resumo.porSeveridade.ATENCAO, detalhe: `${brl(resumo.mrrPorSeveridade.ATENCAO)} de MRR`,
            aoSelecionar: () => alternarSev("ATENCAO"), ativo: severidade === "ATENCAO" },
          // Conta sem dono não é detalhe: ninguém vai agir nela.
          { rotulo: "Sem responsável", valor: resumo.semResponsavel, detalhe: `de ${resumo.contas} contas em risco`, sinal: true },
        ]}
      />

      {/* A separação que o módulo existe para fazer. Uma conta pode aparecer
          em duas naturezas: são times diferentes precisando agir nela. */}
      <div className="ov-controles">
        <div className="ov-abas" role="group" aria-label="Quem resolve">
          <button type="button" data-ativa={natureza === null} aria-pressed={natureza === null}
            onClick={() => { setNatureza(null); setLimite(PASSO); }}>
            Todas · {resumo.contas}
          </button>
          {(["cobranca", "relacionamento", "entrega"] as const).filter((n) => resumo.porNatureza[n] > 0).map((n) => (
            <button key={n} type="button" data-ativa={natureza === n} aria-pressed={natureza === n}
              onClick={() => { setNatureza(natureza === n ? null : n); setLimite(PASSO); }}>
              {NATUREZA[n].rotulo} · {resumo.porNatureza[n]}
            </button>
          ))}
        </div>
        <label className="ov-busca" style={{ maxWidth: 280 }}>
          <Search aria-hidden />
          <input type="search" placeholder="Buscar conta" aria-label="Buscar conta em risco"
            value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(PASSO); }} />
        </label>
        {natureza === "cobranca" ? (
          <Link href="/financeiro?aba=cobranca" className="ov-controles-cta inline-flex h-8 items-center rounded-control px-3 text-apoio font-semibold text-white bg-[#d93c1a] hover:bg-[#c2330f]">
            Abrir fila de cobrança
          </Link>
        ) : null}
      </div>
      {natureza ? (
        <p className="onface-pagina-descricao" style={{ margin: "-6px 0 14px" }}>{NATUREZA[natureza].quem}</p>
      ) : null}

      <section aria-label="Contas em risco" className="overflow-hidden rounded-card" style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--line-hairline)" }}>
        <header className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line-hairline)" }}>
          <p className="text-apoio font-semibold" style={{ color: "var(--text-strong)" }}>
            {contas.length} {contas.length === 1 ? "conta" : "contas"}
          </p>
          {filtrado ? (
            <button type="button" onClick={limpar} className="text-apoio underline-offset-2 hover:underline" style={{ color: "var(--text-muted)" }}>
              Limpar recorte
            </button>
          ) : null}
          <span className="ml-auto text-micro uppercase" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>
            Crítico primeiro, depois MRR
          </span>
        </header>

        {contas.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-corpo font-semibold" style={{ color: "var(--text-strong)" }}>Nenhuma conta neste recorte.</p>
            <p className="mt-1 text-apoio" style={{ color: "var(--text-muted)" }}>Troque o filtro ou limpe o recorte para ver a carteira inteira em risco.</p>
          </div>
        ) : (
          <ul>
            {contas.slice(0, limite).map((c) => {
              const sev = SEVERIDADE[c.severidade];
              return (
                <li key={c.empresaId} className="border-t border-[var(--line-hairline)] first:border-t-0">
                  <Link
                    href={`/clientes/cs/${c.empresaId}`}
                    className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:grid-cols-[36px_minmax(0,1fr)_96px_120px_150px]"
                  >
                    <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: "#12171d" }}>
                      {iniciais(c.empresaNome)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-corpo font-semibold" style={{ color: "var(--text-strong)" }}>{c.empresaNome}</span>
                      <span className="block truncate text-apoio" style={{ color: "var(--text-muted)" }}>
                        {c.riscos.map((r) => r.rotulo + (r.desdeDias && r.desdeDias > 0 ? ` (aberto há ${r.desdeDias}d)` : "")).join(" · ")}
                      </span>
                    </span>
                    <span className="justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: sev.bg, color: sev.fg }}>
                      {sev.rotulo}
                    </span>
                    <span className="hidden text-right text-apoio font-semibold tabular-nums sm:block" style={{ color: c.mrr > 0 ? "var(--text-strong)" : "var(--text-muted)" }}>
                      {c.mrr > 0 ? `${brl(c.mrr)}/mês` : "sem MRR ativo"}
                    </span>
                    <span className="hidden truncate text-right text-apoio sm:block" style={{ color: c.responsavelNome ? "var(--text-muted)" : "var(--onface-coral-texto)" }}>
                      {c.responsavelNome ?? "Sem responsável"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {contas.length > limite ? (
          <div className="px-4 py-3" style={{ borderTop: "1px solid var(--line-hairline)" }}>
            <button type="button" onClick={() => setLimite((n) => n + PASSO)}
              className="inline-flex h-8 items-center rounded-control px-3 text-apoio font-semibold"
              style={{ boxShadow: "inset 0 0 0 1px var(--line-hairline)", color: "var(--text-strong)" }}>
              Mostrar mais {Math.min(PASSO, contas.length - limite)} de {contas.length - limite}
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
