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
            organizacaoId: usuarios.organizacaoId,
            organizacaoSlug: organizacoes.slug,
          })
          .from(usuarios)
          .innerJoin(organizacoes, eq(organizacoes.id, usuarios.organizacaoId))
          .where(eq(usuarios.email, credentials.email as string))
          .limit(1);

        if (!user || !user.ativo) return null;

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
        try {
          const [fresh] = await db
            .select({ nome: usuarios.nome, role: usuarios.role })
            .from(usuarios)
            .where(eq(usuarios.id, token.id as string))
            .limit(1);
          if (fresh) {
            token.name = fresh.nome;
            token.role = fresh.role;
          }
          token.refreshedAt = now;
        } catch {
          // DB error — keep stale values
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
