import { notFound } from "next/navigation";
import { OnfacePage, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { DetalheOportunidadePagina } from "@/components/onface/vendas/pagina";
import { acaoDetalhe } from "@/app/(onface-preview)/onface-preview/pipeline/actions";

export default async function OportunidadePorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await acaoDetalhe(id);
  if (!resultado.ok || !resultado.dados?.oportunidade) notFound();
  return <OnfacePage><OnfacePageSurface><DetalheOportunidadePagina oportunidade={resultado.dados.oportunidade} timeline={resultado.dados.timeline} voltar="/onface-desenho/pipeline" /></OnfacePageSurface></OnfacePage>;
}
