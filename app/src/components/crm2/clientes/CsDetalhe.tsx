"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { iniciaisEmpresa, corAvatarEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { motivos as motivosAtencao, type Conta as ContaAtencao } from "./SucessoWorkspace";
import { Cf2CsPanel } from "./CsPanel";

const brl = (v: number | string) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ContaData {
  empresa: { id: string; nome: string };
  currentMrr: number;
  responsavel: { id: string; nome: string } | null;
  servicos: { id: string; serviceFamily: string; canonicalProduct: string | null }[];
}

/**
 * Tela dedicada de CS — 10/09/2026, correção pedida pelo Kauã: "CS não deve
 * abrir o Cliente 360, tem que ser a tela de CS mesmo".
 *
 * Achado real ao investigar: `Cf2Cliente360` NUNCA leu `?aba=` da URL (zero
 * `useSearchParams` no arquivo inteiro) — todo deep link do módulo de CS
 * (`CsFila`/`CsBlocos`/`CsWorkspace` mandando `/clientes/:id?aba=cs` ou até só
 * `/clientes/:id`) sempre caía na aba "Resumo" da conta inteira, nunca na
 * aba CS. O trabalho de CS (jornada, riscos, billing, renovação, expansão,
 * churn) já existia pronto em `Cf2CsPanel` — só estava soterrado como a 9ª de
 * 12 abas de uma página que fala de outra coisa.
 *
 * Esta tela é o mesmo `Cf2CsPanel`, com uma identidade mínima da conta (nome,
 * dono, MRR, sinais de atenção) e um link explícito pra quem realmente quiser
 * a conta inteira — em vez de a conta inteira ser o destino padrão de todo
 * clique feito de dentro do CS.
 */
export function Cf2CsDetalhe({ empresaId, marcoInicialId }: { empresaId: string; marcoInicialId?: string | null }) {
  const { data, isLoading } = useQuery<ContaData>({
    queryKey: ["cf2-cliente-360", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/${empresaId}`);
      if (!r.ok) throw new Error("Cliente não encontrado");
      return r.json();
    },
  });

  const { data: contaCs, isLoading: contaCsLoading } = useQuery<{ contas: ContaAtencao[] }>({
    queryKey: ["cf2-cliente-cs", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/clientes-crm2/sucesso?empresaId=${empresaId}`);
      if (!r.ok) return { contas: [] };
      return r.json();
    },
  });

  if (isLoading) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;
  if (!data) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Cliente não encontrado.</p>;

  const { empresa, currentMrr, responsavel, servicos } = data;
  const conta = contaCs?.contas?.[0] ?? null;
  const razoes = conta ? motivosAtencao(conta) : [];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center justify-between gap-4 p-4 rounded-2xl"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 text-[13px] font-bold"
            style={{ background: corAvatarEmpresa(empresa.id), color: TEXTO_SOBRE_AVATAR }}
          >
            {iniciaisEmpresa(empresa.nome)}
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-bold truncate" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{empresa.nome}</p>
            <p className="text-[12px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>
              {brl(currentMrr)}/mês · {responsavel ? `CS: ${responsavel.nome}` : "sem CS responsável"}
            </p>
          </div>
        </div>
        <Link
          href={`/clientes/${empresaId}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold shrink-0"
          style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
        >
          Cliente 360 completo <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {!contaCsLoading && razoes.length > 0 && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "#ef444412" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-danger-text)" }} />
          <div className="flex gap-1.5 flex-wrap">
            {razoes.map((m, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>{m}</span>
            ))}
          </div>
        </div>
      )}

      <Cf2CsPanel
        empresaId={empresaId}
        empresaNome={empresa.nome}
        servicos={servicos}
        marcoInicialId={marcoInicialId}
      />
    </div>
  );
}
