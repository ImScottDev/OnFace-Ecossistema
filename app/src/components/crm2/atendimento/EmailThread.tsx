"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { ConversaItem, Contexto, iniciais } from "./types";
import { Cf2Badge } from "../ui/Badge";

type EmailMsg = {
  id: string;
  de: string;
  para: string;
  assunto: string;
  corpoTexto: string | null;
  direcao: "in" | "out";
  createdAt: string;
  contaId: string | null;
  lido: boolean;
};

export function Cf2EmailThread({ conversa, contexto }: { conversa: ConversaItem; contexto: Contexto | null }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");

  const param = conversa.emailThreadId ? `threadId=${conversa.emailThreadId}` : `emailId=${conversa.id}`;

  const { data } = useQuery({
    queryKey: ["cf2-email-thread", conversa.id],
    queryFn: async () => {
      const res = await fetch(`/api/email?${param}`);
      if (!res.ok) return { emails: [] };
      return res.json();
    },
    refetchInterval: 8000,
  });

  const mensagens: EmailMsg[] = data?.emails ?? [];
  const ultimo = mensagens[mensagens.length - 1];

  // Abrir a thread marca como lido de verdade (mesmo padrão do WhatsApp,
  // que já zera naoLidas ao buscar mensagens) — "Todas" depende disso pra
  // sumir da fila depois que a pessoa já viu.
  useEffect(() => {
    const naoLidas = mensagens.filter((m) => m.direcao === "in" && !m.lido);
    if (naoLidas.length === 0) return;
    Promise.all(naoLidas.map((m) => fetch(`/api/email/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lido: true }),
    }))).then(() => queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens.map((m) => m.id).join(",")]);

  const sendMutation = useMutation({
    mutationFn: async (corpo: string) => {
      if (!ultimo?.contaId) throw new Error("Sem conta de e-mail vinculada a essa conversa");
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contaId: ultimo.contaId,
          para: ultimo.direcao === "in" ? ultimo.de : ultimo.para,
          assunto: ultimo.assunto?.startsWith("Re:") ? ultimo.assunto : `Re: ${ultimo.assunto || ""}`,
          corpo,
          threadId: conversa.emailThreadId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      return res.json();
    },
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["cf2-email-thread", conversa.id] });
      queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] });
    },
  });

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 rounded-3xl overflow-hidden"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div className="flex items-center gap-3 p-4 shrink-0" style={{ background: "var(--cf2-bg-page)", borderBottom: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-center justify-center rounded-[20px] shrink-0 w-10 h-10" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <p className="text-[14px] font-extrabold" style={{ color: "var(--cf2-text-secondary)" }}>{iniciais(conversa.nome)}</p>
        </div>
        <div className="min-w-0">
          <div className="flex gap-1.5 items-center">
            <p className="text-[16px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{conversa.nome}</p>
            {contexto && <Cf2Badge variant={contexto.isCliente ? "success" : "neutral"}>{contexto.isCliente ? "Cliente" : "Lead"}</Cf2Badge>}
          </div>
          <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{conversa.preview}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-5" style={{ background: "var(--cf2-bg-canvas)" }}>
        {mensagens.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem mensagens carregadas.</p>}
        {mensagens.map((m) => (
          <div key={m.id} className={`flex ${m.direcao === "out" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[80%] p-3 rounded-2xl flex flex-col gap-1"
              style={{
                background: m.direcao === "out" ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)",
                border: m.direcao === "out" ? "0.5px solid var(--cf2-success-fill)" : "0.5px solid var(--cf2-border-default)",
              }}
            >
              <p className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{m.de}</p>
              <p className="text-[13px] leading-[18px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{m.corpoTexto || "(sem texto)"}</p>
              <p className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(m.createdAt).toLocaleString("pt-BR")}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 shrink-0" style={{ background: "var(--cf2-bg-page)", borderTop: "1px solid var(--cf2-border-default)" }}>
        <div className="flex gap-3 items-center">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Responder por e-mail..."
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <button
            onClick={() => texto.trim() && sendMutation.mutate(texto.trim())}
            disabled={!texto.trim() || !ultimo?.contaId || sendMutation.isPending}
            className="flex items-center justify-center rounded-[20px] shrink-0 w-10 h-10 disabled:opacity-50"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)" }}
          >
            <Send className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
