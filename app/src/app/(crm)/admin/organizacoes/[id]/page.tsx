"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Users, Wifi, WifiOff, Plus, Trash2, Star, Key, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

interface OrgDetail {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  corPrimaria: string;
  apolloApiKey: string | null;
  whatsappEnabled: boolean;
  maxUsuarios: number;
  maxLeads: number;
  ativo: boolean;
  usuarios: { id: string; nome: string; email: string; role: string; ativo: boolean }[];
  sessoes: { id: string; sessionName: string; label: string | null; isDefault: boolean; status: string; phoneNumber: string | null }[];
}

export default function AdminOrgDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ["admin-org", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/organizacoes/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [newUser, setNewUser] = useState({ nome: "", email: "", senha: "", role: "vendedor" });
  const [showNewUser, setShowNewUser] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const updateOrg = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/organizacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-org", id] }),
  });

  const createUser = useMutation({
    mutationFn: async (data: typeof newUser) => {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, organizacaoId: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org", id] });
      setShowNewUser(false);
      setNewUser({ nome: "", email: "", senha: "", role: "vendedor" });
    },
  });

  const toggleUser = useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-org", id] }),
  });

  if (isLoading || !org) return <div className="p-8 text-white/30">Carregando...</div>;

  return (
    <div className="page-scroll space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/organizacoes" className="text-white/40 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-white">{org.nome}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${org.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          {org.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* Org config */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-4">Configurações</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: "nome", label: "Nome", val: org.nome },
            { key: "slug", label: "Slug", val: org.slug },
            { key: "dominio", label: "Domínio", val: org.dominio || "" },
            { key: "corPrimaria", label: "Cor primária", val: org.corPrimaria },
            { key: "maxUsuarios", label: "Max usuários", val: String(org.maxUsuarios) },
            { key: "maxLeads", label: "Max leads", val: String(org.maxLeads) },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-white/50 mb-1 block">{f.label}</label>
              <input
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                defaultValue={f.val}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: f.key.includes("max") ? parseInt(e.target.value) || 0 : e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" defaultChecked={org.whatsappEnabled} onChange={e => setForm(prev => ({ ...prev, whatsappEnabled: e.target.checked }))} />
            WhatsApp habilitado
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" defaultChecked={org.ativo} onChange={e => setForm(prev => ({ ...prev, ativo: e.target.checked }))} />
            Organização ativa
          </label>
          <button onClick={() => updateOrg.mutate(form)} className="btn-primary text-sm flex items-center gap-1 sm:ml-auto w-fit">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>

      {/* Integrações */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-purple-400" /> Integrações</h2>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Apollo.io API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white font-mono pr-10"
                type={showApiKey ? "text" : "password"}
                defaultValue={org.apolloApiKey || ""}
                placeholder="Cole a API key do Apollo.io aqui"
                onChange={e => setForm(prev => ({ ...prev, apolloApiKey: e.target.value || null }))}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={() => updateOrg.mutate(form)} className="btn-primary text-sm px-4 flex items-center gap-1">
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            Obtenha em app.apollo.io → Settings → Integrations → API Keys. Cada org pode ter sua própria key.
          </p>
        </div>
      </div>

      {/* Users */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="w-5 h-5" /> Usuários ({org.usuarios.length})</h2>
          <button onClick={() => setShowNewUser(!showNewUser)} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {showNewUser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 bg-white/[0.02] rounded-lg">
            <input className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" placeholder="Nome" value={newUser.nome} onChange={e => setNewUser(u => ({ ...u, nome: e.target.value }))} />
            <input className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" placeholder="Email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
            <input className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" placeholder="Senha" type="password" value={newUser.senha} onChange={e => setNewUser(u => ({ ...u, senha: e.target.value }))} />
            <div className="flex gap-2">
              <select className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={() => createUser.mutate(newUser)} className="btn-primary text-sm px-3">Criar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {org.usuarios.map(user => (
            <div key={user.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{user.nome}</p>
                <p className="text-xs text-white/40">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 capitalize">{user.role}</span>
                <button
                  onClick={() => toggleUser.mutate({ userId: user.id, ativo: !user.ativo })}
                  className={`w-2 h-2 rounded-full cursor-pointer ${user.ativo ? "bg-green-500" : "bg-white/20"}`}
                  title={user.ativo ? "Desativar" : "Ativar"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp sessions */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-emerald-400" /> Sessões WhatsApp ({org.sessoes.length})
        </h2>
        <div className="space-y-2">
          {org.sessoes.map(sess => (
            <div key={sess.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div className="flex items-center gap-3">
                {sess.status === "connected" ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                <div>
                  <p className="text-sm font-medium text-white">{sess.label || sess.sessionName}</p>
                  <p className="text-xs text-white/40">{sess.phoneNumber || sess.sessionName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sess.isDefault && <Star className="w-3 h-3 text-amber-400" />}
                <span className={`text-xs px-2 py-0.5 rounded-full ${sess.status === "connected" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {sess.status}
                </span>
              </div>
            </div>
          ))}
          {org.sessoes.length === 0 && <p className="text-sm text-white/30">Nenhuma sessão WhatsApp configurada</p>}
        </div>
      </div>
    </div>
  );
}
