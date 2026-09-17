"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Search, Radar, UserPlus, Building2, Briefcase, MapPin, Users, Filter,
  ChevronDown, ChevronUp, Loader2, Check, AlertCircle, X, Download,
  Save, BookmarkPlus, Trash2, FolderOpen, DollarSign, Cpu,
} from "lucide-react";

const SENIORITIES = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
];

const DEPARTMENTS = [
  { value: "c_suite", label: "C-Suite" },
  { value: "engineering", label: "Engineering" },
  { value: "information_technology", label: "TI" },
  { value: "sales", label: "Vendas" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Finanças" },
  { value: "operations", label: "Operações" },
  { value: "human_resources", label: "RH" },
  { value: "product_management", label: "Produto" },
  { value: "design", label: "Design" },
  { value: "legal", label: "Jurídico" },
  { value: "support", label: "Suporte" },
];

const EMPLOYEE_RANGES = [
  { value: "1,10", label: "1-10" },
  { value: "11,20", label: "11-20" },
  { value: "21,50", label: "21-50" },
  { value: "51,100", label: "51-100" },
  { value: "101,200", label: "101-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1K" },
  { value: "1001,5000", label: "1K-5K" },
  { value: "5001,10000", label: "5K-10K" },
  { value: "10001,", label: "10K+" },
];

const REVENUE_RANGES = [
  { value: "0,1000000", label: "< $1M" },
  { value: "1000000,10000000", label: "$1M-$10M" },
  { value: "10000000,50000000", label: "$10M-$50M" },
  { value: "50000000,100000000", label: "$50M-$100M" },
  { value: "100000000,500000000", label: "$100M-$500M" },
  { value: "500000000,1000000000", label: "$500M-$1B" },
  { value: "1000000000,", label: "$1B+" },
];

const TECH_STACK = [
  { value: "salesforce", label: "Salesforce" },
  { value: "hubspot", label: "HubSpot" },
  { value: "wordpress_org", label: "WordPress" },
  { value: "shopify", label: "Shopify" },
  { value: "google_analytics", label: "Google Analytics" },
  { value: "aws", label: "AWS" },
  { value: "azure", label: "Azure" },
  { value: "google_cloud", label: "Google Cloud" },
  { value: "stripe", label: "Stripe" },
  { value: "slack", label: "Slack" },
  { value: "jira", label: "Jira" },
  { value: "zendesk", label: "Zendesk" },
  { value: "intercom", label: "Intercom" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "mailchimp", label: "Mailchimp" },
];

interface SearchPerson {
  id: string;
  first_name: string;
  last_name_obfuscated: string;
  title: string | null;
  headline: string | null;
  has_email: boolean;
  has_direct_phone: string;
  organization: {
    name: string;
    has_employee_count: boolean;
  };
}

interface SavedSearch {
  id: string;
  nome: string;
  filtros: {
    keywords?: string;
    titles?: string;
    personName?: string;
    notTitles?: string;
    seniorities?: string[];
    departments?: string[];
    locations?: string;
    orgDomains?: string;
    orgName?: string;
    employeeRanges?: string[];
    revenueRanges?: string[];
    techStack?: string[];
  };
}

function MultiSelect({ options, selected, onChange, label, icon: Icon }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
  icon: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)] text-sm text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)] transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
        <span className="flex-1 text-left truncate">
          {selected.length ? `${label} (${selected.length})` : label}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[#1A1D26] border border-[var(--cf2-border-default)] shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(
                  selected.includes(opt.value)
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value]
                );
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--cf2-bg-surface-muted)] transition-colors"
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selected.includes(opt.value) ? "bg-[var(--cf2-accent)] border-[var(--cf2-accent)]" : "border-[var(--cf2-border-default)]"}`}>
                {selected.includes(opt.value) && <Check className="w-2.5 h-2.5 text-[var(--cf2-text-primary)]" />}
              </div>
              <span className="text-[var(--cf2-text-secondary)]">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BuscaApollo() {
  // Search filters
  const [keywords, setKeywords] = useState("");
  const [titles, setTitles] = useState("");
  const [personName, setPersonName] = useState("");
  const [notTitles, setNotTitles] = useState("");
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [locations, setLocations] = useState("");
  const [orgDomains, setOrgDomains] = useState("");
  const [orgName, setOrgName] = useState("");
  const [employeeRanges, setEmployeeRanges] = useState<string[]>([]);
  const [revenueRanges, setRevenueRanges] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Results
  const [results, setResults] = useState<SearchPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);

  // Load saved searches on mount
  useEffect(() => {
    fetch("/api/apollo/saved-searches")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSavedSearches(Array.isArray(data) ? data : data.searches || []))
      .catch(() => {});
  }, []);

  // Search mutation
  const searchMut = useMutation({
    mutationFn: async (p: number) => {
      const body: Record<string, unknown> = { page: p, per_page: 25 };
      if (keywords) body.q_keywords = keywords;
      if (titles) body.person_titles = titles.split(",").map((t) => t.trim()).filter(Boolean);
      if (personName) body.q_person_name = personName;
      if (notTitles) body.person_not_titles = notTitles.split(",").map((t) => t.trim()).filter(Boolean);
      if (seniorities.length) body.person_seniorities = seniorities;
      if (departments.length) body.person_departments = departments;
      if (locations) body.person_locations = locations.split(",").map((l) => l.trim()).filter(Boolean);
      if (orgDomains) body.q_organization_domains = orgDomains;
      if (orgName) body.q_organization_name = orgName;
      if (employeeRanges.length) body.organization_num_employees_ranges = employeeRanges;
      if (revenueRanges.length) body.organization_revenue_ranges = revenueRanges;
      if (techStack.length) body.currently_using_any_of_technology_uids = techStack;

      const res = await fetch("/api/apollo/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail || err.error || "";
        if (res.status === 400 && detail.includes("API key")) {
          throw new Error("Apollo API key não configurada. Configure em Configurações > Integrações.");
        }
        if (detail.includes("free plan") || detail.includes("API_INACCESSIBLE")) {
          throw new Error("Busca de prospects requer plano pago do Apollo.io. Seu plano atual (free) só permite enriquecimento de leads existentes.");
        }
        throw new Error(err.error || "Erro na busca Apollo");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data.people || []);
      setTotal(data.total || 0);
    },
  });

  // Import mutation
  const importMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/apollo/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apolloIds: ids, origem: "apollo" }),
      });
      if (!res.ok) throw new Error("Erro ao importar");
      return res.json();
    },
    onSuccess: () => {
      setSelected(new Set());
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSelected(new Set());
    searchMut.mutate(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    searchMut.mutate(newPage);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.id)));
    }
  }

  async function handleSaveSearch() {
    if (!searchName.trim()) return;
    const filtros = {
      keywords, titles, personName, notTitles,
      seniorities, departments, locations,
      orgDomains, orgName, employeeRanges,
      revenueRanges, techStack,
    };
    try {
      const res = await fetch("/api/apollo/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: searchName.trim(), filtros }),
      });
      if (res.ok) {
        const saved = await res.json();
        setSavedSearches((prev) => [...prev, saved]);
        setSearchName("");
        setShowSaveDialog(false);
      }
    } catch {}
  }

  async function handleDeleteSearch(id: string) {
    try {
      const res = await fetch(`/api/apollo/saved-searches?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {}
  }

  function handleLoadSearch(search: SavedSearch) {
    const f = search.filtros;
    setKeywords(f.keywords || "");
    setTitles(f.titles || "");
    setPersonName(f.personName || "");
    setNotTitles(f.notTitles || "");
    setSeniorities(f.seniorities || []);
    setDepartments(f.departments || []);
    setLocations(f.locations || "");
    setOrgDomains(f.orgDomains || "");
    setOrgName(f.orgName || "");
    setEmployeeRanges(f.employeeRanges || []);
    setRevenueRanges(f.revenueRanges || []);
    setTechStack(f.techStack || []);
    setShowSavedDropdown(false);
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--cf2-accent)" }}>
            <Radar className="w-5 h-5 text-[var(--cf2-text-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--cf2-text-primary)]">Prospecção Apollo</h1>
            <p className="text-xs text-[var(--cf2-text-tertiary)] hidden sm:block">Busque e importe leads da base Apollo.io (275M+ contatos)</p>
          </div>
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => importMut.mutate(Array.from(selected))}
            disabled={importMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--cf2-text-primary)] transition-colors w-fit"
            style={{ background: "var(--cf2-accent)" }}
          >
            {importMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Importar {selected.size} selecionado{selected.size > 1 ? "s" : ""} ({selected.size} crédito{selected.size > 1 ? "s" : ""})
          </button>
        )}
      </div>

      {/* Import result banner */}
      {importMut.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Check className="w-4 h-4 text-[var(--cf2-success-text)]" />
          <span className="text-sm text-[var(--cf2-success-text)]">
            {(importMut.data as Record<string, number>).imported} leads importados com sucesso
            {(importMut.data as Record<string, number>).errors > 0 && ` (${(importMut.data as Record<string, number>).errors} erros)`}
          </span>
          <button onClick={() => importMut.reset()} className="ml-auto text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-primary)]"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Saved searches bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: saved searches dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSavedDropdown(!showSavedDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)] text-sm text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)] transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
            <span>Buscas salvas</span>
            {savedSearches.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--cf2-accent)]/20 text-[10px] text-[var(--cf2-accent)] font-medium">
                {savedSearches.length}
              </span>
            )}
            {showSavedDropdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showSavedDropdown && (
            <div className="absolute z-30 mt-1 w-72 max-h-60 overflow-y-auto rounded-lg bg-[#1A1D26] border border-[var(--cf2-border-default)] shadow-xl">
              {savedSearches.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[var(--cf2-text-tertiary)]">
                  Nenhuma busca salva
                </div>
              ) : (
                savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--cf2-bg-surface-muted)] transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSearch(s)}
                      className="flex-1 text-left text-sm text-[var(--cf2-text-secondary)] truncate"
                    >
                      {s.nome}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSearch(s.id);
                      }}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 text-[var(--cf2-danger-text)]/60 hover:text-[var(--cf2-danger-text)] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: save current search */}
        <div className="relative">
          {showSaveDialog ? (
            <div className="flex items-center gap-2">
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Nome da busca..." aria-label="Nome da busca"
                className="px-3 py-1.5 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)] text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)] w-48"
                onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveSearch}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--cf2-text-primary)] transition-colors"
                style={{ background: "var(--cf2-accent)" }}
              >
                <Save className="w-3.5 h-3.5" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveDialog(false); setSearchName(""); }}
                className="text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)] text-sm text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)] transition-colors"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
              <span>Salvar busca</span>
            </button>
          )}
        </div>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--cf2-text-secondary)] flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" /> Filtros de busca
          </span>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="text-xs text-[var(--cf2-accent)] hover:underline">
            {showFilters ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {showFilters && (
          <>
            {/* Row 1: Keywords + Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Palavras-chave</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <Search className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="cybersecurity, marketing..." aria-label="cybersecurity, marketing"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Cargos (separados por vírgula)</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={titles}
                    onChange={(e) => setTitles(e.target.value)}
                    placeholder="CEO, CTO, Diretor de TI..." aria-label="CEO, CTO, Diretor de TI"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Person Name + Excluded Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Nome da pessoa</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <UserPlus className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="John Smith..." aria-label="John Smith"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Excluir cargos (separados por vírgula)</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <X className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={notTitles}
                    onChange={(e) => setNotTitles(e.target.value)}
                    placeholder="Intern, Assistant..." aria-label="Intern, Assistant"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Seniority + Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MultiSelect options={SENIORITIES} selected={seniorities} onChange={setSeniorities} label="Senioridade" icon={Users} />
              <MultiSelect options={DEPARTMENTS} selected={departments} onChange={setDepartments} label="Departamento" icon={Briefcase} />
            </div>

            {/* Row 4: Location + Employee range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Localização (separados por vírgula)</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <MapPin className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                    placeholder="São Paulo, Brazil..." aria-label="São Paulo, Brazil"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
              <MultiSelect options={EMPLOYEE_RANGES} selected={employeeRanges} onChange={setEmployeeRanges} label="Nº Funcionários" icon={Building2} />
            </div>

            {/* Row 5: Org domain + Org name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Domínio da empresa</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <Building2 className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={orgDomains}
                    onChange={(e) => setOrgDomains(e.target.value)}
                    placeholder="empresa.com.br" aria-label="empresa.com.br"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--cf2-text-tertiary)] mb-1 block">Nome da empresa</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)]">
                  <Building2 className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ilikia, Eversafe..." aria-label="Ilikia, Eversafe"
                    className="flex-1 bg-transparent text-sm text-[var(--cf2-text-primary)] outline-none placeholder:text-[var(--cf2-text-tertiary)]"
                  />
                </div>
              </div>
            </div>

            {/* Row 6: Revenue Ranges + Tech Stack */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MultiSelect options={REVENUE_RANGES} selected={revenueRanges} onChange={setRevenueRanges} label="Receita" icon={DollarSign} />
              <MultiSelect options={TECH_STACK} selected={techStack} onChange={setTechStack} label="Tech Stack" icon={Cpu} />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={searchMut.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-[var(--cf2-text-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cf2-accent)]"
          style={{ background: "var(--cf2-accent)" }}
        >
          {searchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar no Apollo
        </button>
      </form>

      {/* Results */}
      {searchMut.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-[var(--cf2-danger-text)]" />
          <span className="text-sm text-[var(--cf2-danger-text)]">{(searchMut.error as Error)?.message || "Erro na busca. Verifique a API key."}</span>
        </div>
      )}

      {total > 0 && (
        <div className="space-y-2">
          {/* Results header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-[var(--cf2-text-secondary)]">
              {total.toLocaleString("pt-BR")} resultados encontrados
              {total > 25 && ` — página ${page} de ${totalPages}`}
            </span>
            <button onClick={selectAll} className="text-xs text-[var(--cf2-accent)] hover:underline">
              {selected.size === results.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>

          {/* Results table */}
          <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--cf2-border-default)]">
                  <th className="w-10 px-3 py-2.5"></th>
                  <th className="text-left text-[11px] font-medium text-[var(--cf2-text-tertiary)] uppercase tracking-wider px-3 py-2.5">Nome</th>
                  <th className="text-left text-[11px] font-medium text-[var(--cf2-text-tertiary)] uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Cargo</th>
                  <th className="text-left text-[11px] font-medium text-[var(--cf2-text-tertiary)] uppercase tracking-wider px-3 py-2.5">Empresa</th>
                  <th className="text-center text-[11px] font-medium text-[var(--cf2-text-tertiary)] uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Email</th>
                  <th className="text-center text-[11px] font-medium text-[var(--cf2-text-tertiary)] uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {results.map((person) => (
                  <tr
                    key={person.id}
                    className={`border-b border-[var(--cf2-border-default)] transition-colors cursor-pointer ${selected.has(person.id) ? "bg-[var(--cf2-accent)]/10" : "hover:bg-[var(--cf2-bg-surface)]"}`}
                    onClick={() => toggleSelect(person.id)}
                  >
                    <td className="px-3 py-2.5">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.has(person.id) ? "bg-[var(--cf2-accent)] border-[var(--cf2-accent)]" : "border-[var(--cf2-border-default)]"}`}>
                        {selected.has(person.id) && <Check className="w-2.5 h-2.5 text-[var(--cf2-text-primary)]" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-[var(--cf2-text-secondary)] bg-[var(--cf2-bg-surface-muted)]">
                          {person.first_name[0]}{person.last_name_obfuscated?.[0] || ""}
                        </div>
                        <span className="text-sm text-[var(--cf2-text-primary)]">
                          {person.first_name} {person.last_name_obfuscated}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-[var(--cf2-text-secondary)] truncate block max-w-[200px]">{person.title || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-[var(--cf2-text-secondary)]">{person.organization?.name || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center hidden md:table-cell">
                      {person.has_email ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Tem email" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--cf2-bg-surface-muted)]" title="Sem email" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center hidden md:table-cell">
                      {person.has_direct_phone === "Yes" ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Tem telefone" />
                      ) : person.has_direct_phone?.includes("Maybe") ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Talvez" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--cf2-bg-surface-muted)]" title="Sem telefone" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="px-3 py-1.5 rounded text-xs text-[var(--cf2-text-secondary)] bg-[var(--cf2-bg-surface-muted)] hover:bg-[var(--cf2-bg-surface-muted)] disabled:opacity-30"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const p = page <= 5 ? i + 1 : page + i - 4;
                if (p > totalPages || p < 1) return null;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-8 h-8 rounded text-xs font-medium ${p === page ? "bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)]" : "text-[var(--cf2-text-secondary)] bg-[var(--cf2-bg-surface-muted)] hover:bg-[var(--cf2-bg-surface-muted)]"}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="px-3 py-1.5 rounded text-xs text-[var(--cf2-text-secondary)] bg-[var(--cf2-bg-surface-muted)] hover:bg-[var(--cf2-bg-surface-muted)] disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searchMut.isPending && total === 0 && searchMut.isSuccess && (
        <div className="text-center py-16">
          <Radar className="w-12 h-12 text-[var(--cf2-text-tertiary)]/40 mx-auto mb-3" aria-hidden />
          <p className="text-sm text-[var(--cf2-text-tertiary)]">Nenhum resultado encontrado</p>
          <p className="text-xs text-[var(--cf2-text-tertiary)] mt-1">Tente ajustar os filtros</p>
        </div>
      )}

      {/* Initial state */}
      {!searchMut.isPending && !searchMut.isSuccess && !searchMut.isError && (
        <div className="text-center py-16">
          <Radar className="w-16 h-16 text-[var(--cf2-text-tertiary)]/40 mx-auto mb-4" aria-hidden />
          <p className="text-lg font-medium text-[var(--cf2-text-tertiary)]">Busque leads na base do Apollo.io</p>
          <p className="text-sm text-[var(--cf2-text-secondary)] mt-1 max-w-md mx-auto">
            Use os filtros acima para encontrar decisores por cargo, senioridade, localização, indústria e mais.
            Selecione os resultados e importe direto no CRM.
          </p>
        </div>
      )}
    </div>
  );
}
