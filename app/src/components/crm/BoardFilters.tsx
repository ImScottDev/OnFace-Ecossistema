"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Calendar, ChevronDown, User, Search, X, Tag } from "lucide-react";
import { type DateFilter, matchesDateFilter } from "@/components/crm/FilterBar";

export type { DateFilter };
export { matchesDateFilter };

export interface OrgUsuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

/** Lista de usuários ativos da org (id → nome/avatar) + id do usuário logado. */
export function useOrgUsuarios() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const { data } = useQuery({
    queryKey: ["org-usuarios"],
    queryFn: async () => {
      const r = await fetch("/api/usuarios");
      if (!r.ok) return { usuarios: [] as OrgUsuario[] };
      return (await r.json()) as { usuarios: OrgUsuario[] };
    },
    staleTime: 5 * 60 * 1000,
  });
  const usuarios = useMemo(() => data?.usuarios ?? [], [data]);
  const byId = useMemo(() => {
    const m = new Map<string, OrgUsuario>();
    for (const u of usuarios) m.set(u.id, u);
    return m;
  }, [usuarios]);
  return { usuarios, byId, currentUserId };
}

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "7 dias" },
  { value: "30days", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

function firstName(nome: string) {
  return (nome || "").trim().split(/\s+/)[0] || nome;
}

export function initialsOf(nome: string) {
  return (nome || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

interface Rect {
  top: number;
  left: number;
}

/**
 * Dropdown com painel em PORTAL (document.body), posicionado via getBoundingClientRect
 * do botão-gatilho. Necessário porque os boards (Pré-vendas/Pipeline) colocam a barra
 * de filtros dentro de um contêiner com `overflow-x-auto` — um painel `position:absolute`
 * comum fica CORTADO por esse overflow (abre, mas invisível/inacessível: o clique
 * "não faz nada" na prática, mesmo com o state mudando certinho por baixo).
 */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setRect({ top: r.bottom + 4, left: r.left });
      }
      return next;
    });
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, toggle, close, triggerRef, panelRef, rect };
}

/**
 * Chip pequeno de dono (responsável) — avatar + primeiro nome.
 * Mostra quem cuida do card sem precisar abrir.
 */
export function OwnerChip({
  nome,
  avatarUrl,
  color = "#6B7280",
  size = 18,
}: {
  nome?: string | null;
  avatarUrl?: string | null;
  color?: string;
  size?: number;
}) {
  if (!nome) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-white/25" title="Sem responsável">
        <span
          className="rounded-full flex items-center justify-center shrink-0 border border-dashed border-white/20"
          style={{ width: size, height: size }}
        >
          <User className="w-2.5 h-2.5 text-white/30" />
        </span>
        Sem dono
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-white/45 min-w-0" title={`Responsável: ${nome}`}>
      <span
        className="rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[8px] font-bold"
        style={{ width: size, height: size, backgroundColor: `${color}20`, color }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initialsOf(nome)
        )}
      </span>
      <span className="truncate max-w-[80px]">{firstName(nome)}</span>
    </span>
  );
}

/** Verdadeiro se o item passa no filtro de responsável. */
export function matchesResponsavel(
  responsavelId: string | null | undefined,
  filter: string,
  currentUserId: string | null,
): boolean {
  if (filter === "todos") return true;
  if (filter === "meu") return !!currentUserId && responsavelId === currentUserId;
  if (filter === "sem") return !responsavelId;
  return responsavelId === filter;
}

/**
 * Verdadeiro se o item passa no filtro de origem. Match EXATO contra o valor real
 * de `origem` (ex: "Mídia Paga", "Site", "outbound"...) — antes reduzia tudo a um
 * binário Inbound/Outbound e escondia as origens reais.
 */
export function matchesOrigem(origem: string | null | undefined, filter: string): boolean {
  if (filter === "todos") return true;
  return (origem || "").trim() === filter;
}

export interface OrigemOption {
  value: string;
  label: string;
  count?: number;
}

/** Deriva as opções de origem a partir dos dados reais (valores distintos, mais frequentes primeiro). */
export function buildOrigemOptions(items: { origem?: string | null }[]): OrigemOption[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const v = (it.origem || "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }));
}

function DropdownPanel({
  panelRef,
  rect,
  className = "",
  children,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  rect: Rect | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (!rect || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[999] rounded-xl shadow-xl py-1 ${className}`}
      style={{ top: rect.top, left: rect.left, background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Barra de filtros dos boards (Pré-vendas / Pipeline):
 * Responsável (Todos / Meu / por usuário, com busca) + Período (opcional) + Origem (opcional).
 */
export function BoardFilters({
  usuarios,
  currentUserId,
  resp,
  setResp,
  periodo,
  setPeriodo,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  origem,
  setOrigem,
  origemOptions,
  showPeriodo = true,
  accent = "#8e27ef",
}: {
  usuarios: OrgUsuario[];
  currentUserId: string | null;
  resp: string;
  setResp: (v: string) => void;
  periodo?: DateFilter;
  setPeriodo?: (v: DateFilter) => void;
  customFrom?: string;
  setCustomFrom?: (v: string) => void;
  customTo?: string;
  setCustomTo?: (v: string) => void;
  origem?: string;
  setOrigem?: (v: string) => void;
  origemOptions?: OrigemOption[];
  showPeriodo?: boolean;
  accent?: string;
}) {
  const respDd = useDropdown();
  const dateDd = useDropdown();
  const origemDd = useDropdown();
  const [search, setSearch] = useState("");

  const respActive = resp !== "todos";
  const dateActive = showPeriodo && periodo !== undefined && periodo !== "all";
  const origemActive = !!origem && origem !== "todos";
  const origemLabel = origemActive ? (origemOptions?.find((o) => o.value === origem)?.label ?? origem) : "Origem";

  const respLabel = useMemo(() => {
    if (resp === "todos") return "Responsável";
    if (resp === "meu") return "Meu";
    if (resp === "sem") return "Sem dono";
    return firstName(usuarios.find((u) => u.id === resp)?.nome || "Responsável");
  }, [resp, usuarios]);

  const dateLabel = DATE_OPTIONS.find((d) => d.value === periodo)?.label;

  const filteredUsuarios = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? usuarios.filter((u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : usuarios;
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [usuarios, search]);

  return (
    <div className="flex items-center gap-1.5">
      {/* Responsável */}
      <div className="relative shrink-0" ref={respDd.triggerRef}>
        <button
          onClick={() => { respDd.toggle(); dateDd.close(); origemDd.close(); }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all duration-150"
          style={{
            background: respActive ? `${accent}15` : "rgba(255,255,255,0.03)",
            color: respActive ? accent : "rgba(255,255,255,0.4)",
            border: `1px solid ${respActive ? `${accent}30` : "rgba(255,255,255,0.06)"}`,
          }}
        >
          <User className="w-3.5 h-3.5" />
          <span>{respLabel}</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-50" />
        </button>
        {respDd.open && (
          <DropdownPanel panelRef={respDd.panelRef} rect={respDd.rect} className="w-[220px]">
            <DropItem label="Todos" active={resp === "todos"} accent={accent} onClick={() => { setResp("todos"); respDd.close(); }} />
            {currentUserId && (
              <DropItem label="Meus (eu)" active={resp === "meu"} accent={accent} onClick={() => { setResp("meu"); respDd.close(); }} />
            )}
            <DropItem label="Sem responsável" active={resp === "sem"} accent={accent} onClick={() => { setResp("sem"); respDd.close(); }} />
            <div className="px-2 py-1.5 border-t border-white/[0.06] mt-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pessoa..."
                  className="w-full pl-7 pr-2 py-1 rounded-md text-[11px] bg-white/[0.05] border border-white/[0.08] text-white/80 placeholder:text-white/25 outline-none"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto scrollbar-thin">
              {filteredUsuarios.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setResp(u.id); respDd.close(); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors ${resp === u.id ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 overflow-hidden"
                    style={{ backgroundColor: `${accent}20`, color: accent }}
                  >
                    {u.avatarUrl ? <img src={u.avatarUrl} alt={u.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : initialsOf(u.nome)}
                  </span>
                  <span className="truncate text-white/70">{u.nome}</span>
                </button>
              ))}
              {filteredUsuarios.length === 0 && <p className="px-3 py-2 text-[11px] text-white/25">Ninguém encontrado</p>}
            </div>
          </DropdownPanel>
        )}
      </div>

      {/* Período — opcional (showPeriodo=false esconde, ex: Pré-vendas não usa) */}
      {showPeriodo && setPeriodo && (
        <div className="relative shrink-0" ref={dateDd.triggerRef}>
          <button
            onClick={() => { dateDd.toggle(); respDd.close(); origemDd.close(); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all duration-150"
            style={{
              background: dateActive ? `${accent}15` : "rgba(255,255,255,0.03)",
              color: dateActive ? accent : "rgba(255,255,255,0.4)",
              border: `1px solid ${dateActive ? `${accent}30` : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <Calendar className="w-3.5 h-3.5" />
            {dateActive && <span>{dateLabel}</span>}
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </button>
          {dateDd.open && (
            <DropdownPanel panelRef={dateDd.panelRef} rect={dateDd.rect} className="min-w-[160px]">
              <DropItem label="Todos" active={periodo === "all"} accent={accent} onClick={() => { setPeriodo("all"); dateDd.close(); }} />
              {DATE_OPTIONS.map((opt) => (
                <DropItem
                  key={opt.value}
                  label={opt.label}
                  active={periodo === opt.value}
                  accent={accent}
                  onClick={() => { setPeriodo(opt.value); if (opt.value !== "custom") dateDd.close(); }}
                />
              ))}
              {periodo === "custom" && setCustomFrom && setCustomTo && (
                <div className="px-3 py-2 space-y-1.5 border-t border-white/[0.06]">
                  <div>
                    <label className="text-[10px] text-white/30 block mb-0.5">De</label>
                    <input type="date" value={customFrom || ""} onChange={(e) => setCustomFrom(e.target.value)} className="w-full text-[11px] px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-white/70 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 block mb-0.5">Até</label>
                    <input type="date" value={customTo || ""} onChange={(e) => setCustomTo(e.target.value)} className="w-full text-[11px] px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-white/70 outline-none" />
                  </div>
                  <button onClick={() => dateDd.close()} className="w-full text-[10px] text-center py-1 rounded text-white/50 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.06]">Aplicar</button>
                </div>
              )}
            </DropdownPanel>
          )}
        </div>
      )}

      {/* Origem — valores reais (deriva de buildOrigemOptions), só aparece se o board passar setOrigem. */}
      {setOrigem && (
        <div className="relative shrink-0" ref={origemDd.triggerRef}>
          <button
            onClick={() => { origemDd.toggle(); respDd.close(); dateDd.close(); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all duration-150"
            style={{
              background: origemActive ? `${accent}15` : "rgba(255,255,255,0.03)",
              color: origemActive ? accent : "rgba(255,255,255,0.4)",
              border: `1px solid ${origemActive ? `${accent}30` : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{origemLabel}</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </button>
          {origemDd.open && (
            <DropdownPanel panelRef={origemDd.panelRef} rect={origemDd.rect} className="min-w-[180px] max-h-64 overflow-y-auto scrollbar-thin">
              <DropItem label="Todas as origens" active={!origem || origem === "todos"} accent={accent} onClick={() => { setOrigem("todos"); origemDd.close(); }} />
              {(origemOptions ?? []).map((opt) => (
                <DropItem
                  key={opt.value}
                  label={opt.count != null ? `${opt.label} (${opt.count})` : opt.label}
                  active={origem === opt.value}
                  accent={accent}
                  onClick={() => { setOrigem(opt.value); origemDd.close(); }}
                />
              ))}
              {(origemOptions ?? []).length === 0 && <p className="px-3 py-2 text-[11px] text-white/25">Nenhuma origem encontrada</p>}
            </DropdownPanel>
          )}
        </div>
      )}

      {(respActive || dateActive || origemActive) && (
        <button
          onClick={() => { setResp("todos"); setPeriodo?.("all"); setCustomFrom?.(""); setCustomTo?.(""); setOrigem?.("todos"); }}
          className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
          title="Limpar filtros"
        >
          <X className="w-3.5 h-3.5 text-white/30 hover:text-white/50" />
        </button>
      )}
    </div>
  );
}

function DropItem({ label, active, accent, onClick }: { label: string; active: boolean; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center justify-between gap-2 ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
      style={{ color: active ? accent : "rgba(255,255,255,0.6)" }}
    >
      <span>{label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />}
    </button>
  );
}
