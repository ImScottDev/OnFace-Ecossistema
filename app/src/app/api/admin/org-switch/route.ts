import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";

const ORG_OVERRIDE_COOKIE = "mcrm-org-override";

// GET /api/admin/org-switch — get current override + list all orgs
export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const override = cookieStore.get(ORG_OVERRIDE_COOKIE)?.value || "";
  const [currentOverrideId] = override.split(":");

  const orgs = await db.select({
    id: organizacoes.id,
    nome: organizacoes.nome,
    slug: organizacoes.slug,
    ativo: organizacoes.ativo,
  }).from(organizacoes).where(eq(organizacoes.ativo, true)).orderBy(organizacoes.nome);

  return NextResponse.json({
    currentOrgId: currentOverrideId || session?.user?.organizacaoId || "",
    originalOrgId: session?.user?.organizacaoId || "",
    orgs,
  });
}

// POST /api/admin/org-switch — set or clear org override
export async function POST(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { organizacaoId } = body as { organizacaoId?: string };

  const cookieStore = await cookies();

  // Clear override (go back to own org)
  if (!organizacaoId || organizacaoId === session?.user?.organizacaoId) {
    cookieStore.delete(ORG_OVERRIDE_COOKIE);
    return NextResponse.json({ ok: true, orgId: session?.user?.organizacaoId });
  }

  // Verify org exists
  const [org] = await db.select({ id: organizacoes.id, slug: organizacoes.slug })
    .from(organizacoes)
    .where(eq(organizacoes.id, organizacaoId))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Set cookie — httpOnly, path /, 24h expiry
  cookieStore.set(ORG_OVERRIDE_COOKIE, `${org.id}:${org.slug}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400, // 24 hours
  });

  return NextResponse.json({ ok: true, orgId: org.id, orgSlug: org.slug });
}
