"use client";

import { MessageSquare, Mail, Phone, Search, SlidersHorizontal, AlertCircle, Inbox, LayoutGrid, ChevronDown } from "lucide-react";
import { ConversaItem, iniciais, formatarHora, nomeExibicao } from "./types";

const TABS = [
  { key: "todas", label: "Todas", Icon: LayoutGrid },
  { key: "whatsapp", label: "Whats", Icon: MessageSquare },
  { key: "email", label: "E-mail", Icon: Mail },
  { key: "ligacao", label: "Ligar", Icon: Phone },
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
      className="flex flex-col h-full shrink-0 w-[320px] rounded-3xl overflow-hidden"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div className="flex flex-col gap-3 p-4 pb-0">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
            Atendimento
          </p>
          <button onClick={onNovaMensagem} title="Nova mensagem">
            <SlidersHorizontal className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {TABS.map((t) => {
            const n = contagens?.[t.key];
            const ativo = canal === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onCanalChange(t.key)}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-[9px] text-[11px] font-bold transition-colors min-w-0"
                style={{
                  background: ativo ? "var(--cf2-bg-surface)" : "transparent",
                  color: ativo ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
                  boxShadow: ativo ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <t.Icon className="w-3.5 h-3.5" />
                <span className="flex items-center gap-1 leading-none">
                  <span className="truncate">{t.label}</span>
                  <span
                    className="text-[9px] font-bold px-1 rounded-full tabular-nums leading-tight"
                    style={{
                      background: ativo ? "var(--cf2-bg-surface-muted)" : "var(--cf2-bg-surface)",
                      color: "var(--cf2-text-tertiary)",
                      visibility: typeof n === "number" && n > 0 ? "visible" : "hidden",
                    }}
                  >
                    {n ?? 0}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 items-center">
          <div
            className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[10px]"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
          >
            <Search className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar conversa, pessoa..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[11px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <div className="relative shrink-0">
            <select
              value={view}
              onChange={(e) => onViewChange(e.target.value)}
              className="appearance-none text-[11px] font-medium rounded-[10px] h-9 pl-3 pr-6 outline-none cursor-pointer"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              {VIEW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--cf2-text-tertiary)" }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1 p-2 mt-2">
        {loading && <p className="text-[12px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>}
        {!loading && conversas.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
            <span className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <Inbox className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
            </span>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma conversa por aqui.</p>
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
              className="relative flex flex-col gap-1.5 py-3 pl-4 pr-3 rounded-xl text-left w-full transition-colors"
              style={{ background: isSelected ? "var(--cf2-bg-surface-muted)" : "transparent" }}
            >
              {isSelected && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
              )}
              <div className="flex items-center justify-between w-full">
                <div className="flex gap-2.5 items-center min-w-0">
                  <div
                    className="flex items-center justify-center rounded-full shrink-0 w-8 h-8"
                    style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
                  >
                    <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>
                      {/^\d+$/.test(item.nome) ? "#" : iniciais(item.nome)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] truncate leading-tight" style={{ color: "var(--cf2-text-primary)", fontWeight: naoLida ? 700 : 600 }}>{nomeExibicao(item.nome, item.telefone)}</p>
                      {item.leadId && (
                        <span
                          className="shrink-0 text-[9px] font-bold px-1.5 py-[1px] rounded-full leading-tight"
                          style={{
                            background: item.isCliente ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)",
                            color: item.isCliente ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)",
                          }}
                        >
                          {item.isCliente ? "Cliente" : "Lead"}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{item.empresaNome || "—"}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center shrink-0">
                  {item.handoffStatus === "human_required" && (
                    <span title="Precisa de humano">
                      <AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--cf2-warning-text)" }} />
                    </span>
                  )}
                  <Icone className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />
                  <p className="text-[10.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarHora(item.timestamp)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between w-full gap-2 pl-[42px]">
                <p className="text-[12px] truncate flex-1" style={{ color: naoLida ? "var(--cf2-text-secondary)" : "var(--cf2-text-tertiary)", fontWeight: naoLida ? 600 : 400 }}>{item.preview}</p>
                {naoLida && (
                  <span className="shrink-0 w-[7px] h-[7px] rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
