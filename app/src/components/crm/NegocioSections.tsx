"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, CalendarClock } from "lucide-react";

// Seções reutilizáveis do negócio (drawer + página /negocios/[id]):
// adicionar nota e criar/listar tarefas. Mantidas aqui pra não duplicar.

export function AddNoteInlineNegocio({ negocioId }: { negocioId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const res = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, negocioId }) });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] }); setText(""); setOpen(false); },
  });
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.03] rounded-lg transition-colors mt-1.5">
        <Plus size={11} /> Adicionar nota
      </button>
    );
  }
  return (
    <div className="mt-1.5 space-y-1.5">
      <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma nota..." className="w-full text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 placeholder:text-white/20 outline-none focus:border-[#e23752]/30 resize-y" rows={4}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) addNota.mutate(text.trim()); if (e.key === "Escape") { setOpen(false); setText(""); } }} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/15">Cmd+Enter para salvar</span>
        <div className="flex gap-1.5">
          <button onClick={() => { setOpen(false); setText(""); }} className="text-[10px] text-white/25 hover:text-white/40 px-2 py-1">Cancelar</button>
          <button onClick={() => text.trim() && addNota.mutate(text.trim())} disabled={!text.trim() || addNota.isPending} className="text-[10px] text-[#e23752] hover:text-[#f06d82] px-2 py-1 disabled:opacity-30 flex items-center gap-1"><Send size={9} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

function fmtVenceTarefa(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const temHora = v.includes("T") && !v.endsWith("T00:00:00.000Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + (temHora ? " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
}

interface TarefaNegocio {
  id: string;
  titulo: string;
  descricao: string | null;
  venceEm: string | null;
  dataVencimento: string | null;
  concluida: boolean;
}

export function TarefasSectionNegocio({ negocioId, leadId }: { negocioId: string; leadId?: string | null }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");

  const { data: resp } = useQuery({
    queryKey: ["negocio-tarefas", negocioId],
    queryFn: async () => {
      const r = await fetch(`/api/tarefas?negocioId=${negocioId}&concluida=false`);
      if (!r.ok) return { tarefas: [] as TarefaNegocio[] };
      return r.json() as Promise<{ tarefas: TarefaNegocio[] }>;
    },
  });
  const tarefas: TarefaNegocio[] = resp?.tarefas || [];

  const criar = useMutation({
    mutationFn: async () => {
      const venceEm = data ? new Date(`${data}T${hora || "09:00"}:00`).toISOString() : null;
      const r = await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId, leadId: leadId || null, titulo: titulo.trim(), descricao: descricao.trim() || null, tipo: "geral", venceEm }),
      });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-tarefas", negocioId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      setTitulo(""); setDescricao(""); setData(""); setHora(""); setOpen(false);
    },
  });

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida: true }) });
      if (!r.ok) throw new Error("Falha");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-tarefas", negocioId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });

  const inputCls = "w-full text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 placeholder:text-white/20 outline-none focus:border-[#e23752]/30";

  return (
    <div className="card-solid p-3.5">
      <h3 className="text-xs font-medium text-white/50 mb-2.5">
        <CalendarClock className="w-3.5 h-3.5 inline mr-1" />
        Tarefas {tarefas.length > 0 && `(${tarefas.length})`}
      </h3>
      {tarefas.length > 0 && (
        <div className="space-y-1.5 mb-1.5">
          {tarefas.map((t) => (
            <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02]">
              <button onClick={() => concluir.mutate(t.id)} disabled={concluir.isPending} className="mt-0.5 w-3.5 h-3.5 rounded border border-white/20 hover:border-[#e23752] shrink-0" title="Concluir tarefa" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/80">{t.titulo}</p>
                {t.descricao && <p className="text-[10px] text-white/40 whitespace-pre-wrap">{t.descricao}</p>}
                {(t.venceEm || t.dataVencimento) && (
                  <p className="text-[10px] text-[#e23752]/80 mt-0.5">{fmtVenceTarefa(t.venceEm || t.dataVencimento)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.03] rounded-lg transition-colors">
          <Plus size={11} /> Adicionar tarefa
        </button>
      ) : (
        <div className="space-y-1.5">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex: Follow-up com o cliente)" className={inputCls} autoFocus />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" rows={2} className={inputCls + " resize-none"} />
          <div className="flex gap-1.5">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/15">Vai para Minhas Tarefas</span>
            <div className="flex gap-1.5">
              <button onClick={() => { setOpen(false); setTitulo(""); setDescricao(""); setData(""); setHora(""); }} className="text-[10px] text-white/25 hover:text-white/40 px-2 py-1">Cancelar</button>
              <button onClick={() => titulo.trim() && criar.mutate()} disabled={!titulo.trim() || criar.isPending} className="text-[10px] text-[#e23752] hover:text-[#f06d82] px-2 py-1 disabled:opacity-30 flex items-center gap-1">
                <Send size={9} /> {criar.isPending ? "Salvando..." : "Salvar tarefa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
