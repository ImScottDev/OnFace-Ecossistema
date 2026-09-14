"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Search } from "lucide-react";

type LeadResultado = { id: string; nome: string; telefone: string | null; empresa: string | null };

export function Cf2NovaMensagemModal({ onClose, onEnviado }: { onClose: () => void; onEnviado: (contatoId: string) => void }) {
  const [busca, setBusca] = useState("");
  const [leadSelecionado, setLeadSelecionado] = useState<LeadResultado | null>(null);
  const [texto, setTexto] = useState("");

  const { data } = useQuery({
    queryKey: ["cf2-busca-leads", busca],
    queryFn: async () => {
      if (busca.length < 2) return { leads: [] };
      const res = await fetch(`/api/leads?search=${encodeURIComponent(busca)}&limit=8`);
      if (!res.ok) return { leads: [] };
      const json = await res.json();
      return { leads: (json.leads ?? json) as LeadResultado[] };
    },
    enabled: busca.length >= 2 && !leadSelecionado,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!leadSelecionado) throw new Error("Selecione um lead");
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: leadSelecionado.id, conteudo: texto, tipo: "text" }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Falha ao enviar");
      return res.json();
    },
    onSuccess: (data) => {
      onEnviado(data.contatoId || leadSelecionado!.id);
    },
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-[420px] rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)" }}>
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Nova Mensagem</p>
          <button onClick={onClose} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} /></button>
        </div>

        {!leadSelecionado ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
              <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar lead por nome..." aria-label="Buscar lead por nome"
                className="flex-1 bg-transparent outline-none text-[13px]"
                style={{ color: "var(--cf2-text-primary)" }}
              />
            </div>
            <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
              {(data?.leads ?? []).map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLeadSelecionado(l)}
                  disabled={!l.telefone}
                  className="flex flex-col items-start p-2.5 rounded-lg text-left disabled:opacity-40"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                >
                  <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{l.nome}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
                    {l.empresa || "—"} {!l.telefone && "· sem telefone"}
                  </p>
                </button>
              ))}
              {busca.length >= 2 && (data?.leads ?? []).length === 0 && (
                <p className="text-[12px] py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum lead encontrado.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Para: {leadSelecionado.nome}</p>
              <button onClick={() => setLeadSelecionado(null)} className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Trocar</button>
            </div>
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva sua mensagem..." aria-label="Escreva sua mensagem"
              rows={4}
              className="px-3 py-2 rounded-lg text-[13px] outline-none resize-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
            {sendMutation.isError && <p className="text-[11px]" style={{ color: "var(--cf2-danger-text)" }}>{(sendMutation.error as Error).message}</p>}
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!texto.trim() || sendMutation.isPending}
              className="py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              Enviar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
