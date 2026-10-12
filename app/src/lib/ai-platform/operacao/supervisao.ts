/** Supervisor humano do agente (guardrail_config.supervisorUsuarioId): recebe aviso de handoff, falha e aprovação pendente. */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificacoes, usuarios } from "@/lib/db/schema";

export async function notificarSupervisor(organizacaoId: string, guardrails: unknown, n: { titulo: string; mensagem: string; link?: string | null }): Promise<boolean> {
  const id = (guardrails && typeof guardrails === "object" ? (guardrails as Record<string, unknown>).supervisorUsuarioId : null);
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const [u] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true))).limit(1);
  if (!u) return false;
  await db.insert(notificacoes).values({ usuarioId: u.id, tipo: "agente_ia", titulo: n.titulo, mensagem: n.mensagem.slice(0, 500), link: n.link ?? null });
  return true;
}
