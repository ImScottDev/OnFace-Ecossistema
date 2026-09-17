import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2PipelineWorkspace } from "@/components/crm2/pipeline/Workspace";
import { PipelineTopbarActions } from "@/components/crm2/pipeline/TopbarActions";
import { Cf2AreaTabs } from "@/components/crm2/AreaTabs";
import { COMERCIAL_TABS } from "@/components/crm2/comercial-tabs";

export default async function PipelinePage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const org = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org[0]?.nome || "Callface";

  return (
    <div className="-m-6 h-[100dvh] flex flex-col min-h-0 overflow-hidden">
      {/* ALTURA FECHADA (01/09, pedido do Kauã: "a página fixa e eu faço o
          scroll conforme cada coluna do Kanban"). `-m-6` cancela o padding do
          layout e `h-[100dvh]` casa exatamente com o scroller do shell
          (`ui/Sidebar` provider é `h-dvh`, `main` e o scroller são `flex-1`).
          Com altura DEFINIDA aqui, o `max-h-full` das colunas passa a ter
          referência e o scroll vertical acontece dentro de cada coluna em vez
          de esticar a página inteira. `h-[calc(100%+3rem)]` não resolvia: o
          container do layout é `min-h-full`, ou seja altura auto, e
          porcentagem contra altura auto é indefinida — o filho voltava pra
          auto e a página crescia. */}
      <header className="shrink-0 flex flex-col px-6 py-3.5" style={{ background: "var(--cf2-bg-surface)", borderBottom: "1px solid var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title={<Cf2AreaTabs items={COMERCIAL_TABS} />} subtitle="Pré-vendas, prospecção e oportunidades numa única operação" actions={<PipelineTopbarActions />} compactTitle />
      </header>

      {/* A área de trabalho destas telas é escura, mas o documento roda no tema
          claro: sem declarar a superfície, os tons semânticos (âmbar e vermelho
          escurecidos pro contraste em branco) chegavam aqui pesados demais. */}
      <div
        data-cf2-superficie="escura"
        className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-5 min-h-0"
        style={{ background: "var(--cf2-chrome-bg-alt)" }}
      >
        <div className="flex-1 min-h-0">
          <Cf2PipelineWorkspace />
        </div>
      </div>
    </div>
  );
}
