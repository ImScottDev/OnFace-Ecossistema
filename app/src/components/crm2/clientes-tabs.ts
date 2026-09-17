import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Abas do módulo Clientes — mesmo princípio de vendas-tabs.ts: cada aba é
 * uma rota real, nunca um placeholder fake. "Entrega" foi dividida em
 * Implantação (PABX) e Onboarding (Callface AI) — pedido do Kauã, cada
 * família de serviço com sua própria aba em vez de um guarda-chuva único
 * (a página /clientes/entrega genérica saiu de circulação). O módulo se chama CS e mora
 * em `/clientes/cs` desde 08/09; `/clientes/sucesso` continua existindo como
 * redirect, pra não quebrar link antigo. Financeiro usa a visão operacional nativa do CRM2;
 * as fontes legadas continuam identificadas dentro dela.
 */
export const CLIENTES_TABS: ModuleTabItem[] = [
  { key: "carteira", label: "Carteira", href: "/clientes" },
  { key: "implantacao", label: "Implantação", href: "/clientes/implantacao" },
  { key: "onboarding", label: "Onboarding", href: "/clientes/onboarding" },
  { key: "cs", label: "CS", href: "/clientes/cs" },
  { key: "financeiro", label: "Financeiro", href: "/clientes/financeiro" },
];
