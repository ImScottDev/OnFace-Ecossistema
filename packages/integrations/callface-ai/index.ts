// @onface/integrations-callface-ai — adapter SOMENTE-LEITURA do SaaS Callface AI.
//
// Ponto de entrada público. Nada fora deste arquivo deve ser importado de fora
// do pacote; a fronteira é verificada pelos testes de arquitetura.
//
// Este pacote é o ÚNICO lugar do ONFACE que conhece o banco do SaaS. Telas,
// rotas, automações, NEXO, Hermes, API pública e n8n leem o modelo local
// normalizado — nenhum deles conhece credencial ou schema do Callface AI.

export {
  configDoAmbiente,
  conexao,
  fecharConexao,
  lerComTransacao,
  type ConfigCallfaceAi,
  type ResultadoLeitura,
} from "./src/conexao";

export {
  lerTenants,
  lerUso,
  medirAmbiguidade,
  lerOrganizacoes,
  lerDetalhe,
  lerUsoDiario,
  lerSaude,
  lerParceiros,
  lerLicencasWhiteLabel,
  lerFaturasDeParceiro,
  lerPlanos,
  lerStripeDasOrganizacoes,
  lerLicencasDasOrganizacoes,
  lerUsuariosDasOrganizacoes,
  lerEquipes,
  lerReceptivos,
  lerRetratoBruto,
  licencaAtivaEm,
  resumirTarifacao,
  type ParceiroCallfaceAi,
  type LicencaWhiteLabelCallfaceAi,
  type FaturaParceiroCallfaceAi,
  type ItemFaturaParceiroCallfaceAi,
  type Bloco,
  type PlanoCallfaceAi,
  type StripeOrgCallfaceAi,
  type LicencaOrgCallfaceAi,
  type UsuarioOrgCallfaceAi,
  type EquipeCallfaceAi,
  type ReceptivoCallfaceAi,
  type RetratoBrutoCallfaceAi,
  type OrganizacaoCallfaceAi,
  type DetalheCallfaceAi,
  type LicencaPorPlano,
  type UsuarioCallfaceAi,
  type UsoDiarioCallfaceAi,
  type SaudeRdsCallfaceAi,
  type TenantCallfaceAi,
  type UsoCallfaceAi,
  type AmbiguidadeGlobal,
} from "./src/leitura";
