// @onface/integrations-meta — Lead Ads e Conversions API (SPEC §20).
//
// Adapter de provedor: normaliza e valida o que a Meta manda, e prepara o que
// vai de volta. Não escreve no banco e não decide regra de negócio — quem faz
// isso é o comando de domínio. A fronteira é verificada pelos testes de
// arquitetura.

export {
  normalizarLeadAds,
  chaveDeIdempotencia,
  type LeadAdsBruto,
  type LeadAdsNormalizado,
  type CampoFormularioMeta,
} from "./src/lead-ads";

export {
  montarEventoCapi,
  hashCapi,
  type EventoCapi,
  type ResultadoCapi,
  enviarParaCapi,
} from "./src/conversions-api";
