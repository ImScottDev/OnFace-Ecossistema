"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";

interface NovaPessoaModalProps {
  onClose: () => void;
  onCriada: (leadId: string) => void;
  // Vínculo direto por ID (Cliente 360 → aba Pessoas, 20/08): quando vem de
  // dentro de uma empresa já existente, manda `empresaId` em vez de
  // `empresa` (nome) — evita o POST /leads resolver por ILIKE e arriscar
  // criar uma empresa duplicada por variação de grafia. Campo de empresa
  // fica travado/preenchido, não editável.
  empresaId?: string;
  empresaNome?: string;
}

const inputStyle = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };

export function Cf2NovaPessoaModal({ onClose, onCriada, empresaId, empresaNome }: NovaPessoaModalProps) {
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");

  const criarMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome, sobrenome: sobrenome || undefined, telefone,
          email: email || undefined, cargo: cargo || undefined,
          semNegocio: true,
          ...(empresaId ? { empresaId } : { empresa: empresa || undefined }),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Erro ao criar pessoa");
      return body;
    },
    onSuccess: (lead) => onCriada(lead.id ?? lead.lead?.id),
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Nova Pessoa</h2>
          <button onClick={onClose} style={{ color: "var(--cf2-text-tertiary)" }} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" aria-label="Nome *" autoFocus className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
            <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Sobrenome" aria-label="Sobrenome" className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          </div>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone *" aria-label="Telefone *" className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" aria-label="E-mail" className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={empresaId ? (empresaNome ?? "") : empresa}
              onChange={(e) => { if (!empresaId) setEmpresa(e.target.value); }}
              readOnly={!!empresaId}
              placeholder="Empresa" aria-label="Empresa"
              className="text-sm px-3 py-2 rounded-lg outline-none disabled:opacity-70"
              style={inputStyle}
            />
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" aria-label="Cargo" className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          </div>

          {criarMutation.isError && <p className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>{(criarMutation.error as Error).message}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
            <button
              onClick={() => criarMutation.mutate()}
              disabled={!nome.trim() || !telefone.trim() || criarMutation.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              {criarMutation.isPending ? "Criando..." : "Criar pessoa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
