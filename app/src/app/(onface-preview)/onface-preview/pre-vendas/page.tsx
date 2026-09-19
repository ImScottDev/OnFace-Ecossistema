/** Espelho de `/pre-vendas` sob o prefixo do preview.
 *
 * A implementação mora na rota oficial desde 18/09 (F1, lote 2). Este arquivo
 * existe para o preview continuar navegável como referência, sem virar uma
 * segunda cópia da tela: a única diferença é o `rotaBase`, que mantém os links
 * internos dentro do próprio preview. */
import { PreVendasPage } from "@/app/(crm2)/pre-vendas/page";

export const metadata = { title: "ONFACE — Pré-vendas" };
export const dynamic = "force-dynamic";

export default async function PreVendasPreview({ searchParams }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string }>;
}) {
  return PreVendasPage({ searchParams, rotaBase: "/onface-preview" });
}
