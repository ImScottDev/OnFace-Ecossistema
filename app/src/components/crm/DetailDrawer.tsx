"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  subtitleColor?: string;
  fullPageHref?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export function DetailDrawer({ open, onClose, title, subtitle, subtitleColor, fullPageHref, headerExtra, children, width = "w-full sm:w-[500px]" }: DetailDrawerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer panel — solid background, no glass */}
      <div
        ref={ref}
        className={`relative ${width} max-w-[90vw] h-full flex flex-col animate-slide-in-right`}
        style={{ background: "#12141a", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2 flex-wrap">
              {title && <h2 className="text-sm font-semibold text-white truncate">{title}</h2>}
              {subtitle && (
                subtitleColor ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${subtitleColor}20`, color: subtitleColor }}>{subtitle}</span>
                ) : (
                  <span className="text-xs text-white/40 truncate">{subtitle}</span>
                )
              )}
            </div>
            {headerExtra && <div className="mt-1">{headerExtra}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {fullPageHref && (
              <a
                href={fullPageHref}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
                title="Abrir página completa"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {children}
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
}
