import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Itens do módulo Vendas no Sidebar — estrutura corrigida pelo Kauã em 01/09.
 *
 * Tentativa anterior (descartada): criar um macro "Comercial" separado com as
 * 3 frentes dentro. Errado — Vendas é o macro, e **Pipeline é UM item** que
 * abre em Pré-vendas; a troca entre os pipelines acontece no TOPO da página
 * (grupo de botões, ver `Cf2AreaButtons`), não no menu lateral.
 *
 * Por isso `Pipeline` aponta pra `/pre-vendas`: é o pipeline padrão, "a nossa
 * base" nas palavras dele. Prospecção Ativa e Vendas — Oportunidades são
 * outros pipelines da MESMA tela, alcançados pelo seletor do topo, e de
 * propósito NÃO aparecem aqui como itens de menu.
 */
export const VENDAS_TABS: ModuleTabItem[] = [
  { key: "visao-geral", label: "Visão Geral", href: "/vendas" },
  { key: "pipeline", label: "Pipeline", href: "/pre-vendas" },
  { key: "propostas", label: "Propostas", href: "/propostas" },
  { key: "contatos-empresas", label: "Contatos & Empresas", href: "/contatos" },
];
