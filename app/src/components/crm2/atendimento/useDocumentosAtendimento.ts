"use client";

import { useQuery } from "@tanstack/react-query";

export type DocumentoAtendimento = {
  id: string;
  titulo: string;
  categoria: string;
  familia: string | null;
  arquivoUrl: string;
  descricao: string | null;
};

export const DOCUMENTOS_CATEGORIA_LABEL: Record<string, string> = {
  apresentacao: "Apresentação",
  tecnico: "Técnico",
  comercial: "Comercial",
  manual: "Manual",
  outro: "Outro",
};

export const DOCUMENTOS_FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callpilot (Callface AI)",
  PABX: "PABX",
  WHITE_LABEL: "White Label",
};

/**
 * Fetch compartilhado de Documentos de Atendimento (23/08) — extraído do
 * DocumentosPanel.tsx (tela cheia removida) pra ser reaproveitado dentro do
 * modal de Scripts/Documentos aberto a partir do composer do ChatThread.
 * Mesma rota/dado, sem duplicar query: GET /api/documentos-atendimento já
 * filtra por organizacaoId + ativo=true.
 */
export function useDocumentosAtendimento() {
  return useQuery<{ documentos: DocumentoAtendimento[] }>({
    queryKey: ["documentos-atendimento"],
    queryFn: async () => {
      const r = await fetch("/api/documentos-atendimento");
      if (!r.ok) return { documentos: [] };
      return r.json();
    },
  });
}
