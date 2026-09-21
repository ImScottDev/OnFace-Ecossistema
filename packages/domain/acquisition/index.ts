// @onface/acquisition — aquisição como processo, não como campo de lead.
//
// Porta única de entrada de dado externo (SPEC §3.2, §8, §9).

export {
  registrarEntrada,
  type EntradaAquisicao,
  type RepositorioAquisicao,
  type ResultadoEntrada,
  type TipoAquisicao,
  type Atribuicao,
} from "./commands/registrar-entrada";
export {
  moverEtapaDaAquisicao,
  type EtapaAquisicaoCanonica,
  type AlvoDaEtapa,
} from "./commands/mover-etapa-aquisicao";

export {
  boardDeAquisicoes,
  type CardAquisicao,
  type EstagioAquisicao,
  type FiltrosBoard,
} from "./queries/board-pre-vendas";
