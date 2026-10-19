import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { detalheLead, empresa360 } from "@/lib/vendas/consultas";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";
import { arquivosDaEmpresa, cadenciaDoLead, enriquecimentoDaEmpresa } from "@/lib/vendas/ficha-extras";
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
  const [lead, arquivos, enriquecimento, cadencia] = await Promise.all([
    principal ? detalheLead(ctx.organizacaoId, principal) : null,
    arquivosDaEmpresa(ctx.organizacaoId, id),
    enriquecimentoDaEmpresa(ctx.organizacaoId, id),
    principal ? cadenciaDoLead(ctx.organizacaoId, ctx.userId, principal) : null,
  ]);

  /* Tags: o catálogo real da organização (`labels`) e as da própria empresa (`entity_labels`). */
  const [labels, daEmpresa] = await Promise.all([
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM labels WHERE organizacao_id = ${ctx.organizacaoId}::uuid ORDER BY nome`),
    db.execute<{ nome: string }>(sql`
      SELECT l.nome FROM entity_labels el JOIN labels l ON l.id = el.label_id
       WHERE el.organizacao_id = ${ctx.organizacaoId}::uuid AND el.entity_type = 'empresa' AND el.entity_id = ${id}::uuid
       ORDER BY l.nome`),
  ]);

  return <EmpresaProto empresa={empresa} lead={lead} timeline={timeline} arquivos={arquivos} enriquecimento={enriquecimento} cadencia={cadencia}
    labels={labels.map((l) => ({ id: l.id, nome: l.nome }))} tagsDaEmpresa={daEmpresa.map((t) => t.nome)} />;
}
