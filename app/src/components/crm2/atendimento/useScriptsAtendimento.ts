"use client";

import { useQuery } from "@tanstack/react-query";

export type ScriptAtendimento = {
  id: string;
  titulo: string;
  categoria: string;
  conteudo: string;
  versao: number;
  // GET /scripts-atendimento faz `select()` (todas as colunas) — createdAt
  // já vem no payload, só não estava tipado porque o ScriptsPanel não
  // precisava dele. Usado pra ordenar "Scripts sugeridos" por mais recente.
  createdAt?: string;
};

export const SCRIPTS_CATEGORIA_LABEL: Record<string, string> = {
  pre_vendas: "Pré-vendas",
  comercial: "Comercial",
  entrega: "Entrega",
  cs: "CS",
  geral: "Geral",
};

/**
 * Fetch compartilhado de Scripts de Atendimento (20/08) — extraído do
 * ScriptsPanel.tsx pra ser reaproveitado também no painel de contexto
 * ("Scripts sugeridos" na aba Detalhes), sem duplicar a query/rota.
 * GET /api/scripts-atendimento já filtra por organizacaoId + ativo=true
 * e ordena por categoria (ver src/api-server/routes/scripts-atendimento.ts).
 */
export function useScriptsAtendimento() {
  return useQuery<{ scripts: ScriptAtendimento[] }>({
    queryKey: ["scripts-atendimento"],
    queryFn: async () => {
      const r = await fetch("/api/scripts-atendimento");
      if (!r.ok) return { scripts: [] };
      return r.json();
    },
  });
}
