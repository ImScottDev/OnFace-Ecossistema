"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { ArrowLeft, Plus, Trash2, Send, Check, X, Copy, Save, ChevronUp, ChevronDown, Settings2, Link2, MessageCircle, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ServiceCatalogManager } from "@/components/crm/ServiceCatalogManager";
import { MOEDAS, getMoedaInfo, calcSubtotal as calcSub, formatCurrencyValue } from "@/components/crm/proposta-utils";

interface Item {
  id?: string;
  servicoCatalogoId?: string | null;
  nome: string;
  descricao?: string;
  tipo: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  descontoTipo: string;
  subtotal: number;
  ordem: number;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  valorSugerido: string | null;
  unidade: string;
}

interface Proposta {
  id: string;
  numero: number;
  versao: number;
  status: string;
  moeda: string;
  leadId: string;
  leadNome: string;
  leadEmpresa: string | null;
  leadTelefone: string;
  leadEmail: string | null;
  checkoutUrl: string | null;
  checkoutStatus: { status: string; paymentStatus: string } | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  observacoes: string | null;
  condicoesPagamento: string | null;
  totalRecorrente: string;
  totalAvulso: string;
  totalGeral: string;
  contratoId: string | null;
  criadoPorNome: string | null;
  createdAt: string;
  itens: Item[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "#6B7280" },
  enviada: { label: "Enviada", color: "#3B82F6" },
  aceita: { label: "Aceita", color: "#10B981" },
  recusada: { label: "Recusada", color: "#EF4444" },
  expirada: { label: "Expirada", color: "#F59E0B" },
};

// Badge de status ao vivo do checkout (consulta direta ao Stripe). O Stripe não
// avisa se o cliente ABRIU o link, só se completou/pagou — por isso não existe
// um estado "cliente abriu e não pagou": só dá pra saber pago, boleto pendente,
// aguardando checkout, ou expirado.
function checkoutStatusBadge(cs: Proposta["checkoutStatus"]): { label: string; color: string } | null {
  if (!cs) return null;
  if (cs.status === "expired") return { label: "Link expirado, sem pagamento", color: "#6B7280" };
  if (cs.paymentStatus === "paid" || cs.paymentStatus === "no_payment_required") {
    return { label: "Pago", color: "#10B981" };
  }
  if (cs.status === "complete" && cs.paymentStatus === "unpaid") {
    return { label: "Boleto gerado, aguardando compensação", color: "#F59E0B" };
  }
  return { label: "Aguardando o cliente finalizar o checkout", color: "#3B82F6" };
}

const TIPOS_ITEM = [
  { value: "recorrente", label: "Recorrente", color: "#e23752" },
  { value: "avulso", label: "Avulso", color: "#8e27ef" },
  { value: "setup", label: "Setup", color: "#8e27ef" },
];

export default function PropostaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [itens, setItens] = useState<Item[]>([]);
  const [moeda, setMoeda] = useState("BRL");
  const [observacoes, setObservacoes] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showAceitarModal, setShowAceitarModal] = useState(false);
  const [showExcluirModal, setShowExcluirModal] = useState(false);
  const [showRecusarModal, setShowRecusarModal] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [showCatalogoModal, setShowCatalogoModal] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const { data: proposta, isLoading } = useQuery<Proposta>({
    queryKey: ["proposta", id],
    queryFn: async () => {
      const res = await fetch(`/api/propostas/${id}`);
      if (!res.ok) throw new Error("Proposta não encontrada");
      return res.json();
    },
  });

  // Initialize local state from server data
  if (proposta && !initialized) {
    const parsedItens = proposta.itens.map(i => ({
      ...i,
      quantidade: parseFloat(String(i.quantidade)),
      valorUnitario: parseFloat(String(i.valorUnitario)),
      desconto: parseFloat(String(i.desconto) || "0"),
      descontoTipo: (i as unknown as Record<string, string>).descontoTipo || (i as unknown as Record<string, string>).desconto_tipo || "percentual",
      subtotal: parseFloat(String(i.subtotal)),
    }));
    setItens(parsedItens);
    setMoeda(proposta.moeda || "BRL");
    setObservacoes(proposta.observacoes || "");
    setCondicoesPagamento(proposta.condicoesPagamento || "");
    setDataValidade(proposta.dataValidade || "");
    setSavedSnapshot(JSON.stringify({ itens: parsedItens, moeda: proposta.moeda || "BRL", observacoes: proposta.observacoes || "", condicoesPagamento: proposta.condicoesPagamento || "", dataValidade: proposta.dataValidade || "" }));
    setInitialized(true);
  }

  const { data: catalogo } = useQuery<Servico[]>({
    queryKey: ["servicos-catalogo"],
    queryFn: async () => {
      const res = await fetch("/api/servicos-catalogo");
      return res.json();
    },
  });

  // Totals
  const totals = useMemo(() => {
    let recorrente = 0, avulso = 0;
    itens.forEach(i => {
      const sub = calcSub(i.quantidade, i.valorUnitario, i.desconto, i.descontoTipo);
      if (i.tipo === "recorrente") recorrente += sub;
      else avulso += sub;
    });
    return { recorrente, avulso, geral: recorrente + avulso };
  }, [itens]);

  // Rascunho edita livre. Enviada também edita (o closer pode corrigir prazo/item
  // depois do link já gerado): salvar regenera o checkout e expira a sessão antiga
  // no Stripe, mas o link curto /p/<id> continua o mesmo pro cliente. Aceita,
  // recusada e expirada ficam travadas (aceita já virou contrato).
  const isEditable = proposta?.status === "rascunho" || proposta?.status === "enviada";
  const isReenvio = proposta?.status === "enviada";

  // Unsaved changes detection
  const currentSnapshot = JSON.stringify({ itens, moeda, observacoes, condicoesPagamento, dataValidade });
  const hasUnsavedChanges = isEditable && initialized && currentSnapshot !== savedSnapshot;

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/propostas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moeda,
          observacoes: observacoes || null,
          condicoesPagamento: condicoesPagamento || null,
          dataValidade: dataValidade || null,
          itens: itens.map((i, idx) => ({
            servicoCatalogoId: i.servicoCatalogoId,
            nome: i.nome,
            descricao: i.descricao,
            tipo: i.tipo,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            desconto: i.desconto,
            descontoTipo: i.descontoTipo,
            ordem: idx,
          })),
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      setSavedSnapshot(currentSnapshot);
      queryClient.invalidateQueries({ queryKey: ["proposta", id] });
    },
  });

  const enviarMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      const res = await fetch(`/api/propostas/${id}/enviar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      return data;
    },
    onSuccess: (data: { emailSent?: boolean; emailSkipped?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["proposta", id] });
      setInitialized(false);
      if (data?.emailSent) toast.success("Proposta enviada por email com o link de pagamento.");
      else if (data?.emailSkipped) toast.warning("Checkout gerado, mas o email não saiu (Resend não configurado).");
      else toast.success("Checkout gerado e proposta enviada.");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar proposta");
    },
  });

  // "Salvar": salva as edições E ativa a proposta (gera o link + status enviada,
  // liberando ganho/perdido), SEM disparar email. O envio do email fica no
  // "Enviar para o cliente". Se não der pra ativar (ex.: sem valor recorrente),
  // as edições já ficaram salvas e mostramos o motivo.
  const salvarAtivarMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      const res = await fetch(`/api/propostas/${id}/enviar?skipEmail=true`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erro ao gerar o link");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta", id] });
      setInitialized(false);
      toast.success("Proposta salva e ativada — link de pagamento gerado.");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar/ativar a proposta");
    },
  });

  const aceitarMutation = useMutation({
    mutationFn: async (avancarLeadStatus: boolean) => {
      const res = await fetch(`/api/propostas/${id}/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avancarLeadStatus }),
      });
      if (!res.ok) throw new Error("Erro ao aceitar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta", id] });
      setShowAceitarModal(false);
      setInitialized(false);
    },
  });

  const recusarMutation = useMutation({
    mutationFn: async (motivo: string) => {
      const res = await fetch(`/api/propostas/${id}/recusar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo || undefined }),
      });
      if (!res.ok) throw new Error("Erro ao recusar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta", id] });
      setShowRecusarModal(false);
      setMotivoRecusa("");
      setInitialized(false);
    },
  });

  const novaVersaoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/propostas/${id}/nova-versao`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao criar nova versão");
      return res.json();
    },
    onSuccess: (data) => router.push(`/propostas/${data.id}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/propostas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => router.push("/propostas"),
  });

  // Item helpers
  function updateItem(idx: number, changes: Partial<Item>) {
    setItens(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...changes };
      updated.subtotal = calcSub(updated.quantidade, updated.valorUnitario, updated.desconto, updated.descontoTipo);
      return updated;
    }));
  }

  function addItem() {
    setItens(prev => [...prev, { nome: "", tipo: "recorrente", quantidade: 1, valorUnitario: 0, desconto: 0, descontoTipo: "percentual", subtotal: 0, ordem: prev.length }]);
  }

  function addFromCatalog(servico: Servico) {
    setItens(prev => [...prev, {
      servicoCatalogoId: servico.id,
      nome: servico.nome,
      descricao: servico.descricao || undefined,
      tipo: servico.tipo,
      quantidade: 1,
      valorUnitario: parseFloat(servico.valorSugerido || "0"),
      desconto: 0,
      descontoTipo: "percentual",
      subtotal: parseFloat(servico.valorSugerido || "0"),
      ordem: prev.length,
    }]);
  }

  function duplicateItem(idx: number) {
    setItens(prev => {
      const item = prev[idx];
      const clone = { ...item, id: undefined, servicoCatalogoId: item.servicoCatalogoId, ordem: prev.length };
      return [...prev, clone];
    });
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, direction: -1 | 1) {
    setItens(prev => {
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  if (isLoading) return <div className="p-8 text-white/40">Carregando...</div>;
  if (!proposta) return <div className="p-8 text-red-400">Proposta não encontrada</div>;

  const sc = STATUS_CONFIG[proposta.status] || STATUS_CONFIG.rascunho;
  const moedaInfo = getMoedaInfo(moeda);
  const fmt = (v: number) => formatCurrencyValue(v, moeda);

  // Link de pagamento + mensagem padrão de WhatsApp (vendedor manda manual além do email automático)
  const copy = async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(ok); }
    catch { toast.error("Não consegui copiar"); }
  };
  const primeiroNomeLead = (proposta.leadNome || "").trim().split(/\s+/)[0] || "";
  const valorMes = fmt(parseFloat(proposta.totalRecorrente || "0"));
  // Link curto e branded (crm.callface.io/p/<id>) que redireciona pro checkout do
  // Stripe. Fica bem menor que a URL crua do Stripe na mensagem do WhatsApp.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://crm.callface.io";
  const linkPagamento = proposta.checkoutUrl ? `${origin}/p/${proposta.id}` : "";
  const waMsg = `Oi ${primeiroNomeLead || "tudo bem"}, tudo certo? Segue o link pra ativar seu plano da Callface (${valorMes}/mês) e já começar a usar: ${linkPagamento} . O pagamento é seguro via Stripe. Qualquer dúvida, é só me chamar por aqui.`;
  const waPhone = (proposta.leadTelefone || "").replace(/\D/g, "");
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="page-scroll space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/propostas" className="p-2 hover:bg-white/[0.06] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-white/50" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white font-mono">
                #P-{String(proposta.numero).padStart(3, "0")}-v{proposta.versao}
              </h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sc.color + "20", color: sc.color }}>
                {sc.label}
              </span>
              {hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Alterações não salvas" />
              )}
            </div>
            <p className="text-sm text-white/50 mt-1">
              <Link href={`/contatos/${proposta.leadId}`} className="hover:text-white transition-colors">
                {proposta.leadNome}
              </Link>
              {proposta.leadEmpresa && <span> · {proposta.leadEmpresa}</span>}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => window.open(`/api/propostas/${proposta.id}/pdf`, "_blank")}
            disabled={itens.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/[0.06] text-white/80 rounded-lg hover:bg-white/[0.12] hover:text-white disabled:opacity-40 transition-colors"
            title="Gerar PDF comercial da proposta (moldes Callface) — para o cliente levar ao superior">
            <FileText className="w-3.5 h-3.5" /> Formalizar (PDF)
          </button>
          {isEditable && (
            <>
              <button onClick={() => salvarAtivarMutation.mutate()} disabled={salvarAtivarMutation.isPending || itens.length === 0}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors ${hasUnsavedChanges ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "bg-white/[0.06] text-white/70 hover:text-white"}`}
                title={isReenvio ? "Salva as alterações e gera um novo link de pagamento (o anterior é invalidado no Stripe). O link curto /p/ continua o mesmo, sem enviar email." : "Salva e gera o link de pagamento (libera ganho/perdido). Sem enviar email."}>
                <Save className="w-3.5 h-3.5" /> {salvarAtivarMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => enviarMutation.mutate()} disabled={enviarMutation.isPending || itens.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-500/80 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                title={isReenvio ? "Salva, gera um novo link (invalida o anterior no Stripe) e reenvia o email pro cliente" : "Gera o link E envia por email pro cliente"}>
                <Send className="w-3.5 h-3.5" /> {isReenvio ? "Reenviar ao Cliente" : "Enviar ao Cliente"}
              </button>
            </>
          )}
          {proposta.status === "enviada" && (
            <>
              <button onClick={() => setShowAceitarModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-500/80 text-white rounded-lg hover:bg-emerald-500 transition-colors">
                <Check className="w-3.5 h-3.5" /> Aceitar
              </button>
              <button onClick={() => setShowRecusarModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition-colors">
                <X className="w-3.5 h-3.5" /> Recusar
              </button>
            </>
          )}
          {/* Excluir: disponível pra closer corrigir erro (qualquer status menos aceita) */}
          {proposta.status !== "aceita" && (
            <button onClick={() => setShowExcluirModal(true)} disabled={deleteMutation.isPending}
              title="Excluir proposta (não conta na taxa de aceite)"
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          )}
          {(proposta.status === "recusada" || proposta.status === "expirada") && (
            <button onClick={() => novaVersaoMutation.mutate()} disabled={novaVersaoMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-500/15 text-purple-400 rounded-lg hover:bg-purple-500/25 transition-colors">
              <Copy className="w-3.5 h-3.5" /> Nova Versão
            </button>
          )}
        </div>
      </div>

      {/* Link de pagamento (aparece após gerar/enviar) */}
      {proposta.checkoutUrl && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "rgba(142,39,239,0.25)", background: "rgba(142,39,239,0.06)" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-4 h-4 shrink-0" style={{ color: "#8e27ef" }} />
              <span className="text-sm font-semibold text-white shrink-0">Link de pagamento</span>
              <a href={linkPagamento || proposta.checkoutUrl} target="_blank" rel="noreferrer"
                className="text-xs text-white/40 truncate max-w-[260px] hover:text-white/70 underline">
                {linkPagamento || proposta.checkoutUrl}
              </a>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => copy(linkPagamento || proposta.checkoutUrl || "", "Link copiado")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/[0.06] text-white/70 hover:text-white rounded-lg transition-colors">
                <Copy className="w-3.5 h-3.5" /> Copiar link
              </button>
              <button onClick={() => copy(waMsg, "Mensagem copiada")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/[0.06] text-white/70 hover:text-white rounded-lg transition-colors">
                <Copy className="w-3.5 h-3.5" /> Copiar mensagem
              </button>
              <a href={waHref} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-white rounded-lg transition-colors"
                style={{ background: "#25D366" }}>
                <MessageCircle className="w-3.5 h-3.5" /> Enviar no WhatsApp
              </a>
            </div>
          </div>
          <p className="text-xs text-white/40">
            A proposta já foi enviada por email automaticamente. Use os botões para mandar pelo WhatsApp também, com a mensagem padrão pronta.
          </p>
          {(() => {
            const badge = checkoutStatusBadge(proposta.checkoutStatus);
            if (!badge) return null;
            return (
              <div className="flex items-center gap-2 pt-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: badge.color }} />
                <span className="text-xs font-medium" style={{ color: badge.color }}>{badge.label}</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Metadata */}
      {isEditable ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-white/40 block mb-1">Moeda</label>
            <select value={moeda} onChange={e => setMoeda(e.target.value)} className="dark-input w-full">
              {MOEDAS.map(m => <option key={m.code} value={m.code}>{m.code} ({m.symbol})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Validade</label>
            <input type="date" value={dataValidade} onChange={e => setDataValidade(e.target.value)} className="dark-input w-full" />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Condições de Pagamento</label>
            <input value={condicoesPagamento} onChange={e => setCondicoesPagamento(e.target.value)} placeholder="Ex: 30/60/90 dias" className="dark-input w-full" />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas internas, termos especiais..."
              className="dark-input w-full resize-y" rows={2} />
          </div>
        </div>
      ) : (
        <div className="flex gap-6 text-sm text-white/50 flex-wrap">
          {moeda !== "BRL" && <span className="text-white/70 font-medium">{moeda} ({moedaInfo.symbol})</span>}
          {proposta.dataEmissao && <span>Emissão: {new Date(proposta.dataEmissao + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
          {proposta.dataValidade && <span>Validade: {new Date(proposta.dataValidade + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
          {proposta.condicoesPagamento && <span>Pagamento: {proposta.condicoesPagamento}</span>}
          {proposta.criadoPorNome && <span>Por: {proposta.criadoPorNome}</span>}
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Serviço</th>
              <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Tipo</th>
              <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Qtd</th>
              <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Valor Unit.</th>
              <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Desconto</th>
              <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Subtotal</th>
              {isEditable && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={idx} className="border-b border-white/[0.04] group">
                <td className="px-4 py-2">
                  {isEditable ? (
                    <div className="space-y-1">
                      <input value={item.nome} onChange={e => updateItem(idx, { nome: e.target.value })}
                        className="dark-input w-full text-sm" placeholder="Nome do serviço" />
                      <input value={item.descricao || ""} onChange={e => updateItem(idx, { descricao: e.target.value })}
                        className="dark-input w-full text-xs text-white/40" placeholder="Descrição (opcional)" />
                    </div>
                  ) : (
                    <div>
                      <span className="text-white">{item.nome}</span>
                      {item.descricao && <p className="text-xs text-white/40 mt-0.5">{item.descricao}</p>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  {isEditable ? (
                    <select value={item.tipo} onChange={e => updateItem(idx, { tipo: e.target.value })} className="dark-input w-full text-xs">
                      {TIPOS_ITEM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                      background: (TIPOS_ITEM.find(t => t.value === item.tipo)?.color || "#666") + "20",
                      color: TIPOS_ITEM.find(t => t.value === item.tipo)?.color,
                    }}>
                      {TIPOS_ITEM.find(t => t.value === item.tipo)?.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {isEditable ? (
                    <input type="number" value={item.quantidade} onChange={e => updateItem(idx, { quantidade: parseFloat(e.target.value) || 0 })}
                      className="dark-input w-full text-right text-sm" min="0" step="1" />
                  ) : (
                    <span className="text-white/70 text-right block">{item.quantidade}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {isEditable ? (
                    <input type="number" value={item.valorUnitario} onChange={e => updateItem(idx, { valorUnitario: parseFloat(e.target.value) || 0 })}
                      className="dark-input w-full text-right text-sm" min="0" step="0.01" />
                  ) : (
                    <span className="text-white/70 text-right block">{moedaInfo.symbol} {fmt(item.valorUnitario)}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {isEditable ? (
                    <div className="flex items-center gap-1">
                      <input type="number" value={item.desconto} onChange={e => updateItem(idx, { desconto: parseFloat(e.target.value) || 0 })}
                        className="dark-input flex-1 text-right text-sm" min="0" step={item.descontoTipo === "valor" ? "0.01" : "1"} />
                      <button onClick={() => updateItem(idx, { descontoTipo: item.descontoTipo === "percentual" ? "valor" : "percentual" })}
                        className="shrink-0 px-1.5 py-1 text-[10px] rounded bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.1] transition-colors font-medium"
                        title={item.descontoTipo === "percentual" ? "Desconto em %" : `Desconto em ${moedaInfo.symbol}`}>
                        {item.descontoTipo === "percentual" ? "%" : moedaInfo.symbol}
                      </button>
                    </div>
                  ) : (
                    <span className="text-white/70 text-right block">
                      {item.desconto > 0
                        ? item.descontoTipo === "valor" ? `${moedaInfo.symbol} ${fmt(item.desconto)}` : `${item.desconto}%`
                        : "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-medium text-white">
                  {moedaInfo.symbol} {fmt(isEditable ? calcSub(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo) : item.subtotal)}
                </td>
                {isEditable && (
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        className="p-0.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors" title="Mover para cima">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === itens.length - 1}
                        className="p-0.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors" title="Mover para baixo">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => duplicateItem(idx)} className="p-0.5 text-white/40 hover:text-blue-400 transition-colors" title="Duplicar item">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeItem(idx)} className="p-0.5 text-white/40 hover:text-red-400 transition-colors" title="Remover item">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={isEditable ? 7 : 6} className="px-4 py-6 text-center text-white/20 text-xs">
                  Nenhum item adicionado. Use os botões abaixo para adicionar.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Add item row */}
        {isEditable && (
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
            <button onClick={addItem} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Item personalizado
            </button>
            {catalogo && catalogo.length > 0 && (
              <>
                <span className="text-white/20 text-xs">|</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-white/30">Catálogo:</span>
                  {catalogo.map(s => {
                    const tipoColor = TIPOS_ITEM.find(t => t.value === s.tipo)?.color || "#666";
                    return (
                      <button key={s.id} onClick={() => addFromCatalog(s)}
                        className="text-[10px] px-2 py-0.5 rounded-full text-white/50 hover:text-white transition-colors"
                        style={{ background: tipoColor + "15" }}
                        title={`${s.tipo} · R$ ${s.valorSugerido || "0"}`}>
                        {s.nome}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <span className="text-white/20 text-xs">|</span>
            <button onClick={() => setShowCatalogoModal(true)} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
              <Settings2 className="w-3 h-3" /> Gerenciar catálogo
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 min-w-[300px] space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Recorrente (MRR)</span>
            <span className="text-[#e23752] font-medium">{moedaInfo.symbol} {fmt(isEditable ? totals.recorrente : parseFloat(proposta.totalRecorrente))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Avulso / Setup</span>
            <span className="text-[#8e27ef] font-medium">{moedaInfo.symbol} {fmt(isEditable ? totals.avulso : parseFloat(proposta.totalAvulso))}</span>
          </div>
          <div className="border-t border-white/[0.08] pt-3 flex justify-between">
            <span className="text-white font-semibold">Total Geral</span>
            <span className="text-white text-lg font-bold">{moedaInfo.symbol} {fmt(isEditable ? totals.geral : parseFloat(proposta.totalGeral))}</span>
          </div>
        </div>
      </div>

      {/* Observações (read mode) */}
      {!isEditable && proposta.observacoes && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
          <h3 className="text-xs text-white/40 mb-2">Observações</h3>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{proposta.observacoes}</p>
        </div>
      )}

      {/* Contract link */}
      {proposta.contratoId && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-400" />
          <span className="text-sm text-white/70">Contrato gerado a partir desta proposta.</span>
          <Link href={`/contratos/${proposta.contratoId}`} className="text-sm text-blue-400 hover:text-blue-300 ml-auto">Ver contrato</Link>
        </div>
      )}

      {/* Aceitar Modal */}
      {showAceitarModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50">
          <div className="modal-content p-6 w-full max-w-md">
            <h3 className="font-semibold text-white mb-4">Aceitar Proposta</h3>
            <p className="text-sm text-white/60 mb-2">
              Ao aceitar esta proposta:
            </p>
            <ul className="text-sm text-white/50 mb-4 space-y-1 ml-4 list-disc">
              <li>Um <strong className="text-white/70">contrato</strong> será gerado automaticamente com os itens</li>
              <li>O <strong className="text-white/70">negócio</strong> será marcado como ganho e clonado para a carteira</li>
              <li>O lead será promovido a <strong className="text-white/70">cliente</strong></li>
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAceitarModal(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => aceitarMutation.mutate(false)} disabled={aceitarMutation.isPending}
                className="px-4 py-2 text-sm bg-emerald-500/80 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50">
                Aceitar
              </button>
              <button onClick={() => aceitarMutation.mutate(true)} disabled={aceitarMutation.isPending}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                Aceitar e Converter em Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excluir Modal */}
      {showExcluirModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50">
          <div className="modal-content p-6 w-full max-w-sm">
            <h3 className="font-semibold text-white mb-3">Excluir Proposta</h3>
            <p className="text-sm text-white/60 mb-4">
              Tem certeza que deseja excluir a proposta <strong className="text-white/80">#{String(proposta.numero).padStart(3, "0")}-v{proposta.versao}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExcluirModal(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => { deleteMutation.mutate(); setShowExcluirModal(false); }} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-500/80 text-white rounded-lg hover:bg-red-500 disabled:opacity-50">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recusar Modal */}
      {showRecusarModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50">
          <div className="modal-content p-6 w-full max-w-md">
            <h3 className="font-semibold text-white mb-3">Recusar Proposta</h3>
            <p className="text-sm text-white/60 mb-3">
              Registre o motivo da recusa para referência futura:
            </p>
            <textarea value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Ex: cliente optou por outro fornecedor, preço acima do orçamento..."
              className="dark-input w-full resize-y mb-4" rows={3} />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowRecusarModal(false); setMotivoRecusa(""); }} className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => recusarMutation.mutate(motivoRecusa)} disabled={recusarMutation.isPending}
                className="px-4 py-2 text-sm bg-red-500/80 text-white rounded-lg hover:bg-red-500 disabled:opacity-50">
                Recusar Proposta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catálogo de Serviços Modal */}
      {showCatalogoModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0" onClick={() => setShowCatalogoModal(false)} />
          <div className="modal-content w-full max-w-2xl max-h-[80vh] overflow-y-auto relative">
            <div className="sticky top-0 bg-[#1a1b23] flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Catálogo de Serviços</h3>
              <button onClick={() => setShowCatalogoModal(false)} className="p-1 text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2">
              <ServiceCatalogManager />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
