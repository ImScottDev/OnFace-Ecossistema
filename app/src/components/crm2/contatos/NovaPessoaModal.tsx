"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";

interface NovaPessoaModalProps {
  onClose: () => void;
  onCriada: (leadId: string) => void;
}

const inputStyle = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };

export function Cf2NovaPessoaModal({ onClose, onCriada }: NovaPessoaModalProps) {
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
          email: email || undefined, empresa: empresa || undefined, cargo: cargo || undefined,
          semNegocio: true,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Erro ao criar pessoa");
      return body;
    },
    onSuccess: (lead) => onCriada(lead.id ?? lead.lead?.id),
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Nova Pessoa</h2>
          <button onClick={onClose} style={{ color: "var(--cf2-text-tertiary)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" autoFocus className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
            <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Sobrenome" className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          </div>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone *" className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2.5">
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa" className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" className="text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
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
