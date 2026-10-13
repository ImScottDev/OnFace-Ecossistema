/**
 * Gravação da conta de e-mail depois do OAuth (Microsoft e Google).
 *
 * Por que existe: o callback fazia `INSERT` puro. Cada clique repetido em
 * "Conectar" (ou cada reconexão) criava uma linha nova em `email_contas` para a
 * MESMA caixa. Em produção o Kauã chegou a 6 linhas ativas de
 * `kaua.araujo@callface.ai` (cinco criadas em 30/09 em 15 segundos). Com isso:
 * o evento do calendário era atualizado numa conta, dava 404 e o ONFACE
 * recriava o evento (duplicata); os e-mails eram importados 6 vezes; a
 * assinatura de change notifications do Outlook saía 6 vezes.
 *
 * Regra: a caixa é identificada por (organizacao_id, usuario_id, tipo,
 * lower(email)). Reconectar ATUALIZA os tokens da linha existente; só cria
 * linha quando a caixa ainda não existe para aquele usuário.
 *
 * Não depende do índice único (migration 0113): ele só existe depois da
 * consolidação dos dados. A serialização de cliques simultâneos é feita com
 * advisory lock de transação sobre a chave da caixa.
 */
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { db as bancoPadrao } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";

type Banco = typeof bancoPadrao;

/** Status de conta consolidada em outra: o worker só sincroniza `active`, então ela fica fora do sync. */
export const STATUS_CONTA_MESCLADA = "mesclada";

export interface DadosContaOAuth {
  organizacaoId: string;
  usuarioId: string;
  tipo: "google" | "microsoft";
  email: string;
  nome?: string | null;
  /** Já cifrado (`encrypt`). */
  accessToken: string;
  /** Já cifrado. Se o provedor não devolver (reconexão sem `offline_access`), mantém o anterior. */
  refreshToken?: string | null;
  tokenExpiry: Date | null;
}

export function chaveDaCaixa(d: Pick<DadosContaOAuth, "organizacaoId" | "usuarioId" | "tipo" | "email">): string {
  return `${d.organizacaoId}:${d.usuarioId}:${d.tipo}:${d.email.trim().toLowerCase()}`;
}

export async function salvarContaOAuth(
  banco: Banco,
  d: DadosContaOAuth,
): Promise<{ id: string; criada: boolean }> {
  const emailNormalizado = d.email.trim().toLowerCase();

  return banco.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${chaveDaCaixa(d)}, 0))`);

    // Se (antes da consolidação) já houver mais de uma linha, atualiza a mesma que o
    // restante do sistema usa: a ativa mais antiga.
    const [existente] = await tx
      .select({ id: emailContas.id })
      .from(emailContas)
      .where(and(
        eq(emailContas.organizacaoId, d.organizacaoId),
        eq(emailContas.usuarioId, d.usuarioId),
        eq(emailContas.tipo, d.tipo),
        sql`lower(${emailContas.email}) = ${emailNormalizado}`,
        ne(emailContas.syncStatus, STATUS_CONTA_MESCLADA),
      ))
      .orderBy(sql`(${emailContas.syncStatus} = 'active') DESC`, asc(emailContas.createdAt), asc(emailContas.id))
      .limit(1);

    if (existente) {
      await tx
        .update(emailContas)
        .set({
          accessToken: d.accessToken,
          refreshToken: d.refreshToken ?? sql`${emailContas.refreshToken}`,
          tokenExpiry: d.tokenExpiry,
          nome: d.nome ?? sql`${emailContas.nome}`,
          syncStatus: "active",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailContas.id, existente.id));
      return { id: existente.id, criada: false };
    }

    const [nova] = await tx
      .insert(emailContas)
      .values({
        organizacaoId: d.organizacaoId,
        usuarioId: d.usuarioId,
        tipo: d.tipo,
        email: d.email.trim(),
        nome: d.nome ?? null,
        accessToken: d.accessToken,
        refreshToken: d.refreshToken ?? null,
        tokenExpiry: d.tokenExpiry,
        syncStatus: "active",
      })
      .returning({ id: emailContas.id });
    return { id: nova.id, criada: true };
  });
}
