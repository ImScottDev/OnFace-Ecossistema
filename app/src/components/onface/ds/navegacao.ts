import {
  Boxes, CalendarDays, ChartArea, Database, Kanban, LayoutGrid, LayoutTemplate, Palette, Shapes,
  Sparkles, Target, Waves, Workflow, BookOpen,
  type LucideIcon,
} from "lucide-react";

/** Índice das seções do laboratório.
 *
 * Mora fora do LabShell de propósito: a página é Server Component e só precisa
 * da lista de slugs para validar a URL. Importar um valor de um módulo
 * "use client" atravessa a fronteira do RSC e chega como referência de cliente,
 * não como array — foi exatamente assim que `SLUGS_VALIDOS.includes` virou
 * "is not a function" na primeira carga. */
export type ItemNavegacao = { slug: string; rotulo: string; icone: LucideIcon };

export const NAVEGACAO: { grupo: string; itens: ItemNavegacao[] }[] = [
  {
    grupo: "Base",
    itens: [
      { slug: "", rotulo: "Visão geral", icone: BookOpen },
      { slug: "fundacoes", rotulo: "Fundações", icone: Palette },
      { slug: "movimento", rotulo: "Movimento", icone: Waves },
      { slug: "linguagem", rotulo: "Linguagem visual", icone: Shapes },
    ],
  },
  {
    grupo: "Componentes",
    itens: [
      { slug: "componentes", rotulo: "Primitivas", icone: Boxes },
      { slug: "dados", rotulo: "Dados e tabela", icone: Database },
      { slug: "graficos", rotulo: "Gráficos", icone: ChartArea },
      { slug: "quadro", rotulo: "Quadro", icone: Kanban },
    ],
  },
  {
    grupo: "Produto",
    itens: [
      { slug: "registro", rotulo: "Registro e CRM", icone: Target },
      { slug: "nexo", rotulo: "NEXO e IA", icone: Sparkles },
      { slug: "agenda", rotulo: "Agenda", icone: CalendarDays },
      { slug: "fluxos", rotulo: "Fluxos e passos", icone: Workflow },
      { slug: "padroes", rotulo: "Padrões de tela", icone: LayoutTemplate },
      { slug: "layouts", rotulo: "Layouts", icone: LayoutGrid },
    ],
  },
];

export const SLUGS_VALIDOS: string[] = NAVEGACAO.flatMap((g) => g.itens.map((i) => i.slug));
