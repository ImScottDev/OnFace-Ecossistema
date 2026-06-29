import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { leads, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type IcpConfig = {
  setores?: string; portes?: string[]; estados?: string[];
  cargos?: string; servicos?: string;
  pesos?: { setor: number; porte: number; localizacao: number; cargo: number; servicos: number; tamanho: number; filiais: number };
};

const split = (s?: string) => (s || "").toLowerCase().split(",").map(x => x.trim()).filter(Boolean);

// POST /api/leads/recalcular-icp — recalcula o ICP Score (leadScore) de todos os leads da org
export async function POST() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const [org] = await db
    .select({ settings: organizacoes.settings })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const icp = ((org?.settings as Record<string, unknown>)?.icp as IcpConfig) || {};
  const pesos = icp.pesos;
  if (!pesos) return NextResponse.json({ error: "Configure o ICP primeiro" }, { status: 400 });

  const setoresIcp = split(icp.setores);
  const cargosIcp = split(icp.cargos);
  const servicosIcp = split(icp.servicos);
  const portesIcp = (icp.portes || []).map(p => p.toLowerCase().replace("é", "e"));
  const estadosIcp = icp.estados || [];

  const allLeads = await db.select().from(leads).where(eq(leads.organizacaoId, ctx.organizacaoId));
  let atualizados = 0;

  for (const l of allLeads) {
    let score = 0;
    const setor = (l.empresaSetor || "").toLowerCase();
    const porte = (l.empresaPorte || "").toLowerCase();

    if (!setoresIcp.length || (setor && setoresIcp.some(s => setor.includes(s)))) score += pesos.setor || 0;
    if (!portesIcp.length || (porte && portesIcp.some(p => p.includes(porte) || porte.includes(p)))) score += pesos.porte || 0;
    if (!estadosIcp.length || (l.empresaEstado && estadosIcp.includes(l.empresaEstado))) score += pesos.localizacao || 0;
    if (!cargosIcp.length || (l.cargo && cargosIcp.some(c => l.cargo!.toLowerCase().includes(c)))) score += pesos.cargo || 0;
    if (!servicosIcp.length || (l.servicosInteresse && l.servicosInteresse.some(sv => servicosIcp.some(si => sv.toLowerCase().includes(si))))) score += pesos.servicos || 0;
    // tamanho/filiais: sem dados firmográficos no lead — peso neutro (concedido)
    score += (pesos.tamanho || 0) + (pesos.filiais || 0);

    score = Math.max(0, Math.min(100, Math.round(score)));
    await db.update(leads).set({ leadScore: score }).where(eq(leads.id, l.id));
    atualizados++;
  }

  return NextResponse.json({ ok: true, atualizados });
}
