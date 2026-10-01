"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { tabsListVariants } from "@/components/ui/tabs";
import { Cf2LeadDrawer } from "@/components/crm2/qualificacao/LeadDrawerCf2";
import { FinanceiroWorkspace } from "@/components/crm2/clientes/FinanceiroWorkspace";
import { TabVisaoGeral } from "@/components/crm2/financeiro/TabVisaoGeral";
import { TabCobranca } from "@/components/crm2/financeiro/TabCobranca";
import { TabAssinaturas } from "@/components/crm2/financeiro/TabAssinaturas";
import { TabChurn } from "@/components/crm2/financeiro/TabChurn";
import { TabFaturas } from "@/components/crm2/financeiro/TabFaturas";
import { TabPabx } from "@/components/crm2/financeiro/TabPabx";
import "@/components/onface/vendas/vendas.css";

/**
 * As sete visões da central financeira, com a pergunta que cada uma responde.
 * Herdadas 1:1 de `crm2/financeiro/Workspace` — mesmas abas, mesmas rotas de
 * API (`/api/financeiro/*`, servidas pelo Next em dev e em prod) e mesmas
 * ações (acionar cobrança, importar PABX, conciliar ledger). O que muda é a
 * casca: rail e busca no vocabulário ONFACE (`ov-abas`/`ov-busca`).
 */
export const ABAS_FINANCEIRO = [
  { chave: "visao", rotulo: "Visão geral", busca: false, contexto: "MRR por componente, unit economics, forecast e renovações." },
  { chave: "cobranca", rotulo: "Cobrança", busca: false, contexto: "Fila priorizada de faturas em aberto e clientes em risco." },
  { chave: "assinaturas", rotulo: "Assinaturas", busca: true, contexto: "Contratos recorrentes de Callface AI cobrados via Stripe." },
  { chave: "faturas", rotulo: "Faturas", busca: true, contexto: "Faturas do Stripe e histórico Zoho, por status e por cliente." },
  { chave: "churn", rotulo: "Churn", busca: false, contexto: "Cancelamentos do mês, por categoria e por motivo." },
  { chave: "pabx", rotulo: "PABX", busca: true, contexto: "Receita da linha PABX, importada da planilha mensal da Wevy." },
  { chave: "conciliacao", rotulo: "Conciliação", busca: false, contexto: "Ledger: o que o CRM registra contra o que foi cobrado." },
] as const;

export type AbaFinanceiro = (typeof ABAS_FINANCEIRO)[number]["chave"];

// `aba` do servidor só serve para o primeiro render (SSR e deep-link); depois
// quem manda é a URL lida no cliente, que troca na hora sem ida ao servidor.
// Valor desconhecido cai na Visão geral.
export function Financeiro({ aba }: { aba?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState("");
  const [leadAberto, setLeadAberto] = useState<string | null>(null);
  const ativa = ABAS_FINANCEIRO.find((a) => a.chave === (searchParams.get("aba") ?? aba)) ?? ABAS_FINANCEIRO[0];

  // A aba vive na URL: a fila de cobrança é link que se manda no chat do time,
  // e o reload não pode devolver a pessoa para a Visão geral. `replaceState` e
  // não `router.replace`: a página é force-dynamic e o router refaria o RSC
  // inteiro (6 queries do resumo) a cada clique, com a aba antiga na tela
  // enquanto isso. O Next 16 sincroniza replaceState com useSearchParams.
  // `replace` e não `push`, para o voltar do navegador sair do Financeiro.
  const trocar = (nova: AbaFinanceiro) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (nova === "visao") qs.delete("aba"); else qs.set("aba", nova);
    window.history.replaceState(null, "", qs.toString() ? `${pathname}?${qs}` : pathname);
  };

  // Tablist própria com ids FIXOS, e não o `Abas`/Tabs do Radix: o Radix gera
  // ids com useId e, no browser, o id do servidor e o do cliente divergiram
  // (hydration mismatch em aria-controls/id medido nas 7 abas). Com id fixo o
  // par tab/painel é sempre válido: só a aba ativa aponta `aria-controls`
  // (só um painel existe por vez — cada visão busca a própria API ao montar) e
  // o painel tem `aria-labelledby` na aba ativa. Mesmo padrão do Workspace antigo.
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const teclado = (e: KeyboardEvent) => {
    const i = ABAS_FINANCEIRO.findIndex((a) => a.chave === ativa.chave);
    const n = ABAS_FINANCEIRO.length;
    const alvo = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n
      : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (alvo < 0) return;
    e.preventDefault();
    const chave = ABAS_FINANCEIRO[alvo].chave;
    trocar(chave);
    refs.current[chave]?.focus();
  };

  return (
    <>
      <div className="ov-controles">
        <div role="tablist" aria-label="Visões do financeiro" className={`${tabsListVariants()} h-9`} onKeyDown={teclado}>
          {ABAS_FINANCEIRO.map((a) => {
            const sel = a.chave === ativa.chave;
            return (
              <button
                key={a.chave}
                ref={(el) => { refs.current[a.chave] = el; }}
                type="button"
                role="tab"
                id={`fin-aba-${a.chave}`}
                aria-selected={sel}
                aria-controls={sel ? `fin-painel-${a.chave}` : undefined}
                tabIndex={sel ? 0 : -1}
                data-state={sel ? "active" : "inactive"}
                onClick={() => trocar(a.chave)}
                className="inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {a.rotulo}
              </button>
            );
          })}
        </div>
        {/* Busca só nas visões que filtram por cliente; nas outras ela seria um
            campo que não faz nada. */}
        {ativa.busca ? (
          <label className="ov-busca" style={{ maxWidth: "calc(280 * var(--onface-u))" }}>
            <Search aria-hidden />
            <input
              type="search"
              placeholder="Buscar cliente, e-mail ou empresa"
              aria-label="Buscar no financeiro"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      <p className="onface-pagina-descricao" style={{ margin: "calc(-8 * var(--onface-u)) 0 calc(14 * var(--onface-u))" }}>
        {ativa.contexto}
      </p>

      <div role="tabpanel" id={`fin-painel-${ativa.chave}`} aria-labelledby={`fin-aba-${ativa.chave}`} tabIndex={0} className="outline-none">
        {ativa.chave === "visao" && <TabVisaoGeral />}
        {ativa.chave === "cobranca" && <TabCobranca onAbrirLead={setLeadAberto} />}
        {ativa.chave === "assinaturas" && <TabAssinaturas busca={busca} onAbrirLead={setLeadAberto} produto="ai" />}
        {ativa.chave === "faturas" && <TabFaturas busca={busca} onAbrirLead={setLeadAberto} />}
        {ativa.chave === "churn" && <TabChurn onAbrirLead={setLeadAberto} />}
        {ativa.chave === "pabx" && <TabPabx busca={busca} onAbrirLead={setLeadAberto} />}
        {ativa.chave === "conciliacao" && <FinanceiroWorkspace />}
      </div>

      <Cf2LeadDrawer leadId={leadAberto} open={!!leadAberto} onClose={() => setLeadAberto(null)} />
    </>
  );
}
