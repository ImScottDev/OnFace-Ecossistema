"use client";

import { Inbox, AlertTriangle, ShieldOff } from "lucide-react";

export function Cf2Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: "var(--cf2-bg-surface-muted)" }}
    />
  );
}

export function Cf2EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <Inbox className="w-8 h-8" style={{ color: "var(--cf2-text-tertiary)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--cf2-text-primary)" }}>{title}</p>
      {description && <p className="text-xs max-w-xs" style={{ color: "var(--cf2-text-secondary)" }}>{description}</p>}
    </div>
  );
}

export function Cf2ErrorState({ message = "Não foi possível carregar este dado." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 py-4 px-3 rounded-lg" style={{ background: "var(--cf2-warning-bg)" }}>
      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-warning-text)" }} />
      <p className="text-xs" style={{ color: "var(--cf2-warning-text)" }}>{message}</p>
    </div>
  );
}

/**
 * Estado explícito pra métrica sem fonte de dado confiável — princípio do
 * Kauã (09/08): "se o CRM não consegue provar o número através de uma fonte
 * confiável, ele não deve apresentar o número como verdade". Usado em vez
 * de qualquer fórmula inventada (ex: taxa de abertura de e-mail, resposta
 * de WhatsApp sem regra formalizada).
 */
export function Cf2UnavailableMetric({ reason }: { reason: string }) {
  return (
    <div className="flex items-center gap-1.5" title={reason}>
      <ShieldOff className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
      <span className="text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Indisponível</span>
    </div>
  );
}

/** Estado explícito de acesso negado — RBAC por tela ainda não formalizado (ver Crm2Layout), mas nenhuma tela deve fingir dado que o usuário não tem permissão de ver. */
export function Cf2PermissionDenied({ message = "Você não tem permissão para ver este conteúdo." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <ShieldOff className="w-8 h-8" style={{ color: "var(--cf2-danger-border)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--cf2-text-primary)" }}>Acesso restrito</p>
      <p className="text-xs max-w-xs" style={{ color: "var(--cf2-text-secondary)" }}>{message}</p>
    </div>
  );
}
