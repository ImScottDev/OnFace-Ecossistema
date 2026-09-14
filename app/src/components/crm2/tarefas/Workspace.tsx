"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Building2, Check, Plus, Trash2, UserRound } from "lucide-react";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2EmptyState, Cf2Skeleton } from "@/components/crm2/ui/States";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { iniciaisEmpresa, corAvatarEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { TarefaFormModal, tipoLabel, TIPO_TAREFA_OPTIONS, type Tarefa as TarefaLegado } from "@/components/crm/tarefas/TarefaFormModal";
import { useMe } from "@/lib/useMe";
import { isPersonalView } from "@/lib/auth/roles";

/**
 * Tarefas — migrada do shell legado `(crm)/tarefas` (08/09/2026).
 *
 * A tela antiga era um grid de 4 StatCards + donut + lista chapada, e sofria
 * de um problema de DADO, não só de visual: as tarefas de CS nascem no eixo
 * EMPRESA e ela só sabia mostrar lead e negócio. Uma tarefa "Fatura vencida
 * em aberto" aparecia pendurada no lead que originou a venda, ou sem
 * contexto nenhum quando o cliente não tinha lead.
 *
 * Aqui a linha mostra a entidade certa por origem: cliente pra tarefa de CS,
 * lead/negócio pra tarefa comercial. E separa o que foi criado por pessoa do
 * que o motor gerou — trabalho gerado se acumula diferente e precisa ser
 * visto separado.
 */

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  dataVencimento: string | null;
  venceEm: string | null;
  concluida: boolean;
  concluidaEm: string | null;
  leadId: string | null;
  leadNome: string | null;
  negocioId: string | null;
  negocioTitulo: string | null;
  empresaId: string | null;
  empresaNome: string | null;
  /** Pode faltar em resposta de API antiga em cache — sempre tratar como opcional. */
  origem?: string | null;
  motivo: string | null;
  usuarioId: string | null;
  responsavelNome: string | null;
}

const PRIORIDADE: Record<string, { label: string; cor: string; peso: number }> = {
  urgente: { label: "Urgente", cor: "var(--cf2-danger-text)", peso: 0 },
  alta: { label: "Alta", cor: "var(--cf2-danger-text)", peso: 1 },
  media: { label: "Média", cor: "var(--cf2-warning-text)", peso: 2 },
  baixa: { label: "Baixa", cor: "var(--cf2-text-tertiary)", peso: 3 },
};

/** Origem legível. MANUAL não vira chip: é o padrão, chip só pro que foge dele. */
const ROTULO_ORIGEM: Record<string, string> = {
  PLAYBOOK: "Checkpoint", BILLING: "Cobrança", RISCO: "Risco",
  RENOVACAO: "Renovação", EXPANSAO: "Expansão", ONBOARDING: "Onboarding",
  IMPLANTACAO: "Implantação", AUTOMACAO: "Automação",
};

function inicioDoDia(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

/**
 * Baldes temporais. Um dia por seção seria fiel ao calendário e inútil na
 * prática: o que o operador decide é "faço agora, faço esta semana, ou
 * empurro" — três grupos, não trinta.
 */
type Balde = "atrasadas" | "hoje" | "semana" | "depois" | "semData" | "concluidas";

const ROTULO_BALDE: Record<Balde, string> = {
  atrasadas: "Atrasadas", hoje: "Hoje", semana: "Próximos 7 dias",
  depois: "Mais adiante", semData: "Sem prazo", concluidas: "Concluídas",
};

function baldeDaTarefa(t: Tarefa): Balde {
  if (t.concluida) return "concluidas";
  const iso = t.venceEm ?? t.dataVencimento;
  if (!iso) return "semData";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "semData";
  const hoje = inicioDoDia();
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  const emSete = new Date(hoje); emSete.setDate(emSete.getDate() + 7);
  if (d < hoje) return "atrasadas";
  if (d < amanha) return "hoje";
  if (d < emSete) return "semana";
  return "depois";
}

function prazoTexto(t: Tarefa): string {
  const iso = t.venceEm ?? t.dataVencimento;
  if (!iso) return "sem prazo";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "sem prazo";
  const comHora = !!t.venceEm && t.venceEm.includes("T") && !t.venceEm.endsWith("T00:00:00.000Z");
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return comHora ? `${dia} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : dia;
}

export function Cf2TarefasWorkspace() {
  const router = useRouter();
  const qc = useQueryClient();
  const { usuarios, currentUserId } = useOrgUsuarios();
  const { data: me } = useMe();

  // Admin/gerente entram vendo o time; closer/SDR, só as próprias — mesma
  // regra do backend. A escolha manual da pessoa prevalece a partir do 1º clique.
  const [respOverride, setResp] = useState<string | null>(null);
  const resp = respOverride ?? (me && !isPersonalView(me.role) ? "todos" : "meu");
  const [status, setStatus] = useState<"pendente" | "concluida" | "todas">("pendente");
  const [tipo, setTipo] = useState("todos");
  const [origem, setOrigem] = useState<"todas" | "manual" | "automatica">("todas");
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<TarefaLegado | null>(null);

  const responsavelId = resp === "todos" ? null : resp === "meu" ? currentUserId : resp;

  const { data, isLoading } = useQuery<{ tarefas: Tarefa[] }>({
    queryKey: ["cf2-tarefas", responsavelId, status, tipo, origem],
    queryFn: async () => {
      const params = new URLSearchParams({ escopo: "org" });
      if (responsavelId) params.set("responsavelId", responsavelId);
      if (status !== "todas") params.set("concluida", String(status === "concluida"));
      if (tipo !== "todos") params.set("tipo", tipo);
      if (origem !== "todas") params.set("origem", origem);
      const r = await fetch(`/api/tarefas?${params.toString()}`);
      if (!r.ok) return { tarefas: [] };
      return r.json();
    },
  });

  const alternar = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concluida }),
      });
      if (!r.ok) throw new Error("Não foi possível atualizar");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf2-tarefas"] });
      qc.invalidateQueries({ queryKey: ["cs-fila"] });
      qc.invalidateQueries({ queryKey: ["cs-agenda"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Não foi possível excluir");
      return r.json();
    },
    onSuccess: () => { toast.success("Tarefa excluída"); qc.invalidateQueries({ queryKey: ["cf2-tarefas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const todas = data?.tarefas ?? [];

  const filtradas = useMemo(() => {
    if (!busca.trim()) return todas;
    const t = busca.trim().toLowerCase();
    return todas.filter((x) =>
      x.titulo.toLowerCase().includes(t)
      || (x.empresaNome ?? "").toLowerCase().includes(t)
      || (x.leadNome ?? "").toLowerCase().includes(t));
  }, [todas, busca]);

  const grupos = useMemo(() => {
    const ordem: Balde[] = ["atrasadas", "hoje", "semana", "depois", "semData", "concluidas"];
    const mapa = new Map<Balde, Tarefa[]>();
    for (const t of filtradas) {
      const b = baldeDaTarefa(t);
      const lista = mapa.get(b) ?? [];
      lista.push(t);
      mapa.set(b, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => {
        const pa = PRIORIDADE[a.prioridade]?.peso ?? 2;
        const pb = PRIORIDADE[b.prioridade]?.peso ?? 2;
        if (pa !== pb) return pa - pb;
        return (a.venceEm ?? a.dataVencimento ?? "").localeCompare(b.venceEm ?? b.dataVencimento ?? "");
      });
    }
    return ordem.filter((b) => (mapa.get(b) ?? []).length > 0).map((b) => ({ balde: b, itens: mapa.get(b)! }));
  }, [filtradas]);

  const pendentes = todas.filter((t) => !t.concluida);
  const contagem = {
    atrasadas: pendentes.filter((t) => baldeDaTarefa(t) === "atrasadas").length,
    hoje: pendentes.filter((t) => baldeDaTarefa(t) === "hoje").length,
    automaticas: pendentes.filter((t) => (t.origem ?? "MANUAL") !== "MANUAL").length,
    total: pendentes.length,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho compacto: o número de atrasadas é o que muda a ordem do dia. */}
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 rounded-[24px]"
        data-cf2-superficie="escura"
        style={{ background: "var(--cf2-home-hero-bg)" }}
      >
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "1.6px", fontFamily: "var(--cf2-font-heading)" }}>
              Operação
            </p>
            <h1 className="text-[20px] font-semibold leading-tight" style={{ color: "var(--cf2-home-text-strong)", fontFamily: "var(--cf2-font-heading)", letterSpacing: "-0.32px" }}>
              Tarefas
            </h1>
          </div>
          <div className="flex items-center gap-5">
            {[
              { rotulo: "Atrasadas", valor: contagem.atrasadas, alerta: contagem.atrasadas > 0 },
              { rotulo: "Hoje", valor: contagem.hoje, alerta: false },
              { rotulo: "Automáticas", valor: contagem.automaticas, alerta: false },
              { rotulo: "Abertas", valor: contagem.total, alerta: false },
            ].map((k) => (
              <div key={k.rotulo}>
                <p className="text-[9.5px] uppercase" style={{ color: "var(--cf2-home-text-muted)", letterSpacing: "0.62px" }}>{k.rotulo}</p>
                <p
                  className="text-[22px] font-semibold leading-none"
                  style={{ color: k.alerta ? "var(--cf2-home-danger)" : "var(--cf2-home-text-strong)", fontFamily: "var(--cf2-font-heading)" }}
                >
                  {k.valor}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-1.5 px-4 h-9 rounded-full text-[13px] font-semibold shrink-0"
          style={{ background: "var(--cf2-home-lime)", color: "var(--cf2-home-lime-ink)" }}
        >
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Seletor valor={resp} onChange={setResp} opcoes={[
          { v: "todos", l: "Todo o time" }, { v: "meu", l: "Minhas" },
          ...usuarios.map((u) => ({ v: u.id, l: u.nome })),
        ]} />
        <Seletor valor={status} onChange={(v) => setStatus(v as typeof status)} opcoes={[
          { v: "pendente", l: "Pendentes" }, { v: "concluida", l: "Concluídas" }, { v: "todas", l: "Todas" },
        ]} />
        <Seletor valor={origem} onChange={(v) => setOrigem(v as typeof origem)} opcoes={[
          { v: "todas", l: "Toda origem" }, { v: "manual", l: "Criadas por pessoa" }, { v: "automatica", l: "Geradas pelo sistema" },
        ]} />
        <Seletor valor={tipo} onChange={setTipo} opcoes={[
          { v: "todos", l: "Todo tipo" },
          ...TIPO_TAREFA_OPTIONS.map((t) => ({ v: t.value, l: t.label })),
        ]} />
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar tarefa ou cliente..." aria-label="Buscar tarefa ou cliente"
          className="h-8 px-3 rounded-lg text-[12.5px] outline-none flex-1 min-w-[180px] max-w-[280px]"
          style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Cf2Skeleton key={i} className="h-[52px]" />)}</div>
      ) : grupos.length === 0 ? (
        <Cf2EmptyState
          title={busca ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa nesta visão"}
          description={busca ? "Tente outro termo." : "Tarefas de checkpoint, cobrança e risco também aparecem aqui, geradas automaticamente."}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map(({ balde, itens }) => (
            <div key={balde} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <p
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: balde === "atrasadas" ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)", letterSpacing: "0.6px" }}
                >
                  {ROTULO_BALDE[balde]}
                </p>
                <Cf2Badge variant="neutral">{itens.length}</Cf2Badge>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cf2-border-default)" }}>
                {itens.map((t, i) => (
                  <LinhaTarefa
                    key={t.id}
                    tarefa={t}
                    primeira={i === 0}
                    atrasada={balde === "atrasadas"}
                    onAlternar={() => alternar.mutate({ id: t.id, concluida: !t.concluida })}
                    onEditar={() => setEditando(t as unknown as TarefaLegado)}
                    onExcluir={() => excluir.mutate(t.id)}
                    onAbrirCliente={() => t.empresaId && router.push(`/clientes/${t.empresaId}`)}
                    onAbrirNegocio={() => t.negocioId && router.push(`/negocios/${t.negocioId}`)}
                    onAbrirLead={() => t.leadId && router.push(`/contatos?leadId=${t.leadId}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(criando || editando) && (
        <TarefaFormModal
          open
          tarefa={editando}
          onClose={() => { setCriando(false); setEditando(null); }}
          invalidateKeys={[["cf2-tarefas"], ["cs-fila"], ["cs-agenda"]]}
        />
      )}
    </div>
  );
}

function Seletor({ valor, onChange, opcoes }: { valor: string; onChange: (v: string) => void; opcoes: { v: string; l: string }[] }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2.5 rounded-lg text-[12.5px] outline-none"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
    >
      {opcoes.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function LinhaTarefa({
  tarefa: t, primeira, atrasada, onAlternar, onEditar, onExcluir, onAbrirCliente, onAbrirNegocio, onAbrirLead,
}: {
  tarefa: Tarefa; primeira: boolean; atrasada: boolean;
  onAlternar: () => void; onEditar: () => void; onExcluir: () => void;
  onAbrirCliente: () => void; onAbrirNegocio: () => void; onAbrirLead: () => void;
}) {
  const prio = PRIORIDADE[t.prioridade] ?? PRIORIDADE.media;
  // `origem` é NOT NULL no banco, mas pode vir ausente de um payload em
  // cache anterior à migração — tratar como MANUAL em vez de quebrar a tela.
  const origem = t.origem ?? "MANUAL";
  // O motivo das tarefas de risco é o próprio texto do título — repetir na
  // linha de baixo só gasta espaço.
  const motivoUtil = t.motivo && !t.titulo.includes(t.motivo.slice(0, 25)) ? t.motivo : null;
  const automatica = origem !== "MANUAL";

  // A entidade certa por origem: tarefa de CS pertence ao CLIENTE; tarefa
  // comercial, ao negócio ou lead. Mostrar o lead numa tarefa de cobrança
  // manda o operador pro lugar errado.
  const vinculo = t.empresaId && t.empresaNome
    ? { rotulo: t.empresaNome, tipo: "cliente" as const, abrir: onAbrirCliente }
    : t.negocioId && t.negocioTitulo
      ? { rotulo: t.negocioTitulo, tipo: "negocio" as const, abrir: onAbrirNegocio }
      : t.leadId && t.leadNome
        ? { rotulo: t.leadNome, tipo: "lead" as const, abrir: onAbrirLead }
        : null;

  return (
    <div
      className="group flex items-center gap-3 px-3 h-[52px]"
      style={{
        borderTop: primeira ? "none" : "1px solid var(--cf2-border-default)",
        background: "var(--cf2-bg-surface)",
        opacity: t.concluida ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        onClick={onAlternar}
        className="-m-2 p-2 shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
        aria-label={t.concluida ? "Reabrir tarefa" : "Concluir tarefa"}
        aria-pressed={t.concluida}
      >
        <span
          className="w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors"
          style={{
            borderColor: t.concluida ? "var(--cf2-success-text)" : "var(--cf2-border-default)",
            background: t.concluida ? "var(--cf2-success-bg)" : "transparent",
          }}
        >
          <Check
            className="w-3 h-3 transition-opacity"
            style={{ color: "var(--cf2-success-text)", opacity: t.concluida ? 1 : 0 }}
            aria-hidden
          />
        </span>
      </button>

      <span className="w-[3px] h-6 rounded-full shrink-0" style={{ background: atrasada ? "var(--cf2-danger-text)" : prio.cor }} />

      <button onClick={onEditar} className="min-w-0 flex-1 text-left">
        <p
          className="text-[13px] truncate"
          style={{ color: "var(--cf2-text-primary)", textDecoration: t.concluida ? "line-through" : undefined }}
        >
          {t.titulo}
        </p>
        <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          <span>{tipoLabel(t.tipo)}</span>
          {motivoUtil && <span className="truncate">· {motivoUtil}</span>}
        </div>
      </button>

      {vinculo && (
        <button
          onClick={vinculo.abrir}
          className="flex items-center gap-1.5 min-w-0 w-[190px] shrink-0 text-left hover:underline"
          title={vinculo.rotulo}
        >
          {vinculo.tipo === "cliente" ? (
            <span
              className="flex items-center justify-center w-5 h-5 rounded shrink-0 text-[8.5px] font-bold text-white"
              style={{ background: corAvatarEmpresa(t.empresaId!), color: TEXTO_SOBRE_AVATAR }}
            >
              {iniciaisEmpresa(vinculo.rotulo)}
            </span>
          ) : vinculo.tipo === "negocio" ? (
            <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
          ) : (
            <UserRound className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
          )}
          <span className="text-[11.5px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{vinculo.rotulo}</span>
        </button>
      )}

      {automatica && (
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
          style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}
          title="Gerada automaticamente pelo motor de CS"
        >
          <Bot className="w-3 h-3" /> {ROTULO_ORIGEM[origem] ?? origem.toLowerCase()}
        </span>
      )}

      <span
        className="text-[11px] w-[86px] shrink-0 text-right"
        style={{ color: atrasada ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }}
      >
        {prazoTexto(t)}
      </span>

      <span className="text-[11px] w-[100px] shrink-0 truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
        {t.responsavelNome ?? "sem responsável"}
      </span>

      <button
        type="button"
        onClick={onExcluir}
        className="p-2 rounded-lg shrink-0 transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--cf2-danger-text)]"
        style={{ color: "var(--cf2-text-tertiary)" }}
        aria-label="Excluir tarefa"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
