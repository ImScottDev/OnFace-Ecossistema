// @onface/identity — identidade canônica: empresa, pessoa e vínculo.
//
// Porta única por onde identidade nasce ou é reencontrada (SPEC §6, §40).

export {
  resolverPessoa,
  resolverEmpresa,
  normalizarEmail,
  normalizarTelefone,
  normalizarCnpj,
  dominioCorporativo,
  type DadosPessoa,
  type DadosEmpresa,
  type RepositorioIdentidade,
  type ResolucaoPessoa,
  type ResolucaoEmpresa,
} from "./commands/resolver-identidade.js";
