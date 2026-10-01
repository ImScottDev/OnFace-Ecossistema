import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { outreachCampanhas } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { podeGerirCampanhas } from "@/lib/automacoes/campanhas";

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
  // Desde que o worker `campanha-sweep` dispara o que está "agendada", esta
  // rota não pode aceitar status do corpo nem escrita sem automation.manage:
  // seria disparo em massa sem validação. Agendar é só pela tela (actions.ts).
  if (!(await podeGerirCampanhas(ctx))) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

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
      status: "rascunho",
      createdBy: ctx.userId,
    })
    .returning();

  return NextResponse.json({ campanha: row });
}
