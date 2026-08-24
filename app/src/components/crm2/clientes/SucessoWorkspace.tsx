"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export interface Conta {
  id: string;
  nome: string;
  faturas_atrasadas: number;
  valor_atrasado: string;
  ultima_atividade: string | null;
  dias_sem_atividade: number | null;
  sem_proxima_acao: boolean;
}

function brl(v: string | number) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Exportado pro CS embutido no Cliente 360 (reestruturação 20/08) — MESMO
// critério/motivo real usado na fila de atenção cross-cliente, nunca uma
// segunda lógica pra "explicar" o sinal de um cliente específico.
export function motivos(c: Conta): string[] {
  const m: string[] = [];
  if (c.faturas_atrasadas > 0) m.push(`${c.faturas_atrasadas} fatura${c.faturas_atrasadas > 1 ? "s" : ""} atrasada${c.faturas_atrasadas > 1 ? "s" : ""} (${brl(c.valor_atrasado)})`);
  if (c.dias_sem_atividade === null) m.push("Nenhuma atividade registrada");
  else if (c.dias_sem_atividade >= 14) m.push(`${c.dias_sem_atividade} dias sem atividade`);
  if (c.sem_proxima_acao) m.push("Sem próxima ação agendada");
  return m;
}

/**
 * Clientes → CS (rota legada `/clientes/sucesso`, 19/08) — prioridade real do CS é visibilidade de
 * cobrança/recovery, não Health Score (regra fechada do projeto: nunca
 * inventar score 0-100, sempre motivo explicável). Sinais usados são só os
 * que existem de verdade hoje: fatura atrasada, dias sem atividade, sem
 * próxima ação. Usage (Mixpanel) fica de fora até existir credencial —
 * não fabricado.
 */
export function Cf2SucessoWorkspace() {
  const router = useRouter();
  const { data, isLoading } = useQuery<{ contas: Conta[] }>({
    queryKey: ["cf2-clientes-sucesso"],
    queryFn: async () => {
      const r = await fetch("/api/clientes-crm2/sucesso");
      if (!r.ok) return { contas: [] };
      return r.json();
    },
  });

  const contas = data?.contas ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>CS</p>
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Fila de atenção — cobrança/recovery é prioridade imediata. Motivo real sempre explicado, nunca um score sozinho.</p>
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : contas.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma conta precisando de atenção agora.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {contas.map((c) => (
            <div key={c.id} className="p-4 rounded-2xl flex items-center justify-between cursor-pointer" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }} onClick={() => router.push(`/clientes/${c.id}`)}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: c.valor_atrasado && Number(c.valor_atrasado) > 0 ? "#ef444418" : "var(--cf2-warning-bg)" }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: c.valor_atrasado && Number(c.valor_atrasado) > 0 ? "#ef4444" : "var(--cf2-warning-text)" }} />
                </div>
                <div>
                  <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{c.nome}</p>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {motivos(c).map((m, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
