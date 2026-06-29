import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { encrypt } from "@/lib/email/encryption";

const createImapSchema = z.object({
  email: z.string().email(),
  nome: z.string().optional(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().default(993),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().default(587),
  imapUser: z.string().min(1),
  smtpUser: z.string().min(1),
  imapPass: z.string().min(1),
  smtpPass: z.string().min(1),
});

// GET /api/email/contas — list all email accounts for org
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const contas = await db
    .select({
      id: emailContas.id,
      tipo: emailContas.tipo,
      email: emailContas.email,
      nome: emailContas.nome,
      syncStatus: emailContas.syncStatus,
      lastSyncAt: emailContas.lastSyncAt,
      lastError: emailContas.lastError,
      isDefault: emailContas.isDefault,
      createdAt: emailContas.createdAt,
    })
    .from(emailContas)
    .where(eq(emailContas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(emailContas.createdAt));

  return NextResponse.json(contas);
}

// POST /api/email/contas — create IMAP/SMTP account
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createImapSchema.parse(body);

    const [conta] = await db.insert(emailContas).values({
      organizacaoId: ctx.organizacaoId,
      usuarioId: ctx.userId,
      tipo: "imap",
      email: data.email,
      nome: data.nome || null,
      imapHost: data.imapHost,
      imapPort: data.imapPort,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      imapUser: encrypt(data.imapUser),
      smtpUser: encrypt(data.smtpUser),
      imapPass: encrypt(data.imapPass),
      smtpPass: encrypt(data.smtpPass),
      syncStatus: "active",
    }).returning();

    return NextResponse.json(conta, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("[Email Contas] Create error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
