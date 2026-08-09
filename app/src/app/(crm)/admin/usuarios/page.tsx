"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Target, X, UserPlus, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ROLES, type Role } from "@/lib/auth/roles";
import { META_TIPOS, metaTipoPorPapel, type MetaTipo } from "@/lib/metas-shared";

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

interface MetaRow {
  id: string;
  tipo: string;
  valorAlvo: string;
  realizado: number;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  gerente: "Gerente",
  director: "Diretor",
  coordinator: "Coordenador",
  operations: "Operações",
  closer: "Closer",
  sdr: "SDR",
  leitor: "Leitor",
};

const TIPO_LABEL: Record<MetaTipo, string> = {
  reunioes_agendadas: "Reuniões agendadas",
  reunioes_outbound: "Reuniões (leads outbound)",
  mrr_fechado: "MRR fechado (R$)",
  leads_qualificados: "Leads qualificados",
  contratos_fechados: "Contratos fechados",
};

/** mês atual no formato YYYY-MM (para <input type=month>). */
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminUsuariosPage() {
  const queryClient = useQueryClient();
  const [metaUser, setMetaUser] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/usuarios");
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao alterar papel");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="page-scroll space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            Todos os Usuários
          </h1>
          <p className="text-[12px] text-white/40 mt-1">Todos os usuários de todas as organizações. Defina papel e meta mensal de cada um.</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="btn-primary text-sm inline-flex items-center gap-2 shrink-0 px-4 py-2"
        >
          <UserPlus className="w-4 h-4" />
          Convidar usuário
        </button>
      </div>

      {roleMutation.error && (
        <p className="text-red-400 text-xs">{(roleMutation.error as Error).message}</p>
      )}

      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-white/[0.06] overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-white/30">Carregando...</div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-white/40 uppercase">
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Organização</th>
                <th className="px-4 py-3 text-center" title="admin: gestão total. gerente: equipe. closer: fecha negócios. sdr: pré-vendas. leitor: read-only.">Papel</th>
                <th className="px-4 py-3 text-center">Meta</th>
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
                    <select
                      value={ROLES.includes(user.role as Role) ? user.role : ""}
                      onChange={e => roleMutation.mutate({ id: user.id, role: e.target.value as Role })}
                      disabled={roleMutation.isPending}
                      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white capitalize focus:outline-none focus:border-purple-400/50 disabled:opacity-50"
                    >
                      {!ROLES.includes(user.role as Role) && (
                        <option value="" disabled>{user.role}</option>
                      )}
                      {ROLES.map(r => (
                        <option key={r} value={r} className="bg-[#1a1a1f]">{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setMetaUser(user)}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white hover:border-purple-400/40 transition-colors"
                    >
                      <Target className="w-3.5 h-3.5" />
                      Meta do mês
                    </button>
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

      {metaUser && <MetaModal user={metaUser} onClose={() => setMetaUser(null)} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })} />}
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("closer");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState<{ emailEnviado: boolean; link?: string } | null>(null);

  const enviar = async () => {
    setErro(""); setLoading(true);
    const res = await fetch("/api/usuarios/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, role }),
    });
    setLoading(false);
    if (!res.ok) { setErro((await res.json().catch(() => ({}))).error || "Falha ao convidar"); return; }
    const d = await res.json();
    setPronto({ emailEnviado: d.emailEnviado, link: d.link });
    onInvited();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[#16161c] rounded-xl p-6 border border-white/[0.08] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-purple-400" />Convidar usuário</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-white/40 mb-4">A pessoa recebe um email pra definir a senha e entrar.</p>

        {pronto ? (
          <div className="space-y-3">
            <div className="rounded-lg px-3 py-2 text-sm text-center font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
              {pronto.emailEnviado ? "✓ Convite enviado por email" : "Usuário criado (email não configurado)"}
            </div>
            {!pronto.emailEnviado && pronto.link && (
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[11px] text-white/40 mb-1">Envie este link manualmente:</p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-white/70 break-all flex-1">{pronto.link}</code>
                  <button onClick={() => navigator.clipboard?.writeText(pronto.link!)} className="text-white/50 hover:text-white shrink-0"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            <button onClick={onClose} className="btn-primary text-sm w-full">Fechar</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50" placeholder="Nome da pessoa" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50" placeholder="pessoa@empresa.com" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Função</label>
              <select value={role} onChange={e => setRole(e.target.value as Role)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50">
                {ROLES.map(r => <option key={r} value={r} className="bg-[#1a1a1f]">{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            {erro && <p className="text-red-400 text-xs">{erro}</p>}
            <button onClick={enviar} disabled={loading || nome.length < 2 || !email.includes("@")} className="btn-primary text-sm w-full">
              {loading ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [tipo, setTipo] = useState<MetaTipo>(metaTipoPorPapel(user.role));
  const [valorAlvo, setValorAlvo] = useState<string>("");

  const periodo = `${mes}-01`; // YYYY-MM-01

  const { data: metas, isFetching } = useQuery<MetaRow[]>({
    queryKey: ["metas-usuario", user.id, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/metas/usuario/${user.id}?periodo=${periodo}`);
      if (!res.ok) throw new Error("Falha ao carregar metas");
      return (await res.json()).metas ?? [];
    },
  });

  // Pré-preenche o valor alvo com a meta já salva para o tipo selecionado.
  const metaAtual = metas?.find(m => m.tipo === tipo);
  useEffect(() => {
    setValorAlvo(metaAtual ? String(metaAtual.valorAlvo) : "");
    setSaved(false);
  }, [metaAtual?.id, tipo, periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const realizado = metaAtual?.realizado ?? 0;

  const [saved, setSaved] = useState(false);
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, periodo, tipo, valorAlvo: Number(valorAlvo) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar meta");
      return res.json();
    },
    onSuccess: () => {
      // Não fecha no ato: confirma visível e recarrega, pra ver o valor persistido.
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["metas-usuario", user.id, periodo] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      queryClient.invalidateQueries({ queryKey: ["metas-closer"] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#16161c] rounded-xl p-6 border border-white/[0.08] w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Meta do mês
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-white/40 mb-4">{user.nome} · {user.orgNome}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Mês</label>
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Tipo de meta</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as MetaTipo)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50"
            >
              {META_TIPOS.map(t => (
                <option key={t} value={t} className="bg-[#1a1a1f]">{TIPO_LABEL[t]}</option>
              ))}
            </select>
            <p className="text-[10px] text-white/25 mt-1">Sugerido para {ROLE_LABEL[(ROLES.includes(user.role as Role) ? user.role : "closer") as Role]}: {TIPO_LABEL[metaTipoPorPapel(user.role)]}</p>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Valor alvo</label>
            <input
              type="number"
              min={0}
              value={valorAlvo}
              onChange={e => { setValorAlvo(e.target.value); setSaved(false); }}
              placeholder="0"
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50"
            />
            <p className="text-[10px] mt-1" style={{ color: metaAtual ? "#10B981" : "rgba(255,255,255,0.25)" }}>
              {isFetching
                ? "Carregando meta atual…"
                : metaAtual
                  ? `Editando a meta já cadastrada (${Number(metaAtual.valorAlvo).toLocaleString("pt-BR")}). Mude o valor e salve.`
                  : "Nenhuma meta definida ainda para este mês/tipo — você está criando uma nova."}
            </p>
          </div>

          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm">
            <span className="text-white/40 text-xs">Realizado neste mês: </span>
            <span className="text-white font-medium">{isFetching ? "..." : realizado.toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {saved ? (
          <div className="mt-5 space-y-2">
            <div className="rounded-lg px-3 py-2 text-sm text-center font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
              ✓ Meta salva ({TIPO_LABEL[tipo]} · {mes}): {Number(valorAlvo).toLocaleString("pt-BR")}
            </div>
            <button onClick={onClose} className="btn-primary text-sm w-full">Fechar</button>
          </div>
        ) : (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={valorAlvo === "" || Number(valorAlvo) < 0 || saveMutation.isPending}
            className="btn-primary mt-5 text-sm w-full"
          >
            {saveMutation.isPending ? "Salvando..." : metaAtual ? "Atualizar meta" : "Salvar meta"}
          </button>
        )}
        {saveMutation.error && <p className="text-red-400 text-xs mt-2">{(saveMutation.error as Error).message}</p>}
      </div>
    </div>
  );
}
