import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPreVendas } from "@/lib/vendas/consultas";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { PreVendas } from "@/components/onface/vendas/PreVendas";
import { type RotaBaseVendas } from "@/components/onface/vendas/ui";
import {
  acaoAssociarEmpresa, acaoAtribuir, acaoCriarLead, acaoCriarOportunidade,
  acaoDesqualificar, acaoDetalhe, acaoMoverEtapa, acaoNutrir, acaoQualificar,
  acaoReativar, acaoRegistrarContato, acaoSalvarQualificacao,
} from "./actions";

export const metadata = { title: "Pré-vendas | Callface" };
export const dynamic = "force-dynamic";

type Aba = "ativos" | "nutricao" | "desqualificados";

/**
 * Pré-vendas — rota OFICIAL do produto (`/pre-vendas`).
 *
 * A leitura vem de `boardPreVendas`; a escrita, das server actions ao lado,
 * que entram no motor em `lib/vendas`. A página só amarra as duas pontas.
 *
 * Mudou de casa em 18/09 (F1, lote 2): a implementação morava em
 * `/onface-preview/pre-vendas` e a rota oficial servia a tela antiga do CRM
 * 2.0. Agora é o contrário — aqui é a fonte, e o preview é um espelho fino
 * que chama esta mesma função com outro `rotaBase`. Era o preview que
 * segurava o produto; inverter foi o ponto todo de matar o rascunho.
 *
 * `rotaBase` existe porque a tela linka para as irmãs do módulo (abrir a
 * empresa em Contatos, a oportunidade no Pipeline). Sem ele, um clique na
 * rota oficial devolvia o usuário para dentro do preview.
 */
export async function PreVendasPage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string; loop?: string }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  // Kanban único (v0.13 §01.2): sem aba, o board devolve as sete colunas.
  // O parâmetro continua sendo lido para não quebrar link antigo salvo por
  // alguém, mas o padrão é o board inteiro.
  const aba = params.aba === "nutricao" || params.aba === "desqualificados" ? params.aba : undefined;
  const busca = params.busca?.trim() || "";
  const responsavelId = params.responsavel || null;

  // Recorte "sem dono": o resumo acusa quantas são e este parâmetro mostra
  // quais. Sem ele o número seria enfeite.
  const semDono = params.loop === "sem-dono";

  const dados = await boardPreVendas(ctx.organizacaoId, { aba, busca, responsavelId, semDono });

  return (
    <Pagina>
      <PaginaCabecalho titulo="Pré-vendas" />
      <PaginaResumo
        itens={[
          {
            rotulo: "Em jogo",
            valor: dados.resumo.ativos,
            detalhe: `${dados.resumo.nutricao} em nutrição`,
            destaque: true,
          },
          // Os dois sinais desta tela são os dois jeitos de um lead morrer
          // parado: ninguém dono dele, ou dono sem ter falado ainda.
          {
            rotulo: "Sem responsável",
            valor: dados.resumo.semResponsavel,
            sinal: true,
            href: "/pre-vendas?loop=sem-dono",
          },
          // "Sem 1º contato" fica como fato, não como sinal: a consulta
          // canônica ainda não tem esse recorte, e sinal sem destino é o
          // número morto que a spec proíbe. Vira sinal quando o filtro
          // existir.
          { rotulo: "Sem 1º contato", valor: dados.resumo.semPrimeiroContato },
          { rotulo: "Em nutrição", valor: dados.resumo.nutricao },
        ]}
      />

        <PreVendas
          rotaBase={rotaBase}
          dados={dados}
          aba={aba}
          filtro={{ busca, responsavelId }}
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
          }}
        />
    </Pagina>
  );
}

export default PreVendasPage;
