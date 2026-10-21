// @onface/integrations-meta — Lead Ads e Conversions API (SPEC §20).
//
// Adapter de provedor: normaliza e valida o que a Meta manda, e prepara o que
// vai de volta. Não escreve no banco e não decide regra de negócio — quem faz
// isso é o comando de domínio. A fronteira é verificada pelos testes de
// arquitetura.

export {
  normalizarLeadAds,
  chaveDeIdempotencia,
  camposRastreioMeta,
  type LeadAdsBruto,
  type LeadAdsNormalizado,
  type CampoFormularioMeta,
} from "./src/lead-ads";

export {
  montarEventoCapi,
  hashCapi,
  type EventoCapi,
  type ResultadoCapi,
  type CredenciaisCapiEnvio,
  enviarParaCapi,
} from "./src/conversions-api";

export {
  META_API_VERSION_PADRAO,
  metaApiVersion,
  metaGraphUrl,
  credenciaisCapi,
  credenciaisLeadAds,
  credenciaisAds,
  diagnosticoMeta,
  type CredenciaisLeadAds,
  type CredenciaisAds,
} from "./src/config";

export {
  POLITICA_EVENTOS,
  ETAPA_COMO_EVENTO,
  regraDoEvento,
  veioDaMeta,
  idDeterministicoDoEvento,
  type EventoDominioMeta,
  type RegraEvento,
  type Atribuicao,
} from "./src/politica-eventos";

export {
  buscarLeadNaGraph,
  combinar,
  type ResultadoRetrieval,
} from "./src/lead-retrieval";
