import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    organizacaoId?: string;
    organizacaoSlug?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      organizacaoId?: string;
      organizacaoSlug?: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizacaoId?: string;
    organizacaoSlug?: string;
  }
}
