import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { montarAtividades } from "@/lib/analytics/onface-atividades";
import { Atividades } from "@/components/onface/atividades/Atividades";
import {
  acaoAlternarConclusao, acaoBuscarContatos, acaoBuscarEmpresas,
  acaoBuscarNegocios, acaoCriarAtividade, acaoMudarStatus, acaoResponsaveis,
} from "./actions";

export const metadata = { title: "ONFACE — Atividades" };
export const dynamic = "force-dynamic";

/**
 * Atividades, dentro de Operação.
 *
 * A leitura vem de `montarAtividades` (tabela `tarefas`) e a escrita das server
 * actions ao lado. A página só amarra as duas pontas no componente.
 */
export default async function OnfaceAtividadesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const dados = await montarAtividades(ctx.organizacaoId);

  return (
    <Atividades
      dados={dados}
      acoes={{
        buscarEmpresas: acaoBuscarEmpresas,
        buscarContatos: acaoBuscarContatos,
        buscarNegocios: acaoBuscarNegocios,
        responsaveis: acaoResponsaveis,
        criar: acaoCriarAtividade,
        alternarConclusao: acaoAlternarConclusao,
        mudarStatus: acaoMudarStatus,
      }}
    />
  );
}
