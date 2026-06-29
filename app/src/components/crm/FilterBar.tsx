"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mail, MailOpen, Users, Calendar, Tag, X, ChevronDown, Plus,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

export type DateFilter = "all" | "today" | "7days" | "30days" | "custom";
export type TipoFilter = "all" | "contato" | "lead" | "cliente";

interface Label {
  id: string; nome: string; cor: string;
}

interface FilterBarProps {
  filterUnread: boolean;
  setFilterUnread: (v: boolean) => void;
  filterTipo: TipoFilter | string;
  setFilterTipo: (v: string) => void;
  filterDate: DateFilter;
  setFilterDate: (v: DateFilter) => void;
  customDateFrom?: string;
  setCustomDateFrom?: (v: string) => void;
  customDateTo?: string;
  setCustomDateTo?: (v: string) => void;
  labels?: Label[];
  filterLabels?: string[];
  setFilterLabels?: (v: string[]) => void;
  onLabelCreated?: () => void;
  accentColor?: string; // hex color for active state
  totalUnread?: number;
}

// ─── Constants ──────────────────────────────────────────

const TIPO_OPTIONS = [
  { value: "contato", label: "Contato", color: "#6B7280" },
  { value: "lead", label: "Lead", color: "#3B82F6" },
  { value: "cliente", label: "Cliente", color: "#10B981" },
];

const DATE_OPTIONS = [
  { value: "today" as DateFilter, label: "Hoje" },
  { value: "7days" as DateFilter, label: "7 dias" },
  { value: "30days" as DateFilter, label: "30 dias" },
  { value: "custom" as DateFilter, label: "Personalizado" },
];

// ─── Dropdown Hook ──────────────────────────────────────

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

// ─── Filter Button ──────────────────────────────────────

function FilterButton({
  icon: Icon,
  label,
  active,
  accent,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  active: boolean;
  accent: string;
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all duration-150 relative"
      style={{
        background: active ? `${accent}15` : "rgba(255,255,255,0.03)",
        color: active ? accent : "rgba(255,255,255,0.4)",
        border: `1px solid ${active ? `${accent}30` : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label && <span>{label}</span>}
      {badge && (
        <span
          className="text-[9px] px-1 py-0 rounded-full font-bold"
          style={{ background: `${accent}25`, color: accent }}
        >
          {badge}
        </span>
      )}
      <ChevronDown className="w-2.5 h-2.5 opacity-50" />
    </button>
  );
}

// ─── Dropdown Menu ──────────────────────────────────────

function DropdownMenu({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl shadow-xl py-1 ${className || ""}`}
      style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  label,
  active,
  color,
  onClick,
  dot,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
      }`}
      style={{ color: active ? (color || "#fff") : "rgba(255,255,255,0.6)" }}
    >
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
      <span className="flex-1">{label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color || "#fff" }} />}
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────

const PRESET_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#8e27ef"];

export function FilterBar({
  filterUnread, setFilterUnread,
  filterTipo, setFilterTipo,
  filterDate, setFilterDate,
  customDateFrom, setCustomDateFrom,
  customDateTo, setCustomDateTo,
  labels, filterLabels, setFilterLabels, onLabelCreated,
  accentColor = "#3B82F6",
  totalUnread = 0,
}: FilterBarProps) {
  const tipoDropdown = useDropdown();
  const dateDropdown = useDropdown();
  const labelDropdown = useDropdown();
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);
  const [creatingLabel, setCreatingLabel] = useState(false);

  const createLabel = async () => {
    if (!newLabelName.trim() || creatingLabel) return;
    setCreatingLabel(true);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: newLabelName.trim(), cor: newLabelColor }),
      });
      if (res.ok) {
        setNewLabelName("");
        setShowNewLabel(false);
        onLabelCreated?.();
      }
    } finally {
      setCreatingLabel(false);
    }
  };

  const hasActiveFilters = filterUnread || filterTipo !== "all" || filterDate !== "all" || (filterLabels && filterLabels.length > 0);

  const tipoActive = filterTipo !== "all";
  const tipoLabel = TIPO_OPTIONS.find(t => t.value === filterTipo)?.label;

  const dateActive = filterDate !== "all";
  const dateLabel = DATE_OPTIONS.find(d => d.value === filterDate)?.label;

  const labelsActive = (filterLabels?.length ?? 0) > 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Unread toggle — simple icon button */}
      <button
        onClick={() => setFilterUnread(!filterUnread)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all duration-150"
        style={{
          background: filterUnread ? `${accentColor}15` : "rgba(255,255,255,0.03)",
          color: filterUnread ? accentColor : "rgba(255,255,255,0.4)",
          border: `1px solid ${filterUnread ? `${accentColor}30` : "rgba(255,255,255,0.06)"}`,
        }}
        title={filterUnread ? "Mostrar todas" : "Apenas não lidas"}
      >
        {filterUnread ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
        {filterUnread && <span>Não lidas</span>}
        {!filterUnread && totalUnread > 0 && (
          <span className="text-[9px] px-1 py-0 rounded-full font-bold" style={{ background: `${accentColor}25`, color: accentColor }}>
            {totalUnread}
          </span>
        )}
      </button>

      {/* Status (Tipo) dropdown */}
      <div className="relative" ref={tipoDropdown.ref}>
        <FilterButton
          icon={Users}
          label={tipoActive ? tipoLabel : undefined}
          active={tipoActive}
          accent={tipoActive ? (TIPO_OPTIONS.find(t => t.value === filterTipo)?.color || accentColor) : accentColor}
          onClick={() => { tipoDropdown.setOpen(!tipoDropdown.open); dateDropdown.setOpen(false); labelDropdown.setOpen(false); }}
        />
        {tipoDropdown.open && (
          <DropdownMenu>
            <DropdownItem label="Todos" active={filterTipo === "all"} onClick={() => { setFilterTipo("all"); tipoDropdown.setOpen(false); }} />
            {TIPO_OPTIONS.map(opt => (
              <DropdownItem
                key={opt.value}
                label={opt.label}
                active={filterTipo === opt.value}
                color={opt.color}
                dot={opt.color}
                onClick={() => { setFilterTipo(filterTipo === opt.value ? "all" : opt.value); tipoDropdown.setOpen(false); }}
              />
            ))}
          </DropdownMenu>
        )}
      </div>

      {/* Period dropdown */}
      <div className="relative" ref={dateDropdown.ref}>
        <FilterButton
          icon={Calendar}
          label={dateActive ? dateLabel : undefined}
          active={dateActive}
          accent={accentColor}
          onClick={() => { dateDropdown.setOpen(!dateDropdown.open); tipoDropdown.setOpen(false); labelDropdown.setOpen(false); }}
        />
        {dateDropdown.open && (
          <DropdownMenu>
            <DropdownItem label="Todos" active={filterDate === "all"} color={accentColor} onClick={() => { setFilterDate("all"); dateDropdown.setOpen(false); }} />
            {DATE_OPTIONS.map(opt => (
              <DropdownItem
                key={opt.value}
                label={opt.label}
                active={filterDate === opt.value}
                color={accentColor}
                onClick={() => {
                  setFilterDate(filterDate === opt.value ? "all" : opt.value);
                  if (opt.value !== "custom") dateDropdown.setOpen(false);
                }}
              />
            ))}
            {/* Custom date range inputs */}
            {filterDate === "custom" && setCustomDateFrom && setCustomDateTo && (
              <div className="px-3 py-2 space-y-1.5 border-t border-white/[0.06]">
                <div>
                  <label className="text-[10px] text-white/30 block mb-0.5">De</label>
                  <input
                    type="date"
                    value={customDateFrom || ""}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full text-[11px] px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-white/70 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 block mb-0.5">Até</label>
                  <input
                    type="date"
                    value={customDateTo || ""}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full text-[11px] px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-white/70 outline-none"
                  />
                </div>
                <button
                  onClick={() => dateDropdown.setOpen(false)}
                  className="w-full text-[10px] text-center py-1 rounded text-white/50 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.06]"
                >
                  Aplicar
                </button>
              </div>
            )}
          </DropdownMenu>
        )}
      </div>

      {/* Labels dropdown */}
      {labels && filterLabels && setFilterLabels && (
        <div className="relative" ref={labelDropdown.ref}>
          <FilterButton
            icon={Tag}
            active={labelsActive}
            accent="#F59E0B"
            badge={labelsActive ? filterLabels.length : undefined}
            onClick={() => { labelDropdown.setOpen(!labelDropdown.open); tipoDropdown.setOpen(false); dateDropdown.setOpen(false); }}
          />
          {labelDropdown.open && (
            <DropdownMenu className="max-h-72 overflow-y-auto min-w-[180px]">
              {labels.length === 0 && !showNewLabel && <p className="px-3 py-2 text-xs text-white/30">Nenhuma etiqueta</p>}
              {labels.map(label => (
                <label key={label.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLabels.includes(label.id)}
                    onChange={() => setFilterLabels(
                      filterLabels.includes(label.id)
                        ? filterLabels.filter(id => id !== label.id)
                        : [...filterLabels, label.id]
                    )}
                    className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30 w-3.5 h-3.5"
                  />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: label.cor }} />
                  <span className="text-xs text-white/70 truncate">{label.nome}</span>
                </label>
              ))}
              {filterLabels.length > 0 && (
                <button
                  onClick={() => setFilterLabels([])}
                  className="w-full px-3 py-1.5 text-xs text-white/30 hover:text-white/50 text-left border-t border-white/[0.06]"
                >
                  Limpar etiquetas
                </button>
              )}
              {/* Create new label */}
              <div className="border-t border-white/[0.06]">
                {showNewLabel ? (
                  <div className="px-3 py-2 space-y-1.5">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") createLabel(); }}
                      placeholder="Nome da etiqueta..."
                      className="w-full text-[11px] px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-white/80 placeholder:text-white/25 outline-none"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          className="w-4 h-4 rounded-full transition-transform"
                          style={{ background: c, outline: newLabelColor === c ? "2px solid white" : "none", outlineOffset: 1, transform: newLabelColor === c ? "scale(1.2)" : "scale(1)" }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={createLabel}
                        disabled={!newLabelName.trim() || creatingLabel}
                        className="flex-1 text-[10px] py-1 rounded text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40"
                      >
                        {creatingLabel ? "..." : "Criar"}
                      </button>
                      <button
                        onClick={() => { setShowNewLabel(false); setNewLabelName(""); }}
                        className="text-[10px] px-2 py-1 rounded text-white/30 hover:text-white/50 bg-white/[0.04]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewLabel(true)}
                    className="w-full px-3 py-1.5 text-xs text-amber-400/70 hover:text-amber-400 hover:bg-white/[0.04] text-left flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Criar etiqueta
                  </button>
                )}
              </div>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Clear all filters */}
      {hasActiveFilters && (
        <button
          onClick={() => {
            setFilterUnread(false);
            setFilterTipo("all");
            setFilterDate("all");
            if (setFilterLabels) setFilterLabels([]);
            if (setCustomDateFrom) setCustomDateFrom("");
            if (setCustomDateTo) setCustomDateTo("");
          }}
          className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          title="Limpar filtros"
        >
          <X className="w-3.5 h-3.5 text-white/30 hover:text-white/50" />
        </button>
      )}
    </div>
  );
}

// ─── Helper: client-side date filter matching ───────────

export function matchesDateFilter(
  dateStr: string | null,
  filter: DateFilter,
  customFrom?: string,
  customTo?: string,
): boolean {
  if (filter === "all" || !dateStr) return true;
  const msgDate = new Date(dateStr);
  const now = new Date();

  if (filter === "custom") {
    if (customFrom && msgDate < new Date(customFrom)) return false;
    if (customTo) {
      const to = new Date(customTo);
      to.setHours(23, 59, 59, 999);
      if (msgDate > to) return false;
    }
    return true;
  }

  const diffMs = now.getTime() - msgDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  switch (filter) {
    case "today": return diffDays < 1 && msgDate.toDateString() === now.toDateString();
    case "7days": return diffDays <= 7;
    case "30days": return diffDays <= 30;
    default: return true;
  }
}
