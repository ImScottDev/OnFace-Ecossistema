import { FileText, Send, Check, X, AlertTriangle } from "lucide-react";

export const PROPOSTA_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: "Rascunho", color: "#6B7280", icon: FileText },
  enviada: { label: "Enviada", color: "#3B82F6", icon: Send },
  aceita: { label: "Aceita", color: "#10B981", icon: Check },
  recusada: { label: "Recusada", color: "#EF4444", icon: X },
  expirada: { label: "Expirada", color: "#F59E0B", icon: AlertTriangle },
};

export const TIPOS_ITEM = [
  { value: "recorrente", label: "Recorrente", color: "#3B82F6" },
  { value: "avulso", label: "Avulso", color: "#F59E0B" },
  { value: "setup", label: "Setup", color: "#8B5CF6" },
] as const;

export const MOEDAS = [
  { code: "BRL", symbol: "R$", locale: "pt-BR" },
  { code: "USD", symbol: "$", locale: "en-US" },
  { code: "EUR", symbol: "€", locale: "de-DE" },
  { code: "CAD", symbol: "CA$", locale: "en-CA" },
] as const;

export type MoedaCode = (typeof MOEDAS)[number]["code"];

export function getMoedaInfo(code: string) {
  return MOEDAS.find((m) => m.code === code) || MOEDAS[0];
}

export function formatCurrency(value: number | string, currency: string = "BRL"): string {
  const num = typeof value === "string" ? parseFloat(value) || 0 : value;
  const moeda = getMoedaInfo(currency);
  return `${moeda.symbol} ${num.toLocaleString(moeda.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyValue(value: number | string, currency: string = "BRL"): string {
  const num = typeof value === "string" ? parseFloat(value) || 0 : value;
  const moeda = getMoedaInfo(currency);
  return num.toLocaleString(moeda.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcSubtotal(qty: number, unit: number, discount: number, discountType: string = "percentual"): number {
  if (discountType === "valor") {
    return Math.round((qty * unit - discount) * 100) / 100;
  }
  return Math.round(qty * unit * (1 - discount / 100) * 100) / 100;
}

export function formatPropostaNumero(numero: number, versao: number): string {
  return `#P-${String(numero).padStart(3, "0")}-v${versao}`;
}

export function PropostaNumero({ numero, versao, className }: { numero: number; versao: number; className?: string }) {
  return (
    <span className={`font-mono ${className || "text-xs text-white/70"}`}>
      {formatPropostaNumero(numero, versao)}
    </span>
  );
}

export function PropostaStatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const config = PROPOSTA_STATUS_CONFIG[status] || PROPOSTA_STATUS_CONFIG.rascunho;
  const sizeClasses = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-medium`}
      style={{ background: config.color + "20", color: config.color }}
    >
      {config.label}
    </span>
  );
}
