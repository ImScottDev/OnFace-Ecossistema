"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, FileText, Pencil, Send, Check, X, Trash2, Copy, Link2, MessageCircle, Eye, EyeOff,
} from "lucide-react";
import { Cf2Card } from "../ui/Card";
import { Cf2Badge } from "../ui/Badge";
import { Cf2Button } from "../ui/Button";
import {
  Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle, Cf2DialogDescription, Cf2DialogFooter,
} from "../ui/Dialog";
import { MOEDAS, getMoedaInfo, formatCurrencyValue } from "@/components/crm/proposta-utils";

interface Item {
  id: string; nome: string; descricao: string | null; tipo: string;
  quantidade: string; valorUnitario: string; desconto: string; descontoTipo: string; subtotal: string;
}
interface Proposta {
  id: string; numero: number; versao: number; status: string; moeda: string;
  leadId: string | null; leadNome: string | null; leadEmpresa: string | null; leadTelefone: string | null; leadEmail: string | null;
  negocioId: string | null; negocioTitulo: string | null;
  checkoutUrl: string | null; checkoutStatus: { status: string; paymentStatus: string } | null;
  dataEmissao: string | null; dataValidade: string | null; observacoes: string | null;
  condicoesPagamento: string | null; prazoContratoMeses: number | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  contratoId: string | null; criadoPorNome: string | null; createdAt: string;
  enviadaEm: string | null; primeiraVisualizacaoEm: string | null; ultimaVisualizacaoEm: string | null;
  visualizacoes: number | null; clienteRespondeuEm: string | null; motivoRecusa: string | null;
  itens: Item[];
}

const STATUS_VARIANT: Record<string, "neutral" | "accent" | "success" | "danger" | "warning"> = {
  rascunho: "neutral", enviada: "accent", aceita: "success", recusada: "danger", expirada: "warning",
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviada: "Enviada", aceita: "Aceita", recusada: "Recusada", expirada: "Expirada",
};
const TIPO_LABEL: Record<string, { label: string; color: string }> = {
  recorrente: { label: "Recorrente", color: "var(--cf2-danger-text)" },
  avulso: { label: "Avulso", color: "var(--cf2-accent-border)" },
  setup: { label: "Setup", color: "var(--cf2-accent-border)" },
};

// Stripe não avisa se o cliente ABRIU o link, só se completou/pagou — mesmo
// achado documentado na página legada. "Aberta pelo cliente" vem de
// `primeiraVisualizacaoEm`, rastreado por fora do Stripe.
function checkoutStatusBadge(cs: Proposta["checkoutStatus"]): { label: string; variant: "success" | "warning" | "accent" | "neutral" } | null {
  if (!cs) return null;
  if (cs.status === "expired") return { label: "Link expirado, sem pagamento", variant: "neutral" };
  if (cs.paymentStatus === "paid" || cs.paymentStatus === "no_payment_required") return { label: "Pago", variant: "success" };
  if (cs.status === "complete" && cs.paymentStatus === "unpaid") return { label: "Boleto gerado, aguardando compensação", variant: "warning" };
  return { label: "Aguardando o cliente finalizar o checkout", variant: "accent" };
}

function fmtData(d: string | null, comHora = false) {
  if (!d) return null;
  return new Date(d).toLocaleString("pt-BR", comHora ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });
}

export function Cf2PropostaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showAceitar, setShowAceitar] = useState(false);
  const [showRecusar, setShowRecusar] = useState(false);
  const [showExcluir, setShowExcluir] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const { data: proposta, isLoading } = useQuery<Proposta>({
    queryKey: ["proposta", id],
    queryFn: async () => {
      const r = await fetch(`/api/propostas/${id}`);
      if (!r.ok) throw new Error("Proposta não encontrada");
      return r.json();
    },
  });

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/enviar`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erro ao enviar");
      return data as { emailSent?: boolean; emailSkipped?: boolean };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["proposta", id] });
      if (data?.emailSent) toast.success("Proposta enviada por e-mail com o link de pagamento.");
      else if (data?.emailSkipped) toast.warning("Checkout gerado, mas o e-mail não saiu (Resend não configurado).");
      else toast.success("Checkout gerado e proposta enviada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aceitarMutation = useMutation({
    mutationFn: async (avancarLeadStatus: boolean) => {
      const r = await fetch(`/api/propostas/${id}/aceitar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avancarLeadStatus }) });
      if (!r.ok) throw new Error("Erro ao aceitar");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposta", id] }); setShowAceitar(false); },
    onError: () => toast.error("Erro ao aceitar proposta"),
  });

  const recusarMutation = useMutation({
    mutationFn: async (motivo: string) => {
      const r = await fetch(`/api/propostas/${id}/recusar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivo || undefined }) });
      if (!r.ok) throw new Error("Erro ao recusar");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposta", id] }); setShowRecusar(false); setMotivoRecusa(""); },
    onError: () => toast.error("Erro ao recusar proposta"),
  });

  const novaVersaoMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/nova-versao`, { method: "POST" });
      if (!r.ok) throw new Error("Erro ao criar nova versão");
      return r.json();
    },
    onSuccess: (data) => router.push(`/propostas/${data.id}`),
    onError: () => toast.error("Erro ao criar nova versão"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => router.push("/propostas"),
    onError: () => toast.error("Erro ao excluir proposta"),
  });

  if (isLoading) return <div className="page-scroll"><p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando proposta...</p></div>;
  if (!proposta) return <div className="page-scroll"><p className="text-sm" style={{ color: "var(--cf2-danger-text)" }}>Proposta não encontrada.</p></div>;

  const moedaInfo = getMoedaInfo(proposta.moeda);
  const fmt = (v: string) => formatCurrencyValue(parseFloat(v || "0"), proposta.moeda);
  const isEditable = proposta.status === "rascunho" || proposta.status === "enviada";
  const copy = async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(ok); } catch { toast.error("Não consegui copiar"); }
  };
  const primeiroNomeLead = (proposta.leadNome || "").trim().split(/\s+/)[0] || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://crm.callface.io";
  const linkPagamento = proposta.checkoutUrl ? `${origin}/p/${proposta.id}` : "";
  const waMsg = `Oi ${primeiroNomeLead || "tudo bem"}, tudo certo? Segue o link pra ativar seu plano da Callface (${fmt(proposta.totalRecorrente)}/mês) e já começar a usar: ${linkPagamento} . O pagamento é seguro via Stripe. Qualquer dúvida, é só me chamar por aqui.`;
  const waPhone = (proposta.leadTelefone || "").replace(/\D/g, "");
  const cBadge = checkoutStatusBadge(proposta.checkoutStatus);

  return (
    <div className="page-scroll space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Bug real corrigido 25/08: "voltar" sempre ia pra lista de
              propostas, mesmo quando o vendedor abriu a proposta a partir
              do negócio — agora volta pro negócio quando a proposta tem um
              (a maioria tem), só cai na lista quando não há negócio. */}
          <Link href={proposta.negocioId ? `/negocios/${proposta.negocioId}` : "/propostas"} className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <p className="text-[20px] font-bold font-mono" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
                #P-{String(proposta.numero).padStart(3, "0")}-v{proposta.versao}
              </p>
              <Cf2Badge variant={STATUS_VARIANT[proposta.status] || "neutral"}>{STATUS_LABEL[proposta.status] || proposta.status}</Cf2Badge>
            </div>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
              {proposta.leadNome}{proposta.leadEmpresa && ` · ${proposta.leadEmpresa}`}
              {proposta.negocioId && (
                <> · <Link href={`/negocios/${proposta.negocioId}`} className="hover:underline" style={{ color: "var(--cf2-accent-border)" }}>{proposta.negocioTitulo || "ver negócio"}</Link></>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Cf2Button variant="secondary" size="sm" onClick={() => window.open(`/api/propostas/${proposta.id}/pdf`, "_blank")} disabled={proposta.itens.length === 0}>
            <FileText className="w-3.5 h-3.5" /> Formalizar (PDF)
          </Cf2Button>
          {isEditable && (
            <Cf2Button variant="secondary" size="sm" onClick={() => router.push(`/propostas/novo?propostaId=${proposta.id}`)}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Cf2Button>
          )}
          {isEditable && (
            <Cf2Button size="sm" onClick={() => enviarMutation.mutate()} loading={enviarMutation.isPending} disabled={proposta.itens.length === 0}>
              <Send className="w-3.5 h-3.5" /> {proposta.status === "enviada" ? "Reenviar ao Cliente" : "Enviar ao Cliente"}
            </Cf2Button>
          )}
          {proposta.status === "enviada" && (
            <>
              <Cf2Button variant="secondary" size="sm" onClick={() => setShowAceitar(true)} style={{ color: "var(--cf2-success-text)" }}>
                <Check className="w-3.5 h-3.5" /> Aceitar
              </Cf2Button>
              <Cf2Button variant="danger" size="sm" onClick={() => setShowRecusar(true)}>
                <X className="w-3.5 h-3.5" /> Recusar
              </Cf2Button>
            </>
          )}
          {(proposta.status === "recusada" || proposta.status === "expirada") && (
            <Cf2Button variant="secondary" size="sm" onClick={() => novaVersaoMutation.mutate()} loading={novaVersaoMutation.isPending}>
              <Copy className="w-3.5 h-3.5" /> Nova Versão
            </Cf2Button>
          )}
          {proposta.status !== "aceita" && (
            <Cf2Button variant="ghost" size="sm" onClick={() => setShowExcluir(true)} style={{ color: "var(--cf2-danger-text)" }}>
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </Cf2Button>
          )}
        </div>
      </div>

      {/* Acompanhamento — exatamente o que faltava: dá pra ver se o cliente
          abriu o link antes de responder, não só se pagou (achado real
          25/08, Kauã: "eu precisava acompanhar se o cliente abriu, se ele
          não abriu"). primeiraVisualizacaoEm/visualizacoes já existiam no
          banco, só nunca tinham superfície em lugar nenhum do CRM2. */}
      {proposta.status !== "rascunho" && (
        <Cf2Card>
          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>Acompanhamento</p>
            <div className="flex items-center gap-2">
              {proposta.primeiraVisualizacaoEm ? <Eye className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-success-text)" }} /> : <EyeOff className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}
              <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>
                {proposta.primeiraVisualizacaoEm
                  ? `Aberta pelo cliente em ${fmtData(proposta.primeiraVisualizacaoEm, true)}${(proposta.visualizacoes || 0) > 1 ? ` · ${proposta.visualizacoes} visualizações` : ""}`
                  : "O cliente ainda não abriu o link"}
              </p>
            </div>
            {proposta.clienteRespondeuEm && (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
                Cliente respondeu em {fmtData(proposta.clienteRespondeuEm, true)}
                {proposta.motivoRecusa && ` — motivo: ${proposta.motivoRecusa}`}
              </p>
            )}
            {cBadge && (
              <div className="flex items-center gap-1.5">
                <Cf2Badge variant={cBadge.variant}>{cBadge.label}</Cf2Badge>
              </div>
            )}
          </div>
        </Cf2Card>
      )}

      {proposta.checkoutUrl && (
        <Cf2Card style={{ background: "color-mix(in srgb, var(--cf2-accent-border) 6%, var(--cf2-bg-surface))", borderColor: "color-mix(in srgb, var(--cf2-accent-border) 30%, transparent)" }}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-accent-border)" }} />
                <span className="text-[13px] font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>Link de pagamento</span>
                <a href={linkPagamento} target="_blank" rel="noreferrer" className="text-[12px] truncate max-w-[260px] hover:underline" style={{ color: "var(--cf2-text-tertiary)" }}>{linkPagamento}</a>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Cf2Button variant="secondary" size="sm" onClick={() => copy(linkPagamento, "Link copiado")}><Copy className="w-3.5 h-3.5" /> Copiar link</Cf2Button>
                <Cf2Button variant="secondary" size="sm" onClick={() => copy(waMsg, "Mensagem copiada")}><Copy className="w-3.5 h-3.5" /> Copiar mensagem</Cf2Button>
                <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium" style={{ background: "#25D366", color: "#fff" }}>
                  <MessageCircle className="w-3.5 h-3.5" /> Enviar no WhatsApp
                </a>
              </div>
            </div>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>A proposta já foi enviada por e-mail automaticamente. Use os botões pra mandar pelo WhatsApp também.</p>
          </div>
        </Cf2Card>
      )}

      <div className="flex gap-6 text-[13px] flex-wrap" style={{ color: "var(--cf2-text-secondary)" }}>
        {proposta.moeda !== "BRL" && <span className="font-medium" style={{ color: "var(--cf2-text-primary)" }}>{MOEDAS.find((m) => m.code === proposta.moeda)?.code} ({moedaInfo.symbol})</span>}
        {proposta.dataEmissao && <span>Emissão: {fmtData(proposta.dataEmissao)}</span>}
        {proposta.dataValidade && <span>Validade: {fmtData(proposta.dataValidade)}</span>}
        {proposta.condicoesPagamento && <span>Pagamento: {proposta.condicoesPagamento}</span>}
        {proposta.prazoContratoMeses && <span>Contrato: {proposta.prazoContratoMeses} meses</span>}
        {proposta.criadoPorNome && <span>Por: {proposta.criadoPorNome}</span>}
      </div>

      <Cf2Card padding="0px" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--cf2-border-default)" }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>Serviço</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>Tipo</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>Qtd</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>Valor Unit.</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>Desconto</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cf2-text-tertiary)" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {proposta.itens.map((item) => {
                const t = TIPO_LABEL[item.tipo];
                const desconto = parseFloat(item.desconto || "0");
                return (
                  <tr key={item.id} className="border-b" style={{ borderColor: "var(--cf2-border-default)" }}>
                    <td className="px-4 py-2.5">
                      <p style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</p>
                      {item.descricao && <p className="text-[11px] mt-0.5" style={{ color: "var(--cf2-text-tertiary)" }}>{item.descricao}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {t && <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `color-mix(in srgb, ${t.color} 15%, transparent)`, color: t.color }}>{t.label}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--cf2-text-secondary)" }}>{parseFloat(item.quantidade)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--cf2-text-secondary)" }}>{moedaInfo.symbol} {fmt(item.valorUnitario)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--cf2-text-secondary)" }}>{desconto > 0 ? (item.descontoTipo === "valor" ? `${moedaInfo.symbol} ${fmt(item.desconto)}` : `${desconto}%`) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--cf2-text-primary)" }}>{moedaInfo.symbol} {fmt(item.subtotal)}</td>
                  </tr>
                );
              })}
              {proposta.itens.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum item nesta proposta.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Cf2Card>

      <div className="flex justify-end">
        <Cf2Card className="min-w-[280px]">
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[13px]">
              <span style={{ color: "var(--cf2-text-secondary)" }}>Recorrente (MRR)</span>
              <span className="font-medium" style={{ color: "var(--cf2-danger-text)" }}>{moedaInfo.symbol} {fmt(proposta.totalRecorrente)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: "var(--cf2-text-secondary)" }}>Avulso / Setup</span>
              <span className="font-medium" style={{ color: "var(--cf2-accent-border)" }}>{moedaInfo.symbol} {fmt(proposta.totalAvulso)}</span>
            </div>
            <div className="flex justify-between pt-2.5 border-t" style={{ borderColor: "var(--cf2-border-default)" }}>
              <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Total Geral</span>
              <span className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{moedaInfo.symbol} {fmt(proposta.totalGeral)}</span>
            </div>
          </div>
        </Cf2Card>
      </div>

      {proposta.observacoes && (
        <Cf2Card>
          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>Observações</p>
          <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-secondary)" }}>{proposta.observacoes}</p>
        </Cf2Card>
      )}

      {proposta.contratoId && (
        <Cf2Card>
          <div className="flex items-center gap-3">
            <Check className="w-4 h-4" style={{ color: "var(--cf2-success-text)" }} />
            <span className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Contrato gerado a partir desta proposta.</span>
            <Link href={`/contratos/${proposta.contratoId}`} className="text-[13px] font-medium ml-auto" style={{ color: "var(--cf2-accent-border)" }}>Ver contrato</Link>
          </div>
        </Cf2Card>
      )}

      <Cf2Dialog open={showAceitar} onOpenChange={setShowAceitar}>
        <Cf2DialogContent>
          <Cf2DialogHeader>
            <Cf2DialogTitle>Aceitar Proposta</Cf2DialogTitle>
            <Cf2DialogDescription>
              Um contrato será gerado automaticamente com os itens, o negócio será marcado como ganho e clonado pra carteira, e o lead será promovido a cliente.
            </Cf2DialogDescription>
          </Cf2DialogHeader>
          <Cf2DialogFooter>
            <Cf2Button variant="ghost" onClick={() => setShowAceitar(false)}>Cancelar</Cf2Button>
            <Cf2Button variant="secondary" onClick={() => aceitarMutation.mutate(false)} loading={aceitarMutation.isPending}>Aceitar</Cf2Button>
            <Cf2Button onClick={() => aceitarMutation.mutate(true)} loading={aceitarMutation.isPending}>Aceitar e Converter em Cliente</Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={showRecusar} onOpenChange={setShowRecusar}>
        <Cf2DialogContent>
          <Cf2DialogHeader>
            <Cf2DialogTitle>Recusar Proposta</Cf2DialogTitle>
            <Cf2DialogDescription>Registre o motivo da recusa pra referência futura.</Cf2DialogDescription>
          </Cf2DialogHeader>
          <textarea
            value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)}
            placeholder="Ex: cliente optou por outro fornecedor, preço acima do orçamento..."
            rows={3} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
          <Cf2DialogFooter>
            <Cf2Button variant="ghost" onClick={() => { setShowRecusar(false); setMotivoRecusa(""); }}>Cancelar</Cf2Button>
            <Cf2Button variant="danger" onClick={() => recusarMutation.mutate(motivoRecusa)} loading={recusarMutation.isPending}>Recusar Proposta</Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>

      <Cf2Dialog open={showExcluir} onOpenChange={setShowExcluir}>
        <Cf2DialogContent>
          <Cf2DialogHeader>
            <Cf2DialogTitle>Excluir Proposta</Cf2DialogTitle>
            <Cf2DialogDescription>
              Tem certeza que deseja excluir a proposta #{String(proposta.numero).padStart(3, "0")}-v{proposta.versao}? Esta ação não pode ser desfeita.
            </Cf2DialogDescription>
          </Cf2DialogHeader>
          <Cf2DialogFooter>
            <Cf2Button variant="ghost" onClick={() => setShowExcluir(false)}>Cancelar</Cf2Button>
            <Cf2Button variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>Excluir</Cf2Button>
          </Cf2DialogFooter>
        </Cf2DialogContent>
      </Cf2Dialog>
    </div>
  );
}
