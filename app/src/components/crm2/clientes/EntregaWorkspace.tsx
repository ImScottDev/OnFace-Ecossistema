"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Truck, Activity, Hourglass, UserRound, Lock, CheckCircle2, CalendarClock } from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

interface FulfillmentLinha {
  id: string;
  status: string;
  service_family: string;
  started_at: string | null;
  target_at: string | null;
  responsavel_nome: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  total_itens: number;
  itens_concluidos: number;
  fase: "planejamento" | "preparacao" | "execucao" | "validacao" | "concluida" | null;
  etapa_atual: string | null;
}

interface ResumoFulfillments {
  ativas: number; ativasNovas30d: number; emAndamento: number; aguardandoCliente: number; bloqueadas: number;
  concluidasMes: number; concluidasMesAnterior: number; prazoMedioDias: number | null;
  familias: Record<string, number>;
  cargaEquipe: { responsavel_id: string | null; responsavel_nome: string | null; n: number }[];
}

// Colunas do Kanban de Implantação PABX — nomes/ordem batem com
// FASE_PABX_POR_WORKSTREAM (lib/crm/fulfillment.ts), derivado do checklist
// real, nunca um campo editável à parte.
const FASE_COLUNAS: { key: "planejamento" | "preparacao" | "execucao" | "validacao" | "concluida"; label: string; sub: string }[] = [
  { key: "planejamento", label: "Planejamento", sub: "Definição e alinhamento" },
  { key: "preparacao", label: "Preparação", sub: "Configuração e ambiente" },
  { key: "execucao", label: "Execução", sub: "Implantação em andamento" },
  { key: "validacao", label: "Validação", sub: "Testes e aprovação" },
  { key: "concluida", label: "Concluída", sub: "Implantação finalizada" },
];

const FAMILIA_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  BLOCKED_CUSTOMER: "Aguardando cliente",
  BLOCKED_INTERNAL: "Bloqueio interno",
  BLOCKED_PROVIDER: "Bloqueio (operadora)",
  READY_FOR_VALIDATION: "Pronto pra validação",
  COMPLETED: "Concluído",
};
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  NOT_STARTED: { bg: "var(--cf2-bg-surface-muted)", text: "var(--cf2-text-tertiary)" },
  IN_PROGRESS: { bg: "#3b82f618", text: "#3b82f6" },
  BLOCKED_CUSTOMER: { bg: "#f59e0b18", text: "#f59e0b" },
  BLOCKED_INTERNAL: { bg: "#ef444418", text: "#ef4444" },
  BLOCKED_PROVIDER: { bg: "#ef444418", text: "#ef4444" },
  READY_FOR_VALIDATION: { bg: "#8e27ef18", text: "#8e27ef" },
  COMPLETED: { bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)" },
};

/**
 * Clientes → Implantação (PABX) / Onboarding (Callface AI) (19/08 → 20/08
 * dividido em 2 módulos próprios, pedido explícito do Kauã — "Entrega"
 * combinada virou 2 abas reais no nível do módulo Clientes, mesmo padrão
 * das outras telas). Won terminou o comercial; isso é o processo de
 * implantação/onboarding, nunca uma etapa do Pipeline (correção do erro
 * do legado "Delivery PABX" como Stage de Deal).
 *
 * `familiaFixa` trava a família (a página já é dedicada, sem dropdown de
 * família pra escolher) — sem isso, mostra o seletor e cobre as 3
 * famílias juntas (uso interno, não mais linkado nos tabs do módulo).
 */
export function Cf2EntregaWorkspace({ familiaFixa }: { familiaFixa?: "PABX" | "CALLFACE_AI" | "WHITE_LABEL" } = {}) {
  const router = useRouter();
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [familia, setFamilia] = useState(familiaFixa ?? "");
  const [responsavelId, setResponsavelId] = useState("");
  const { usuarios } = useOrgUsuarios();

  const { data, isLoading } = useQuery<{ fulfillments: FulfillmentLinha[] }>({
    queryKey: ["cf2-entrega", mostrarTodos, familia, responsavelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mostrarTodos) params.set("status", "all");
      if (familia) params.set("familia", familia);
      if (responsavelId) params.set("responsavelId", responsavelId);
      const qs = params.toString();
      const r = await fetch(`/api/fulfillments${qs ? `?${qs}` : ""}`);
      if (!r.ok) return { fulfillments: [] };
      return r.json();
    },
  });

  const lista = data?.fulfillments ?? [];
  // Aguardando cliente (espera normal, do lado do cliente) é uma coisa
  // diferente de bloqueio interno/provedor (aí sim precisa de ação nossa) —
  // achado real olhando a referência de UX: misturar os dois num
  // "BLOQUEADOS" genérico esconde qual entrega precisa de atenção de
  // verdade vs. qual só está esperando o cliente responder.
  const aguardandoCliente = lista.filter((f) => f.status === "BLOCKED_CUSTOMER").length;
  const comBloqueio = lista.filter((f) => f.status === "BLOCKED_INTERNAL" || f.status === "BLOCKED_PROVIDER").length;

  const { data: resumo } = useQuery<ResumoFulfillments>({
    queryKey: ["cf2-fulfillments-resumo", familiaFixa],
    queryFn: async () => {
      const qs = familiaFixa ? `?familia=${familiaFixa}` : "";
      const r = await fetch(`/api/fulfillments/resumo${qs}`);
      if (!r.ok) return { ativas: 0, ativasNovas30d: 0, emAndamento: 0, aguardandoCliente: 0, bloqueadas: 0, concluidasMes: 0, concluidasMesAnterior: 0, prazoMedioDias: null, familias: {}, cargaEquipe: [] };
      return r.json();
    },
  });

  if (familiaFixa === "PABX") {
    return <KanbanImplantacaoPabx lista={lista} isLoading={isLoading} resumo={resumo} router={router} responsavelId={responsavelId} setResponsavelId={setResponsavelId} usuarios={usuarios} />;
  }

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{familiaFixa ? FAMILIA_LABEL[familiaFixa] : "Entrega"}</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
            {familiaFixa === "PABX" ? "Implantação PABX em andamento — nasce automaticamente após o Won." : familiaFixa === "CALLFACE_AI" ? "Onboarding Callface AI em andamento — nasce automaticamente após o Won." : "Implantação/onboarding em andamento — nasce automaticamente após o Won, checklist real por família."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!familiaFixa && (
            <select
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
              className="text-[12px] rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <option value="">Todos os serviços</option>
              {Object.entries(FAMILIA_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          )}
          <select
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            className="text-[12px] rounded-lg px-3 py-2 outline-none"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
          >
            <option value="">Todos os responsáveis</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <button onClick={() => setMostrarTodos((v) => !v)} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
            {mostrarTodos ? "Ver só em andamento" : "Ver todos (incl. concluídos)"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: "EM ANDAMENTO", valor: lista.filter((f) => f.status !== "COMPLETED").length, alerta: false },
          { label: "AGUARDANDO CLIENTE", valor: aguardandoCliente, alerta: false },
          { label: "COM BLOQUEIO", valor: comBloqueio, alerta: true },
          { label: "CONCLUÍDOS (visão atual)", valor: lista.filter((f) => f.status === "COMPLETED").length, alerta: false },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1.5 p-3.5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{k.label}</p>
            <p className="text-[22px] font-bold" style={{ color: k.alerta && k.valor > 0 ? "var(--cf2-danger-text)" : "var(--cf2-text-primary)" }}>{k.valor}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        {isLoading ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma entrega em andamento.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
                {["Empresa", "Família", "Progresso", "Responsável", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => {
                const cor = STATUS_COLOR[f.status] || STATUS_COLOR.NOT_STARTED;
                return (
                  <tr key={f.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }} onClick={() => router.push(`/clientes/entrega/${f.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-inverse)" }}>
                          <Truck className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{f.empresa_nome || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{FAMILIA_LABEL[f.service_family] || f.service_family}</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{f.itens_concluidos}/{f.total_itens} etapas</td>
                    <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{f.responsavel_nome || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: cor.bg, color: cor.text }}>{STATUS_LABEL[f.status] || f.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function iniciais(nome: string | null) {
  if (!nome) return "—";
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function formatarData(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Kanban de Implantação PABX (referência de UX, 19/08) — 5 fases derivadas
 * do checklist real (ver FASE_PABX_POR_WORKSTREAM), nunca um campo/state
 * machine novo. Card abre o mesmo drawer/página de detalhe que já existe
 * (`/clientes/entrega/:id`) — não há "arrastar card" porque a fase não é
 * gravável direto, ela reflete qual item do checklist ainda não foi
 * concluído (mudar de fase = concluir o item lá dentro).
 *
 * KPIs "Implantações por prioridade" e "Atividades pendentes" da referência
 * NÃO foram implementados de propósito: não existe campo de prioridade em
 * `fulfillments` (decisão de negócio em aberto — o que definiria prioridade?
 * valor do contrato? SLA? dias em atraso?) nem due date por item de
 * checklist (só `target_at` no fulfillment todo). Widget de "Próximos
 * vencimentos" abaixo cobre o sinal real que existe (target_at).
 */
function KanbanImplantacaoPabx({
  lista, isLoading, resumo, router, responsavelId, setResponsavelId, usuarios,
}: {
  lista: FulfillmentLinha[];
  isLoading: boolean;
  resumo: ResumoFulfillments | undefined;
  router: ReturnType<typeof useRouter>;
  responsavelId: string;
  setResponsavelId: (v: string) => void;
  usuarios: { id: string; nome: string }[];
}) {
  const concluidasDeltaPct = resumo && resumo.concluidasMesAnterior > 0
    ? Math.round(((resumo.concluidasMes - resumo.concluidasMesAnterior) / resumo.concluidasMesAnterior) * 100)
    : null;

  const KPIS = [
    { label: "IMPLANTAÇÕES ATIVAS", valor: resumo?.ativas ?? 0, sub: resumo ? `+${resumo.ativasNovas30d} este mês` : null, icon: Activity, tone: "var(--cf2-success-text)" },
    { label: "EM ANDAMENTO", valor: resumo?.emAndamento ?? 0, sub: resumo && resumo.ativas > 0 ? `${Math.round((resumo.emAndamento / resumo.ativas) * 100)}% do total` : null, icon: Hourglass, tone: "#3b82f6" },
    { label: "AGUARDANDO CLIENTE", valor: resumo?.aguardandoCliente ?? 0, sub: resumo && resumo.ativas > 0 ? `${Math.round((resumo.aguardandoCliente / resumo.ativas) * 100)}% do total` : null, icon: UserRound, tone: "#f59e0b" },
    { label: "BLOQUEADAS", valor: resumo?.bloqueadas ?? 0, sub: resumo && resumo.ativas > 0 ? `${Math.round((resumo.bloqueadas / resumo.ativas) * 100)}% do total` : null, icon: Lock, tone: "var(--cf2-danger-text)" },
    { label: "CONCLUÍDAS (MÊS)", valor: resumo?.concluidasMes ?? 0, sub: concluidasDeltaPct !== null ? `${concluidasDeltaPct >= 0 ? "+" : ""}${concluidasDeltaPct}% vs mês anterior` : null, icon: CheckCircle2, tone: "var(--cf2-success-text)" },
    { label: "PRAZO MÉDIO", valor: resumo?.prazoMedioDias != null ? `${resumo.prazoMedioDias}d` : "—", sub: "dias para conclusão", icon: CalendarClock, tone: "var(--cf2-text-primary)" },
  ];

  const porFase = new Map<string, FulfillmentLinha[]>();
  for (const col of FASE_COLUNAS) porFase.set(col.key, []);
  for (const f of lista) {
    if (!f.fase) continue;
    porFase.get(f.fase)?.push(f);
  }

  const proximosVencimentos = [...lista]
    .filter((f) => f.target_at)
    .sort((a, b) => new Date(a.target_at!).getTime() - new Date(b.target_at!).getTime())
    .slice(0, 6);

  const totalFamilias = Object.values(resumo?.familias ?? {}).reduce((s, n) => s + n, 0);

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>PABX</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Implantação PABX em andamento — nasce automaticamente após o Won.</p>
        </div>
        <select
          value={responsavelId}
          onChange={(e) => setResponsavelId(e.target.value)}
          className="text-[12px] rounded-lg px-3 py-2 outline-none"
          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
        >
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-6 gap-3 shrink-0">
        {KPIS.map((k) => (
          <div key={k.label} className="flex flex-col gap-1.5 p-3.5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{k.label}</p>
              <k.icon className="w-3.5 h-3.5 shrink-0" style={{ color: k.tone }} />
            </div>
            <p className="text-[20px] font-bold" style={{ color: k.tone }}>{k.valor}</p>
            {k.sub && <p className="text-[10px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-5 gap-3 overflow-x-auto">
          {FASE_COLUNAS.map((col) => {
            const cards = porFase.get(col.key) ?? [];
            return (
              <div key={col.key} className="flex flex-col gap-2 min-w-[220px] rounded-2xl p-2.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <div className="px-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{col.label}</p>
                    <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>{cards.length}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{col.sub}</p>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {cards.map((f) => {
                    const pct = f.total_itens > 0 ? Math.round((f.itens_concluidos / f.total_itens) * 100) : 0;
                    return (
                      <div
                        key={f.id}
                        onClick={() => router.push(`/clientes/entrega/${f.id}`)}
                        className="cursor-pointer flex flex-col gap-2 p-3 rounded-xl"
                        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
                      >
                        <p className="text-[12px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{f.empresa_nome || "—"}</p>
                        <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{f.etapa_atual || "—"}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cf2-success-text)" }} />
                          </div>
                          <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{pct}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center justify-center rounded-full w-5 h-5 text-[9px] font-bold text-white shrink-0" style={{ background: "var(--cf2-bg-inverse)" }}>{iniciais(f.responsavel_nome)}</div>
                            <span className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>{f.responsavel_nome || "Sem responsável"}</span>
                          </div>
                          {f.target_at && <span className="text-[10px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarData(f.target_at)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && <p className="text-[11px] px-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>Vazio</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 shrink-0">
        <div className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[12px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Tipos de implantação</p>
          <div className="flex flex-col gap-2">
            {Object.entries(resumo?.familias ?? {}).map(([fam, n]) => (
              <div key={fam} className="flex items-center gap-2">
                <span className="text-[11px] flex-1" style={{ color: "var(--cf2-text-secondary)" }}>{FAMILIA_LABEL[fam] || fam}</span>
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <div className="h-full rounded-full" style={{ width: `${totalFamilias > 0 ? (n / totalFamilias) * 100 : 0}%`, background: "var(--cf2-bg-inverse)" }} />
                </div>
                <span className="text-[11px] font-bold w-6 text-right" style={{ color: "var(--cf2-text-primary)" }}>{n}</span>
              </div>
            ))}
            {totalFamilias === 0 && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem dado.</p>}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[12px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Carga da equipe (ativas)</p>
          <div className="flex flex-col gap-2">
            {(resumo?.cargaEquipe ?? []).map((c) => (
              <div key={c.responsavel_id ?? "sem_dono"} className="flex items-center gap-2">
                <span className="text-[11px] flex-1 truncate" style={{ color: "var(--cf2-text-secondary)" }}>{c.responsavel_nome || "Sem responsável"}</span>
                <span className="text-[11px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{c.n}</span>
              </div>
            ))}
            {(resumo?.cargaEquipe ?? []).length === 0 && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem dado.</p>}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[12px] font-bold mb-3" style={{ color: "var(--cf2-text-primary)" }}>Próximos vencimentos</p>
          <div className="flex flex-col gap-2">
            {proximosVencimentos.map((f) => (
              <div key={f.id} className="flex items-center gap-2 cursor-pointer" onClick={() => router.push(`/clientes/entrega/${f.id}`)}>
                <span className="text-[11px] font-semibold w-10 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{formatarData(f.target_at)}</span>
                <span className="text-[11px] flex-1 truncate" style={{ color: "var(--cf2-text-secondary)" }}>{f.empresa_nome || "—"}</span>
                <span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{FASE_COLUNAS.find((c) => c.key === f.fase)?.label ?? "—"}</span>
              </div>
            ))}
            {proximosVencimentos.length === 0 && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem dado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
