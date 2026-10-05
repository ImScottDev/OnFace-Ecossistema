import { notFound } from "next/navigation";
/* A tela é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { OportunidadeProto } from "@/components/onface/proto/OportunidadeProto";
import { acaoDetalhe, acaoMoverEtapa, acaoPerder, acaoTentarGanhar, acaoDefinirProximaAcao } from "../actions";

export default async function OportunidadePorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await acaoDetalhe(id);
  if (!resultado.ok || !resultado.dados?.oportunidade) notFound();

  return (
    <OportunidadeProto
      oportunidade={resultado.dados.oportunidade}
      timeline={resultado.dados.timeline}
      acoes={{
        moverEtapa: acaoMoverEtapa,
        perder: acaoPerder,
        tentarGanhar: acaoTentarGanhar,
        definirProximaAcao: acaoDefinirProximaAcao,
      }}
    />
  );
}
