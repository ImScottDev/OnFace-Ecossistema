import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { getMicrosoftAuthUrl } from "@/lib/email/microsoft";
import { encrypt } from "@/lib/email/encryption";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const state = encrypt(JSON.stringify({
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
  }));

  const url = getMicrosoftAuthUrl(state);
  return NextResponse.redirect(url);
}
