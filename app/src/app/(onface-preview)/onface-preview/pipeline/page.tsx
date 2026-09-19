/** Espelho de `/pipeline` sob o prefixo do preview.
 *
 * A implementação mora na rota oficial desde 18/09 (F1, lote 2). Este arquivo
 * existe para o preview continuar navegável como referência, sem virar uma
 * segunda cópia da tela: a única diferença é o `rotaBase`, que mantém os links
 * internos dentro do próprio preview. */
import { PipelinePage } from "@/app/(crm2)/pipeline/page";

export const metadata = { title: "ONFACE — Pipeline" };
export const dynamic = "force-dynamic";

export default async function EspelhoPipelinePage({ searchParams }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string; familia?: string; oportunidade?: string }>;
}) {
  return PipelinePage({ searchParams, rotaBase: "/onface-preview" });
}
