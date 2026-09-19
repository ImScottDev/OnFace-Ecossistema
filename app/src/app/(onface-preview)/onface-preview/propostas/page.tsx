/** Espelho de `/propostas` sob o prefixo do preview.
 *
 * A implementação mora na rota oficial desde 18/09 (F1, lote 2). Este arquivo
 * existe para o preview continuar navegável como referência, sem virar uma
 * segunda cópia da tela: a única diferença é o `rotaBase`, que mantém os links
 * internos dentro do próprio preview. */
import { PropostasPage } from "@/app/(crm2)/propostas/page";

export const metadata = { title: "ONFACE — Propostas" };
export const dynamic = "force-dynamic";

export default async function EspelhoPropostasPage({ searchParams }: {
  searchParams: Promise<{ status?: string; busca?: string; oportunidade?: string; proposta?: string; acao?: "enviar" | "juridicos" | "revisar" }>;
}) {
  return PropostasPage({ searchParams, rotaBase: "/onface-preview" });
}
