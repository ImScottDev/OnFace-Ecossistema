"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { useScriptsAtendimento, SCRIPTS_CATEGORIA_LABEL, type ScriptAtendimento as Script } from "./useScriptsAtendimento";

const CATEGORIAS = [
  { value: "pre_vendas", label: SCRIPTS_CATEGORIA_LABEL.pre_vendas },
  { value: "comercial", label: SCRIPTS_CATEGORIA_LABEL.comercial },
  { value: "entrega", label: SCRIPTS_CATEGORIA_LABEL.entrega },
  { value: "cs", label: SCRIPTS_CATEGORIA_LABEL.cs },
  { value: "geral", label: SCRIPTS_CATEGORIA_LABEL.geral },
];

/**
 * Scripts de Atendimento (19/08, P0.6) — roteiro humano de ligação/
 * conversa, não existia em lugar nenhum do CRM2 (nem do legado). CRUD real
 * completo (não fica só schema), sem inventar o TEXTO real dos roteiros —
 * seed abaixo marcado `[EXEMPLO]` até o time revisar.
 */
export function Cf2ScriptsPanel() {
  const qc = useQueryClient();
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<Script | null>(null);
  const [criando, setCriando] = useState(false);

  const { data } = useScriptsAtendimento();
  const scripts = data?.scripts ?? [];
  const filtrados = categoriaAtiva ? scripts.filter((s) => s.categoria === categoriaAtiva) : scripts;

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
          <Plus className="w-3.5 h-3.5" /> Novo script
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {criando && <ScriptForm inicial={null} onSalvar={(s) => salvar.mutate(s)} onCancelar={() => setCriando(false)} salvando={salvar.isPending} />}
        {filtrados.length === 0 && !criando && (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum script cadastrado ainda nesta categoria.</p>
        )}
        {filtrados.map((s) => (
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>{CATEGORIAS.find((c) => c.value === s.categoria)?.label} · v{s.versao}</span>
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
  );
}

function ScriptForm({ inicial, onSalvar, onCancelar, salvando }: { inicial: Script | null; onSalvar: (s: { titulo: string; categoria: string; conteudo: string }) => void; onCancelar: () => void; salvando: boolean }) {
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [categoria, setCategoria] = useState(inicial?.categoria || "geral");
  const [conteudo, setConteudo] = useState(inicial?.conteudo || "");

  return (
    <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do script" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Roteiro — abertura, perguntas, objeções, próximos passos..." rows={6} className="px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button onClick={() => titulo.trim() && conteudo.trim() && onSalvar({ titulo: titulo.trim(), categoria, conteudo: conteudo.trim() })} disabled={salvando || !titulo.trim() || !conteudo.trim()} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Salvar</button>
      </div>
    </div>
  );
}
