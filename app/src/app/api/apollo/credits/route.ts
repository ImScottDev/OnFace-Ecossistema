import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { getCreditsInfo, APOLLO_COSTS } from "@/lib/apollo/client";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const apiKey = await getOrgApolloKey(ctx.organizacaoId);
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      error: "Apollo API key não configurada",
      costs: APOLLO_COSTS,
    });
  }

  const credits = await getCreditsInfo(apiKey);

  return NextResponse.json({
    configured: true,
    ...credits,
    costs: APOLLO_COSTS,
  });
}
