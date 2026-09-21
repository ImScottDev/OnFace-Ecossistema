// @onface/sales — oportunidade como venda de UM produto (SPEC §11, §15).
//
// Caminho único para ganho: nenhuma rota, webhook ou tela decide por conta.

export {
  avaliarCondicaoDeGanho,
  verificarPodeCriarProposta,
  marcarPerdida,
  type Oportunidade,
  type RepositorioVendas,
  type StatusOportunidade,
  type Resultado,
} from "./commands/oportunidade.js";
