/** Espelho de `/prospeccao` sob o prefixo do preview.
 *
 * A implementação mora na rota oficial desde 18/09 (F1, lote 2). Este arquivo
 * existe para o preview continuar navegável como referência, sem virar uma
 * segunda cópia da tela: a única diferença é o `rotaBase`, que mantém os links
 * internos dentro do próprio preview. */
import { ProspeccaoPage } from "@/app/(crm2)/prospeccao/page";

export const metadata = { title: "ONFACE — Prospecção" };
export const dynamic = "force-dynamic";

export default async function EspelhoProspeccaoPage({ searchParams }: {
  searchParams: Promise<{ visao?: string; busca?: string; estado?: string; responsavel?: string; lista?: string }>;
}) {
  return ProspeccaoPage({ searchParams, rotaBase: "/onface-preview" });
}
