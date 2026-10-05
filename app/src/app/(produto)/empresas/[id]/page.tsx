import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { detalheLead, empresa360 } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";
/* A ficha é o desenho do handoff, convertido por máquina.
   `crm2/empresas/Workspace` era a versão anterior e sai da rota. */
import { EmpresaProto } from "@/components/onface/proto/EmpresaProto";

export const metadata = { title: "Empresa" };
export const dynamic = "force-dynamic";

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [empresa, timeline] = await Promise.all([
    empresa360(ctx.organizacaoId, id),
    lerLinhaDoTempo({ organizacaoId: ctx.organizacaoId, empresaId: id, limite: 40 }),
  ]);
  if (!empresa) notFound();

  /* O contato da ficha vem do lead mais recente da empresa. Empresa sem lead
     existe — cadastro importado, cliente antigo — e a tela mostra isso em vez
     de um contato de exemplo. */
  const principal = empresa.leads[0]?.id ?? null;
  const lead = principal ? await detalheLead(ctx.organizacaoId, principal) : null;

  return <EmpresaProto empresa={empresa} lead={lead} timeline={timeline} />;
}
