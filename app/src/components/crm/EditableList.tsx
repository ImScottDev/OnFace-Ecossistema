"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

const PRESET_COLORS = [
  "#3B82F6", "#EAB308", "#8e27ef", "#8B5CF6", "#EF4444",
  "#10B981", "#06B6D4", "#EC4899", "#14B8A6", "#F59E0B",
  "#6366F1", "#84CC16", "#22C55E", "#A855F7", "#F43F5E",
];

export function generateKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function EditableList({
  title,
  description,
  items,
  onChange,
  showColor,
  showSla,
}: {
  title: string;
  description: string;
  items: { key: string; label: string; color?: string; slaHours?: number }[];
  onChange: (items: { key: string; label: string; color?: string; slaHours?: number }[]) => void;
  showColor?: boolean;
  showSla?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    const copy = [...items];
    [copy[from], copy[to]] = [copy[to], copy[from]];
    onChange(copy);
  };

  const update = (idx: number, field: string, value: string | number) => {
    const copy = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
    if (field === "label" && typeof value === "string") {
      copy[idx].key = generateKey(value);
    }
    onChange(copy);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const add = () => {
    const color = showColor ? PRESET_COLORS[items.length % PRESET_COLORS.length] : undefined;
    onChange([...items, { key: "", label: "", color, slaHours: showSla ? 48 : undefined }]);
  };

  return (
    <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="text-left">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">{items.length} itens</span>
          {collapsed ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronUp className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 group">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-white/20 hover:text-white/60 disabled:opacity-0 transition-colors"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="text-white/20 hover:text-white/60 disabled:opacity-0 transition-colors"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              <GripVertical className="w-4 h-4 text-white/10 shrink-0" />

              {showColor && (
                <input
                  type="color"
                  value={item.color || "#6B7280"}
                  onChange={(e) => update(idx, "color", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent shrink-0"
                />
              )}

              <input
                type="text"
                value={item.label}
                onChange={(e) => update(idx, "label", e.target.value)}
                placeholder="Nome"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
              />

              <span className="text-[10px] text-white/20 font-mono w-24 truncate shrink-0" title={item.key}>
                {item.key || "..."}
              </span>

              {showSla && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={item.slaHours || ""}
                    onChange={(e) => update(idx, "slaHours", parseInt(e.target.value) || 0)}
                    placeholder="SLA"
                    className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-white/20"
                  />
                  <span className="text-[10px] text-white/30" title="Tempo máximo recomendado (em horas) antes de avançar o negócio">h</span>
                </div>
              )}

              <button
                onClick={() => remove(idx)}
                className="text-white/10 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={add}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}
