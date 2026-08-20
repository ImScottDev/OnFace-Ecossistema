"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ExternalLink } from "lucide-react";

interface Documento {
  id: string;
  titulo: string;
  categoria: string;
  familia: string | null;
  arquivoUrl: string;
  descricao: string | null;
}

const CATEGORIAS = [
  { value: "apresentacao", label: "Apresentação" },
  { value: "tecnico", label: "Técnico" },
  { value: "comercial", label: "Comercial" },
  { value: "manual", label: "Manual" },
  { value: "outro", label: "Outro" },
];

const FAMILIAS = [
  { value: "", label: "Genérico" },
  { value: "CALLFACE_AI", label: "Callpilot (Callface AI)" },
  { value: "PABX", label: "PABX" },
  { value: "WHITE_LABEL", label: "White Label" },
];

/**
 * Documentos de Atendimento (18/08) — biblioteca de materiais (apresentações/
 * decks/PDFs) que o time consulta e envia durante uma conversa no Atendimento.
 * CRUD real completo, mas catálogo de METADADOS: sem upload de arquivo, cada
 * item guarda uma URL pro material já hospedado em outro lugar.
 */
export function Cf2DocumentosPanel() {
  const qc = useQueryClient();
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [criando, setCriando] = useState(false);

  const { data } = useQuery<{ documentos: Documento[] }>({
    queryKey: ["documentos-atendimento"],
    queryFn: async () => {
      const r = await fetch("/api/documentos-atendimento");
      if (!r.ok) return { documentos: [] };
      return r.json();
    },
  });
  const documentos = data?.documentos ?? [];
  const filtrados = categoriaAtiva ? documentos.filter((d) => d.categoria === categoriaAtiva) : documentos;

  const salvar = useMutation({
    mutationFn: async (d: { id?: string; titulo: string; categoria: string; familia: string | null; arquivoUrl: string; descricao: string }) => {
      const url = d.id ? `/api/documentos-atendimento/${d.id}` : "/api/documentos-atendimento";
      const r = await fetch(url, {
        method: d.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: d.titulo, categoria: d.categoria, familia: d.familia, arquivoUrl: d.arquivoUrl, descricao: d.descricao || undefined }),
      });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documentos-atendimento"] }); setEditando(null); setCriando(false); toast.success("Documento salvo"); },
    onError: () => toast.error("Não foi possível salvar o documento"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/documentos-atendimento/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos-atendimento"] }),
    onError: () => toast.error("Não foi possível remover o documento"),
  });

  return (
    <div className="flex-1 flex flex-col rounded-3xl overflow-hidden min-h-0" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setCategoriaAtiva("")} className="px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: categoriaAtiva === "" ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: categoriaAtiva === "" ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>Todos</button>
          {CATEGORIAS.map((c) => (
            <button key={c.value} onClick={() => setCategoriaAtiva(c.value)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: categoriaAtiva === c.value ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: categoriaAtiva === c.value ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>{c.label}</button>
          ))}
        </div>
        <button onClick={() => setCriando(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
          <Plus className="w-3.5 h-3.5" /> Novo documento
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {criando && <DocumentoForm inicial={null} onSalvar={(d) => salvar.mutate(d)} onCancelar={() => setCriando(false)} salvando={salvar.isPending} />}
        {filtrados.length === 0 && !criando && (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum documento cadastrado ainda nesta categoria.</p>
        )}
        {filtrados.map((d) => (
          <div key={d.id} className="rounded-xl overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            {editando?.id === d.id ? (
              <div className="p-3">
                <DocumentoForm inicial={editando} onSalvar={(dv) => salvar.mutate({ id: d.id, ...dv })} onCancelar={() => setEditando(null)} salvando={salvar.isPending} />
              </div>
            ) : (
              <>
                <button onClick={() => setExpandido(expandido === d.id ? null : d.id)} className="w-full flex items-center justify-between p-3 text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{d.titulo}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>
                      {CATEGORIAS.find((c) => c.value === d.categoria)?.label}
                      {d.familia ? ` · ${FAMILIAS.find((f) => f.value === d.familia)?.label ?? d.familia}` : " · Genérico"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)", transform: expandido === d.id ? "rotate(180deg)" : undefined }} />
                </button>
                {expandido === d.id && (
                  <div className="px-3 pb-3 flex flex-col gap-2">
                    {d.descricao && <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-secondary)" }}>{d.descricao}</p>}
                    <div className="flex items-center gap-3">
                      <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--cf2-accent)" }}>
                        <ExternalLink className="w-3 h-3" /> Abrir documento
                      </a>
                      <button onClick={() => setEditando(d)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}><Pencil className="w-3 h-3" /> Editar</button>
                      <button onClick={() => remover.mutate(d.id)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--cf2-danger-text)" }}><Trash2 className="w-3 h-3" /> Remover</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentoForm({ inicial, onSalvar, onCancelar, salvando }: { inicial: Documento | null; onSalvar: (d: { titulo: string; categoria: string; familia: string | null; arquivoUrl: string; descricao: string }) => void; onCancelar: () => void; salvando: boolean }) {
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [categoria, setCategoria] = useState(inicial?.categoria || "apresentacao");
  const [familia, setFamilia] = useState(inicial?.familia || "");
  const [arquivoUrl, setArquivoUrl] = useState(inicial?.arquivoUrl || "");
  const [descricao, setDescricao] = useState(inicial?.descricao || "");

  return (
    <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do documento" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <div className="flex gap-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={familia} onChange={(e) => setFamilia(e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          {FAMILIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://... (URL do arquivo/deck)" type="url" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional) — quando usar esse material..." rows={3} className="px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button
          onClick={() => titulo.trim() && arquivoUrl.trim() && onSalvar({ titulo: titulo.trim(), categoria, familia: familia || null, arquivoUrl: arquivoUrl.trim(), descricao: descricao.trim() })}
          disabled={salvando || !titulo.trim() || !arquivoUrl.trim()}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
