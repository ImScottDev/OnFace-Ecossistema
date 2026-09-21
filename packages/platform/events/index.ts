// @onface/platform-events — publicação transacional de evento de domínio.
//
// Estado canônico, domain_event e outbox na MESMA transação (SPEC §24.2).

export {
  publicarEvento,
  projetarTimeline,
  type EventoDominio,
  type ResultadoPublicacao,
  type ExecutorSql,
  type TipoAtor,
} from "./src/publicar-evento";
