import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPreVendas, ehView, type ViewPreVendas } from "@/lib/vendas/consultas";
/* A tela é o desenho do Claude Design, convertido por máquina — não uma
   recriação. `PreVendasQuadro` era a versão feita à mão e saiu em 24/09:
   cada transcrição dela introduzia divergência visual que só aparecia na
   revisão do Kauã. Ver docs/design/COMO-LIGAR-UMA-TELA.md. */
import { PreVendasProto } from "@/components/onface/proto/PreVendasProto";
import {
  acaoAssociarEmpresa, acaoAtribuir, acaoAtribuirEmMassa, acaoCriarLead,
  acaoCriarOportunidade, acaoCriarTarefa, acaoDesqualificar, acaoDetalhe,
  acaoMoverEtapa, acaoNutrir, acaoQualificar, acaoReativar,
  acaoRegistrarContato, acaoSalvarQualificacao,
  acaoTagDoLead, acaoOpcoesEmMassa,
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
 */
export async function PreVendasPage({ searchParams }: {
  searchParams: Promise<{
    view?: string; busca?: string; responsavel?: string;
    origem?: string; campanha?: string; desde?: string;
    /** Link antigo salvo por alguém antes do Kanban único. */
    aba?: string; loop?: string;
    /** Quantos cartões por coluna — o "ver mais" do quadro aumenta este número.
     *  Fica na URL para sobreviver ao recarregar e ao voltar do detalhe. */
    mostrar?: string;
  }>;
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

  /* Teto de 2.000: acima disso o navegador trava montando cartão e ninguém
     varre isso com o olho — para volume alto o caminho é filtro e busca. */
  const pedido = Number.parseInt(params.mostrar ?? "", 10);
  const porColuna = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 20), 2000) : undefined;

  const dados = await boardPreVendas(ctx.organizacaoId, {
    aba, busca, responsavelId, origem, campanha, desde,
    view, usuarioId: ctx.userId, porColuna,
  });

  return (
    <PreVendasProto
      dados={dados}
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
        tag: acaoTagDoLead, tagsDaOrg: acaoOpcoesEmMassa,
      }}
    />
  );
}

export default PreVendasPage;
