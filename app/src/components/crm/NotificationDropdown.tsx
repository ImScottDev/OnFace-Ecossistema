"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ExternalLink, Users, AlertTriangle, Shield, Trophy, Clock, CreditCard, CalendarX } from "lucide-react";
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

const TIPO_ICONS: Record<string, typeof Bell> = {
  novo_lead: Users,
  sla_alerta: AlertTriangle,
  sistema: Shield,
  negocio_ganho: Trophy,
  followup_proposta: Clock,
  no_show: CalendarX,
  pagamento_pendente: CreditCard,
  pagamento_falhou: CreditCard,
  pagamento_pos_expiracao: CreditCard,
  cobranca_falhou: CreditCard,
};

// Disciplina de cor (ref. 21/07): cor SÓ com significado de status —
// ganho=lima, atenção=âmbar, perigo=vermelho; o resto fica neutro.
const TIPO_COLORS: Record<string, string> = {
  novo_lead: "#9CA3AF",
  sla_alerta: "#F59E0B",
  sistema: "#9CA3AF",
  negocio_ganho: "#c8ff00",
  followup_proposta: "#F59E0B",
  no_show: "#F59E0B",
  pagamento_pendente: "#F59E0B",
  pagamento_falhou: "#EF4444",
  pagamento_pos_expiracao: "#F59E0B",
  cobranca_falhou: "#EF4444",
};

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Filter out whatsapp_msg — unread WA counts are shown in sidebar badge instead
  const notifications: Notification[] = (data?.notificacoes ?? []).filter((n: Notification) => n.tipo !== "whatsapp_msg");
  const unreadCount = notifications.filter((n) => !n.lida).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notificacoes/${id}`, { method: "PATCH" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.lida);
      await Promise.all(unread.map((n) => fetch(`/api/notificacoes/${n.id}`, { method: "PATCH" })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: "#EF4444" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 right-0 w-80 rounded-xl border border-white/[0.08] shadow-2xl z-50 overflow-hidden"
          style={{ background: "var(--bg-elevated)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/30">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => {
                const Icon = TIPO_ICONS[notif.tipo] || Bell;
                const color = TIPO_COLORS[notif.tipo] || "#6B7280";

                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      notif.lida
                        ? "opacity-50 hover:opacity-70"
                        : "hover:bg-white/[0.04]"
                    }`}
                    onClick={() => {
                      if (!notif.lida) markRead.mutate(notif.id);
                      setOpen(false);
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${color}15` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{notif.titulo}</p>
                      {notif.mensagem && (
                        <p className="text-xs text-white/40 truncate mt-0.5">{notif.mensagem}</p>
                      )}
                      <p className="text-[10px] text-white/25 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.lida && (
                      <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: color }} />
                    )}
                    {notif.link && (
                      <ExternalLink className="w-3 h-3 text-white/20 shrink-0 mt-2" />
                    )}
                  </div>
                );

                return notif.link ? (
                  <Link key={notif.id} href={notif.link}>
                    {content}
                  </Link>
                ) : (
                  <div key={notif.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
