"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.15)" }}
      >
        <Icon className="w-6 h-6 text-[#e23752]" />
      </div>
      <p className="text-sm font-medium text-white/60 mb-1">{title}</p>
      {description && <p className="text-xs text-white/30 text-center max-w-xs">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-xs font-medium rounded-lg text-[#e23752] border border-[#e23752]/20 hover:bg-[#e23752]/10 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
