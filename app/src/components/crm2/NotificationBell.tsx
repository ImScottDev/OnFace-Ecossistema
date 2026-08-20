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
// `variant="dark"` só troca a cor do sino fechado (usado no hero escuro de
// /inicio) — o dropdown aberto é sempre claro, autocontido, não precisa mudar.
export function Cf2NotificationBell({ variant = "light" }: { variant?: "light" | "dark" }) {
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
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center rounded-full w-9 h-9 transition-colors"
        style={{ background: open ? "var(--cf2-bg-surface-muted)" : "transparent" }}
      >
        <Bell className="w-4 h-4" style={{ color: variant === "dark" ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-secondary)" }} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "var(--cf2-success-fill)" }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 right-0 w-80 rounded-2xl z-50 overflow-hidden"
          style={{
            background: "var(--cf2-bg-surface)",
            border: "1px solid var(--cf2-border-default)",
            boxShadow: "var(--cf2-shadow-card-md)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-[11px] flex items-center gap-1"
                style={{ color: "var(--cf2-success-text)" }}
              >
                <Check className="w-3 h-3" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--cf2-text-tertiary)" }} />
                <p className="text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma notificação</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => {
                const content = (
                  <div
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                    style={{ opacity: notif.lida ? 0.5 : 1 }}
                    onClick={() => { if (!notif.lida) markRead.mutate(notif.id); setOpen(false); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: "var(--cf2-text-primary)" }}>{notif.titulo}</p>
                      {notif.mensagem && <p className="text-xs truncate mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{notif.mensagem}</p>}
                      <p className="text-[10px] mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.lida && <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: "var(--cf2-success-fill)" }} />}
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
