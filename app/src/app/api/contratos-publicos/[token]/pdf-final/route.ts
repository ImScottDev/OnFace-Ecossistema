import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { contratos } from "@/lib/db/schema";
import { baixarDocumentoAssinado, isDocumensoConfigured } from "@/lib/crm/signature/documenso-provider";

const sha256 = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/**
 * Cópia final pública protegida por bearer token opaco e expirável.
 * Não passa pelo guard de sessão do CRM e nunca expõe a chave do provider.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token || token.length < 32) return new Response("Não encontrado", { status: 404 });

  const [contract] = await db.select({
    providerRef: contratos.signatureProviderRef,
    assinaturaStatus: contratos.assinaturaStatus,
  }).from(contratos).where(and(
    eq(contratos.documentoPublicoTokenHash, sha256(token)),
    gt(contratos.documentoPublicoExpiraEm, new Date()),
    eq(contratos.assinaturaStatus, "assinado"),
  )).limit(1);

  if (!contract || !isDocumensoConfigured() || !contract.providerRef) {
    return new Response("Documento não disponível", { status: 404 });
  }

  try {
    const { buffer, filename } = await baixarDocumentoAssinado(contract.providerRef);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Contratos públicos] falha ao baixar PDF final:", error);
    return new Response("Não foi possível obter o documento", { status: 502 });
  }
}
