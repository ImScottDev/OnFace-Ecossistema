"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { CustomFieldsSection } from "@/components/crm/CustomFieldsSection";
import { Building2, User, Briefcase, FileText, Download, Send, Plus, Sparkles, X, ExternalLink } from "lucide-react";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Section, PropertyRow } from "@/components/crm2/shared/DrawerSection";
import { Cf2Badge } from "@/components/crm2/ui/Badge";
import { Cf2Card } from "@/components/crm2/ui/Card";

interface EmpresaDrawerProps {
  empresaId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenLead?: (id: string) => void;
  onOpenNegocio?: (id: string) => void;
}

interface AnexoLegado {
  id: string;
  entidadeId: string | null;
  nomeArquivo: string;
  tamanhoBytes: number | null;
  categoria: string;
  criadoEmOriginal: string | null;
  zohoId: string | null;
  arquivoDisponivel: boolean;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "tamanho desconhecido";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Anexos legados (histórico Zoho, tabela `anexos_legado`) — agrega empresa
// direto + negócios + contratos vinculados (contrato/negócio não têm
// empresaId direto na tabela de anexos, então cada tipo é buscado
// separado e mesclado aqui no client).
function useAnexosLegadoEmpresa(empresaId: string | null, negocioIds: string[], contratoIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["anexos-legado-empresa", empresaId, negocioIds.join(","), contratoIds.join(",")],
    queryFn: async () => {
      const fetchTipo = async (tipo: string, ids: string[]): Promise<AnexoLegado[]> => {
        if (ids.length === 0) return [];
        const res = await fetch(`/api/anexos-legado?entidadeTipo=${tipo}&entidadeIds=${ids.join(",")}`);
        if (!res.ok) return [];
        const j = await res.json();
        return (j.anexos || []) as AnexoLegado[];
      };
      const [empresaAnexos, negocioAnexos, contratoAnexos] = await Promise.all([
        fetchTipo("empresa", empresaId ? [empresaId] : []),
        fetchTipo("negocio", negocioIds),
        fetchTipo("contrato", contratoIds),
      ]);
      return [...empresaAnexos, ...negocioAnexos, ...contratoAnexos];
    },
    enabled,
  });
}

function AddNoteInlineEmpresa({ empresaId }: { empresaId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const res = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, empresaId }) });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] }); setText(""); setOpen(false); },
  });
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>
        <Plus className="w-3.5 h-3.5" /> Adicionar nota
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma nota…" rows={3}
        className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]"
        style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) addNota.mutate(text.trim()); if (e.key === "Escape") { setOpen(false); setText(""); } }}
      />
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setText(""); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button onClick={() => text.trim() && addNota.mutate(text.trim())} disabled={!text.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}>
          <Send className="w-3 h-3" /> {addNota.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

/**
 * Drawer de empresa (25/08) — modernizado pro tema claro do CRM2. Antes era
 * o componente legado (dark theme hardcoded, `#e23752`/`bg-white/[0.03]`)
 * flutuando dentro do shell claro de Contatos & Empresas — achado direto do
 * Kauã vendo a tela ("ainda tá com o drawer na versão antiga"). Mesmos
 * dados/endpoint de sempre (`GET /api/empresas/:id`), mesmos callbacks
 * (`onOpenLead`/`onOpenNegocio`) — só a casca visual mudou, pra não quebrar
 * os 3 pontos de entrada que já usam este componente (Contatos & Empresas,
 * Qualificação, LeadDrawer). Edição de campo a campo (CNPJ etc., que antes
 * vivia aqui via `CampoEditavel`) foi pra "Editar" na página completa
 * (`/empresas/[id]`), que já tem formulário de verdade — não duplicar 2
 * jeitos de editar a mesma coisa.
 */
export function EmpresaDrawer({ empresaId, open, onClose, onOpenLead, onOpenNegocio }: EmpresaDrawerProps) {
  const { setores } = usePipelineConfig();
  const queryClient = useQueryClient();

  const updateEmpresaCustomFields = useMutation({
    mutationFn: async (camposCustom: Record<string, unknown>) => {
      await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camposCustom }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${empresaId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!empresaId && open,
  });

  const empresa = data?.empresa;
  const leads: Array<{ id: string; nome: string; email: string | null; telefone: string; cargo: string | null; tipo: string; leadScore: number }> = data?.leads || [];
  const negocios: Array<{ id: string; titulo: string; status: string; mrrEstimado: string | null; valorProjeto: string | null; valorTotal: string | null; createdAt: string }> = data?.negocios || [];
  const notas: Array<{ id: string; conteudo: string; autorNome: string | null; createdAt: string; pessoaNome?: string | null }> = data?.notas || [];
  const contratosEmpresa: Array<{ id: string; status: string; assinaturaStatus: string | null; signatureStatus: string | null; descricao: string | null; createdAt: string; zohoId?: string | null }> = data?.contratos || [];
  const setorLabel = empresa ? setores.find((s) => s.key === empresa.setor)?.label : undefined;

  const negocioIdsParaAnexos = negocios.map((n) => n.id);
  const contratoIdsParaAnexos = contratosEmpresa.map((c) => c.id);
  const { data: anexosLegado = [] } = useAnexosLegadoEmpresa(empresaId, negocioIdsParaAnexos, contratoIdsParaAnexos, !!empresa);

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      bare
      // Canvas (não branco puro) pra os cards de seção terem contraste de
      // verdade — bug real 25/08: com panelBg branco, `Cf2Card` (também
      // branco) ficava sem nenhuma borda visível de fato, texto flutuando
      // solto sem estrutura ("ficou péssimo", feedback direto do Kauã).
      panelBg="var(--cf2-bg-canvas)"
      width="w-full sm:w-[540px]"
    >
      {/* Header próprio — modo `bare` do DetailDrawer NÃO renderiza header
          nenhum (nem botão de fechar, nem "ver página completa"): quem usa
          `bare` precisa construir os dois. Bug real 25/08 corrigido: o
          rewrite anterior esqueceu isso, a versão nova saiu sem "X" pra
          fechar e sem link pra página completa — achado direto do Kauã. */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ background: "var(--cf2-bg-surface)", borderBottom: "1px solid var(--cf2-border-default)" }}>
        <p className="text-[15px] font-bold truncate" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{empresa?.nome || "Empresa"}</p>
        <div className="flex items-center gap-1 shrink-0">
          {empresaId && (
            <Link href={`/empresas/${empresaId}`} title="Abrir página completa" aria-label="Abrir página completa" className="p-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: "var(--cf2-text-tertiary)" }}>
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: "var(--cf2-text-tertiary)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--cf2-bg-surface-muted)" }} />)}
        </div>
      ) : !empresa ? (
        <div className="p-8 text-center text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Empresa não encontrada</div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {/* Sub-header (logo/setor/porte) — o nome já está no header fixo acima */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center rounded-xl shrink-0 w-11 h-11 overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt={empresa.nome} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-5 h-5" style={{ color: "var(--cf2-text-secondary)" }} />
              )}
            </div>
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              {setorLabel && <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{setorLabel}</span>}
              {empresa.industry && empresa.industry !== setorLabel && <Cf2Badge variant="accent">{empresa.industry}</Cf2Badge>}
              {empresa.employeeCount && <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{Number(empresa.employeeCount).toLocaleString("pt-BR")} func.</span>}
            </div>
          </div>

          <Link href="/negocios/novo" title="Escolha o contato dessa empresa na tela de criação" className="flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            <Briefcase className="w-3.5 h-3.5" /> Nova oportunidade
          </Link>

          {empresa.apolloDescription && (
            <p className="text-[13px] leading-relaxed px-1" style={{ color: "var(--cf2-text-secondary)" }}>
              {String(empresa.apolloDescription).length > 220 ? `${String(empresa.apolloDescription).slice(0, 220)}…` : empresa.apolloDescription}
            </p>
          )}

          <Cf2Card padding="14px">
          <Section title="Informações">
            <div className="flex flex-col gap-2">
              <PropertyRow label="CNPJ" value={empresa.cnpj || "—"} />
              {empresa.porte && <PropertyRow label="Porte" value={empresa.porte} />}
              {(empresa.cidade || empresa.estado) && <PropertyRow label="Localização" value={[empresa.cidade, empresa.estado].filter(Boolean).join(" / ")} />}
              {empresa.telefone && <PropertyRow label="Telefone" value={empresa.telefone} />}
              {empresa.website && (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span style={{ color: "var(--cf2-text-tertiary)" }}>Website</span>
                  <a href={empresa.website.startsWith("http") ? empresa.website : `https://${empresa.website}`} target="_blank" rel="noopener noreferrer" className="font-medium truncate max-w-[220px] hover:underline" style={{ color: "var(--cf2-accent-border)" }}>{empresa.website}</a>
                </div>
              )}
              {empresa.instagram && (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span style={{ color: "var(--cf2-text-tertiary)" }}>Instagram</span>
                  <a href={`https://instagram.com/${(empresa.instagram as string).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: "var(--cf2-accent-border)" }}>@{(empresa.instagram as string).replace(/^@/, "")}</a>
                </div>
              )}
              {empresa.linkedin && (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span style={{ color: "var(--cf2-text-tertiary)" }}>LinkedIn</span>
                  <a href={String(empresa.linkedin).startsWith("http") ? String(empresa.linkedin) : `https://linkedin.com/company/${empresa.linkedin}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: "var(--cf2-accent-border)" }}>Ver perfil</a>
                </div>
              )}
              {(empresa.annualRevenue || empresa.foundedYear) && (
                <div className="flex items-center gap-4 pt-1.5" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                  {empresa.annualRevenue && <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Receita: <b style={{ color: "var(--cf2-text-primary)" }}>{empresa.annualRevenue}</b></span>}
                  {empresa.foundedYear && <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Fundada em <b style={{ color: "var(--cf2-text-primary)" }}>{empresa.foundedYear}</b></span>}
                </div>
              )}
            </div>
          </Section>
          </Cf2Card>

          <Cf2Card padding="14px">
          <Section title={`Leads (${leads.length})`}>
            {leads.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {leads.map((l) => (
                  <button key={l.id} onClick={() => onOpenLead?.(l.id)} className="flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-[var(--cf2-bg-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]">
                    <span className="flex items-center justify-center rounded-full shrink-0 w-7 h-7" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <User className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{l.nome}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{l.cargo || l.email || l.telefone}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Cf2Badge variant={l.tipo === "cliente" ? "success" : l.tipo === "lead" ? "accent" : "neutral"}>{l.tipo}</Cf2Badge>
                      <span className="text-[11px] font-semibold" style={{ color: l.leadScore >= 70 ? "var(--cf2-success-text)" : l.leadScore >= 40 ? "var(--cf2-warning-text)" : "var(--cf2-text-tertiary)" }}>{l.leadScore}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12px] py-2 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum lead vinculado</p>
            )}
          </Section>
          </Cf2Card>

          <Cf2Card padding="14px">
          <Section title={`Negócios (${negocios.length})`}>
            {negocios.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {negocios.map((n) => {
                  const total = parseFloat(n.valorTotal || "0") || (parseFloat(n.mrrEstimado || "0") || 0) + (parseFloat(n.valorProjeto || "0") || 0);
                  return (
                    <button key={n.id} onClick={() => onOpenNegocio?.(n.id)} className="flex items-center justify-between p-2 rounded-lg text-left transition-colors hover:bg-[var(--cf2-bg-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{n.titulo}</p>
                          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(n.createdAt).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Cf2Badge variant={n.status === "ganho" ? "success" : n.status === "perdido" ? "danger" : "neutral"}>{n.status}</Cf2Badge>
                        {total > 0 && <span className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] py-2 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum negócio vinculado</p>
            )}
          </Section>
          </Cf2Card>

          <Cf2Card padding="14px">
          <Section title={`Contratos (${contratosEmpresa.length})`}>
            {contratosEmpresa.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {contratosEmpresa.map((ct) => {
                  const assinado = ct.signatureStatus === "signed" || ct.assinaturaStatus === "aceite_simples";
                  return (
                    <div key={ct.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{ct.descricao || "Contrato"}</p>
                          <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(ct.createdAt).toLocaleDateString("pt-BR")}{ct.zohoId ? " · histórico (Zoho)" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a href={`/api/contratos/${ct.id}/pdf`} target="_blank" rel="noreferrer" className="text-[11px] font-medium hover:underline" style={{ color: "var(--cf2-accent-border)" }}>PDF</a>
                        <Cf2Badge variant={assinado ? "success" : "neutral"}>{assinado ? "Assinado" : ct.status}</Cf2Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] py-2 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum contrato vinculado</p>
            )}
          </Section>
          </Cf2Card>

          <Cf2Card padding="14px">
          <Section title={`Documentos (${anexosLegado.length})`} description="Histórico migrado (Zoho) — pode não estar disponível pra baixar dependendo do ambiente">
            {anexosLegado.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {anexosLegado.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                      <p className="text-[13px] font-medium truncate" title={doc.nomeArquivo} style={{ color: "var(--cf2-text-primary)" }}>{doc.nomeArquivo}</p>
                    </div>
                    {doc.arquivoDisponivel ? (
                      <a href={`/api/anexos-legado/${doc.id}/download`} className="flex items-center gap-1 text-[11px] font-medium shrink-0" style={{ color: "var(--cf2-success-text)" }}><Download className="w-3 h-3" /> Baixar</a>
                    ) : (
                      <span title="Arquivo físico não disponível neste ambiente" className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>Indisponível</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] py-2 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum documento histórico vinculado</p>
            )}
          </Section>
          </Cf2Card>

          <Cf2Card padding="14px">
          <CustomFieldsSection
            entidade="empresa"
            valores={empresa?.camposCustom as Record<string, unknown> | null | undefined}
            onUpdate={(campos) => updateEmpresaCustomFields.mutate(campos)}
          />
          </Cf2Card>

          <Cf2Card padding="14px">
          <Section title={`Notas${notas.length > 0 ? ` (${notas.length})` : ""}`}>
            <div className="flex flex-col gap-2">
              {notas.slice(0, 3).map((n) => (
                <div key={n.id} className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{n.conteudo.length > 150 ? `${n.conteudo.slice(0, 150)}…` : n.conteudo}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                    <span>{n.autorNome || "Sistema"}</span>
                    {n.pessoaNome && <span>· via {n.pessoaNome}</span>}
                    <span>{new Date(n.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              ))}
              {notas.length > 3 && <p className="text-[11px] text-center" style={{ color: "var(--cf2-text-tertiary)" }}>+{notas.length - 3} nota{notas.length - 3 === 1 ? "" : "s"}</p>}
              {empresaId && <AddNoteInlineEmpresa empresaId={empresaId} />}
            </div>
          </Section>
          </Cf2Card>

          {empresa.enrichStatus === "enriched" && (
            <div className="flex items-center gap-1.5 text-[11px] px-1" style={{ color: "var(--cf2-text-tertiary)" }}>
              <Sparkles className="w-3 h-3" /> Enriquecido via Apollo
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}
