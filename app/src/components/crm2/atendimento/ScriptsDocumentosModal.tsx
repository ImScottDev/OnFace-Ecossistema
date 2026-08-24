"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X, Plus, Pencil, Trash2, ChevronDown, ExternalLink,
  ScrollText, FileStack, Loader2, AlertCircle, Inbox,
} from "lucide-react";
import { useScriptsAtendimento, SCRIPTS_CATEGORIA_LABEL, type ScriptAtendimento } from "./useScriptsAtendimento";
import {
  useDocumentosAtendimento, DOCUMENTOS_CATEGORIA_LABEL, DOCUMENTOS_FAMILIA_LABEL,
  type DocumentoAtendimento,
} from "./useDocumentosAtendimento";

const SCRIPTS_CATEGORIAS = Object.keys(SCRIPTS_CATEGORIA_LABEL);
const DOCUMENTOS_CATEGORIAS = Object.entries(DOCUMENTOS_CATEGORIA_LABEL).map(([value, label]) => ({ value, label }));
const DOCUMENTOS_FAMILIAS = [{ value: "", label: "Genérico" }, ...Object.entries(DOCUMENTOS_FAMILIA_LABEL).map(([value, label]) => ({ value, label }))];

/**
 * Scripts & Documentos (23/08) — antes eram 2 abas de tela cheia no topo do
 * módulo Atendimento (ScriptsPanel/DocumentosPanel); a pedido do Kauã virou
 * um popup único, aberto pelo ícone de roteiro no composer do ChatThread,
 * pra não sair da conversa pra consultar material. Mesmo dado/CRUD/rotas de
 * antes, só a superfície mudou. Scripts ficam AGRUPADOS por categoria real
 * (pré-vendas, comercial B2B, implantação/entrega, onboarding, CS e
 * cobrança/financeiro, ver schema.ts); Documentos mantém
 * o filtro por categoria que já existia.
 */
export function Cf2ScriptsDocumentosModal({ onClose }: { onClose: () => void }) {
  const [aba, setAba] = useState<"scripts" | "documentos">("scripts");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--cf2-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <button
              onClick={() => setAba("scripts")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold"
              style={{ background: aba === "scripts" ? "var(--cf2-bg-surface)" : "transparent", color: aba === "scripts" ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}
            >
              <ScrollText className="w-3.5 h-3.5" /> Scripts
            </button>
            <button
              onClick={() => setAba("documentos")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold"
              style={{ background: aba === "documentos" ? "var(--cf2-bg-surface)" : "transparent", color: aba === "documentos" ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}
            >
              <FileStack className="w-3.5 h-3.5" /> Documentos
            </button>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {aba === "scripts" ? <ScriptsTab /> : <DocumentosTab />}
        </div>
      </div>
    </div>
  );
}

function EstadoVazio({ icon: Icon, texto }: { icon: typeof Inbox; texto: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
      <Icon className="w-6 h-6" style={{ color: "var(--cf2-text-tertiary)" }} />
      <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{texto}</p>
    </div>
  );
}

function EstadoCarregando({ texto }: { texto: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--cf2-text-tertiary)" }} />
      <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{texto}</p>
    </div>
  );
}

function EstadoErro({ texto }: { texto: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
      <AlertCircle className="w-6 h-6" style={{ color: "var(--cf2-danger-text)" }} />
      <p className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>{texto}</p>
    </div>
  );
}

function ScriptsTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useScriptsAtendimento();
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<ScriptAtendimento | null>(null);
  const [criando, setCriando] = useState(false);

  const scripts = data?.scripts ?? [];

  const salvar = useMutation({
    mutationFn: async (s: { id?: string; titulo: string; categoria: string; conteudo: string }) => {
      const url = s.id ? `/api/scripts-atendimento/${s.id}` : "/api/scripts-atendimento";
      const r = await fetch(url, { method: s.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo: s.titulo, categoria: s.categoria, conteudo: s.conteudo }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scripts-atendimento"] }); setEditando(null); setCriando(false); toast.success("Script salvo"); },
    onError: () => toast.error("Não foi possível salvar o script"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/scripts-atendimento/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scripts-atendimento"] }),
    onError: () => toast.error("Não foi possível remover o script"),
  });

  // Agrupamento por categoria real (19/08, P0.6) — só cria seção pra
  // categoria que tem script de fato; ordem fixa segue SCRIPTS_CATEGORIA_LABEL.
  const grupos = SCRIPTS_CATEGORIAS
    .map((categoria) => ({ categoria, label: SCRIPTS_CATEGORIA_LABEL[categoria], itens: scripts.filter((s) => s.categoria === categoria) }))
    .filter((g) => g.itens.length > 0);
  const semCategoriaConhecida = scripts.filter((s) => !SCRIPTS_CATEGORIAS.includes(s.categoria));

  return (
    <div className="flex flex-col gap-3 p-4">
      <button
        onClick={() => setCriando(true)}
        className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
        style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
      >
        <Plus className="w-3.5 h-3.5" /> Novo script
      </button>

      {criando && <ScriptForm inicial={null} onSalvar={(s) => salvar.mutate(s)} onCancelar={() => setCriando(false)} salvando={salvar.isPending} />}

      {isLoading ? (
        <EstadoCarregando texto="Carregando scripts..." />
      ) : isError ? (
        <EstadoErro texto="Não foi possível carregar os scripts." />
      ) : scripts.length === 0 && !criando ? (
        <EstadoVazio icon={ScrollText} texto="Nenhum script cadastrado ainda." />
      ) : (
        <div className="flex flex-col gap-4">
          {[...grupos, ...(semCategoriaConhecida.length > 0 ? [{ categoria: "outros", label: "Outros", itens: semCategoriaConhecida }] : [])].map((grupo) => (
            <div key={grupo.categoria} className="flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{grupo.label} · {grupo.itens.length}</p>
              <div className="flex flex-col gap-2">
                {grupo.itens.map((s) => (
                  <div key={s.id} className="rounded-xl overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                    {editando?.id === s.id ? (
                      <div className="p-3">
                        <ScriptForm inicial={editando} onSalvar={(sv) => salvar.mutate({ id: s.id, ...sv })} onCancelar={() => setEditando(null)} salvando={salvar.isPending} />
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setExpandido(expandido === s.id ? null : s.id)} className="w-full flex items-center justify-between p-3 text-left">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{s.titulo}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>v{s.versao}</span>
                          </div>
                          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)", transform: expandido === s.id ? "rotate(180deg)" : undefined }} />
                        </button>
                        {expandido === s.id && (
                          <div className="px-3 pb-3 flex flex-col gap-2">
                            <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-secondary)" }}>{s.conteudo}</p>
                            <div className="flex gap-3">
                              <button onClick={() => setEditando(s)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}><Pencil className="w-3 h-3" /> Editar</button>
                              <button onClick={() => remover.mutate(s.id)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--cf2-danger-text)" }}><Trash2 className="w-3 h-3" /> Remover</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptForm({ inicial, onSalvar, onCancelar, salvando }: { inicial: ScriptAtendimento | null; onSalvar: (s: { titulo: string; categoria: string; conteudo: string }) => void; onCancelar: () => void; salvando: boolean }) {
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [categoria, setCategoria] = useState(inicial?.categoria || "geral");
  const [conteudo, setConteudo] = useState(inicial?.conteudo || "");

  return (
    <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do script" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        {SCRIPTS_CATEGORIAS.map((c) => <option key={c} value={c}>{SCRIPTS_CATEGORIA_LABEL[c]}</option>)}
      </select>
      <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Roteiro — abertura, perguntas, objeções, próximos passos..." rows={6} className="px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button onClick={() => titulo.trim() && conteudo.trim() && onSalvar({ titulo: titulo.trim(), categoria, conteudo: conteudo.trim() })} disabled={salvando || !titulo.trim() || !conteudo.trim()} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Salvar</button>
      </div>
    </div>
  );
}

function DocumentosTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useDocumentosAtendimento();
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<DocumentoAtendimento | null>(null);
  const [criando, setCriando] = useState(false);

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
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setCategoriaAtiva("")} className="px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: categoriaAtiva === "" ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: categoriaAtiva === "" ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>Todos</button>
          {DOCUMENTOS_CATEGORIAS.map((c) => (
            <button key={c.value} onClick={() => setCategoriaAtiva(c.value)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: categoriaAtiva === c.value ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: categoriaAtiva === c.value ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}>{c.label}</button>
          ))}
        </div>
        <button onClick={() => setCriando(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
          <Plus className="w-3.5 h-3.5" /> Novo documento
        </button>
      </div>

      {criando && <DocumentoForm inicial={null} onSalvar={(d) => salvar.mutate(d)} onCancelar={() => setCriando(false)} salvando={salvar.isPending} />}

      {isLoading ? (
        <EstadoCarregando texto="Carregando documentos..." />
      ) : isError ? (
        <EstadoErro texto="Não foi possível carregar os documentos." />
      ) : filtrados.length === 0 && !criando ? (
        <EstadoVazio icon={FileStack} texto="Nenhum documento cadastrado ainda nesta categoria." />
      ) : (
        <div className="flex flex-col gap-2">
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>
                        {DOCUMENTOS_CATEGORIA_LABEL[d.categoria] ?? d.categoria}
                        {d.familia ? ` · ${DOCUMENTOS_FAMILIA_LABEL[d.familia] ?? d.familia}` : " · Genérico"}
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
      )}
    </div>
  );
}

function DocumentoForm({ inicial, onSalvar, onCancelar, salvando }: { inicial: DocumentoAtendimento | null; onSalvar: (d: { titulo: string; categoria: string; familia: string | null; arquivoUrl: string; descricao: string }) => void; onCancelar: () => void; salvando: boolean }) {
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [categoria, setCategoria] = useState(inicial?.categoria || "apresentacao");
  const [familia, setFamilia] = useState(inicial?.familia || "");
  const [arquivoUrl, setArquivoUrl] = useState(inicial?.arquivoUrl || "");
  const [descricao, setDescricao] = useState(inicial?.descricao || "");

  return (
    <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do documento" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <div className="flex gap-2 flex-wrap">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          {DOCUMENTOS_CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={familia} onChange={(e) => setFamilia(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          {DOCUMENTOS_FAMILIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
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
