"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Eye, Bold, Italic, Underline, List, ListOrdered, Heading2, Pilcrow, AlignLeft, AlignCenter, AlignJustify,
  Undo2, Redo2, Braces, TriangleAlert, FileSearch, Code2, Table2, Rows3, Columns3, Indent, Hash, FileDown, History, ArrowLeft, Save, RotateCcw, ArrowUp, ArrowDown, X,
} from "lucide-react";
import { toast } from "sonner";
import { VARIAVEIS_CONTRATO, VARIAVEIS_EXEMPLO, corpoEhHtml, renderizarCorpo, textoDoChip, variaveisDesconhecidas } from "@/lib/crm/contrato-variaveis";
import { PAPEL_REPRESENTANTE, PAPEL_TESTEMUNHA_VENDEDOR, PAPEL_TESTEMUNHA_2 } from "@/lib/crm/proposta-signatarios";
import { cssContrato, ROXO_CONTRATO } from "@/lib/crm/contrato-estilo";

interface Template {
  id: string;
  nome: string;
  versao: number;
  commercialModel: string | null;
  serviceFamily: string | null;
  tipoDocumento: string | null;
  corpoTemplate: string;
  ativo: boolean;
  createdAt?: string;
}

const MODELOS = [
  { value: "", label: "Qualquer modelo comercial" },
  { value: "PAGAMENTO_DIRETO", label: "Pagamento direto" },
  { value: "CONTRATO_OBRIGATORIO", label: "Contrato obrigatório" },
  { value: "CONTRATO_FIDELIDADE_OPCIONAL", label: "Contrato com fidelidade opcional" },
];
const FAMILIAS = [
  { value: "", label: "Qualquer família" },
  { value: "CALLFACE_AI", label: "Callface AI" },
  { value: "PABX", label: "PABX" },
  { value: "WHITE_LABEL", label: "White Label" },
  { value: "ASSISTANT", label: "Callface Assistant" },
];
const TIPOS = [
  { value: "CONTRATO", label: "Contrato" },
  { value: "ADITIVO", label: "Aditivo" },
  { value: "DOWNGRADE", label: "Downgrade" },
  { value: "RENOVACAO", label: "Renovação" },
];
const rotulo = (lista: { value: string; label: string }[], v: string | null) => lista.find((x) => x.value === (v || ""))?.label ?? "";
const GRUPOS = [...new Set(VARIAVEIS_CONTRATO.map((v) => v.grupo))];
import { LOGO_CONTRATO as LOGO } from "@/lib/crm/contrato-logo";

/* ── Conversão corpo ↔ editor ─────────────────────────────────────────────
   No banco o corpo guarda {{chave}}. No editor cada variável é um chip
   (`<span data-var>`) com o nome que o time conhece do Zoho, e o chip volta a
   ser {{chave}} ao salvar. */
const chipHtml = (chave: string) =>
  `<span class="cf-chip${VARIAVEIS_CONTRATO.some((v) => v.chave === chave) ? "" : " cf-chip-desc"}" data-var="${chave}" contenteditable="false" title="${chave}">${textoDoChip(chave).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
const paraEditor = (corpo: string) => corpo.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => chipHtml(k));
function doEditor(raiz: HTMLElement): string {
  const c = raiz.cloneNode(true) as HTMLElement;
  c.querySelectorAll("span[data-var]").forEach((el) => el.replaceWith(`{{${el.getAttribute("data-var")}}}`));
  return c.innerHTML;
}

const CSS_FOLHA = `
${cssContrato(".cf-folha .cf-doc")}
.cf-folha .cf-doc { outline: none; min-height: 230mm; }
.cf-folha .cf-doc .cf-chip { background: #efe9f7; color: ${ROXO_CONTRATO}; border: 1px solid #d9cdea; border-radius: 4px; padding: 0 4px; font-size: 8pt; font-weight: 600; white-space: nowrap; user-select: all; }
.cf-folha .cf-doc .cf-chip.cf-chip-desc { background: var(--cf2-danger-bg, #fde8e8); color: var(--cf2-danger-text, #b42318); border-color: var(--cf2-danger-text, #b42318); }
.cf-folha .cf-doc table td, .cf-folha .cf-doc table th { min-width: 24px; }
.cf-folha .cf-doc .cf-ancora { background: #f3f1f6; border: 1px dashed #b7a9cf; }
`;

async function baixarPdfTeste(corpoTemplate: string, serviceFamily: string | null) {
  const r = await fetch("/api/contrato-templates/pdf-teste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ corpoTemplate, serviceFamily }) });
  if (!r.ok) { toast.error("Não foi possível gerar o PDF de teste"); return; }
  const url = URL.createObjectURL(await r.blob());
  window.open(url, "_blank");
}

/** Ajustes → Contratos: modelos por tipo de documento e família, editados como documento. */
export function Cf2ContratoTemplatesWorkspace() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Template | null>(null);
  const [criando, setCriando] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  const { data } = useQuery<{ templates: Template[] }>({
    queryKey: ["cf2-contrato-templates"],
    queryFn: async () => { const r = await fetch("/api/contrato-templates"); return r.ok ? r.json() : { templates: [] }; },
  });
  const templates = data?.templates ?? [];

  const salvar = useMutation({
    mutationFn: async (t: { id?: string; nome: string; commercialModel: string | null; serviceFamily: string | null; tipoDocumento: string; corpoTemplate: string }) => {
      const r = await fetch(t.id ? `/api/contrato-templates/${t.id}` : "/api/contrato-templates", { method: t.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: t.nome, commercialModel: t.commercialModel, serviceFamily: t.serviceFamily, tipoDocumento: t.tipoDocumento, corpoTemplate: t.corpoTemplate }) });
      if (!r.ok) throw new Error("falha");
      return r.json() as Promise<Template & { variaveisDesconhecidas?: string[] }>;
    },
    onSuccess: (salvo) => {
      qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] });
      setEditando(null); setCriando(false);
      const sobraram = salvo?.variaveisDesconhecidas ?? [];
      if (sobraram.length > 0) toast.warning(`Salvo. ${sobraram.length} variável(is) do Zoho sem equivalente continuam no texto: ${sobraram.join(", ")}`, { duration: 12000 });
      else toast.success(`Modelo salvo (versão ${salvo.versao} ativa)`);
    },
    onError: () => toast.error("Não foi possível salvar o modelo"),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/contrato-templates/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("falha"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] }),
  });

  if (criando || editando) {
    return <EditorDocumento inicial={editando} salvando={salvar.isPending} onSalvar={(t) => salvar.mutate({ id: editando?.id, ...t })} onVoltar={() => { setCriando(false); setEditando(null); }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
          Um modelo por tipo de documento e família. O contrato sai deste texto com os dados da proposta; o Documenso recebe só o PDF pronto.
        </p>
        <button onClick={() => setCriando(true)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
          <Plus className="w-3.5 h-3.5" /> Novo modelo
        </button>
      </div>

      <ParametrosContrato />

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.length === 0 && <p className="text-[13px] py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum modelo cadastrado ainda.</p>}
        {templates.map((t) => (
          <div key={t.id} className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{t.nome}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>v{t.versao} ativa</span>
              </div>
              <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
                {rotulo(TIPOS, t.tipoDocumento || "CONTRATO")} · {rotulo(FAMILIAS, t.serviceFamily)} · {rotulo(MODELOS, t.commercialModel)}
              </p>
              {!t.serviceFamily && <p className="text-[11px] mt-1" style={{ color: "var(--cf2-warning-text)" }}>Genérico: não é usado para enviar contrato. Só os modelos de uma família saem para assinatura.</p>}
            </div>
            <div className="flex gap-2 mt-auto">
              <Acao titulo="Pré-visualizar" onClick={() => setPreview(t)} Icone={Eye} />
              <Acao titulo="Baixar PDF de teste" onClick={() => baixarPdfTeste(t.corpoTemplate, t.serviceFamily)} Icone={FileDown} />
              <Acao titulo="Editar" onClick={() => setEditando(t)} Icone={Pencil} />
              <Acao titulo="Desativar" onClick={() => { if (window.confirm(`Desativar "${t.nome}"? Contratos já gerados não mudam.`)) remover.mutate(t.id); }} Icone={Trash2} perigo />
            </div>
          </div>
        ))}
      </div>

      {preview && <FolhaPreview titulo={`${preview.nome} · v${preview.versao}`} corpo={preview.corpoTemplate} familia={preview.serviceFamily} onFechar={() => setPreview(null)} />}
    </div>
  );
}

function Acao({ titulo, onClick, Icone, perigo }: { titulo: string; onClick: () => void; Icone: typeof Eye; perigo?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={titulo} title={titulo}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{ background: "var(--cf2-bg-surface-muted)", outlineColor: "var(--cf2-accent)" }}>
      <Icone className="w-3.5 h-3.5" style={{ color: perigo ? "var(--cf2-danger-text)" : "var(--cf2-text-secondary)" }} />
    </button>
  );
}

/** Folha A4 sobre fundo cinza com o corpo renderizado com dados de exemplo. */
function FolhaPreview({ titulo, corpo, familia, onFechar }: { titulo: string; corpo: string; familia: string | null; onFechar: () => void }) {
  const html = useMemo(() => renderizarCorpo(corpo, VARIAVEIS_EXEMPLO), [corpo]);
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(18,23,29,.55)" }} onClick={onFechar}>
      <div className="m-auto w-full max-w-[880px] max-h-[94vh] flex flex-col rounded-2xl overflow-hidden" style={{ background: "#e6e8ea" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ background: "var(--cf2-bg-surface)", borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
            <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Dados fictícios de exemplo</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => baixarPdfTeste(corpo, familia)} className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}><FileDown className="w-3.5 h-3.5" /> Baixar PDF de teste</button>
            <button onClick={onFechar} className="px-3 h-8 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Fechar</button>
          </div>
        </div>
        <div className="overflow-y-auto p-6">
          <style>{CSS_FOLHA}</style>
          <Folha>{corpoEhHtml(corpo) ? <div className="cf-doc" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="cf-doc" style={{ whiteSpace: "pre-wrap" }}>{html}</div>}</Folha>
        </div>
      </div>
    </div>
  );
}

/** A folha: papel branco A4, cabeçalho do contrato (logo + Nº), margens do PDF. */
function Folha({ children }: { children: React.ReactNode }) {
  return (
    <div className="cf-folha mx-auto" style={{ width: "min(100%, 794px)", background: "#fff", padding: "10mm 17mm 20mm", boxShadow: "0 1px 3px rgba(18,23,29,.18), 0 8px 24px rgba(18,23,29,.08)", borderRadius: 2 }}>
      <div className="flex items-center justify-between mb-5" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="" style={{ height: "14mm" }} onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
        <span style={{ fontSize: "8pt", fontWeight: 700, color: ROXO_CONTRATO, fontFamily: "Arial, sans-serif" }}>Nº Contrato: P-000-v1</span>
      </div>
      {children}
    </div>
  );
}

/* Fora de ParametrosContrato de propósito: declarado dentro, o componente ganha
   identidade nova a cada render, o React remonta o <input> e o foco some a cada tecla. */
function Rot({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>{t}{children}</label>;
}

const PAPEIS_CF = [
  { value: PAPEL_REPRESENTANTE, label: "Representante legal" },
  { value: PAPEL_TESTEMUNHA_VENDEDOR, label: "Testemunha 1" },
  { value: PAPEL_TESTEMUNHA_2, label: "Testemunha 2" },
];
type SigCf = { nome: string; email: string; papel: string };

/* ── Parâmetros que valem para toda a organização ─────────────────────── */
function ParametrosContrato() {
  const qc = useQueryClient();
  const { data } = useQuery<{ multaRescisoriaPct: number | null; limiteGravacoes: string | null; representanteNome: string | null; representanteEmail: string | null; signatarios?: SigCf[] }>({
    queryKey: ["cf2-contrato-parametros"],
    queryFn: async () => (await fetch("/api/contrato-parametros")).json(),
  });
  const [f, setF] = useState({ multa: "", limite: "" });
  const [sigs, setSigs] = useState<SigCf[]>([]);
  useEffect(() => {
    if (!data) return;
    setF({ multa: data.multaRescisoriaPct != null ? String(data.multaRescisoriaPct).replace(".", ",") : "", limite: data.limiteGravacoes ?? "" });
    // Organização que só tem o representante antigo (nome + e-mail) vê ele como primeira linha.
    setSigs(data.signatarios?.length ? data.signatarios : data.representanteNome ? [{ nome: data.representanteNome, email: data.representanteEmail ?? "", papel: PAPEL_REPRESENTANTE }] : []);
  }, [data]);
  const mudar = (i: number, patch: Partial<SigCf>) => setSigs((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const mover = (i: number, d: -1 | 1) => setSigs((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const salvar = useMutation({
    mutationFn: async () => {
      const n = f.multa.trim() ? Number(f.multa.replace(",", ".")) : null;
      const r = await fetch("/api/contrato-parametros", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ multaRescisoriaPct: n, limiteGravacoes: f.limite.trim() || null, signatarios: sigs.map((x) => ({ ...x, nome: x.nome.trim(), email: x.email.trim() })) }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => { toast.success("Parâmetros salvos"); qc.invalidateQueries({ queryKey: ["cf2-contrato-parametros"] }); },
    onError: () => toast.error("Não foi possível salvar. Confira o percentual e o e-mail."),
  });
  const campo = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };
  return (
    <details className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <summary className="text-[13px] font-bold cursor-pointer" style={{ color: "var(--cf2-text-primary)" }}>Parâmetros do contrato</summary>
      <p className="text-[12px] mt-2 mb-3" style={{ color: "var(--cf2-text-secondary)" }}>
        Valores que não vêm da proposta. Sem eles, o contrato que usa a multa ou o limite não é enviado e o aviso diz o que falta.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Rot t="Multa rescisória (%)"><input value={f.multa} onChange={(e) => setF({ ...f, multa: e.target.value })} inputMode="decimal" className="px-3 py-2 rounded-lg text-[13px] outline-none font-normal" style={campo} /></Rot>
        <Rot t="Limite de armazenamento de gravações"><input value={f.limite} onChange={(e) => setF({ ...f, limite: e.target.value })} placeholder="Ex.: 90 dias" className="px-3 py-2 rounded-lg text-[13px] outline-none font-normal" style={campo} /></Rot>
      </div>
      <div className="flex flex-col gap-2 mt-4">
        <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Quem assina pela Callface</p>
        <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
          A ordem é a de oferta; o primeiro de cada papel é o padrão dele. Hoje só o representante legal padrão (com e-mail) é aplicado sozinho quando a proposta não traz um; a proposta pode trocar.
        </p>
        {sigs.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum signatário cadastrado.</p>}
        {sigs.map((x, i) => {
          const padrao = sigs.findIndex((y) => y.papel === x.papel) === i;
          return (
            <div key={i} className="grid gap-2 items-end sm:grid-cols-[150px_1fr_1fr_auto]">
              <Rot t={padrao ? "Papel (padrão)" : "Papel"}>
                <select value={x.papel} onChange={(e) => mudar(i, { papel: e.target.value })} className="px-3 py-2 rounded-lg text-[13px] outline-none font-normal" style={campo}>{PAPEIS_CF.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
              </Rot>
              <Rot t="Nome"><input value={x.nome} onChange={(e) => mudar(i, { nome: e.target.value })} className="px-3 py-2 rounded-lg text-[13px] outline-none font-normal" style={campo} /></Rot>
              <Rot t="E-mail"><input value={x.email} onChange={(e) => mudar(i, { email: e.target.value })} type="email" className="px-3 py-2 rounded-lg text-[13px] outline-none font-normal" style={campo} /></Rot>
              <div className="flex gap-1">
                <Acao titulo="Subir" onClick={() => mover(i, -1)} Icone={ArrowUp} />
                <Acao titulo="Descer" onClick={() => mover(i, 1)} Icone={ArrowDown} />
                <Acao titulo="Remover" onClick={() => setSigs((l) => l.filter((_, j) => j !== i))} Icone={X} perigo />
              </div>
            </div>
          );
        })}
        <div>
          <button type="button" onClick={() => setSigs((l) => [...l, { nome: "", email: "", papel: PAPEL_REPRESENTANTE }])} className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}><Plus className="w-3 h-3" /> Adicionar signatário</button>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Salvar parâmetros</button>
      </div>
    </details>
  );
}

/* ── Editor ───────────────────────────────────────────────────────────── */
function EditorDocumento({ inicial, salvando, onSalvar, onVoltar }: {
  inicial: Template | null; salvando: boolean; onVoltar: () => void;
  onSalvar: (t: { nome: string; commercialModel: string | null; serviceFamily: string | null; tipoDocumento: string; corpoTemplate: string }) => void;
}) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [commercialModel, setCommercialModel] = useState(inicial?.commercialModel || "");
  const [serviceFamily, setServiceFamily] = useState(inicial?.serviceFamily || "");
  const [tipoDocumento, setTipoDocumento] = useState(inicial?.tipoDocumento || "CONTRATO");
  const [corpo, setCorpo] = useState(inicial?.corpoTemplate || "");
  const [verHtml, setVerHtml] = useState(false);
  const [painel, setPainel] = useState<"" | "variaveis" | "versoes" | "previa">("");
  const [grupoId, setGrupoId] = useState("");
  const [busca, setBusca] = useState("");
  const selecao = useRef<Range | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const salvoCom = useRef(inicial?.corpoTemplate || "");
  const campo = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };

  const montar = (c: string) => { if (area.current) area.current.innerHTML = !c.trim() ? "<p><br></p>" : corpoEhHtml(c) ? paraEditor(c) : paraEditor(c).split(/\r?\n/).filter((l) => l.trim()).map((l) => `<p>${l}</p>`).join(""); };
  useEffect(() => { if (!verHtml) montar(corpo); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [verHtml]);

  const sincronizar = () => { if (area.current) setCorpo(doEditor(area.current)); };
  const cmd = (nome: string, arg?: string) => { area.current?.focus(); document.execCommand(nome, false, arg); sincronizar(); };
  const html = (h: string) => { area.current?.focus(); document.execCommand("insertHTML", false, h); sincronizar(); };
  // Blocos entram pela API de Range, não por insertHTML: o Chrome desmonta o
  // parágrafo ao inserir bloco no meio dele e o "1.1" perde o <p>.
  const posicionarFim = (alvo: Node) => { const sel = window.getSelection(); const r = document.createRange(); r.selectNodeContents(alvo); r.collapse(false); sel?.removeAllRanges(); sel?.addRange(r); };
  const blocoAtual = (): Element | null => {
    const n = window.getSelection()?.anchorNode; let el: Node | null = n && n.nodeType === 1 ? n : n?.parentElement ?? null;
    while (el && el.parentElement !== area.current) el = el.parentElement;
    return el as Element | null;
  };
  const inserirBloco = (h: string, foco = "p") => {
    area.current?.focus();
    const tpl = document.createElement("template"); tpl.innerHTML = h;
    const nodes = [...tpl.content.children];
    const ref = blocoAtual();
    if (ref) ref.after(...nodes); else area.current?.append(...nodes);
    const alvo = nodes[0].matches(foco) ? nodes[0] : nodes[0].querySelector(foco) ?? nodes[0];
    posicionarFim(alvo); sincronizar();
  };

  // O painel de busca tira o foco do documento; guardar onde o cursor estava
  // é o que faz a variável entrar no ponto certo e não no começo da folha.
  const guardarSelecao = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && area.current?.contains(sel.anchorNode)) selecao.current = sel.getRangeAt(0).cloneRange();
  };
  const abrirVariaveis = () => { guardarSelecao(); setBusca(""); setPainel("variaveis"); };
  const inserirVariavel = (chave: string) => {
    area.current?.focus();
    const sel = window.getSelection();
    if (selecao.current && sel) { sel.removeAllRanges(); sel.addRange(selecao.current); }
    const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const tpl = document.createElement("template"); tpl.innerHTML = chipHtml(chave);
    const chip = tpl.content.firstElementChild!;
    const espaco = document.createTextNode("\u00a0");
    if (r && area.current?.contains(r.commonAncestorContainer)) { r.deleteContents(); r.insertNode(espaco); r.insertNode(chip); } else area.current?.append(chip, espaco);
    const novo = document.createRange(); novo.setStartAfter(espaco); novo.collapse(true); sel?.removeAllRanges(); sel?.addRange(novo);
    setPainel(""); setBusca(""); sincronizar();
  };
  // Cláusula numerada: continua a numeração do último "N.N" do documento.
  const novaClausula = () => {
    const nums = [...(area.current?.querySelectorAll("p > b:first-child") ?? [])].map((b) => b.textContent?.trim() ?? "").filter((t) => /^\d+(\.\d+)+\.?$/.test(t));
    const ult = nums[nums.length - 1];
    let prox = "1.1";
    if (ult) { const partes = ult.replace(/\.$/, "").split("."); partes[partes.length - 1] = String(Number(partes[partes.length - 1]) + 1); prox = partes.join("."); }
    inserirBloco(`<p><b>${prox}</b>&nbsp;</p>`);
  };
  const tabelaAtual = () => { const sel = window.getSelection(); const n = sel?.anchorNode; const el = n && (n.nodeType === 1 ? (n as HTMLElement) : n.parentElement); return el?.closest("table") ?? null; };
  const linhaMais = () => { const t = tabelaAtual(); if (!t) return toast.info("Coloque o cursor dentro de uma tabela"); const tr = t.querySelector("tbody tr:last-child") ?? t.querySelector("tr:last-child"); if (!tr) return; const nova = tr.cloneNode(true) as HTMLElement; nova.querySelectorAll("td,th").forEach((c) => (c.textContent = "")); tr.after(nova); sincronizar(); };
  const colunaMais = () => { const t = tabelaAtual(); if (!t) return toast.info("Coloque o cursor dentro de uma tabela"); t.querySelectorAll("tr").forEach((tr) => { const c = document.createElement(tr.querySelector("th") && !tr.querySelector("td") ? "th" : "td"); tr.appendChild(c); }); sincronizar(); };

  const encontradas = VARIAVEIS_CONTRATO.filter((v) => !busca.trim() || `${v.chave} ${v.rotulo} ${v.zoho ?? ""}`.toLowerCase().includes(busca.trim().toLowerCase()));
  const Bt = ({ t, Icone, f }: { t: string; Icone: typeof Bold; f: () => void }) => (
    <button type="button" title={t} aria-label={t} onMouseDown={(e) => e.preventDefault()} onClick={f}
      className="flex items-center justify-center w-7 h-7 rounded transition-colors hover:brightness-95 focus-visible:outline-2" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)", outlineColor: "var(--cf2-accent)" }}>
      <Icone className="w-3.5 h-3.5" />
    </button>
  );
  const Sep = () => <span className="w-px h-5 mx-1" style={{ background: "var(--cf2-border-default)" }} />;
  const sujo = corpo !== salvoCom.current;
  const desconhecidas = useMemo(() => variaveisDesconhecidas(corpo), [corpo]);
  const tentarSalvar = () => {
    if (!nome.trim() || !corpo.trim()) return;
    if (desconhecidas.length > 0 && !window.confirm(`Estas variáveis não existem no catálogo: ${desconhecidas.join(", ")}.\nO contrato que usar este modelo não poderá ser enviado até corrigir. Salvar mesmo assim?`)) return;
    onSalvar({ nome: nome.trim(), commercialModel: commercialModel || null, serviceFamily: serviceFamily || null, tipoDocumento, corpoTemplate: corpo.trim() });
  };

  const { data: versoes, refetch: recarregarVersoes } = useQuery<{ versoes: Template[] }>({
    queryKey: ["cf2-contrato-versoes", inicial?.id],
    enabled: !!inicial && painel === "versoes",
    queryFn: async () => (await fetch(`/api/contrato-templates/${inicial!.id}/versoes`)).json(),
  });
  const qc = useQueryClient();
  const restaurar = async (id: string) => {
    const r = await fetch(`/api/contrato-templates/${id}/restaurar`, { method: "POST" });
    if (!r.ok) return toast.error("Não foi possível restaurar");
    toast.success("Versão restaurada como nova versão ativa");
    qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] });
    onVoltar();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onVoltar} className="flex items-center gap-1.5 px-2 h-8 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}><ArrowLeft className="w-3.5 h-3.5" /> Modelos</button>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do modelo" aria-label="Nome do modelo" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-[13px] font-semibold outline-none" style={campo} />
        <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} aria-label="Tipo de documento" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campo}>{TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <select value={serviceFamily} onChange={(e) => setServiceFamily(e.target.value)} aria-label="Família" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campo}>{FAMILIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
        <select value={commercialModel} onChange={(e) => setCommercialModel(e.target.value)} aria-label="Modelo comercial" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campo}>{MODELOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg sticky top-0 z-10" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
        <Bt t="Negrito" Icone={Bold} f={() => cmd("bold")} />
        <Bt t="Itálico" Icone={Italic} f={() => cmd("italic")} />
        <Bt t="Sublinhado" Icone={Underline} f={() => cmd("underline")} />
        <Sep />
        <Bt t="Título de cláusula" Icone={Heading2} f={() => cmd("formatBlock", "h2")} />
        <Bt t="Parágrafo" Icone={Pilcrow} f={() => cmd("formatBlock", "p")} />
        <Bt t="Nova cláusula numerada" Icone={Hash} f={novaClausula} />
        <Bt t="Alínea recuada (a, b, c)" Icone={Indent} f={() => inserirBloco('<blockquote class="cf-alineas"><p><b>a)</b>&nbsp;</p></blockquote>')} />
        <Bt t="Lista com marcadores" Icone={List} f={() => cmd("insertUnorderedList")} />
        <Bt t="Lista numerada" Icone={ListOrdered} f={() => cmd("insertOrderedList")} />
        <Sep />
        <Bt t="Alinhar à esquerda" Icone={AlignLeft} f={() => cmd("justifyLeft")} />
        <Bt t="Centralizar" Icone={AlignCenter} f={() => cmd("justifyCenter")} />
        <Bt t="Justificar" Icone={AlignJustify} f={() => cmd("justifyFull")} />
        <Sep />
        <Bt t="Inserir tabela" Icone={Table2} f={() => inserirBloco('<table class="cf-valores" border="1"><thead><tr><th>Coluna 1</th><th>Coluna 2</th><th>Coluna 3</th></tr></thead><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>', "td")} />
        <Bt t="Adicionar linha à tabela" Icone={Rows3} f={linhaMais} />
        <Bt t="Adicionar coluna à tabela" Icone={Columns3} f={colunaMais} />
        <Sep />
        <Bt t="Desfazer" Icone={Undo2} f={() => cmd("undo")} />
        <Bt t="Refazer" Icone={Redo2} f={() => cmd("redo")} />
        <Sep />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (painel === "variaveis") setPainel(""); else abrirVariaveis(); }} className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>
          <Braces className="w-3.5 h-3.5" /> Variável <span style={{ color: "var(--cf2-text-tertiary)" }}>#</span>
        </button>
        <span className="flex-1" />
        {inicial && <button type="button" onClick={() => setPainel(painel === "versoes" ? "" : "versoes")} className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}><History className="w-3.5 h-3.5" /> Versões (v{inicial.versao} ativa)</button>}
        <button type="button" onClick={() => setVerHtml((v) => !v)} className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}><Code2 className="w-3.5 h-3.5" /> {verHtml ? "Folha" : "HTML"}</button>
        <button type="button" onClick={() => setPainel(painel === "previa" ? "" : "previa")} disabled={!corpo.trim()} className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold disabled:opacity-50" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}><FileSearch className="w-3.5 h-3.5" /> Prévia com proposta</button>
        <button type="button" onClick={() => baixarPdfTeste(corpo, serviceFamily || null)} disabled={!corpo.trim()} className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold disabled:opacity-50" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}><FileDown className="w-3.5 h-3.5" /> PDF de teste</button>
      </div>

      {painel === "variaveis" && (
        <div className="rounded-lg p-2 max-h-64 overflow-y-auto" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar variável (razão social, CNPJ, multa, itens)" aria-label="Buscar variável" className="w-full px-2 py-1.5 mb-2 rounded text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          {GRUPOS.map((g) => {
            const itens = encontradas.filter((v) => v.grupo === g);
            if (itens.length === 0) return null;
            return (
              <div key={g} className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>{g}</p>
                <div className="flex flex-wrap gap-1">
                  {itens.map((v) => (
                    <button key={v.chave} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => inserirVariavel(v.chave)} title={`${v.rotulo}. Exemplo: ${v.exemplo.slice(0, 60)}`}
                      className="px-2 py-1 rounded text-[11px] font-semibold" style={{ background: "#efe9f7", color: ROXO_CONTRATO, border: "1px solid #d9cdea" }}>
                      {textoDoChip(v.chave)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {desconhecidas.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-lg p-2.5 text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-danger-text)", color: "var(--cf2-danger-text)" }}>
          <TriangleAlert className="w-4 h-4 shrink-0 mt-px" aria-hidden />
          <span>
            Variável desconhecida: <b>{desconhecidas.join(", ")}</b>. Não existe no catálogo de contrato; ela sairia crua no documento e o envio seria bloqueado. Troque pelo botão Variável (aparece em vermelho no texto).
          </span>
        </div>
      )}

      {painel === "previa" && <PreviaComProposta corpo={corpo} grupoId={grupoId} setGrupoId={setGrupoId} />}

      {painel === "versoes" && (
        <div className="rounded-lg p-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          {!versoes && <p className="text-[12px] p-2" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando versões...</p>}
          {versoes?.versoes.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
              <span><b>v{v.versao}</b> {v.ativo ? "(ativa)" : ""} · {v.createdAt ? new Date(v.createdAt).toLocaleString("pt-BR") : ""}</span>
              {!v.ativo && <button onClick={() => restaurar(v.id)} className="flex items-center gap-1 px-2 h-7 rounded font-semibold" style={{ background: "var(--cf2-bg-surface)" }}><RotateCcw className="w-3 h-3" /> Restaurar como nova versão</button>}
            </div>
          ))}
          <button hidden onClick={() => recarregarVersoes()} />
        </div>
      )}

      <div className="rounded-xl p-4 sm:p-6 overflow-auto" style={{ background: "#e6e8ea", maxHeight: "72vh" }}>
        <style>{CSS_FOLHA}</style>
        {verHtml ? (
          <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={26} aria-label="Corpo do contrato em HTML" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none font-mono" style={campo} />
        ) : (
          <Folha>
            <div ref={area} className="cf-doc" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Corpo do contrato"
              onInput={sincronizar}
              onKeyDown={(e) => {
                // "#" abre a lista de variáveis (o gesto do editor do Zoho); o caractere não entra no texto.
                if (e.key === "#") { e.preventDefault(); abrirVariaveis(); }
                else if (e.key === "Escape" && painel === "variaveis") setPainel("");
              }} />
          </Folha>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Salvar cria uma nova versão ativa; contratos já gerados seguem com o texto que receberam. As variáveis em roxo são preenchidas com os dados da proposta; se faltar algum, o envio é bloqueado.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={onVoltar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button
            onClick={tentarSalvar}
            disabled={salvando || !nome.trim() || !corpo.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            <Save className="w-3.5 h-3.5" /> {sujo || !inicial ? "Salvar nova versão" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Prévia do modelo em edição com os dados de uma proposta real (mesmo montador do contrato); mostra o que ainda faltaria para enviar. */
function PreviaComProposta({ corpo: corpoAoVivo, grupoId, setGrupoId }: { corpo: string; grupoId: string; setGrupoId: (id: string) => void }) {
  // Espera o usuário parar de digitar: cada prévia consulta o banco.
  const [corpo, setCorpo] = useState(corpoAoVivo);
  useEffect(() => { const t = setTimeout(() => setCorpo(corpoAoVivo), 700); return () => clearTimeout(t); }, [corpoAoVivo]);
  const { data: lista } = useQuery<{ propostas: { grupoId: string; rotulo: string }[] }>({
    queryKey: ["cf2-contrato-propostas-previa"],
    queryFn: async () => { const r = await fetch("/api/contrato-templates/propostas-previa"); return r.ok ? r.json() : { propostas: [] }; },
  });
  const { data: previa, isFetching, isError } = useQuery<{ html: string; faltando: string[] }>({
    queryKey: ["cf2-contrato-previa", grupoId, corpo],
    enabled: !!grupoId && !!corpo.trim(),
    queryFn: async () => {
      const r = await fetch("/api/contrato-templates/previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ corpoTemplate: corpo, grupoId }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
  });
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <Rot t="Proposta usada na prévia">
        <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none font-normal" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          <option value="">Escolha uma proposta</option>
          {(lista?.propostas ?? []).map((p) => <option key={p.grupoId} value={p.grupoId}>{p.rotulo}</option>)}
        </select>
      </Rot>
      {isFetching && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Montando a prévia...</p>}
      {isError && <p className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>Não foi possível montar a prévia com esta proposta.</p>}
      {previa && previa.faltando.length > 0 && (
        <p className="text-[12px]" style={{ color: "var(--cf2-warning-text)" }}>Com esta proposta o envio seria bloqueado: falta {previa.faltando.join("; ")}.</p>
      )}
      {previa && previa.faltando.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Todas as variáveis obrigatórias têm valor nesta proposta.</p>}
      {previa && (
        <div className="rounded-xl p-4 overflow-auto" style={{ background: "#e6e8ea", maxHeight: "60vh" }}>
          <style>{CSS_FOLHA}</style>
          <Folha>{corpoEhHtml(corpo) ? <div className="cf-doc" dangerouslySetInnerHTML={{ __html: previa.html }} /> : <div className="cf-doc" style={{ whiteSpace: "pre-wrap" }}>{previa.html}</div>}</Folha>
        </div>
      )}
    </div>
  );
}
