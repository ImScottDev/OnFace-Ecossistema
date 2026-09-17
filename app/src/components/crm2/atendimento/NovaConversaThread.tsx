"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, MessageCircle } from "lucide-react";
import { iniciais } from "./types";

/**
 * Estado "sem conversa ainda" pro deep link de WhatsApp (24/08, pedido do
 * Kauã: "mesmo que não tenha conversa era pra pelo menos abrir a conversa
 * com os dados do lado"). Antes disso caía num placeholder morto ("Nenhuma
 * conversa por aqui ainda") mesmo já sabendo QUAL lead o usuário queria
 * falar com. Reaproveita `POST /api/whatsapp/send` (mesmo endpoint da Nova
 * Mensagem) — resolve sessão/contato/telefone do jeito que já funciona,
 * não fabrica um `contatos` vazio por fora dessa regra.
 */
export function Cf2NovaConversaThread({
  leadId, leadNome, leadTelefone, onSent, textoInicial,
}: {
  leadId: string;
  leadNome: string;
  leadTelefone: string | null;
  onSent: (contatoId: string) => void;
  textoInicial?: string;
}) {
  const [texto, setTexto] = useState(textoInicial ?? "");

  const enviar = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, conteudo: texto.trim(), tipo: "text" }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err?.error || "Falha ao enviar"); }
      return r.json() as Promise<{ contatoId: string }>;
    },
    onSuccess: (data) => {
      setTexto("");
      onSent(data.contatoId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar a mensagem"),
  });

  return (
    <div className="flex-1 flex flex-col rounded-3xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center gap-2.5 p-4" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        <span className="flex items-center justify-center rounded-full text-[12px] font-extrabold shrink-0" style={{ width: 32, height: 32, background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>{iniciais(leadNome)}</span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{leadNome}</p>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{leadTelefone || "sem telefone cadastrado"}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <MessageCircle className="w-8 h-8" style={{ color: "var(--cf2-text-tertiary)" }} />
        <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Nenhuma mensagem ainda</p>
        <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Envie a primeira mensagem pra {leadNome} pra abrir a conversa.</p>
      </div>

      <div className="flex items-end gap-2 p-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={leadTelefone ? "Escreva a primeira mensagem..." : "Este lead não tem telefone cadastrado"}
          disabled={!leadTelefone || enviar.isPending}
          rows={2}
          className="flex-1 text-[13px] rounded-xl px-3 py-2 outline-none resize-none disabled:opacity-50"
          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (texto.trim() && leadTelefone) enviar.mutate(); } }}
        />
        <button
          onClick={() => texto.trim() && enviar.mutate()}
          disabled={!texto.trim() || !leadTelefone || enviar.isPending}
          className="flex items-center justify-center shrink-0 rounded-xl disabled:opacity-40"
          style={{ width: 40, height: 40, background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          title="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
