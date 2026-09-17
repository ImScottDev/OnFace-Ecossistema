"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Check, CheckCircle2, HeartPulse, MessageSquare, Plus,
  RefreshCw, ShieldAlert, TrendingUp, X, XCircle,
} from "lucide-react";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton } from "@/components/crm2/ui/States";
import { Cf2CsJornada, FormularioHealthCheck, type CicloJornada } from "./CsJornada";
import { Cf2CsBilling } from "./CsBilling";

/**
 * Painel de CS do Cliente 360 — a aba onde o CS de fato opera a conta:
 * jornada com marcos, riscos com motivo e resolução, tarefas, expansão e
 * pedido de cancelamento.
 *
 * Substitui a versão de 20/08, que só exibia os 3 sinais da fila em forma
 * de chip: mostrava o problema e não deixava fazer nada com ele.
 */

interface Marco {
  id: string; codigo: string; titulo: string; objetivo: string | null;
  dueDate: string; status: string; resultado: Record<string, unknown> | null;
  concluidoEm: string | null; tarefaId: string | null; checklist: string[];
}

interface Risco {
  id: string; tipo: string; rotulo: string; severidade: string; origem: string;
  motivo: string; fonte: string; status: string; abertoEm: string;
  resolvidoEm: string | null; resolucao: string | null; responsavelNome: string | null;
}

interface Renovacao {
  id: string; vencimento: string; status: string; valorAtual: string | null;
  familia: string | null; produto: string | null;
}

interface Cancelamento {
  id: string; status: string; motivo: string; motivoDetalhe: string | null;
  solicitadoEm: string; contratoVigente: boolean | null; multaAplicavel: boolean | null;
  multaValor: string | null; pendenciaFinanceira: string | null;
  tentativaRetencao: string | null; dataEfetiva: string | null; motivoFinal: string | null;
}

interface Tarefa {
  id: string; titulo: string; descricao: string | null; origem: string; motivo: string | null;
  prioridade: string; venceEm: string | null; concluida: boolean; responsavelNome: string | null;
}

interface ServicoResumo { id: string; serviceFamily: string; canonicalProduct: string | null }

const SEVERIDADE_VARIANTE: Record<string, "danger" | "warning" | "neutral"> = {
  CRITICO: "danger", EM_RISCO: "danger", ATENCAO: "warning",
};

const MOTIVOS_CANCELAMENTO = [
  ["preco", "Preço"], ["baixo_uso", "Baixo uso"], ["sem_valor_percebido", "Não percebeu valor"],
  ["produto", "Produto"], ["suporte", "Suporte / atendimento"], ["concorrente", "Foi para concorrente"],
  ["encerramento_empresa", "Encerramento da empresa"], ["inadimplencia", "Inadimplência"],
  ["mudanca_estrategica", "Mudança estratégica"], ["outro", "Outro"],
] as const;

const TIPOS_EXPANSAO = [
  ["upgrade", "Upgrade de plano"], ["usuarios", "Mais usuários"], ["licencas", "Mais licenças"],
  ["minutos", "Mais minutos"], ["addon", "Add-on"], ["nova_familia", "Nova família de produto"],
  ["hardware", "Hardware"], ["projeto", "Projeto adicional"],
] as const;

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Produto em revisão",
};

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR");
}

export function Cf2CsPanel({ empresaId, empresaNome, servicos, marcoInicialId }: { empresaId: string; empresaNome: string; servicos: ServicoResumo[]; marcoInicialId?: string | null }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | "risco" | "expansao" | "cancelamento" | "tarefa" | "interacao" | "health">(null);

  const invalidarTudo = () => {
    for (const k of ["cs-jornada", "cs-riscos", "cs-tarefas-cliente", "cs-cancelamentos", "cf2-cliente-360"]) {
      qc.invalidateQueries({ queryKey: [k, empresaId] });
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const jornada = useQuery<{
    ciclos: CicloJornada[];
    cicloAtual: number;
    marcos: Marco[];
    renovacoes: Renovacao[];
    conta: { observacoesCs: string | null; jornadaIniciadaEm: string | null } | null;
  }>({
    queryKey: ["cs-jornada", empresaId],
    queryFn: async () => (await fetch(`/api/cs/clientes/${empresaId}/jornada`)).json(),
  });

  const riscos = useQuery<{ riscos: Risco[] }>({
    queryKey: ["cs-riscos", empresaId],
    queryFn: async () => (await fetch(`/api/cs/clientes/${empresaId}/riscos`)).json(),
  });

  const tarefas = useQuery<{ tarefas: Tarefa[] }>({
    queryKey: ["cs-tarefas-cliente", empresaId],
    queryFn: async () => (await fetch(`/api/cs/clientes/${empresaId}/tarefas`)).json(),
  });

  const cancelamentos = useQuery<{ cancelamentos: Cancelamento[] }>({
    queryKey: ["cs-cancelamentos", empresaId],
    queryFn: async () => (await fetch(`/api/cs/clientes/${empresaId}/cancelamentos`)).json(),
  });

  const iniciarJornada = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/clientes/${empresaId}/jornada/iniciar`, { method: "POST" });
      if (!r.ok) throw new Error("Não foi possível iniciar a jornada");
      return r.json();
    },
    onSuccess: (d: { criados: number; motivo?: string }) => {
      if (d.motivo) toast.error(d.motivo); else toast.success(`${d.criados} marcos criados`);
      invalidarTudo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const concluirTarefa = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/cs/tarefas/${id}/concluir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error("Falhou ao concluir");
      return r.json();
    },
    onSuccess: () => { toast.success("Tarefa concluída"); invalidarTudo(); },
  });

  const marcos = jornada.data?.marcos ?? [];
  const marcosPendentes = marcos.filter((m) => m.status === "PENDENTE").length;
  const riscosAbertos = (riscos.data?.riscos ?? []).filter((r) => r.status === "ABERTO");
  const riscosResolvidos = (riscos.data?.riscos ?? []).filter((r) => r.status === "RESOLVIDO");
  const tarefasAbertas = (tarefas.data?.tarefas ?? []).filter((t) => !t.concluida);
  const cancelamentoAtivo = (cancelamentos.data?.cancelamentos ?? []).find((c) => c.status !== "RETIDO" && c.status !== "EFETIVADO");

  return (
    <div className="flex flex-col gap-4">
      {/* Ações rápidas — o que o CS faz com a conta, sempre à mão. */}
      <div className="flex items-center gap-2 flex-wrap">
        <BotaoAcao icone={MessageSquare} onClick={() => setModal("interacao")}>Registrar interação</BotaoAcao>
        <BotaoAcao icone={HeartPulse} onClick={() => setModal("health")}>Health check</BotaoAcao>
        <BotaoAcao icone={Plus} onClick={() => setModal("tarefa")}>Criar tarefa</BotaoAcao>
        <BotaoAcao icone={ShieldAlert} onClick={() => setModal("risco")}>Marcar risco</BotaoAcao>
        <BotaoAcao icone={TrendingUp} onClick={() => setModal("expansao")}>Nova expansão</BotaoAcao>
        <BotaoAcao icone={XCircle} onClick={() => setModal("cancelamento")} perigo>Registrar cancelamento</BotaoAcao>
      </div>

      {cancelamentoAtivo && <CardCancelamento cancelamento={cancelamentoAtivo} onMudou={invalidarTudo} />}

      {/* Riscos */}
      <Secao titulo="Risco" contador={riscosAbertos.length}>
        {riscos.isLoading ? <Cf2Skeleton className="h-16" /> : riscosAbertos.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--cf2-success-text)" }} />
            <p className="text-[12.5px]" style={{ color: "var(--cf2-text-secondary)" }}>
              Nenhum sinal de risco aberto — fatura em dia, entrega andando, tarefas em ordem.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {riscosAbertos.map((r) => <LinhaRisco key={r.id} risco={r} onResolvido={invalidarTudo} />)}
          </div>
        )}
        {riscosResolvidos.length > 0 && (
          <details className="mt-2">
            <summary className="text-[11.5px] cursor-pointer" style={{ color: "var(--cf2-text-tertiary)" }}>
              {riscosResolvidos.length} risco{riscosResolvidos.length > 1 ? "s" : ""} já resolvido{riscosResolvidos.length > 1 ? "s" : ""}
            </summary>
            <div className="flex flex-col gap-1.5 mt-2">
              {riscosResolvidos.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg text-[11.5px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>
                  <span className="font-semibold">{r.rotulo}</span> — {r.motivo}
                  <br />Resolvido {dataBr(r.resolvidoEm)}: {r.resolucao}
                </div>
              ))}
            </div>
          </details>
        )}
      </Secao>

      {/* Jornada — régua permanente 3/6/9/12, um ciclo por ano de relação */}
      <Secao titulo="Jornada de CS" contador={marcosPendentes}>
        {jornada.isLoading ? <Cf2Skeleton className="h-24" /> : (jornada.data?.ciclos ?? []).length === 0 ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <p className="text-[12.5px]" style={{ color: "var(--cf2-text-secondary)" }}>
              Jornada não iniciada. Semear cria a régua do ciclo 1 — entrada, 7 e 30 dias, e os checkpoints de 3, 6, 9 e 12 meses.
            </p>
            <button
              onClick={() => iniciarJornada.mutate()}
              disabled={iniciarJornada.isPending}
              className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold shrink-0 disabled:opacity-50"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              {iniciarJornada.isPending ? "Criando..." : "Iniciar jornada"}
            </button>
          </div>
        ) : (
          <Cf2CsJornada
            ciclos={jornada.data!.ciclos}
            cicloAtual={jornada.data!.cicloAtual}
            empresaNome={empresaNome}
            servicos={servicos}
            onMudou={invalidarTudo}
            marcoInicialId={marcoInicialId}
          />
        )}
      </Secao>

      {/* Billing na visão do CS — por serviço, só leitura */}
      <Secao titulo="Financeiro por serviço">
        <Cf2CsBilling empresaId={empresaId} />
      </Secao>

      {/* Renovação */}
      <Secao titulo="Renovação" contador={(jornada.data?.renovacoes ?? []).length}>
        {(jornada.data?.renovacoes ?? []).length === 0 ? (
          <p className="text-[12.5px] p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
            Nenhuma renovação mapeada. A data sai da vigência real do contrato — serviço sem contrato com vencimento não gera renovação.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(jornada.data?.renovacoes ?? []).map((r) => <LinhaRenovacao key={r.id} renovacao={r} onMudou={invalidarTudo} />)}
          </div>
        )}
      </Secao>

      {/* Tarefas */}
      <Secao titulo="Tarefas abertas" contador={tarefasAbertas.length}>
        {tarefas.isLoading ? <Cf2Skeleton className="h-16" /> : tarefasAbertas.length === 0 ? (
          <p className="text-[12.5px] p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>
            Nenhuma tarefa aberta. Cliente sem próxima ação vira sinal de risco no próximo ciclo.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tarefasAbertas.map((t) => {
              const atrasada = !!t.venceEm && new Date(t.venceEm) < new Date();
              return (
                <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <button
                    onClick={() => concluirTarefa.mutate(t.id)}
                    className="w-4 h-4 rounded border shrink-0 flex items-center justify-center hover:bg-[var(--cf2-success-bg)]"
                    style={{ borderColor: "var(--cf2-border-default)" }}
                    title="Concluir"
                  >
                    <Check className="w-3 h-3 opacity-0 hover:opacity-100" style={{ color: "var(--cf2-success-text)" }} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                    <p className="text-[11px]" style={{ color: atrasada ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }}>
                      {t.venceEm ? `vence ${dataBr(t.venceEm)}` : "sem prazo"} · {t.origem.toLowerCase()} · {t.responsavelNome ?? "sem responsável"}
                    </p>
                  </div>
                  {t.prioridade === "alta" && <Cf2Badge variant="danger">alta</Cf2Badge>}
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      {modal === "risco" && <ModalRisco empresaId={empresaId} servicos={servicos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); invalidarTudo(); }} />}
      {modal === "expansao" && <ModalExpansao empresaId={empresaId} servicos={servicos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); invalidarTudo(); }} />}
      {modal === "cancelamento" && <ModalCancelamento empresaId={empresaId} servicos={servicos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); invalidarTudo(); }} />}
      {modal === "health" && <ModalHealthCheck empresaId={empresaId} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); invalidarTudo(); }} />}
      {modal === "interacao" && <ModalInteracao empresaId={empresaId} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); invalidarTudo(); }} />}
      {modal === "tarefa" && <ModalTarefa empresaId={empresaId} servicos={servicos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); invalidarTudo(); }} />}
    </div>
  );
}

// ─── Peças ──────────────────────────────────────────────────────

function BotaoAcao({ icone: Icone, children, onClick, perigo }: { icone: React.ElementType; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold"
      style={{
        background: perigo ? "#fde8e8" : "var(--cf2-bg-surface-muted)",
        color: perigo ? "var(--cf2-danger-text)" : "var(--cf2-text-secondary)",
      }}
    >
      <Icone className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

function Secao({ titulo, contador, children }: { titulo: string; contador?: number; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl flex flex-col gap-2.5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center gap-2">
        <p className="text-[13.5px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
        {contador !== undefined && contador > 0 && <Cf2Badge variant="neutral">{contador}</Cf2Badge>}
      </div>
      {children}
    </div>
  );
}

function LinhaRisco({ risco, onResolvido }: { risco: Risco; onResolvido: () => void }) {
  const [resolvendo, setResolvendo] = useState(false);
  const [resolucao, setResolucao] = useState("");

  const resolver = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/riscos/${risco.id}/resolver`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolucao: resolucao.trim() }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Risco resolvido"); setResolvendo(false); onResolvido(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-3 rounded-xl" style={{ background: risco.severidade === "ATENCAO" ? "var(--cf2-warning-bg)" : "#fde8e8" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Cf2Badge variant={SEVERIDADE_VARIANTE[risco.severidade] ?? "neutral"}>{risco.rotulo}</Cf2Badge>
            {risco.origem === "MANUAL" && <span className="text-[10px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>marcado pelo CS</span>}
          </div>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--cf2-text-primary)" }}>{risco.motivo}</p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>
            desde {dataBr(risco.abertoEm)} · fonte: {risco.fonte}
          </p>
        </div>
        {!resolvendo && (
          <button onClick={() => setResolvendo(true)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>
            Resolver
          </button>
        )}
      </div>
      {resolvendo && (
        <div className="flex items-center gap-2 mt-2.5">
          <input
            autoFocus value={resolucao} onChange={(e) => setResolucao(e.target.value)}
            placeholder="Como foi resolvido?" aria-label="Como foi resolvido?"
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
          <button
            disabled={!resolucao.trim() || resolver.isPending}
            onClick={() => resolver.mutate()}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            Salvar
          </button>
          <button onClick={() => setResolvendo(false)} style={{ color: "var(--cf2-text-tertiary)" }}><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function LinhaRenovacao({ renovacao, onMudou }: { renovacao: Renovacao; onMudou: () => void }) {
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState<"EM_NEGOCIACAO" | "RENOVADA" | "NAO_RENOVADA">("EM_NEGOCIACAO");
  const [novoVencimento, setNovoVencimento] = useState("");
  const [valorProposto, setValorProposto] = useState("");
  const [motivo, setMotivo] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/renovacoes/${renovacao.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          novoVencimento: status === "RENOVADA" ? novoVencimento : undefined,
          valorProposto: valorProposto || undefined,
          motivoNaoRenovacao: status === "NAO_RENOVADA" ? motivo : undefined,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Renovação atualizada"); setEditando(false); onMudou(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const dias = Math.round((new Date(`${renovacao.vencimento}T12:00:00`).getTime() - Date.now()) / 86_400_000);

  return (
    <div className="p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{renovacao.produto ?? (renovacao.familia ? FAMILIA_LABEL[renovacao.familia] ?? renovacao.familia : "Serviço")}</p>
            <Cf2Badge variant={dias <= 30 ? "danger" : dias <= 60 ? "warning" : "neutral"}>{dias < 0 ? `vencida há ${Math.abs(dias)}d` : `${dias}d`}</Cf2Badge>
            <Cf2Badge variant="neutral">{renovacao.status.toLowerCase().replace("_", " ")}</Cf2Badge>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>vence {dataBr(renovacao.vencimento)}</p>
        </div>
        {!editando && (
          <button onClick={() => setEditando(true)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>
            Atualizar
          </button>
        )}
      </div>
      {editando && (
        <div className="flex flex-col gap-2 mt-2.5">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
            <option value="EM_NEGOCIACAO">Em negociação</option>
            <option value="RENOVADA">Renovada</option>
            <option value="NAO_RENOVADA">Não renovada</option>
          </select>
          {status === "RENOVADA" && (
            <input type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          )}
          {status === "NAO_RENOVADA" && (
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da não renovação" aria-label="Motivo da não renovação" className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          )}
          <input value={valorProposto} onChange={(e) => setValorProposto(e.target.value)} placeholder="Novo valor (opcional)" aria-label="Novo valor (opcional)" className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          <div className="flex gap-2">
            <button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Salvar</button>
            <button onClick={() => setEditando(false)} className="px-3 py-1.5 rounded-lg text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CardCancelamento({ cancelamento, onMudou }: { cancelamento: Cancelamento; onMudou: () => void }) {
  const [tentativa, setTentativa] = useState(cancelamento.tentativaRetencao ?? "");
  const [motivoFinal, setMotivoFinal] = useState(cancelamento.motivoFinal ?? cancelamento.motivo);
  const [dataEfetiva, setDataEfetiva] = useState(cancelamento.dataEfetiva ?? "");

  const atualizar = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(`/api/cs/cancelamentos/${cancelamento.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          tentativaRetencao: tentativa || undefined,
          motivoFinal: status === "EFETIVADO" ? motivoFinal : undefined,
          dataEfetiva: status === "EFETIVADO" ? (dataEfetiva || new Date().toISOString().slice(0, 10)) : undefined,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Processo atualizado"); onMudou(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: "#fde8e8", border: "1px solid var(--cf2-danger-text)" }}>
      <div className="flex items-center gap-2">
        <XCircle className="w-4 h-4" style={{ color: "var(--cf2-danger-text)" }} />
        <p className="text-[13.5px] font-bold" style={{ color: "var(--cf2-danger-text)" }}>Pedido de cancelamento em aberto</p>
        <Cf2Badge variant="danger">{cancelamento.status.toLowerCase()}</Cf2Badge>
      </div>

      <p className="text-[12.5px]" style={{ color: "var(--cf2-text-primary)" }}>
        Motivo: <strong>{cancelamento.motivo}</strong>{cancelamento.motivoDetalhe ? ` — ${cancelamento.motivoDetalhe}` : ""}
        <br /><span style={{ color: "var(--cf2-text-secondary)" }}>solicitado em {dataBr(cancelamento.solicitadoEm)}</span>
      </p>

      {/* Checagens levantadas automaticamente no momento do pedido. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Checagem rotulo="Contrato vigente" valor={cancelamento.contratoVigente} />
        <Checagem rotulo="Multa aplicável" valor={cancelamento.multaAplicavel} extra={cancelamento.multaValor ? `R$ ${cancelamento.multaValor}` : null} />
        <Checagem rotulo="Em aberto" valor={null} extra={`R$ ${Number(cancelamento.pendenciaFinanceira ?? 0).toFixed(2)}`} />
        <Checagem rotulo="Data efetiva" valor={null} extra={cancelamento.dataEfetiva ?? "a definir"} />
      </div>

      <textarea
        value={tentativa} onChange={(e) => setTentativa(e.target.value)} rows={2}
        placeholder="O que foi tentado na retenção?" aria-label="O que foi tentado na retenção?"
        className="w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none resize-y"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
      />

      {cancelamento.status !== "APROVADO" && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => atualizar.mutate("EM_RETENCAO")} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>Em retenção</button>
          <button onClick={() => atualizar.mutate("RETIDO")} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}>Cliente retido</button>
          <button onClick={() => atualizar.mutate("APROVADO")} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-danger-text)" }}>Aprovar cancelamento</button>
        </div>
      )}

      {cancelamento.status === "APROVADO" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11.5px]" style={{ color: "var(--cf2-text-secondary)" }}>
            Efetivar encerra o serviço (lifecycle CHURNED) e o contrato. O histórico do cliente, da receita e do contrato permanece.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={motivoFinal} onChange={(e) => setMotivoFinal(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
              {MOTIVOS_CANCELAMENTO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input type="date" aria-label="Data" value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
            <button onClick={() => atualizar.mutate("EFETIVADO")} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-danger-text)", color: "#fff" }}>Efetivar cancelamento</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Checagem({ rotulo, valor, extra }: { rotulo: string; valor: boolean | null; extra?: string | null }) {
  return (
    <div className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{rotulo}</p>
      <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>
        {extra ?? (valor === null ? "não verificado" : valor ? "sim" : "não")}
      </p>
    </div>
  );
}

// ─── Modais ─────────────────────────────────────────────────────

function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
          <button onClick={onFechar} style={{ color: "var(--cf2-text-tertiary)" }} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };
const inputClass = "w-full px-3 py-2 rounded-lg text-[13px] outline-none mb-3";

function SeletorServico({ servicos, valor, onChange, rotulo }: { servicos: ServicoResumo[]; valor: string; onChange: (v: string) => void; rotulo: string }) {
  if (servicos.length === 0) return null;
  return (
    <>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>{rotulo}</label>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={inputClass} style={inputStyle}>
        <option value="">Toda a conta</option>
        {servicos.map((s) => <option key={s.id} value={s.id}>{s.canonicalProduct ?? FAMILIA_LABEL[s.serviceFamily] ?? s.serviceFamily}</option>)}
      </select>
    </>
  );
}

function ModalRisco({ empresaId, servicos, onFechar, onSalvo }: { empresaId: string; servicos: ServicoResumo[]; onFechar: () => void; onSalvo: () => void }) {
  const [severidade, setSeveridade] = useState<"ATENCAO" | "EM_RISCO" | "CRITICO">("EM_RISCO");
  const [motivo, setMotivo] = useState("");
  const [servicoId, setServicoId] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/clientes/${empresaId}/riscos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severidade, motivo: motivo.trim(), servicoCanonicoId: servicoId || null }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Risco registrado e tarefa criada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Marcar risco" onFechar={onFechar}>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Severidade</label>
      <select value={severidade} onChange={(e) => setSeveridade(e.target.value as typeof severidade)} className={inputClass} style={inputStyle}>
        <option value="ATENCAO">Atenção</option>
        <option value="EM_RISCO">Em risco</option>
        <option value="CRITICO">Crítico</option>
      </select>
      <SeletorServico servicos={servicos} valor={servicoId} onChange={setServicoId} rotulo="Serviço (opcional)" />
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Motivo</label>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="O que você observou? Quanto mais concreto, mais útil pro próximo CS que abrir essa conta." className={inputClass + " resize-y"} style={inputStyle} />
      <p className="text-[11px] mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>Uma tarefa de tratativa é criada junto, com prazo de 2 dias.</p>
      <button disabled={motivo.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate()} className="w-full py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
        {salvar.isPending ? "Salvando..." : "Marcar risco"}
      </button>
    </Modal>
  );
}

function ModalExpansao({ empresaId, servicos, onFechar, onSalvo }: { empresaId: string; servicos: ServicoResumo[]; onFechar: () => void; onSalvo: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>("upgrade");
  const [valor, setValor] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [descricao, setDescricao] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/clientes/${empresaId}/expansao`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: titulo.trim(), tipo, valorEstimado: valor || null, servicoOrigemId: servicoId || null, descricao: descricao.trim() || null }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Oportunidade de expansão criada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Nova oportunidade de expansão" onFechar={onFechar}>
      <p className="text-[11.5px] mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>
        Cria um negócio de verdade no funil comercial. O serviço só muda depois do fechamento — expansão não altera contrato por anotação.
      </p>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Tipo</label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass} style={inputStyle}>
        {TIPOS_EXPANSAO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <SeletorServico servicos={servicos} valor={servicoId} onChange={setServicoId} rotulo="Serviço de origem" />
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Título</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: +10 ramais PABX" aria-label="Ex.: +10 ramais PABX" className={inputClass} style={inputStyle} />
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Valor estimado (opcional)</label>
      <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" aria-label="0,00" className={inputClass} style={inputStyle} />
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Contexto da oportunidade" aria-label="Contexto da oportunidade" className={inputClass + " resize-y"} style={inputStyle} />
      <button disabled={titulo.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate()} className="w-full py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
        {salvar.isPending ? "Criando..." : "Criar oportunidade"}
      </button>
    </Modal>
  );
}

function ModalCancelamento({ empresaId, servicos, onFechar, onSalvo }: { empresaId: string; servicos: ServicoResumo[]; onFechar: () => void; onSalvo: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [canal, setCanal] = useState("");
  const [dataDesejada, setDataDesejada] = useState("");

  const precisaDetalhe = motivo === "outro";
  const pode = !!motivo && (!precisaDetalhe || detalhe.trim().length > 0);

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/clientes/${empresaId}/cancelamentos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo, motivoDetalhe: detalhe.trim() || null, servicoCanonicoId: servicoId || null,
          canal: canal || null, dataDesejada: dataDesejada || null,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Pedido registrado — tarefa de retenção criada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Registrar pedido de cancelamento" onFechar={onFechar}>
      <p className="text-[11.5px] mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>
        Abre um processo de retenção. Nada é cancelado agora: contrato, multa e pendência financeira são levantados automaticamente e o serviço só é encerrado ao efetivar.
      </p>
      <SeletorServico servicos={servicos} valor={servicoId} onChange={setServicoId} rotulo="Serviço" />
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Motivo <span style={{ color: "var(--cf2-danger-text)" }}>*</span></label>
      <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputClass} style={inputStyle}>
        <option value="" disabled>Selecione...</option>
        {MOTIVOS_CANCELAMENTO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>
        Detalhe {precisaDetalhe ? <span style={{ color: "var(--cf2-danger-text)" }}>*</span> : <span style={{ color: "var(--cf2-text-tertiary)" }}>(opcional)</span>}
      </label>
      <textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={3} placeholder="O que o cliente disse, com as palavras dele" aria-label="O que o cliente disse, com as palavras dele" className={inputClass + " resize-y"} style={inputStyle} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Canal</label>
          <input value={canal} onChange={(e) => setCanal(e.target.value)} placeholder="e-mail, ligação..." aria-label="e-mail, ligação" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Data desejada</label>
          <input type="date" value={dataDesejada} onChange={(e) => setDataDesejada(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
      </div>
      <button disabled={!pode || salvar.isPending} onClick={() => salvar.mutate()} className="w-full py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40" style={{ background: "var(--cf2-danger-text)", color: "#fff" }}>
        {salvar.isPending ? "Registrando..." : "Registrar pedido"}
      </button>
    </Modal>
  );
}

function ModalTarefa({ empresaId, servicos, onFechar, onSalvo }: { empresaId: string; servicos: ServicoResumo[]; onFechar: () => void; onSalvo: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState<"alta" | "media" | "baixa">("media");
  const [venceEm, setVenceEm] = useState(new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10));
  const [servicoId, setServicoId] = useState("");
  const [descricao, setDescricao] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/clientes/${empresaId}/tarefas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(), descricao: descricao.trim() || null, prioridade,
          venceEm: venceEm ? new Date(`${venceEm}T12:00:00`).toISOString() : null,
          servicoCanonicoId: servicoId || null,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b;
    },
    onSuccess: () => { toast.success("Tarefa criada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Nova tarefa de CS" onFechar={onFechar}>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Título</label>
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar sobre o uso do discador" aria-label="Ex.: Ligar sobre o uso do discador" className={inputClass} style={inputStyle} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Prazo</label>
          <input type="date" value={venceEm} onChange={(e) => setVenceEm(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Prioridade</label>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as typeof prioridade)} className={inputClass} style={inputStyle}>
            <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
          </select>
        </div>
      </div>
      <SeletorServico servicos={servicos} valor={servicoId} onChange={setServicoId} rotulo="Serviço (opcional)" />
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Contexto" aria-label="Contexto" className={inputClass + " resize-y"} style={inputStyle} />
      <button disabled={titulo.trim().length < 2 || salvar.isPending} onClick={() => salvar.mutate()} className="w-full py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
        {salvar.isPending ? "Criando..." : "Criar tarefa"}
      </button>
    </Modal>
  );
}

/**
 * Registro de interação. Vai pra `atividades` — a mesma tabela da timeline
 * comercial — pra que o Cliente 360 tenha UMA linha do tempo, não uma de
 * vendas e outra de CS contando histórias paralelas.
 */
function ModalInteracao({ empresaId, onFechar, onSalvo }: { empresaId: string; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<"ligacao" | "reuniao" | "whatsapp" | "email" | "nota">("ligacao");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [criarProxima, setCriarProxima] = useState(true);
  const [proximaTitulo, setProximaTitulo] = useState("");
  const [proximaEm, setProximaEm] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/cs/clientes/${empresaId}/interacoes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, titulo: titulo.trim() || null, descricao: descricao.trim() }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");

      // Toda interação é a hora natural de decidir o próximo passo — é o que
      // impede a conta de cair em "sem próxima ação" no sweep seguinte.
      if (criarProxima && proximaTitulo.trim()) {
        await fetch(`/api/cs/clientes/${empresaId}/tarefas`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: proximaTitulo.trim(),
            venceEm: new Date(`${proximaEm}T12:00:00`).toISOString(),
          }),
        });
      }
      return b;
    },
    onSuccess: () => { toast.success("Interação registrada"); onSalvo(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Registrar interação" onFechar={onFechar}>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Canal</label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputClass} style={inputStyle}>
        <option value="ligacao">Ligação</option><option value="reuniao">Reunião</option>
        <option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="nota">Nota</option>
      </select>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Assunto (opcional)</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} style={inputStyle} />
      <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>O que aconteceu</label>
      <textarea autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className={inputClass + " resize-y"} style={inputStyle} />

      <label className="flex items-center gap-2 text-[12px] mb-2 cursor-pointer" style={{ color: "var(--cf2-text-secondary)" }}>
        <input type="checkbox" checked={criarProxima} onChange={(e) => setCriarProxima(e.target.checked)} />
        Agendar próxima ação
      </label>
      {criarProxima && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={proximaTitulo} onChange={(e) => setProximaTitulo(e.target.value)} placeholder="Qual o próximo passo?" aria-label="Qual o próximo passo?" className={inputClass} style={inputStyle} />
          <input type="date" value={proximaEm} onChange={(e) => setProximaEm(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
      )}

      <button disabled={descricao.trim().length < 2 || salvar.isPending} onClick={() => salvar.mutate()} className="w-full py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
        {salvar.isPending ? "Salvando..." : "Registrar"}
      </button>
    </Modal>
  );
}

/**
 * Health check avulso — fora de checkpoint. O CS liga, pergunta e registra
 * na hora; respostas ruins abrem sinal de risco automaticamente (ver
 * lib/cs/health-check.ts).
 */
function ModalHealthCheck({ empresaId, onFechar, onSalvo }: { empresaId: string; onFechar: () => void; onSalvo: () => void }) {
  const [valores, setValores] = useState<Record<string, number | boolean | string>>({});

  const salvar = useMutation({
    mutationFn: async () => {
      const limpo = Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== "" && v !== undefined));
      const r = await fetch(`/api/cs/clientes/${empresaId}/health-check`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(limpo),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Falhou");
      return b as { riscosAbertos: string[] };
    },
    onSuccess: (d) => {
      toast.success(d.riscosAbertos.length > 0
        ? `Health check registrado — ${d.riscosAbertos.length} sinal(is) de risco aberto(s)`
        : "Health check registrado");
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respondeu = Object.values(valores).some((v) => v !== "" && v !== undefined);

  return (
    <Modal titulo="Health check" onFechar={onFechar}>
      <p className="text-[11.5px] mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>
        Registre o que o cliente respondeu na conversa. Nota baixa vira sinal de risco — mas não apaga fatura vencida nem entrega parada, que continuam valendo por conta própria.
      </p>
      <FormularioHealthCheck valores={valores} onChange={setValores} />
      <button
        disabled={!respondeu || salvar.isPending} onClick={() => salvar.mutate()}
        className="w-full py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40 mt-4"
        style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
      >
        {salvar.isPending ? "Salvando..." : "Registrar health check"}
      </button>
    </Modal>
  );
}
