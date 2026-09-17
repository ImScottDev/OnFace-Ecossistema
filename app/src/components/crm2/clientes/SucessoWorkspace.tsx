"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, HeartPulse, X } from "lucide-react";

export interface Conta {
  id: string;
  nome: string;
  faturas_atrasadas: number;
  valor_atrasado: string;
  ultima_atividade: string | null;
  dias_sem_atividade: number | null;
  sem_proxima_acao: boolean;
  nps_score: number | null;
  nps_respondido_em: string | null;
}

function brl(v: string | number) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Mesma régua do playbook de CS (verde 7-10 / amarelo 5-6 / vermelho 0-4) — NPS é resposta real do cliente, não score composto fabricado. */
export function faixaNps(score: number): "verde" | "amarelo" | "vermelho" {
  if (score >= 7) return "verde";
  if (score >= 5) return "amarelo";
  return "vermelho";
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
  if (c.nps_score !== null && c.nps_score <= 6) m.push(`Health Check NPS ${c.nps_score} · ${faixaNps(c.nps_score) === "vermelho" ? "risco" : "atenção"}`);
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
  const qc = useQueryClient();
  const [healthCheckAlvo, setHealthCheckAlvo] = useState<Conta | null>(null);

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
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Fila de atenção — cobrança/recovery e Health Check são prioridade imediata. Motivo real sempre explicado, nunca um score sozinho.</p>
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : contas.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma conta precisando de atenção agora.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {contas.map((c) => {
            const faixa = c.nps_score !== null ? faixaNps(c.nps_score) : null;
            const corFaixa = faixa === "vermelho" ? "#ef4444" : faixa === "amarelo" ? "var(--cf2-warning-text)" : faixa === "verde" ? "var(--cf2-success-text)" : null;
            return (
              <div key={c.id} className="p-4 rounded-2xl flex items-center justify-between gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => router.push(`/clientes/${c.id}`)}>
                  <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: c.valor_atrasado && Number(c.valor_atrasado) > 0 ? "#ef444418" : "var(--cf2-warning-bg)" }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: c.valor_atrasado && Number(c.valor_atrasado) > 0 ? "#ef4444" : "var(--cf2-warning-text)" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{c.nome}</p>
                      {corFaixa && <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: corFaixa }} title={`NPS ${c.nps_score}`} />}
                    </div>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {motivos(c).map((m, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setHealthCheckAlvo(c)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0"
                  style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
                >
                  <HeartPulse className="w-3.5 h-3.5" /> Health Check
                </button>
              </div>
            );
          })}
        </div>
      )}

      {healthCheckAlvo && (
        <HealthCheckModal
          conta={healthCheckAlvo}
          onClose={() => setHealthCheckAlvo(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["cf2-clientes-sucesso"] }); setHealthCheckAlvo(null); }}
        />
      )}
    </div>
  );
}

/**
 * Registro ao vivo de Health Check (24/08) — o CS liga/manda WhatsApp pro
 * cliente com o script real ("em uma escala de 0 a 10...") e registra a
 * resposta aqui na hora. Mesmas perguntas do playbook: nota + o que faria
 * subir 1 ponto. Nada de survey automático por e-mail nesta v1 — não existe
 * canal de disparo configurado, e o valor real está na conversa ao vivo.
 */
function HealthCheckModal({ conta, onClose, onSaved }: { conta: Conta; onClose: () => void; onSaved: () => void }) {
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clientes-crm2/${conta.id}/health-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comentario: comentario.trim() || undefined }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Erro ao registrar Health Check");
      return body;
    },
    onSuccess: () => { toast.success("Health Check registrado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Health Check — {conta.nome}</p>
          <button onClick={onClose} style={{ color: "var(--cf2-text-tertiary)" }} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--cf2-text-secondary)" }}>&quot;Em uma escala de 0 a 10, quanto você indicaria a Callface hoje?&quot;</p>

        <div className="flex gap-1.5 mb-4 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              onClick={() => setScore(n)}
              className="w-8 h-8 rounded-lg text-[12px] font-bold"
              style={{
                background: score === n ? (faixaNps(n) === "vermelho" ? "#ef4444" : faixaNps(n) === "amarelo" ? "var(--cf2-warning-text)" : "var(--cf2-success-text)") : "var(--cf2-bg-surface-muted)",
                color: score === n ? "#fff" : "var(--cf2-text-secondary)",
              }}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>O que faria essa nota subir 1 ponto? (opcional)</label>
        <textarea
          value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3}
          className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-y mb-4"
          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          placeholder="Dores, contexto da conversa..." aria-label="Dores, contexto da conversa"
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button
            onClick={() => salvar.mutate()}
            disabled={score === null || salvar.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            {salvar.isPending ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
