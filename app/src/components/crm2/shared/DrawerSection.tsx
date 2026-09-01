"use client";

/**
 * Seção solta sem card/borda pra corpo de drawer — mesmo padrão de
 * issues/details/issue-properties-panel.tsx do Circle: rótulo pequeno em
 * maiúsculas, conteúdo direto embaixo, espaçamento generoso (gap-7 no
 * container pai) faz o trabalho que antes era feito por caixas com
 * borda+fundo. Nasceu no drawer de Prospecção (claro) e foi promovido a
 * compartilhado 25/08 pra servir também o de Pipeline (escuro/chrome) —
 * `dark` troca só os tokens de cor, a estrutura é a mesma nos dois.
 */
export function Section({ title, description, action, dark = false, children }: {
  title: string; description?: string; action?: { label: string; onClick: () => void }; dark?: boolean; children: React.ReactNode;
}) {
  const muted = dark ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-tertiary)";
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: muted }}>{title}</h3>
        {action && <button onClick={action.onClick} className="text-[12px] font-medium hover:underline" style={{ color: muted }}>{action.label}</button>}
      </div>
      {description && <p className="text-[12px] -mt-1" style={{ color: muted }}>{description}</p>}
      {children}
    </div>
  );
}

export function PropertyRow({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span style={{ color: dark ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-text-tertiary)" }}>{label}</span>
      <span className="font-medium truncate max-w-[220px]" style={{ color: dark ? "var(--cf2-chrome-text-primary)" : "var(--cf2-text-primary)" }}>{value}</span>
    </div>
  );
}
