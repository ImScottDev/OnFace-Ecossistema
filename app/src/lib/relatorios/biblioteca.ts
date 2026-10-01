import { isAdminView, isPersonalView } from "@/lib/auth/roles";
import { CATALOGO } from "@/lib/metricas/catalogo";

/**
 * Biblioteca de relatórios: o catálogo do que EXISTE de verdade no CRM.
 *
 * Nada aqui é relatório novo nem "relatório salvo" — o produto ainda não tem
 * onde salvar um relatório, e a página não finge que tem. Cada entrada aponta
 * para uma consulta que já roda e já foi validada:
 *
 * - as abas de Insights (componentes de `components/crm2/relatorios`, que leem
 *   as rotas Hono `/api/relatorios/*`), agora com endereço próprio;
 * - as métricas oficiais do Metric Catalog (`lib/metricas/catalogo.ts`), cada
 *   uma com o valor, a definição e o drill-down que o Módulo 12 exige;
 * - o Fechamento Comercial, que tinha tela de dados e planilha no Hono mas
 *   nenhum botão em lugar nenhum;
 * - as exportações que já existiam (Pré-vendas) e a Performance.
 *
 * O acesso espelha o gate do BACKEND de cada consulta. A tela não pode oferecer
 * o que o endpoint vai negar com 403 — isso seria botão mentiroso.
 */

export type Acesso = "todos" | "gestao" | "admin" | "admin_leitor";
export type Formato = "Tela" | "CSV" | "XLSX";

export interface EntradaBiblioteca {
  id: string;
  nome: string;
  area: string;
  descricao: string;
  fonte: string;
  formatos: Formato[];
  acesso: Acesso;
  tipo: "insights" | "metrica" | "fechamento" | "link";
  /** Para tipo "link": onde abre. */
  href?: string;
  /** Exportação direta, quando a lista pode oferecer o download sem abrir. */
  download?: string;
}

export function podeVer(acesso: Acesso, papel: string): boolean {
  if (acesso === "todos") return true;
  if (acesso === "gestao") return !isPersonalView(papel);
  if (acesso === "admin") return isAdminView(papel);
  return isAdminView(papel) || papel === "leitor";
}

const INSIGHTS: EntradaBiblioteca[] = [
  {
    id: "comercial", nome: "Comercial", area: "Vendas", tipo: "insights", acesso: "todos", formatos: ["Tela"],
    descricao: "Fechado no período, win rate, ciclo, ticket, funil de conversão e desempenho por closer. Closer vê o próprio recorte.",
    fonte: "/relatorios/comercial, /equipe e /fechado-mensal",
  },
  {
    id: "sdr", nome: "Pré-vendas (SDR)", area: "Vendas", tipo: "insights", acesso: "todos", formatos: ["Tela"],
    descricao: "Esteira da SDR: contato, qualificação, reuniões agendadas e realizadas, SLA e base parada. SDR vê só a própria linha.",
    fonte: "/relatorios/sdr-esteira",
  },
  {
    id: "atividade-time", nome: "Atividade do time", area: "Time", tipo: "insights", acesso: "gestao", formatos: ["Tela"],
    descricao: "Esforço por pessoa e por dia nos últimos 14 dias, com o feed do dia ao clicar na célula.",
    fonte: "/relatorios/atividade-time",
  },
  {
    id: "pos-venda", nome: "Pós-venda", area: "Clientes", tipo: "insights", acesso: "gestao", formatos: ["Tela"],
    descricao: "Distribuição de NPS, MRR por tipo de contrato e contratos vencendo nos próximos 90 dias.",
    fonte: "/relatorios/pos-venda",
  },
  {
    id: "growth", nome: "Growth", area: "Marketing", tipo: "insights", acesso: "admin", formatos: ["Tela"],
    descricao: "MRR novo, leads, pipeline, investimento, CPL e CAC, com o funil de lead a cliente e reuniões/no-show.",
    fonte: "/relatorios/growth",
  },
  {
    id: "marketing", nome: "Marketing", area: "Marketing", tipo: "insights", acesso: "gestao", formatos: ["Tela"],
    descricao: "Investimento, leads, CPL, qualificados, vendas de mídia e ROAS, com leads por canal, tendências e tracking de UTM.",
    fonte: "/relatorios/marketing, /tracking e /tendencias",
  },
  {
    id: "midia-paga", nome: "Mídia paga", area: "Marketing", tipo: "insights", acesso: "gestao", formatos: ["Tela"],
    descricao: "Investimento, CPL, ROAS e receita atribuída por campanha, conjunto e criativo, com alertas.",
    fonte: "/relatorios/midia-paga",
  },
];

const OUTROS: EntradaBiblioteca[] = [
  {
    id: "performance", nome: "Performance por pessoa", area: "Time", tipo: "link", acesso: "todos", formatos: ["Tela", "CSV"],
    href: "/relatorios/performance",
    descricao: "Faturamento, ganhos, conversão, reuniões e esforço de cada pessoa, lado a lado.",
    fonte: "lib/relatorios/performance",
  },
  {
    id: "fechamento-comercial", nome: "Fechamento comercial", area: "Financeiro", tipo: "fechamento", acesso: "admin_leitor", formatos: ["Tela", "XLSX"],
    descricao: "Vendas fechadas com comprovante de pagamento, agendas realizadas e vendas atribuídas a SDR — a planilha do fechamento do mês.",
    fonte: "/relatorios/fechamento-comercial",
  },
  {
    id: "pre-vendas-exportacao", nome: "Base de pré-vendas", area: "Vendas", tipo: "link", acesso: "todos",
    // "Tela" até /pre-vendas/exportar parar de devolver 500: selo CSV aqui
    // contaria no KPI "Com exportação" um download que hoje não funciona.
    formatos: ["Tela"],
    // Sem `download` direto: /pre-vendas/exportar hoje quebra (500) em lead cujo
    // servicos_interesse não é array. Oferecer "Baixar" aqui seria botão mentiroso;
    // a linha abre Pré-vendas até a rota ser corrigida (ver pedido no relatório).
    href: "/pre-vendas",
    descricao: "Todos os leads em pré-vendas com etapa, responsável, origem, campanha e próxima ação. Para recortar, exporte de dentro de Pré-vendas.",
    fonte: "/pre-vendas/exportar",
  },
];

const METRICAS: EntradaBiblioteca[] = CATALOGO.map((m) => ({
  id: `metrica-${m.codigo}`,
  nome: m.nome,
  area: "Métrica oficial",
  tipo: "metrica" as const,
  acesso: "admin_leitor" as const,
  formatos: ["Tela", "CSV"] as Formato[],
  descricao: m.descricao,
  fonte: m.fonte,
}));

export const BIBLIOTECA: EntradaBiblioteca[] = [...INSIGHTS, ...OUTROS, ...METRICAS];

export function entrada(id: string): EntradaBiblioteca | null {
  return BIBLIOTECA.find((e) => e.id === id) ?? null;
}
