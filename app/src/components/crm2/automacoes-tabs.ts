import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Abas do módulo Automações (19/08) — mesmo princípio de vendas-tabs.ts.
 * "Fluxos" é o builder real já existente (motor trigger→condição→ação,
 * `lib/crm/automacao-engine.ts`). "Cadências"/"Agentes"/"Execuções" são
 * novas — cada uma lendo dado real que já existe no banco, nunca mock.
 */
export const AUTOMACOES_TABS: ModuleTabItem[] = [
  { key: "fluxos", label: "Fluxos", href: "/automacoes" },
  { key: "cadencias", label: "Cadências", href: "/automacoes/cadencias" },
  { key: "agentes", label: "Agentes", href: "/automacoes/agentes" },
  { key: "execucoes", label: "Execuções", href: "/automacoes/execucoes" },
];
