"use client";

/**
 * Detalhe de uma entrega: checklist real agrupado por workstream, com
 * status, bloqueio e responsável por item.
 *
 * O status macro da entrega é DERIVADO do checklist pela API (ver
 * PATCH /fulfillments/itens/:id) — a tela não decide isso, só reflete. O
 * único status que uma pessoa escolhe à mão aqui é COMPLETED/CANCELED.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Ban, CircleDot, Circle, ClipboardCheck } from "lucide-react";

interface ItemChecklist {
  id: string;
  workstream: string;
  titulo: string;
  status: string;
  blockerType: string | null;
  blockerReason: string | null;
  ordem: number;
  metadata: Record<string, unknown> | null;
  completedAt: string | null;
}

interface Entrega {
  id: string;
  status: string;
  serviceFamily: string;
  cliente: string;
  produto: string | null;
  responsavelNome: string | null;
  negocioId: string | null;
  negocioTitulo: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const TRILHA_POR_FAMILIA: Record<string, { label: string; href: string }> = {
  CALLFACE_AI: { label: "Onboarding", href: "/pos-venda/onboarding" },
  PABX: { label: "Implantação PABX", href: "/pos-venda/implantacao" },
  WHITE_LABEL: { label: "Implantação White Label", href: "/pos-venda/white-label" },
  UNKNOWN: { label: "Validação manual", href: "/pos-venda/validacao" },
};

const STATUS_ITEM = [
  { key: "PENDING", label: "Pendente", cor: "#8899a6", Icone: Circle },
  { key: "IN_PROGRESS", label: "Em andamento", cor: "#06B6D4", Icone: CircleDot },
  { key: "VALIDATION", label: "Validação", cor: "#8e27ef", Icone: ClipboardCheck },
  { key: "BLOCKED", label: "Bloqueado", cor: "#e23752", Icone: Ban },
  { key: "DONE", label: "Concluído", cor: "#c8ff00", Icone: Check },
];

/** Nomes legíveis dos workstreams reais dos três processos. */
const WORKSTREAM_LABEL: Record<string, string> = {
  levantamento: "Levantamento de informações",
  portabilidade: "Portabilidade",
  softswitch: "Softswitch / SIPRoute",
  infraestrutura: "Infraestrutura",
  licenciamento: "Licenciamento",
  configuracao_pbx: "Configuração do PBX",
  qa_interno: "Testes internos",
  validacao_cliente: "Entrega ao cliente",
  abertura: "Abertura",
  crm_integracao: "CRM e integração",
  acessos: "Acessos",
  dados_empresa: "Dados da empresa",
  usuarios_times: "Usuários e times",
  primeira_ligacao: "Primeira ligação",
  scorecard_insights: "Scorecard e insights",
  proximos_passos: "Próximos passos",
  relatorios: "Relatórios",
  reunioes_online: "Reuniões online",
  campanhas: "Campanhas",
  agente_prompt: "Agente — prompt",
  agente_config: "Agente — configuração",
  first_message: "First Message",
  bateria_testes: "Bateria de testes",
  sla_canais: "SLA e canais",
  validacao_final: "Critério de sucesso",
  acesso: "Acesso",
  branding: "Branding",
  dominio: "Domínio",
  ambiente: "Ambiente",
  capacidade: "Capacidade",
  qualidade: "Qualidade",
  treinamento: "Treinamento",
  ativacao: "Ativação",
  handoff: "Handoff",
};

export function DetalheEntrega({ fulfillmentId }: { fulfillmentId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [bloqueando, setBloqueando] = useState<string | null>(null);
  const [motivoBloqueio, setMotivoBloqueio] = useState("");

  const { data, isLoading } = useQuery<{ fulfillment: Entrega; itens: ItemChecklist[] }>({
    queryKey: ["entrega", fulfillmentId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}`);
      if (!r.ok) throw new Error("falha ao carregar a entrega");
      return r.json();
    },
  });

  const mudarItem = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/fulfillments/itens/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("falha ao atualizar o item");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entrega", fulfillmentId] }),
    onError: () => toast.error("Não deu pra atualizar o item"),
  });

  const concluirEntrega = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/fulfillments/${fulfillmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!r.ok) throw new Error("falha ao concluir");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Entrega concluída");
      qc.invalidateQueries({ queryKey: ["entrega", fulfillmentId] });
      qc.invalidateQueries({ queryKey: ["pos-venda"] });
    },
    onError: () => toast.error("Não deu pra concluir a entrega"),
  });

  if (isLoading) return <p className="text-sm text-white/30 p-6">Carregando...</p>;
  if (!data) return <p className="text-sm text-white/30 p-6">Entrega não encontrada.</p>;

  const { fulfillment: f, itens } = data;
  const trilha = TRILHA_POR_FAMILIA[f.serviceFamily] || TRILHA_POR_FAMILIA.UNKNOWN;
  const concluidos = itens.filter((i) => i.status === "DONE").length;
  const pct = itens.length > 0 ? Math.round((concluidos / itens.length) * 100) : 0;

  // Agrupa preservando a ordem real do processo (itens já vêm por `ordem`).
  const grupos: { workstream: string; itens: ItemChecklist[] }[] = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.workstream === item.workstream) ultimo.itens.push(item);
    else grupos.push({ workstream: item.workstream, itens: [item] });
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">
      <div className="shrink-0">
        <button
          onClick={() => router.push(trilha.href)}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {trilha.label}
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              {f.cliente}
            </h1>
            <p className="text-[12px] text-white/40">
              {trilha.label}
              {f.produto ? ` · ${f.produto}` : ""}
              {f.responsavelNome ? ` · ${f.responsavelNome}` : " · sem responsável"}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold text-white">
                {concluidos}
                <span className="text-white/30 font-normal">/{itens.length}</span>
              </p>
              <div className="h-1.5 w-28 rounded-full bg-white/[0.06] overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#c8ff00" : "#06B6D4" }}
                />
              </div>
            </div>
            {f.status !== "COMPLETED" && (
              <button
                onClick={() => concluirEntrega.mutate()}
                disabled={concluirEntrega.isPending}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#c8ff00]/10 border border-[#c8ff00]/30 text-[#c8ff00] hover:bg-[#c8ff00]/20 transition-colors disabled:opacity-40"
              >
                Concluir entrega
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {itens.length === 0 ? (
          <div className="rounded-2xl p-6 bg-white/[0.02] border border-white/[0.06]">
            <p className="text-sm text-white/50">Esta entrega não tem checklist.</p>
            <p className="text-xs text-white/30 mt-1">
              Acontece quando a família do produto não foi identificada no fechamento. Defina a família do negócio e
              reprocesse para gerar o checklist certo, em vez de preencher um genérico.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grupos.map((g, gi) => (
              <div key={`${g.workstream}-${gi}`}>
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  {WORKSTREAM_LABEL[g.workstream] || g.workstream}
                </h2>
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
                  {g.itens.map((item) => {
                    const atual = STATUS_ITEM.find((s) => s.key === item.status) || STATUS_ITEM[0];
                    return (
                      <div key={item.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() =>
                              mudarItem.mutate({
                                id: item.id,
                                body: { status: item.status === "DONE" ? "PENDING" : "DONE" },
                              })
                            }
                            className="shrink-0 mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors"
                            style={{
                              borderColor: item.status === "DONE" ? "#c8ff00" : "rgba(255,255,255,0.15)",
                              backgroundColor: item.status === "DONE" ? "#c8ff0020" : "transparent",
                            }}
                            title={item.status === "DONE" ? "Reabrir" : "Concluir"}
                          >
                            {item.status === "DONE" && <Check className="w-3 h-3 text-[#c8ff00]" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm ${
                                item.status === "DONE" ? "text-white/35 line-through" : "text-white/85"
                              }`}
                            >
                              {item.titulo}
                            </p>

                            {item.status === "BLOCKED" && item.blockerReason && (
                              <p className="text-[11px] text-[#e23752] mt-1">Bloqueio: {item.blockerReason}</p>
                            )}

                            {bloqueando === item.id && (
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  autoFocus
                                  value={motivoBloqueio}
                                  onChange={(e) => setMotivoBloqueio(e.target.value)}
                                  placeholder="Motivo do bloqueio..."
                                  className="flex-1 px-2 py-1 rounded-lg text-xs bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50"
                                />
                                <button
                                  onClick={() => {
                                    mudarItem.mutate({
                                      id: item.id,
                                      body: {
                                        status: "BLOCKED",
                                        blockerType: "INTERNAL",
                                        blockerReason: motivoBloqueio || null,
                                      },
                                    });
                                    setBloqueando(null);
                                    setMotivoBloqueio("");
                                  }}
                                  className="px-2 py-1 rounded-lg text-xs bg-[#e23752]/15 text-[#e23752]"
                                >
                                  Bloquear
                                </button>
                                <button
                                  onClick={() => { setBloqueando(null); setMotivoBloqueio(""); }}
                                  className="px-2 py-1 rounded-lg text-xs text-white/40 hover:text-white/70"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            {STATUS_ITEM.filter((s) => s.key !== "DONE").map((s) => {
                              const ativo = item.status === s.key;
                              return (
                                <button
                                  key={s.key}
                                  onClick={() => {
                                    if (s.key === "BLOCKED") {
                                      setBloqueando(item.id);
                                      setMotivoBloqueio(item.blockerReason || "");
                                      return;
                                    }
                                    mudarItem.mutate({ id: item.id, body: { status: s.key } });
                                  }}
                                  title={s.label}
                                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                                  style={{
                                    backgroundColor: ativo ? `${s.cor}20` : "transparent",
                                    color: ativo ? s.cor : "rgba(255,255,255,0.2)",
                                  }}
                                >
                                  <s.Icone className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
