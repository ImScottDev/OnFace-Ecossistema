import { notFound } from "next/navigation";
import { OnfacePage, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { DetalheEmpresaPagina } from "@/components/onface/vendas/pagina";
import { acaoEmpresa360 } from "@/app/(crm2)/contatos/actions";

export default async function EmpresaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await acaoEmpresa360(id);
  if (!resultado.ok || !resultado.dados?.empresa) notFound();
  return <OnfacePage><OnfacePageSurface><DetalheEmpresaPagina empresa={resultado.dados.empresa} timeline={resultado.dados.timeline} voltar="/onface-desenho/contatos" /></OnfacePageSurface></OnfacePage>;
}
