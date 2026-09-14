"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  titulo: string;
  mensagem: string | null;
  tipo: string;
  lida: boolean;
  link: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Mesma fonte de dado do NotificationDropdown (dark, legado) — UI própria
// pro tema claro da V2, mesmo endpoint/mutations reais.
// Achado real 25/08 (Kauã: "fundo branco do nada" na tela de Propostas,
// escura) — o painel ABERTO era sempre claro independente de `variant`,
// só o sino fechado respeitava. Corrigido: painel também segue `variant`.
export function Cf2NotificationBell({ variant = "light" }: { variant?: "light" | "dark" }) {
  const dark = variant === "dark";
  const bg = dark ? "var(--cf2-chrome-bg)" : "var(--cf2-bg-surface)";
  const border = dark ? "var(--cf2-chrome-border-subtle)" : "var(--cf2-border-default)";
  const textPrimary = dark ? "var(--cf2-chrome-text-primary)" : "var(--cf2-text-primary)";
  const textSecondary = dark ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-secondary)";
  const hoverBg = dark ? "rgba(255,255,255,0.08)" : "var(--cf2-bg-surface-muted)";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notificacoes");
      if (!res.ok) return { notificacoes: [] };
      return res.json();
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const notifications: Notification[] = (data?.notificacoes ?? []).filter((n: Notification) => n.tipo !== "whatsapp_msg");
  const unreadCount = notifications.filter((n) => !n.lida).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/notificacoes/${id}`, { method: "PATCH" }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.lida);
      await Promise.all(unread.map((n) => fetch(`/api/notificacoes/${n.id}`, { method: "PATCH" })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 cf2-transicao"
        style={{ background: open ? hoverBg : "transparent", outlineColor: "var(--cf2-accent)" }}
      >
        <Bell className="w-4 h-4" style={{ color: textSecondary }} aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "var(--cf2-success-fill)" }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius-card)]"
          style={{
            background: bg,
            border: `1px solid ${border}`,
            boxShadow: "var(--shadow-flutuante)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
            <span className="text-sm font-semibold" style={{ color: textPrimary }}>Notificações</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: dark ? "var(--cf2-success-fill)" : "var(--cf2-success-text)" }}
              >
                <Check className="w-3 h-3" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: textSecondary }} />
                <p className="text-xs" style={{ color: textSecondary }}>Nenhuma notificação</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => {
                const content = (
                  <div
                    className="flex cursor-pointer items-start gap-3 px-4 py-3 cf2-transicao hover:bg-[var(--cf2-notification-hover)]"
                    style={{ opacity: notif.lida ? 0.5 : 1, "--cf2-notification-hover": hoverBg } as React.CSSProperties}
                    onClick={() => { if (!notif.lida) markRead.mutate(notif.id); setOpen(false); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: textPrimary }}>{notif.titulo}</p>
                      {notif.mensagem && <p className="text-xs truncate mt-0.5" style={{ color: textSecondary }}>{notif.mensagem}</p>}
                      <p className="text-[10px] mt-1" style={{ color: textSecondary }}>{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.lida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--cf2-success-fill)" }} />}
                  </div>
                );
                return notif.link ? <Link key={notif.id} href={notif.link}>{content}</Link> : <div key={notif.id}>{content}</div>;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
