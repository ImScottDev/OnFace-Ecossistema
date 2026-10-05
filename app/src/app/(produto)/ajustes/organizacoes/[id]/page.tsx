"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Eye, EyeOff, Key, Plus, Save, Star, Users, Wifi, WifiOff,
} from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input, Cf2Label } from "@/components/crm2/ui/Input";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2ErrorState, Cf2PermissionDenied } from "@/components/crm2/ui/States";
import {
  Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle,
  Cf2DialogDescription, Cf2DialogFooter,
} from "@/components/crm2/ui/Dialog";
import { ROLES, type Role } from "@/lib/auth/roles";
import { ROLE_LABEL } from "../../membros/roles";

type OrgDetail = {
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
};

const CAMPOS = [
  { key: "nome", label: "Nome", tipo: "text" },
  { key: "slug", label: "Slug", tipo: "text" },
  { key: "dominio", label: "Domínio", tipo: "text" },
  { key: "corPrimaria", label: "Cor primária", tipo: "text" },
  { key: "maxUsuarios", label: "Limite de pessoas", tipo: "number" },
  { key: "maxLeads", label: "Limite de leads", tipo: "number" },
] as const;

function Secao({ titulo, icone, acao, children }: {
  titulo: string; icone?: React.ReactNode; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[var(--cf2-radius-lg)] p-5 flex flex-col gap-4"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
          {icone}{titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/**
 * Detalhe de uma organização — migrada de `(crm)/admin/organizacoes/[id]`
 * (09/09/2026). Mesmos endpoints (`PUT /admin/organizacoes/:id`,
 * `POST /admin/usuarios`, `PUT /admin/usuarios/:id`).
 *
 * Duas correções de comportamento, não de regra:
 * - Salvar não dava retorno nenhum: sem estado de erro nem confirmação, um PUT
 *   que falhasse era indistinguível de um que desse certo.
 * - O select de papel da criação oferecia só "vendedor/gerente/admin", sendo
 *   que "vendedor" é papel LEGADO — quem fosse criado por ali nascia com um
 *   papel que `ROLES` nem reconhece. Agora usa a mesma lista do resto do CRM.
 */
export default function OrganizacaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [mostrarChave, setMostrarChave] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; email: string; senha: string; role: Role }>(
    { nome: "", email: "", senha: "", role: "closer" });

  const superAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";

  const { data: org, isLoading, isError } = useQuery<OrgDetail>({
    enabled: superAdmin,
    queryKey: ["ajustes-organizacao", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/organizacoes/${id}`);
      if (!res.ok) throw new Error("Organização não encontrada");
      return res.json();
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/organizacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");
      return res.json();
    },
    onSuccess: () => {
      setForm({});
      queryClient.invalidateQueries({ queryKey: ["ajustes-organizacao", id] });
      queryClient.invalidateQueries({ queryKey: ["ajustes-organizacoes"] });
    },
  });

  const criarPessoa = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...novo, organizacaoId: id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao criar a pessoa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ajustes-organizacao", id] });
      setNovoAberto(false);
      setNovo({ nome: "", email: "", senha: "", role: "closer" });
    },
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
      if (!res.ok) throw new Error("Falha ao alterar o status da pessoa");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ajustes-organizacao", id] }),
  });

  const sujo = Object.keys(form).length > 0;

  if (session && !superAdmin) {
    return <Cf2PermissionDenied message="Só o super admin gerencia as organizações do sistema." />;
  }
  if (isError) return <Cf2ErrorState message="Organização não encontrada." />;
  if (isLoading || !org) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl">
        <Cf2Skeleton className="h-8 w-56" />
        <Cf2Skeleton className="h-48" />
        <Cf2Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <Link
        href="/ajustes/organizacoes"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold self-start rounded-[var(--cf2-radius-sm)] hover:underline"
        style={{ color: "var(--cf2-text-tertiary)" }}
      >
        <ArrowLeft className="size-3.5" /> Organizações
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{org.nome}</h1>
        <Cf2Badge variant={org.ativo ? "success" : "danger"}>{org.ativo ? "Ativa" : "Inativa"}</Cf2Badge>
      </div>

      <Secao titulo="Configurações">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CAMPOS.map((campo) => (
            <div key={campo.key} className="flex flex-col gap-1.5">
              <Cf2Label htmlFor={`org-${campo.key}`}>{campo.label}</Cf2Label>
              <Cf2Input
                id={`org-${campo.key}`}
                type={campo.tipo}
                defaultValue={String((org as unknown as Record<string, unknown>)[campo.key] ?? "")}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [campo.key]: campo.tipo === "number" ? Number(e.target.value) || 0 : e.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--cf2-text-secondary)" }}>
            <input
              type="checkbox" className="size-4 accent-[var(--cf2-accent)]" defaultChecked={org.whatsappEnabled}
              onChange={(e) => setForm((p) => ({ ...p, whatsappEnabled: e.target.checked }))}
            />
            WhatsApp habilitado
          </label>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--cf2-text-secondary)" }}>
            <input
              type="checkbox" className="size-4 accent-[var(--cf2-accent)]" defaultChecked={org.ativo}
              onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
            />
            Organização ativa
          </label>
          <div className="flex items-center gap-3 sm:ml-auto">
            {salvar.isSuccess && !sujo && (
              <span role="status" className="text-[12px]" style={{ color: "var(--cf2-success-text)" }}>Salvo.</span>
            )}
            <Cf2Button onClick={() => salvar.mutate()} loading={salvar.isPending} disabled={!sujo}>
              <Save className="size-3.5" /> Salvar
            </Cf2Button>
          </div>
        </div>
        {salvar.error && (
          <p role="alert" className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>
            {(salvar.error as Error).message}
          </p>
        )}
      </Secao>

      <Secao titulo="Integrações" icone={<Key className="size-4" style={{ color: "var(--cf2-accent)" }} />}>
        <div className="flex flex-col gap-1.5">
          <Cf2Label htmlFor="org-apollo">Chave de API do Apollo.io</Cf2Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Cf2Input
                id="org-apollo" className="font-mono pr-10"
                type={mostrarChave ? "text" : "password"}
                defaultValue={org.apolloApiKey || ""}
                placeholder="Cole a chave do Apollo.io"
                onChange={(e) => setForm((p) => ({ ...p, apolloApiKey: e.target.value || null }))}
              />
              <button
                type="button"
                onClick={() => setMostrarChave((v) => !v)}
                aria-label={mostrarChave ? "Ocultar a chave" : "Mostrar a chave"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[var(--cf2-radius-sm)]"
                style={{ color: "var(--cf2-text-tertiary)" }}
              >
                {mostrarChave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Cf2Button
              variant="secondary" className="shrink-0"
              onClick={() => salvar.mutate()} loading={salvar.isPending} disabled={!sujo}
            >
              <Save className="size-3.5" /> Salvar
            </Cf2Button>
          </div>
          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
            Em app.apollo.io, vá em Settings → Integrations → API Keys. Cada organização tem a sua.
          </p>
        </div>
      </Secao>

      <Secao
        titulo={`Pessoas (${org.usuarios.length})`}
        icone={<Users className="size-4" style={{ color: "var(--cf2-accent)" }} />}
        acao={<Cf2Button variant="secondary" size="sm" onClick={() => setNovoAberto(true)}><Plus className="size-3.5" /> Adicionar</Cf2Button>}
      >
        <ul className="flex flex-col">
          {org.usuarios.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 py-2.5"
              style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{u.nome}</p>
                <p className="text-[11.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{u.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Cf2Badge variant="neutral">{ROLE_LABEL[u.role] ?? u.role}</Cf2Badge>
                {/* Era um pontinho de 8px sem rótulo — alvo pequeno demais e sem
                    nome acessível. Virou um botão de texto que diz o que faz. */}
                <Cf2Button
                  variant="secondary" size="sm"
                  loading={alternarAtivo.isPending && alternarAtivo.variables?.userId === u.id}
                  onClick={() => alternarAtivo.mutate({ userId: u.id, ativo: !u.ativo })}
                >
                  {u.ativo ? "Desativar" : "Ativar"}
                </Cf2Button>
              </div>
            </li>
          ))}
          {org.usuarios.length === 0 && (
            <li className="text-[13px] py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa nesta organização.</li>
          )}
        </ul>
        {alternarAtivo.error && (
          <p role="alert" className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>
            {(alternarAtivo.error as Error).message}
          </p>
        )}
      </Secao>

      <Secao titulo={`Sessões de WhatsApp (${org.sessoes.length})`}>
        <ul className="flex flex-col">
          {org.sessoes.map((s) => {
            const conectada = s.status === "connected";
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-2.5"
                style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {conectada
                    ? <Wifi className="size-4 shrink-0" aria-hidden style={{ color: "var(--cf2-success-text)" }} />
                    : <WifiOff className="size-4 shrink-0" aria-hidden style={{ color: "var(--cf2-danger-text)" }} />}
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>
                      {s.label || s.sessionName}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {s.phoneNumber || s.sessionName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--cf2-warning-text)" }}>
                      <Star className="size-3" aria-hidden /> Padrão
                    </span>
                  )}
                  <Cf2Badge variant={conectada ? "success" : "danger"}>{conectada ? "Conectada" : "Desconectada"}</Cf2Badge>
                </div>
              </li>
            );
          })}
          {org.sessoes.length === 0 && (
            <li className="text-[13px] py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma sessão de WhatsApp configurada.</li>
          )}
        </ul>
      </Secao>

      <Cf2Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <Cf2DialogContent aria-describedby="nova-pessoa-desc">
          <Cf2DialogHeader>
            <Cf2DialogTitle>Adicionar pessoa</Cf2DialogTitle>
            <Cf2DialogDescription id="nova-pessoa-desc">
              Criação direta com senha definida por você, sem e-mail de convite.
            </Cf2DialogDescription>
          </Cf2DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="np-nome">Nome</Cf2Label>
              <Cf2Input id="np-nome" value={novo.nome} onChange={(e) => setNovo((u) => ({ ...u, nome: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="np-email">E-mail</Cf2Label>
              <Cf2Input id="np-email" type="email" value={novo.email} onChange={(e) => setNovo((u) => ({ ...u, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="np-senha">Senha</Cf2Label>
              <Cf2Input
                id="np-senha" type="password" autoComplete="new-password"
                value={novo.senha} onChange={(e) => setNovo((u) => ({ ...u, senha: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="np-papel">Papel</Cf2Label>
              <select
                id="np-papel" value={novo.role} onChange={(e) => setNovo((u) => ({ ...u, role: e.target.value as Role }))}
                className="w-full rounded-[var(--cf2-radius-sm)] text-sm px-3 py-2 outline-none h-[38px]"
                style={{
                  background: "var(--cf2-bg-surface)",
                  color: "var(--cf2-text-primary)",
                  border: "1px solid var(--cf2-border-default)",
                }}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            {criarPessoa.error && (
              <p role="alert" className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>
                {(criarPessoa.error as Error).message}
              </p>
            )}
          </div>
          <Cf2DialogFooter>
            <Cf2Button variant="secondary" onClick={() => setNovoAberto(false)}>Cancelar</Cf2Button>
            <Cf2Button
              onClick={() => criarPessoa.mutate()} loading={criarPessoa.isPending}
              disabled={novo.nome.trim().length < 2 || !novo.email.includes("@") || novo.senha.length < 6}
            >
              Criar pessoa
            </Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>
    </div>
  );
}
