"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Pencil, Plus, Trash2 } from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

type Regra = {
  id: string; nome: string; etapa: string; alvoTipo: "usuario" | "rodizio"; alvoUsuarioId: string | null; rodizioUsuarioIds: string[];
  diasSemana: number[] | null; horaInicio: string | null; horaFim: string | null; humanoDevolucaoId: string | null; prioridade: number; ativo: boolean;
};
type Estado = {
  regras: Regra[];
  historico: { id: string; quando: string; quem: string | null; acao: string; regra: string; resumo: string }[];
  padroes: { humanoDevolucaoPadraoId?: string; agenteFollowupPadraoId?: string; responsavelInboundId?: string | null };
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : "");
const VAZIA = { nome: "", alvoTipo: "usuario" as "usuario" | "rodizio", alvoUsuarioId: "", rodizioUsuarioIds: [] as string[], diasSemana: [] as number[], horaInicio: "", horaFim: "", humanoDevolucaoId: "", prioridade: 100, ativo: true };
type Form = typeof VAZIA & { id?: string };

const campo = { background: "var(--cf2-bg-page)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" } as const;
const ACAO = { background: "var(--of-coral-acao)", color: "var(--of-papel)" } as const;
const cartao = { borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface)" } as const;

/**
 * Regras de distribuição de leads novos (Ajustes > Leads): "novos leads em Novo -> responsável Y",
 * com Y sendo pessoa, agente de IA (que também é usuário) ou rodízio, e vigência por dia/horário.
 */
export function DistribuicaoLeads() {
  const qc = useQueryClient();
  const { usuarios, byId } = useOrgUsuarios();
  const pessoas = useMemo(() => usuarios.filter((u) => u.tipo !== "agente"), [usuarios]);
  const agentes = useMemo(() => usuarios.filter((u) => u.tipo === "agente"), [usuarios]);
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data } = useQuery<Estado>({
    queryKey: ["distribuicao-leads"],
    queryFn: async () => {
      const r = await fetch("/api/distribuicao-leads");
      if (!r.ok) throw new Error("Não foi possível carregar a distribuição.");
      return r.json();
    },
  });
  const recarregar = () => { qc.invalidateQueries({ queryKey: ["distribuicao-leads"] }); qc.invalidateQueries({ queryKey: ["org-usuarios"] }); };

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const r = await fetch("/api/distribuicao-leads/regras", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: f.id, nome: f.nome, etapa: "novo", alvoTipo: f.alvoTipo,
          alvoUsuarioId: f.alvoTipo === "usuario" ? f.alvoUsuarioId || null : null, rodizioUsuarioIds: f.alvoTipo === "rodizio" ? f.rodizioUsuarioIds : [],
          diasSemana: f.diasSemana.length ? f.diasSemana : null, horaInicio: f.horaInicio || null, horaFim: f.horaFim || null,
          humanoDevolucaoId: f.humanoDevolucaoId || null, prioridade: Number(f.prioridade) || 100, ativo: f.ativo,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar a regra.");
    },
    onSuccess: () => { setForm(null); setErro(null); recarregar(); },
    onError: (e) => setErro((e as Error).message),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/distribuicao-leads/regras/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Não foi possível remover."); },
    onSuccess: recarregar, onError: (e) => setErro((e as Error).message),
  });
  const alternar = useMutation({
    mutationFn: async (r: Regra) => {
      const resp = await fetch("/api/distribuicao-leads/regras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, ativo: !r.ativo }) });
      if (!resp.ok) throw new Error("Não foi possível alterar a regra.");
    },
    onSuccess: recarregar, onError: (e) => setErro((e as Error).message),
  });
  const salvarPadroes = useMutation({
    mutationFn: async (p: { humanoDevolucaoPadraoId: string | null; agenteFollowupPadraoId: string | null }) => {
      const r = await fetch("/api/distribuicao-leads/padroes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar.");
    },
    onSuccess: recarregar, onError: (e) => setErro((e as Error).message),
  });

  const nome = (id: string | null) => (id ? byId.get(id)?.nome ?? "—" : "—");
  const descrever = (r: Regra) => {
    const alvo = r.alvoTipo === "rodizio" ? `rodízio entre ${r.rodizioUsuarioIds.map(nome).join(", ")}` : nome(r.alvoUsuarioId);
    const quando = [r.diasSemana?.length ? r.diasSemana.map((d) => DIAS[d]).join(", ") : "todos os dias", r.horaInicio && r.horaFim ? `${hhmm(r.horaInicio)} às ${hhmm(r.horaFim)}` : "o dia todo"].join(" · ");
    return { alvo, quando };
  };
  const padroes = data?.padroes ?? {};

  const opcoesAlvo = (
    <>
      <optgroup label="Pessoas">{pessoas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</optgroup>
      {agentes.length > 0 && <optgroup label="Agentes de IA">{agentes.map((u) => <option key={u.id} value={u.id}>{u.nome} (IA)</option>)}</optgroup>}
    </>
  );

  return (
    <section className="rounded-xl border p-4 flex flex-col gap-4" style={cartao} aria-labelledby="dist-titulo">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="dist-titulo" className="text-sm font-semibold text-[var(--cf2-text-primary)]">Distribuição de novos leads</h3>
          <p className="text-xs text-[var(--cf2-text-tertiary)]">
            Quem recebe cada lead que cai em Novo de Pré-vendas: uma pessoa, uma agente de IA ou um rodízio, com dia e horário opcionais. Vale na hora em que o lead é criado; sem regra, vale o responsável padrão abaixo.
          </p>
        </div>
        {!form && (
          <button onClick={() => { setErro(null); setForm({ ...VAZIA }); }} className="h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shrink-0" style={ACAO}>
            <Plus className="size-3.5" /> Nova regra
          </button>
        )}
      </div>

      {erro && <p role="alert" className="text-xs" style={{ color: "var(--cf2-danger-text)" }}>{erro}</p>}

      {form && (
        <div className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-page)" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Nome da regra
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Noite e fim de semana" className="h-9 px-2.5 rounded-lg text-sm outline-none" style={campo} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Quem recebe
              <select value={form.alvoTipo} onChange={(e) => setForm({ ...form, alvoTipo: e.target.value as "usuario" | "rodizio" })} className="h-9 px-2 rounded-lg text-sm outline-none" style={campo}>
                <option value="usuario">Uma pessoa ou agente</option>
                <option value="rodizio">Rodízio entre vários</option>
              </select>
            </label>
          </div>
          {form.alvoTipo === "usuario" ? (
            <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Responsável
              <select value={form.alvoUsuarioId} onChange={(e) => setForm({ ...form, alvoUsuarioId: e.target.value })} className="h-9 px-2 rounded-lg text-sm outline-none" style={campo}>
                <option value="">Escolha…</option>{opcoesAlvo}
              </select>
            </label>
          ) : (
            <fieldset className="flex flex-col gap-1.5 text-xs text-[var(--cf2-text-secondary)]">
              <legend className="mb-1">Participantes do rodízio (mínimo 2)</legend>
              <div className="flex flex-wrap gap-1.5">
                {usuarios.map((u) => {
                  const on = form.rodizioUsuarioIds.includes(u.id);
                  return (
                    <button type="button" key={u.id} aria-pressed={on}
                      onClick={() => setForm({ ...form, rodizioUsuarioIds: on ? form.rodizioUsuarioIds.filter((x) => x !== u.id) : [...form.rodizioUsuarioIds, u.id] })}
                      className="h-7 px-2.5 rounded-full text-xs border"
                      style={on ? { ...ACAO, borderColor: "transparent" } : { ...campo }}>
                      {u.nome}{u.tipo === "agente" ? " (IA)" : ""}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <fieldset className="flex flex-col gap-1.5 text-xs text-[var(--cf2-text-secondary)] sm:col-span-3">
              <legend className="mb-1">Dias em que vale (nenhum = todos)</legend>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d, i) => {
                  const on = form.diasSemana.includes(i);
                  return (
                    <button type="button" key={d} aria-pressed={on}
                      onClick={() => setForm({ ...form, diasSemana: on ? form.diasSemana.filter((x) => x !== i) : [...form.diasSemana, i].sort() })}
                      className="h-7 w-11 rounded-full text-xs border"
                      style={on ? { ...ACAO, borderColor: "transparent" } : { ...campo }}>{d}</button>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Das
              <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className="h-9 px-2.5 rounded-lg text-sm outline-none" style={campo} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Até
              <input type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} className="h-9 px-2.5 rounded-lg text-sm outline-none" style={campo} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Prioridade (menor vence)
              <input type="number" min={0} max={1000} value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) })} className="h-9 px-2.5 rounded-lg text-sm outline-none" style={campo} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Se a agente passar para humano, volta para
            <select value={form.humanoDevolucaoId} onChange={(e) => setForm({ ...form, humanoDevolucaoId: e.target.value })} className="h-9 px-2 rounded-lg text-sm outline-none" style={campo}>
              <option value="">Padrão da organização</option>
              {pessoas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button disabled={salvar.isPending} onClick={() => salvar.mutate(form)} className="h-9 px-4 rounded-lg text-sm font-medium disabled:opacity-50" style={ACAO}>
              {salvar.isPending ? "Salvando..." : form.id ? "Salvar regra" : "Criar regra"}
            </button>
            <button onClick={() => { setForm(null); setErro(null); }} className="h-9 px-3 rounded-lg text-sm text-[var(--cf2-text-secondary)]">Cancelar</button>
          </div>
        </div>
      )}

      {data && data.regras.length === 0 && !form && (
        <p className="text-xs text-[var(--cf2-text-tertiary)]">Nenhuma regra. Os leads novos seguem o responsável padrão (roteamento de inbound abaixo).</p>
      )}
      <ul className="flex flex-col gap-2">
        {data?.regras.map((r) => {
          const d = descrever(r);
          const ia = r.alvoTipo === "usuario" && byId.get(r.alvoUsuarioId ?? "")?.tipo === "agente";
          return (
            <li key={r.id} className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: "var(--cf2-border-default)", opacity: r.ativo ? 1 : 0.55 }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--cf2-text-primary)] flex items-center gap-1.5">
                  {r.nome}{ia && <Bot className="size-3.5" aria-label="Agente de IA" />}
                  {!r.ativo && <span className="text-[11px] font-normal text-[var(--cf2-text-tertiary)]">(desativada)</span>}
                </p>
                <p className="text-xs text-[var(--cf2-text-secondary)]">Novos leads em Novo para <strong>{d.alvo}</strong> · {d.quando}</p>
              </div>
              <button onClick={() => alternar.mutate(r)} className="h-8 px-2.5 rounded-lg text-xs border" style={campo} aria-label={r.ativo ? `Desativar ${r.nome}` : `Ativar ${r.nome}`}>{r.ativo ? "Desativar" : "Ativar"}</button>
              <button onClick={() => { setErro(null); setForm({ id: r.id, nome: r.nome, alvoTipo: r.alvoTipo, alvoUsuarioId: r.alvoUsuarioId ?? "", rodizioUsuarioIds: r.rodizioUsuarioIds, diasSemana: r.diasSemana ?? [], horaInicio: hhmm(r.horaInicio), horaFim: hhmm(r.horaFim), humanoDevolucaoId: r.humanoDevolucaoId ?? "", prioridade: r.prioridade, ativo: r.ativo }); }} className="size-8 grid place-items-center rounded-lg border" style={campo} aria-label={`Editar ${r.nome}`}><Pencil className="size-3.5" /></button>
              <button onClick={() => { if (confirm(`Remover a regra "${r.nome}"?`)) remover.mutate(r.id); }} className="size-8 grid place-items-center rounded-lg border" style={campo} aria-label={`Remover ${r.nome}`}><Trash2 className="size-3.5" /></button>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2 border-t pt-3" style={{ borderColor: "var(--cf2-border-default)" }}>
        <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Quando uma agente passa para humano, quem recebe (padrão)
          <select value={padroes.humanoDevolucaoPadraoId ?? ""} onChange={(e) => salvarPadroes.mutate({ humanoDevolucaoPadraoId: e.target.value || null, agenteFollowupPadraoId: padroes.agenteFollowupPadraoId ?? null })} className="h-9 px-2 rounded-lg text-sm outline-none" style={campo}>
            <option value="">Gerente da organização</option>
            {pessoas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--cf2-text-secondary)]">Agente do follow-up por tag (tag "Follow-up IA")
          <select value={padroes.agenteFollowupPadraoId ?? ""} onChange={(e) => salvarPadroes.mutate({ humanoDevolucaoPadraoId: padroes.humanoDevolucaoPadraoId ?? null, agenteFollowupPadraoId: e.target.value || null })} className="h-9 px-2 rounded-lg text-sm outline-none" style={campo}>
            <option value="">Nenhum (a tag não delega)</option>
            {agentes.map((u) => <option key={u.id} value={u.id}>{u.nome} (IA)</option>)}
          </select>
        </label>
      </div>

      {data && data.historico.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--cf2-text-secondary)]">Histórico de mudanças ({data.historico.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.historico.map((h) => (
              <li key={h.id} className="text-[var(--cf2-text-secondary)]">
                <span className="text-[var(--cf2-text-tertiary)]">{new Date(h.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>{" "}
                <strong>{h.quem ?? "Sistema"}</strong> {h.acao}: {h.regra} {h.resumo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
