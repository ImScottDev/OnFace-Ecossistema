import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { eq, and, or, isNull, SQL } from "drizzle-orm";

/**
 * Autorização de leitura/escrita de conversa de WhatsApp.
 *
 * Regra (decisão Kauã, 09/09/2026): as sessões de WhatsApp do CRM são os
 * numeros PESSOAIS do time, então conversa é dado pessoal. Só `super_admin`
 * enxerga tudo — a aba "Todos" e o "ver como" são dele. Todo o resto (admin,
 * gerente, closer, sdr, leitor) só acessa conversa onde é o responsável.
 *
 * ATENÇÃO: não passe o papel por `normalizeRole()` — ela colapsa
 * "super_admin" em "admin" e derruba a regra inteira.
 */
export function veTodasAsConversas(
  ctxOuRole: string | null | undefined | { userRole?: string | null; realRole?: string | null },
): boolean {
  // Sempre o papel REAL: o "ver como" troca ctx.userRole pelo papel de quem
  // está sendo observado, então decidir por ele deixaria qualquer um herdar
  // super_admin apontando o cookie de view-as pra conta certa.
  if (typeof ctxOuRole === "string" || ctxOuRole == null) return ctxOuRole === "super_admin";
  return (ctxOuRole.realRole ?? ctxOuRole.userRole) === "super_admin";
}

/** Condição SQL de acesso, pra listas. Não-atribuído fica visível (fila aberta). */
export function condicaoAcessoConversa(ctx: { userId: string; userRole?: string | null; realRole?: string | null }): SQL | undefined {
  if (veTodasAsConversas(ctx)) return undefined;
  return or(eq(contatos.responsavelId, ctx.userId), isNull(contatos.responsavelId));
}

export type AcessoConversa =
  | { ok: true; contato: { id: string; telefone: string | null; leadId: string | null; responsavelId: string | null; sessaoId: string | null } }
  | { ok: false; motivo: "nao_encontrado" | "sem_permissao" };

/**
 * Checa se o usuário pode abrir UM contato. Usa sempre isto antes de devolver
 * mensagem, enviar, reagir ou apagar — o filtro de organização sozinho não
 * separa nada: todo o time vive na mesma org.
 */
export async function checarAcessoContato(
  ctx: { userId: string; userRole?: string | null; realRole?: string | null; organizacaoId: string },
  contatoId: string,
): Promise<AcessoConversa> {
  const [contato] = await db
    .select({
      id: contatos.id,
      telefone: contatos.telefone,
      leadId: contatos.leadId,
      responsavelId: contatos.responsavelId,
      sessaoId: contatos.sessaoId,
    })
    .from(contatos)
    .where(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) return { ok: false, motivo: "nao_encontrado" };
  if (veTodasAsConversas(ctx)) return { ok: true, contato };
  if (contato.responsavelId === null) return { ok: true, contato };
  if (contato.responsavelId === ctx.userId) return { ok: true, contato };
  return { ok: false, motivo: "sem_permissao" };
}

/** Resposta padrão — 404 pra não confirmar a existência de conversa alheia. */
export function respostaSemAcesso() {
  return Response.json({ error: "Conversa nao encontrada" }, { status: 404 });
}
