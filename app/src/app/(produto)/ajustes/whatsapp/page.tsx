import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { NumerosWhatsapp } from "./Numeros";

export const metadata = { title: "WhatsApp · Ajustes" };

/**
 * WhatsApp em Ajustes (12/10/2026): os números como entidade operacional.
 *
 * Tudo que a tela mostra vem de /api/whatsapp/numeros, com o escopo resolvido
 * no servidor: os meus (dono ou autorizado) para todo mundo; a equipe para a
 * gestão (admin vê a organização, gerente/coordenador vê o time). Os filtros
 * da tela são parâmetros dessa rota, não recorte em memória.
 */
export default async function AjustesWhatsAppPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  return <NumerosWhatsapp />;
}
