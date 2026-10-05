"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Building2, MessageCircle, Plus, Users } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input, Cf2Label } from "@/components/crm2/ui/Input";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState, Cf2PermissionDenied } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";
import {
  Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle,
  Cf2DialogDescription, Cf2DialogFooter,
} from "@/components/crm2/ui/Dialog";

type Org = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  whatsappEnabled: boolean;
  maxUsuarios: number;
  maxLeads: number;
  ativo: boolean;
  totalUsuarios: number;
  totalSessoes: number;
};

/**
 * Organizações (tenants) — migrada de `(crm)/admin/organizacoes` (09/09/2026).
 *
 * É a única tela de Ajustes que NÃO é escopada à organização da sessão: a API
 * (`/admin/organizacoes`) exige `super_admin`. Por isso o item só aparece na
 * coluna de navegação pra quem tem esse papel, e a própria tela repete a
 * checagem — nav escondida não é controle de acesso.
 */
export default function OrganizacoesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: "", slug: "", dominio: "", whatsappEnabled: true });

  const superAdmin = (session?.user as { role?: string } | undefined)?.role === "super_admin";

  const { data: orgs, isLoading, isError, refetch } = useQuery<Org[]>({
    enabled: superAdmin,
    queryKey: ["ajustes-organizacoes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizacoes");
      if (!res.ok) throw new Error("Falha ao carregar as organizações");
      return res.json();
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/organizacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao criar a organização");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ajustes-organizacoes"] });
      setCriando(false);
      setForm({ nome: "", slug: "", dominio: "", whatsappEnabled: true });
    },
  });

  if (session && !superAdmin) {
    return <Cf2PermissionDenied message="Só o super admin gerencia as organizações do sistema." />;
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Building2 className="size-5 mt-0.5 shrink-0" style={{ color: "var(--cf2-accent)" }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Organizações</h2>
            <p className="text-[12.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Cada organização é um tenant isolado, com usuários, leads e sessões de WhatsApp próprios.
            </p>
          </div>
        </div>
        <Cf2Button onClick={() => setCriando(true)} className="shrink-0 self-start sm:self-auto">
          <Plus className="size-3.5" /> Nova organização
        </Cf2Button>
      </header>

      <div
        className="rounded-[var(--cf2-radius-lg)] overflow-hidden"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Cf2Skeleton key={i} className="h-10" />)}
          </div>
        ) : isError ? (
          <div className="p-6 flex flex-col items-center gap-3">
            <Cf2ErrorState message="Não foi possível carregar as organizações." />
            <Cf2Button variant="secondary" size="sm" onClick={() => refetch()}>Tentar de novo</Cf2Button>
          </div>
        ) : !orgs?.length ? (
          <div className="p-6"><Cf2EmptyState title="Nenhuma organização" description="Crie a primeira para começar." /></div>
        ) : (
          <div className="overflow-x-auto">
            <Cf2Table className="min-w-[620px]">
              <Cf2TableHeader>
                <Cf2TableRow>
                  <Cf2TableHead>Organização</Cf2TableHead>
                  <Cf2TableHead>Slug</Cf2TableHead>
                  <Cf2TableHead className="text-center">Pessoas</Cf2TableHead>
                  <Cf2TableHead className="text-center">WhatsApp</Cf2TableHead>
                  <Cf2TableHead className="text-center">Status</Cf2TableHead>
                </Cf2TableRow>
              </Cf2TableHeader>
              <Cf2TableBody>
                {orgs.map((org) => (
                  <Cf2TableRow key={org.id} className="transition-colors hover:bg-[var(--cf2-bg-surface-muted)]">
                    <Cf2TableCell>
                      <Link
                        href={`/ajustes/organizacoes/${org.id}`}
                        className="text-[13.5px] font-medium rounded-[var(--cf2-radius-sm)] hover:underline"
                        style={{ color: "var(--cf2-text-primary)" }}
                      >
                        {org.nome}
                      </Link>
                      {org.dominio && (
                        <p className="text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>{org.dominio}</p>
                      )}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-[12.5px] font-mono" style={{ color: "var(--cf2-text-secondary)" }}>
                      {org.slug}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-center">
                      <span
                        className="text-[12px] inline-flex items-center justify-center gap-1"
                        style={{ color: "var(--cf2-text-secondary)" }}
                      >
                        <Users className="size-3" aria-hidden /> {org.totalUsuarios}
                        <span style={{ color: "var(--cf2-text-tertiary)" }}>/{org.maxUsuarios}</span>
                      </span>
                    </Cf2TableCell>
                    <Cf2TableCell className="text-center">
                      <span
                        className="text-[12px] inline-flex items-center justify-center gap-1"
                        style={{ color: org.whatsappEnabled ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)" }}
                        title={org.whatsappEnabled
                          ? `${org.totalSessoes} sessão(ões) configurada(s)`
                          : "WhatsApp desabilitado nesta organização"}
                      >
                        <MessageCircle className="size-3" aria-hidden /> {org.totalSessoes}
                      </span>
                    </Cf2TableCell>
                    <Cf2TableCell className="text-center">
                      <Cf2Badge variant={org.ativo ? "success" : "danger"}>{org.ativo ? "Ativa" : "Inativa"}</Cf2Badge>
                    </Cf2TableCell>
                  </Cf2TableRow>
                ))}
              </Cf2TableBody>
            </Cf2Table>
          </div>
        )}
      </div>

      <Cf2Dialog open={criando} onOpenChange={setCriando}>
        <Cf2DialogContent className="max-w-lg" aria-describedby="nova-org-desc">
          <Cf2DialogHeader>
            <Cf2DialogTitle>Nova organização</Cf2DialogTitle>
            <Cf2DialogDescription id="nova-org-desc">
              Um tenant novo começa vazio e isolado dos demais.
            </Cf2DialogDescription>
          </Cf2DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="org-nome">Nome</Cf2Label>
              <Cf2Input
                id="org-nome" placeholder="Empresa LTDA" value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="org-slug">Slug</Cf2Label>
              <Cf2Input
                id="org-slug" placeholder="empresa" value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              />
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                Identificador único, usado em URLs e na API.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Cf2Label htmlFor="org-dominio">Domínio</Cf2Label>
              <Cf2Input
                id="org-dominio" placeholder="crm.empresa.com.br" value={form.dominio}
                onChange={(e) => setForm((f) => ({ ...f, dominio: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer sm:col-span-2" style={{ color: "var(--cf2-text-secondary)" }}>
              <input
                type="checkbox" className="size-4 accent-[var(--cf2-accent)]"
                checked={form.whatsappEnabled}
                onChange={(e) => setForm((f) => ({ ...f, whatsappEnabled: e.target.checked }))}
              />
              WhatsApp habilitado
            </label>
          </div>

          {criar.error && (
            <p role="alert" className="text-[12px] mt-3" style={{ color: "var(--cf2-danger-text)" }}>
              {(criar.error as Error).message}
            </p>
          )}

          <Cf2DialogFooter>
            <Cf2Button variant="secondary" onClick={() => setCriando(false)}>Cancelar</Cf2Button>
            <Cf2Button
              onClick={() => criar.mutate()} loading={criar.isPending}
              disabled={!form.nome.trim() || !form.slug.trim()}
            >
              Criar organização
            </Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>
    </div>
  );
}
