"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CalendarX2, Check, CircleAlert, CircleCheck, ClipboardCheck, Clock,
  FileSignature, PackagePlus, Receipt, ShieldAlert, Trophy, UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

/** The identity slot of each row.
 *
 * The reference pattern puts a person's avatar here, but `notificacoes` has no
 * actor column — `usuario_id` is the recipient, not the author — so there is no
 * real face to show. Rather than invent one, the slot carries the event type,
 * which is real data, and the tone carries whether it is good or bad news. */
const TIPO_FIGURE: Record<string, { icon: LucideIcon; tone: "neutral" | "accent" | "success" | "danger" }> = {
  lead: { icon: UserPlus, tone: "accent" },
  negocio_ganho: { icon: Trophy, tone: "success" },
  contrato_assinado: { icon: FileSignature, tone: "success" },
  pagamento_confirmado: { icon: CircleCheck, tone: "success" },
  pagamento_falhou: { icon: CircleAlert, tone: "danger" },
  pagamento_pendente: { icon: Clock, tone: "neutral" },
  cobranca_avulsa_gerada: { icon: Receipt, tone: "neutral" },
  no_show: { icon: CalendarX2, tone: "danger" },
  validacao_manual_necessaria: { icon: ShieldAlert, tone: "danger" },
  fulfillment_criado: { icon: PackagePlus, tone: "accent" },
  fulfillment_formulario_recebido: { icon: ClipboardCheck, tone: "accent" },
  formulario_implantacao_recebido: { icon: ClipboardCheck, tone: "accent" },
};

function figureFor(tipo: string) {
  return TIPO_FIGURE[tipo] ?? { icon: Bell, tone: "neutral" as const };
}

// Mesma fonte de dado do NotificationDropdown (dark, legado) — UI própria
// pro tema claro da V2, mesmo endpoint/mutations reais.
// Achado real 25/08 (Kauã: "fundo branco do nada" na tela de Propostas,
// escura) — o painel ABERTO era sempre claro independente de `variant`,
// só o sino fechado respeitava. Corrigido: painel também segue `variant`.
export function Cf2NotificationBell({ variant = "light" }: { variant?: "light" | "dark" | "onface" }) {
  const dark = variant === "dark";
  const onface = variant === "onface";
  const bg = dark ? "var(--cf2-chrome-bg)" : "var(--cf2-bg-surface)";
  const border = dark ? "var(--cf2-chrome-border-subtle)" : "var(--cf2-border-default)";
  const textPrimary = dark ? "var(--cf2-chrome-text-primary)" : "var(--cf2-text-primary)";
  const textSecondary = dark ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-secondary)";
  const hoverBg = dark ? "rgba(255,255,255,0.08)" : "var(--cf2-bg-surface-muted)";
  const unreadColor = "var(--cf2-success-fill)";
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
    if (onface) return; // o Popover do Radix já gerencia dismiss, foco e Escape
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, onface]);

  const ariaLabel = unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações";

  // ── ONFACE ────────────────────────────────────────────────────────────
  // Superfície própria do shell escuro, ancorada por Popover real: a lista
  // carrega slot de identidade, hierarquia de duas linhas e alvo de toque.
  if (onface) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="onface-utility relative" aria-label={ariaLabel}>
          <Bell aria-hidden />
          {/* O ponto existe sempre e some por CSS. Renderizar condicionalmente
              mudava a árvore entre servidor (sem contagem) e cliente (com
              contagem vinda do react-query), o que deslocava os `useId` dos
              menus seguintes e fazia o React acusar hidratação a cada carga. */}
          <span className="onface-notif-dot-indicator" data-visivel={unreadCount > 0} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="onface-notif">
          <header className="onface-notif-head">
            <span className="onface-notif-title">
              Notificações
              {unreadCount > 0 && <span className="onface-notif-count">{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="onface-notif-action"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                {markAllRead.isPending ? "Marcando…" : "Marcar todas como lidas"}
              </button>
            )}
          </header>

          <div className="onface-notif-list">
            {notifications.length === 0 ? (
              <div className="onface-notif-empty">
                <Check aria-hidden />
                <p>Tudo em dia</p>
                <small>Novos eventos da operação aparecem aqui.</small>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => {
                const { icon: Figure, tone } = figureFor(notif.tipo);
                const body = (
                  <>
                    <span className="onface-notif-figure" data-tone={tone} aria-hidden>
                      <Figure />
                    </span>
                    <span className="onface-notif-body">
                      <span className="onface-notif-item-title">{notif.titulo}</span>
                      {notif.mensagem && <span className="onface-notif-item-copy">{notif.mensagem}</span>}
                      <time className="onface-notif-item-time" dateTime={notif.createdAt}>
                        {timeAgo(notif.createdAt)}
                      </time>
                    </span>
                    {!notif.lida && <span className="onface-notif-dot" aria-label="Não lida" />}
                  </>
                );
                const onActivate = () => {
                  if (!notif.lida) markRead.mutate(notif.id);
                  setOpen(false);
                };
                return notif.link ? (
                  <Link
                    key={notif.id}
                    href={notif.link}
                    className="onface-notif-item"
                    data-read={notif.lida}
                    onClick={onActivate}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={notif.id}
                    type="button"
                    className="onface-notif-item"
                    data-read={notif.lida}
                    onClick={onActivate}
                  >
                    {body}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // ── Legado light/dark (telas CRM2 já certificadas) ────────────────────
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={ariaLabel}
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
            style={{ background: unreadColor }}
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
                    {!notif.lida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: unreadColor }} />}
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
