import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Os pacotes de domínio e plataforma são TypeScript puro, sem build próprio
  // (SPEC §34). O bundler precisa transpilá-los junto com a aplicação — sem
  // isto o build quebra com "module not found" nos imports de `@onface/*`.
  transpilePackages: [
    "@onface/acquisition", "@onface/catalog", "@onface/identity", "@onface/sales",
    "@onface/platform-database", "@onface/platform-events", "@onface/platform-storage", "@onface/integrations-meta", "@onface/integrations-callface-ai",
  ],
  // O portão de tipo mudou de lugar no CP61, e por isso esta linha pode ficar.
  //
  // Ela vem do commit inicial e estava documentada como armadilha conhecida no
  // README e no TASK-001: "npm run build passar NÃO prova typecheck limpo; o
  // gate é tsc --noEmit". A compensação existia, e não estava no caminho que
  // importa — o Dockerfile roda `NEXT_TYPESCRIPT_CHECK=false npm run build` e
  // nenhum tsc, então a imagem era construída sem nenhuma verificação de tipo.
  //
  // `npm run build` passou a ser `npm run typecheck && next build`, o que põe o
  // portão em TODO caminho que constrói, incluindo o da imagem. Mantida porque
  // o tsc já rodou antes e deixar o Next checar de novo só custa tempo de build.
  typescript: { ignoreBuildErrors: true },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const uploadsCompat = {
      // Backward compat: old media URLs stored as /uploads/... in DB → API route
      source: "/uploads/:path*",
      destination: "/api/uploads/:path*",
    };

    // CRM 2.0 / Fase 0: em produção o Traefik manda /api/* (exceto auth/webhooks/
    // financeiro/onboarding/campanhas/contratos-publicos) direto pro container Hono, então as
    // rotas Next.js equivalentes (app/src/app/api/*) nunca recebem tráfego real —
    // são código morto em prod. Só que em `next dev` (:3000) não existe Traefik, e o
    // frontend chama `fetch("/api/...")` relativo: sem este rewrite, essas chamadas
    // caem nas rotas Next "mortas" em vez do Hono, e dev passa a testar um caminho
    // que produção nunca executa. Este rewrite espelha a MESMA regra do Traefik
    // (docker-compose.yml, routers callface-crm / callface-crm-api) só em dev, pra
    // eliminar essa divergência antes de remover as rotas Next duplicadas de vez.
    if (process.env.NODE_ENV === "development") {
      const apiPort = process.env.HONO_API_PORT || "3002";
      return {
        beforeFiles: [
          uploadsCompat,
          {
            source: "/api/:path((?!auth|webhooks|financeiro|onboarding|campanhas|contratos-publicos).*)",
            destination: `http://localhost:${apiPort}/api/:path*`,
          },
        ],
      };
    }

    return [uploadsCompat];
  },
  async headers() {
    return [
      {
        source: "/api/leads",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
