"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

interface PeriodSelectorProps {
  value: string;
  onChange: (v: string) => void;
}

const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "60d", label: "60 dias" },
  { value: "90d", label: "90 dias" },
  { value: "365d", label: "12 meses" },
];

// Presets + intervalo customizado ("custom:YYYY-MM-DD:YYYY-MM-DD", parseado em lib/relatorios/periodo)
export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const isCustom = value.startsWith("custom:");
  const [showCustom, setShowCustom] = useState(isCustom);
  const [from, setFrom] = useState(isCustom ? value.split(":")[1] : "");
  const [to, setTo] = useState(isCustom ? value.split(":")[2] : "");

  const applyCustom = (f: string, t: string) => {
    if (f && t && f <= t) onChange(`custom:${f}:${t}`);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div
        className="inline-flex rounded-lg p-0.5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setShowCustom(false); onChange(p.value); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                value === p.value ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              isCustom ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            <CalendarDays className="w-3 h-3" />
            Período
          </button>
        </div>
      </div>
      {showCustom && (
        <div
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); applyCustom(e.target.value, to); }}
            className="bg-transparent text-[11px] text-white/70 outline-none [color-scheme:dark]"
          />
          <span className="text-[11px] text-white/30">até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); applyCustom(from, e.target.value); }}
            className="bg-transparent text-[11px] text-white/70 outline-none [color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
}
