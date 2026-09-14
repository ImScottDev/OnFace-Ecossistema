"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Headset, FileText, Calendar, Users, Filter, GitBranch,
  Briefcase, CheckCircle2, Zap, TrendingUp, Settings, Search, Building2,
  Kanban, Plus, Loader2, UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
  group?: string;
}

// Navegação real do App Shell novo — mesmos destinos do Sidebar.tsx (algumas
// todas apontam pra telas CRM2 desde a consolidação de 08/09/2026).
const NAV: CommandItem[] = [
  { id: "nav-inicio", label: "Dashboard", href: "/inicio", icon: LayoutDashboard, group: "Navegar" },
  { id: "nav-atendimento", label: "Atendimento", href: "/atendimento", icon: Headset, group: "Navegar" },
  { id: "nav-propostas", label: "Propostas", href: "/propostas", icon: FileText, group: "Navegar" },
  { id: "nav-calendario", label: "Calendário", href: "/calendario", icon: Calendar, group: "Navegar" },
  { id: "nav-contatos", label: "Contatos & Empresas", href: "/contatos", icon: Users, group: "Navegar" },
  { id: "nav-qualificacao", label: "Qualificação", href: "/pre-vendas", icon: Filter, group: "Navegar" },
  { id: "nav-pipeline", label: "Pipeline", href: "/pipeline", icon: GitBranch, group: "Navegar" },
  { id: "nav-negocios", label: "Negócios", href: "/pipeline", icon: Briefcase, group: "Navegar" },
  { id: "nav-atividades", label: "Tarefas", href: "/tarefas", icon: CheckCircle2, group: "Navegar" },
  { id: "nav-automacoes", label: "Automações", href: "/automacoes", icon: Zap, group: "Navegar" },
  { id: "nav-indicadores", label: "Insights", href: "/relatorios", icon: TrendingUp, group: "Navegar" },
  { id: "nav-config", label: "Ajustes", href: "/ajustes", icon: Settings, group: "Navegar" },
];

const ACOES: CommandItem[] = [
  { id: "acao-novo-negocio", label: "Criar Negócio", href: "/negocios/novo", icon: Plus, group: "Ações rápidas" },
];

const ESTATICOS = [...ACOES, ...NAV];

export function Cf2CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entityResults, setEntityResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filteredEstaticos = query.trim()
    ? ESTATICOS.filter((cmd) => cmd.label.toLowerCase().includes(query.trim().toLowerCase()))
    : ESTATICOS;

  // Busca global real: pessoas/leads (contatos-unified), empresas, negócios,
  // propostas e atividades — 5 endpoints reais em paralelo, nenhum inventado.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setEntityResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [leadsRes, empresasRes, negociosRes, propostasRes, tarefasRes, clientesRes] = await Promise.all([
          fetch(`/api/contatos-unified?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
          fetch(`/api/empresas?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
          fetch(`/api/negocios?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
          fetch(`/api/propostas?q=${encodeURIComponent(q)}`, { signal: controller.signal }),
          fetch(`/api/tarefas?search=${encodeURIComponent(q)}`, { signal: controller.signal }),
          // Clientes (19/08) — grupo próprio, real (Empresa+Serviço, MRR
          // certo), separado de "Empresas" (diretório genérico) pra levar
          // direto pro Customer 360 quando a busca já é de um cliente ativo.
          fetch(`/api/clientes-crm2?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
        ]);
        const [leadsData, empresasData, negociosData, propostasData, tarefasData, clientesData] = await Promise.all([
          leadsRes.ok ? leadsRes.json() : { contatos: [] },
          empresasRes.ok ? empresasRes.json() : { empresas: [] },
          negociosRes.ok ? negociosRes.json() : { negocios: [] },
          propostasRes.ok ? propostasRes.json() : { propostas: [] },
          tarefasRes.ok ? tarefasRes.json() : { tarefas: [] },
          clientesRes.ok ? clientesRes.json() : { clientes: [] },
        ]);
        const results: CommandItem[] = [
          ...(leadsData.contatos ?? leadsData ?? []).slice(0, 5).map((l: { id: string; nome: string; empresa?: string | null; tipo?: string }) => ({
            id: `lead-${l.id}`,
            label: l.nome,
            sublabel: l.empresa || (l.tipo === "cliente" ? "Cliente" : l.tipo === "lead" ? "Lead" : undefined),
            // Saneamento CRM2 (16/08): apontava pra /contatos-legado/${id}, que
            // NUNCA existiu como rota (contatos-legado só tem a listagem na
            // raiz, sem [id]) — 100% dos cliques em "Pessoas" no Cmd+K
            // caíam em 404. /contatos/${id} é o detalhe real (ainda dark,
            // não migrado — ver pendência registrada), mas pelo menos existe.
            href: `/contatos/${l.id}`,
            icon: Users,
            group: "Pessoas",
          })),
          ...(empresasData.empresas ?? []).slice(0, 5).map((e: { id: string; nome: string; cidade?: string | null }) => ({
            id: `empresa-${e.id}`,
            label: e.nome,
            sublabel: e.cidade || undefined,
            href: `/empresas/${e.id}`,
            icon: Building2,
            group: "Empresas",
          })),
          ...(negociosData.negocios ?? []).slice(0, 5).map((n: { id: string; titulo: string; leadEmpresa?: string | null }) => ({
            id: `negocio-${n.id}`,
            label: n.titulo,
            sublabel: n.leadEmpresa || undefined,
            href: `/negocios/${n.id}`,
            icon: Kanban,
            group: "Negócios",
          })),
          ...(propostasData.propostas ?? []).slice(0, 5).map((p: { id: string; numero: number; leadNome?: string | null }) => ({
            id: `proposta-${p.id}`,
            label: `Proposta #${p.numero}`,
            sublabel: p.leadNome || undefined,
            href: `/propostas/${p.id}`,
            icon: FileText,
            group: "Propostas",
          })),
          ...(tarefasData.tarefas ?? []).slice(0, 5).map((t: { id: string; titulo: string; negocioId?: string | null; leadId?: string | null }) => ({
            id: `tarefa-${t.id}`,
            label: t.titulo,
            sublabel: "Atividade",
            // Mesmo fix do grupo "Pessoas" acima — /contatos-legado/${id} nunca existiu como rota.
            href: t.negocioId ? `/negocios/${t.negocioId}` : t.leadId ? `/contatos/${t.leadId}` : "/tarefas",
            icon: CheckCircle2,
            group: "Atividades",
          })),
          // Grupo "Clientes" (19/08) — Empresa com serviço ativo no
          // portfólio (carteira real), distinto de "Empresas" (diretório
          // genérico, inclui prospect/ex-cliente/nunca-cliente). Leva pro
          // Customer 360 novo (/clientes/:id), não pra listagem antiga de empresas.
          ...(clientesData.clientes ?? []).slice(0, 5).map((cli: { id: string; nome: string; familias?: string[] | null }) => ({
            id: `cliente-${cli.id}`,
            label: cli.nome,
            sublabel: (cli.familias ?? []).filter(Boolean).join(" · ") || "Cliente",
            href: `/clientes/${cli.id}`,
            icon: UserCheck,
            group: "Clientes",
          })),
        ];
        setEntityResults(results);
      } catch {
        // AbortError esperado quando a query muda antes da resposta.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const filtered = query.trim() ? [...entityResults, ...filteredEstaticos] : ESTATICOS;

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setEntityResults([]);
  }, []);

  const navigate = useCallback((href: string) => {
    handleClose();
    router.push(href);
  }, [handleClose, router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) handleClose(); else handleOpen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleOpen, handleClose]);

  useEffect(() => {
    function onCustomOpen() { handleOpen(); }
    window.addEventListener("open-command-palette", onCustomOpen);
    return () => window.removeEventListener("open-command-palette", onCustomOpen);
  }, [handleOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); handleClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => (p + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => (p - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Enter") { e.preventDefault(); if (filtered[selectedIndex]) navigate(filtered[selectedIndex].href); return; }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, selectedIndex, navigate, handleClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100]" style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }} onClick={handleClose} />
      <div
        className="fixed z-[101] top-[16%] left-1/2 -translate-x-1/2 w-full max-w-[520px] mx-4 sm:mx-0 overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          {searching ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: "var(--cf2-text-tertiary)" }} /> : <Search className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pessoas, empresas, negócios, propostas, atividades..." aria-label="Buscar pessoas, empresas, negócios, propostas, atividades"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--cf2-text-primary)" }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2 px-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum resultado encontrado</p>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              const isSelected = i === selectedIndex;
              const prevGroup = i > 0 ? filtered[i - 1].group : undefined;
              const showGroupHeader = cmd.group && cmd.group !== prevGroup;
              return (
                <div key={cmd.id}>
                  {showGroupHeader && <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>{cmd.group}</p>}
                  <button
                    onClick={() => navigate(cmd.href)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                    style={{ background: isSelected ? "var(--cf2-bg-surface-muted)" : "transparent" }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: isSelected ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}>
                      <Icon className="w-4 h-4" style={{ color: isSelected ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }} />
                    </div>
                    <span className="flex-1 text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>
                      {cmd.label}
                      {cmd.sublabel && <span style={{ color: "var(--cf2-text-tertiary)" }}> · {cmd.sublabel}</span>}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-center gap-4 px-4 py-2 text-[10px]" style={{ borderTop: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-tertiary)" }}>
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          <span>ESC fechar</span>
        </div>
      </div>
    </>
  );
}
