"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock, Check, ChevronDown, Clock, EllipsisVertical, Flag,
  RefreshCw, ShieldAlert, Wallet, XCircle,
} from "lucide-react";
import {
  Cf2DropdownMenu, Cf2DropdownMenuTrigger, Cf2DropdownMenuContent, Cf2DropdownMenuItem,
} from "@/components/crm2/ui/DropdownMenu";
import { Cf2EmptyState, Cf2Skeleton } from "@/components/crm2/ui/States";
import { iniciaisEmpresa, corAvatarEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";

/**
 * Fila de ação, agrupada por CLIENTE.
 *
 * O backend devolve um item por SINAL, que é o recorte certo pro domínio —
 * mas ler isso na tela dava a impressão de duplicidade: a G30 aparecia três
 * vezes seguidas, uma por fatura/assinatura/checkpoint, e o CS não sabia se
 * eram três clientes ou três problemas do mesmo. Aqui vira uma linha por
 * conta, com o sinal mais grave em destaque e os demais agregados em
 * "+N sinais", expansíveis.
 *
 * O agrupamento é de APRESENTAÇÃO: nenhum sinal é descartado, e cada um
 * mantém sua própria ação ao expandir.
 */

export interface ItemFila {
  chave: string;
  empresaId: string;
  empresaNome: string;
  motivo: string;
  rotulo: string;
  detalhe: string;
  urgencia: "CRITICA" | "ALTA" | "MEDIA";
  severidade: string | null;
  tipoRisco: string | null;
  mrr: string | null;
  ordem: number;
  servicoFamilia: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  ultimaInteracao: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  prazo: string | null;
  tarefaId: string | null;
  riscoId: string | null;
  renovacaoId: string | null;
  cancelamentoId: string | null;
  marcoId: string | null;
}

interface GrupoCliente {
  empresaId: string;
  empresaNome: string;
  mrr: number;
  familia: string | null;
  responsavelNome: string | null;
  ultimaInteracao: string | null;
  proximaAcao: string | null;
  principal: ItemFila;
  outros: ItemFila[];
  urgencia: ItemFila["urgencia"];
}

/** Segmentos da fila. Cada um é um recorte real do que o CS faz de manhã. */
export const SEGMENTOS = [
  { chave: "critico", label: "Crítico" },
  { chave: "hoje", label: "Hoje" },
  { chave: "vencido", label: "Vencido" },
  { chave: "financeiro", label: "Financeiro" },
  { chave: "checkpoint", label: "Checkpoint" },
  { chave: "risco", label: "Risco" },
  { chave: "renovacao", label: "Renovação" },
  { chave: "cancelamento", label: "Cancelamento" },
  { chave: "sem_acao", label: "Sem próxima ação" },
] as const;

const TIPOS_FINANCEIROS = ["FATURA_ATRASADA", "PAGAMENTO_FALHOU", "ASSINATURA_INADIMPLENTE"];

/** Um item pertence a um segmento? Regra de leitura, não de domínio. */
export function itemNoSegmento(i: ItemFila, segmento: string): boolean {
  switch (segmento) {
    case "critico": return i.urgencia === "CRITICA";
    case "hoje": return i.motivo === "TAREFA_HOJE";
    case "vencido": return i.motivo === "TAREFA_VENCIDA";
    case "financeiro": return !!i.tipoRisco && TIPOS_FINANCEIROS.includes(i.tipoRisco);
    case "checkpoint": return i.motivo === "MARCO";
    case "risco": return i.motivo === "RISCO" && (!i.tipoRisco || !TIPOS_FINANCEIROS.includes(i.tipoRisco));
    case "renovacao": return i.motivo === "RENOVACAO";
    case "cancelamento": return i.motivo === "CANCELAMENTO";
    case "sem_acao": return !i.proximaAcao;
    // Segmento desconhecido não filtra nada em vez de tudo: `true` aqui foi o
    // bug que fez o chip "Expansão" mostrar a fila inteira.
    default: return false;
  }
}

const ICONE_MOTIVO: Record<string, React.ElementType> = {
  CANCELAMENTO: XCircle, RISCO: ShieldAlert, TAREFA_VENCIDA: Clock,
  TAREFA_HOJE: Clock, RENOVACAO: RefreshCw, MARCO: Flag, SEM_PROXIMA_ACAO: CalendarClock,
};

/**
 * Escala de severidade. Vermelho só em crítico — se tudo é vermelho, nada é.
 * Alta usa âmbar, média fica neutra.
 */
const TOM: Record<ItemFila["urgencia"], { faixa: string; texto: string; fundo: string; rotulo: string }> = {
  CRITICA: { faixa: "var(--cf2-home-danger)", texto: "var(--cf2-danger-text)", fundo: "#fceded", rotulo: "Crítico" },
  ALTA: { faixa: "var(--cf2-warning-text)", texto: "var(--cf2-warning-text)", fundo: "var(--cf2-warning-bg)", rotulo: "Atenção" },
  MEDIA: { faixa: "var(--cf2-border-default)", texto: "var(--cf2-text-secondary)", fundo: "var(--cf2-bg-surface-muted)", rotulo: "Normal" },
};

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Produto em revisão",
};

function familias(bruto: string | null): string {
  if (!bruto) return "";
  return bruto.split(",").map((f) => FAMILIA_LABEL[f.trim()] ?? f.trim()).join(" · ");
}

function brl(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function diasDesde(iso: string | null): string {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `${d}d`;
}

/** Há quanto tempo o problema existe — o que diz se está escalando. */
function idadeDoProblema(i: ItemFila): string | null {
  if (!i.prazo) return null;
  const dias = Math.round((Date.now() - new Date(i.prazo).getTime()) / 86_400_000);
  if (dias > 0) return `${dias}d parado`;
  if (dias === 0) return "vence hoje";
  return `em ${Math.abs(dias)}d`;
}

export function agruparPorCliente(itens: ItemFila[]): GrupoCliente[] {
  const porEmpresa = new Map<string, ItemFila[]>();
  for (const i of itens) {
    const lista = porEmpresa.get(i.empresaId) ?? [];
    lista.push(i);
    porEmpresa.set(i.empresaId, lista);
  }

  const grupos: GrupoCliente[] = [];
  for (const [empresaId, lista] of porEmpresa) {
    // A fila já vem ordenada por urgência; o primeiro do cliente é o pior.
    const [principal, ...outros] = lista;
    grupos.push({
      empresaId,
      empresaNome: principal.empresaNome,
      mrr: Number(principal.mrr ?? 0),
      familia: principal.servicoFamilia,
      responsavelNome: principal.responsavelNome,
      ultimaInteracao: principal.ultimaInteracao,
      proximaAcao: principal.proximaAcao,
      principal,
      outros,
      urgencia: principal.urgencia,
    });
  }

  grupos.sort((a, b) => {
    if (a.principal.ordem !== b.principal.ordem) return a.principal.ordem - b.principal.ordem;
    // Empate de urgência: mais sinais primeiro, depois MRR maior. Conta com
    // três problemas ao mesmo tempo é pior que conta com um.
    const sinaisA = a.outros.length, sinaisB = b.outros.length;
    if (sinaisA !== sinaisB) return sinaisB - sinaisA;
    return b.mrr - a.mrr;
  });

  return grupos;
}

export function Cf2CsFila({
  itens, carregando, segmento, busca, onLimpar,
}: {
  itens: ItemFila[]; carregando: boolean; segmento: string | null; busca: string; onLimpar: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [expandido, setExpandido] = useState<string | null>(null);

  const grupos = useMemo(() => {
    let filtrados = segmento ? itens.filter((i) => itemNoSegmento(i, segmento)) : itens;
    if (busca.trim()) {
      const t = busca.trim().toLowerCase();
      filtrados = filtrados.filter((i) => i.empresaNome.toLowerCase().includes(t));
    }
    return agruparPorCliente(filtrados);
  }, [itens, segmento, busca]);

  const invalidar = () => {
    for (const k of ["cs-fila", "cs-pulso", "cs-painel", "cs-agenda"]) qc.invalidateQueries({ queryKey: [k] });
  };

  const concluir = useMutation({
    mutationFn: async (tarefaId: string) => {
      const r = await fetch(`/api/cs/tarefas/${tarefaId}/concluir`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!r.ok) throw new Error("Não foi possível concluir");
      return r.json();
    },
    onSuccess: () => { toast.success("Concluída"); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reagendar = useMutation({
    mutationFn: async ({ tarefaId, dias }: { tarefaId: string; dias: number }) => {
      const r = await fetch(`/api/cs/tarefas/${tarefaId}/reagendar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venceEm: new Date(Date.now() + dias * 86_400_000).toISOString() }),
      });
      if (!r.ok) throw new Error("Não foi possível reagendar");
      return r.json();
    },
    onSuccess: () => { toast.success("Reagendada"); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (carregando) {
    return <div className="flex flex-col gap-1.5">{Array.from({ length: 8 }).map((_, i) => <Cf2Skeleton key={i} className="h-[58px]" />)}</div>;
  }

  if (grupos.length === 0) {
    return (
      <Cf2EmptyState
        title={segmento || busca ? "Nenhum cliente neste recorte" : "Nada exigindo ação agora"}
        description={segmento || busca
          ? "Limpe o filtro para ver a fila inteira."
          : "Fatura vencida, assinatura irregular, tarefa atrasada, checkpoint e pedido de cancelamento aparecem aqui automaticamente."}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {(segmento || busca) && (
        <button onClick={onLimpar} className="self-start text-[11.5px] font-semibold mb-2" style={{ color: "var(--cf2-text-secondary)" }}>
          Filtro ativo — limpar
        </button>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cf2-border-default)" }}>
        {grupos.map((g, idx) => {
          const tom = TOM[g.urgencia];
          const Icone = ICONE_MOTIVO[g.principal.motivo] ?? ShieldAlert;
          const aberto = expandido === g.empresaId;
          const idade = idadeDoProblema(g.principal);
          // A próxima ação da conta quase sempre é a tarefa gerada por um dos
          // sinais que já estão nesta linha (o principal OU um dos agregados).
          // Compara contra todos: comparar só com o principal deixava passar
          // "próxima: Fatura vencida..." numa linha cujo sinal principal era a
          // assinatura irregular.
          const sinaisDoGrupo = [g.principal, ...g.outros];
          const proximaUtil = g.proximaAcao
            && !sinaisDoGrupo.some((s2) => s2.detalhe.includes(g.proximaAcao!.slice(0, 25))
                                        || g.proximaAcao!.includes(s2.detalhe.slice(0, 25)))
            ? g.proximaAcao : null;

          return (
            <div key={g.empresaId} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--cf2-border-default)" }}>
              {/* Linha densa: 58px. A anterior tinha ~75px com três botões
                  grandes, o que cabia 6 clientes por dobra em vez de 11. */}
              <div
                className="group flex items-center gap-3 px-3 h-[58px] cursor-pointer transition-colors hover:bg-[var(--cf2-bg-surface-muted)]"
                style={{ background: "var(--cf2-bg-surface)" }}
                onClick={() => router.push(`/clientes/cs/${g.empresaId}`)}
              >
                {/* Faixa de severidade: a cor mora aqui, não espalhada na linha. */}
                <span className="w-[3px] h-8 rounded-full shrink-0" style={{ background: tom.faixa }} />

                <span
                  className="flex items-center justify-center w-8 h-8 rounded-[10px] shrink-0 text-[11px] font-bold text-white"
                  style={{ background: corAvatarEmpresa(g.empresaId), color: TEXTO_SOBRE_AVATAR }}
                >
                  {iniciaisEmpresa(g.empresaNome)}
                </span>

                <div className="min-w-0 w-[220px] shrink-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{g.empresaNome}</p>
                  <p className="text-[10.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
                    {familias(g.familia) || "sem serviço"}{g.mrr > 0 ? ` · ${brl(g.mrr)}/mês` : ""}
                  </p>
                </div>

                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <Icone className="w-3.5 h-3.5 shrink-0" style={{ color: tom.texto }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{g.principal.detalhe}</p>
                    <div className="flex items-center gap-1.5 text-[10.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
                      {idade && <span style={{ color: tom.texto, fontWeight: 600 }}>{idade}</span>}
                      <span>contato {diasDesde(g.ultimaInteracao)}</span>
                      {/* A "próxima ação" da conta costuma ser a tarefa gerada
                          pelo próprio sinal — repeti-la aqui só devolve ao CS
                          o texto que ele acabou de ler acima. */}
                      {proximaUtil
                        ? <span className="truncate">· próxima: {proximaUtil}</span>
                        : !g.proximaAcao && <span style={{ color: "var(--cf2-danger-text)" }}>· sem próxima ação</span>}
                    </div>
                  </div>

                  {g.outros.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandido(aberto ? null : g.empresaId); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-semibold shrink-0 whitespace-nowrap"
                      style={{ background: tom.fundo, color: tom.texto }}
                      title={g.outros.map((o) => `${o.rotulo}: ${o.detalhe}`).join("\n")}
                    >
                      +{g.outros.length} {g.outros.length === 1 ? "sinal" : "sinais"}
                      <ChevronDown className="w-3 h-3" style={{ transform: aberto ? "rotate(180deg)" : undefined }} />
                    </button>
                  )}
                </div>

                <div className="w-[104px] shrink-0">
                  {g.responsavelNome ? (
                    <span className="text-[11px] truncate block" style={{ color: "var(--cf2-text-secondary)" }}>{g.responsavelNome}</span>
                  ) : (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
                      style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}
                    >
                      sem dono
                    </span>
                  )}
                </div>

                {/* Ações discretas: só aparecem no hover, e num menu. */}
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <Cf2DropdownMenu>
                    <Cf2DropdownMenuTrigger asChild>
                      <button
                        className="p-1.5 rounded-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity"
                        style={{ color: "var(--cf2-text-tertiary)" }}
                        aria-label="Ações"
                      >
                        <EllipsisVertical className="w-4 h-4" />
                      </button>
                    </Cf2DropdownMenuTrigger>
                    <Cf2DropdownMenuContent align="end">
                      <Cf2DropdownMenuItem onSelect={() => router.push(`/clientes/${g.empresaId}`)}>
                        Abrir Cliente 360
                      </Cf2DropdownMenuItem>
                      {g.principal.tarefaId && (
                        <>
                          <Cf2DropdownMenuItem onSelect={() => concluir.mutate(g.principal.tarefaId!)}>
                            Concluir tarefa
                          </Cf2DropdownMenuItem>
                          <Cf2DropdownMenuItem onSelect={() => reagendar.mutate({ tarefaId: g.principal.tarefaId!, dias: 3 })}>
                            Adiar 3 dias
                          </Cf2DropdownMenuItem>
                        </>
                      )}
                      {g.principal.marcoId && (
                        <Cf2DropdownMenuItem onSelect={() => router.push(`/clientes/cs/${g.empresaId}?marco=${g.principal.marcoId}`)}>
                          Executar checkpoint
                        </Cf2DropdownMenuItem>
                      )}
                      {g.principal.renovacaoId && (
                        <Cf2DropdownMenuItem onSelect={() => router.push(`/clientes/cs/${g.empresaId}`)}>
                          Abrir renovação
                        </Cf2DropdownMenuItem>
                      )}
                    </Cf2DropdownMenuContent>
                  </Cf2DropdownMenu>
                </div>
              </div>

              {aberto && (
                <div className="px-3 pb-2.5 pt-0.5 flex flex-col gap-1" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  {g.outros.map((o) => {
                    const IconeO = ICONE_MOTIVO[o.motivo] ?? ShieldAlert;
                    const tomO = TOM[o.urgencia];
                    return (
                      <div key={o.chave} className="flex items-center gap-2.5 pl-[52px] pr-2 py-1.5 rounded-lg" style={{ background: "var(--cf2-bg-surface)" }}>
                        <IconeO className="w-3 h-3 shrink-0" style={{ color: tomO.texto }} />
                        <span className="text-[11px] font-semibold shrink-0" style={{ color: tomO.texto }}>{o.rotulo}</span>
                        <span className="text-[11.5px] truncate flex-1" style={{ color: "var(--cf2-text-secondary)" }}>{o.detalhe}</span>
                        {o.tarefaId && (
                          <button
                            onClick={() => concluir.mutate(o.tarefaId!)}
                            className="shrink-0 p-1 rounded"
                            style={{ color: "var(--cf2-success-text)" }}
                            title="Concluir"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-2" style={{ color: "var(--cf2-text-tertiary)" }}>
        {grupos.length} {grupos.length === 1 ? "cliente" : "clientes"} · {itens.length} {itens.length === 1 ? "sinal" : "sinais"} no total
      </p>
    </div>
  );
}
