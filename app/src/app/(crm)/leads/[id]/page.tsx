"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Leads + Contatos unificados em /contatos (13/jul). Mantido como redirect pra
// não quebrar links antigos (notificações, outras páginas que ainda apontem aqui).
export default function LeadRedirectPage() {
  const { id } = useParams();
  const router = useRouter();
  useEffect(() => { router.replace(`/contatos/${id}`); }, [id, router]);
  return null;
}
