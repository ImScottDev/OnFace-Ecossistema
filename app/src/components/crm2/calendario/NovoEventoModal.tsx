"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { Evento, Disponibilidade } from "./types";

const TIPOS = [
  { key: "video", label: "Reunião" },
  { key: "call", label: "Ligação" },
  { key: "presencial", label: "Presencial" },
];

export type LeadResultado = { id: string; nome: string; email: string | null; empresa: string | null; negocioAtivoId: string | null };

const OUTLOOK_MOTIVO_LABEL: Record<string, string> = {
  closer_sem_outlook: "Evento criado no CRM, mas não gerou link e não foi enviado pro cliente — conecte seu e-mail Microsoft em Configurações para ter a experiência completa.",
  sem_email_destinatario: "Evento criado no Outlook, mas sem convite enviado — a pessoa vinculada não tem e-mail cadastrado.",
  token_expirado: "Evento criado no CRM, mas sua conexão com o Outlook expirou — reconecte em Configurações de E-mail.",
  erro_graph: "Evento criado no CRM, mas houve um erro ao criar no Outlook. Tente reconectar sua conta em Configurações.",
};

export function Cf2NovoEventoModal({
  dataInicial, eventosDoDia = [], leadPreSelecionado = null, tituloInicial = "", onClose, onCriado,
}: {
  dataInicial: Date;
  eventosDoDia?: Evento[];
  /** Vem de fora (ex: Atendimento) quando o lead já é conhecido — pula a busca. */
  leadPreSelecionado?: LeadResultado | null;
  tituloInicial?: string;
  onClose: () => void;
  onCriado: () => void;
}) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState("video");
  const [titulo, setTitulo] = useState(tituloInicial);
  const [data, setData] = useState(dataInicial.toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState("14:00");
  const [horaFim, setHoraFim] = useState("15:00");
  const [buscaLead, setBuscaLead] = useState("");
  const [leadSelecionado, setLeadSelecionado] = useState<LeadResultado | null>(leadPreSelecionado);
  const [observacoes, setObservacoes] = useState("");
  const [resultado, setResultado] = useState<{ criado: boolean; motivo: string | null } | null>(null);

  const { data: disponibilidade } = useQuery<Disponibilidade>({
    queryKey: ["cf2-cal-disponibilidade-modal", data],
    queryFn: async () => {
      const res = await fetch(`/api/calendario/disponibilidade?from=${data}T00:00:00.000Z&to=${data}T23:59:59.999Z`);
      if (!res.ok) return { horarioTrabalho: null, pausaAlmoco: null, bloqueios: [] };
      return res.json();
    },
  });

  const { data: leadsBusca } = useQuery({
    queryKey: ["cf2-cal-buscar-leads", buscaLead],
    queryFn: async () => {
      if (buscaLead.length < 2) return { leads: [] as LeadResultado[] };
      const res = await fetch(`/api/leads?search=${encodeURIComponent(buscaLead)}&limit=8`);
      if (!res.ok) return { leads: [] as LeadResultado[] };
      const json = await res.json();
      return { leads: (json.leads ?? json) as LeadResultado[] };
    },
    enabled: buscaLead.length >= 2 && !leadSelecionado,
  });

  const inicioDate = new Date(`${data}T${horaInicio}:00`);
  const fimDate = new Date(`${data}T${horaFim}:00`);
  const duracaoMin = Math.max(15, Math.round((fimDate.getTime() - inicioDate.getTime()) / 60000));

  const conflito = eventosDoDia.find((ev) => {
    if (ev.status === "cancelada") return false;
    const evInicio = new Date(ev.data).getTime();
    const evFim = evInicio + (ev.duracao || 30) * 60000;
    return inicioDate.getTime() < evFim && evInicio < fimDate.getTime();
  });

  const trabalhaNoDiaSelecionado = !disponibilidade?.horarioTrabalho || disponibilidade.horarioTrabalho.diasSemana.includes(inicioDate.getDay());
  const conflitoAlmoco = trabalhaNoDiaSelecionado && disponibilidade?.pausaAlmoco
    ? (() => {
        const almocoInicio = new Date(`${data}T${disponibilidade.pausaAlmoco!.inicio}:00`);
        const almocoFim = new Date(`${data}T${disponibilidade.pausaAlmoco!.fim}:00`);
        return inicioDate.getTime() < almocoFim.getTime() && almocoInicio.getTime() < fimDate.getTime();
      })()
    : false;
  const conflitoBloqueio = (disponibilidade?.bloqueios ?? []).find((b) => {
    const bInicio = new Date(b.inicio).getTime();
    const bFim = new Date(b.fim).getTime();
    return inicioDate.getTime() < bFim && bInicio < fimDate.getTime();
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reunioes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          data: inicioDate.toISOString(),
          duracao: duracaoMin,
          tipo,
          leadId: leadSelecionado?.id || null,
          negocioId: leadSelecionado?.negocioAtivoId || null,
          notas: observacoes || null,
          attendeeEmail: leadSelecionado?.email || null,
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar evento");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cf2-calendario-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["cf2-calendario-resumo"] });
      setResultado(data.outlook);
      if (data.outlook?.criado !== false || data.outlook?.motivo === null) {
        // ainda mostra o aviso por 1 momento antes de fechar, mas segue o fluxo
      }
    },
  });

  if (resultado) {
    const mensagem = resultado.criado
      ? (resultado.motivo ? OUTLOOK_MOTIVO_LABEL[resultado.motivo] : "Evento criado e convite enviado pelo Outlook com sucesso.")
      : OUTLOOK_MOTIVO_LABEL[resultado.motivo || "erro_graph"];
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
        <div className="w-[440px] rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--cf2-bg-surface)" }}>
          <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Evento criado</p>
          <p className="text-[13px] leading-relaxed" style={{ color: resultado.criado && !resultado.motivo ? "var(--cf2-success-text)" : "var(--cf2-text-secondary)" }}>{mensagem}</p>
          <button onClick={onCriado} className="py-2.5 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: "var(--cf2-bg-surface)" }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>+ Novo Evento</p>
          <button onClick={onClose} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Tipo de evento</p>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              {TIPOS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTipo(t.key)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold"
                  style={{ background: tipo === t.key ? "var(--cf2-bg-surface)" : "transparent", color: tipo === t.key ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Título</p>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Reunião de proposta comercial" aria-label="Ex: Reunião de proposta comercial"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Data</p>
              <input type="date" aria-label="Data" value={data} onChange={(e) => setData(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Início</p>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Fim</p>
              <input type="time" aria-label="Hora" value={horaFim} onChange={(e) => setHoraFim(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Pessoa relacionada (opcional — gera convite real se tiver e-mail)</p>
            {!leadSelecionado ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                  <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
                  <input value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} placeholder="Buscar lead por nome..." aria-label="Buscar lead por nome"
                    className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: "var(--cf2-text-primary)" }} />
                </div>
                {(leadsBusca?.leads ?? []).length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 max-h-[140px] overflow-y-auto">
                    {(leadsBusca?.leads ?? []).map((l) => (
                      <button key={l.id} onClick={() => { setLeadSelecionado(l); setBuscaLead(""); }} className="text-left p-2 rounded-lg text-[13px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        {l.nome} {l.empresa ? `— ${l.empresa}` : ""} {!l.email && <span style={{ color: "var(--cf2-text-tertiary)" }}> (sem e-mail)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{leadSelecionado.nome}{leadSelecionado.empresa ? ` — ${leadSelecionado.empresa}` : ""}</p>
                <button onClick={() => setLeadSelecionado(null)} className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Trocar</button>
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Observações</p>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          </div>

          {conflito && (
            <div className="flex gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-warning-bg)" }}>
              <span>⚠️</span>
              <div>
                <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Conflito de agenda detectado</p>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Você já tem "{conflito.titulo}" nesse horário. Pode criar mesmo assim.</p>
              </div>
            </div>
          )}

          {conflitoAlmoco && (
            <div className="flex gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-warning-bg)" }}>
              <span>⚠️</span>
              <div>
                <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Esse horário cai na pausa de almoço</p>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Pode criar mesmo assim, mas é bom conferir.</p>
              </div>
            </div>
          )}

          {conflitoBloqueio && (
            <div className="flex gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-warning-bg)" }}>
              <span>⚠️</span>
              <div>
                <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Esse horário está bloqueado</p>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{conflitoBloqueio.motivo || "Bloqueio de agenda"}. Pode criar mesmo assim, mas é bom conferir.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button
            onClick={() => titulo.trim() && criarMutation.mutate()}
            disabled={!titulo.trim() || criarMutation.isPending}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            Criar Evento
          </button>
        </div>
      </div>
    </div>
  );
}
