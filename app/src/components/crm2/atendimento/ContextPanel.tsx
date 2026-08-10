"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Phone, CalendarPlus, Building2, Repeat, ChevronDown } from "lucide-react";
import { ConversaItem, Contexto, iniciais, brl } from "./types";
import { Cf2Badge } from "../ui/Badge";
import { Cf2NovoEventoModal, LeadResultado } from "../calendario/NovoEventoModal";
import { Cf2CadenciaPanel } from "../cadencia/CadenciaPanel";

const ETAPA_LABEL: Record<string, string> = {
  reuniao_agendada: "Reunião Agendada",
  reuniao_realizada: "Reunião Realizada",
  negociacao_iniciada: "Negociação",
  proposta_apresentada: "Proposta Apresentada",
  ativo: "Ativo",
  outra_data: "Outra Data",
  sem_retorno: "Sem Retorno",
  no_show: "No-show",
  trial: "Trial",
};

export function Cf2ContextPanel({ conversa, contexto, loading }: { conversa: ConversaItem; contexto: Contexto | null; loading: boolean }) {
  const queryClient = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [cadenciaAberta, setCadenciaAberta] = useState(false);

  const leadPreSelecionado: LeadResultado | null =
    conversa.leadId && contexto?.pessoa
      ? {
          id: conversa.leadId,
          nome: contexto.pessoa.nome,
          email: contexto.pessoa.email,
          empresa: contexto.empresa?.nome || null,
          negocioAtivoId: contexto.cascata.tipo === "negocio" ? contexto.cascata.id : null,
        }
      : null;

  function fecharModal() {
    setModalAberto(false);
  }

  function criouEvento() {
    setModalAberto(false);
    queryClient.invalidateQueries({ queryKey: ["cf2-contexto", conversa.leadId] });
  }

  return (
    <div
      className="flex flex-col gap-4 h-full shrink-0 w-[320px] rounded-3xl overflow-y-auto p-4"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      {loading && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>}

      {!loading && !contexto?.pessoa && (
        <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Sem lead vinculado a esse contato ainda — nenhum dado de CRM pra mostrar aqui.
        </p>
      )}

      {contexto?.pessoa && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PESSOA</p>
              <Cf2Badge variant={contexto.isCliente ? "success" : "neutral"}>{contexto.isCliente ? "Cliente" : "Lead"}</Cf2Badge>
            </div>
            <div className="flex gap-2.5 items-center">
              <div className="flex items-center justify-center rounded-[18px] shrink-0 w-9 h-9" style={{ background: "var(--cf2-accent)" }}>
                <p className="text-[12px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>{iniciais(contexto.pessoa.nome)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{contexto.pessoa.nome}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{contexto.pessoa.cargo || "—"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {conversa.leadId && (
                <a href={`/leads/${conversa.leadId}`} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                  <Pencil className="w-3 h-3" /> Editar
                </a>
              )}
              {contexto.pessoa.telefone && (
                <a href={`tel:${contexto.pessoa.telefone}`} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                  <Phone className="w-3 h-3" /> Ligar
                </a>
              )}
              <button onClick={() => setModalAberto(true)} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                <CalendarPlus className="w-3 h-3" /> Agenda
              </button>
            </div>
            <div className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
              {contexto.pessoa.telefone && <p>📞 {contexto.pessoa.telefone}</p>}
              {contexto.pessoa.email && <p>✉️ {contexto.pessoa.email}</p>}
            </div>
          </div>

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          {contexto.empresa && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>EMPRESA</p>
              <a
                href={contexto.empresa.id ? `/empresas/${contexto.empresa.id}` : undefined}
                className={`flex gap-2.5 items-center rounded-xl p-1 -m-1 ${contexto.empresa.id ? "hover:bg-[var(--cf2-bg-surface-muted)]" : "cursor-default"}`}
              >
                <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-inverse)" }}>
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{contexto.empresa.nome}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{contexto.empresa.setor ? `Segmento: ${contexto.empresa.setor}` : "—"}</p>
                </div>
              </a>
            </div>
          )}

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>
              {contexto.cascata.tipo === "negocio" ? "NEGÓCIO ATIVO" : contexto.cascata.tipo === "proposta" ? "PROPOSTA ENVIADA" : contexto.cascata.tipo === "reuniao" ? "REUNIÃO AGENDADA" : "SEM NEGOCIAÇÃO ATIVA"}
            </p>

            {contexto.cascata.tipo === "negocio" && (
              <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contexto.cascata.titulo}</p>
                  <p className="text-[13px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{brl(contexto.cascata.valor)}</p>
                </div>
                <Cf2Badge variant="warning">{ETAPA_LABEL[contexto.cascata.etapa] || contexto.cascata.etapa}</Cf2Badge>
              </div>
            )}

            {contexto.cascata.tipo === "proposta" && (
              <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Proposta #{contexto.cascata.numero}</p>
                  <p className="text-[13px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{brl(contexto.cascata.valor)}</p>
                </div>
                <Cf2Badge variant="accent">Enviada</Cf2Badge>
              </div>
            )}

            {contexto.cascata.tipo === "reuniao" && (
              <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contexto.cascata.titulo}</p>
                <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(contexto.cascata.data).toLocaleString("pt-BR")}</p>
              </div>
            )}

            {contexto.cascata.tipo === "nenhum" && (
              <button
                onClick={() => setModalAberto(true)}
                disabled={!conversa.leadId}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-50"
                style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Agendar Reunião
              </button>
            )}
          </div>

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PRÓXIMAS ATIVIDADES</p>
            {contexto.proximasAtividades.length === 0 && (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade futura.</p>
            )}
            {contexto.proximasAtividades.map((a) => (
              <div key={a.id} className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--cf2-accent-border)" }} />
                <p className="text-[12px] flex-1" style={{ color: "var(--cf2-text-primary)" }}>
                  {a.titulo} ({new Date(a.data).toLocaleDateString("pt-BR")})
                </p>
              </div>
            ))}
          </div>

          {conversa.leadId && (
            <>
              <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />
              <div className="flex flex-col gap-3">
                <button onClick={() => setCadenciaAberta((v) => !v)} className="flex items-center justify-between w-full">
                  <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                    <Repeat className="w-3 h-3" /> CADÊNCIAS
                  </p>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: "var(--cf2-text-tertiary)", transform: cadenciaAberta ? "rotate(180deg)" : "none" }} />
                </button>
                {cadenciaAberta && <Cf2CadenciaPanel leadId={conversa.leadId} />}
              </div>
            </>
          )}
        </>
      )}

      {modalAberto && (
        <Cf2NovoEventoModal
          dataInicial={new Date()}
          leadPreSelecionado={leadPreSelecionado}
          tituloInicial={contexto?.pessoa ? `Reunião com ${contexto.pessoa.nome}` : ""}
          onClose={fecharModal}
          onCriado={criouEvento}
        />
      )}
    </div>
  );
}
