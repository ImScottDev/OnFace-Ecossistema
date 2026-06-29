"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Plus, Users, MessageCircle, X } from "lucide-react";

interface Org {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  corPrimaria: string;
  whatsappEnabled: boolean;
  maxUsuarios: number;
  maxLeads: number;
  ativo: boolean;
  totalUsuarios: number;
  totalSessoes: number;
  createdAt: string;
}

export default function AdminOrganizacoesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nome: "", slug: "", dominio: "", whatsappEnabled: true });

  const { data: orgs, isLoading } = useQuery<Org[]>({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizacoes");
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/organizacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      setShowCreate(false);
      setForm({ nome: "", slug: "", dominio: "", whatsappEnabled: true });
    },
  });

  return (
    <div className="page-scroll space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Building2 className="w-6 h-6 text-purple-400" />
          Organizações
        </h1>
        <p className="text-[12px] text-white/40 hidden lg:block">Gerencie as organizações do sistema. Cada organização é um tenant isolado.</p>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Nova Organização
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="bg-[rgba(255,255,255,0.05)] rounded-xl p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Nova Organização</h2>
            <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Nome</label>
              <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Empresa LTDA" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Slug</label>
              <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="empresa" />
              <p className="text-[10px] text-white/25">Identificador único. Usado em URLs e API.</p>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Domínio</label>
              <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" value={form.dominio} onChange={e => setForm(f => ({ ...f, dominio: e.target.value }))} placeholder="crm.empresa.com.br" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={form.whatsappEnabled} onChange={e => setForm(f => ({ ...f, whatsappEnabled: e.target.checked }))} className="rounded" />
                WhatsApp habilitado
              </label>
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.nome || !form.slug || createMutation.isPending}
            className="btn-primary mt-4 text-sm"
          >
            {createMutation.isPending ? "Criando..." : "Criar Organização"}
          </button>
          {createMutation.error && <p className="text-red-400 text-xs mt-2">{createMutation.error.message}</p>}
        </div>
      )}

      {/* Orgs table */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-white/[0.06] overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-white/30">Carregando...</div>
        ) : !orgs?.length ? (
          <div className="p-8 text-center text-white/30">Nenhuma organização</div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-white/40 uppercase">
                <th className="px-4 py-3 text-left">Organização</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-center">Usuários</th>
                <th className="px-4 py-3 text-center">WhatsApp</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/organizacoes/${org.id}`} className="text-white font-medium hover:text-purple-400 transition-colors">
                      {org.nome}
                    </Link>
                    {org.dominio && <p className="text-xs text-white/30">{org.dominio}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/50">{org.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-white/50 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" /> {org.totalUsuarios}/{org.maxUsuarios}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs flex items-center justify-center gap-1" style={{ color: org.whatsappEnabled ? "#34D399" : "#6B7280" }}>
                      <MessageCircle className="w-3 h-3" /> {org.totalSessoes}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${org.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {org.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
