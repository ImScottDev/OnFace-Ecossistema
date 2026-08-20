"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, Check, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Wizard de importação de prospects (spec do Kauã, 17/08): Upload →
 * Mapeamento → Validação → Configuração → Preview/Confirmar. CSV only por
 * ora — parser próprio (sem lib nova), suporta `,` e `;` como separador e
 * campos entre aspas. XLSX fica de fora nesta rodada (nenhuma lib de
 * planilha no projeto ainda; adicionar uma é decisão separada) — pendência
 * registrada, não fabricada como se já funcionasse.
 */

const TARGET_FIELDS = [
  { key: "nome", label: "Nome completo", required: true },
  { key: "empresa", label: "Empresa", required: false },
  { key: "cargo", label: "Cargo", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "telefone", label: "Telefone", required: false },
  { key: "linkedin", label: "LinkedIn", required: false },
] as const;
type TargetKey = (typeof TARGET_FIELDS)[number]["key"];

const GUESS: Record<TargetKey, string[]> = {
  nome: ["nome", "nome completo", "name", "full name"],
  empresa: ["empresa", "company", "company name", "organização"],
  cargo: ["cargo", "job title", "title", "função"],
  email: ["email", "e-mail"],
  telefone: ["telefone", "phone", "celular", "whatsapp"],
  linkedin: ["linkedin", "linkedin url"],
};

function parseCSV(text: string): string[][] {
  const delimiter = (text.split("\n")[0]?.split(";").length || 0) > (text.split("\n")[0]?.split(",").length || 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

function guessMapping(header: string[]): Record<TargetKey, number | null> {
  const norm = header.map((h) => h.trim().toLowerCase());
  const mapping = {} as Record<TargetKey, number | null>;
  for (const f of TARGET_FIELDS) {
    const idx = norm.findIndex((h) => GUESS[f.key].includes(h));
    mapping[f.key] = idx >= 0 ? idx : null;
  }
  return mapping;
}

interface Lista { id: string; nome: string }
interface Usuario { id: string; nome: string }
interface CadenciaDef { id: string; nome: string; totalSteps: number }
interface LabelDef { id: string; nome: string; cor: string }

export function ImportModal({
  open, onClose, listas, usuarios, cadencias, onImported,
}: {
  open: boolean;
  onClose: () => void;
  listas: Lista[];
  usuarios: Usuario[];
  cadencias: CadenciaDef[];
  onImported: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, number | null>>({ nome: null, empresa: null, cargo: null, email: null, telefone: null, linkedin: null });
  const [validation, setValidation] = useState<{ validos: number; duplicados: number; comErro: number; total: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const [listaMode, setListaMode] = useState<"existing" | "new">(listas.length > 0 ? "existing" : "new");
  const [listaId, setListaId] = useState("");
  const [listaNomeNovo, setListaNomeNovo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [newTagInput, setNewTagInput] = useState("");
  const [cadenceDefinitionId, setCadenceDefinitionId] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: labels = [] } = useQuery<LabelDef[]>({
    queryKey: ["labels"],
    queryFn: async () => { const r = await fetch("/api/labels"); return r.ok ? r.json() : []; },
    enabled: open,
  });

  const rows = useMemo(() => {
    return dataRows.map((r) => ({
      nome: mapping.nome !== null ? r[mapping.nome] || "" : "",
      empresa: mapping.empresa !== null ? r[mapping.empresa] || "" : "",
      cargo: mapping.cargo !== null ? r[mapping.cargo] || "" : "",
      email: mapping.email !== null ? r[mapping.email] || "" : "",
      telefone: mapping.telefone !== null ? r[mapping.telefone] || "" : "",
      linkedin: mapping.linkedin !== null ? r[mapping.linkedin] || "" : "",
    }));
  }, [dataRows, mapping]);

  if (!open) return null;

  function reset() {
    setStep(1); setFileName(null); setHeader([]); setDataRows([]);
    setMapping({ nome: null, empresa: null, cargo: null, email: null, telefone: null, linkedin: null });
    setValidation(null); setListaId(""); setListaNomeNovo(""); setResponsavelId("");
    setTagIds(new Set()); setCadenceDefinitionId("");
  }

  function handleClose() { reset(); onClose(); }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseCSV(text);
      if (parsed.length === 0) { toast.error("Arquivo vazio ou ilegível"); return; }
      setHeader(parsed[0]);
      setDataRows(parsed.slice(1));
      setMapping(guessMapping(parsed[0]));
    };
    reader.readAsText(file, "utf-8");
  }

  async function runValidation() {
    setValidating(true);
    try {
      const r = await fetch("/api/prospeccao/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, dryRun: true }) });
      if (!r.ok) throw new Error();
      setValidation(await r.json());
      setStep(3);
    } catch {
      toast.error("Não foi possível validar o arquivo");
    } finally {
      setValidating(false);
    }
  }

  async function createTag() {
    const nome = newTagInput.trim();
    if (!nome) return;
    const existing = labels.find((l) => l.nome.toLowerCase() === nome.toLowerCase());
    if (existing) { setTagIds((prev) => new Set(prev).add(existing.id)); setNewTagInput(""); return; }
    const r = await fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, cor: "#e23752" }) });
    if (r.ok) {
      const novo = await r.json();
      qc.invalidateQueries({ queryKey: ["labels"] });
      setTagIds((prev) => new Set(prev).add(novo.id));
      setNewTagInput("");
    }
  }

  async function commit() {
    setImporting(true);
    try {
      const config = {
        listaId: listaMode === "existing" ? listaId || null : null,
        listaNomeNovo: listaMode === "new" ? listaNomeNovo.trim() || null : null,
        responsavelId: responsavelId || null,
        tagIds: Array.from(tagIds),
        cadenceDefinitionId: cadenceDefinitionId || null,
      };
      const r = await fetch("/api/prospeccao/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, dryRun: false, config }) });
      if (!r.ok) throw new Error();
      const result = await r.json();
      toast.success(`${result.importados} prospects importados.`);
      onImported();
      handleClose();
    } catch {
      toast.error("Não foi possível importar");
    } finally {
      setImporting(false);
    }
  }

  const STEPS = ["Upload", "Mapeamento", "Validação", "Configuração", "Preview"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={handleClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Importar Prospects</p>
          <button onClick={handleClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <div className="flex items-center gap-2 text-[12px]">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-full w-5 h-5 text-[11px] font-bold shrink-0" style={{ background: step > i + 1 ? "var(--cf2-accent)" : step === i + 1 ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: step >= i + 1 ? "var(--cf2-text-on-accent)" : "var(--cf2-text-tertiary)" }}>
                {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span style={{ color: step >= i + 1 ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)", fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center gap-2 py-14 rounded-xl cursor-pointer"
              style={{ border: "2px dashed var(--cf2-border-default)" }}
            >
              <Upload className="w-6 h-6" style={{ color: "var(--cf2-text-tertiary)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{fileName || "Arraste seu arquivo CSV aqui"}</p>
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>ou clique para selecionar · .csv, máx. 10MB</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>XLSX ainda não é suportado nesta versão — exporte como CSV.</p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{dataRows.length} linhas encontradas. Confirme o mapeamento das colunas:</p>
            {TARGET_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="w-32 text-[13px] font-semibold shrink-0" style={{ color: "var(--cf2-text-primary)" }}>{f.label}{f.required && " *"}</span>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[13px] outline-none"
                  style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
                >
                  <option value="">— não mapear —</option>
                  {header.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {validation ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <ValCard label="Válidos" valor={validation.validos} tom="success" />
                  <ValCard label="Duplicados" valor={validation.duplicados} tom="warning" />
                  <ValCard label="Com erro" valor={validation.comErro} tom="danger" />
                </div>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Duplicados (e-mail/telefone já na base) são ignorados na importação. Registros com erro (sem nome, ou sem e-mail e sem telefone) também não entram.</p>
              </>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Clique em Validar pra checar os dados antes de configurar a importação.</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Lista</span>
              <div className="flex gap-2">
                <select value={listaMode} onChange={(e) => setListaMode(e.target.value as "existing" | "new")} className="px-3 py-1.5 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                  <option value="existing">Lista existente</option>
                  <option value="new">Criar nova lista</option>
                </select>
                {listaMode === "existing" ? (
                  <select value={listaId} onChange={(e) => setListaId(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                    <option value="">— nenhuma —</option>
                    {listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                ) : (
                  <input value={listaNomeNovo} onChange={(e) => setListaNomeNovo(e.target.value)} placeholder="Nome da nova lista" className="flex-1 px-3 py-1.5 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Responsável</span>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="px-3 py-1.5 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                <option value="">Sem responsável definido</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(tagIds).map((id) => {
                  const l = labels.find((x) => x.id === id);
                  if (!l) return null;
                  return (
                    <span key={id} className="flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${l.cor}18`, color: l.cor }}>
                      {l.nome}
                      <button onClick={() => setTagIds((prev) => { const n = new Set(prev); n.delete(id); return n; })}><X className="w-3 h-3" /></button>
                    </span>
                  );
                })}
                <input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTag(); } }}
                  placeholder="Adicionar tag..."
                  className="px-2 py-1 rounded-full text-[12px] outline-none w-32"
                  style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Cadência (opcional)</span>
              <select value={cadenceDefinitionId} onChange={(e) => setCadenceDefinitionId(e.target.value)} className="px-3 py-1.5 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                <option value="">Não iniciar cadência agora</option>
                {cadencias.map((cd) => <option key={cd.id} value={cd.id}>{cd.nome} ({cd.totalSteps} toques)</option>)}
              </select>
              {cadencias.length === 0 && <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma cadência ativa cadastrada ainda.</p>}
            </div>
          </div>
        )}

        {step === 5 && validation && (
          <div className="flex flex-col gap-3">
            <div className="px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ background: "rgba(34,197,94,0.1)", color: "var(--cf2-success-text)" }}>
              {validation.validos - validation.duplicados} prospects válidos serão importados
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] p-3 rounded-xl" style={{ border: "1px solid var(--cf2-border-default)" }}>
              <KV label="Lista" value={listaMode === "existing" ? listas.find((l) => l.id === listaId)?.nome || "— nenhuma —" : listaNomeNovo || "— nenhuma —"} />
              <KV label="Responsável" value={usuarios.find((u) => u.id === responsavelId)?.nome || "Sem responsável definido"} />
              <KV label="Tags" value={Array.from(tagIds).map((id) => labels.find((l) => l.id === id)?.nome).filter(Boolean).join(", ") || "—"} />
              <KV label="Cadência" value={cadencias.find((c) => c.id === cadenceDefinitionId)?.nome || "Não iniciar agora"} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{validation.duplicados} duplicados serão ignorados · {validation.comErro} com erro foram removidos</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <button onClick={() => (step === 1 ? handleClose() : setStep(step - 1))} className="flex items-center gap-1 px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>
            <ChevronLeft className="w-3.5 h-3.5" /> {step === 1 ? "Cancelar" : "Voltar"}
          </button>
          {step === 1 && <NextButton disabled={dataRows.length === 0} onClick={() => setStep(2)} label="Próximo" />}
          {step === 2 && <NextButton disabled={mapping.nome === null} onClick={() => setStep(3)} label="Próximo" />}
          {step === 3 && (validation ? <NextButton onClick={() => setStep(4)} label="Próximo" /> : <NextButton disabled={validating} onClick={runValidation} label={validating ? "Validando..." : "Validar"} />)}
          {step === 4 && <NextButton onClick={() => setStep(5)} label="Próximo" />}
          {step === 5 && <NextButton disabled={importing} onClick={commit} label={importing ? "Importando..." : `Importar ${validation ? validation.validos - validation.duplicados : 0} prospects`} />}
        </div>
      </div>
    </div>
  );
}

function NextButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
      {label} <ChevronRight className="w-3.5 h-3.5" />
    </button>
  );
}

function ValCard({ label, valor, tom }: { label: string; valor: number; tom: "success" | "warning" | "danger" }) {
  const colors = { success: ["rgba(34,197,94,0.1)", "var(--cf2-success-text)"], warning: ["var(--cf2-warning-bg)", "var(--cf2-warning-text)"], danger: ["rgba(229,51,51,0.1)", "var(--cf2-danger-text)"] } as const;
  const [bg, color] = colors[tom];
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: bg }}>
      <p className="text-[24px] font-bold" style={{ color }}>{valor}</p>
      <p className="text-[12px]" style={{ color }}>{label}</p>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--cf2-text-tertiary)" }}>{label}:</span>
      <span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{value}</span>
    </div>
  );
}
