"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";

interface Usuario { id: string; nome: string }

const ORIGEM_TEMPLATES = [
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "midia_paga", label: "Mídia paga" },
  { value: "rd_station", label: "RD Station" },
  { value: "outro", label: "Outro..." },
];

function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos.length ? `(${digitos}` : "";
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Novo Lead (24/08, pedido do Kauã: "se a gente tá falando de pré-vendas é
 * Novo lead e não Novo negócio" — o CTA global do Topbar caía direto no
 * `/negocios/novo` legado). Cria via `POST /api/leads` com `semNegocio:
 * true` (mesmo flag que Prospecção já usa pra prospect manual) — o negócio
 * só nasce depois, na qualificação (converter-oportunidade), não aqui.
 *
 * Inbound/Outbound é campo obrigatório (motion diferente: outbound cai
 * direto em `origem="outbound"` — mesma chave que `isOutboundLead()` já
 * reconhece em todo o funil — inbound escolhe a origem real).
 */
export function Cf2NovoLeadModal({
  open, onClose, usuarios, onCreated, onImportar,
}: {
  open: boolean;
  onClose: () => void;
  usuarios: Usuario[];
  onCreated: () => void;
  onImportar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [motion, setMotion] = useState<"inbound" | "outbound" | "">("");
  const [origem, setOrigem] = useState("");
  const [origemOutraTexto, setOrigemOutraTexto] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [empresaCnpj, setEmpresaCnpj] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  const origemFinal = motion === "outbound" ? "outbound" : origem === "outro" ? origemOutraTexto.trim() : origem;

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.replace(/\D/g, ""),
          email: email.trim() || undefined,
          empresa: empresa.trim() || undefined,
          empresaCnpj: empresaCnpj.replace(/\D/g, "") || undefined,
          origem: origemFinal || undefined,
          responsavelId: responsavelId || undefined,
          semNegocio: true,
        }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err?.error || "falha"); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Lead criado.");
      onCreated();
      reset();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar o lead"),
  });

  function reset() {
    setNome(""); setTelefone(""); setEmail(""); setMotion(""); setOrigem(""); setOrigemOutraTexto("");
    setEmpresa(""); setEmpresaCnpj(""); setResponsavelId("");
  }
  function handleClose() { reset(); onClose(); }

  const podeCriar = nome.trim() && telefone.replace(/\D/g, "").length >= 10 && motion && (motion === "outbound" || (origem && (origem !== "outro" || origemOutraTexto.trim())));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={handleClose}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)" }}>Novo lead</p>
          <button onClick={handleClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <Field label="Nome *" value={nome} onChange={setNome} placeholder="Nome do lead" />
        <Field label="Telefone *" value={formatarTelefone(telefone)} onChange={(v) => setTelefone(v.replace(/\D/g, ""))} placeholder="(11) 99999-9999" />
        <Field label="E-mail" value={email} onChange={setEmail} placeholder="email@empresa.com" />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Inbound ou outbound? *</span>
          <div className="flex gap-2">
            {(["inbound", "outbound"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMotion(m); if (m === "outbound") { setOrigem(""); setOrigemOutraTexto(""); } }}
                className="flex-1 py-2 rounded-lg text-[13px] font-semibold capitalize"
                style={{ background: motion === m ? "var(--cf2-accent)" : "var(--cf2-bg-canvas)", color: motion === m ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)", border: motion === m ? "none" : "1px solid var(--cf2-border-default)" }}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Outbound vai direto pra Prospecção; inbound entra no funil de Pré-vendas.</p>
        </div>

        {motion === "inbound" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Origem *</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
              <option value="">Selecionar...</option>
              {ORIGEM_TEMPLATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {origem === "outro" && (
              <input value={origemOutraTexto} onChange={(e) => setOrigemOutraTexto(e.target.value)} placeholder="Descreva a origem" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            )}
          </div>
        )}

        <Field label="Empresa" value={empresa} onChange={setEmpresa} placeholder="Nome da empresa (opcional)" />
        <Field label="CNPJ" value={formatarCnpj(empresaCnpj)} onChange={(v) => setEmpresaCnpj(v.replace(/\D/g, ""))} placeholder="00.000.000/0000-00 (opcional)" />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Responsável</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
            <option value="">Sem responsável definido</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>

        <button
          type="button"
          onClick={() => { handleClose(); onImportar(); }}
          className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg"
          style={{ color: "var(--cf2-text-secondary)", border: "1px dashed var(--cf2-border-default)" }}
        >
          <Upload className="w-3.5 h-3.5" /> Prefiro importar uma lista
        </button>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button onClick={() => podeCriar && create.mutate()} disabled={!podeCriar || create.isPending} className="px-4 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            {create.isPending ? "Criando..." : "Criar lead"}
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
