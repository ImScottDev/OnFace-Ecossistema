"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { atorHumano } from "@/lib/vendas/dominio";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import { delegacaoAtiva, delegarAAgente, devolverDelegacao } from "@/lib/agentes/delegacao";
import { listarUsuariosAgente, sincronizarUsuariosDosAgentes } from "@/lib/agentes/usuario-do-agente";
import { usuarios } from "@/lib/db/schema";

export interface PreparoDelegacao {
  agentes: Array<{ usuarioId: string; nome: string }>;
  ativa: { id: string; agente: string; motivo: string; desde: string; toques: number; maxToques: number; proximoToqueEm: string | null; devolverPara: string | null } | null;
}

/** Agentes disponíveis e a delegação em curso (se houver) para o diálogo "Delegar a um agente". */
export async function acaoPrepararDelegacao(alvo: { negocioId?: string | null; leadId?: string | null }): Promise<PreparoDelegacao | null> {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  await sincronizarUsuariosDosAgentes(ctx.organizacaoId);
  const [agentes, d] = await Promise.all([listarUsuariosAgente(ctx.organizacaoId), delegacaoAtiva(ctx.organizacaoId, alvo)]);
  let ativa: PreparoDelegacao["ativa"] = null;
  if (d) {
    const nomeDe = async (id: string | null) => (id ? (await db.select({ n: usuarios.nome }).from(usuarios).where(eq(usuarios.id, id)).limit(1))[0]?.n ?? null : null);
    ativa = {
      id: d.id, agente: (await nomeDe(d.agenteUsuarioId)) ?? "Agente", motivo: d.motivo, desde: d.createdAt.toISOString(),
      toques: d.toques, maxToques: d.maxToques, proximoToqueEm: d.proximoToqueEm?.toISOString() ?? null, devolverPara: await nomeDe(d.humanoUsuarioId),
    };
  }
  return { agentes: agentes.map((a) => ({ usuarioId: a.usuarioId, nome: a.nome })), ativa };
}

export async function acaoDelegarAAgente(entrada: {
  negocioId?: string | null; leadId?: string | null; agenteUsuarioId: string; motivo: string;
  diasSemResposta?: number; intervaloDias?: number; maxToques?: number;
}): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("delegar a um agente", async () => {
    await delegarAAgente({ organizacaoId: ctx.organizacaoId, ator: atorHumano(ctx.userId), gatilho: "manual", ...entrada });
    revalidatePath("/pipeline"); revalidatePath("/pre-vendas");
  });
}

export async function acaoDevolverDelegacao(delegacaoId: string, motivo: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  return executar("devolver a delegação", async () => {
    await devolverDelegacao({ organizacaoId: ctx.organizacaoId, delegacaoId, ator: atorHumano(ctx.userId), motivo });
    revalidatePath("/pipeline"); revalidatePath("/pre-vendas");
  });
}
