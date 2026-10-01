import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  destinatariosDaCampanha, listasDisponiveis, obterCampanha, podeGerirCampanhas, sessoesWhatsapp,
} from "@/lib/automacoes/campanhas";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { CampanhaEditor } from "@/components/onface/campanhas/CampanhaEditor";
import { CampanhaEnvio } from "@/components/onface/campanhas/CampanhaEnvio";
import { acaoAgendarCampanha, acaoExcluirCampanha, acaoSalvarCampanha, acaoTransicionarCampanha } from "../actions";

export const metadata = { title: "Campanha" };
export const dynamic = "force-dynamic";

// Campanha de outra org (ou id inválido) é 404, não erro: a query já filtra
// por organizacaoId e simplesmente não encontra.
export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  const [campanha, listas, sessoes, podeGerir] = await Promise.all([
    obterCampanha(ctx.organizacaoId, id), listasDisponiveis(ctx.organizacaoId),
    sessoesWhatsapp(ctx.organizacaoId), podeGerirCampanhas(ctx),
  ]);
  if (!campanha) notFound();
  const rascunho = campanha.status === "rascunho";
  const envio = rascunho ? null : await destinatariosDaCampanha(ctx.organizacaoId, campanha.id);

  return (
    <Pagina>
      <PaginaCabecalho
        titulo={campanha.nome}
        descricao={rascunho
          ? "Rascunho: edite, agende ou envie agora."
          : "Fora de rascunho a mensagem fica só para consulta; o envio é acompanhado abaixo."}
      />
      {envio ? (
        <CampanhaEnvio
          campanha={campanha} linhas={envio.linhas} contagem={envio.contagem}
          podeGerir={podeGerir} acaoTransicionar={acaoTransicionarCampanha}
        />
      ) : null}
      <CampanhaEditor
        podeGerir={podeGerir}
        campanha={campanha}
        listas={listas}
        sessoes={sessoes}
        canalInicial={campanha.canal}
        acaoSalvar={acaoSalvarCampanha}
        acaoExcluir={acaoExcluirCampanha}
        acaoAgendar={acaoAgendarCampanha}
      />
    </Pagina>
  );
}
