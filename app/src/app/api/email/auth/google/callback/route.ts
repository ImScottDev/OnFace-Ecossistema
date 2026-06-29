import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { exchangeGoogleCode } from "@/lib/email/google";
import { encrypt, decrypt } from "@/lib/email/encryption";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?error=missing_params`);
  }

  try {
    const state = JSON.parse(decrypt(stateParam));
    const { organizacaoId, userId } = state;

    const tokens = await exchangeGoogleCode(code);

    await db.insert(emailContas).values({
      organizacaoId,
      usuarioId: userId,
      tipo: "google",
      email: tokens.email,
      nome: tokens.name,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiry: tokens.expiryDate,
      syncStatus: "active",
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?success=google`);
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?error=oauth_failed`);
  }
}
