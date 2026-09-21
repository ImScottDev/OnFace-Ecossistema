// Página autenticada: o board lê a sessão do usuário para filtrar por
// responsável. Prerender estático não tem sessão, e o build quebrava em
// `useSession()` retornando undefined. Renderiza sob demanda.
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2EntregaWorkspace } from "@/components/crm2/clientes/EntregaWorkspace";

// Frente 2C.1 — Implantação deixou de ser só PABX. White Label tem trilha
// PRÓPRIA (ver lib/crm/politica-familia.ts): antes desta frente ele não
// aparecia em Implantação nem em Onboarding, ficava invisível no produto
// inteiro apesar de já existirem 12 fulfillments reais de White Label no
// banco. O seletor é link puro (sem JS) — o workspace já aceita `familiaFixa`,
// só faltava alguém passar White Label pra ele.
// 21/09: "Todas" entrou como padrão. O board sem família fixa já existia e
// cobria as três famílias — e não tinha um único link apontando para ele
// ("uso interno", dizia o comentário). Quem abria Implantação precisava saber
// de antemão qual produto procurar, e uma entrega de família errada ficava
// invisível pela tarde inteira.
const TRILHAS = [
  { familia: null, label: "Todas", subtitle: "Implantação — todas as famílias" },
  { familia: "PABX" as const, label: "PABX", subtitle: "Implantação PABX — pós-fechamento" },
  { familia: "WHITE_LABEL" as const, label: "White Label", subtitle: "Implantação White Label — pós-fechamento" },
];

export default async function ClientesImplantacaoPage({ searchParams }: { searchParams: Promise<{ familia?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const { familia } = await searchParams;
  const trilha = TRILHAS.find((t) => t.familia === familia) ?? TRILHAS[0];

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Clientes" subtitle={trilha.subtitle} compactTitle actions={null} />
      </div>
      <div className="pt-6 flex flex-col gap-4">
        <div className="flex items-center gap-1 p-1 rounded-control w-fit" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          {TRILHAS.map((t) => {
            const ativo = t.familia === trilha.familia;
            return (
              <Link
                key={t.label}
                href={t.familia ? `/clientes/implantacao?familia=${t.familia}` : "/clientes/implantacao"}
                className="px-3 py-1.5 rounded-chip text-apoio font-semibold transition-colors"
                style={{
                  background: ativo ? "var(--cf2-accent)" : "transparent",
                  color: ativo ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <Cf2EntregaWorkspace familiaFixa={trilha.familia ?? undefined} />
      </div>
    </div>
  );
}
