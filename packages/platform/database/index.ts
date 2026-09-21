// @onface/platform-database — implementação Postgres dos repositórios de domínio.
//
// O domínio define o contrato; a persistência vive aqui. É o que permite testar
// a regra sem banco e trocar a implementação sem tocar na regra.

export { criarRepositorioAquisicao, type Executor } from "./src/repositorio-aquisicao.js";
export { criarRepositorioVendas } from "./src/repositorio-vendas.js";
