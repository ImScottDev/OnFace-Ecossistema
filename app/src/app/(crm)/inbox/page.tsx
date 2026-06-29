"use client";

import { useState } from "react";
import { Inbox, Mail, Linkedin } from "lucide-react";

const FILTROS = ["Todos", "Email", "LinkedIn", "Sua vez", "Não lidas"];

export default function InboxLemlistPage() {
  const [filtro, setFiltro] = useState("Todos");

  return (
    <div className="page-scroll h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Inbox className="w-6 h-6 text-[#e23752]" />
        <h1 className="text-2xl font-bold text-white">Inbox Lemlist</h1>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filtro === f ? "bg-[#e23752]/20 text-[#e23752]" : "bg-white/[0.04] text-white/50 hover:text-white/70"}`}>{f}</button>
        ))}
      </div>

      <div className="card-solid flex-1 flex flex-col items-center justify-center text-center p-12">
        <div className="flex gap-3 mb-4">
          <Mail className="w-8 h-8 text-white/15" />
          <Linkedin className="w-8 h-8 text-white/15" />
        </div>
        <p className="text-white/50">Conecte sua conta Lemlist</p>
        <p className="text-xs text-white/30 mt-1 max-w-sm">Inbox unificado das respostas de campanhas (Email e LinkedIn). Requer a API key do Lemlist em Configurações &gt; Integrações.</p>
      </div>
    </div>
  );
}
