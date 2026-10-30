"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  nome: string;
  tipo: string;
  valorSugerido: string | null;
  serviceFamily: string;
  revenueNature: string | null;
  ativo: boolean;
  stripeProductId: string | null;
}

const FAMILIAS = [
  { value: "CALLFACE_AI", label: "Callface AI" },
  { value: "PABX", label: "PABX" },
  { value: "WHITE_LABEL", label: "White Label" },
  { value: "ASSISTANT", label: "Callface Assistant" },
  { value: "UNKNOWN", label: "Não classificado" },
];
const NATUREZAS = ["MRR", "SETUP", "PROJECT", "ONE_TIME", "USAGE", "HARDWARE", "UNKNOWN"];

function brl(v: string | null) {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/**
 * Ajustes → Catálogo (19/08) — CRM define a semântica, Stripe é só quem
 * cobra (ADR-EXEC-020). Família/natureza nunca inferida por nome em
 * runtime — sempre declarada aqui. Organizado por família pra não expor
 * SKUs históricos crus pro vendedor; "não classificado" fica sempre por
 * último, colapsado.
 */
export function Cf2CatalogoWorkspace() {
  const qc = useQueryClient();
  const [mostrarNaoClassificados, setMostrarNaoClassificados] = useState(false);

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["cf2-catalogo", mostrarNaoClassificados],
    queryFn: async () => {
      const r = await fetch(`/api/servicos-catalogo?all=true${mostrarNaoClassificados ? "&incluirNaoClassificados=true" : ""}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const salvar = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Item>) => {
      const r = await fetch(`/api/servicos-catalogo/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-catalogo"] }),
    onError: () => toast.error("Não foi possível salvar"),
  });

  const classificados = items.filter((i) => i.serviceFamily !== "UNKNOWN");
  const naoClassificados = items.filter((i) => i.serviceFamily === "UNKNOWN");

  return (
    <div className="flex flex-col gap-5">
      {["CALLFACE_AI", "PABX", "WHITE_LABEL", "ASSISTANT"].map((fam) => {
        const doFamilia = classificados.filter((i) => i.serviceFamily === fam);
        if (doFamilia.length === 0) return null;
        return (
          <div key={fam} className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>{FAMILIAS.find((f) => f.value === fam)?.label} ({doFamilia.length})</p>
            <div className="flex flex-col gap-1.5">
              {doFamilia.map((item) => (
                <ItemRow key={item.id} item={item} onSalvar={(patch) => salvar.mutate({ id: item.id, ...patch })} />
              ))}
            </div>
          </div>
        );
      })}

      {isLoading && <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>}

      <div className="p-5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <button onClick={() => setMostrarNaoClassificados((v) => !v)} className="w-full flex items-center justify-between">
          <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Não classificados{mostrarNaoClassificados ? ` (${naoClassificados.length})` : ""}</p>
          <ChevronDown className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)", transform: mostrarNaoClassificados ? "rotate(180deg)" : undefined }} />
        </button>
        {!mostrarNaoClassificados && <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>Legado/SKU obsoleto/ajuste financeiro — sem evidência real pra classificar. Clique para revisar.</p>}
        {mostrarNaoClassificados && (
          <div className="flex flex-col gap-1.5 mt-3">
            {naoClassificados.map((item) => (
              <ItemRow key={item.id} item={item} onSalvar={(patch) => salvar.mutate({ id: item.id, ...patch })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, onSalvar }: { item: Item; onSalvar: (patch: Partial<Item>) => void }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: item.ativo ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)" }}>{item.nome}</p>
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{brl(item.valorSugerido)} · {item.tipo}{!item.ativo ? " · inativo" : ""}</p>
      </div>
      <select value={item.serviceFamily} onChange={(e) => onSalvar({ serviceFamily: e.target.value })} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        {FAMILIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={item.revenueNature || "UNKNOWN"} onChange={(e) => onSalvar({ revenueNature: e.target.value })} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
