import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/email/thread/:threadId — get all emails in a thread
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { threadId } = await params;

  const threadEmails = await db.select()
    .from(emails)
    .where(and(eq(emails.threadId, threadId), eq(emails.organizacaoId, ctx.organizacaoId)))
    .orderBy(asc(emails.createdAt));

  return NextResponse.json({ emails: threadEmails });
}
