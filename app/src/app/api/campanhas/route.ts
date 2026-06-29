import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { outreachCampanhas } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/campanhas — lista campanhas de outreach da org
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const rows = await db
    .select()
    .from(outreachCampanhas)
    .where(eq(outreachCampanhas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(outreachCampanhas.createdAt));

  return NextResponse.json({ campanhas: rows });
}

// POST /api/campanhas — cria campanha
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await req.json();
  if (!body.nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const [row] = await db
    .insert(outreachCampanhas)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: body.nome,
      canal: body.canal || "email",
      assunto: body.assunto || null,
      corpoHtml: body.corpoHtml || null,
      audiencia: body.audiencia || null,
      remetente: body.remetente || null,
      status: body.status || "rascunho",
      createdBy: ctx.userId,
    })
    .returning();

  return NextResponse.json({ campanha: row });
}
