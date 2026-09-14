"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Info, Mail, Megaphone, MessageCircle, Plus } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState } from "@/components/crm2/ui/States";
import {
  Cf2Table, Cf2TableBody, Cf2TableCell, Cf2TableHead, Cf2TableHeader, Cf2TableRow,
} from "@/components/crm2/ui/Table";

type Campanha = {
  id: string; nome: string; canal: string; status: string;
  totalDestinatarios: number; totalEnviados: number; createdAt: string;
};

const STATUS: Record<string, { label: string; variant: "neutral" | "success" | "warning" | "accent" }> = {
  rascunho: { label: "Rascunho", variant: "neutral" },
  agendada: { label: "Agendada", variant: "accent" },
  enviando: { label: "Enviando", variant: "warning" },
  concluida: { label: "Concluída", variant: "success" },
};

/**
 * Campanhas de outreach — portada de `(crm)/campanhas` (09/09/2026) pra
 * `/automacoes/campanhas`, junto das cadências e dos agentes, que é onde o
 * assunto pertence.
 *
 * O aviso de rascunho no topo não é enfeite: `outreach_campanhas` só tem GET e
 * POST em `/api/campanhas`, e nenhum worker consome a tabela. Nada dispara.
 * A tela legada não dizia isso — tinha até cor de status pra "enviando" e
 * "concluída", estados que nada no código produz — e quem criasse uma campanha
 * ficaria esperando um envio que nunca sai.
 */
export function Cf2CampanhasWorkspace() {
  const { data, isLoading, isError, refetch } = useQuery<Campanha[]>({
    queryKey: ["campanhas"],
    queryFn: async () => {
      const r = await fetch("/api/campanhas");
      if (!r.ok) throw new Error("Falha ao carregar as campanhas");
      return (await r.json()).campanhas ?? [];
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Megaphone className="size-5 mt-0.5 shrink-0" style={{ color: "var(--cf2-accent)" }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Campanhas</h2>
            <p className="text-[12.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Cold e-mail e disparo de WhatsApp, montados por passos.
            </p>
          </div>
        </div>
        <Cf2Button asChild className="shrink-0 self-start sm:self-auto">
          <Link href="/automacoes/campanhas/nova"><Plus className="size-3.5" /> Nova campanha</Link>
        </Cf2Button>
      </header>

      <div
        className="flex items-start gap-2.5 rounded-[var(--cf2-radius-md)] px-3.5 py-3"
        style={{ background: "var(--cf2-warning-bg)", border: "1px solid var(--cf2-warning-border)" }}
      >
        <Info className="size-4 mt-0.5 shrink-0" aria-hidden style={{ color: "var(--cf2-warning-text)" }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--cf2-warning-text)" }}>
          O envio ainda não existe. A campanha é salva como rascunho e nenhum processo a dispara —
          para cadência que realmente envia, use <Link href="/automacoes/cadencias" className="underline font-medium">Follow-ups</Link>.
        </p>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Cf2ErrorState message="Não foi possível carregar as campanhas." />
          <Cf2Button variant="secondary" size="sm" onClick={() => refetch()}>Tentar de novo</Cf2Button>
        </div>
      ) : (
        <div
          className="rounded-[var(--cf2-radius-lg)] overflow-hidden"
          style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
        >
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => <Cf2Skeleton key={i} className="h-10" />)}
            </div>
          ) : !data?.length ? (
            <div className="p-8">
              <Cf2EmptyState
                title="Nenhuma campanha criada"
                description="Monte um cold e-mail ou um disparo de WhatsApp para deixar pronto."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Cf2Table className="min-w-[620px]">
                <Cf2TableHeader>
                  <Cf2TableRow>
                    <Cf2TableHead>Nome</Cf2TableHead>
                    <Cf2TableHead>Canal</Cf2TableHead>
                    <Cf2TableHead>Status</Cf2TableHead>
                    <Cf2TableHead className="text-right">Enviados</Cf2TableHead>
                    <Cf2TableHead className="text-right">Criada em</Cf2TableHead>
                  </Cf2TableRow>
                </Cf2TableHeader>
                <Cf2TableBody>
                  {data.map((c) => {
                    const st = STATUS[c.status] ?? { label: c.status, variant: "neutral" as const };
                    return (
                      <Cf2TableRow key={c.id} className="transition-colors hover:bg-[var(--cf2-bg-surface-muted)]">
                        <Cf2TableCell className="text-[13px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>
                          {c.nome}
                        </Cf2TableCell>
                        <Cf2TableCell>
                          <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--cf2-text-secondary)" }}>
                            {c.canal === "whatsapp"
                              ? <MessageCircle className="size-3.5" aria-hidden />
                              : <Mail className="size-3.5" aria-hidden />}
                            {c.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
                          </span>
                        </Cf2TableCell>
                        <Cf2TableCell><Cf2Badge variant={st.variant}>{st.label}</Cf2Badge></Cf2TableCell>
                        <Cf2TableCell className="text-right text-[12.5px] tabular-nums" style={{ color: "var(--cf2-text-secondary)" }}>
                          {c.totalEnviados}/{c.totalDestinatarios}
                        </Cf2TableCell>
                        <Cf2TableCell className="text-right text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                          {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                        </Cf2TableCell>
                      </Cf2TableRow>
                    );
                  })}
                </Cf2TableBody>
              </Cf2Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
