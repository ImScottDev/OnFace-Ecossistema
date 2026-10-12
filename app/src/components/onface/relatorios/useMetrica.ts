"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { RespostaMetrica } from "@/lib/metricas/consulta";

/**
 * Lê uma métrica do catálogo pela MESMA rota do explorador. Quem usa isto (painel executivo,
 * explorador) recebe o recorte já filtrado no servidor: nenhum cálculo é refeito no navegador.
 */
export type ErroMetrica = Error & { codigo?: string; status?: number };

export function useMetrica(codigo: string, params: Record<string, string | undefined>, ativo = true) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();
  return useQuery<RespostaMetrica, ErroMetrica>({
    queryKey: ["metrica", codigo, qs],
    enabled: ativo,
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/metricas/${codigo}?${qs}`);
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(corpo.error ?? "Não foi possível carregar esta métrica."), { codigo: corpo.codigo, status: r.status });
      return corpo as RespostaMetrica;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
