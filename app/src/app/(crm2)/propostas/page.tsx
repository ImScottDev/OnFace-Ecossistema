import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
/* A tela é o desenho do handoff, convertido por máquina. `vendas/Propostas`
   era a versão recriada à mão e sai da rota — ver docs/design/PLANO-HANDOFF.md. */
import { PropostasProto } from "@/components/onface/proto/PropostasProto";
import { moeda } from "@/components/onface/vendas/formato";
import {
  acaoCatalogo, acaoCriar, acaoCriarRevisao, acaoDetalhe, acaoEnviar,
  acaoExpirarVencidas, acaoListar, acaoOportunidadesAbertas, acaoSalvarJuridicos,
} from "./actions";

export const metadata = { title: "Propostas" };
export const dynamic = "force-dynamic";

/** Propostas (Módulo 01, Bloco 03). */
export async function PropostasPage({ searchParams, abrirComposer = false }: {
  searchParams: Promise<{ status?: string; busca?: string; oportunidade?: string; proposta?: string; acao?: "enviar" | "juridicos" | "revisar" }>;
  abrirComposer?: boolean;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const status = params.status || null;
  const busca = params.busca?.trim() || "";
  const linhas = await acaoListar({ status, busca });

  const vigentes = linhas.filter((p) => ["enviada", "visualizada", "ajuste_solicitado"].includes(p.status));
  const aceitas = linhas.filter((p) => p.status === "aceita");

  /* O desenho filtra por responsável, e a lista já sabe de quem é cada
     proposta. Nomes únicos e ordenados: é o que alimenta o menu. */
  const responsaveis = [...new Set(linhas.map((p) => p.responsavel).filter((n): n is string => Boolean(n)))].sort();

  return <PropostasProto linhas={linhas} responsaveis={responsaveis} />;
}

export default PropostasPage;
