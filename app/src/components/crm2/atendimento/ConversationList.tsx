"use client";

import { MessageSquare, Mail, Phone, Search, SlidersHorizontal, AlertCircle, Inbox, LayoutGrid, ChevronDown } from "lucide-react";
import { ConversaItem, iniciais, formatarHora, nomeExibicao } from "./types";

const TABS = [
  { key: "todas", label: "Todas", Icon: LayoutGrid },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageSquare },
  { key: "email", label: "E-mail", Icon: Mail },
  { key: "ligacao", label: "Ligações", Icon: Phone },
] as const;

const VIEW_OPTIONS = [
  { value: "meus", label: "Meus" },
  { value: "nao_atribuidos", label: "Não atribuídos" },
  { value: "todos", label: "Todos" },
  { value: "fechadas", label: "Fechadas" },
  { value: "ia", label: "IA" },
] as const;

const ICONE: Record<ConversaItem["tipo"], React.ElementType> = {
  whatsapp: MessageSquare,
  email: Mail,
  ligacao: Phone,
};

export function Cf2ConversationList({
  conversas,
  loading,
  canal,
  onCanalChange,
  view,
  onViewChange,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  onNovaMensagem,
  contagens,
}: {
  conversas: ConversaItem[];
  loading: boolean;
  canal: string;
  onCanalChange: (c: string) => void;
  view: string;
  onViewChange: (v: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  selectedId: string | null;
  onSelect: (item: ConversaItem) => void;
  onNovaMensagem: () => void;
  contagens?: { todas: number; whatsapp: number; email: number; ligacao: number };
}) {
  return (
    <div
      className="flex flex-col h-full shrink-0 w-[336px] rounded-2xl overflow-hidden"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div className="flex flex-col gap-4 p-5 pb-4" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold tracking-tight" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
            Atendimento
          </p>
          <button
            onClick={onNovaMensagem}
            title="Nova mensagem"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {TABS.map((t) => {
            const n = contagens?.[t.key];
            const ativo = canal === t.key;
            const mostrarContagem = typeof n === "number" && n > 0;
            return (
              <button
                key={t.key}
                onClick={() => onCanalChange(t.key)}
                title={t.label}
                className="flex flex-1 items-center justify-center gap-1.5 h-9 rounded-[9px] text-[12px] font-semibold transition-all min-w-0"
                style={{
                  background: ativo ? "var(--cf2-bg-surface)" : "transparent",
                  color: ativo ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
                  boxShadow: ativo ? "var(--cf2-shadow-card-sm)" : "none",
                }}
              >
                <t.Icon className="w-3.5 h-3.5 shrink-0" />
                {mostrarContagem && (
                  <span
                    className="shrink-0 text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full tabular-nums leading-none px-1"
                    style={{
                      background: ativo ? "var(--cf2-accent)" : "var(--cf2-bg-inverse)",
                      color: ativo ? "var(--cf2-text-on-accent)" : "var(--cf2-text-on-inverse)",
                    }}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 items-stretch">
          <div
            className="flex-1 flex items-center gap-2 px-3 h-9 rounded-lg min-w-0"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar conversa ou pessoa"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <div className="relative shrink-0">
            <select
              value={view}
              onChange={(e) => onViewChange(e.target.value)}
              className="appearance-none h-9 rounded-lg pl-3 pr-8 text-[12px] font-medium outline-none cursor-pointer"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              {VIEW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--cf2-text-tertiary)" }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 p-2">
        {loading && <p className="text-[13px] text-center py-8" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando conversas…</p>}
        {!loading && conversas.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 px-4 text-center">
            <span className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <Inbox className="w-4.5 h-4.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            </span>
            <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma conversa por aqui ainda.</p>
          </div>
        )}
        {conversas.map((item) => {
          const Icone = ICONE[item.tipo];
          const isSelected = item.id === selectedId;
          const naoLida = item.naoLidas > 0;
          return (
            <button
              key={`${item.tipo}-${item.id}`}
              onClick={() => onSelect(item)}
              className="group relative flex flex-col gap-2 py-3 pl-4 pr-3 rounded-xl text-left w-full transition-colors"
              style={{ background: isSelected ? "var(--cf2-bg-surface-muted)" : "transparent" }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--cf2-bg-surface-subtle)"; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              {isSelected && (
                <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
              )}
              <div className="flex items-start justify-between w-full gap-2">
                <div className="flex gap-3 items-center min-w-0">
                  <div
                    className="relative flex items-center justify-center rounded-full shrink-0 w-9 h-9"
                    style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
                  >
                    <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>
                      {/^\d+$/.test(item.nome) ? "#" : iniciais(item.nome)}
                    </p>
                    {naoLida && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2" style={{ background: "var(--cf2-accent-border)", boxShadow: "0 0 0 2px var(--cf2-bg-surface)" }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13.5px] truncate leading-snug" style={{ color: "var(--cf2-text-primary)", fontWeight: naoLida ? 600 : 500 }}>{nomeExibicao(item.nome, item.telefone)}</p>
                      {item.leadId && (
                        <span
                          className="shrink-0 text-[10px] font-semibold px-1.5 py-[1px] rounded-full leading-tight"
                          style={{
                            background: item.isCliente ? "var(--cf2-success-bg)" : "var(--cf2-accent-bg-subtle)",
                            color: item.isCliente ? "var(--cf2-success-text)" : "var(--cf2-text-secondary)",
                          }}
                        >
                          {item.isCliente ? "Cliente" : "Lead"}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] truncate leading-snug mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{item.empresaNome || "Sem empresa vinculada"}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center shrink-0 pt-0.5">
                  {item.handoffStatus === "human_required" && (
                    <span title="Precisa de humano">
                      <AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--cf2-warning-text)" }} />
                    </span>
                  )}
                  <p className="text-[11px] tabular-nums" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarHora(item.timestamp)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between w-full gap-2 pl-[48px]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Icone className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                  <p className="text-[12.5px] truncate" style={{ color: naoLida ? "var(--cf2-text-secondary)" : "var(--cf2-text-tertiary)", fontWeight: naoLida ? 500 : 400 }}>{item.preview || "Sem mensagens ainda"}</p>
                </div>
                {naoLida && (
                  <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums" style={{ background: "var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}>
                    {item.naoLidas > 9 ? "9+" : item.naoLidas}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
