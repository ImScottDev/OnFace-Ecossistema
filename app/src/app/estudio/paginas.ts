/** Título e linha de apoio de cada tela do estúdio.
 *
 * Mora aqui, e não dentro de cada página, porque quem desenha o cabeçalho é a
 * barra do topo: assim o título não gasta uma faixa inteira de altura dentro
 * do conteúdo. Integrar depois = trocar este mapa pela fonte real de metadados
 * da rota. */

export type Pagina = { titulo: string; apoio?: string };

export const PAGINAS: Record<string, Pagina> = {
  "/estudio": { titulo: "Estúdio", apoio: "Preview da nova estrutura" },
  "/estudio/pipeline": { titulo: "Pipeline", apoio: "Oportunidades comerciais, uma família por oportunidade" },
  "/estudio/atendimento": { titulo: "Atendimento", apoio: "Conversas abertas de todos os canais" },
  "/estudio/contatos": { titulo: "Contatos & Empresas", apoio: "Pessoas e contas da operação comercial" },
};

export function resolverPagina(pathname: string): Pagina {
  return PAGINAS[pathname] ?? { titulo: "ONFACE" };
}
