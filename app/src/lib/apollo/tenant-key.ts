import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the Apollo API key for an organization.
 * Falls back to process.env.APOLLO_API_KEY if org has no key configured.
 * Returns null if neither is available.
 */
export async function getOrgApolloKey(organizacaoId: string): Promise<string | null> {
  const [org] = await db
    .select({ apolloApiKey: organizacoes.apolloApiKey })
    .from(organizacoes)
    .where(eq(organizacoes.id, organizacaoId))
    .limit(1);

  return org?.apolloApiKey || process.env.APOLLO_API_KEY || null;
}
