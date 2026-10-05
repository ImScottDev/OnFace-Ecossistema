import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { podeGerirCampanhas, listasDisponiveis, sessoesWhatsapp } from "@/lib/automacoes/campanhas";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { CampanhaEditor } from "@/components/onface/campanhas/CampanhaEditor";
import { acaoAgendarCampanha, acaoExcluirCampanha, acaoSalvarCampanha } from "../actions";

export const metadata = { title: "Nova campanha" };
export const dynamic = "force-dynamic";

// `?canal=whatsapp` pré-seleciona o canal, como o wizard antigo fazia.
export default async function NovaCampanhaPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const [{ canal }, listas, sessoes, podeGerir] = await Promise.all([
    searchParams, listasDisponiveis(ctx.organizacaoId), sessoesWhatsapp(ctx.organizacaoId), podeGerirCampanhas(ctx),
  ]);

  return (
    <Pagina>
      <PaginaCabecalho titulo="Nova campanha" descricao="Conteúdo, público e remetente. Salve como rascunho, agende ou envie agora." />
      <CampanhaEditor
        podeGerir={podeGerir}
        campanha={null}
        listas={listas}
        sessoes={sessoes}
        canalInicial={canal === "whatsapp" ? "whatsapp" : "email"}
        acaoSalvar={acaoSalvarCampanha}
        acaoExcluir={acaoExcluirCampanha}
        acaoAgendar={acaoAgendarCampanha}
      />
    </Pagina>
  );
}
