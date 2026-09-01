"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toastDark } from "../shared/toast-dark";
import {
  X, Pencil, Plus, Send, Download, Copy, CheckCircle2, MoreHorizontal, Eye, EyeOff, Clock,
} from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { Cf2Badge } from "../ui/Badge";
import { Cf2Button } from "../ui/Button";
import { Cf2ChromeCard } from "../shared/ChromeCard";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger, Cf2TabsContent } from "../ui/Tabs";
import {
  Cf2DropdownMenu, Cf2DropdownMenuContent, Cf2DropdownMenuItem, Cf2DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { statusDisplay, resolveEtapaNegocio, brl } from "./shared";

interface ItemProposta { id: string; nome: string; tipo: string; quantidade: string; valorUnitario: string; subtotal: string }
interface PropostaDetalhe {
  id: string; numero: number; versao: number; status: string;
  leadNome: string | null; leadEmpresa: string | null; leadTelefone: string | null; leadEmail: string | null;
  negocioId: string | null; negocioTitulo: string | null; negocioStatus: string | null;
  totalGeral: string; dataValidade: string | null; condicoesPagamento: string | null; observacoes: string | null;
  criadoPorNome: string | null; checkoutUrl: string | null;
  createdAt: string; enviadaEm: string | null; primeiraVisualizacaoEm: string | null; ultimaVisualizacaoEm: string | null;
  visualizacoes: number; clienteRespondeuEm: string | null; motivoRecusa: string | null;
  itens: ItemProposta[];
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function diasRestantes(iso: string): string {
  const dias = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return "Expirada";
  if (dias === 0) return "Expira hoje";
  return `Em ${dias}d`;
}

/**
 * Drawer de proposta, versão 2 (25/08, referência visual do Kauã — dark,
 * tracking/ações rápidas/histórico/tabs). A versão anterior tinha sido
 * removida no mesmo dia em favor só da página `/propostas/[id]`; o Kauã
 * pediu o drawer DE VOLTA como preview rápido (Gmail-style lista+preview) —
 * a página continua existindo pra gestão completa (Aceitar com conversão em
 * cliente, Recusar com motivo, PDF, Excluir), o drawer cobre o caso comum
 * sem sair da lista. "Tempo médio"/"dispositivo" do mockup NÃO entraram —
 * não existe esse tracking no schema, não fabrico.
 */
export function Cf2PropostaDrawer({ propostaId, open, onClose, onChanged }: { propostaId: string | null; open: boolean; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  const { data: proposta, isLoading } = useQuery<PropostaDetalhe>({
    queryKey: ["proposta-detalhe", propostaId],
    queryFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}`);
      if (!r.ok) throw new Error("Proposta não encontrada");
      return r.json();
    },
    enabled: !!propostaId && open,
  });

  const invalidar = () => { qc.invalidateQueries({ queryKey: ["proposta-detalhe", propostaId] }); onChanged(); };

  const reenviar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}/enviar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falha ao reenviar");
      return j;
    },
    onSuccess: () => { toastDark.success("Proposta reenviada."); invalidar(); },
    onError: (e: Error) => toastDark.error(e.message),
  });

  const marcarAprovada = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}/aceitar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avancarLeadStatus: false }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falha ao aprovar");
      return j;
    },
    onSuccess: () => { toastDark.success("Proposta marcada como aceita."); invalidar(); },
    onError: (e: Error) => toastDark.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${propostaId}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "falha ao excluir");
      return j;
    },
    onSuccess: () => { toastDark.success("Proposta excluída."); onChanged(); onClose(); },
    onError: (e: Error) => toastDark.error(e.message),
  });

  if (!proposta && !isLoading) return null;

  const status = proposta ? statusDisplay(proposta.status) : null;
  const etapa = proposta ? resolveEtapaNegocio(proposta.negocioStatus) : null;
  const editavel = proposta ? ["rascunho", "enviada", "ajuste_solicitado"].includes(proposta.status) : false;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://crm.callface.io";
  const linkCliente = proposta?.checkoutUrl ? `${origin}/p/${proposta.id}` : null;
  const copiar = async (texto: string, ok: string) => {
    try { await navigator.clipboard.writeText(texto); toastDark.success(ok); } catch { toastDark.error("Não consegui copiar"); }
  };

  const historico = proposta ? [
    { label: "Criada", data: proposta.createdAt },
    ...(proposta.enviadaEm ? [{ label: "Enviada ao cliente", data: proposta.enviadaEm }] : []),
    ...(proposta.primeiraVisualizacaoEm ? [{ label: "Visualizada pelo cliente", data: proposta.primeiraVisualizacaoEm }] : []),
    ...(proposta.ultimaVisualizacaoEm && proposta.ultimaVisualizacaoEm !== proposta.primeiraVisualizacaoEm ? [{ label: `Visualizada novamente (${proposta.visualizacoes}x no total)`, data: proposta.ultimaVisualizacaoEm }] : []),
    ...(proposta.clienteRespondeuEm ? [{ label: proposta.status === "recusada" ? `Recusada${proposta.motivoRecusa ? ` — ${proposta.motivoRecusa}` : ""}` : "Aceita pelo cliente", data: proposta.clienteRespondeuEm }] : []),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()) : [];

  const footer = proposta && (
    <div className="p-3 flex items-center gap-2" style={{ background: "var(--cf2-chrome-bg-alt)", borderTop: "1px solid var(--cf2-chrome-border-subtle)" }}>
      {editavel && (
        <Cf2Button className="flex-1" onClick={() => router.push(`/propostas/novo?propostaId=${proposta.id}`)}>
          <Pencil className="w-3.5 h-3.5" /> Editar proposta
        </Cf2Button>
      )}
      <Cf2Button variant="secondary" className={editavel ? "" : "flex-1"} style={{ border: "1px solid var(--cf2-chrome-border-subtle)", background: "transparent", color: "var(--cf2-chrome-text-primary)" }} onClick={() => router.push("/propostas/novo")}>
        <Plus className="w-3.5 h-3.5" /> Nova proposta
      </Cf2Button>
    </div>
  );

  return (
    <DetailDrawer open={open && !!propostaId} onClose={onClose} bare panelBg="var(--cf2-chrome-bg-alt)" borderColor="var(--cf2-chrome-border-subtle)" width="w-full sm:w-[460px]" footer={footer}>
      {isLoading && <div className="p-6 text-sm" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Carregando...</div>}
      {proposta && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <p className="text-[16px] font-bold font-mono" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>#PROP-{String(proposta.numero).padStart(4, "0")}{proposta.versao > 1 ? ` v${proposta.versao}` : ""}</p>
              <p className="text-[14px] font-semibold" style={{ color: "var(--cf2-chrome-text-primary)" }}>{proposta.leadEmpresa || proposta.leadNome || "—"}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Cf2Badge dark variant={status!.tom}>{status!.label}</Cf2Badge>
                {proposta.negocioId && (
                  <Link href={`/negocios/${proposta.negocioId}`} className="text-[12px] font-medium hover:underline" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{proposta.negocioTitulo || "ver negócio"} →</Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Cf2DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <Cf2DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-md hover:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-secondary)" }}><MoreHorizontal className="w-4 h-4" /></button>
                </Cf2DropdownMenuTrigger>
                <Cf2DropdownMenuContent align="end" className="min-w-[200px]" style={{ background: "#1c1f26", border: "1px solid var(--cf2-chrome-border-subtle)" }}>
                  <Cf2DropdownMenuItem onClick={() => router.push(`/propostas/${proposta.id}`)} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>Ver página completa</Cf2DropdownMenuItem>
                  {editavel && (
                    <Cf2DropdownMenuItem onClick={() => reenviar.mutate()} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-primary)" }}>Reenviar ao cliente</Cf2DropdownMenuItem>
                  )}
                  {proposta.status !== "aceita" && (
                    confirmarExcluir ? (
                      <Cf2DropdownMenuItem onClick={() => excluir.mutate()} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "#f87171" }}>Confirmar exclusão</Cf2DropdownMenuItem>
                    ) : (
                      <Cf2DropdownMenuItem onClick={(e) => { e.preventDefault(); setConfirmarExcluir(true); }} className="data-[highlighted]:bg-white/[0.06]" style={{ color: "#f87171" }}>Excluir</Cf2DropdownMenuItem>
                    )
                  )}
                </Cf2DropdownMenuContent>
              </Cf2DropdownMenu>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/[0.06]" style={{ color: "var(--cf2-chrome-text-secondary)" }}><X className="w-4 h-4" /></button>
            </div>
          </div>

          <Cf2ChromeCard>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Resumo</p>
            <div className="flex flex-col gap-2">
              <KV label="Cliente" value={proposta.leadEmpresa || proposta.leadNome || "—"} />
              {proposta.negocioId && <KV label="Negócio" value={proposta.negocioTitulo || "—"} href={`/negocios/${proposta.negocioId}`} />}
              {etapa && <KV label="Etapa" value={etapa.label} />}
              <KV label="Responsável" value={proposta.criadoPorNome || "—"} />
              {proposta.condicoesPagamento && <KV label="Condições de pagamento" value={proposta.condicoesPagamento} />}
            </div>
          </Cf2ChromeCard>

          <div className="grid grid-cols-2 gap-3">
            <Cf2ChromeCard>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Valor total</p>
              <p className="text-[20px] font-bold mt-1" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{brl(proposta.totalGeral)}</p>
            </Cf2ChromeCard>
            <Cf2ChromeCard>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Validade</p>
              <p className="text-[16px] font-bold mt-1" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{proposta.dataValidade ? new Date(proposta.dataValidade).toLocaleDateString("pt-BR") : "—"}</p>
              {proposta.dataValidade && <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{diasRestantes(proposta.dataValidade)}</p>}
            </Cf2ChromeCard>
          </div>

          <Cf2ChromeCard>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Tracking da proposta</p>
              <button onClick={() => router.push(`/propostas/${proposta.id}`)} className="text-[11px] font-medium flex items-center gap-1 hover:underline" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Ver detalhes →</button>
            </div>
            <div className="flex items-center gap-2">
              {proposta.primeiraVisualizacaoEm ? <Eye className="w-4 h-4 shrink-0" style={{ color: "#4ade80" }} /> : <EyeOff className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-chrome-text-secondary)" }} />}
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-primary)" }}>
                {proposta.primeiraVisualizacaoEm
                  ? `Visualizada pelo cliente · ${fmtDataHora(proposta.primeiraVisualizacaoEm)}${proposta.visualizacoes > 1 ? ` · ${proposta.visualizacoes}x` : ""}`
                  : proposta.enviadaEm ? "Enviada, ainda não aberta pelo cliente" : "Ainda não enviada"}
              </p>
            </div>
          </Cf2ChromeCard>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Ações rápidas</p>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={Send} label="Enviar novamente" onClick={editavel ? () => reenviar.mutate() : undefined} loading={reenviar.isPending} />
              <QuickAction icon={Download} label="Baixar PDF" onClick={proposta.itens.length > 0 ? () => window.open(`/api/propostas/${proposta.id}/pdf`, "_blank") : undefined} />
              <QuickAction icon={Copy} label="Compartilhar link" onClick={linkCliente ? () => copiar(linkCliente, "Link copiado") : undefined} />
              <QuickAction icon={CheckCircle2} label="Marcar como aceita" onClick={proposta.status === "enviada" ? () => marcarAprovada.mutate() : undefined} loading={marcarAprovada.isPending} />
            </div>
          </div>

          <Cf2ChromeCard>
            <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2" style={{ color: "var(--cf2-chrome-text-secondary)" }}><Clock className="w-3.5 h-3.5" /> Histórico</p>
            <div className="flex flex-col gap-0">
              {historico.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: i === historico.length - 1 ? "var(--cf2-chrome-text-secondary)" : "var(--cf2-chrome-border-subtle)" }} />
                    {i < historico.length - 1 && <span className="w-px flex-1 my-0.5" style={{ background: "var(--cf2-chrome-border-subtle)" }} />}
                  </div>
                  <div className="flex-1 min-w-0 pb-3 flex items-center justify-between gap-3">
                    <span className="text-[13px]" style={{ color: "var(--cf2-chrome-text-primary)" }}>{h.label}</span>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{fmtDataHora(h.data)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Cf2ChromeCard>

          <Cf2Tabs defaultValue="produtos">
            <Cf2TabsList style={{ background: "rgba(255,255,255,0.06)" }}>
              <Cf2TabsTrigger value="produtos" className="data-[state=active]:bg-white/10 data-[state=active]:text-white" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Produtos e serviços</Cf2TabsTrigger>
              <Cf2TabsTrigger value="observacoes" className="data-[state=active]:bg-white/10 data-[state=active]:text-white" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Observações</Cf2TabsTrigger>
            </Cf2TabsList>
            <Cf2TabsContent value="produtos" className="flex flex-col gap-1 pt-2">
              {proposta.itens.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Sem itens.</p>
              ) : proposta.itens.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-1.5 border-b" style={{ borderColor: "var(--cf2-chrome-border-subtle)" }}>
                  <span className="text-[13px] min-w-0 truncate" style={{ color: "var(--cf2-chrome-text-primary)" }}>{i.nome} <span style={{ color: "var(--cf2-chrome-text-secondary)" }}>· {i.quantidade}x</span></span>
                  <span className="text-[13px] font-semibold shrink-0" style={{ color: "var(--cf2-chrome-text-primary)" }}>{brl(i.subtotal)}{i.tipo === "recorrente" ? "/mês" : ""}</span>
                </div>
              ))}
            </Cf2TabsContent>
            <Cf2TabsContent value="observacoes" className="pt-2">
              <p className="text-[13px] whitespace-pre-wrap" style={{ color: proposta.observacoes ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}>{proposta.observacoes || "Sem observações."}</p>
            </Cf2TabsContent>
          </Cf2Tabs>
        </div>
      )}
    </DetailDrawer>
  );
}

function KV({ label, value, href, color }: { label: string; value: string; href?: string; color?: string }) {
  const valueEl = href ? (
    <Link href={href} className="font-semibold hover:underline" style={{ color: color || "var(--cf2-chrome-text-primary)" }}>{value}</Link>
  ) : (
    <span className="font-semibold" style={{ color: color || "var(--cf2-chrome-text-primary)" }}>{value}</span>
  );
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</span>
      {valueEl}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, loading }: { icon: typeof Send; label: string; onClick?: () => void; loading?: boolean }) {
  const disabled = !onClick || loading;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 h-10 px-3 rounded-lg text-[12px] font-medium disabled:opacity-40 hover:bg-white/[0.06] transition-colors"
      style={{ border: "1px solid var(--cf2-chrome-border-subtle)", color: "var(--cf2-chrome-text-primary)" }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
    </button>
  );
}
