"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, Flag, HeartPulse, RefreshCw, Clock } from "lucide-react";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2EmptyState, Cf2Skeleton } from "@/components/crm2/ui/States";
import { iniciaisEmpresa, corAvatarEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";

/**
 * Minha semana — agenda de CS gerada a partir dos dados.
 *
 * Não é um roteiro fixo de Segunda/Terça: é o que de fato está marcado, vindo
 * de tarefa, checkpoint, renovação e health check pendente. O que está
 * atrasado sobe pro topo agrupado, em vez de ficar espalhado nos dias em que
 * venceu — o CS precisa ver o acúmulo, não fazer arqueologia.
 */

interface Compromisso {
  chave: string;
  tipo: "TAREFA" | "CHECKPOINT" | "RENOVACAO" | "HEALTH_CHECK";
  titulo: string;
  empresaId: string;
  empresaNome: string;
  quando: string | null;
  mrr: string | null;
  prioridade: string | null;
  responsavelNome: string | null;
  tarefaId: string | null;
  marcoId: string | null;
  renovacaoId: string | null;
  contexto: string | null;
}

interface Agenda {
  atrasados: Compromisso[];
  dias: { data: string; rotulo: string; compromissos: Compromisso[] }[];
  semData: Compromisso[];
}

const ICONE: Record<Compromisso["tipo"], React.ElementType> = {
  TAREFA: Clock, CHECKPOINT: Flag, RENOVACAO: RefreshCw, HEALTH_CHECK: HeartPulse,
};

const ROTULO_TIPO: Record<Compromisso["tipo"], string> = {
  TAREFA: "Tarefa", CHECKPOINT: "Checkpoint", RENOVACAO: "Renovação", HEALTH_CHECK: "Health check",
};

function brl(v: string | null) {
  if (!v || Number(v) === 0) return null;
  return `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function Cf2CsAgenda({ escopo }: { escopo: "todos" | "me" | "sem_dono" }) {
  const router = useRouter();
  const qc = useQueryClient();
  const param = escopo === "todos" ? "" : `?responsavel=${escopo}`;

  const { data, isLoading } = useQuery<Agenda>({
    queryKey: ["cs-agenda", escopo],
    queryFn: async () => (await fetch(`/api/cs/agenda${param}`)).json(),
  });

  const concluir = useMutation({
    mutationFn: async (tarefaId: string) => {
      const r = await fetch(`/api/cs/tarefas/${tarefaId}/concluir`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!r.ok) throw new Error("Não foi possível concluir");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Concluída");
      for (const k of ["cs-agenda", "cs-fila", "cs-pulso"]) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Cf2Skeleton key={i} className="h-24" />)}</div>;
  if (!data) return null;

  const vazia = data.atrasados.length === 0 && data.semData.length === 0
    && data.dias.every((d) => d.compromissos.length === 0);

  if (vazia) {
    return <Cf2EmptyState title="Semana livre" description="Nenhuma tarefa, checkpoint ou renovação nos próximos 7 dias nesta visão." />;
  }

  const linha = (c: Compromisso) => {
    const Icone = ICONE[c.tipo];
    // O título da tarefa automática já carrega o motivo; repetir na linha de
    // baixo só ocupa espaço e faz a lista parecer mais cheia do que é.
    const contextoUtil = c.contexto && !c.titulo.includes(c.contexto) ? c.contexto : null;
    // O nome da empresa já aparece na coluna própria; repeti-lo no título
    // (as tarefas automáticas o incluem) gastaria metade da linha.
    const tituloLimpo = c.titulo.replace(` — ${c.empresaNome}`, "").replace(`${c.empresaNome} — `, "").trim();
    return (
      <div key={c.chave} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        {c.tarefaId ? (
          <button
            onClick={() => concluir.mutate(c.tarefaId!)}
            className="w-4 h-4 rounded border shrink-0 flex items-center justify-center group"
            style={{ borderColor: "var(--cf2-border-default)" }}
            title="Concluir"
          >
            <Check className="w-3 h-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100" style={{ color: "var(--cf2-success-text)" }} />
          </button>
        ) : (
          <Icone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
        )}

        {/* O cliente vem primeiro e em coluna fixa: sem ele, a linha diz o
            que fazer e não com quem — que é a primeira coisa que o CS
            precisa saber pra decidir a ordem do dia. */}
        <span
          className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 text-[9.5px] font-bold text-white"
          style={{ background: corAvatarEmpresa(c.empresaId), color: TEXTO_SOBRE_AVATAR }}
        >
          {iniciaisEmpresa(c.empresaNome)}
        </span>
        <span className="text-[12.5px] font-semibold truncate w-[170px] shrink-0" style={{ color: "var(--cf2-text-primary)" }}>
          {c.empresaNome}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{tituloLimpo}</p>
          <div className="flex items-center gap-2 flex-wrap text-[10.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
            <span>{ROTULO_TIPO[c.tipo]}</span>
            {contextoUtil && <span>· {contextoUtil}</span>}
            <span>· {c.responsavelNome ?? "sem responsável"}</span>
          </div>
        </div>

        {brl(c.mrr) && <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>{brl(c.mrr)}</span>}
        {c.prioridade === "alta" && <Cf2Badge variant="danger">alta</Cf2Badge>}
        <button
          onClick={() => router.push(`/clientes/${c.empresaId}`)}
          className="text-[10.5px] font-semibold shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}
        >
          abrir
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {data.atrasados.length > 0 && (
        <Grupo titulo={`Atrasado (${data.atrasados.length})`} alerta>
          {data.atrasados.map(linha)}
        </Grupo>
      )}

      {data.dias.map((d) => (
        d.compromissos.length === 0 ? (
          <div key={d.data} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <CalendarClock className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-secondary)" }}>{d.rotulo}</p>
            <span className="text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>· nada marcado</span>
          </div>
        ) : (
          <Grupo key={d.data} titulo={d.rotulo} contador={d.compromissos.length}>
            {d.compromissos.map(linha)}
          </Grupo>
        )
      ))}

      {data.semData.length > 0 && (
        <Grupo titulo="Quando der" contador={data.semData.length}>
          {data.semData.map(linha)}
        </Grupo>
      )}
    </div>
  );
}

function Grupo({ titulo, contador, alerta, children }: { titulo: string; contador?: number; alerta?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--cf2-bg-surface)", border: `1px solid ${alerta ? "var(--cf2-danger-text)" : "var(--cf2-border-default)"}` }}>
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="w-3.5 h-3.5" style={{ color: alerta ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }} />
        <p className="text-[12px] font-bold" style={{ color: alerta ? "var(--cf2-danger-text)" : "var(--cf2-text-primary)" }}>{titulo}</p>
        {contador !== undefined && contador > 0 && <Cf2Badge variant="neutral">{contador}</Cf2Badge>}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

// ─── Métricas ───────────────────────────────────────────────────

interface Metrica {
  chave: string; rotulo: string; disponivel: boolean;
  valor: number | null; unidade: "moeda" | "percentual" | "dias" | "quantidade";
  base?: string; motivoIndisponivel?: string;
}

function formatar(m: Metrica): string {
  if (!m.disponivel || m.valor === null) return "—";
  if (m.unidade === "moeda") return `R$ ${m.valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  if (m.unidade === "percentual") return `${m.valor.toFixed(1)}%`;
  if (m.unidade === "dias") return `${Math.round(m.valor)}d`;
  return String(m.valor);
}

/**
 * Métricas com procedência. Cada número mostra de onde saiu; as que a base
 * não permite calcular aparecem com o motivo, nunca com um valor aproximado —
 * métrica de retenção errada é pior que métrica ausente, porque alguém decide
 * com ela.
 */
export function Cf2CsMetricas() {
  const { data, isLoading } = useQuery<{ janelaDias: number; metricas: Metrica[] }>({
    queryKey: ["cs-metricas"],
    queryFn: async () => (await fetch("/api/cs/metricas")).json(),
  });

  if (isLoading) return <Cf2Skeleton className="h-64" />;
  const metricas = data?.metricas ?? [];
  const disponiveis = metricas.filter((m) => m.disponivel);
  const indisponiveis = metricas.filter((m) => !m.disponivel);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        Janela de {data?.janelaDias ?? 90} dias. Cada número mostra a base de cálculo — se você discordar, dá pra conferir a fonte.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {disponiveis.map((m) => (
          <div key={m.chave} className="p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{m.rotulo}</p>
            <p className="text-[20px] font-bold leading-tight my-0.5" style={{ color: "var(--cf2-text-primary)" }}>{formatar(m)}</p>
            {m.base && <p className="text-[10px] leading-snug" style={{ color: "var(--cf2-text-tertiary)" }}>{m.base}</p>}
          </div>
        ))}
      </div>

      {indisponiveis.length > 0 && (
        <div className="rounded-xl p-3.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>
            Não calculável com o dado de hoje
          </p>
          <div className="flex flex-col gap-1.5">
            {indisponiveis.map((m) => (
              <div key={m.chave}>
                <p className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{m.rotulo}</p>
                <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{m.motivoIndisponivel}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
