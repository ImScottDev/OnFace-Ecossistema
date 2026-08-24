import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Abas do módulo Automações (19/08) — mesmo princípio de vendas-tabs.ts.
 * "Fluxos" é o builder real já existente (motor trigger→condição→ação,
 * `lib/crm/automacao-engine.ts`). "Cadências"/"Agentes"/"Execuções" são
 * novas — cada uma lendo dado real que já existe no banco, nunca mock.
 *
 * "Agente de IA" (23/08) é o hub novo que organiza tudo que já existe
 * (Agentes/Cadências/Execuções/Propostas, só link — zero duplicação de
 * lógica) mais os conceitos de produto ainda não implementados
 * (Roteadores, Credenciais, Provedores, Conhecimento, Memória, Skills,
 * Casos, Alertas de Uso/Orçamento — schema/rota/código zero, aparecem só
 * como card desabilitado "Em breve"). Primeira aba porque é o ponto de
 * entrada/visão geral do conceito "Agente de IA", não mais um passo do
 * fluxo de construção como as outras.
 */
export const AUTOMACOES_TABS: ModuleTabItem[] = [
  { key: "agente-ia", label: "Agente de IA", href: "/automacoes/agente-ia" },
  { key: "fluxos", label: "Fluxos", href: "/automacoes" },
  { key: "cadencias", label: "Cadências", href: "/automacoes/cadencias" },
  { key: "agentes", label: "Agentes", href: "/automacoes/agentes" },
  { key: "execucoes", label: "Execuções", href: "/automacoes/execucoes" },
];
