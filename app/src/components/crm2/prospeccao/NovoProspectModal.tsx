"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Lista { id: string; nome: string }
interface Usuario { id: string; nome: string }

// Mesmo padrão de máscara do Novo Lead (Pré-vendas, 24/08) — telefone cru
// sem formatação era um dos pontos que o Kauã apontou como "feio" aqui.
function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos.length ? `(${digitos}` : "";
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/** Criação manual de 1 prospect outbound — reaproveita POST /api/leads (mesmo endpoint do resto do CRM), `semNegocio: true` porque prospect recém-criado ainda não foi qualificado. */
export function NovoProspectModal({
  open, onClose, listas, usuarios, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  listas: Lista[];
  usuarios: Usuario[];
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [listaId, setListaId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, empresa: empresa || undefined, cargo: cargo || undefined, telefone: telefone.replace(/\D/g, ""), email: email || undefined, responsavelId: responsavelId || undefined, origem: "outbound", semNegocio: true }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "falha"); }
      return r.json();
    },
    onSuccess: async (data) => {
      const leadId = data?.id;
      if (listaId && leadId) {
        await fetch("/api/contatos-unified/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", listaId, leadIds: [leadId] }) });
      }
      toast.success("Prospect criado.");
      onCreated();
      reset();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar o prospect"),
  });

  function reset() { setNome(""); setEmpresa(""); setCargo(""); setTelefone(""); setEmail(""); setListaId(""); setResponsavelId(""); }
  function handleClose() { reset(); onClose(); }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={handleClose}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Novo prospect</p>
          <button onClick={handleClose} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>
        <Field label="Nome *" value={nome} onChange={setNome} placeholder="Nome do prospect" aria-label="Nome do prospect" />
        <Field label="Empresa" value={empresa} onChange={setEmpresa} placeholder="Empresa" aria-label="Empresa" />
        <Field label="Cargo" value={cargo} onChange={setCargo} placeholder="Cargo" aria-label="Cargo" />
        <Field label="Telefone *" value={formatarTelefone(telefone)} onChange={(v) => setTelefone(v.replace(/\D/g, ""))} placeholder="(11) 99999-9999" aria-label="(11) 99999-9999" />
        <Field label="E-mail" value={email} onChange={setEmail} placeholder="email@empresa.com" aria-label="email@empresa.com" />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Lista</span>
          <select value={listaId} onChange={(e) => setListaId(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
            <option value="">— nenhuma —</option>
            {listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Responsável</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
            <option value="">Sem responsável definido</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button onClick={() => nome.trim() && telefone.trim() ? create.mutate() : toast.error("Nome e telefone são obrigatórios")} disabled={create.isPending} className="px-4 py-2 rounded-xl text-[13px] font-bold disabled:opacity-60" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            {create.isPending ? "Criando..." : "Criar prospect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
    </div>
  );
}
