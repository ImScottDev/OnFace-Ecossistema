import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { getGoogleAuthUrl } from "@/lib/email/google";
import { encrypt } from "@/lib/email/encryption";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  // State contains org + user info for callback
  const state = encrypt(JSON.stringify({
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
  }));

  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
