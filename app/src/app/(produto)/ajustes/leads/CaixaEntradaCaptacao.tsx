"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { quandoBR, instante } from "@/lib/datas-br";
import { rotaDoLead } from "@/lib/vendas/rota-do-lead";

/**
 * Caixa de entrada da captação (Meta, RD, site, API pública) para a gestão.
 *
 * Lê `GET /api/captacao/entregas` e reprocessa com
 * `POST /api/captacao/entregas/:id/reprocessar`; a regra mora em
 * `lib/captacao/reprocessar.ts`. Como a distribuição de leads, é só da gestão
 * (admin, gerente, super admin): o servidor decide e devolve 403 para os
 * demais papéis, e aí a seção não aparece.
 */

/** Mesmo formato de `EntregaListada` (lib/captacao/reprocessar.ts), sem importar o módulo que lê o banco. */
type Entrega = {
  id: string; canal: string; status: string; erro: string | null; entregas: number;
  leadId: string | null; lead: string | null; regraId: string | null;
  createdAt: string; ultimaEntregaEm: string; processadaEm: string | null;
  resumo: string | null;
};
type Resposta = { proibido: true } | { proibido: false; entregas: Entrega[] };

const LIMITE = 100;
/** Mesmo limite de `entregas.ts`: "recebida" mais nova que isto ainda está em processamento. */
const EM_ANDAMENTO_MS = 2 * 60 * 1000;

const CANAIS: Record<string, string> = { meta: "Meta", rd: "RD Station", site: "Site", api: "API pública" };
const STATUS: Record<string, string> = { recebida: "Recebida", processada: "Processada", duplicada: "Duplicada", falhou: "Falhou" };

const presa = (e: Entrega) => e.status === "recebida" && Date.now() - instante(e.ultimaEntregaEm).getTime() > EM_ANDAMENTO_MS;
const reprocessavel = (e: Entrega) => e.canal !== "api" && (e.status === "falhou" || presa(e));

function SeloStatus({ entrega }: { entrega: Entrega }) {
  if (entrega.status === "processada") return <Badge variant="success">Processada</Badge>;
  if (entrega.status === "duplicada") return <Badge variant="secondary">Duplicada</Badge>;
  if (entrega.status === "falhou") return <Badge variant="danger">Falhou</Badge>;
  if (presa(entrega)) return <Badge variant="warning">Presa em recebida</Badge>;
  return <Badge variant="info">{STATUS[entrega.status] ?? entrega.status}</Badge>;
}

export function CaixaEntradaCaptacao() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [canal, setCanal] = useState("");
  const [reprocessando, setReprocessando] = useState<Set<string>>(new Set());
  const chave = ["captacao-entregas", status, canal] as const;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Resposta>({
    queryKey: chave,
    queryFn: async () => {
      const qs = new URLSearchParams({ limite: String(LIMITE) });
      if (status) qs.set("status", status);
      if (canal) qs.set("canal", canal);
      const r = await fetch(`/api/captacao/entregas?${qs}`);
      if (r.status === 403) return { proibido: true };
      if (!r.ok) throw new Error("Não foi possível carregar a caixa de entrada.");
      const corpo = (await r.json()) as { entregas: Entrega[] };
      return { proibido: false, entregas: corpo.entregas };
    },
  });

  const reprocessar = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/captacao/entregas/${id}/reprocessar`, { method: "POST" });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo.error ?? "Não foi possível reprocessar a entrega.");
      return corpo as { entrega?: Entrega };
    },
    onMutate: (id) => setReprocessando((s) => new Set(s).add(id)),
    onSuccess: ({ entrega }) => {
      if (entrega?.status === "processada") toast.success(entrega.lead ? `Entrega processada: ${entrega.lead}` : "Entrega processada.");
      else if (entrega?.status === "duplicada") toast.info("A entrega já tinha virado lead e foi marcada como duplicada.");
      else toast.error(entrega?.erro ? `Falhou de novo: ${entrega.erro}` : "A entrega falhou de novo.");
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: (_r, _e, id) => {
      setReprocessando((s) => { const n = new Set(s); n.delete(id); return n; });
      qc.invalidateQueries({ queryKey: ["captacao-entregas"] });
    },
  });

  if (data?.proibido) return null;
  const entregas = data && !data.proibido ? data.entregas : [];
  const filtrando = Boolean(status || canal);

  return (
    <section
      className="rounded-card border p-4 flex flex-col gap-4"
      style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}
      aria-labelledby="captacao-titulo"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id="captacao-titulo" className="text-sm font-semibold text-[var(--cf2-text-primary)]">Caixa de entrada da captação</h3>
          <p className="text-xs text-[var(--cf2-text-tertiary)]">
            Cada lead que chega da Meta, do RD Station, do formulário do site ou da API pública fica registrado aqui como chegou, com o desfecho. Entrega que falhou pode ser reprocessada: o lead nasce como teria nascido.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="shrink-0 self-start">
          {isFetching ? <Spinner aria-label="Atualizando" /> : <RotateCw />} Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Status
          <NativeSelect size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {Object.entries(STATUS).map(([v, rotulo]) => <NativeSelectOption key={v} value={v}>{rotulo}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Canal
          <NativeSelect size="sm" value={canal} onChange={(e) => setCanal(e.target.value)}>
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {Object.entries(CANAIS).map(([v, rotulo]) => <NativeSelectOption key={v} value={v}>{rotulo}</NativeSelectOption>)}
          </NativeSelect>
        </label>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : isError ? (
        <p className="aj-aviso" data-tom="erro" role="alert">
          Não foi possível carregar a caixa de entrada.{" "}
          <Button variant="link" size="xs" onClick={() => refetch()}>Tentar de novo</Button>
        </p>
      ) : entregas.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
            <EmptyTitle>{filtrando ? "Nenhuma entrega com esse filtro" : "Nenhuma entrega registrada"}</EmptyTitle>
            <EmptyDescription>
              {filtrando
                ? "Troque o status ou o canal para ver outras entregas."
                : "Quando um lead chegar pela Meta, pelo RD Station, pelo site ou pela API, ele aparece aqui."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chegou</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead className="text-right">Entregas</TableHead>
                  <TableHead><span className="sr-only">Ação</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregas.map((e) => {
                  const ocupada = reprocessando.has(e.id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{quandoBR(e.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{CANAIS[e.canal] ?? e.canal}</TableCell>
                      <TableCell><SeloStatus entrega={e} /></TableCell>
                      <TableCell className="max-w-56 truncate" title={e.resumo ?? undefined}>{e.resumo ?? "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {e.leadId ? (
                          <Link href={rotaDoLead(e.leadId)} className="underline underline-offset-4">{e.lead ?? "Abrir lead"}</Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal break-words text-xs text-[var(--cf2-text-secondary)]">
                        {e.erro ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums" title={e.entregas > 1 ? `Última em ${quandoBR(e.ultimaEntregaEm)}` : undefined}>
                        {e.entregas}
                      </TableCell>
                      <TableCell className="text-right">
                        {reprocessavel(e) ? (
                          <Button size="xs" variant="outline" disabled={ocupada} onClick={() => reprocessar.mutate(e.id)}>
                            {ocupada ? <Spinner aria-label="Reprocessando" /> : <RotateCw />}
                            {ocupada ? "Reprocessando" : "Reprocessar"}
                          </Button>
                        ) : e.canal === "api" && e.status === "falhou" ? (
                          <span className="text-xs text-[var(--cf2-text-tertiary)]">O integrador reenvia</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {entregas.length >= LIMITE && (
            <p className="text-xs text-[var(--cf2-text-tertiary)]">Mostrando as {LIMITE} entregas mais recentes. Use os filtros para achar uma mais antiga.</p>
          )}
        </>
      )}
    </section>
  );
}
