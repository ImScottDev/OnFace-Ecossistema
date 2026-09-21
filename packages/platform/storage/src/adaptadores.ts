/**
 * Adaptadores de armazenamento (SPEC §32).
 *
 * Dois, de propósito: disco local **declarado como desenvolvimento**, e S3/R2
 * para valer. Antes havia só disco local, e não por decisão — por omissão. A
 * diferença entre as duas coisas é que uma delas aparece na revisão.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { AdaptadorArmazenamento } from "./servico-arquivos";

export const sha256 = (conteudo: Uint8Array): string =>
  createHash("sha256").update(conteudo).digest("hex");

/**
 * Disco local. Serve para desenvolvimento e NÃO é arquitetura de produção:
 * o arquivo morre com a máquina e não existe para um segundo container.
 */
export function adaptadorLocal(raiz: string): AdaptadorArmazenamento {
  const base = resolve(raiz);
  /** A chave vem de dado nosso, mas travessia de caminho é barata de barrar. */
  const caminhoDe = (chave: string) => {
    const destino = resolve(join(base, chave));
    if (destino !== base && !destino.startsWith(base + sep)) {
      throw new Error(`chave de armazenamento sai da raiz: ${chave}`);
    }
    return destino;
  };

  return {
    provider: "local",
    bucket: null,
    async guardar(chave, conteudo) {
      const caminho = caminhoDe(chave);
      await mkdir(dirname(caminho), { recursive: true });
      await writeFile(caminho, conteudo);
    },
    async ler(chave) {
      return new Uint8Array(await readFile(caminhoDe(chave)));
    },
    async remover(chave) {
      await unlink(caminhoDe(chave)).catch(() => undefined);
    },
    async urlAssinada() {
      // Disco local não assina nada. Devolver null faz a aplicação servir o
      // arquivo com a verificação de permissão dela, que é o comportamento
      // seguro. Um adaptador que fingisse assinar viraria arquivo público.
      return null;
    },
  };
}

export interface ConfigS3 {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  regiao?: string;
  /** R2 e MinIO usam caminho; S3 usa subdomínio. */
  estiloCaminho?: boolean;
}

/** Lê a configuração do ambiente. Devolve null quando não está configurado. */
export function configS3DoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigS3 | null {
  const endpoint = env.STORAGE_ENDPOINT;
  const bucket = env.STORAGE_BUCKET;
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint, bucket, accessKeyId, secretAccessKey,
    regiao: env.STORAGE_REGION ?? "auto",
    estiloCaminho: env.STORAGE_PATH_STYLE !== "false",
  };
}

/**
 * Escolhe o adaptador.
 *
 * Em produção sem configuração de object storage, **falha**: cair no disco
 * local em silêncio é como o produto chegou aqui. Em desenvolvimento, o disco
 * local é o padrão e isso é dito no log.
 */
export function escolherAdaptador(opts: {
  config: ConfigS3 | null;
  raizLocal: string;
  producao: boolean;
  criarS3?: (c: ConfigS3) => AdaptadorArmazenamento;
}): AdaptadorArmazenamento {
  if (opts.config && opts.criarS3) return opts.criarS3(opts.config);
  if (opts.producao) {
    throw new Error(
      "object storage não configurado (STORAGE_ENDPOINT, STORAGE_BUCKET, " +
      "STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY). Em produção o disco " +
      "local não é alternativa: o arquivo morre com a máquina.",
    );
  }
  console.warn("[storage] usando disco local — desenvolvimento apenas, não é arquitetura de produção");
  return adaptadorLocal(opts.raizLocal);
}
