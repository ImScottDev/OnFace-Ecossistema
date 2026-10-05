import { notFound } from "next/navigation";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { LabShell } from "@/components/onface/ds/LabShell";
import { FundoGrafico } from "@/components/onface/ds/marca";
import { SLUGS_VALIDOS } from "@/components/onface/ds/navegacao";

export const metadata = { title: "ONFACE Design System" };

/**
 * ONFACE Design System — laboratório vivo.
 *
 * Mora no mesmo route group das telas de produto de propósito: herda a casca
 * real (topbar + tema + providers + toaster + command palette), então o que
 * está documentado aqui é exatamente o que a tela de produto recebe. Uma
 * biblioteca que roda em casca própria mente sobre si mesma.
 *
 * O catch-all opcional dá uma URL por seção sem criar dez arquivos de rota.
 */
export default async function DesignOnfacePage({
  params,
}: {
  params: Promise<{ secao?: string[] }>;
}) {
  const { secao } = await params;
  const slug = secao?.[0] ?? "";
  if (secao && secao.length > 1) notFound();
  if (!SLUGS_VALIDOS.includes(slug)) notFound();

  return (
    <OnfacePage>
      <OnfacePageBand className="ds-lab-hero">
        {/* A faixa grafite é o primeiro exemplo da própria linguagem: malha
            técnica sutil atrás, conteúdo na frente, nada decorativo. */}
        <FundoGrafico variante="malha" superficie="escura" />
        <div className="ds-lab-hero-conteudo">
          <div>
            <p className="ds-lab-hero-rotulo">Biblioteca interna · contrato de interface</p>
            <h1 className="ds-lab-hero-titulo">ONFACE Design System</h1>
            <p className="ds-lab-hero-apoio">
              Fonte única da interface do ONFACE: fundação shadcn/ui, identidade e tokens da Callface,
              e os componentes de produto que as telas montam. Tudo aqui é componente real, rodando na
              casca real. Clique, arraste, filtre, abra.
            </p>
          </div>
          <div className="ds-lab-hero-numeros">
            {/* Sai da mesma contagem da navegação: quatro em Base, quatro em
                Componentes e seis em Produto. */}
            <span className="ds-lab-hero-numero"><b>14</b><span>seções</span></span>
            <span className="ds-lab-hero-numero"><b>39</b><span>primitivas shadcn</span></span>
            <span className="ds-lab-hero-numero"><b>3</b><span>camadas de token</span></span>
          </div>
        </div>
      </OnfacePageBand>

      <OnfacePageSurface sobreposto>
        <LabShell secao={slug} />
      </OnfacePageSurface>
    </OnfacePage>
  );
}
