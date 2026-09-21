// @onface/catalog — catálogo de produtos e política comercial da oferta.
//
// Porta de entrada pública. Nada fora deste arquivo deve ser importado de fora
// do pacote; a fronteira é verificada pelos testes de arquitetura.

export {
  avaliarGanho,
  podeCriarProposta,
  jornadasPosVenda,
  type OfertaComercial,
  type EstadoOportunidade,
  type CondicaoGanho,
  type GatilhoPagamento,
  type Decisao,
} from "./policies/politica-oferta";
