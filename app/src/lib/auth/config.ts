import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select({
            id: usuarios.id,
            nome: usuarios.nome,
            email: usuarios.email,
            senhaHash: usuarios.senhaHash,
            role: usuarios.role,
            ativo: usuarios.ativo,
            tipo: usuarios.tipo,
            organizacaoId: usuarios.organizacaoId,
            organizacaoSlug: organizacoes.slug,
            organizacaoAtiva: organizacoes.ativo,
          })
          .from(usuarios)
          .innerJoin(organizacoes, eq(organizacoes.id, usuarios.organizacaoId))
          .where(eq(usuarios.email, credentials.email as string))
          .limit(1);

        // Agente de IA é usuário do sistema, mas nunca entra por login.
        if (!user || !user.ativo || user.tipo === "agente") return null;
        // Ajustes > Organizações > "Ativa": organização inativada (soft delete do
        // super admin) não entra mais. Antes o flag era só exibido.
        if (!user.organizacaoAtiva) return null;

        const senhaValida = await bcrypt.compare(
          credentials.password as string,
          user.senhaHash
        );

        if (!senhaValida) return null;

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          role: user.role,
          organizacaoId: user.organizacaoId,
          organizacaoSlug: user.organizacaoSlug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.organizacaoId = (user as { organizacaoId?: string }).organizacaoId;
        token.organizacaoSlug = (user as { organizacaoSlug?: string }).organizacaoSlug;
      }
      // Refresh name/role from DB when session is explicitly updated (profile save)
      // or every 5 minutes (refreshedAt check)
      const now = Date.now();
      const refreshedAt = (token.refreshedAt as number) || 0;
      const shouldRefresh = trigger === "update" || (now - refreshedAt > 30 * 60 * 1000);
      if (token.id && shouldRefresh) {
        // Marca ANTES da query: mesmo se o banco estiver lento e a query estourar o
        // timeout, não reentramos numa tempestade de retries (fica com o valor antigo
        // por até 30min). Corrige o "carregamento eterno / não vai pro login": este
        // callback roda DENTRO do middleware (que não tem teto de tempo), então uma
        // query travada aqui pendura a request inteira. O timeout garante que nunca trava.
        token.refreshedAt = now;
        try {
          const rows = (await Promise.race([
            db
              .select({ nome: usuarios.nome, role: usuarios.role })
              .from(usuarios)
              .where(eq(usuarios.id, token.id as string))
              .limit(1),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("jwt-refresh-timeout")), 3000)
            ),
          ])) as { nome: string; role: string }[];
          const fresh = rows[0];
          if (fresh) {
            token.name = fresh.nome;
            token.role = fresh.role;
          }
        } catch {
          // DB lento/erro — mantém nome/role do token (stale), nunca pendura a request
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { organizacaoId?: string }).organizacaoId = token.organizacaoId as string;
        (session.user as { organizacaoSlug?: string }).organizacaoSlug = token.organizacaoSlug as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — long session, refreshed on activity
    updateAge: 24 * 60 * 60, // re-sign JWT every 24h of use
  },
});
