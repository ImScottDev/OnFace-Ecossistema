"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { X, ExternalLink, Pencil, Send, Copy, Ban, FileText, Wallet, Clock } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { Cf2Badge } from "../ui/Badge";
import { statusDisplay, brl } from "./shared";

interface ItemProposta {
  id: string; nome: string; tipo: string; quantidade: string; valorUnitario: string; desconto: string | null; subtotal: string;
}
interface PropostaDetalhe {
  id: string; numero: number; versao: number; status: string;
  leadNome: string | null; leadEmpresa: string | null; leadTelefone: string | null; leadEmail: string | null;
  negocioId: string | null; negocioTitulo: string | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  dataValidade: string | null; prazoContratoMeses?: number | null; condicoesPagamento: string | null; observacoes: string | null;
  criadoPorNome: string | null;
  createdAt: string; enviadaEm: string | null; primeiraVisualizacaoEm: string | null; ultimaVisualizacaoEm: string | null;
  visualizacoes: number; clienteRespondeuEm: string | null; motivoRecusa: string | null;
  itens: ItemProposta[];
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Drawer de proposta (spec+correção do Kauã, 18/08) — abre no clique da
 * linha da tabela (antes ia direto pra `/propostas/:id`). Consome
 * `GET /api/propostas/:id` (já rico: itens reais, timestamps reais de
 * visualização/resposta). Histórico é derivado 100% de campos reais
 * (createdAt/enviadaEm/primeiraVisualizacaoEm/ultimaVisualizacaoEm/
 * clienteRespondeuEm) — não existe uma tabela de eventos de proposta
 * separada hoje, então não fabrico entradas que não vêm de timestamp real.
 */
export function Cf2PropostaDrawer({ propostaId, open, onClose, onChanged }: { propostaId: string | null; open: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [motivoCancelar, setMotivoCancelar] = useState<string | null>(null);

  const { data: proposta, isLoading } = useQuery<PropostaDetalhe>({
    queryKey: ["proposta-detalhe", propostaId],
    queryFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}`);
      if (!r.ok) throw new Error("Proposta não encontrada");
      return r.json();
    },
    enabled: !!propostaId && open,
  });

  const reenviar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}/enviar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falha ao reenviar");
      return j;
    },
    onSuccess: () => { toast.success("Proposta reenviada."); qc.invalidateQueries({ queryKey: ["proposta-detalhe", propostaId] }); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}/nova-versao`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falha ao duplicar");
      return j;
    },
    onSuccess: (nova) => { toast.success(`Nova versão criada (v${nova.versao}).`); onChanged(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falha ao cancelar");
      return j;
    },
    onSuccess: () => { toast.success("Proposta cancelada."); onChanged(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!proposta && !isLoading) return null;

  const status = proposta ? statusDisplay(proposta.status) : null;

  // Desconto agregado real: bruto (qtd × valor unitário, antes de desconto) vs subtotal (depois) — nunca fabricado, sempre derivado dos itens reais.
  const bruto = proposta?.itens.reduce((s, i) => s + parseFloat(i.quantidade) * parseFloat(i.valorUnitario), 0) ?? 0;
  const subtotalItens = proposta?.itens.reduce((s, i) => s + parseFloat(i.subtotal), 0) ?? 0;
  const descontoPct = bruto > 0 && bruto > subtotalItens ? Math.round(((bruto - subtotalItens) / bruto) * 1000) / 10 : 0;

  const historico = proposta ? [
    { label: "Criada", data: proposta.createdAt },
    ...(proposta.enviadaEm ? [{ label: "Enviada", data: proposta.enviadaEm }] : []),
    ...(proposta.primeiraVisualizacaoEm ? [{ label: "Visualizada", data: proposta.primeiraVisualizacaoEm }] : []),
    ...(proposta.ultimaVisualizacaoEm && proposta.ultimaVisualizacaoEm !== proposta.primeiraVisualizacaoEm ? [{ label: `Visualizada novamente (${proposta.visualizacoes}x no total)`, data: proposta.ultimaVisualizacaoEm }] : []),
    ...(proposta.clienteRespondeuEm ? [{ label: proposta.status === "recusada" ? `Recusada${proposta.motivoRecusa ? ` — ${proposta.motivoRecusa}` : ""}` : "Respondeu", data: proposta.clienteRespondeuEm }] : []),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()) : [];

  const footer = proposta && (
    <div className="p-3 flex items-center gap-2 flex-wrap" style={{ background: "var(--cf2-bg-surface)", borderTop: "1px solid var(--cf2-border-default)" }}>
      <a href={`/p/${proposta.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        <ExternalLink className="w-3.5 h-3.5" /> Abrir
      </a>
      {["rascunho", "enviada", "ajuste_solicitado"].includes(proposta.status) && (
        <Link href={`/propostas/novo?propostaId=${proposta.id}`} className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          <Pencil className="w-3.5 h-3.5" /> Editar
        </Link>
      )}
      {["rascunho", "enviada", "ajuste_solicitado"].includes(proposta.status) && (
        <button onClick={() => reenviar.mutate()} disabled={reenviar.isPending} className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold disabled:opacity-50" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          <Send className="w-3.5 h-3.5" /> Reenviar
        </button>
      )}
      <button onClick={() => duplicar.mutate()} disabled={duplicar.isPending} className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold disabled:opacity-50" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        <Copy className="w-3.5 h-3.5" /> Duplicar
      </button>
      <div className="flex-1" />
      {proposta.status !== "aceita" && (
        motivoCancelar === null ? (
          <button onClick={() => setMotivoCancelar("")} className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: "#dc2626" }}><Ban className="w-3.5 h-3.5" /> Cancelar</button>
        ) : (
          <button onClick={() => cancelar.mutate()} disabled={cancelar.isPending} className="text-[13px] font-bold" style={{ color: "#dc2626" }}>Confirmar cancelamento</button>
        )
      )}
    </div>
  );

  return (
    <DetailDrawer open={open && !!propostaId} onClose={onClose} bare panelBg="#ffffff" width="w-full sm:w-[480px]" footer={footer}>
      {isLoading && <div className="p-6 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</div>}
      {proposta && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-secondary)", fontFamily: "var(--cf2-font-heading)" }}>#PROP-{String(proposta.numero).padStart(4, "0")}{proposta.versao > 1 ? ` v${proposta.versao}` : ""}</p>
              <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
            </div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{proposta.leadEmpresa || proposta.leadNome || "—"}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Cf2Badge variant={status!.tom}>{status!.label}</Cf2Badge>
              {proposta.negocioId && (
                <Link href={`/negocios/${proposta.negocioId}`} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Oportunidade: {proposta.negocioTitulo || "ver"} →</Link>
              )}
            </div>
          </div>

          {/* Valor em destaque (24/08, achado do Kauã: modal raso, número
              principal enterrado numa lista) — o mesmo número que já era
              calculado, só ganhou hierarquia visual de hero. */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-accent-soft, var(--cf2-bg-canvas))", border: "1px solid var(--cf2-border-default)" }}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>Valor no 1º mês</p>
              <p className="text-[26px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl(proposta.totalGeral)}</p>
              {parseFloat(proposta.totalRecorrente) > 0 && (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{brl(proposta.totalRecorrente)}/mês recorrente depois</p>
              )}
            </div>
            {descontoPct > 0 && (
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}>-{descontoPct}%</span>
            )}
          </div>

          <div className="flex flex-col gap-2 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[13px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--cf2-text-tertiary)" }}><Wallet className="w-3.5 h-3.5" /> Condições comerciais</p>
            <KV label="Setup / avulso" value={brl(proposta.totalAvulso)} />
            <KV label="Recorrência" value={`${brl(proposta.totalRecorrente)}/mês`} />
            <KV label="Validade" value={proposta.dataValidade ? new Date(proposta.dataValidade).toLocaleDateString("pt-BR") : "—"} />
            {proposta.prazoContratoMeses && <KV label="Vigência contratual" value={`${proposta.prazoContratoMeses} meses`} />}
            <KV label="Responsável" value={proposta.criadoPorNome || "—"} />
            {proposta.condicoesPagamento && <KV label="Condições de pagamento" value={proposta.condicoesPagamento} />}
          </div>

          <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[13px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--cf2-text-tertiary)" }}><FileText className="w-3.5 h-3.5" /> Itens da proposta ({proposta.itens.length})</p>
            {proposta.itens.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem itens.</p>
            ) : proposta.itens.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                <span className="text-[13px] min-w-0 truncate" style={{ color: "var(--cf2-text-primary)" }}>{i.nome} <span className="whitespace-nowrap" style={{ color: "var(--cf2-text-tertiary)" }}>· {i.quantidade}x</span></span>
                <span className="text-[13px] font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{brl(i.subtotal)}{i.tipo === "recorrente" ? "/mês" : ""}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[13px] font-bold uppercase tracking-wide flex items-center gap-1.5 mb-1" style={{ color: "var(--cf2-text-tertiary)" }}><Clock className="w-3.5 h-3.5" /> Histórico</p>
            {historico.map((h, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: i === historico.length - 1 ? "var(--cf2-success-text)" : "var(--cf2-border-default)" }} />
                  {i < historico.length - 1 && <span className="w-px flex-1 my-0.5" style={{ background: "var(--cf2-border-default)" }} />}
                </div>
                <div className="flex-1 min-w-0 pb-3 flex items-center justify-between gap-3">
                  <span className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{h.label}</span>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{fmtDataHora(h.data)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span style={{ color: "var(--cf2-text-tertiary)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{value}</span>
    </div>
  );
}
