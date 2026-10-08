import { notFound } from "next/navigation";
import { DetalhePropostaPagina } from "@/components/onface/vendas/DetalhePropostaPagina";
import { acaoDetalhe } from "../actions";

export const dynamic = "force-dynamic";

export default async function PropostaPorId({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acao?: string }>;
}) {
  const { id } = await params;
  const { acao } = await searchParams;
  const resultado = await acaoDetalhe(id);
  if (!resultado.ok || !resultado.dados) notFound();
  return (
    <div className="onface-pagina" style={{ padding: "24px" }}>
      <DetalhePropostaPagina proposta={resultado.dados} voltar="/propostas" abrirEnvio={acao === "enviar"} />
    </div>
  );
}
