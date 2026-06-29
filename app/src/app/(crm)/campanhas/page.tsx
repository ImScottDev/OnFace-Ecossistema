"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Megaphone, Mail, MessageCircle, Plus } from "lucide-react";

type Campanha = {
  id: string; nome: string; canal: string; status: string;
  totalDestinatarios: number; totalEnviados: number; createdAt: string;
};

const STATUS_COR: Record<string, string> = {
  rascunho: "bg-white/[0.08] text-white/50",
  agendada: "bg-blue-500/20 text-blue-400",
  enviando: "bg-amber-500/20 text-amber-400",
  concluida: "bg-emerald-500/20 text-emerald-400",
};

export default function CampanhasPage() {
  const [loading, setLoading] = useState(true);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);

  useEffect(() => {
    fetch("/api/campanhas").then(r => r.ok ? r.json() : { campanhas: [] }).then((d) => {
      setCampanhas(d.campanhas || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-[#e23752]" />
          <h1 className="text-2xl font-bold text-white">Campanhas</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/campanhas/nova?canal=email" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white/[0.06] text-white/70 hover:bg-white/10"><Mail className="w-4 h-4" /> Nova Email</Link>
          <Link href="/campanhas/nova?canal=whatsapp" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white/[0.06] text-white/70 hover:bg-white/10"><MessageCircle className="w-4 h-4" /> Disparo WhatsApp</Link>
          <Link href="/campanhas/nova" className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"><Plus className="w-4 h-4" /> Nova Campanha</Link>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div className="card-solid p-12 text-center">
          <Megaphone className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/50">Nenhuma campanha criada</p>
          <p className="text-xs text-white/30 mt-1">Crie campanhas de cold email ou disparo em massa de WhatsApp</p>
        </div>
      ) : (
        <div className="card-solid overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-white/30 uppercase tracking-wider border-b border-white/[0.06]">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Enviados</th>
                <th className="px-4 py-3">Criada</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map(c => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/80">{c.nome}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-white/50">
                      {c.canal === "whatsapp" ? <MessageCircle className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />} {c.canal}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COR[c.status] || "bg-white/[0.08] text-white/50"}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-white/60 tabular-nums">{c.totalEnviados}/{c.totalDestinatarios}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
