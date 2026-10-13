"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, UserRound, Building2 } from "lucide-react";
import { useOrgUsuarios, initialsOf } from "@/components/crm/BoardFilters";
import { OpcoesDePessoa } from "@/components/onface/OpcoesDePessoa";

export const TIPO_TAREFA_OPTIONS: { value: string; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "follow_up", label: "Follow-up" },
  { value: "ligar", label: "Ligar" },
  { value: "enviar_proposta", label: "Enviar proposta" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "renovacao", label: "Renovação" },
  { value: "nps", label: "NPS" },
  { value: "upsell", label: "Upsell" },
  { value: "confirmar_reuniao_outlook", label: "Confirmar reunião (Outlook)" },
  { value: "gerada_callface", label: "Gerada pela Callface" },
];

/**
 * Tipos criados pelos motores (CS e pós-venda), fora do catálogo escolhível
 * no formulário — ninguém cria "cs_marco" na mão. Ficam só na tradução, pra
 * que a tela não exiba a chave crua.
 */
const TIPOS_GERADOS: Record<string, string> = {
  cs_marco: "Checkpoint de CS",
  cs_risco: "Tratativa de risco",
  cs_billing: "Cobrança",
  cs_renovacao: "Renovação",
  cs_retencao: "Retenção",
  cs_followup: "Follow-up de CS",
  onboarding_agendar_reuniao: "Agendar onboarding",
};

export function tipoLabel(tipo: string): string {
  return TIPO_TAREFA_OPTIONS.find((t) => t.value === tipo)?.label
    ?? TIPOS_GERADOS[tipo]
    ?? tipo;
}

export interface Tarefa {
  id: string;
  leadId: string | null;
  negocioId: string | null;
  usuarioId: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  dataVencimento: string | null;
  venceEm: string | null;
  concluida: boolean;
  leadNome: string | null;
  negocioTitulo: string | null;
  responsavelNome: string | null;
  responsavelAvatarUrl: string | null;
}

function isoToLocalDateTime(iso: string | null): { data: string; hora: string } {
  if (!iso) return { data: "", hora: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { data: "", hora: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

interface LeadOption {
  id: string;
  nome: string;
  empresa: string | null;
}

function LeadPicker({
  leadId,
  leadLabel,
  onChange,
  locked,
}: {
  leadId: string | null;
  leadLabel: string | null;
  onChange: (id: string | null, label: string | null) => void;
  locked?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadOption[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await fetch(`/api/leads?search=${encodeURIComponent(query.trim())}&limit=8`);
      if (!r.ok) return;
      const j = (await r.json()) as { leads: LeadOption[] };
      setResults(j.leads || []);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  if (leadId && leadLabel) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-[var(--cf2-text-secondary)]">
        <UserRound className="w-3 h-3 text-[var(--cf2-text-tertiary)] shrink-0" />
        <span className="truncate flex-1">{leadLabel}</span>
        {!locked && (
          <button onClick={() => onChange(null, null)} className="text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-primary)] shrink-0">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--cf2-text-tertiary)]" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Vincular a um lead (opcional)"
        className="w-full pl-7 pr-2.5 py-2 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg text-[var(--cf2-text-secondary)] placeholder:text-[var(--cf2-text-tertiary)] outline-none focus:border-[#e23752]/30"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden shadow-xl max-h-44 overflow-y-auto" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {results.map((l) => (
            <button
              key={l.id}
              onMouseDown={() => { onChange(l.id, l.empresa ? `${l.nome} · ${l.empresa}` : l.nome); setQuery(""); setResults([]); }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--cf2-text-secondary)] hover:bg-white/[0.06] flex items-center gap-1.5"
            >
              <span className="truncate">{l.nome}</span>
              {l.empresa && <span className="text-[var(--cf2-text-tertiary)] truncate">· {l.empresa}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NegocioOption {
  id: string;
  titulo: string;
  leadNome: string | null;
}

function NegocioPicker({
  negocioId,
  negocioLabel,
  onChange,
  locked,
}: {
  negocioId: string | null;
  negocioLabel: string | null;
  onChange: (id: string | null, label: string | null) => void;
  locked?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NegocioOption[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await fetch(`/api/negocios?search=${encodeURIComponent(query.trim())}&limit=8`);
      if (!r.ok) return;
      const j = (await r.json()) as { negocios: NegocioOption[] };
      setResults(j.negocios || []);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  if (negocioId && negocioLabel) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-[var(--cf2-text-secondary)]">
        <Building2 className="w-3 h-3 text-[var(--cf2-text-tertiary)] shrink-0" />
        <span className="truncate flex-1">{negocioLabel}</span>
        {!locked && (
          <button onClick={() => onChange(null, null)} className="text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-primary)] shrink-0">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--cf2-text-tertiary)]" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Vincular a um negócio (opcional)"
        className="w-full pl-7 pr-2.5 py-2 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg text-[var(--cf2-text-secondary)] placeholder:text-[var(--cf2-text-tertiary)] outline-none focus:border-[#e23752]/30"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden shadow-xl max-h-44 overflow-y-auto" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {results.map((n) => (
            <button
              key={n.id}
              onMouseDown={() => { onChange(n.id, n.leadNome ? `${n.titulo} · ${n.leadNome}` : n.titulo); setQuery(""); setResults([]); }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--cf2-text-secondary)] hover:bg-white/[0.06] flex items-center gap-1.5"
            >
              <span className="truncate">{n.titulo}</span>
              {n.leadNome && <span className="text-[var(--cf2-text-tertiary)] truncate">· {n.leadNome}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TarefaFormModal({
  open,
  onClose,
  tarefa = null,
  defaultLeadId = null,
  defaultLeadLabel = null,
  defaultNegocioId = null,
  defaultNegocioLabel = null,
  defaultTitulo = "",
  defaultTipo = "geral",
  invalidateKeys = [["tarefas"]],
}: {
  open: boolean;
  onClose: () => void;
  tarefa?: Tarefa | null;
  defaultLeadId?: string | null;
  defaultLeadLabel?: string | null;
  defaultNegocioId?: string | null;
  defaultNegocioLabel?: string | null;
  defaultTitulo?: string;
  defaultTipo?: string;
  invalidateKeys?: (string | null)[][];
}) {
  const queryClient = useQueryClient();
  const { usuarios, currentUserId } = useOrgUsuarios();
  const editando = !!tarefa;

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("geral");
  const [prioridade, setPrioridade] = useState("media");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(defaultLeadId);
  const [leadLabel, setLeadLabel] = useState<string | null>(defaultLeadLabel);
  const [negocioId, setNegocioId] = useState<string | null>(defaultNegocioId);
  const [negocioLabel, setNegocioLabel] = useState<string | null>(defaultNegocioLabel);

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao || "");
      setTipo(tarefa.tipo);
      setPrioridade(tarefa.prioridade || "media");
      const { data: d, hora: h } = isoToLocalDateTime(tarefa.venceEm || tarefa.dataVencimento);
      setData(d);
      setHora(h);
      setResponsavelId(tarefa.usuarioId);
      setLeadId(tarefa.leadId);
      setLeadLabel(tarefa.leadNome);
      setNegocioId(tarefa.negocioId);
      setNegocioLabel(tarefa.negocioTitulo);
    } else {
      setTitulo(defaultTitulo); setDescricao(""); setTipo(defaultTipo); setPrioridade("media"); setData(""); setHora("");
      setLeadId(defaultLeadId);
      setLeadLabel(defaultLeadLabel);
      setNegocioId(defaultNegocioId);
      setNegocioLabel(defaultNegocioLabel);
      setResponsavelId(currentUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarefa, defaultTitulo, defaultTipo]);

  const salvar = useMutation({
    mutationFn: async () => {
      const venceEm = data ? new Date(`${data}T${hora || "09:00"}:00`).toISOString() : null;
      const body = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        prioridade,
        venceEm,
        leadId,
        negocioId,
        responsavelId,
      };
      const r = editando
        ? await fetch(`/api/tarefas/${tarefa!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/tarefas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!r.ok) throw new Error(editando ? "Falha ao salvar tarefa" : "Falha ao criar tarefa");
      return r.json();
    },
    onSuccess: () => {
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      onClose();
    },
  });

  if (!open) return null;
  const inputCls = "w-full text-xs rounded-lg px-3 py-2 outline-none bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] text-[var(--cf2-text-primary)] placeholder:text-[var(--cf2-text-tertiary)] focus:border-[var(--cf2-accent)]";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Editar tarefa" : "Nova tarefa"}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-4 space-y-2.5"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 24px 48px -12px rgba(17,19,24,0.25)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-[var(--cf2-text-primary)]">{editando ? "Editar tarefa" : "Nova tarefa"}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 -m-1.5 rounded-lg text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-primary)] hover:bg-[var(--cf2-bg-surface-muted)]"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex: Follow-up com o cliente)" className={inputCls} autoFocus />
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" rows={2} className={inputCls + " resize-none"} />

        <LeadPicker leadId={leadId} leadLabel={leadLabel} onChange={(id, label) => { setLeadId(id); setLeadLabel(label); }} locked={!editando && !!defaultLeadId} />
        <NegocioPicker negocioId={negocioId} negocioLabel={negocioLabel} onChange={(id, label) => { setNegocioId(id); setNegocioLabel(label); }} locked={!editando && !!defaultNegocioId} />

        <div className="grid grid-cols-2 gap-1.5">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            {TIPO_TAREFA_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={inputCls}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <input type="date" aria-label="Data" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} />
        </div>

        <select value={responsavelId ?? ""} onChange={(e) => setResponsavelId(e.target.value || null)} className={inputCls}>
          <OpcoesDePessoa itens={usuarios} rotulo={(u) => (u.id === currentUserId ? `${u.nome} (eu)` : u.nome)} />
        </select>

        <div className="flex justify-end gap-1.5 pt-1">
          <button type="button" onClick={onClose} className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)] hover:bg-[var(--cf2-bg-surface-muted)]">Cancelar</button>
          <button
            type="button"
            onClick={() => titulo.trim() && salvar.mutate()}
            disabled={!titulo.trim() || salvar.isPending}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            {salvar.isPending ? "Salvando..." : editando ? "Salvar" : "Criar tarefa"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
