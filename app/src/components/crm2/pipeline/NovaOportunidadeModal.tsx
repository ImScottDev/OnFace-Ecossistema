"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X, UserRound } from "lucide-react";

interface Usuario { id: string; nome: string }
interface LeadOption { id: string; nome: string; empresa?: string | null }

/** Criação manual de oportunidade — reaproveita POST /api/negocios (mesmo endpoint do resto do CRM). Vincular a um lead existente é opcional (mesma regra do domínio: negócio pode nascer sem lead/empresa e ser associado depois). */
export function NovaOportunidadeModal({ open, onClose, usuarios, onCreated }: { open: boolean; onClose: () => void; usuarios: Usuario[]; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadLabel, setLeadLabel] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadOption[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await fetch(`/api/leads?search=${encodeURIComponent(query.trim())}&limit=8`);
      if (!r.ok) return;
      const j = await r.json();
      setResults(j.leads || []);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, leadId: leadId || undefined, responsavelId: responsavelId || undefined }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "falha"); }
      return r.json();
    },
    onSuccess: () => { toast.success("Oportunidade criada."); onCreated(); reset(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() { setTitulo(""); setLeadId(null); setLeadLabel(null); setResponsavelId(""); setQuery(""); }
  function handleClose() { reset(); onClose(); }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={handleClose}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Nova oportunidade</p>
          <button onClick={handleClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Nome da oportunidade *</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: ACME — Callface AI" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Vincular a um lead (opcional)</span>
          {leadId && leadLabel ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px]" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
              <UserRound className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <span className="truncate flex-1">{leadLabel}</span>
              <button onClick={() => { setLeadId(null); setLeadLabel(null); }}><X className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
              <input
                value={query} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="Buscar lead pelo nome..." className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
              />
              {searchOpen && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden max-h-44 overflow-y-auto" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.12)" }}>
                  {results.map((l) => (
                    <button key={l.id} onClick={() => { setLeadId(l.id); setLeadLabel(l.empresa ? `${l.nome} · ${l.empresa}` : l.nome); setQuery(""); setResults([]); }} className="w-full text-left px-3 py-2 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>
                      {l.nome}{l.empresa ? ` · ${l.empresa}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Responsável</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
            <option value="">Eu mesmo</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button onClick={() => (titulo.trim() ? create.mutate() : toast.error("Nome da oportunidade é obrigatório"))} disabled={create.isPending} className="px-4 py-2 rounded-xl text-[13px] font-bold disabled:opacity-60" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            {create.isPending ? "Criando..." : "Criar oportunidade"}
          </button>
        </div>
      </div>
    </div>
  );
}
