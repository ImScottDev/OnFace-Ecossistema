"use client";

import { useRouter } from "next/navigation";
import { Cf2Avatar } from "@/components/crm2/ds/Avatar";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Sparkles, Activity, Clock3, CalendarClock, Zap, CheckCircle2, Search } from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

interface FulfillmentLinha {
  id: string;
  status: string;
  service_family: string;
  started_at: string | null;
  target_at: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  lead_id: string | null;
  lead_nome: string | null;
  total_itens: number;
  itens_concluidos: number;
  itens_na: number;
  marco: string | null;
  etapa_atual: string | null;
  estado_operacional: string;
  proxima_reuniao_em: string | null;
}

interface ResumoOnboarding {
  ativas: number; aguardandoContato: number; reunioesAgendadas: number; emAndamento: number; primeiroValorAtingido: number;
}
interface Tarefa { id: string; titulo: string; venceEm: string | null; dataVencimento: string | null; leadId: string | null }
interface Reuniao { id: string; titulo: string; data: string; leadId: string | null; empresaNome?: string | null }

const ABAS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando_contato", label: "Aguardando contato" },
  { key: "reuniao_agendada", label: "Reunião agendada" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "bloqueado", label: "Bloqueados" },
  { key: "concluido", label: "Concluído" },
];
const ESTADO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  aguardando_contato: { label: "Aguardando contato", color: "var(--cf2-text-secondary)", bg: "var(--cf2-bg-surface-muted)" },
  reuniao_agendada: { label: "Reunião agendada", color: "#8e27ef", bg: "#8e27ef18" },
  em_andamento: { label: "Em andamento", color: "var(--cf2-informativo-fg)", bg: "#3b82f618" },
  aguardando_cliente: { label: "Aguardando cliente", color: "var(--cf2-warning-text)", bg: "#f59e0b18" },
  bloqueado: { label: "Bloqueado", color: "var(--cf2-danger-text)", bg: "#ef444418" },
  concluido: { label: "Concluído", color: "var(--cf2-success-text)", bg: "var(--cf2-success-bg)" },
};
const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI" };

function formatarData(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatarDataHora(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Onboarding (só Callface AI — PABX e White Label são Implantação, 25/08,
 * correção do Kauã depois de uma 1ª instrução equivocada) — ambiente de
 * trabalho real do responsável, não lista genérica: abas por estado
 * operacional real (derivado de status do fulfillment + reunião agendada
 * de verdade, nunca um campo novo), KPIs reais, e uma coluna lateral com
 * o que precisa de ação hoje (minhas tarefas + próximas reuniões).
 */
export function Cf2OnboardingWorkspace() {
  const router = useRouter();
  const { data: session } = useSession();
  const meuId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [aba, setAba] = useState("todos");
  const [busca, setBusca] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const { usuarios } = useOrgUsuarios();

  const { data, isLoading } = useQuery<{ fulfillments: FulfillmentLinha[] }>({
    queryKey: ["cf2-onboarding", responsavelId],
    queryFn: async () => {
      const params = new URLSearchParams({ familia: "ONBOARDING" });
      if (responsavelId) params.set("responsavelId", responsavelId);
      const r = await fetch(`/api/fulfillments?${params.toString()}`);
      if (!r.ok) return { fulfillments: [] };
      return r.json();
    },
  });

  const { data: resumo } = useQuery<ResumoOnboarding>({
    queryKey: ["cf2-onboarding-resumo"],
    queryFn: async () => {
      const r = await fetch("/api/fulfillments/resumo?familia=ONBOARDING");
      if (!r.ok) return { ativas: 0, aguardandoContato: 0, reunioesAgendadas: 0, emAndamento: 0, primeiroValorAtingido: 0 };
      return r.json();
    },
  });

  const { data: minhasTarefas } = useQuery<Tarefa[]>({
    queryKey: ["cf2-onboarding-minhas-tarefas", meuId],
    queryFn: async () => {
      if (!meuId) return [];
      const r = await fetch(`/api/tarefas?responsavelId=${meuId}&concluida=false`);
      if (!r.ok) return [];
      const json = await r.json();
      return (Array.isArray(json) ? json : json.tarefas ?? []).slice(0, 6);
    },
    enabled: !!meuId,
  });

  const lista = useMemo(() => data?.fulfillments ?? [], [data]);
  const leadIdsOnboarding = useMemo(() => new Set(lista.map((f) => f.lead_id).filter(Boolean)), [lista]);

  // GET /reunioes?status=agendada já só retorna reunião com status real
  // "agendada" (nunca realizada/cancelada) — a API é a fonte da verdade do
  // filtro "futuro" (grava data real de agendamento), não recalculamos
  // "agora" no componente pra manter o render puro.
  const { data: proximasReunioes } = useQuery<Reuniao[]>({
    queryKey: ["cf2-onboarding-reunioes"],
    queryFn: async () => {
      const r = await fetch("/api/reunioes?status=agendada");
      if (!r.ok) return [];
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const reunioesFiltradas = useMemo(() => {
    return (proximasReunioes ?? [])
      .filter((r) => r.leadId && leadIdsOnboarding.has(r.leadId))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 5);
  }, [proximasReunioes, leadIdsOnboarding]);

  const filtrada = lista.filter((f) => {
    if (aba !== "todos" && f.estado_operacional !== aba) return false;
    if (busca.trim() && !(f.empresa_nome || f.lead_nome || "").toLowerCase().includes(busca.trim().toLowerCase())) return false;
    return true;
  });

  const KPIS = [
    { label: "TOTAL EM ONBOARDING", valor: resumo?.ativas ?? 0, sub: "clientes ativos", icon: Activity, tone: "var(--cf2-success-text)" },
    { label: "AGUARDANDO PRIMEIRO CONTATO", valor: resumo?.aguardandoContato ?? 0, sub: "requer ação", icon: Clock3, tone: "var(--cf2-warning-text)" },
    { label: "REUNIÕES AGENDADAS", valor: resumo?.reunioesAgendadas ?? 0, sub: "próximos dias", icon: CalendarClock, tone: "#8e27ef" },
    { label: "EM ANDAMENTO", valor: resumo?.emAndamento ?? 0, sub: "em reunião/execução", icon: Zap, tone: "#3b82f6" },
    { label: "PRIMEIRO VALOR ATINGIDO", valor: resumo?.primeiroValorAtingido ?? 0, sub: "concluídos (marco)", icon: CheckCircle2, tone: "var(--cf2-success-text)" },
  ];

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <div className="flex flex-col items-stretch justify-between gap-3 shrink-0 lg:flex-row lg:items-center">
        <div>
          <p className="text-[24px] font-bold flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}><Sparkles className="w-5 h-5" style={{ color: "var(--cf2-accent-border)" }} /> Onboarding</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Gerencie todos os clientes em processo de onboarding e acompanhe a jornada até o primeiro valor.</p>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 lg:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa ou contato..." aria-label="Buscar empresa ou contato" className="w-full text-[12px] rounded-lg pl-8 pr-3 py-2 outline-none lg:w-56" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          </div>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="text-[12px] rounded-lg px-3 py-2 outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
            <option value="">Todos os responsáveis</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      </div>

      <section aria-label="Pulso do onboarding" className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] shrink-0 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]" style={{ background: "var(--cf2-bg-inverse)" }}>
        {KPIS.map((k, index) => {
          const principal = index === 0;
          return (
            <div
              key={k.label}
              className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? "border-l border-white/15" : ""} ${index >= 2 ? "border-t border-white/15 lg:border-t-0" : ""}`}
            >
              <div className="flex items-center gap-2">
                <k.icon className="h-3.5 w-3.5 shrink-0" style={{ color: principal ? "var(--cf2-accent)" : k.tone }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] truncate" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 58%, transparent)" }}>{k.label}</p>
              </div>
              <p className={`${principal ? "mt-3 text-[30px] sm:text-[36px]" : "mt-3 text-[20px]"} font-bold leading-none tabular-nums`} style={{ color: principal ? "var(--cf2-accent)" : "var(--cf2-text-on-inverse)" }}>{k.valor}</p>
              <p className="mt-2 text-[11px] truncate" style={{ color: "color-mix(in srgb, var(--cf2-text-on-inverse) 62%, transparent)" }}>{k.sub}</p>
            </div>
          );
        })}
      </section>

      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
        {ABAS.map((a) => {
          const ativo = aba === a.key;
          const n = a.key === "todos" ? lista.length : lista.filter((f) => f.estado_operacional === a.key).length;
          return (
            <button key={a.key} onClick={() => setAba(a.key)} className="text-[12px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0" style={{ background: ativo ? "var(--cf2-accent-bg)" : "var(--cf2-bg-surface-muted)", color: ativo ? "var(--cf2-accent-border)" : "var(--cf2-text-secondary)" }}>
              {a.label}{n > 0 ? ` (${n})` : ""}
            </button>
          );
        })}
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:overflow-hidden">
        <div className="rounded-2xl flex flex-col overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-[13px] p-4" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
            ) : filtrada.length === 0 ? (
              <p className="text-[13px] p-4" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum onboarding nesse filtro.</p>
            ) : (
              filtrada.map((f) => {
                const badge = ESTADO_BADGE[f.estado_operacional] ?? ESTADO_BADGE.aguardando_contato;
                const pct = f.total_itens > 0 ? Math.round(((f.itens_concluidos + f.itens_na) / f.total_itens) * 100) : 0;
                return (
                  <div
                    key={f.id}
                    onClick={() => router.push(`/clientes/onboarding/${f.id}`)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
                  >
                    <Cf2Avatar nome={f.empresa_nome || f.lead_nome} tipo="empresa" size="lg" />
                    <div className="min-w-0 flex-1" style={{ maxWidth: 200 }}>
                      <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{f.empresa_nome || f.lead_nome || "—"}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{FAMILIA_LABEL[f.service_family] ?? f.service_family}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0 w-[140px] text-center" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                    <div className="hidden md:block shrink-0" style={{ width: 110 }}>
                      <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Responsável</p>
                      <p className="text-[11px] font-semibold truncate" style={{ color: "var(--cf2-text-secondary)" }}>{f.responsavel_nome || "—"}</p>
                    </div>
                    <div className="hidden lg:block shrink-0" style={{ width: 160 }}>
                      <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Próxima ação</p>
                      <p className="text-[11px] font-semibold truncate" style={{ color: "var(--cf2-text-secondary)" }}>{f.etapa_atual || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" style={{ width: 90 }}>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cf2-success-text)" }} />
                      </div>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>{pct}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0 xl:overflow-y-auto">
          <div className="rounded-2xl p-3.5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[11px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Minhas tarefas {minhasTarefas?.length ? `(${minhasTarefas.length})` : ""}</p>
            {(minhasTarefas ?? []).length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada pendente.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {minhasTarefas!.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <p className="text-[11px] truncate flex-1" style={{ color: "var(--cf2-text-secondary)" }}>{t.titulo}</p>
                    <span className="text-[10px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarData(t.venceEm || t.dataVencimento)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-3.5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[11px] font-bold mb-2" style={{ color: "var(--cf2-text-primary)" }}>Próximas reuniões</p>
            {reunioesFiltradas.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem reunião agendada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reunioesFiltradas.map((r) => (
                  <div key={r.id} className="flex flex-col gap-0.5">
                    <p className="text-[11px] font-semibold truncate" style={{ color: "var(--cf2-text-secondary)" }}>{r.titulo}</p>
                    <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarDataHora(r.data)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Como funciona o onboarding</p>
            <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>O onboarding nasce automaticamente quando um negócio de Callface AI vira Ganho, e conduz o cliente do primeiro contato até o primeiro valor, seguindo o roteiro real do Guia de Treinamento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
