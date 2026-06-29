"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

interface AdminUser {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  organizacaoId: string;
  orgNome: string;
  orgSlug: string;
}

export default function AdminUsuariosPage() {
  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/usuarios");
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    },
  });

  return (
    <div className="page-scroll space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-purple-400" />
        Todos os Usuários
      </h1>
      <p className="text-[12px] text-white/40">Todos os usuários de todas as organizações.</p>

      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-white/[0.06] overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-white/30">Carregando...</div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-white/40 uppercase">
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Organização</th>
                <th className="px-4 py-3 text-center" title="super_admin: acesso total. admin: gestão da org. gerente: equipe. vendedor: próprios leads.">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {users?.map(user => (
                <tr key={user.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{user.nome}</td>
                  <td className="px-4 py-3 text-sm text-white/50 hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Link href={`/admin/organizacoes/${user.organizacaoId}`} className="text-sm text-purple-400 hover:text-purple-300">
                      {user.orgNome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 capitalize">{user.role}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`w-2 h-2 rounded-full inline-block ${user.ativo ? "bg-green-500" : "bg-white/20"}`} />
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
