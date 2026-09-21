/**
 * Emite um cookie de sessão válido, para o smoke chamar rota autenticada.
 *
 * Existe porque o jeito de validar uma rota é CHAMAR a rota. Replicar a lógica
 * dela no script prova que o script funciona, não que o produto funciona, e
 * nesta refatoração isso já deixou passar um bug dentro do mesmo commit.
 *
 * Usa o mesmo `encode` do Auth.js que `api-server/auth.ts` usa para decodificar,
 * com o mesmo segredo e o mesmo salt, porque o formato do JWE pertence à
 * biblioteca: reimplementá-lo foi o que um dia fez o Next autenticar enquanto o
 * Hono recusava o mesmo cookie.
 *
 * Só para script de validação local. Nada em runtime importa daqui.
 */
import { encode } from "@auth/core/jwt";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const NOME_COOKIE = "authjs.session-token";

export interface SessaoDeSmoke {
  cookie: string;
  usuarioId: string;
  organizacaoId: string;
  role: string;
}

/** Sessão de um usuário real da organização. Sem usuário, não há o que validar. */
export async function sessaoDeSmoke(opts: { role?: string } = {}): Promise<SessaoDeSmoke> {
  const segredo = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  if (!segredo) throw new Error("NEXTAUTH_SECRET ausente: sem ele não há sessão para emitir");

  const filtro = opts.role ? sql`AND u.role = ${opts.role}` : sql``;
  const [u] = await db.execute<{
    id: string; nome: string; email: string; role: string;
    organizacao_id: string; slug: string | null;
  }>(sql`
    SELECT u.id::text, u.nome, u.email, u.role, u.organizacao_id::text, o.slug
      FROM usuarios u JOIN organizacoes o ON o.id = u.organizacao_id
     WHERE u.organizacao_id IS NOT NULL ${filtro}
     ORDER BY u.role = 'admin' DESC LIMIT 1`);
  if (!u) throw new Error(`nenhum usuário${opts.role ? ` com role ${opts.role}` : ""}`);

  const token = await encode({
    token: {
      id: u.id, name: u.nome, email: u.email, role: u.role,
      organizacaoId: u.organizacao_id, organizacaoSlug: u.slug ?? "",
    },
    secret: segredo,
    salt: NOME_COOKIE,
    maxAge: 60 * 10,
  });

  return {
    cookie: `${NOME_COOKIE}=${token}`,
    usuarioId: u.id,
    organizacaoId: u.organizacao_id,
    role: u.role,
  };
}
