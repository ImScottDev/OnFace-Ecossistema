import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Abas do módulo Clientes — mesmo princípio de vendas-tabs.ts: cada aba é
 * uma rota real, nunca um placeholder fake. "Entrega" foi dividida em
 * Implantação (PABX) e Onboarding (Callface AI) — pedido do Kauã, cada
 * família de serviço com sua própria aba em vez de um guarda-chuva único
 * (a página /clientes/entrega genérica saiu de circulação). Financeiro
 * aponta pro legado real (ainda não migrado pro cf2, mesmo princípio do
 * Sidebar global — nunca inventar tela nova aqui).
 */
export const CLIENTES_TABS: ModuleTabItem[] = [
  { key: "carteira", label: "Carteira", href: "/clientes" },
  { key: "implantacao", label: "Implantação", href: "/clientes/implantacao" },
  { key: "onboarding", label: "Onboarding", href: "/clientes/onboarding" },
  { key: "sucesso", label: "Sucesso", href: "/clientes/sucesso" },
  { key: "financeiro", label: "Financeiro", href: "/financeiro" },
];
