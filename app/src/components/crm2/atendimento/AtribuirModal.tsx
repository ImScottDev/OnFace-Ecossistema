"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

type Usuario = { id: string; nome: string; role: string; ativo: boolean };

export function Cf2AtribuirModal({ onClose, onConfirmar }: { onClose: () => void; onConfirmar: (usuarioId: string) => void }) {
  const { data } = useQuery({
    queryKey: ["cf2-usuarios"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios");
      if (!res.ok) return [] as Usuario[];
      return (await res.json()) as Usuario[];
    },
  });

  const usuarios = (data ?? []).filter((u) => u.ativo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-[340px] rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)" }}>
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Atribuir atendimento</p>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} /></button>
        </div>
        <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
          {usuarios.map((u) => (
            <button
              key={u.id}
              onClick={() => onConfirmar(u.id)}
              className="flex items-center justify-between p-2.5 rounded-lg text-left"
              style={{ background: "var(--cf2-bg-surface-muted)" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{u.nome}</p>
              <p className="text-[10px] uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{u.role}</p>
            </button>
          ))}
          {usuarios.length === 0 && <p className="text-[12px] py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando equipe...</p>}
        </div>
      </div>
    </div>
  );
}
