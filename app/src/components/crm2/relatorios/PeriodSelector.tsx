"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { GO_LIVE, GO_LIVE_ISO, parsePeriodo } from "@/lib/relatorios/periodo";

interface PeriodSelectorProps {
  value: string;
  onChange: (v: string) => void;
}

const fmtShort = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
const fmtFull = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/**
 * Toggle de período como PILL SEGMENTADO (gramática da ref. Earnify, 22/07):
 * [ Mês atual | 7 dias | 📅 intervalo ] — item ativo em fundo claro sólido
 * (inversão dark do "preto sólido" da referência). O segmento de calendário
 * mostra o range aplicado quando um intervalo customizado está ativo.
 */
export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const isCustom = value.startsWith("custom:");
  const [from, setFrom] = useState(isCustom ? value.split(":")[1] : "");
  const [to, setTo] = useState(isCustom ? value.split(":")[2] : "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const applyCustom = (f: string, t: string) => {
    if (f && t && f <= t) onChange(`custom:${f}:${t}`);
  };

  const { since, until } = parsePeriodo(value);
  const limitado = since.getTime() <= GO_LIVE.getTime();

  const segBase = "px-3.5 py-1.5 text-[12px] font-medium rounded-full transition-colors whitespace-nowrap";
  const segAtivo = { background: "#F5F5F5", color: "#0A0A0A" };
  const segInativo = "text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)]";

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-0.5 p-1 rounded-full border border-[var(--cf2-border-default)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <button
          onClick={() => { setOpen(false); onChange("mes_atual"); }}
          className={`${segBase} ${value === "mes_atual" ? "" : segInativo}`}
          style={value === "mes_atual" ? segAtivo : undefined}
        >
          Mês atual
        </button>
        <button
          onClick={() => { setOpen(false); onChange("mes_passado"); }}
          className={`${segBase} ${value === "mes_passado" ? "" : segInativo}`}
          style={value === "mes_passado" ? segAtivo : undefined}
          title="Mês anterior completo — ex.: julho/2026 quando hoje é agosto"
        >
          Mês passado
        </button>
        <button
          onClick={() => { setOpen(false); onChange("7d"); }}
          className={`${segBase} ${value === "7d" ? "" : segInativo}`}
          style={value === "7d" ? segAtivo : undefined}
        >
          7 dias
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`${segBase} flex items-center gap-1.5 ${isCustom ? "" : segInativo}`}
          style={isCustom ? segAtivo : undefined}
          title={limitado ? `Limitado ao go-live do CRM (${fmtFull(GO_LIVE)}) — dado anterior vem da era Zoho e não entra no relatório` : undefined}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {isCustom ? `${fmtShort(since)} – ${fmtShort(until)}` : "Intervalo"}
          {limitado && <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shrink-0" />}
        </button>
      </div>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-[var(--cf2-border-default)] p-3 z-50 shadow-xl"
          style={{ background: "var(--cf2-bg-surface-muted)" }}
        >
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] uppercase tracking-[0.14em] mb-2">Intervalo personalizado</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date" aria-label="Data"
              value={from}
              min={GO_LIVE_ISO}
              title="Dados anteriores ao go-live do CRM (migração Zoho) não são confiáveis"
              onChange={(e) => { setFrom(e.target.value); applyCustom(e.target.value, to); }}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] text-[var(--cf2-text-secondary)] outline-none [color-scheme:dark]"
              style={{ background: "var(--cf2-bg-surface-muted)" }}
            />
            <span className="text-[var(--cf2-text-tertiary)] text-[11px]">–</span>
            <input
              type="date" aria-label="Data"
              value={to}
              min={GO_LIVE_ISO}
              onChange={(e) => { setTo(e.target.value); applyCustom(from, e.target.value); }}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] text-[var(--cf2-text-secondary)] outline-none [color-scheme:dark]"
              style={{ background: "var(--cf2-bg-surface-muted)" }}
            />
          </div>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-2">Aplicado: {fmtShort(since)} – {fmtShort(until)}</p>
        </div>
      )}
    </div>
  );
}
