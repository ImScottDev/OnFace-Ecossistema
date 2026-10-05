import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { getProjeto } from "@/lib/operacao/projeto";
/* O projeto é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { ProjetoProto } from "@/components/onface/proto/ProjetoProto";

export const metadata = { title: "Projeto" };
export const dynamic = "force-dynamic";

/**
 * Um projeto de Onboarding & Implantação.
 *
 * O `id` é o do FULFILLMENT: não existe tabela "projetos", e o fulfillment é o
 * que carrega checklist, responsável, formulário público e conclusão.
 */
export default async function ProjetoPorId({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams]);
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const projeto = await getProjeto(ctx.organizacaoId, id);
  if (!projeto) notFound();

  /* O link público do formulário vai em mensagem para o cliente, então tem de
     ser absoluto — e o servidor é quem sabe o host sem tocar em `window`. */
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origem = host ? `${proto}://${host}` : "";

  return <ProjetoProto projeto={projeto} abaInicial={aba ?? null} origem={origem} />;
}
