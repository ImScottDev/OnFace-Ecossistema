import { notFound } from "next/navigation";
import { OnfacePage, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { DetalhePropostaPagina } from "@/components/onface/vendas/DetalhePropostaPagina";
import { acaoDetalhe } from "@/app/(onface-preview)/onface-preview/propostas/actions";

export default async function PropostaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await acaoDetalhe(id);
  if (!resultado.ok || !resultado.dados) notFound();
  return <OnfacePage><OnfacePageSurface><DetalhePropostaPagina proposta={resultado.dados} voltar="/onface-desenho/propostas" /></OnfacePageSurface></OnfacePage>;
}
