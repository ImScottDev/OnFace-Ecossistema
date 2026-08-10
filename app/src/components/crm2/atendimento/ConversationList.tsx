"use client";

import { MessageSquare, Mail, Phone, Search, SlidersHorizontal } from "lucide-react";
import { ConversaItem, iniciais, formatarHora } from "./types";

const TABS = [
  { key: "todas", label: "Todas" },
  { key: "whatsapp", label: "Whats" },
  { key: "email", label: "E-mail" },
  { key: "ligacao", label: "Ligar" },
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

        <div className="flex gap-1 p-[3px] rounded-[10px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onCanalChange(t.key)}
              className="flex-1 py-1.5 rounded-[7px] text-[12px] font-bold"
              style={{
                background: canal === t.key ? "var(--cf2-bg-surface)" : "transparent",
                color: canal === t.key ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)",
                boxShadow: canal === t.key ? "0 2px 2px rgba(0,0,0,0.03)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[10px]"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
          >
            <Search className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar conversa, pessoa..."
              className="flex-1 bg-transparent outline-none text-[11px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value)}
            className="text-[11px] rounded-[10px] px-2 py-2 outline-none"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
          >
            <option value="meus">Meus</option>
            <option value="nao_atribuidos">Não atribuídos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-[2px] p-2 mt-2">
        {loading && <p className="text-[12px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>}
        {!loading && conversas.length === 0 && (
          <p className="text-[12px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma conversa aqui.</p>
        )}
        {conversas.map((item) => {
          const Icone = ICONE[item.tipo];
          const isSelected = item.id === selectedId;
          const naoLida = item.naoLidas > 0;
          return (
            <button
              key={`${item.tipo}-${item.id}`}
              onClick={() => onSelect(item)}
              className="flex flex-col gap-2 p-3 rounded-2xl text-left w-full transition-colors"
              style={{
                background: isSelected ? "var(--cf2-bg-surface)" : "transparent",
                border: isSelected ? "1.5px solid var(--cf2-accent-border)" : "1.5px solid transparent",
                boxShadow: isSelected ? "0 4px 6px rgba(0,0,0,0.04)" : "none",
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex gap-2 items-center min-w-0">
                  <div
                    className="flex items-center justify-center rounded-2xl shrink-0 w-8 h-8"
                    style={{ background: naoLida ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}
                  >
                    <p className="text-[11px] font-extrabold" style={{ color: naoLida ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>
                      {iniciais(item.nome)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{item.empresaNome || "—"}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center shrink-0">
                  <Icone className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarHora(item.timestamp)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between w-full gap-2">
                <p className="text-[12px] font-semibold truncate flex-1" style={{ color: "var(--cf2-text-primary)" }}>{item.preview}</p>
                {naoLida && (
                  <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
