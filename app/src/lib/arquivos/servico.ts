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
 * ## Disco local continua funcionando sem configurar nada
 *
 * Object storage **não é dependência para rodar**. Sem `STORAGE_*` o serviço usa
 * disco local, exatamente como o produto já fazia, e upload, avatar, anexo e
 * formulário público seguem funcionando no deploy atual sem infraestrutura nova.
 * Trocar `fs.writeFileSync` por "explode se faltar credencial" teria sido
 * substituir um problema arquitetural por uma queda.
 *
 * ## Como será a virada para object storage
 *
 * Em três passos, nenhum deles mexendo em tela ou em URL gravada:
 *
 * 1. **Implementar o adaptador S3/R2** e passá-lo em `criarS3` aqui. É a única
 *    peça de código que falta; o resto do caminho já é agnóstico de provedor.
 * 2. **Configurar** `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`
 *    e `STORAGE_SECRET_ACCESS_KEY`. Com os quatro presentes e o adaptador
 *    existindo, `escolherAdaptador` passa a escolher object storage sozinho.
 * 3. **Ligar** `STORAGE_REQUIRE_OBJECT_STORAGE=true`, que faz a falta de
 *    configuração virar erro em vez de voltar em silêncio para o disco. É o
 *    passo que transforma "deveria estar no S3" em algo que a revisão vê.
 *
 * Os arquivos já gravados continuam válidos: a `storage_key` é a mesma nos dois
 * provedores, e `file_objects.storage_provider` registra onde cada binário está,
 * então a migração dos antigos é uma cópia, não uma reescrita de endereço.
 *
 * Enquanto o passo 1 não acontece, configurar só as variáveis NÃO liga nada —
 * e por isso este módulo avisa alto nesse caso, em vez de deixar quem configurou
 * achando que ligou.
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

  const config = configS3DoAmbiente();
  // O adaptador S3/R2 ainda não existe. Enquanto não existir, `criarS3` fica
  // indefinido e `escolherAdaptador` ignora a configuração — o que seria um
  // silêncio perigoso para quem acabou de preencher as credenciais achando que
  // ligou object storage. Por isso o aviso é explícito.
  const criarS3 = undefined;
  if (config && !criarS3) {
    console.warn(
      "[storage] STORAGE_* configurado, mas o adaptador S3/R2 ainda não foi " +
      "implementado: os arquivos continuam em disco local. Configurar as " +
      "variáveis não liga object storage sozinho.",
    );
  }

  adaptadorMemo = escolherAdaptador({
    config,
    raizLocal: RAIZ_LOCAL,
    criarS3,
    // NÃO é `NODE_ENV === "production"`. Object storage não pode ser requisito
    // para o deploy de hoje subir: sem as credenciais, disco local é o caminho
    // que já funcionava. Esta variável é o passo 3 da virada, ligado de
    // propósito quando o object storage existir, e é o que faz a falta de
    // configuração virar erro em vez de voltar para o disco em silêncio.
    producao: process.env.STORAGE_REQUIRE_OBJECT_STORAGE === "true",
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
