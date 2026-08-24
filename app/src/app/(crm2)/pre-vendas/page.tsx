import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { getPulsoPreVendas } from "@/lib/analytics/pre-vendas";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2VendasPillTabs } from "@/components/crm2/VendasPillTabs";
import { Cf2PreVendasPulseCards } from "@/components/crm2/PreVendasPulse";
import { Cf2QualificacaoWorkspace } from "@/components/crm2/qualificacao/Workspace";

function monthBounds(ref: Date) {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { inicio, fim };
}

export default async function PreVendasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const hoje = new Date();
  const { inicio, fim } = monthBounds(hoje);
  const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const { inicio: inicioAnt, fim: fimAnt } = monthBounds(mesAnteriorRef);

  const [org, pulso, pulsoAnterior] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getPulsoPreVendas(ctx.organizacaoId, inicio, fim),
    getPulsoPreVendas(ctx.organizacaoId, inicioAnt, fimAnt),
  ]);

  const orgNome = org[0]?.nome || "Callface";
  return (
    <div className="-m-6 min-h-full flex flex-col">
      <header className="flex flex-col gap-5 px-8 pt-7 pb-5" style={{ background: "var(--cf2-chrome-bg-alt)", borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}>
        <Cf2Topbar orgNome={orgNome} variant="dark" title="Vendas" subtitle="Gestão de pré-vendas, qualificação e distribuição de leads" />
        <Cf2VendasPillTabs />
      </header>

      <div
        className="flex flex-col flex-1 min-h-[calc(100dvh-190px)] gap-4 px-6 pt-5 pb-6"
        style={{
          background: "var(--cf2-chrome-bg-alt)",
          backgroundImage: "repeating-linear-gradient(to right, rgba(255,255,255,0.035) 0 1px, transparent 1px 60px), repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0 1px, transparent 1px 60px)",
          backgroundSize: "60px 60px",
        }}
      >
        <Cf2PreVendasPulseCards pulso={pulso} pulsoAnterior={pulsoAnterior} />
        <div className="flex-1 min-h-[680px] min-w-0">
          <Cf2QualificacaoWorkspace />
        </div>
      </div>
    </div>
  );
}
