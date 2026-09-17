"use client";

import { useState } from "react";
import TabMarketing from "./TabMarketing";
import TabMidiaPaga from "./TabMidiaPaga";
import TabComercial from "./TabComercial";
import TabComercialCloser from "./TabComercialCloser";
import TabSdr from "./TabSdr";
import TabGrowth from "./TabGrowth";
import TabAtividadeTime from "./TabAtividadeTime";
import TabPosVenda from "./TabPosVenda";
import PeriodSelector from "./PeriodSelector";
import { useMe } from "@/lib/useMe";
import { isAdminView } from "@/lib/auth/roles";

/**
 * Insights — migrado do shell legado `(crm)/relatorios` (08/09/2026).
 *
 * O conteúdo das 8 abas foi preservado: são queries e regras de cálculo já
 * validadas, e reescrevê-las por causa do tema seria trocar risco por
 * estética. O que mudou foi a camada visual — as primitivas (`kit.tsx`,
 * `charts/*`) e as cores passaram pro tema claro do CRM2, e a rampa branca
 * dos gráficos virou a paleta de ardósia de `paleta.ts`, porque branco
 * translúcido sobre fundo claro é série invisível.
 */

const ABAS = [
  { key: "comercial", label: "Comercial" },
  { key: "sdr", label: "Pré-vendas" },
  { key: "pos-venda", label: "Pós-venda" },
  { key: "atividade-time", label: "Atividade do time" },
  { key: "growth", label: "Growth" },
  { key: "marketing", label: "Marketing" },
  { key: "midia-paga", label: "Mídia paga" },
] as const;

export function Cf2RelatoriosWorkspace() {
  // Papel EFETIVO (respeita view-as) decide a visão. Segurança real é no backend.
  const { data: me, isLoading: meLoading } = useMe();
  const role = me?.role ?? "";
  const isSdr = role === "sdr";
  const isCloser = role === "closer" || role === "vendedor";
  const visaoCompleta = isAdminView(role) || role === "leitor";

  // Período compartilhado por todas as abas (trocar de aba mantém o range).
  // Trava em HISTORICO_CONFIAVEL_DESDE (lib/relatorios/periodo.ts) — dado
  // anterior à migração do Zoho (12/06/2026) não é confiável.
  const [periodo, setPeriodo] = useState("mes_atual");
  const [aba, setAba] = useState<string>("comercial");
  const [abaPessoal, setAbaPessoal] = useState<string | null>(null);

  const pessoal = isCloser || isSdr;
  const abaPessoalAtiva = abaPessoal ?? (isSdr ? "sdr" : "comercial");

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 rounded-[24px]"
        data-cf2-superficie="escura"
        style={{ background: "var(--cf2-home-hero-bg)" }}
      >
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase"
            style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "1.6px", fontFamily: "var(--cf2-font-heading)" }}
          >
            Insights
          </p>
          <h1
            className="text-[20px] font-semibold leading-tight"
            style={{ color: "var(--cf2-home-text-strong)", fontFamily: "var(--cf2-font-heading)", letterSpacing: "-0.32px" }}
          >
            {isCloser ? "Meu desempenho" : "Desempenho da operação"}
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-home-text-muted)" }}>
            {isCloser
              ? "Sua meta, seu funil e seus números no período."
              : "Histórico confiável a partir de 12/06/2026, quando a base saiu do Zoho."}
          </p>
        </div>
        {!meLoading && (
          <div className="shrink-0">
            <PeriodSelector value={periodo} onChange={setPeriodo} />
          </div>
        )}
      </div>

      {meLoading ? null : pessoal && !visaoCompleta ? (
        <>
          {/* Closer e SDR veem a própria performance. Duas abas só, porque é
              o que existe de recorte pessoal — inventar mais viraria menu vazio. */}
          <div className="flex items-center gap-1 flex-wrap">
            {[["comercial", "Meu desempenho"], ["sdr", "Minha pré-venda"]].map(([k, label]) => (
              <BotaoAba key={k} ativo={abaPessoalAtiva === k} onClick={() => setAbaPessoal(k)}>{label}</BotaoAba>
            ))}
          </div>
          {abaPessoalAtiva === "sdr" ? <TabSdr periodo={periodo} /> : <TabComercialCloser periodo={periodo} />}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1 flex-wrap">
            {ABAS.map((t) => (
              <BotaoAba key={t.key} ativo={aba === t.key} onClick={() => setAba(t.key)}>{t.label}</BotaoAba>
            ))}
          </div>

          {aba === "sdr" && <TabSdr periodo={periodo} />}
          {aba === "comercial" && <TabComercial periodo={periodo} />}
          {aba === "atividade-time" && <TabAtividadeTime />}
          {aba === "pos-venda" && <TabPosVenda />}
          {aba === "growth" && <TabGrowth periodo={periodo} />}
          {aba === "marketing" && <TabMarketing periodo={periodo} />}
          {aba === "midia-paga" && <TabMidiaPaga periodo={periodo} />}
        </>
      )}
    </div>
  );
}

function BotaoAba({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors"
      style={{
        background: ativo ? "var(--cf2-bg-inverse)" : "transparent",
        color: ativo ? "#fff" : "var(--cf2-text-secondary)",
      }}
    >
      {children}
    </button>
  );
}
