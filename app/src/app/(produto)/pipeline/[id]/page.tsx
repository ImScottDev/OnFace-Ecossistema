import { notFound } from "next/navigation";
/* A tela é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { OportunidadeProto } from "@/components/onface/proto/OportunidadeProto";
import { acaoDetalhe, acaoMoverEtapa, acaoPerder, acaoTentarGanhar, acaoDefinirProximaAcao, acaoCriarOportunidade, acaoAlterarFamilia } from "../actions";

export default async function OportunidadePorId({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ definir?: string }>;
}) {
  const { id } = await params;
  const { definir } = await searchParams;
  const resultado = await acaoDetalhe(id);
  if (!resultado.ok || !resultado.dados?.oportunidade) notFound();

  return (
    <OportunidadeProto
      oportunidade={resultado.dados.oportunidade}
      timeline={resultado.dados.timeline}
      abrirDefinirFamilia={definir === "familia"}
      acoes={{
        moverEtapa: acaoMoverEtapa,
        perder: acaoPerder,
        tentarGanhar: acaoTentarGanhar,
        definirProximaAcao: acaoDefinirProximaAcao,
        criarOportunidade: acaoCriarOportunidade,
        alterarFamilia: acaoAlterarFamilia,
      }}
    />
  );
}
