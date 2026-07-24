"use client";

import { useQuery } from "@tanstack/react-query";

export interface Me {
  userId: string;
  nome: string;
  role: string;       // papel EFETIVO (já normalizado; respeita view-as)
  rawRole: string;
  isViewingAs: boolean;
  realRole: string;
  organizacaoId: string;
}

/**
 * Identidade efetiva do usuário (papel que vale AGORA, inclusive sob view-as).
 * Use isto — e NÃO `useSession().user.role` — pra decidir qual visão mostrar,
 * porque no view-as a sessão do navegador continua sendo a do admin.
 */
export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => fetch("/api/me").then((r) => r.json()),
    staleTime: 60_000,
  });
}
