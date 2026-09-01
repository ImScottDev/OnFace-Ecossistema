"use client";

import {
  Cf2Select, Cf2SelectContent, Cf2SelectItem, Cf2SelectTrigger, Cf2SelectValue,
} from "@/components/crm2/ui/Select";

/**
 * Select rotulado no vocabulário chrome/escuro (Pipeline, Pré-vendas — Vendas
 * usa o esquema invertido: topo claro, corpo do módulo escuro). Promovido a
 * compartilhado 25/08 depois de nascer em Pré-vendas e ser reusado em
 * Pipeline — mesmo padrão de rótulo+faixa rolável já validado no tema claro
 * de Prospecção, só com os tokens --cf2-chrome-* no lugar dos --cf2-* claros.
 */
export function DarkFilterSelect({ value, onChange, label, placeholder, children }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string; children: React.ReactNode;
}) {
  return (
    <Cf2Select value={value} onValueChange={onChange}>
      <Cf2SelectTrigger
        aria-label={label}
        className="h-8 shrink-0 w-auto max-w-none py-1.5 text-[12px] font-medium"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-secondary)" }}
      >
        <span style={{ color: "var(--cf2-chrome-text-secondary)", opacity: 0.7 }}>{label}:</span>
        <Cf2SelectValue placeholder={placeholder} />
      </Cf2SelectTrigger>
      <Cf2SelectContent style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
        {children}
      </Cf2SelectContent>
    </Cf2Select>
  );
}

export function DarkItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Cf2SelectItem value={value} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>
      {children}
    </Cf2SelectItem>
  );
}
