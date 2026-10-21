"use client";

import { useQuery } from "@tanstack/react-query";
import type { PainelGeral, Cartao, BlocoCartoes } from "@/lib/metricas/painel-geral-tipos";

/**
 * O painel inteiro numa requisição.
 *
 * A tela antes disparava uma consulta por indicador, e cada uma fazia vários
 * round-trips ao Postgres — com dez blocos isso vira dez esqueletos piscando
 * fora de ordem. Aqui o servidor monta tudo junto, e cada cartão já vem com o
 * recorte do drill pronto: a tela nunca remonta um recorte, que é o que garante
 * que o cartão, a barra do gráfico e o CSV mostrem o mesmo conjunto.
 *
 * A chave não colide com a do explorador (`["metrica", codigo, qs]`): são
 * recortes diferentes — resumo aqui, registros paginados lá.
 */
export type ErroPainel = { status: number; codigo: string; mensagem: string };

export function usePainel(params: { periodo: string; familia?: string; serie?: string; testes?: boolean }) {
  const qs = new URLSearchParams();
  qs.set("periodo", params.periodo);
  if (params.familia) qs.set("familia", params.familia);
  if (params.serie) qs.set("serie", params.serie);
  if (params.testes) qs.set("testes", "1");
  const busca = qs.toString();

  return useQuery<PainelGeral, ErroPainel>({
    queryKey: ["painel-geral", busca],
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/painel?${busca}`);
      if (!r.ok) {
        const corpo = await r.json().catch(() => ({}));
        throw {
          status: r.status,
          codigo: String(corpo?.codigo ?? "erro"),
          mensagem: String(corpo?.mensagem ?? "Não foi possível carregar o painel."),
        } satisfies ErroPainel;
      }
      return r.json();
    },
  });
}

/** Acha um cartão pelo código em qualquer bloco, sem a tela saber onde ele mora. */
export function cartao(painel: PainelGeral | undefined, codigo: string): Cartao | null {
  if (!painel) return null;
  for (const bloco of Object.values(painel.blocos)) {
    const cartoes = (bloco as Partial<BlocoCartoes>).cartoes;
    if (!cartoes) continue;
    const achado = cartoes.find((c) => c.codigo === codigo);
    if (achado) return achado;
  }
  return null;
}

/** Só publica número quando o estado autoriza. Ausência nunca vira zero. */
export function valorDe(c: Cartao | null): number | null {
  if (!c) return null;
  return c.estado === "disponivel" || c.estado === "parcial" ? c.valor : null;
}
