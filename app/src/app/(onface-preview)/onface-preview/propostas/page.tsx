import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { Propostas } from "@/components/onface/vendas/Propostas";
import { Hero } from "@/components/onface/vendas/ui";
import { moeda } from "@/components/onface/vendas/formato";
import {
  acaoCatalogo, acaoCriar, acaoCriarRevisao, acaoDetalhe, acaoEnviar,
  acaoExpirarVencidas, acaoListar, acaoOportunidadesAbertas,
} from "./actions";

export const metadata = { title: "ONFACE — Propostas" };
export const dynamic = "force-dynamic";

export default async function PropostasPage({ searchParams }: {
  searchParams: Promise<{ status?: string; busca?: string; oportunidade?: string; proposta?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const status = params.status || null;
  const busca = params.busca?.trim() || "";
  const linhas = await acaoListar({ status, busca });

  const vigentes = linhas.filter((p) => ["enviada", "visualizada", "ajuste_solicitado"].includes(p.status));
  const aceitas = linhas.filter((p) => p.status === "aceita");

  return (
    <OnfacePage>
      <OnfacePageBand>
        <Hero
          titulo="Propostas"
          descricao="Uma oportunidade tem várias propostas históricas e uma vigente por vez. Catálogo filtrado pela família; aceite não é ganho."
          resumo={[
            { rotulo: "Abertas", valor: vigentes.length },
            { rotulo: "Em aberto", valor: moeda(vigentes.reduce((s, p) => s + (p.total ?? 0), 0)) },
            { rotulo: "Aceitas", valor: aceitas.length },
            { rotulo: "Ajuste pedido", valor: linhas.filter((p) => p.status === "ajuste_solicitado").length, alerta: linhas.some((p) => p.status === "ajuste_solicitado") },
          ]}
        />
      </OnfacePageBand>
      <OnfacePageSurface sobreposto>
        <Propostas
          linhas={linhas}
          filtro={{ busca, status }}
          oportunidadeInicial={params.oportunidade ?? null}
          propostaInicial={params.proposta ?? null}
          acoes={{
            detalhe: acaoDetalhe, catalogo: acaoCatalogo,
            oportunidadesAbertas: acaoOportunidadesAbertas, criar: acaoCriar,
            enviar: acaoEnviar, criarRevisao: acaoCriarRevisao,
            expirarVencidas: acaoExpirarVencidas,
          }}
        />
      </OnfacePageSurface>
    </OnfacePage>
  );
}
