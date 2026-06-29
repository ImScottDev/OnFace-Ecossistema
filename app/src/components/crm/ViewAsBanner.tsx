"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, X } from "lucide-react";

// Pílula flutuante no topo enquanto o admin está "visualizando como" outro usuário.
// Fica fora da sidebar de propósito: mesmo que a sidebar vire a de um vendedor,
// o botão "Voltar para Admin" continua acessível.
export function ViewAsBanner() {
  const { data } = useQuery<{
    isViewingAs: boolean;
    viewAs: { nome: string; role: string } | null;
  }>({
    queryKey: ["view-as"],
    queryFn: async () => {
      const res = await fetch("/api/admin/view-as");
      if (!res.ok) return { isViewingAs: false, viewAs: null };
      return res.json();
    },
    staleTime: 30_000,
  });

  if (!data?.isViewingAs || !data.viewAs) return null;

  const exit = async () => {
    await fetch("/api/admin/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    window.location.href = "/dashboard";
  };

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-1.5 rounded-full shadow-xl border border-amber-500/40 bg-amber-500/[0.18] backdrop-blur-md">
      <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-xs text-amber-100">
        Visualizando como <b className="text-white">{data.viewAs.nome}</b>
        <span className="text-amber-300/70 ml-1 capitalize">({data.viewAs.role})</span>
      </span>
      <button
        onClick={exit}
        className="flex items-center gap-1 text-[11px] font-semibold text-amber-100 hover:text-white bg-amber-500/25 hover:bg-amber-500/40 px-2 py-0.5 rounded-full transition-colors"
      >
        <X className="w-3 h-3" /> Voltar para Admin
      </button>
    </div>
  );
}
