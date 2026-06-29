"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";

type Membro = { id: string; nome: string; email: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", gerente: "Gerente", vendedor: "Vendedor",
};

export default function MembrosConfigPage() {
  const [loading, setLoading] = useState(true);
  const [membros, setMembros] = useState<Membro[]>([]);

  useEffect(() => {
    fetch("/api/usuarios").then(r => r.ok ? r.json() : []).then((d) => {
      const list = Array.isArray(d) ? d : (d.usuarios || d.data || []);
      setMembros(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-[#e23752]" />
        <div>
          <h2 className="text-lg font-semibold text-white">Membros</h2>
          <p className="text-xs text-white/40">Equipe da organização e seus papéis</p>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-8">Carregando...</div>
      ) : membros.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-6">Nenhum membro encontrado.</p>
      ) : (
        <div className="card-solid divide-y divide-white/[0.06]">
          {membros.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #e23752, #8e27ef)" }}>
                {(m.nome || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{m.nome}</p>
                <p className="text-[11px] text-white/40 truncate">{m.email}</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#8e27ef]/20 text-[#c89bff] shrink-0">{ROLE_LABEL[m.role] || m.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
