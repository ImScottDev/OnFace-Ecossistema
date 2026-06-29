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
      className={`rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 ${className}`}
      style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: `${delay}s` }}
    >
      <div>
        <h3 className="text-sm font-medium text-white/50">{title}</h3>
        {subtitle && (
          <p className="text-[10px] text-white/25 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-[200px] rounded-lg animate-pulse bg-white/[0.03]" />
        ) : empty ? (
          <div className="h-[200px] flex flex-col items-center justify-center">
            <p className="text-sm text-white/40">Sem dados no período</p>
            {emptyText && (
              <p className="text-[10px] text-white/25 mt-1">{emptyText}</p>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
