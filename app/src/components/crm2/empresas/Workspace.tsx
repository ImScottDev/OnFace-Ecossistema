"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus, FileText, ChevronRight, Building2, Users, Briefcase, ShieldCheck, Download,
  Pencil, NotebookPen, Send, Sparkles, Paperclip,
} from "lucide-react";
import { Cf2Card, Cf2SectionHeader, Cf2Eyebrow } from "@/components/crm2/ui/Card";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Skeleton, Cf2EmptyState, Cf2ErrorState } from "@/components/crm2/ui/States";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger, Cf2TabsContent } from "@/components/crm2/ui/Tabs";
import { Cf2DropdownMenu, Cf2DropdownMenuTrigger, Cf2DropdownMenuContent, Cf2DropdownMenuItem } from "@/components/crm2/ui/DropdownMenu";
import { Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle } from "@/components/crm2/ui/Dialog";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { PropertyRow } from "@/components/crm2/shared/DrawerSection";
import { NovaOportunidadeModal } from "@/components/crm2/pipeline/NovaOportunidadeModal";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { PIPELINE_OPEN_COLS, MOTIVO_PERDA_ESTRUTURADO } from "@/components/crm2/pipeline/shared";

const brl = (v: string | number | null | undefined) =>
  parseFloat(String(v || "0")).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatData = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

interface Lead { id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; tipo: string; leadScore: number; status: string }
interface Negocio { id: string; titulo: string; status: string; valorTotal: string | null; mrrEstimado: string | null; mrrFechado: string | null; motivoPerda: string | null; createdAt: string; responsavelId: string | null }
interface Contrato { id: string; status: string; mrr: string | null; valorSetup: string | null; vencimento: string | null; produto: string | null; inicio: string | null }
interface Nota { id: string; conteudo: string; autorNome: string | null; createdAt: string; pessoaNome: string | null }
interface AnexoLegado { id: string; nomeArquivo: string; tamanhoBytes: number | null; arquivoDisponivel: boolean }
interface AnexoReal { id: string; nomeArquivo: string; url: string; tipoMime: string | null; tamanhoBytes: number | null; createdAt: string }
interface Empresa {
  id: string; nome: string; cnpj: string | null; setor: string | null; porte: string | null; cidade: string | null; estado: string | null;
  website: string | null; instagram: string | null; linkedin: string | null; telefone: string | null; observacoes: string | null;
  numUsuariosTi: number | null; numFiliais: number | null;
  enrichStatus: string | null; industry: string | null; employeeCount: number | null; annualRevenue: string | null; foundedYear: number | null;
  apolloDescription: string | null; totalFunding: string | null; fundingStage: string | null; techStack: string[] | null;
  createdAt: string; updatedAt: string;
}

const NEGOCIO_STATUS_LABEL: Record<string, string> = { ganho: "Ganho", perdido: "Perdido" };
function statusNegocioInfo(status: string): { label: string; color: string } {
  const stage = PIPELINE_OPEN_COLS.find((c) => c.keys.includes(status));
  if (stage) return { label: stage.label, color: stage.color };
  if (status === "ganho") return { label: "Ganho", color: "var(--cf2-success-text)" };
  if (MOTIVO_PERDA_ESTRUTURADO[status]) return { label: "Perdido", color: "var(--cf2-danger-text)" };
  if (status === "perdido") return { label: "Perdido", color: "var(--cf2-danger-text)" };
  return { label: status, color: "var(--cf2-text-tertiary)" };
}

function kindDeArquivo(nomeArquivo: string, tipoMime?: string | null): "imagem" | "pdf" | "outro" {
  if (tipoMime?.startsWith("image/")) return "imagem";
  if (tipoMime === "application/pdf") return "pdf";
  const ext = nomeArquivo.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return "imagem";
  if (ext === "pdf") return "pdf";
  return "outro";
}

/**
 * Página de Empresa (25/08) — registro genérico da empresa no CRM2,
 * independente de ela já ter virado cliente pagante ou não. Diferente do
 * "Cliente 360" (`/clientes/[id]`, `Cf2Cliente360`): aquele é uma visão
 * operacional de sucesso do cliente (Onboarding/Implantação/CS/Financeiro/
 * Saúde) que só faz sentido pra quem já tem serviço ativo — usar ele pra
 * empresa sem venda (achado real, 25/08, feedback direto do Kauã: "cliente
 * 360 não é a mesma coisa que empresa") mostrava card de billing/onboarding
 * vazio pra prospect, confuso. Esta página aqui é o registro de EMPRESA de
 * verdade: leads/contatos, negócios (qualquer status), contratos,
 * documentos, notas — o que o CRM legado (`(crm)/empresas/[id]`) já
 * mostrava, só que nativo do CRM2. Endpoint reaproveitado, zero backend
 * novo: `GET /api/empresas/:id` já retorna tudo (`empresa, leads, negocios,
 * notas, contratos`).
 */
export function Cf2EmpresaWorkspace({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const { usuarios, byId: usuariosById } = useOrgUsuarios();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", setor: "", porte: "", cidade: "", estado: "", website: "", observacoes: "" });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [novaOportunidadeAberta, setNovaOportunidadeAberta] = useState(false);
  const [preview, setPreview] = useState<{ url: string; nome: string; tipo: "imagem" | "pdf" | "outro" } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["empresa-detalhe", empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/empresas/${empresaId}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Não foi possível carregar a empresa.");
      return r.json() as Promise<{ empresa: Empresa; leads: Lead[]; negocios: Negocio[]; notas: Nota[]; contratos: Contrato[] }>;
    },
  });

  const negocioIds = data?.negocios.map((n) => n.id) ?? [];
  const contratoIds = data?.contratos.map((c) => c.id) ?? [];

  const { data: anexosLegado = [] } = useQuery<AnexoLegado[]>({
    queryKey: ["anexos-legado-empresa", empresaId, negocioIds.join(","), contratoIds.join(",")],
    queryFn: async () => {
      const fetchTipo = async (tipo: string, ids: string[]): Promise<AnexoLegado[]> => {
        if (ids.length === 0) return [];
        const r = await fetch(`/api/anexos-legado?entidadeTipo=${tipo}&entidadeIds=${ids.join(",")}`);
        if (!r.ok) return [];
        const j = await r.json();
        return j.anexos || [];
      };
      const [empresaAnexos, negocioAnexos, contratoAnexos] = await Promise.all([
        fetchTipo("empresa", [empresaId]),
        fetchTipo("negocio", negocioIds),
        fetchTipo("contrato", contratoIds),
      ]);
      return [...empresaAnexos, ...negocioAnexos, ...contratoAnexos];
    },
    enabled: !!data,
  });

  // Anexos reais (upload direto no CRM, ver negocios/Workspace.tsx) são
  // por negócio — agrega os de todos os negócios desta empresa.
  const { data: anexosReais = [] } = useQuery<AnexoReal[]>({
    queryKey: ["anexos-empresa", empresaId, negocioIds.join(",")],
    queryFn: async () => {
      if (negocioIds.length === 0) return [];
      const listas = await Promise.all(negocioIds.map(async (id) => {
        const r = await fetch(`/api/anexos?negocioId=${id}`);
        if (!r.ok) return [];
        const j = await r.json();
        return (j.anexos || []) as AnexoReal[];
      }));
      return listas.flat();
    },
    enabled: !!data,
  });

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/empresas/${empresaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Falha ao atualizar.");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa-detalhe", empresaId] }); setEditando(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const r = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, empresaId }) });
      if (!r.ok) throw new Error("falha ao salvar nota");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa-detalhe", empresaId] }); setNoteText(""); setNoteOpen(false); },
    onError: () => toast.error("Não foi possível salvar a nota"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Cf2Skeleton className="h-10 w-64" />
        <Cf2Skeleton className="h-32 w-full" />
        <Cf2Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError) return <div className=""><Cf2ErrorState message={(error as Error).message} /></div>;
  if (!data?.empresa) return <div className=""><Cf2EmptyState title="Empresa não encontrada" /></div>;

  const { empresa, leads, negocios, notas, contratos } = data;
  const negociosAbertos = negocios.filter((n) => n.status !== "ganho" && !MOTIVO_PERDA_ESTRUTURADO[n.status] && n.status !== "perdido");
  const negociosGanhos = negocios.filter((n) => n.status === "ganho");
  const negociosPerdidos = negocios.filter((n) => n.status === "perdido" || MOTIVO_PERDA_ESTRUTURADO[n.status]);
  const valorGanho = negociosGanhos.reduce((s, n) => s + parseFloat(n.mrrFechado || n.mrrEstimado || n.valorTotal || "0"), 0);
  const contratosAtivos = contratos.filter((c) => c.status === "ativo");
  const notaMaisRecente = notas[0] ?? null;

  function abrirPreview(nome: string, url: string, tipoMime?: string | null) {
    setPreview({ url, nome, tipo: kindDeArquivo(nome, tipoMime) });
  }

  return (
    <>
      <div className="-m-6 mb-0 flex flex-col">
        <div className="rounded-tl-2xl px-8 py-3.5" style={{ background: "var(--cf2-bg-surface)", borderBottom: "1px solid var(--cf2-border-default)" }}>
        {/* Topo no PADRÃO do sistema (01/09): branco, compacto, sem título
            grande e sem CTA — a página de detalhe já tem o próprio heading
            logo abaixo. Mesma correção aplicada na página da oportunidade. */}
          <Cf2Topbar orgNome="Callface" variant="light" compact actions={null} />
        </div>
        <div data-cf2-superficie="escura" className="px-8 py-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
            <Link href="/contatos" className="hover:underline">Contatos & Empresas</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "var(--cf2-chrome-text-primary)" }}>{empresa.nome}</span>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-2xl shrink-0 w-12 h-12" style={{ background: "rgba(255,255,255,0.08)" }}>
                <Building2 className="w-6 h-6" style={{ color: "var(--cf2-chrome-text-primary)" }} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-[26px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{empresa.nome}</p>
                  {empresa.setor && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>{empresa.setor}</span>}
                  {empresa.porte && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>{empresa.porte}</span>}
                  {empresa.enrichStatus === "enriched" && <Cf2Badge variant="accent">Apollo</Cf2Badge>}
                </div>
                <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
                  {leads.length} contato{leads.length === 1 ? "" : "s"} · {negocios.length} negócio{negocios.length === 1 ? "" : "s"}{contratosAtivos.length > 0 ? ` · ${contratosAtivos.length} contrato${contratosAtivos.length === 1 ? "" : "s"} ativo${contratosAtivos.length === 1 ? "" : "s"}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setNovaOportunidadeAberta(true)} className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="w-3.5 h-3.5" /> Nova oportunidade</button>
              <button onClick={() => { setActiveTab("notas"); setNoteOpen(true); }} className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cf2-accent)]" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)" }}><NotebookPen className="w-3.5 h-3.5" /> Nota</button>
              <button onClick={() => { setForm({ nome: empresa.nome, cnpj: empresa.cnpj || "", setor: empresa.setor || "", porte: empresa.porte || "", cidade: empresa.cidade || "", estado: empresa.estado || "", website: empresa.website || "", observacoes: empresa.observacoes || "" }); setEditando(true); setActiveTab("visao-geral"); }} className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-semibold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cf2-accent)]" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)" }}><Pencil className="w-3.5 h-3.5" /> Editar</button>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap pt-1">
            <HeaderMetric hero label="Ganho" value={brl(valorGanho)} sub={`${negociosGanhos.length} negócio${negociosGanhos.length === 1 ? "" : "s"}`} />
            <HeaderMetric label="Negócios abertos" value={String(negociosAbertos.length)} />
            <HeaderMetric label="Negócios perdidos" value={String(negociosPerdidos.length)} />
            <HeaderMetric label="Contratos ativos" value={String(contratosAtivos.length)} />
            <HeaderMetric label="Contatos" value={String(leads.length)} />
          </div>
        </div>
      </div>

      <div className="pt-6 pb-16">
        <Cf2Tabs value={activeTab} onValueChange={setActiveTab}>
          <Cf2TabsList className="w-full flex-wrap justify-start overflow-x-auto mb-4">
            <Cf2TabsTrigger value="visao-geral">Visão geral</Cf2TabsTrigger>
            <Cf2TabsTrigger value="negocios">Negócios{negocios.length > 0 ? ` (${negocios.length})` : ""}</Cf2TabsTrigger>
            <Cf2TabsTrigger value="contatos">Contatos{leads.length > 0 ? ` (${leads.length})` : ""}</Cf2TabsTrigger>
            <Cf2TabsTrigger value="contratos">Contratos{contratos.length > 0 ? ` (${contratos.length})` : ""}</Cf2TabsTrigger>
            <Cf2TabsTrigger value="documentos">Documentos</Cf2TabsTrigger>
            <Cf2TabsTrigger value="notas">Notas{notas.length > 0 ? ` (${notas.length})` : ""}</Cf2TabsTrigger>
          </Cf2TabsList>

          {/* ═══ VISÃO GERAL ═══ */}
          <Cf2TabsContent value="visao-geral">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Building2} tint="#3B82F6" title="Sobre a empresa" />
                    {!editando && <button onClick={() => { setForm({ nome: empresa.nome, cnpj: empresa.cnpj || "", setor: empresa.setor || "", porte: empresa.porte || "", cidade: empresa.cidade || "", estado: empresa.estado || "", website: empresa.website || "", observacoes: empresa.observacoes || "" }); setEditando(true); }} className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}><Pencil className="w-3 h-3" /> Editar</button>}
                  </div>
                  {editando ? (
                    <div className="mt-3 flex flex-col gap-2.5">
                      <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome da empresa" aria-label="Nome da empresa" className="w-full text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      <div className="flex gap-2">
                        <input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} placeholder="CNPJ" aria-label="CNPJ" className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                        <input value={form.setor} onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))} placeholder="Setor" aria-label="Setor" className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                        <input value={form.porte} onChange={(e) => setForm((f) => ({ ...f, porte: e.target.value }))} placeholder="Porte" aria-label="Porte" className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      </div>
                      <div className="flex gap-2">
                        <input value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} placeholder="Cidade" aria-label="Cidade" className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                        <input value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} placeholder="UF" className="w-20 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                        <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="Website" aria-label="Website" className="flex-1 text-[13px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      </div>
                      <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Observações" aria-label="Observações" rows={3} className="w-full text-[13px] px-2.5 py-2 rounded-lg outline-none resize-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditando(false)} className="text-[12px] px-3 py-1.5" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
                        <button onClick={() => patch.mutate({ nome: form.nome, cnpj: form.cnpj || null, setor: form.setor || null, porte: form.porte || null, cidade: form.cidade || null, estado: form.estado || null, website: form.website || null, observacoes: form.observacoes || null })} disabled={patch.isPending || !form.nome.trim()} className="text-[12px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <PropertyRow label="CNPJ" value={empresa.cnpj || "—"} />
                      <PropertyRow label="Setor" value={empresa.setor || empresa.industry || "—"} />
                      <PropertyRow label="Porte" value={empresa.porte || (empresa.employeeCount ? `${empresa.employeeCount} funcionários` : "—")} />
                      <PropertyRow label="Localização" value={empresa.cidade && empresa.estado ? `${empresa.cidade}/${empresa.estado}` : empresa.cidade || empresa.estado || "—"} />
                      {empresa.website && <PropertyRow label="Website" value={empresa.website} />}
                      {empresa.instagram && <PropertyRow label="Instagram" value={empresa.instagram} />}
                      {empresa.observacoes && <PropertyRow label="Observações" value={empresa.observacoes} />}
                      <PropertyRow label="Criada em" value={formatData(empresa.createdAt)} />
                    </div>
                  )}
                </Cf2Card>

                {(empresa.apolloDescription || empresa.techStack?.length || empresa.totalFunding) && (
                  <Cf2Card>
                    <CardTitulo icon={Sparkles} tint="var(--cf2-accent-border)" title="Dados enriquecidos (Apollo)" />
                    <div className="mt-3 flex flex-col gap-2">
                      {empresa.apolloDescription && <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{empresa.apolloDescription}</p>}
                      <div className="flex items-center gap-4 flex-wrap text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                        {empresa.foundedYear && <span>Fundada em {empresa.foundedYear}</span>}
                        {empresa.annualRevenue && <span>Receita anual: {empresa.annualRevenue}</span>}
                        {empresa.totalFunding && <span>Funding: {empresa.totalFunding}{empresa.fundingStage ? ` (${empresa.fundingStage})` : ""}</span>}
                      </div>
                      {empresa.techStack && empresa.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {empresa.techStack.slice(0, 12).map((t) => <span key={t} className="text-[11px] px-2 py-1 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{t}</span>)}
                        </div>
                      )}
                    </div>
                  </Cf2Card>
                )}

                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Briefcase} tint="var(--cf2-accent-border)" title="Negócios" subtitle={`${negocios.length} no total`} />
                    <button onClick={() => setActiveTab("negocios")} className="text-[12px] font-semibold shrink-0" style={{ color: "var(--cf2-accent-text)" }}>Ver todos →</button>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {negocios.length === 0 && <Cf2EmptyState title="Nenhum negócio ainda" description="Crie a primeira oportunidade pra esta empresa." />}
                    {negocios.slice(0, 4).map((n) => <NegocioRow key={n.id} n={n} responsavelNome={n.responsavelId ? usuariosById.get(n.responsavelId)?.nome ?? null : null} />)}
                  </div>
                </Cf2Card>
              </div>

              <div className="space-y-4">
                <Cf2Card>
                  <div className="flex items-center justify-between">
                    <CardTitulo icon={Users} tint="#06B6D4" title="Contatos" subtitle={`${leads.length} vinculado${leads.length === 1 ? "" : "s"}`} />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {leads.length === 0 && <Cf2EmptyState title="Nenhum contato vinculado" />}
                    {leads.slice(0, 5).map((l) => (
                      <Link key={l.id} href={`/contatos/${l.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{l.nome}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{l.cargo || "—"}</p>
                        </div>
                        <Cf2Badge variant="neutral">{l.tipo}</Cf2Badge>
                      </Link>
                    ))}
                    {leads.length > 5 && <button onClick={() => setActiveTab("contatos")} className="text-[12px] font-semibold pt-1" style={{ color: "var(--cf2-accent-text)" }}>Ver todos ({leads.length}) →</button>}
                  </div>
                </Cf2Card>

                <Cf2Card>
                  <CardTitulo icon={ShieldCheck} tint="var(--cf2-success-text)" title="Contratos" subtitle={`${contratosAtivos.length} ativo${contratosAtivos.length === 1 ? "" : "s"}`} />
                  <div className="mt-3 space-y-1.5">
                    {contratos.length === 0 && <Cf2EmptyState title="Nenhum contrato" />}
                    {contratos.slice(0, 4).map((ct) => (
                      <div key={ct.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <span className="text-[12px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{ct.produto || "Contrato"}</span>
                        <Cf2Badge variant={ct.status === "ativo" ? "success" : ct.status === "churned" || ct.status === "cancelado" ? "danger" : "neutral"}>{ct.status}</Cf2Badge>
                      </div>
                    ))}
                  </div>
                </Cf2Card>

                <Cf2Card>
                  <CardTitulo icon={NotebookPen} tint="var(--cf2-warning-text)" title="Última nota" />
                  <div className="mt-3">
                    {notaMaisRecente ? (
                      <div className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{notaMaisRecente.autorNome || "—"}{notaMaisRecente.pessoaNome ? ` · via ${notaMaisRecente.pessoaNome}` : ""} · {formatDataHora(notaMaisRecente.createdAt)}</p>
                        <p className="text-[13px] mt-1" style={{ color: "var(--cf2-text-primary)" }}>{notaMaisRecente.conteudo}</p>
                      </div>
                    ) : (
                      <Cf2EmptyState title="Nenhuma nota ainda" />
                    )}
                  </div>
                </Cf2Card>
              </div>
            </div>
          </Cf2TabsContent>

          {/* ═══ NEGÓCIOS ═══ */}
          <Cf2TabsContent value="negocios">
            <Cf2Card>
              <div className="flex items-center justify-between">
                <Cf2SectionHeader title="Negócios desta empresa" />
                <button onClick={() => setNovaOportunidadeAberta(true)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="w-3.5 h-3.5" /> Nova oportunidade</button>
              </div>
              <div className="mt-3 space-y-1.5">
                {negocios.length === 0 && <Cf2EmptyState title="Nenhum negócio ainda" />}
                {negocios.map((n) => <NegocioRow key={n.id} n={n} responsavelNome={n.responsavelId ? usuariosById.get(n.responsavelId)?.nome ?? null : null} detalhado />)}
              </div>
            </Cf2Card>
          </Cf2TabsContent>

          {/* ═══ CONTATOS ═══ */}
          <Cf2TabsContent value="contatos">
            <Cf2Card>
              <Cf2SectionHeader title="Contatos vinculados a esta empresa" />
              <div className="mt-3 space-y-1.5">
                {leads.length === 0 && <Cf2EmptyState title="Nenhum contato vinculado" />}
                {leads.map((l) => (
                  <Link key={l.id} href={`/contatos/${l.id}`} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{l.nome}{l.cargo ? ` · ${l.cargo}` : ""}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{[l.email, l.telefone].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Cf2Badge variant="neutral">{l.tipo}</Cf2Badge>
                      {l.leadScore > 0 && <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>Score {l.leadScore}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </Cf2Card>
          </Cf2TabsContent>

          {/* ═══ CONTRATOS ═══ */}
          <Cf2TabsContent value="contratos">
            <Cf2Card>
              <Cf2SectionHeader title="Contratos" subtitle="Resolvidos via leads e negócios desta empresa — contrato não tem vínculo direto com empresa no schema" />
              <div className="mt-3 space-y-1.5">
                {contratos.length === 0 && <Cf2EmptyState title="Nenhum contrato" />}
                {contratos.map((ct) => (
                  <div key={ct.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{ct.produto || "Contrato"}</p>
                      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{ct.mrr ? `${brl(ct.mrr)}/mês` : ct.valorSetup ? brl(ct.valorSetup) : "—"}{ct.vencimento ? ` · vence ${formatData(ct.vencimento)}` : ""}</p>
                    </div>
                    <Cf2Badge variant={ct.status === "ativo" ? "success" : ct.status === "churned" || ct.status === "cancelado" ? "danger" : "neutral"}>{ct.status}</Cf2Badge>
                  </div>
                ))}
              </div>
            </Cf2Card>
          </Cf2TabsContent>

          {/* ═══ DOCUMENTOS ═══ */}
          <Cf2TabsContent value="documentos">
            <div className="space-y-4">
              <Cf2Card>
                <CardTitulo icon={Paperclip} tint="var(--cf2-accent-border)" title={`Anexos (${anexosReais.length})`} subtitle="Arquivos enviados nos negócios desta empresa" />
                <div className="mt-3 space-y-1.5">
                  {anexosReais.length === 0 && <Cf2EmptyState title="Nenhum anexo ainda" />}
                  {anexosReais.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <button type="button" onClick={() => abrirPreview(a.nomeArquivo, a.url, a.tipoMime)} className="flex items-center gap-1.5 min-w-0 text-[13px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ color: "var(--cf2-text-primary)" }}>
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} /> <span className="truncate">{a.nomeArquivo}</span>
                      </button>
                      <a href={a.url} target="_blank" rel="noreferrer" aria-label={`Baixar ${a.nomeArquivo}`} style={{ color: "var(--cf2-text-tertiary)" }}><Download className="w-3.5 h-3.5" /></a>
                    </div>
                  ))}
                </div>
              </Cf2Card>
              <Cf2Card>
                <Cf2SectionHeader title={`Histórico migrado (${anexosLegado.length})`} subtitle="Importado do Zoho — pode não estar disponível pra baixar dependendo do ambiente" />
                <div className="mt-3 space-y-1.5">
                  {anexosLegado.length === 0 && <Cf2EmptyState title="Nenhum anexo" />}
                  {anexosLegado.map((doc) => {
                    const url = `/api/anexos-legado/${doc.id}/download`;
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                        {doc.arquivoDisponivel ? (
                          <button type="button" onClick={() => abrirPreview(doc.nomeArquivo, url)} className="text-[13px] truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ color: "var(--cf2-text-primary)" }}>{doc.nomeArquivo}</button>
                        ) : (
                          <span className="text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{doc.nomeArquivo}</span>
                        )}
                        {doc.arquivoDisponivel ? (
                          <a href={url} className="flex items-center gap-1 text-[12px] font-medium shrink-0" style={{ color: "var(--cf2-success-text)" }}><Download className="w-3 h-3" /> Baixar</a>
                        ) : (
                          <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>Indisponível</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Cf2Card>
            </div>
          </Cf2TabsContent>

          {/* ═══ NOTAS ═══ */}
          <Cf2TabsContent value="notas">
            <Cf2Card>
              <div className="flex items-center justify-between">
                <Cf2SectionHeader title="Notas" subtitle="Direto na empresa ou vindas de qualquer contato vinculado" />
                {!noteOpen && <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}><Plus className="w-3.5 h-3.5" /> Adicionar nota</button>}
              </div>
              {noteOpen && (
                <div className="mt-3 flex flex-col gap-1.5 pb-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                  <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Escreva uma nota…" aria-label="Escreva uma nota" rows={3} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); if (e.key === "Escape") { setNoteOpen(false); setNoteText(""); } }} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setNoteOpen(false); setNoteText(""); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
                    <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> {addNota.isPending ? "Salvando…" : "Salvar"}</button>
                  </div>
                </div>
              )}
              <div className="mt-3 space-y-2">
                {notas.length === 0 && !noteOpen && <Cf2EmptyState title="Nenhuma nota ainda" />}
                {notas.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{n.autorNome || "—"}{n.pessoaNome ? ` · via ${n.pessoaNome}` : ""}</span>
                      <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{formatDataHora(n.createdAt)}</span>
                    </div>
                    <p className="text-[13px] mt-1" style={{ color: "var(--cf2-text-primary)" }}>{n.conteudo}</p>
                  </div>
                ))}
              </div>
            </Cf2Card>
          </Cf2TabsContent>
        </Cf2Tabs>
      </div>

      <NovaOportunidadeModal
        open={novaOportunidadeAberta}
        onClose={() => setNovaOportunidadeAberta(false)}
        usuarios={usuarios}
        fromCliente={{ empresaId }}
        onCreated={() => { setNovaOportunidadeAberta(false); qc.invalidateQueries({ queryKey: ["empresa-detalhe", empresaId] }); }}
      />

      <Cf2Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <Cf2DialogContent className="max-w-4xl w-[92vw] h-[85vh] flex flex-col">
          <Cf2DialogHeader className="flex-row items-center justify-between gap-3 pr-6">
            <Cf2DialogTitle className="truncate">{preview?.nome}</Cf2DialogTitle>
            {preview && <a href={preview.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] font-semibold shrink-0" style={{ color: "var(--cf2-accent-text)" }}><Download className="w-3.5 h-3.5" /> Baixar</a>}
          </Cf2DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto rounded-lg flex items-center justify-center" style={{ background: "var(--cf2-bg-canvas)" }}>
            {preview?.tipo === "imagem" && <img src={preview.url} alt={preview.nome} className="max-w-full max-h-full object-contain" />}
            {preview?.tipo === "pdf" && <iframe src={preview.url} title={preview.nome} className="w-full h-full" style={{ border: "none" }} />}
            {preview?.tipo === "outro" && (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <FileText className="w-8 h-8" style={{ color: "var(--cf2-text-tertiary)" }} />
                <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Pré-visualização não disponível pra este tipo de arquivo.</p>
                {preview && <a href={preview.url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}>Baixar {preview.nome}</a>}
              </div>
            )}
          </div>
        </Cf2DialogContent>
      </Cf2Dialog>
    </>
  );
}

function CardTitulo({ icon: Icon, tint, title, subtitle }: { icon: typeof Building2; tint: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-[15px] font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{title}</p>
        {subtitle && <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function HeaderMetric({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</span>
      <span className={hero ? "text-[26px] font-bold" : "text-[14px] font-bold"} style={{ color: hero ? "var(--cf2-accent)" : "var(--cf2-chrome-text-primary)", fontFamily: hero ? "var(--cf2-font-heading)" : undefined }}>{value}</span>
      {sub && <span className="text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{sub}</span>}
    </div>
  );
}

function NegocioRow({ n, responsavelNome, detalhado }: { n: Negocio; responsavelNome: string | null; detalhado?: boolean }) {
  const info = statusNegocioInfo(n.status);
  const valor = n.mrrFechado || n.mrrEstimado || n.valorTotal;
  return (
    <Link href={`/negocios/${n.id}`} className="block p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{n.titulo}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${info.color}22`, color: info.color }}>{info.label}</span>
          <span className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{brl(valor)}</span>
        </div>
      </div>
      {detalhado && (
        <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          <span>Criado {formatData(n.createdAt)}</span>
          {responsavelNome && <span>{responsavelNome}</span>}
          {n.motivoPerda && <span>{n.motivoPerda}</span>}
        </div>
      )}
    </Link>
  );
}
