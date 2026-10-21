import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";

export const runtime = "nodejs";

/** Fila de pendências do ledger PABX: somente leitura, restrita ao financeiro. */
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!(await temPermissao({
    usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId,
    role: ctx.userRole, tipo: "HUMAN",
  }, "finance.manage"))) return forbiddenResponse();

  const [lote] = await db.execute<{
    id: string; competencia: string; arquivo: string; status: string;
  }>(sql`
    SELECT id::text AS id, to_char(competence,'YYYY-MM') AS competencia,
           source_file AS arquivo, status
      FROM service_ledger_batches
     WHERE organizacao_id = ${ctx.organizacaoId}::uuid
     ORDER BY competence DESC, imported_at DESC LIMIT 1
  `);
  if (!lote) return NextResponse.json({
    lote: null, resumo: { quantidade: 0, valor: 0 }, pendencias: [], parcial: false,
  });

  const [resumo] = await db.execute<{ quantidade: number; valor: string }>(sql`
    SELECT count(*)::int AS quantidade, COALESCE(sum(billed_value),0)::text AS valor
      FROM service_ledger_entries
     WHERE batch_id = ${lote.id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
       AND (confidence <> 'CONFIRMED' OR revenue_nature='UNKNOWN'
            OR service_family='UNKNOWN' OR service_id IS NULL)
  `);
  const pendencias = await db.execute<{
    id: string; linha: number; empresa: string; valor: string;
    familia: string; natureza: string; confianca: string; motivo: string | null;
  }>(sql`
    SELECT id::text AS id, source_row_number AS linha,
           company_name AS empresa, billed_value::text AS valor,
           service_family AS familia, revenue_nature AS natureza,
           confidence AS confianca, evidence->>'reason' AS motivo
      FROM service_ledger_entries
     WHERE batch_id = ${lote.id}::uuid AND organizacao_id = ${ctx.organizacaoId}::uuid
       AND (confidence <> 'CONFIRMED' OR revenue_nature='UNKNOWN'
            OR service_family='UNKNOWN' OR service_id IS NULL)
     ORDER BY source_row_number, id LIMIT 100
  `);
  return NextResponse.json({
    lote,
    resumo: { quantidade: Number(resumo?.quantidade ?? 0), valor: Number(resumo?.valor ?? 0) },
    pendencias: pendencias.map((p) => ({ ...p, valor: Number(p.valor) })),
    parcial: Number(resumo?.quantidade ?? 0) > pendencias.length,
  });
}
