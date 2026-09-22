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
import { Skeleton } from "@/components/ui/skeleton";

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

  // Abas e período moram na mesma linha: são os dois controles que definem o
  // recorte, e separá-los em duas faixas fazia a pessoa varrer a tela de cima
  // a baixo pra montar uma pergunta só.
  const seletorPeriodo = <PeriodSelector value={periodo} onChange={setPeriodo} />;

  return (
    <div className="flex flex-col gap-4">
      {/* A faixa escura de 24px de raio saiu daqui.
       *
       * Ela repetia o título ("Insights" no cabeçalho da página, "Desempenho
       * da operação" logo abaixo) e era o único hero de uma tela que é só
       * consulta. O aviso sobre o histórico do Zoho não se perdeu: virou a
       * descrição da página, que é onde uma ressalva permanente sobre
       * confiança no dado pertence. A frase que sobrava para closer ("Sua
       * meta, seu funil e seus números no período") era descrição de título,
       * não informação — as abas já dizem isso. */}
      {meLoading ? (
        <EsqueletoInsights />
      ) : pessoal && !visaoCompleta ? (
        <>
          {/* Closer e SDR veem a própria performance. Duas abas só, porque é
              o que existe de recorte pessoal — inventar mais viraria menu vazio. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              {[["comercial", "Meu desempenho"], ["sdr", "Minha pré-venda"]].map(([k, label]) => (
                <BotaoAba key={k} ativo={abaPessoalAtiva === k} onClick={() => setAbaPessoal(k)}>{label}</BotaoAba>
              ))}
            </div>
            {seletorPeriodo}
          </div>
          {abaPessoalAtiva === "sdr" ? <TabSdr periodo={periodo} /> : <TabComercialCloser periodo={periodo} />}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              {ABAS.map((t) => (
                <BotaoAba key={t.key} ativo={aba === t.key} onClick={() => setAba(t.key)}>{t.label}</BotaoAba>
              ))}
            </div>
            {seletorPeriodo}
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

/** Enquanto `/api/me` não responde a tela não sabe QUAIS abas existem — o
 * recorte pessoal do closer e a visão completa da gestão têm menus diferentes.
 * Antes disso a página ficava literalmente em branco (`meLoading ? null`). O
 * esqueleto tem a forma do que vem: a linha de abas com o seletor à direita e
 * os dois primeiros blocos de número. */
function EsqueletoInsights() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando insights">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {[72, 88, 80, 110].map((w) => (
            <Skeleton key={w} className="h-7 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <Skeleton className="h-8 w-40 rounded-[var(--radius-control)]" />
      </div>
      <Skeleton className="h-[104px] w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-[220px] w-full rounded-[var(--radius-card)]" />
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
