"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Lead {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string;
  status: string;
}

export default function NovaPropostaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLeadId = searchParams.get("leadId");
  const preselectedNegocioId = searchParams.get("negocioId");
  const [search, setSearch] = useState("");

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["leads-for-proposta", search],
    queryFn: async () => {
      const res = await fetch(`/api/leads?limit=20${search ? `&q=${encodeURIComponent(search)}` : ""}`);
      const data = await res.json();
      return data.leads || data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (params: { leadId?: string; negocioId?: string }) => {
      const res = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          itens: [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar proposta");
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/propostas/${data.id}`);
    },
  });

  // Auto-create if leadId or negocioId is provided (via useEffect to avoid render-time side effects)
  const autoCreated = useRef(false);
  useEffect(() => {
    if ((preselectedLeadId || preselectedNegocioId) && !autoCreated.current) {
      autoCreated.current = true;
      createMutation.mutate({
        leadId: preselectedLeadId || undefined,
        negocioId: preselectedNegocioId || undefined,
      });
    }
  }, [preselectedLeadId, preselectedNegocioId]);

  if (createMutation.isPending) {
    return <div className="p-8 text-white/40">Criando proposta...</div>;
  }

  if (createMutation.isError) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-red-400">{createMutation.error.message}</p>
        <button onClick={() => router.push("/propostas/nova")} className="text-sm text-[#e23752] hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="page-scroll space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/propostas" className="p-2 hover:bg-white/[0.06] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-white/50" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Nova Proposta</h1>
      </div>

      <p className="text-sm text-white/50">Selecione o contato para criar a proposta:</p>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..." className="dark-input w-full pl-9" />
      </div>

      <div className="space-y-2 max-w-lg">
        {leads?.map(lead => (
          <button key={lead.id} onClick={() => createMutation.mutate({ leadId: lead.id })} disabled={createMutation.isPending}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-colors text-left">
            <div className="flex-1">
              <p className="font-medium text-white">{lead.nome}</p>
              <p className="text-xs text-white/40">{[lead.empresa, lead.telefone].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="text-xs text-white/30">{lead.status}</span>
          </button>
        ))}
        {leads && leads.length === 0 && <p className="text-sm text-white/30">Nenhum contato encontrado</p>}
      </div>
    </div>
  );
}
