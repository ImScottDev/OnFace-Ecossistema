"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Building2 } from "lucide-react";
import { Kpis, EmpresaLinha, PessoaLinha, RELACIONAMENTO_BADGE, TIPO_BADGE, brl, fmtData, iniciais } from "./types";

type Aba = "pessoas" | "empresas";
type TipoFiltro = "" | "contato" | "lead" | "cliente";

async function buscarJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export function Cf2ContatosWorkspace() {
  const [aba, setAba] = useState<Aba>("pessoas");
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("");
  const [pagina, setPagina] = useState(1);

  const { data: kpis } = useQuery<Kpis>({
    queryKey: ["cf2-contatos-kpis"],
    queryFn: () => buscarJson("/api/contatos-crm2/kpis"),
  });

  const { data: empresasResp, isLoading: carregandoEmpresas } = useQuery<{ empresas: EmpresaLinha[]; total: number; totalPages: number }>({
    queryKey: ["cf2-contatos-empresas", busca, pagina],
    queryFn: () => buscarJson(`/api/contatos-crm2/empresas?search=${encodeURIComponent(busca)}&page=${pagina}&limit=20`),
    enabled: aba === "empresas",
  });

  const { data: pessoasResp, isLoading: carregandoPessoas } = useQuery<{ pessoas: PessoaLinha[]; total: number; totalPages: number }>({
    queryKey: ["cf2-contatos-pessoas", busca, tipoFiltro, pagina],
    queryFn: () => buscarJson(`/api/contatos-crm2/pessoas?search=${encodeURIComponent(busca)}&tipo=${tipoFiltro}&page=${pagina}&limit=20`),
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
          <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Contatos & Clientes</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Gerencie seus relacionamentos e contas em um só lugar</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold"
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
        <div className="flex items-center gap-3 p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              placeholder={aba === "empresas" ? "Buscar empresa, segmento, responsável..." : "Buscar por nome, empresa, e-mail..."}
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          {aba === "pessoas" && (
            <select
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value as TipoFiltro); setPagina(1); }}
              className="px-3 py-2 rounded-xl text-[12px] font-semibold outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            >
              <option value="">Todos</option>
              <option value="cliente">Cliente</option>
              <option value="lead">Lead</option>
              <option value="contato">Contato</option>
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
          ) : aba === "empresas" ? (
            <TabelaEmpresas linhas={empresasResp?.empresas ?? []} />
          ) : (
            <TabelaPessoas linhas={pessoasResp?.pessoas ?? []} />
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
    </div>
  );
}

function TabelaEmpresas({ linhas }: { linhas: EmpresaLinha[] }) {
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
          const badge = RELACIONAMENTO_BADGE[e.relacionamento];
          return (
            <tr key={e.id} className="cursor-pointer" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
              <td className="px-4 py-3">
                <a href={`/empresas/${e.id}`} className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-inverse)" }}>
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{e.nome}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{e.setor || "—"}</p>
                  </div>
                </a>
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

function TabelaPessoas({ linhas }: { linhas: PessoaLinha[] }) {
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
          const badge = TIPO_BADGE[p.tipo];
          return (
            <tr key={p.id} style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
              <td className="px-4 py-3">
                <a href={`/contatos-legado/${p.id}`} className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center rounded-full shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    <p className="text-[11px] font-extrabold" style={{ color: "var(--cf2-text-secondary)" }}>{iniciais(p.nome)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{p.nome}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{p.email || "—"}</p>
                  </div>
                </a>
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
