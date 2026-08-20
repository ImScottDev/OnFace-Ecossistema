"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Building2 } from "lucide-react";
import { Kpis, EmpresaLinha, PessoaLinha, RELACIONAMENTO_BADGE, STATUS_COMERCIAL_BADGE, brl, fmtData, iniciais } from "./types";
import { Cf2LeadDrawer } from "@/components/crm2/qualificacao/LeadDrawerCf2";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { Cf2NovaPessoaModal } from "./NovaPessoaModal";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

type Aba = "pessoas" | "empresas";
type StatusPessoaFiltro = "" | "leads" | "qualificacao" | "oportunidade" | "clientes" | "ex_clientes";
type StatusEmpresaFiltro = "" | "prospects" | "com_oportunidade" | "clientes" | "ex_clientes";
type DrawerAberto = { tipo: "lead" | "empresa" | "negocio"; id: string } | null;

const CHIPS_PESSOA: { key: StatusPessoaFiltro; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "leads", label: "Leads" },
  { key: "qualificacao", label: "Em qualificação" },
  { key: "oportunidade", label: "Em oportunidade" },
  { key: "clientes", label: "Clientes" },
  { key: "ex_clientes", label: "Ex-clientes" },
];

// "Parceiros" (pedido no spec) não entra — sem sinal real no schema hoje
// (nenhuma coluna/tabela marca empresa como parceira). Ver decisoes/2026-08-18-crm2-pessoa-empresa-vinculo.md.
const CHIPS_EMPRESA: { key: StatusEmpresaFiltro; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "prospects", label: "Prospects" },
  { key: "com_oportunidade", label: "Com oportunidade" },
  { key: "clientes", label: "Clientes" },
  { key: "ex_clientes", label: "Ex-clientes" },
];

async function buscarJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export function Cf2ContatosWorkspace() {
  const queryClient = useQueryClient();
  const { byId: usuariosById } = useOrgUsuarios();
  const [aba, setAba] = useState<Aba>("pessoas");
  const [busca, setBusca] = useState("");
  const [statusPessoa, setStatusPessoa] = useState<StatusPessoaFiltro>("");
  const [statusEmpresa, setStatusEmpresa] = useState<StatusEmpresaFiltro>("");
  const [pagina, setPagina] = useState(1);
  const [drawer, setDrawer] = useState<DrawerAberto>(null);
  const [modalNovaPessoa, setModalNovaPessoa] = useState(false);

  const { data: kpis } = useQuery<Kpis>({
    queryKey: ["cf2-contatos-kpis"],
    queryFn: () => buscarJson("/api/contatos-crm2/kpis"),
  });

  const { data: empresasResp, isLoading: carregandoEmpresas } = useQuery<{ empresas: EmpresaLinha[]; total: number; totalPages: number }>({
    queryKey: ["cf2-contatos-empresas", busca, statusEmpresa, pagina],
    queryFn: () => buscarJson(`/api/contatos-crm2/empresas?search=${encodeURIComponent(busca)}&status=${statusEmpresa}&page=${pagina}&limit=20`),
    enabled: aba === "empresas",
  });

  const { data: pessoasResp, isLoading: carregandoPessoas } = useQuery<{ pessoas: PessoaLinha[]; total: number; totalPages: number }>({
    queryKey: ["cf2-contatos-pessoas", busca, statusPessoa, pagina],
    queryFn: () => buscarJson(`/api/contatos-crm2/pessoas?search=${encodeURIComponent(busca)}&status=${statusPessoa}&page=${pagina}&limit=20`),
    enabled: aba === "pessoas",
  });

  function trocarAba(a: Aba) {
    setAba(a);
    setPagina(1);
  }

  const kpiCards = kpis
    ? [
        { label: "TOTAL DE PESSOAS", valor: kpis.totalPessoas, cor: "var(--cf2-text-primary)" },
        { label: "LEADS", valor: kpis.leads, cor: "var(--cf2-warning-text)" },
        { label: "CONTATOS", valor: kpis.contatos, cor: "#1e40af" },
        { label: "CLIENTES", valor: kpis.clientes, cor: "var(--cf2-success-text)" },
        { label: "EMPRESAS", valor: kpis.empresas, cor: "var(--cf2-text-primary)" },
      ]
    : [];

  const resp = aba === "empresas" ? empresasResp : pessoasResp;
  const carregando = aba === "empresas" ? carregandoEmpresas : carregandoPessoas;

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Contatos & Empresas</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Cadastro comercial universal — quem existe na base e qual a relação atual, independente do estágio. Carteira/pós-venda mora em Clientes.</p>
        </div>
        <button
          onClick={() => aba === "pessoas" && setModalNovaPessoa(true)}
          disabled={aba === "empresas"}
          title={aba === "empresas" ? "Criação de empresa ainda não disponível aqui" : undefined}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold disabled:opacity-40"
          style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
        >
          <Plus className="w-3.5 h-3.5" /> {aba === "empresas" ? "Nova Empresa" : "Nova Pessoa"}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3 shrink-0">
        {(kpiCards.length ? kpiCards : Array.from({ length: 5 })).map((k, i) => (
          <div key={i} className="flex flex-col gap-1.5 p-3.5 rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{k ? (k as { label: string }).label : "—"}</p>
            <p className="text-[22px] font-bold" style={{ color: k ? (k as { cor: string }).cor : "var(--cf2-text-primary)" }}>{k ? (k as { valor: number }).valor.toLocaleString("pt-BR") : "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {(["pessoas", "empresas"] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => trocarAba(a)}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold capitalize"
              style={{ background: aba === a ? "var(--cf2-bg-surface)" : "transparent", color: aba === a ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-3xl overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
        <div className="flex flex-col gap-3 p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              placeholder={aba === "empresas" ? "Buscar empresa, CNPJ, responsável..." : "Buscar por nome, empresa, e-mail..."}
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          {/* Chips de STATUS (nunca tipo — pessoa/empresa não trocam de identidade ao virar cliente) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(aba === "pessoas" ? CHIPS_PESSOA : CHIPS_EMPRESA).map((chip) => {
              const ativo = aba === "pessoas" ? statusPessoa === chip.key : statusEmpresa === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => { aba === "pessoas" ? setStatusPessoa(chip.key as StatusPessoaFiltro) : setStatusEmpresa(chip.key as StatusEmpresaFiltro); setPagina(1); }}
                  className="px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
                  style={{ background: ativo ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", color: ativo ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
          ) : aba === "empresas" ? (
            <TabelaEmpresas linhas={empresasResp?.empresas ?? []} onAbrir={(id) => setDrawer({ tipo: "empresa", id })} />
          ) : (
            <TabelaPessoas linhas={pessoasResp?.pessoas ?? []} onAbrir={(id) => setDrawer({ tipo: "lead", id })} />
          )}
        </div>

        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
            {resp ? `Mostrando ${(pagina - 1) * 20 + 1}-${Math.min(pagina * 20, resp.total)} de ${resp.total}` : "—"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
              style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((p) => (resp && p < resp.totalPages ? p + 1 : p))}
              disabled={!resp || pagina >= resp.totalPages}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
              style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              Próximo
            </button>
          </div>
        </div>
      </div>

      <Cf2LeadDrawer
        leadId={drawer?.tipo === "lead" ? drawer.id : null}
        open={drawer?.tipo === "lead"}
        onClose={() => setDrawer(null)}
        onOpenEmpresa={(id) => setDrawer({ tipo: "empresa", id })}
        onOpenNegocio={(id) => setDrawer({ tipo: "negocio", id })}
        usuariosById={usuariosById}
      />
      <EmpresaDrawer
        empresaId={drawer?.tipo === "empresa" ? drawer.id : null}
        open={drawer?.tipo === "empresa"}
        onClose={() => setDrawer(null)}
        onOpenLead={(id) => setDrawer({ tipo: "lead", id })}
        onOpenNegocio={(id) => setDrawer({ tipo: "negocio", id })}
      />
      <NegocioDrawer
        negocioId={drawer?.tipo === "negocio" ? drawer.id : null}
        open={drawer?.tipo === "negocio"}
        onClose={() => setDrawer(null)}
        onOpenLead={(id) => setDrawer({ tipo: "lead", id })}
        onOpenEmpresa={(id) => setDrawer({ tipo: "empresa", id })}
      />

      {modalNovaPessoa && (
        <Cf2NovaPessoaModal
          onClose={() => setModalNovaPessoa(false)}
          onCriada={(leadId) => {
            setModalNovaPessoa(false);
            queryClient.invalidateQueries({ queryKey: ["cf2-contatos-pessoas"] });
            queryClient.invalidateQueries({ queryKey: ["cf2-contatos-kpis"] });
            setDrawer({ tipo: "lead", id: leadId });
          }}
        />
      )}
    </div>
  );
}

function TabelaEmpresas({ linhas, onAbrir }: { linhas: EmpresaLinha[]; onAbrir: (id: string) => void }) {
  if (linhas.length === 0) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma empresa encontrada.</p>;
  return (
    <table className="w-full text-left">
      <thead>
        <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {["Empresa", "Pessoas", "Relacionamento", "Negócios", "Responsável", "Última atividade"].map((h) => (
            <th key={h} className="px-4 py-2.5 text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((e) => {
          const badge = RELACIONAMENTO_BADGE[e.relacionamento] || RELACIONAMENTO_BADGE.lead;
          return (
            <tr key={e.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }} onClick={() => onAbrir(e.id)}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-inverse)" }}>
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{e.nome}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{e.setor || "—"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{e.pessoas} pessoa{e.pessoas === 1 ? "" : "s"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
              </td>
              <td className="px-4 py-3">
                <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{e.negocios} negócio{e.negocios === 1 ? "" : "s"}</p>
                <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{brl(e.valor)}</p>
              </td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{e.responsavel_nome || "—"}</td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{fmtData(e.ultima_atividade)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TabelaPessoas({ linhas, onAbrir }: { linhas: PessoaLinha[]; onAbrir: (id: string) => void }) {
  if (linhas.length === 0) return <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma pessoa encontrada.</p>;
  return (
    <table className="w-full text-left">
      <thead>
        <tr style={{ background: "var(--cf2-bg-surface-muted)" }}>
          {["Pessoa", "Empresa", "Relacionamento", "Negócio", "Responsável", "Última interação", "Próxima atividade"].map((h) => (
            <th key={h} className="px-4 py-2.5 text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((p) => {
          const badge = STATUS_COMERCIAL_BADGE[p.status_comercial] || STATUS_COMERCIAL_BADGE.contato;
          return (
            <tr key={p.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }} onClick={() => onAbrir(p.id)}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center rounded-full shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <p className="text-[11px] font-extrabold" style={{ color: "var(--cf2-text-secondary)" }}>{iniciais(p.nome)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{p.email || "—"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{p.empresa_nome || "—"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
              </td>
              <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{p.negocios > 0 ? brl(p.negocio_valor) : "—"}</td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{p.responsavel_nome || "—"}</td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{fmtData(p.ultima_interacao)}</td>
              <td className="px-4 py-3 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{p.proxima_atividade ? new Date(p.proxima_atividade).toLocaleDateString("pt-BR") : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
