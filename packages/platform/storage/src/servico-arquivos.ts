/**
 * Serviço de arquivos (SPEC §32).
 *
 * O que isto substitui: `fs.writeFileSync` no disco da máquina. O SPEC diz a
 * frase certa, "local personal-Mac storage is not production architecture", e o
 * problema não é elegância. Disco local significa que o arquivo morre com a
 * máquina, não existe para um segundo container, e não tem checksum, retenção
 * nem verificação de permissão na hora de servir.
 *
 * O desenho: **metadado no Postgres, binário no object storage**. A separação
 * importa porque são coisas com ciclos de vida diferentes — o metadado precisa
 * de transação, junção e auditoria; o binário precisa de durabilidade barata.
 *
 * O provedor é um adapter. Disco local continua existindo para desenvolvimento,
 * declarado como tal, em vez de ser o padrão por omissão.
 */

export type ProvedorArmazenamento = "s3" | "r2" | "local";

export interface EntidadeVinculada {
  /**
   * Os valores são os do CHECK `ck_file_links_entity` no banco, não uma lista
   * parecida. A união estava com `cliente` e `comunicacao`, que o banco recusa,
   * e sem `servico_canonico` e `aquisicao`, que ele aceita: tipo que compila e
   * viola constraint é pior que tipo ausente, porque só falha com dado real.
   */
  tipo: "empresa" | "pessoa" | "oportunidade" | "proposta" | "contrato"
      | "servico_canonico" | "fulfillment" | "communication" | "reuniao"
      | "aquisicao";
  id: string;
  /** Para que serve o arquivo nesta entidade: "contrato_assinado", "anexo". */
  papel?: string | null;
}

export interface ArquivoParaGuardar {
  organizacaoId: string;
  nomeOriginal: string;
  mimeType: string;
  conteudo: Uint8Array;
  enviadoPorId?: string | null;
  /** Quando o arquivo pode ser apagado. Null = sem prazo definido. */
  retencaoAte?: Date | null;
  vinculos?: EntidadeVinculada[];
  metadata?: Record<string, unknown>;
}

export interface ArquivoGuardado {
  id: string;
  storageKey: string;
  provider: ProvedorArmazenamento;
  checksum: string;
  tamanhoBytes: number;
}

/** O que um provedor de armazenamento precisa saber fazer. */
export interface AdaptadorArmazenamento {
  readonly provider: ProvedorArmazenamento;
  readonly bucket: string | null;
  guardar(chave: string, conteudo: Uint8Array, mimeType: string): Promise<void>;
  ler(chave: string): Promise<Uint8Array>;
  remover(chave: string): Promise<void>;
  /**
   * URL temporária para o navegador buscar direto.
   *
   * Devolve null quando o provedor não sabe assinar — e aí quem serve é a
   * aplicação, com a verificação de permissão dela. Um provedor que não assina
   * não pode virar "arquivo público" por omissão.
   */
  urlAssinada(chave: string, segundos: number): Promise<string | null>;
}

/** O repositório de METADADO. O binário nunca passa por aqui. */
export interface RepositorioArquivos {
  registrar(dados: {
    organizacaoId: string; provider: string; storageKey: string; bucket: string | null;
    nomeOriginal: string; mimeType: string; tamanhoBytes: number; checksum: string;
    retencaoAte: Date | null; enviadoPorId: string | null; metadata: Record<string, unknown>;
  }): Promise<string>;
  vincular(fileObjectId: string, organizacaoId: string, vinculo: EntidadeVinculada, criadoPorId: string | null): Promise<void>;
  buscar(id: string, organizacaoId: string): Promise<{
    id: string; provider: string; storageKey: string; nomeOriginal: string;
    mimeType: string; tamanhoBytes: number; deletedAt: Date | null;
  } | null>;
  /** Mesmo checksum na mesma organização = mesmo arquivo, não um segundo. */
  acharPorChecksum(organizacaoId: string, checksum: string): Promise<{ id: string; storageKey: string } | null>;
  marcarRemovido(id: string, organizacaoId: string): Promise<void>;
}

export type CalculadorChecksum = (conteudo: Uint8Array) => string;

/** Limite de tamanho, em bytes. Acima disso é upload de outro tipo. */
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;

/**
 * Tipos que o produto aceita. Lista de permissão, não de bloqueio: uma lista de
 * bloqueio está sempre uma extensão atrás de quem quer burlá-la.
 */
export const MIME_PERMITIDOS = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  "text/plain", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", "application/msword",
  "application/zip",
  // Anexos de conversa de WhatsApp (Atendimento): áudio gravado/enviado, vídeo e apresentação.
  "audio/ogg", "audio/webm", "audio/mpeg", "audio/mp4", "audio/aac", "video/mp4", "video/webm", "video/quicktime",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export type ResultadoGuardar =
  | { ok: true; arquivo: ArquivoGuardado; jaExistia: boolean }
  | { ok: false; erro: string; codigo: "TAMANHO" | "TIPO" | "VAZIO" };

/**
 * Guarda o arquivo: valida, calcula checksum, grava o binário e registra o
 * metadado.
 *
 * A ordem importa. O binário vai primeiro e o metadado depois: metadado sem
 * binário é um registro que aponta para o nada, e binário sem metadado é lixo
 * que alguém limpa depois. Das duas falhas, a segunda é a barata.
 */
export async function guardarArquivo(
  repo: RepositorioArquivos,
  adaptador: AdaptadorArmazenamento,
  checksumDe: CalculadorChecksum,
  arquivo: ArquivoParaGuardar,
): Promise<ResultadoGuardar> {
  if (arquivo.conteudo.byteLength === 0) {
    return { ok: false, erro: "arquivo vazio", codigo: "VAZIO" };
  }
  if (arquivo.conteudo.byteLength > TAMANHO_MAXIMO) {
    return {
      ok: false,
      erro: `arquivo de ${Math.round(arquivo.conteudo.byteLength / 1048576)} MB excede o limite de ${TAMANHO_MAXIMO / 1048576} MB`,
      codigo: "TAMANHO",
    };
  }
  if (!MIME_PERMITIDOS.has(arquivo.mimeType)) {
    return { ok: false, erro: `tipo de arquivo não aceito: ${arquivo.mimeType}`, codigo: "TIPO" };
  }

  const checksum = checksumDe(arquivo.conteudo);

  // O mesmo arquivo enviado duas vezes é o mesmo arquivo. Reaproveitar o
  // binário e só criar o vínculo novo economiza armazenamento e, mais
  // importante, mantém uma verdade só sobre aquele conteúdo.
  const existente = await repo.acharPorChecksum(arquivo.organizacaoId, checksum);
  if (existente) {
    for (const v of arquivo.vinculos ?? []) {
      await repo.vincular(existente.id, arquivo.organizacaoId, v, arquivo.enviadoPorId ?? null);
    }
    return {
      ok: true, jaExistia: true,
      arquivo: {
        id: existente.id, storageKey: existente.storageKey, provider: adaptador.provider,
        checksum, tamanhoBytes: arquivo.conteudo.byteLength,
      },
    };
  }

  // A chave carrega a organização: isolamento de tenant no próprio caminho, não
  // só na consulta. Um bug de consulta não vaza arquivo de outro cliente.
  const extensao = arquivo.nomeOriginal.includes(".") ? arquivo.nomeOriginal.split(".").pop() : null;
  const chave = `${arquivo.organizacaoId}/${checksum.slice(0, 2)}/${checksum}${extensao ? `.${extensao}` : ""}`;

  await adaptador.guardar(chave, arquivo.conteudo, arquivo.mimeType);

  const id = await repo.registrar({
    organizacaoId: arquivo.organizacaoId,
    provider: adaptador.provider,
    storageKey: chave,
    bucket: adaptador.bucket,
    nomeOriginal: arquivo.nomeOriginal,
    mimeType: arquivo.mimeType,
    tamanhoBytes: arquivo.conteudo.byteLength,
    checksum,
    retencaoAte: arquivo.retencaoAte ?? null,
    enviadoPorId: arquivo.enviadoPorId ?? null,
    metadata: arquivo.metadata ?? {},
  });

  for (const v of arquivo.vinculos ?? []) {
    await repo.vincular(id, arquivo.organizacaoId, v, arquivo.enviadoPorId ?? null);
  }

  return {
    ok: true, jaExistia: false,
    arquivo: { id, storageKey: chave, provider: adaptador.provider, checksum, tamanhoBytes: arquivo.conteudo.byteLength },
  };
}

export type ResultadoLeitura =
  | { ok: true; url: string; expiraEm: number }
  | { ok: true; conteudo: Uint8Array; mimeType: string; nomeOriginal: string }
  | { ok: false; erro: string; codigo: "NAO_ENCONTRADO" | "REMOVIDO" };

/**
 * Entrega o arquivo: URL assinada quando o provedor sabe assinar, conteúdo
 * quando não sabe.
 *
 * A verificação de permissão acontece ANTES desta chamada, na camada que
 * conhece o ator — o serviço não inventa autorização, e por isso a organização
 * é parâmetro obrigatório da busca.
 */
export async function entregarArquivo(
  repo: RepositorioArquivos,
  adaptador: AdaptadorArmazenamento,
  id: string,
  organizacaoId: string,
  segundosDeValidade = 300,
): Promise<ResultadoLeitura> {
  const meta = await repo.buscar(id, organizacaoId);
  if (!meta) return { ok: false, erro: "arquivo não encontrado", codigo: "NAO_ENCONTRADO" };
  if (meta.deletedAt) return { ok: false, erro: "arquivo removido", codigo: "REMOVIDO" };

  const url = await adaptador.urlAssinada(meta.storageKey, segundosDeValidade);
  if (url) return { ok: true, url, expiraEm: segundosDeValidade };

  const conteudo = await adaptador.ler(meta.storageKey);
  return { ok: true, conteudo, mimeType: meta.mimeType, nomeOriginal: meta.nomeOriginal };
}
