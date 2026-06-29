"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Calendar, ChevronDown, User, Search, X } from "lucide-react";
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

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return { open, setOpen, ref };
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
 * Barra de filtros dos boards (Pré-vendas / Pipeline):
 * Responsável (Todos / Meu / por usuário, com busca) + Período.
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
  accent = "#8e27ef",
}: {
  usuarios: OrgUsuario[];
  currentUserId: string | null;
  resp: string;
  setResp: (v: string) => void;
  periodo: DateFilter;
  setPeriodo: (v: DateFilter) => void;
  customFrom?: string;
  setCustomFrom?: (v: string) => void;
  customTo?: string;
  setCustomTo?: (v: string) => void;
  accent?: string;
}) {
  const respDd = useDropdown();
  const dateDd = useDropdown();
  const [search, setSearch] = useState("");

  const respActive = resp !== "todos";
  const dateActive = periodo !== "all";

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
      <div className="relative shrink-0" ref={respDd.ref}>
        <button
          onClick={() => { respDd.setOpen(!respDd.open); dateDd.setOpen(false); }}
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
          <div
            className="absolute left-0 top-full mt-1 z-50 w-[220px] rounded-xl shadow-xl py-1"
            style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <DropItem label="Todos" active={resp === "todos"} accent={accent} onClick={() => { setResp("todos"); respDd.setOpen(false); }} />
            {currentUserId && (
              <DropItem label="Meus (eu)" active={resp === "meu"} accent={accent} onClick={() => { setResp("meu"); respDd.setOpen(false); }} />
            )}
            <DropItem label="Sem responsável" active={resp === "sem"} accent={accent} onClick={() => { setResp("sem"); respDd.setOpen(false); }} />
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
                  onClick={() => { setResp(u.id); respDd.setOpen(false); }}
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
          </div>
        )}
      </div>

      {/* Período */}
      <div className="relative shrink-0" ref={dateDd.ref}>
        <button
          onClick={() => { dateDd.setOpen(!dateDd.open); respDd.setOpen(false); }}
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
          <div
            className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl shadow-xl py-1"
            style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <DropItem label="Todos" active={periodo === "all"} accent={accent} onClick={() => { setPeriodo("all"); dateDd.setOpen(false); }} />
            {DATE_OPTIONS.map((opt) => (
              <DropItem
                key={opt.value}
                label={opt.label}
                active={periodo === opt.value}
                accent={accent}
                onClick={() => { setPeriodo(opt.value); if (opt.value !== "custom") dateDd.setOpen(false); }}
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
                <button onClick={() => dateDd.setOpen(false)} className="w-full text-[10px] text-center py-1 rounded text-white/50 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.06]">Aplicar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {(respActive || dateActive) && (
        <button
          onClick={() => { setResp("todos"); setPeriodo("all"); setCustomFrom?.(""); setCustomTo?.(""); }}
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
