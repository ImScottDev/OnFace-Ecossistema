"use client";

import React from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  delay?: number;
}

export function ChartCard({
  title,
  subtitle,
  children,
  loading = false,
  empty = false,
  emptyText,
  className = "",
  delay = 0,
}: ChartCardProps) {
  return (
    <div
      className={`rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-5 ${className}`}
      style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: `${delay}s` }}
    >
      <div>
        <h3 className="text-sm font-medium text-[var(--cf2-text-secondary)]">{title}</h3>
        {subtitle && (
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-[200px] rounded-lg animate-pulse bg-[var(--cf2-bg-surface)]" />
        ) : empty ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="text-sm text-[var(--cf2-text-tertiary)]">Sem dados no período</p>
            {emptyText && (
              <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">{emptyText}</p>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
