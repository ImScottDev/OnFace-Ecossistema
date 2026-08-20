import type { ModuleTabItem } from "./ModuleTabs";

/**
 * Abas oficiais do módulo Vendas (Figma node 206:4, contrato fechado
 * 17/08) — 6 itens fixos, ordem e rótulos exatos. Cada aba é uma ROTA
 * real: as que já têm implementação nova apontam pra ela; as que ainda
 * não têm apontam pro equivalente legado real que já existe (mesmo
 * princípio já usado no Sidebar global — nunca inventar tela nova aqui).
 * Import único: toda página de Vendas usa esta MESMA lista, garantindo
 * que a barra nunca diverge entre telas.
 */
export const VENDAS_TABS: ModuleTabItem[] = [
  { key: "visao-geral", label: "Visão Geral", href: "/vendas" },
  { key: "pre-vendas", label: "Pré-vendas", href: "/pre-vendas" },
  { key: "prospeccao", label: "Prospecção", href: "/prospeccao" },
  { key: "pipeline", label: "Pipeline", href: "/pipeline" },
  { key: "propostas", label: "Propostas", href: "/propostas" },
  { key: "contatos-empresas", label: "Contatos & Empresas", href: "/contatos" },
];
