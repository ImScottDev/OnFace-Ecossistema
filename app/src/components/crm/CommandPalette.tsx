"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  Kanban,
  MessageCircle,
  Mail,
  Briefcase,
  FileText,
  BarChart3,
  Settings,
  Search,
  Building2,
  ClipboardList,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  group?: string;
}

const commands: CommandItem[] = [
  { id: "dashboard", label: "Meu Dia", href: "/dashboard", icon: Home, shortcut: "D", keywords: ["home", "inicio"] },
  { id: "contatos", label: "Contatos", href: "/contatos", icon: Users, shortcut: "L", keywords: ["leads", "prospects", "clientes"] },
  { id: "empresas", label: "Empresas", href: "/empresas", icon: Building2, shortcut: "E", keywords: ["companies", "organizacoes"] },
  { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: Kanban, shortcut: "P", keywords: ["kanban", "funil"] },
  { id: "propostas", label: "Propostas", href: "/propostas", icon: ClipboardList, keywords: ["proposals"] },
  { id: "whatsapp", label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, shortcut: "W", keywords: ["chat", "mensagens"] },
  { id: "email", label: "Email", href: "/email", icon: Mail, keywords: ["correio", "mensagem"] },
  { id: "carteira", label: "Carteira", href: "/carteira", icon: Briefcase, shortcut: "C", keywords: ["clientes", "ativos", "portfolio"] },
  { id: "contratos", label: "Contratos", href: "/contratos", icon: FileText, keywords: ["agreements"] },
  { id: "relatorios", label: "Relatórios", href: "/relatorios", icon: BarChart3, shortcut: "R", keywords: ["reports", "analytics"] },
  { id: "configuracoes", label: "Configurações", href: "/configuracoes", icon: Settings, keywords: ["settings", "preferencias"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entityResults, setEntityResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filteredCommands = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.id.includes(q) ||
          cmd.keywords?.some((kw) => kw.includes(q))
        );
      })
    : commands;

  // Busca global real: antes disso, Cmd+K só navegava por uma lista fixa de
  // páginas — nenhuma entidade (lead/empresa/negócio) era buscável por aqui,
  // mesmo com os endpoints de busca já existindo (leads.ts/empresas.ts/
  // negocios.ts todos aceitam ?search=). Reaproveita esses 3 endpoints reais
  // em paralelo em vez de criar um endpoint agregado novo.
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
        const [leadsRes, empresasRes, negociosRes] = await Promise.all([
          fetch(`/api/leads?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
          fetch(`/api/empresas?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
          fetch(`/api/negocios?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
        ]);
        const [leadsData, empresasData, negociosData] = await Promise.all([
          leadsRes.ok ? leadsRes.json() : { leads: [] },
          empresasRes.ok ? empresasRes.json() : { empresas: [] },
          negociosRes.ok ? negociosRes.json() : { negocios: [] },
        ]);
        const results: CommandItem[] = [
          ...(leadsData.leads || []).map((l: { id: string; nome: string; empresa?: string | null }) => ({
            id: `lead-${l.id}`,
            label: l.nome,
            sublabel: l.empresa || undefined,
            href: `/contatos/${l.id}`,
            icon: Users,
            group: "Contatos",
          })),
          ...(empresasData.empresas || []).map((e: { id: string; nome: string; cidade?: string | null }) => ({
            id: `empresa-${e.id}`,
            label: e.nome,
            sublabel: e.cidade || undefined,
            href: `/empresas/${e.id}`,
            icon: Building2,
            group: "Empresas",
          })),
          ...(negociosData.negocios || []).map((n: { id: string; titulo: string; leadEmpresa?: string | null }) => ({
            id: `negocio-${n.id}`,
            label: n.titulo,
            sublabel: n.leadEmpresa || undefined,
            href: `/negocios/${n.id}`,
            icon: Kanban,
            group: "Negócios",
          })),
        ];
        setEntityResults(results);
      } catch {
        // AbortError esperado quando a query muda antes da resposta — ignora.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const filtered = [...filteredCommands, ...entityResults];

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

  const navigate = useCallback(
    (href: string) => {
      handleClose();
      router.push(href);
    },
    [handleClose, router]
  );

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          handleClose();
        } else {
          handleOpen();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleOpen, handleClose]);

  // Custom event from topbar search button
  useEffect(() => {
    function onCustomOpen() {
      handleOpen();
    }
    window.addEventListener("open-command-palette", onCustomOpen);
    return () => window.removeEventListener("open-command-palette", onCustomOpen);
  }, [handleOpen]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          navigate(filtered[selectedIndex].href);
        }
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, selectedIndex, navigate, handleClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={handleClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-[101] top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[480px] mx-4 sm:mx-0 overflow-hidden rounded-xl shadow-2xl"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              {searching ? (
                <Loader2 className="w-4 h-4 text-white/30 shrink-0 animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-white/30 shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar contatos, empresas, negócios ou navegar..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
              <kbd
                className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2 px-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-white/30">
                  Nenhum resultado encontrado
                </div>
              ) : (
                filtered.map((cmd, i) => {
                  const Icon = cmd.icon;
                  const isSelected = i === selectedIndex;
                  const prevGroup = i > 0 ? filtered[i - 1].group : undefined;
                  const showGroupHeader = cmd.group && cmd.group !== prevGroup;
                  return (
                    <div key={cmd.id}>
                      {showGroupHeader && (
                        <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/25">{cmd.group}</p>
                      )}
                      <button
                      onClick={() => navigate(cmd.href)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                      style={{
                        background: isSelected ? "rgba(108,92,231,0.12)" : "transparent",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: isSelected
                            ? "rgba(108,92,231,0.2)"
                            : "rgba(255,255,255,0.04)",
                        }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{
                            color: isSelected ? "#e23752" : "rgba(255,255,255,0.4)",
                          }}
                        />
                      </div>
                      <span
                        className="flex-1 text-sm truncate"
                        style={{
                          color: isSelected ? "#fff" : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {cmd.label}
                        {cmd.sublabel && <span className="text-white/25"> · {cmd.sublabel}</span>}
                      </span>
                      {cmd.shortcut && (
                        <kbd
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.2)",
                          }}
                        >
                          {isMac ? "\u2318" : "Ctrl+"}
                          {cmd.shortcut}
                        </kbd>
                      )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div
              className="flex items-center justify-center gap-4 px-4 py-2 text-[10px] text-white/20"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span>
                <kbd className="px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                  &uarr;&darr;
                </kbd>{" "}
                navegar
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                  Enter
                </kbd>{" "}
                abrir
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                  ESC
                </kbd>{" "}
                fechar
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
