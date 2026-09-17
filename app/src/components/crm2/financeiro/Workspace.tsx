"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Cf2Input } from "@/components/crm2/ui/Input";
import { Cf2LeadDrawer } from "@/components/crm2/qualificacao/LeadDrawerCf2";
import { FinanceiroWorkspace } from "@/components/crm2/clientes/FinanceiroWorkspace";
import { TabVisaoGeral } from "./TabVisaoGeral";
import { TabCobranca } from "./TabCobranca";
import { TabAssinaturas } from "./TabAssinaturas";
import { TabChurn } from "./TabChurn";
import { TabFaturas } from "./TabFaturas";
import { TabPabx } from "./TabPabx";

/**
 * As sete visões, com a pergunta que cada uma responde.
 *
 * O rótulo sozinho ("Cobrança", "Churn") não diz se a aba é leitura ou
 * trabalho. A descrição aparece sob o rail como contexto da visão ativa: é uma
 * linha, não um tooltip escondido, porque quem abre o Financeiro pela primeira
 * vez não sabe que Assinaturas é Stripe e PABX é planilha da Wevy.
 */
const ABAS = [
  { key: "visao", label: "Visão geral", busca: false, contexto: "MRR, componentes do mês, unit economics e forecast." },
  { key: "cobranca", label: "Cobrança", busca: false, contexto: "Fila priorizada de faturas em aberto e clientes em risco." },
  { key: "assinaturas", label: "Assinaturas", busca: true, contexto: "Contratos recorrentes de Callface AI cobrados via Stripe." },
  { key: "faturas", label: "Faturas", busca: true, contexto: "Histórico de faturas emitidas, por status e por cliente." },
  { key: "churn", label: "Churn", busca: false, contexto: "Cancelamentos do mês, por categoria e por motivo." },
  { key: "pabx", label: "PABX", busca: true, contexto: "Receita da linha PABX, importada da planilha mensal da Wevy." },
  { key: "conciliacao", label: "Conciliação", busca: false, contexto: "Ledger: o que o CRM registra contra o que foi cobrado." },
] as const;

type Aba = (typeof ABAS)[number]["key"];

const idAba = (k: Aba) => `fin-aba-${k}`;
const idPainel = (k: Aba) => `fin-painel-${k}`;

/**
 * Central financeira do CRM2 (09/09/2026).
 *
 * Junta duas coisas que estavam separadas por acidente de migração: a
 * conciliação de ledger, que já vivia aqui em `/clientes/financeiro`, e as
 * cinco visões que só existiam na `/financeiro` do shell legado — visão geral
 * de MRR, fila de cobrança, assinaturas, faturas, churn e PABX. Eram telas
 * reais e em uso, não protótipo; ficaram inalcançáveis quando a navegação
 * passou pro CRM2.
 *
 * A aba vive na URL (`?aba=`) e não no estado local: a fila de cobrança é
 * link que se manda no chat do time, e recarregar a página não pode devolver
 * a pessoa pra "Visão geral".
 *
 * 10/09/2026 — revisão de UI/UX. O rail de abas era uma fileira de pílulas com
 * a ativa em preto sólido, competindo em peso com as faixas de dados abaixo, e
 * sem `tabpanel`: `role="tab"` apontava pra nada, então leitor de tela
 * anunciava aba selecionada sem região correspondente. Agora é um segmentado
 * sobre superfície muted (aba ativa em branco, como manda o DESIGN.md), com
 * `aria-controls`/`aria-labelledby` fechando o par e uma linha de contexto
 * dizendo o que a visão ativa responde.
 */
export function FinanceiroCentral() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState("");
  const [leadAberto, setLeadAberto] = useState<string | null>(null);

  const param = searchParams.get("aba");
  const ativa = ABAS.find((a) => a.key === param) ?? ABAS[0];
  const aba = ativa.key;

  const trocarAba = useCallback((nova: Aba) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (nova === "visao") qs.delete("aba"); else qs.set("aba", nova);
    router.replace(qs.toString() ? `?${qs}` : "?", { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {/* Cada aba é uma visão do mesmo assunto, não uma rota: tablist de
              verdade, com as setas do teclado funcionando. */}
          <div
            role="tablist"
            aria-label="Visões do financeiro"
            className="flex flex-1 min-w-0 gap-1 overflow-x-auto rounded-[var(--cf2-radius-lg)] p-1"
            style={{ background: "var(--cf2-bg-surface-muted)" }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = ABAS.findIndex((a) => a.key === aba);
              const prox = e.key === "ArrowRight" ? (i + 1) % ABAS.length : (i - 1 + ABAS.length) % ABAS.length;
              trocarAba(ABAS[prox].key);
              document.getElementById(idAba(ABAS[prox].key))?.focus();
            }}
          >
            {ABAS.map((a) => {
              const selecionada = a.key === aba;
              return (
                <button
                  key={a.key}
                  id={idAba(a.key)}
                  role="tab"
                  aria-selected={selecionada}
                  /**
                   * Só a aba selecionada aponta pro painel: apenas um painel
                   * existe no DOM por vez (as visões são montadas sob demanda),
                   * e `aria-controls` com id inexistente é referência pendurada
                   * — a tecnologia assistiva anuncia um controle que governa
                   * nada. Medido no browser: 6 das 7 abas estavam assim.
                   */
                  aria-controls={selecionada ? idPainel(a.key) : undefined}
                  tabIndex={selecionada ? 0 : -1}
                  onClick={() => trocarAba(a.key)}
                  className="rounded-[var(--cf2-radius-md)] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors"
                  style={selecionada
                    ? {
                      background: "var(--cf2-bg-surface)",
                      color: "var(--cf2-text-primary)",
                      boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.04)",
                    }
                    : { background: "transparent", color: "var(--cf2-text-secondary)" }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          {ativa.busca && (
            <div className="relative w-full sm:w-64 shrink-0">
              <Search
                aria-hidden
                className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--cf2-text-tertiary)" }}
              />
              <Cf2Input
                className="pl-8"
                placeholder="Buscar cliente, e-mail ou empresa"
                aria-label="Buscar no financeiro"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          )}
        </div>

        <p className="text-[12px] leading-snug" style={{ color: "var(--cf2-text-secondary)" }}>
          {ativa.contexto}
        </p>
      </div>

      <div role="tabpanel" id={idPainel(aba)} aria-labelledby={idAba(aba)} tabIndex={-1}>
        {aba === "visao" && <TabVisaoGeral />}
        {aba === "cobranca" && <TabCobranca onAbrirLead={setLeadAberto} />}
        {aba === "assinaturas" && <TabAssinaturas busca={busca} onAbrirLead={setLeadAberto} produto="ai" />}
        {aba === "faturas" && <TabFaturas busca={busca} onAbrirLead={setLeadAberto} />}
        {aba === "churn" && <TabChurn onAbrirLead={setLeadAberto} />}
        {aba === "pabx" && <TabPabx busca={busca} onAbrirLead={setLeadAberto} />}
        {aba === "conciliacao" && <FinanceiroWorkspace />}
      </div>

      <Cf2LeadDrawer leadId={leadAberto} open={!!leadAberto} onClose={() => setLeadAberto(null)} />
    </div>
  );
}
