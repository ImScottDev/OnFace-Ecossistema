import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPreVendas, ehView, type ViewPreVendas } from "@/lib/vendas/consultas";
import { PreVendasQuadro } from "@/components/onface/vendas/PreVendasQuadro";
import { type RotaBaseVendas } from "@/components/onface/vendas/ui";
import {
  acaoAssociarEmpresa, acaoAtribuir, acaoAtribuirEmMassa, acaoCriarLead,
  acaoCriarOportunidade, acaoCriarTarefa, acaoDesqualificar, acaoDetalhe,
  acaoMoverEtapa, acaoNutrir, acaoQualificar, acaoReativar,
  acaoRegistrarContato, acaoSalvarQualificacao,
} from "./actions";

export const metadata = { title: "Pré-vendas" };
export const dynamic = "force-dynamic";

/**
 * Pré-vendas — rota OFICIAL do produto (`/pre-vendas`).
 *
 * A leitura vem de `boardPreVendas`; a escrita, das server actions ao lado,
 * que entram no motor em `lib/vendas`. A página só amarra as duas pontas.
 *
 * TODO recorte vive na URL — view, busca, responsável, origem, campanha e
 * data. É o que faz F5, link compartilhado e volta do detalhe devolverem
 * exatamente o mesmo board. Recorte em estado de componente morre no primeiro
 * recarregar, e a spec pede o contrário explicitamente (§2).
 *
 * `rotaBase` existe porque a tela linka para as irmãs do módulo (abrir a
 * empresa em Contatos, a oportunidade no Pipeline). Sem ele, um clique na
 * rota oficial devolvia o usuário para dentro do preview.
 */
export async function PreVendasPage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{
    view?: string; busca?: string; responsavel?: string;
    origem?: string; campanha?: string; desde?: string;
    /** Link antigo salvo por alguém antes do Kanban único. */
    aba?: string; loop?: string;
  }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;

  // Kanban único (v0.13 §01.2): sem aba, o board devolve as sete colunas. O
  // parâmetro continua sendo lido para não quebrar link antigo salvo por
  // alguém, mas o padrão é o board inteiro.
  const aba = params.aba === "nutricao" || params.aba === "desqualificados" ? params.aba : undefined;

  // `?loop=sem-dono` era o destino do KPI "Sem responsável" antes das views.
  // Continua funcionando, agora como a view que faz a mesma coisa.
  const view: ViewPreVendas = ehView(params.view)
    ? params.view
    : params.loop === "sem-dono" ? "sem-dono" : "todos";

  const busca = params.busca?.trim() || "";
  const responsavelId = params.responsavel || null;
  const origem = params.origem || null;
  const campanha = params.campanha || null;
  const desde = params.desde || null;

  const dados = await boardPreVendas(ctx.organizacaoId, {
    aba, busca, responsavelId, origem, campanha, desde,
    view, usuarioId: ctx.userId,
  });

  return (
    <PreVendasQuadro
      dados={dados}
      usuarioId={ctx.userId}
      acoes={{
        moverEtapa: acaoMoverEtapa,
        qualificar: acaoQualificar,
        salvarQualificacao: acaoSalvarQualificacao,
        nutrir: acaoNutrir,
        desqualificar: acaoDesqualificar,
        reativar: acaoReativar,
        registrarContato: acaoRegistrarContato,
        atribuir: acaoAtribuir,
        criarOportunidade: acaoCriarOportunidade,
        criarLead: acaoCriarLead,
        associarEmpresa: acaoAssociarEmpresa,
        detalhe: acaoDetalhe,
        criarTarefa: acaoCriarTarefa,
        atribuirEmMassa: acaoAtribuirEmMassa,
      }}
    />
  );
}

export default PreVendasPage;
