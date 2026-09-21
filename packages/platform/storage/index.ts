// @onface/platform-storage — arquivos: metadado no Postgres, binário no object
// storage (SPEC §32).
//
// Porta de entrada pública. A regra do pacote: ele guarda e entrega arquivo, e
// NÃO decide quem pode ver — autorização é da camada que conhece o ator.

export {
  guardarArquivo,
  entregarArquivo,
  TAMANHO_MAXIMO,
  MIME_PERMITIDOS,
  type ArquivoParaGuardar,
  type ArquivoGuardado,
  type AdaptadorArmazenamento,
  type RepositorioArquivos,
  type EntidadeVinculada,
  type ProvedorArmazenamento,
  type ResultadoGuardar,
  type ResultadoLeitura,
} from "./src/servico-arquivos";

export {
  adaptadorLocal,
  escolherAdaptador,
  configS3DoAmbiente,
  sha256,
  type ConfigS3,
} from "./src/adaptadores";
