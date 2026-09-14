import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Abas do workspace COMERCIAL (contrato fechado com o Kauã em 01/09) — as três
 * frentes operacionais do funil de aquisição num único workspace, em vez de
 * três páginas isoladas com header próprio cada. Referência funcional mandada
 * por ele: board com faixa de pílulas trocando de aba sem sair da área.
 *
 * Cada aba continua sendo uma ROTA real já existente — nenhuma rota nova,
 * nenhum componente reescrito. O que muda é a moldura: as três passam a
 * compartilhar a mesma faixa de navegação.
 *
 * Ordem = ordem da jornada: inbound entra em Pré-vendas, outbound entra em
 * Prospecção, os dois desembocam em Oportunidades.
 *
 * O que NÃO entra aqui (decisão explícita do Kauã, 01/09): Visão Geral,
 * Propostas e Contatos & Empresas seguem no macro Vendas do Sidebar — são
 * consulta/cadastro, não operação de funil. Ver `vendas-tabs.ts`.
 */
// Rótulos = só o NOME (01/09, 2ª correção do Kauã). Os sufixos
// "— Inbound"/"— Outbound"/"Vendas —" saíram: a aba é curta, o motion já é
// óbvio pelo contexto da tela e o texto extra só engordava a caixa.
export const COMERCIAL_TABS: ModuleTabItem[] = [
  { key: "pre-vendas", label: "Pré-vendas", href: "/pre-vendas" },
  { key: "prospeccao", label: "Prospecção Ativa", href: "/prospeccao" },
  { key: "pipeline", label: "Oportunidades", href: "/pipeline" },
];

/** Rota pertence ao workspace Comercial? Usado pelo Sidebar e pela faixa. */
export function isComercialRoute(pathname: string): boolean {
  return COMERCIAL_TABS.some((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
}
