"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Phone, StickyNote, MessageCircle, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { ChartCard } from "./charts/ChartCard";

interface DiaStats {
  ligacoes: number;
  duracaoLigacoesSegundos: number;
  notas: number;
  mensagens: number;
  mudancasEstagio: number;
  tarefasConcluidas: number;
  total: number;
}
interface Membro {
  usuarioId: string;
  nome: string;
  role: string;
  porDia: Record<string, DiaStats>;
  totais: DiaStats;
  diasAtivos: number;
}
interface AtividadeTimeResponse {
  dias: string[];
  membros: Membro[];
}
interface FeedItem {
  tipo: "ligacao" | "nota" | "whatsapp" | "status_change" | "tarefa";
  titulo: string;
  contexto: string | null;
  leadId: string | null;
  negocioId: string | null;
  createdAt: string;
}
interface Resumo {
  ligacoes: number;
  notas: number;
  mensagens: number;
  mudancasEstagio: number;
  tarefasConcluidas: number;
  total: number;
}

const TIPO_LABEL: Record<FeedItem["tipo"], string> = {
  ligacao: "Ligações",
  nota: "Notas",
  whatsapp: "Mensagens",
  status_change: "Mudanças de estágio",
  tarefa: "Tarefas",
};

function linkDoItem(item: FeedItem): string | null {
  if (item.negocioId) return `/negocios/${item.negocioId}`;
  if (item.leadId) return `/contatos/${item.leadId}`;
  return null;
}

const TIPO_ICON: Record<FeedItem["tipo"], typeof Phone> = {
  ligacao: Phone,
  nota: StickyNote,
  whatsapp: MessageCircle,
  status_change: ArrowRight,
  tarefa: CheckCircle2,
};

const TIPO_COLOR: Record<FeedItem["tipo"], string> = {
  ligacao: "#3B82F6",
  nota: "#F59E0B",
  whatsapp: "#10B981",
  status_change: "#8e27ef",
  tarefa: "#c8ff00",
};

function corCelula(total: number) {
  if (total === 0) return "rgba(255,255,255,0.02)";
  if (total <= 3) return "rgba(59,130,246,0.18)";
  if (total <= 8) return "rgba(59,130,246,0.35)";
  return "rgba(59,130,246,0.55)";
}

function fmtDiaLabel(dia: string) {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

function DiaFeedModal({ usuarioId, nome, dia, onClose }: { usuarioId: string; nome: string; dia: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ resumo: Resumo; itens: FeedItem[] }>({
    queryKey: ["relatorios", "atividade-time", "dia", usuarioId, dia],
    queryFn: () => fetch(`/api/relatorios/atividade-time/${usuarioId}/${dia}`).then((r) => r.json()),
  });

  const resumoTipos: { tipo: FeedItem["tipo"]; qtd: number }[] = data
    ? (
        [
          { tipo: "ligacao", qtd: data.resumo.ligacoes },
          { tipo: "nota", qtd: data.resumo.notas },
          { tipo: "whatsapp", qtd: data.resumo.mensagens },
          { tipo: "status_change", qtd: data.resumo.mudancasEstagio },
          { tipo: "tarefa", qtd: data.resumo.tarefasConcluidas },
        ] as { tipo: FeedItem["tipo"]; qtd: number }[]
      ).filter((r) => r.qtd > 0)
    : [];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#15161c] p-5 space-y-4"
        style={{ boxShadow: "0 24px 48px rgba(16,24,40,.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">{nome}</h3>
            <p className="text-xs text-white/40">{fmtDiaLabel(dia)} · {data?.resumo.total ?? 0} atividade(s)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-white/30 text-sm">Carregando...</div>
        ) : !data?.itens?.length ? (
          <div className="py-8 text-center text-white/30 text-sm">Nenhuma atividade registrada nesse dia.</div>
        ) : (
          <>
            {/* Resumo — quantas de cada tipo, antes de mergulhar item a item */}
            <div className="flex flex-wrap gap-2">
              {resumoTipos.map(({ tipo, qtd }) => {
                const Icon = TIPO_ICON[tipo];
                const cor = TIPO_COLOR[tipo];
                return (
                  <div key={tipo} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: cor + "12" }}>
                    <Icon size={12} style={{ color: cor }} />
                    <span className="text-xs font-semibold text-white">{qtd}</span>
                    <span className="text-[11px] text-white/50">{TIPO_LABEL[tipo]}</span>
                  </div>
                );
              })}
            </div>

            {/* Feed — cada item leva pro lead/negócio de verdade quando existe destino */}
            <div className="space-y-1">
              {data.itens.map((item, i) => {
                const Icon = TIPO_ICON[item.tipo];
                const cor = TIPO_COLOR[item.tipo];
                const href = linkDoItem(item);
                const conteudo = (
                  <>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: cor + "20" }}>
                      <Icon size={13} style={{ color: cor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80">{item.titulo}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">
                        {item.contexto && <span>{item.contexto} · </span>}
                        {new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {href && <ExternalLink size={12} className="text-white/20 shrink-0 mt-1" />}
                  </>
                );
                return href ? (
                  <Link
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <div key={i} className="flex gap-2.5 p-1.5 -mx-1.5">
                    {conteudo}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function TabAtividadeTime() {
  const [selecionado, setSelecionado] = useState<{ usuarioId: string; nome: string; dia: string } | null>(null);

  const { data, isLoading } = useQuery<AtividadeTimeResponse>({
    queryKey: ["relatorios", "atividade-time"],
    queryFn: () => fetch(`/api/relatorios/atividade-time?dias=14`).then((r) => r.json()),
  });

  const dias = data?.dias ?? [];
  const membros = data?.membros ?? [];

  return (
    <div className="space-y-4">
      <ChartCard
        title="Atividade do time (últimos 14 dias)"
        subtitle="Ligação, nota, mensagem, mudança de estágio e tarefa concluída — esforço real por pessoa, dia a dia. Clique num quadrado pra ver o detalhe. Ordenado por quem trabalhou menos."
        loading={isLoading}
        empty={membros.length === 0}
        emptyText="Nenhum usuário ativo encontrado"
      >
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#15161c] text-[11px] font-medium text-white/40 uppercase tracking-wider pb-2 pr-3 whitespace-nowrap">Pessoa</th>
                {dias.map((d) => (
                  <th key={d} className="text-[10px] font-medium text-white/30 pb-2 px-1 text-center whitespace-nowrap">{fmtDiaLabel(d)}</th>
                ))}
                <th className="text-[11px] font-medium text-white/40 uppercase tracking-wider pb-2 pl-3 text-right whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.usuarioId} className="border-t border-white/[0.04]">
                  <td className="sticky left-0 bg-[#15161c] py-2 pr-3 whitespace-nowrap">
                    <p className="text-[13px] text-white/80">{m.nome}</p>
                    <p className="text-[10px] text-white/30 capitalize">{m.role} · {m.diasAtivos}/{dias.length} dias ativos</p>
                  </td>
                  {dias.map((d) => {
                    const s = m.porDia[d];
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        <button
                          onClick={() => setSelecionado({ usuarioId: m.usuarioId, nome: m.nome, dia: d })}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-medium text-white/70 hover:ring-1 hover:ring-white/20 transition-all"
                          style={{ background: corCelula(s?.total ?? 0) }}
                          title={`${s?.ligacoes ?? 0} ligações · ${s?.notas ?? 0} notas · ${s?.mensagens ?? 0} mensagens · ${s?.mudancasEstagio ?? 0} mudanças de estágio · ${s?.tarefasConcluidas ?? 0} tarefas`}
                        >
                          {s?.total ? s.total : ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className="pl-3 py-2 text-right">
                    <p className="text-sm font-semibold text-white">{m.totais.total}</p>
                    <p className="text-[10px] text-white/30 whitespace-nowrap">
                      {m.totais.ligacoes} lig · {m.totais.notas} not · {m.totais.mensagens} msg
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {selecionado && (
        <DiaFeedModal
          usuarioId={selecionado.usuarioId}
          nome={selecionado.nome}
          dia={selecionado.dia}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  );
}
