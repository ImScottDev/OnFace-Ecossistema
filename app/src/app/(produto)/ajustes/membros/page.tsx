"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Search, Target, UserPlus, Users } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input } from "@/components/crm2/ui/Input";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";
import { corAvatarEmpresa, iniciaisEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { ROLES, isAdminView, type Role } from "@/lib/auth/roles";
import { ROLE_AJUDA, ROLE_LABEL } from "./roles";
import { META_LABELS, META_TIPOS_MOEDA, type MetaTipo } from "@/lib/metas-shared";
import type { Membro } from "./tipos";
import { MetaDialog } from "./MetaDialog";
import { ConviteDialog } from "./ConviteDialog";

/**
 * Equipe da organização. Reescrita em 09/09/2026: era uma lista read-only de
 * nome/e-mail/papel, enquanto a gestão real (trocar papel, definir meta do mês,
 * convidar) só existia em `(crm)/admin/usuarios` — uma tela do shell legado,
 * cross-org, sem entrada nenhuma na navegação do CRM2. Consequência prática:
 * a Home mostrava "sem meta definida" e não havia caminho no produto novo pra
 * definir uma.
 *
 * Esta tela é escopada à organização da sessão (usa `GET /usuarios`, não o
 * `/admin/usuarios` global). A gestão cross-org continua sendo do super admin,
 * em `/ajustes/organizacoes`.
 */
export default function MembrosPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [metaDe, setMetaDe] = useState<Membro | null>(null);
  const [convidando, setConvidando] = useState(false);

  const podeGerir = isAdminView((session?.user as { role?: string } | undefined)?.role);

  // Metas já definidas no mês corrente: a lista mostra o valor, não só "Definir".
  const mesAtual = new Date().toISOString().slice(0, 7);
  const { data: metasDoMes } = useQuery<{ usuarioId: string; tipo: MetaTipo; valorAlvo: string | number }[]>({
    enabled: podeGerir,
    queryKey: ["metas-equipe", mesAtual],
    queryFn: async () => {
      const res = await fetch(`/api/metas?periodo=${mesAtual}`);
      if (!res.ok) return [];
      return (await res.json()).metas ?? [];
    },
  });
  const metasDe = (id: string) => (metasDoMes ?? []).filter((m) => m.usuarioId === id);
  const fmtMeta = (m: { tipo: MetaTipo; valorAlvo: string | number }) => {
    const v = Number(m.valorAlvo);
    return `${META_LABELS[m.tipo]}: ${META_TIPOS_MOEDA.includes(m.tipo) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR")}`;
  };

  const { data, isLoading, isError, refetch } = useQuery<Membro[]>({
    queryKey: ["ajustes-membros"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios");
      if (!res.ok) throw new Error("Falha ao carregar a equipe");
      const d = await res.json();
      return Array.isArray(d) ? d : (d.usuarios ?? d.data ?? []);
    },
  });

  const trocarPapel = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao alterar o papel");
      return res.json();
    },
    // Otimista: o select devolvia o valor antigo por um frame inteiro enquanto
    // o PATCH ia e voltava, o que parecia "não salvou".
    onMutate: async ({ id, role }) => {
      await queryClient.cancelQueries({ queryKey: ["ajustes-membros"] });
      const anterior = queryClient.getQueryData<Membro[]>(["ajustes-membros"]);
      queryClient.setQueryData<Membro[]>(["ajustes-membros"], (velho) =>
        (velho ?? []).map((m) => (m.id === id ? { ...m, role } : m)));
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) queryClient.setQueryData(["ajustes-membros"], ctx.anterior);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ajustes-membros"] }),
  });

  const membros = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = data ?? [];
    if (!termo) return lista;
    return lista.filter((m) =>
      m.nome?.toLowerCase().includes(termo) || m.email?.toLowerCase().includes(termo));
  }, [data, busca]);

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Users className="size-5 mt-0.5 shrink-0" style={{ color: "var(--cf2-accent)" }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Equipe</h2>
            <p className="text-[12.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Quem tem acesso, o papel de cada pessoa e a meta do mês.
            </p>
          </div>
        </div>
        {podeGerir && (
          <Cf2Button onClick={() => setConvidando(true)} className="shrink-0 self-start sm:self-auto">
            <UserPlus className="size-3.5" /> Convidar pessoa
          </Cf2Button>
        )}
      </header>

      <div className="relative max-w-xs">
        <Search
          className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--cf2-text-tertiary)" }}
          aria-hidden
        />
        <Cf2Input
          className="pl-8" placeholder="Buscar por nome ou e-mail" aria-label="Buscar pessoa na equipe"
          value={busca} onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {trocarPapel.error && (
        <p role="alert" className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>
          {(trocarPapel.error as Error).message}
        </p>
      )}

      <div
        className="rounded-[var(--cf2-radius-lg)] overflow-hidden"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => <Cf2Skeleton key={i} className="h-10" />)}
          </div>
        ) : isError ? (
          <div className="p-6 flex flex-col items-center gap-3">
            <Cf2ErrorState message="Não foi possível carregar a equipe." />
            <Cf2Button variant="secondary" size="sm" onClick={() => refetch()}>Tentar de novo</Cf2Button>
          </div>
        ) : membros.length === 0 ? (
          <div className="p-6">
            <Cf2EmptyState
              title={busca ? "Ninguém encontrado" : "Nenhuma pessoa na equipe"}
              description={busca ? "Nenhum nome ou e-mail bate com essa busca." : "Convide alguém para começar."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Cf2Table className="min-w-[560px]">
              <Cf2TableHeader>
                <Cf2TableRow>
                  <Cf2TableHead>Pessoa</Cf2TableHead>
                  <Cf2TableHead className="hidden md:table-cell">Papel</Cf2TableHead>
                  <Cf2TableHead className="text-right">Meta do mês</Cf2TableHead>
                </Cf2TableRow>
              </Cf2TableHeader>
              <Cf2TableBody>
                {membros.map((m) => (
                  <Cf2TableRow key={m.id} className="transition-colors hover:bg-[var(--cf2-bg-surface-muted)]">
                    <Cf2TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          aria-hidden
                          className="size-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                          style={{ background: corAvatarEmpresa(m.id), color: TEXTO_SOBRE_AVATAR }}
                        >
                          {iniciaisEmpresa(m.nome || "?")}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium truncate flex items-center gap-1.5" style={{ color: "var(--cf2-text-primary)" }}>
                            {m.nome}
                            {m.tipo === "agente" && (
                              <span
                                title="Agente de IA: é usuário do sistema, recebe leads e atende pelo WhatsApp, mas não tem login"
                                className="rounded-full px-1.5 py-px text-[10px] font-bold leading-none"
                                style={{ background: "var(--of-coral-acao)", color: "var(--of-papel)" }}
                              >
                                IA
                              </span>
                            )}
                          </p>
                          <p className="text-[11.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
                            {m.tipo === "agente" ? "Agente de IA, sem login" : m.email}
                          </p>
                          {/* Abaixo de md a coluna de papel some: o rótulo desce pra cá
                              em vez de sumir da tela. */}
                          <p className="text-[11.5px] md:hidden" style={{ color: "var(--cf2-text-secondary)" }}>
                            {ROLE_LABEL[m.role] ?? m.role}
                          </p>
                        </div>
                      </div>
                    </Cf2TableCell>
                    <Cf2TableCell className="hidden md:table-cell">
                      {podeGerir && m.tipo !== "agente" ? (
                        <select
                          aria-label={`Papel de ${m.nome}`}
                          title={ROLES.includes(m.role as Role) ? ROLE_AJUDA[m.role as Role] : undefined}
                          value={ROLES.includes(m.role as Role) ? m.role : ""}
                          onChange={(e) => trocarPapel.mutate({ id: m.id, role: e.target.value as Role })}
                          disabled={trocarPapel.isPending}
                          className="rounded-[var(--cf2-radius-sm)] px-2 py-1.5 text-[12.5px] outline-none disabled:opacity-50"
                          style={{
                            background: "var(--cf2-bg-surface)",
                            color: "var(--cf2-text-primary)",
                            border: "1px solid var(--cf2-border-default)",
                          }}
                        >
                          {!ROLES.includes(m.role as Role) && (
                            <option value="" disabled>{ROLE_LABEL[m.role] ?? m.role}</option>
                          )}
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      ) : (
                        <span className="text-[12.5px]" style={{ color: "var(--cf2-text-secondary)" }}>
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      )}
                    </Cf2TableCell>
                    <Cf2TableCell className="text-right">
                      {podeGerir && m.tipo !== "agente" ? (
                        <div className="flex items-center justify-end gap-2">
                          {metasDe(m.id).length > 0 && (
                            <span className="text-[11.5px] text-right leading-tight" style={{ color: "var(--cf2-text-secondary)" }}>
                              {metasDe(m.id).map((x) => <span key={x.tipo} className="block">{fmtMeta(x)}</span>)}
                            </span>
                          )}
                          <Cf2Button variant="secondary" size="sm" onClick={() => setMetaDe(m)}>
                            <Target className="size-3.5" /> {metasDe(m.id).length > 0 ? "Editar" : "Definir"}
                          </Cf2Button>
                        </div>
                      ) : (
                        <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>—</span>
                      )}
                    </Cf2TableCell>
                  </Cf2TableRow>
                ))}
              </Cf2TableBody>
            </Cf2Table>
          </div>
        )}
      </div>

      {!podeGerir && (
        <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Somente admin, gerência e operações podem alterar papéis, definir metas ou convidar pessoas.
        </p>
      )}

      <MetaDialog membro={metaDe} onOpenChange={(v) => { if (!v) setMetaDe(null); }} />
      <ConviteDialog
        aberto={convidando}
        onOpenChange={setConvidando}
        onConvidado={() => queryClient.invalidateQueries({ queryKey: ["ajustes-membros"] })}
      />
    </div>
  );
}
