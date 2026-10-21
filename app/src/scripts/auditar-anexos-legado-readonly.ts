/**
 * Inventário sem PII: disponibilidade física de anexos de contratos históricos.
 * SELECT read-only; não acessa provider externo e não imprime caminhos/nomes.
 */
import postgres from "postgres";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { resolveLocalPath } from "@/lib/storage/legacy-attachment-storage";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
async function main() {
try {
  const rows = await sql.begin("read only", async (tx) => tx`
    SELECT a.storage_path, a.checksum_sha256
    FROM anexos_legado a
    WHERE a.entidade_tipo = 'contrato' AND a.categoria = 'documento_assinado'
    ORDER BY a.id
  `);
  const available = rows.filter((r) => resolveLocalPath(r.storage_path as string | null) != null).length;
  // Amostra determinística de integridade binária, sem expor nomes ou conteúdo.
  const amostra = rows.slice(0, 12).map((r) => {
    const file = resolveLocalPath(r.storage_path as string | null);
    return file != null && createHash("sha256").update(fs.readFileSync(file)).digest("hex") === r.checksum_sha256;
  });
  console.log(JSON.stringify({
    tipo: "INVENTARIO_ANEXOS_ASSINADOS_READ_ONLY",
    registros: rows.length,
    com_checksum: rows.filter((r) => !!r.checksum_sha256).length,
    arquivos_da_amostra: amostra.length,
    hashes_binarios_conferidos: amostra.filter(Boolean).length,
    arquivos_fisicos_acessiveis_neste_ambiente: available,
    arquivos_sem_acesso_fisico: rows.length - available,
    aviso: "Metadado com hash não comprova integridade binária; ambiente local não prova disponibilidade na EC2.",
  }, null, 2));
} finally {
  await sql.end();
}
}
main().catch((error) => {
  console.error("Inventário de anexos falhou:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
