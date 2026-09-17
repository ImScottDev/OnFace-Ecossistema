/**
 * Formatação compartilhada entre servidor e cliente.
 *
 * Mora fora de `ui.tsx` de propósito: aquele arquivo é `"use client"`, e uma
 * função exportada de lá não pode ser chamada por um Server Component — o
 * Next trata a exportação como referência de cliente, não como função. Formatar
 * moeda é cálculo puro e precisa funcionar dos dois lados.
 */

export function moeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function moedaExata(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** "3d", "5h", "agora" — tempo decorrido em formato curto de card. */
export function decorrido(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return "—";
  if (horas < 1) return "agora";
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}
