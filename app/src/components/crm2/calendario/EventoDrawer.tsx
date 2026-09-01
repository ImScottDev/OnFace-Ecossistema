"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Calendar, Clock, User, Users, Building2, Briefcase, Link as LinkIcon } from "lucide-react";
import { Evento, STATUS_BADGE, TIPO_LABEL, brl } from "./types";
import { Cf2Badge } from "../ui/Badge";

type Nota = { id: string; conteudo: string; autorNome: string | null; createdAt: string };

export function Cf2EventoDrawer({ evento, onClose }: { evento: Evento; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [novaNota, setNovaNota] = useState("");
  const badge = STATUS_BADGE[evento.status];
  const inicio = new Date(evento.data);
  const fim = evento.duracao ? new Date(inicio.getTime() + evento.duracao * 60000) : null;

  const { data: notas } = useQuery({
    queryKey: ["cf2-notas-reuniao", evento.id],
    queryFn: async () => {
      const res = await fetch(`/api/notas?reuniaoId=${evento.id}`);
      if (!res.ok) return [] as Nota[];
      return (await res.json()) as Nota[];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/reunioes/${evento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cf2-calendario-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["cf2-calendario-resumo"] });
      onClose();
    },
  });

  const notaMutation = useMutation({
    mutationFn: async (conteudo: string) => {
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo, reuniaoId: evento.id, leadId: evento.leadId, negocioId: evento.negocioId }),
      });
      if (!res.ok) throw new Error("Falha ao salvar nota");
      return res.json();
    },
    onSuccess: () => {
      setNovaNota("");
      queryClient.invalidateQueries({ queryKey: ["cf2-notas-reuniao", evento.id] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)" }} />
      <div
        className="relative w-[420px] h-full overflow-y-auto flex flex-col"
        style={{ background: "var(--cf2-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-start justify-between shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div>
            <p className="text-[20px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{evento.titulo}</p>
            <div className="flex gap-2 mt-2">
              <Cf2Badge variant="neutral">{TIPO_LABEL[evento.tipo]?.toUpperCase()}</Cf2Badge>
              <Cf2Badge variant={badge.variant}>{badge.label}</Cf2Badge>
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--cf2-text-secondary)" }} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4 flex-1">
          <div className="flex items-center gap-3 text-[13px]">
            <Calendar className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <span style={{ color: "var(--cf2-text-secondary)" }}>Data</span>
            <span className="flex-1 text-right" style={{ color: "var(--cf2-text-primary)" }}>{inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <span style={{ color: "var(--cf2-text-secondary)" }}>Horário</span>
            <span className="flex-1 text-right" style={{ color: "var(--cf2-text-primary)" }}>
              {inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {fim && ` — ${fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              {evento.duracao && ` (${evento.duracao}min)`}
            </span>
          </div>
          {evento.responsavelNome && (
            <div className="flex items-center gap-3 text-[13px]">
              <User className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <span style={{ color: "var(--cf2-text-secondary)" }}>Responsável</span>
              <span className="flex-1 text-right" style={{ color: "var(--cf2-text-primary)" }}>{evento.responsavelNome}</span>
            </div>
          )}
          {evento.link && (
            <div className="flex items-center gap-3 text-[13px]">
              <LinkIcon className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <span style={{ color: "var(--cf2-text-secondary)" }}>Link</span>
              <a href={evento.link} target="_blank" rel="noreferrer" className="flex-1 text-right truncate" style={{ color: "var(--cf2-accent-border)" }}>Entrar na reunião</a>
            </div>
          )}

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          {evento.leadNome && (
            <div className="flex items-center gap-3 text-[13px]">
              <User className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <span style={{ color: "var(--cf2-text-secondary)" }}>Pessoa</span>
              <a href={`/contatos/${evento.leadId}`} className="flex-1 text-right truncate" style={{ color: "var(--cf2-accent-border)" }}>{evento.leadNome} →</a>
            </div>
          )}
          {evento.empresaNome && (
            <div className="flex items-center gap-3 text-[13px]">
              <Building2 className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <span style={{ color: "var(--cf2-text-secondary)" }}>Empresa</span>
              <span className="flex-1 text-right truncate" style={{ color: "var(--cf2-text-primary)" }}>{evento.empresaNome}</span>
            </div>
          )}
          {evento.negocioTitulo && (
            <div className="flex items-center gap-3 text-[13px]">
              <Briefcase className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <span style={{ color: "var(--cf2-text-secondary)" }}>Negócio</span>
              <a href={`/negocios/${evento.negocioId}`} className="flex-1 text-right truncate" style={{ color: "var(--cf2-accent-border)" }}>{evento.negocioTitulo} · {brl(evento.negocioValor)} →</a>
            </div>
          )}

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase flex items-center gap-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>
              <Users className="w-3 h-3" /> Notas
            </p>
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
              {(notas ?? []).length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma nota ainda.</p>}
              {(notas ?? []).map((n) => (
                <div key={n.id} className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{n.conteudo}</p>
                  <p className="text-[10px] mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>{n.autorNome || "—"} · {new Date(n.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                placeholder="Adicionar nota..."
                className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
              />
              <button
                onClick={() => novaNota.trim() && notaMutation.mutate(novaNota.trim())}
                disabled={!novaNota.trim() || notaMutation.isPending}
                className="px-3 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50"
                style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>

        {evento.status === "agendada" && (
          <div className="p-4 flex flex-col gap-2 shrink-0" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
            <button
              onClick={() => statusMutation.mutate("realizada")}
              className="py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              Marcar como realizado
            </button>
            <div className="flex gap-3 justify-center text-[12px] font-semibold">
              <button onClick={() => statusMutation.mutate("no_show")} style={{ color: "var(--cf2-warning-text)" }}>No-show</button>
              <button onClick={() => statusMutation.mutate("cancelada")} style={{ color: "var(--cf2-danger-text)" }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
