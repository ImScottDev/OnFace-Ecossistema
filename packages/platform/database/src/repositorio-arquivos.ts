/**
 * Implementação Postgres do repositório de arquivos (SPEC §32).
 *
 * Só metadado. O binário nunca passa por aqui, e é essa separação que permite
 * trocar o provedor de armazenamento sem tocar em consulta nenhuma.
 */
import type { RepositorioArquivos, EntidadeVinculada } from "../../storage/src/servico-arquivos";

export interface Executor {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

export function criarRepositorioArquivos(db: Executor, sql: SqlTag): RepositorioArquivos {
  const um = async <T>(q: unknown): Promise<T | null> => ((await db.execute<T>(q))[0] ?? null);
  // postgres.js quebra com Date cru dentro do template; gotcha conhecido aqui.
  const ts = (d: Date | null) => (d ? d.toISOString() : null);

  return {
    async registrar(d) {
      const r = await um<{ id: string }>(sql`
        INSERT INTO file_objects (
          organizacao_id, storage_provider, storage_key, bucket, nome_original,
          mime_type, tamanho_bytes, checksum_sha256, retencao_ate, enviado_por_id, metadata
        ) VALUES (
          ${d.organizacaoId}::uuid, ${d.provider}, ${d.storageKey}, ${d.bucket},
          ${d.nomeOriginal}, ${d.mimeType}, ${d.tamanhoBytes}, ${d.checksum},
          ${ts(d.retencaoAte)}::timestamptz, ${d.enviadoPorId}::uuid,
          ${JSON.stringify(d.metadata)}::jsonb
        )
        RETURNING id`);
      if (!r) throw new Error("falha ao registrar metadado do arquivo");
      return r.id;
    },

    async vincular(fileObjectId, organizacaoId, vinculo: EntidadeVinculada, criadoPorId) {
      await db.execute(sql`
        INSERT INTO file_links (organizacao_id, file_object_id, entity_type, entity_id, papel, created_by_id)
        VALUES (${organizacaoId}::uuid, ${fileObjectId}::uuid, ${vinculo.tipo},
                ${vinculo.id}::uuid, ${vinculo.papel ?? null}, ${criadoPorId}::uuid)
        ON CONFLICT DO NOTHING`);
    },

    async buscar(id, organizacaoId) {
      return um(sql`
        SELECT id::text, storage_provider AS provider, storage_key AS "storageKey",
               nome_original AS "nomeOriginal", mime_type AS "mimeType",
               tamanho_bytes::int AS "tamanhoBytes", deleted_at AS "deletedAt"
          FROM file_objects
         WHERE id = ${id}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
    },

    async acharPorChecksum(organizacaoId, checksum) {
      // O mesmo conteúdo na mesma organização é o mesmo arquivo. Entre
      // organizações NÃO: compartilhar binário entre tenants seria vazamento
      // esperando um bug de consulta.
      return um(sql`
        SELECT id::text, storage_key AS "storageKey" FROM file_objects
         WHERE organizacao_id = ${organizacaoId}::uuid
           AND checksum_sha256 = ${checksum} AND deleted_at IS NULL
         LIMIT 1`);
    },

    async marcarRemovido(id, organizacaoId) {
      // Remoção é lógica: o vínculo e a auditoria continuam existindo, e o
      // binário sai depois, por retenção. Apagar na hora perde a prova de que
      // o arquivo existiu.
      await db.execute(sql`
        UPDATE file_objects SET deleted_at = now()
         WHERE id = ${id}::uuid AND organizacao_id = ${organizacaoId}::uuid AND deleted_at IS NULL`);
    },
  };
}
