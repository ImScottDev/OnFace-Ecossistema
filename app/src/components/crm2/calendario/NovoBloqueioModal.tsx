"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Cf2NovoBloqueioModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const agora = new Date();
  agora.setDate(agora.getDate() + 1);
  agora.setMinutes(0, 0, 0);
  const fimPadrao = new Date(agora.getTime() + 60 * 60 * 1000);

  const [inicio, setInicio] = useState(toDatetimeLocalValue(agora));
  const [fim, setFim] = useState(toDatetimeLocalValue(fimPadrao));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (new Date(inicio) >= new Date(fim)) throw new Error("O fim precisa ser depois do início");
      const res = await fetch("/api/agenda/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(), motivo: motivo.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar bloqueio");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-bloqueios"] });
      onClose();
    },
    onError: (e) => setErro(e instanceof Error ? e.message : "Erro de conexão"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-[440px] rounded-2xl" style={{ background: "var(--cf2-bg-surface)" }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>+ Novo Bloqueio</p>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>De</p>
              <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Até</p>
              <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Motivo (opcional)</p>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Férias, dentista, viagem..."
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          </div>
          {erro && <p className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>{erro}</p>}
        </div>
        <div className="flex justify-end gap-3 p-5" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            Criar Bloqueio
          </button>
        </div>
      </div>
    </div>
  );
}
