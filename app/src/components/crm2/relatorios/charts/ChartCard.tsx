"use client";

import React, { useState } from "react";
import { Maximize2, Minimize2, ChartNoAxesCombined } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  delay?: number;
  expandable?: boolean;
}

/** Mesmo chart real no card e no modo ampliado. Nunca duplica fonte ou séries. */
export function ChartCard({
  title, subtitle, children, loading = false, empty = false,
  emptyText, className = "", delay = 0, expandable = true,
}: ChartCardProps) {
  const [expandido, setExpandido] = useState(false);
  const corpo = loading ? (
    <div role="status" aria-label={`Carregando ${title}`} className="h-[240px] rounded-xl animate-pulse bg-[var(--cf2-bg-surface-muted)]" />
  ) : empty ? (
    <div className="min-h-[180px] flex flex-col items-center justify-center text-center gap-2">
      <ChartNoAxesCombined size={26} className="text-[var(--cf2-text-tertiary)]" aria-hidden />
      <p className="text-sm text-[var(--cf2-text-secondary)]">Nenhum dado neste recorte</p>
      {emptyText && <p className="text-xs text-[var(--cf2-text-tertiary)] max-w-[38ch]">{emptyText}</p>}
    </div>
  ) : children;

  return (
    <>
      <section data-insights-chart="true" className={`cf-ins-panel rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-5 ${className}`}
        style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: `${delay}s` }}
        aria-label={title}>
        <div className="cf-ins-panel-header">
          <div className="cf-ins-panel-heading">
            <span className="cf-ins-panel-kicker">ANÁLISE · ${empty ? "SEM DADOS" : "EXPLORÁVEL"}</span>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {expandable && !loading && !empty && (
            <button className="cf-ins-expand" type="button" title={`Ampliar ${title}`}
              aria-label={`Ampliar ${title}`} onClick={() => setExpandido(true)}>
              <Maximize2 size={16} aria-hidden/>
              <span>Ampliar</span>
            </button>
          )}
        </div>
        <div className="cf-ins-panel-body">{expandido ? (
          <div className="cf-ins-panel-placeholder">Gráfico aberto em modo ampliado.</div>
        ) : corpo}</div>
      </section>
      {expandable && <Dialog open={expandido} onOpenChange={setExpandido}>
        <DialogContent className="cf-ins-chart-dialog max-w-[min(96vw,1480px)] w-[96vw] max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <div className="cf-ins-panel-kicker">EXPLORAÇÃO EM TELA AMPLIADA</div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{subtitle ?? "O mesmo recorte e os mesmos dados do painel original."}</DialogDescription>
          </DialogHeader>
          <div className="cf-ins-chart-expanded">{expandido ? corpo : null}</div>
          <button type="button" className="cf-ins-expand self-end" onClick={() => setExpandido(false)}>
            <Minimize2 size={15}/> Voltar ao painel
          </button>
        </DialogContent>
      </Dialog>}
    </>
  );
}
