import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina } from "@/components/onface/shell/Pagina";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import { ProjetoTela } from "@/components/onface/pos-venda/projeto/ProjetoTela";
import { abaDoProjeto } from "@/components/onface/pos-venda/parametros";
import type { AcoesDaTela } from "@/components/onface/pos-venda/projeto/acoes";
import "@/components/onface/pos-venda/pos-venda.css";
import {
  pvAdicionarNota, pvAtribuirTarefa, pvConcluirTarefa, pvEncerrarEspera, pvEnviarFormulario, pvEscalarParaImplantacao,
  pvFazerHandoff, pvMarcarEspera, pvMarcarItem, pvReabrirTarefa, pvRemarcarTarefa, pvSalvarLevantamento,
} from "../actions";
import { lerEquipe, lerProjeto } from "../fonte";

export const metadata = { title: "Projeto · Pós-vendas" };
export const dynamic = "force-dynamic";

/**
 * Projeto de pós-venda. Server Component: lê uma vez, entrega pronto, e passa
 * as server actions por prop (já amarradas ao projeto) para a tela cliente.
 */
export default async function ProjetoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [{ id }, { aba }] = await Promise.all([params, searchParams]);
  const [leitura, equipe] = await Promise.all([lerProjeto(ctx.organizacaoId, id), lerEquipe(ctx.organizacaoId)]);

  if (!leitura.ok) {
    return (
      <Pagina>
        <div className="pv">
          <ErroDeLeitura titulo="Não consegui carregar este projeto" detalhe={leitura.erro} />
        </div>
      </Pagina>
    );
  }
  if (!leitura.dados) notFound();

  const acoes: AcoesDaTela = {
    concluirTarefa: pvConcluirTarefa.bind(null, id),
    reabrirTarefa: pvReabrirTarefa.bind(null, id),
    marcarItem: pvMarcarItem.bind(null, id),
    atribuirTarefa: pvAtribuirTarefa.bind(null, id),
    remarcarTarefa: pvRemarcarTarefa.bind(null, id),
    marcarEspera: pvMarcarEspera.bind(null, id),
    encerrarEspera: pvEncerrarEspera.bind(null, id),
    adicionarNota: pvAdicionarNota.bind(null, id),
    salvarLevantamento: pvSalvarLevantamento.bind(null, id),
    enviarFormulario: pvEnviarFormulario.bind(null, id),
    escalarParaImplantacao: pvEscalarParaImplantacao.bind(null, id),
    fazerHandoff: pvFazerHandoff.bind(null, id),
  };

  return (
    <Pagina>
      <ProjetoTela projeto={leitura.dados} equipe={equipe.ok ? equipe.dados : []} agora={new Date()} acoes={acoes} abaInicial={abaDoProjeto(aba)} />
    </Pagina>
  );
}
