/** Espelho de `/contatos` sob o prefixo do preview.
 *
 * A implementação mora na rota oficial desde 18/09 (F1, lote 2). Este arquivo
 * existe para o preview continuar navegável como referência, sem virar uma
 * segunda cópia da tela: a única diferença é o `rotaBase`, que mantém os links
 * internos dentro do próprio preview. */
import { ContatosPage } from "@/app/(crm2)/contatos/page";

export const metadata = { title: "ONFACE — Contatos & Empresas" };
export const dynamic = "force-dynamic";

export default async function EspelhoContatosPage({ searchParams }: {
  searchParams: Promise<{ aba?: string; busca?: string; relacao?: string; semEmpresa?: string; empresa?: string; pessoa?: string }>;
}) {
  return ContatosPage({ searchParams, rotaBase: "/onface-preview" });
}
