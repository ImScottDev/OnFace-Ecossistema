"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Leads + Contatos unificados em /contatos (13/jul, pedido do Scott). A listagem
// de Leads deixou de existir como página própria — filtro "Lead" dentro de
// /contatos faz o mesmo papel. Mantido como redirect pra não quebrar links antigos.
export default function LeadsRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/contatos?tipo=lead"); }, [router]);
  return null;
}
