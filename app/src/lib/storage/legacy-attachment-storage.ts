/**
 * LegacyAttachmentStorage — abstração de storage pros 1.980 anexos
 * recuperados da migração Zoho (contratos assinados, aditivos, sales
 * orders, PDFs de proposta), tabela `anexos_legado` (ver
 * `src/lib/db/schema.ts` ~linha 2226).
 *
 * ATENÇÃO — isso é DEV-ONLY, não é arquitetura de produção:
 * os 1.980 arquivos binários reais hoje só existem numa pasta pessoal
 * no Mac do Scott (`~/Downloads/Attachments`), fruto da recuperação
 * manual da migração Zoho (ver
 * `docs/reconstruction/auditoria-legado-zoho/01-inventario-zoho.md`).
 * Em produção esses arquivos precisam morar em storage real (S3? R2?
 * bucket próprio? — DECISÃO AINDA NÃO TOMADA). Isso é um blocker de
 * infraestrutura a REGISTRAR pro Kauã/Scott, não uma decisão de
 * arquitetura inventada aqui. Esta abstração existe justamente pra que,
 * quando a decisão de storage de produção acontecer, só se troque a
 * implementação (`localDownloadsStorage` → `s3Storage`/`r2Storage`/etc)
 * sem tocar na rota API nem nos componentes de UI que a consomem.
 *
 * Também vale registrar: `nomeArquivo`/`storagePath` de alguns desses
 * anexos podem conter CNPJ/CPF em texto puro no nome do arquivo (achado
 * na auditoria) — cuidado de LGPD a resolver depois, não bloqueante
 * pra esta rodada (dev local, acesso restrito ao time).
 */
import fs from "fs";
import os from "os";
import path from "path";

export interface LegacyAttachmentStorage {
  /**
   * Resolve um `storagePath` (formato `legado-zoho/<hash>_<nome>.pdf`)
   * pra um path absoluto no filesystem local. Retorna null se o
   * `storagePath` for vazio/inválido, se o arquivo físico não existir,
   * ou se a resolução escapar do diretório base (path traversal) —
   * NUNCA lança erro, pra não derrubar a página que só quer saber se
   * tem arquivo disponível.
   */
  resolveLocalPath(storagePath: string | null | undefined): string | null;
}

const LEGACY_PREFIX = "legado-zoho/";
const BASE_DIR = path.resolve(path.join(os.homedir(), "Downloads", "Attachments"));

/**
 * Implementação DEV-ONLY: lê da pasta pessoal `~/Downloads/Attachments`.
 * Ver aviso no topo do arquivo — não usar como referência para produção.
 */
export const localDownloadsStorage: LegacyAttachmentStorage = {
  resolveLocalPath(storagePath) {
    if (!storagePath || !storagePath.startsWith(LEGACY_PREFIX)) return null;

    const relative = storagePath.slice(LEGACY_PREFIX.length);
    if (!relative) return null;

    const resolved = path.resolve(BASE_DIR, relative);

    // Guarda contra path traversal: o path final resolvido tem que estar
    // DENTRO de BASE_DIR. `entidadeId`/`storagePath` podem vir de query
    // string / body — nunca confiar sem essa checagem.
    if (resolved !== BASE_DIR && !resolved.startsWith(BASE_DIR + path.sep)) {
      return null;
    }

    try {
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
      return resolved;
    } catch {
      return null;
    }
  },
};

// Provider ativo. Trocar aqui (por um provider real de produção) quando
// a decisão de storage existir — ver aviso no topo do arquivo.
export const legacyAttachmentStorage: LegacyAttachmentStorage = localDownloadsStorage;

/** Atalho conveniente — delega pro provider ativo acima. */
export function resolveLocalPath(storagePath: string | null | undefined): string | null {
  return legacyAttachmentStorage.resolveLocalPath(storagePath);
}

/**
 * Sanitiza `nomeArquivo` pra uso seguro em header HTTP
 * (`Content-Disposition: attachment; filename="..."`): remove quebras
 * de linha e caracteres de controle (proteção contra header injection)
 * e escapa aspas duplas que quebrariam o valor do header.
 */
export function sanitizeFilenameForHeader(nomeArquivo: string): string {
  return nomeArquivo
    .replace(/[\r\n\x00-\x1f\x7f]/g, "")
    .replace(/"/g, "'")
    .trim() || "documento.pdf";
}
