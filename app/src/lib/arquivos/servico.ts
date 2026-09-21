/**
 * Composição do acervo de arquivos (SPEC §32).
 *
 * O pacote `@onface/platform-storage` estava completo — serviço, adaptadores,
 * repositório Postgres, tabelas `file_objects`/`file_links` migradas, testes
 * verdes — e **zero callers**. As duas rotas de upload continuavam chamando
 * `fs.writeFileSync` direto no disco da máquina. É a quarta peça desta refatoração
 * que existia pronta sem ninguém chamar; o padrão está registrado no estado.
 *
 * O que muda ao passar por aqui, além de sair do disco:
 *
 * - **Checksum e deduplicação.** O mesmo arquivo enviado duas vezes vira um
 *   binário só com dois vínculos, em vez de duas cópias que divergem.
 * - **A organização vai na chave.** `<org>/<ab>/<checksum>.<ext>` põe o
 *   isolamento no caminho, não só na consulta: um bug de query não entrega
 *   arquivo de outro cliente.
 * - **Metadado transacional.** Tamanho, MIME e autor viram coluna, não inferência
 *   a partir do nome do arquivo no disco.
 *
 * ## Por que o disco local ainda é permitido aqui
 *
 * `escolherAdaptador` recusa disco local em produção, e está certo. Mas a
 * produção de hoje roda sem `STORAGE_*` e grava anexo em disco: ligar a recusa
 * agora derrubaria upload em produção por causa de uma credencial que ainda não
 * chegou. Então a permissão é explícita e nominal — `STORAGE_ALLOW_LOCAL` — e
 * **apagar essa variável é a virada**, feita quando o object storage existir.
 * Um default silencioso é como o produto chegou até aqui; uma variável que
 * alguém precisa escrever aparece na revisão.
 */
import path from "node:path";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { criarRepositorioArquivos } from "@onface/platform-database";
import {
  guardarArquivo, entregarArquivo, escolherAdaptador, configS3DoAmbiente, sha256,
  type AdaptadorArmazenamento, type ArquivoParaGuardar, type ResultadoGuardar,
  type ResultadoLeitura,
} from "@onface/platform-storage";

export const RAIZ_LOCAL =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

let adaptadorMemo: AdaptadorArmazenamento | null = null;

/** O adaptador é resolvido uma vez: senão o aviso de disco local sai a cada upload. */
export function adaptadorDeArquivos(): AdaptadorArmazenamento {
  if (adaptadorMemo) return adaptadorMemo;
  const toleraLocal = process.env.STORAGE_ALLOW_LOCAL === "true";
  adaptadorMemo = escolherAdaptador({
    config: configS3DoAmbiente(),
    raizLocal: RAIZ_LOCAL,
    producao: process.env.NODE_ENV === "production" && !toleraLocal,
  });
  return adaptadorMemo;
}

const repositorio = () => criarRepositorioArquivos(db as never, sql as never);

/** Guarda o binário e registra o metadado. Validação de tipo/tamanho é do domínio. */
export function guardarNoAcervo(arquivo: ArquivoParaGuardar): Promise<ResultadoGuardar> {
  return guardarArquivo(repositorio(), adaptadorDeArquivos(), sha256, arquivo);
}

/** Entrega o arquivo. A autorização acontece ANTES, em quem conhece o ator. */
export function entregarDoAcervo(
  id: string, organizacaoId: string, segundos = 300,
): Promise<ResultadoLeitura> {
  return entregarArquivo(repositorio(), adaptadorDeArquivos(), id, organizacaoId, segundos);
}

/**
 * Remove o binário e marca o metadado como removido.
 *
 * Só chame depois de confirmar que nenhum outro registro aponta para o mesmo
 * `file_object_id`: com deduplicação por checksum, dois anexos podem dividir o
 * mesmo binário, e apagar o arquivo de um cegaria o outro.
 */
export async function removerDoAcervo(id: string, organizacaoId: string): Promise<void> {
  const repo = repositorio();
  const meta = await repo.buscar(id, organizacaoId);
  if (!meta) return;
  await adaptadorDeArquivos().remover(meta.storageKey);
  await repo.marcarRemovido(id, organizacaoId);
}
