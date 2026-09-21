"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, ExternalLink, AlertTriangle } from "lucide-react";

interface VendaFechada {
  negocioId: string; ganhoAt: string | null; empresaId: string | null; empresaNome: string | null;
  contatoId: string | null; contatoNome: string | null; contatoEmail: string | null;
  closerId: string | null; closerNome: string | null; sdrId: string | null; sdrNome: string | null; sdrEvidencia: string;
  origem: string | null; serviceFamily: string | null; produtos: string[]; tipoReceita: string | null;
  mrrFechado: number; valorTotal: number; valorSetup: number; status: string;
  propostaId: string | null; propostaNumero: number | null; propostaStatus: string | null;
  contratoId: string | null; contratoStatus: string | null; contratoZohoId: string | null;
  stripeSubscriptionId: string | null; stripeCustomerId: string | null; faturaHostedUrl: string | null;
}
interface AgendaRealizada {
  leadId: string; leadNome: string | null; empresaNome: string | null; sdrId: string | null; sdrNome: string | null;
  agendadaEm: string | null; realizadaEm: string | null; tipoEvento: string | null;
  negocioId: string | null; negocioTitulo: string | null; closerId: string | null; closerNome: string | null;
  resultadoAtual: string | null; vendaRelacionada: boolean;
}
interface VendaAtribuidaSdr {
  negocioId: string; sdrId: string | null; sdrNome: string | null; closerId: string | null; closerNome: string | null;
  empresaNome: string | null; ganhoAt: string | null; valor: number; serviceFamily: string | null; origemAtribuicao: string;
}
interface Resumo {
  totalVendido: number; quantidadeVendas: number;
  porCloser: { closerId: string; nome: string; total: number; qtd: number }[];
  porSdr: { sdrId: string; nome: string; agendadas: number; realizadas: number }[];
  vendasComSdrIdentificavel: number; vendasComStripe: number; vendasComComprovante: number; vendasComContrato: number; vendasComEmpresa: number; vendasComInformacaoIncompleta: number;
}
interface Opcoes {
  closers: { id: string; nome: string }[];
  sdrs: { id: string; nome: string }[];
  familias: string[];
  empresas: { id: string; nome: string }[];
}
interface FechamentoData { periodo: { since: string; until: string }; resumo: Resumo; vendas: VendaFechada[]; agendas: AgendaRealizada[]; atribuidas: VendaAtribuidaSdr[]; opcoes: Opcoes }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataFmt = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

/**
 * Financeiro → Fechamento Comercial (20/08, URGENTE — fechamento de julho/2026).
 * Regra de ouro: rastreabilidade > estética — toda linha leva de volta ao
 * registro original. "Não disponível" nunca é escondido nem inventado.
 * Mesma janela/regra de receita da aba Comercial/Meu desempenho — os totais
 * batem de propósito (ver lib/relatorios/fechamento-comercial.ts).
 */
export default function TabFechamentoComercial({ periodo }: { periodo: string }) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<"vendas" | "agendas" | "atribuidas">("vendas");
  const [closerId, setCloserId] = useState("");
  const [sdrId, setSdrId] = useState("");
  const [familia, setFamilia] = useState("");
  const [empresaId, setEmpresaId] = useState("");

  const filtroQs = new URLSearchParams({
    periodo,
    ...(closerId ? { closerId } : {}),
    ...(sdrId ? { sdrId } : {}),
    ...(familia ? { familia } : {}),
    ...(empresaId ? { empresaId } : {}),
  }).toString();

  const { data, isLoading } = useQuery<FechamentoData>({
    queryKey: ["relatorios", "fechamento-comercial", periodo, closerId, sdrId, familia, empresaId],
    queryFn: () => fetch(`/api/relatorios/fechamento-comercial?${filtroQs}`).then((r) => r.json()),
  });

  const exportar = () => {
    window.open(`/api/relatorios/fechamento-comercial/export?${filtroQs}`, "_blank");
  };

  const selectCls = "px-2.5 py-1.5 rounded-lg text-[12px] outline-none [color-scheme:dark]";
  const selectStyle = { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" };

  if (isLoading) return <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 text-center text-[12px] text-white/40">Carregando…</div>;
  if (!data) return null;

  const r = data.resumo;
  const o = data.opcoes;

  return (
    <div className="space-y-4">
      {/* Filtros — Closer/SDR/Família/Empresa (Período já é o seletor global da página) */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={closerId} onChange={(e) => setCloserId(e.target.value)} className={selectCls} style={selectStyle}>
          <option value="">Todos os closers</option>
          {o.closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={sdrId} onChange={(e) => setSdrId(e.target.value)} className={selectCls} style={selectStyle}>
          <option value="">Todos os SDRs</option>
          {o.sdrs.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={familia} onChange={(e) => setFamilia(e.target.value)} className={selectCls} style={selectStyle}>
          <option value="">Todas as famílias</option>
          {o.familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={selectCls} style={selectStyle}>
          <option value="">Todas as empresas</option>
          {o.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {(closerId || sdrId || familia || empresaId) && (
          <button onClick={() => { setCloserId(""); setSdrId(""); setFamilia(""); setEmpresaId(""); }} className="text-[11px] text-white/40 hover:text-white/70 underline">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Resumo — cards simples, a tabela é o que importa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Total vendido</p>
          <p className="text-2xl font-bold text-[#c8ff00] mt-2" style={{ fontFamily: "var(--font-heading)" }}>{brl(r.totalVendido)}</p>
          <p className="text-[10px] text-white/25 mt-1">{r.quantidadeVendas} venda(s)</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Com SDR identificável</p>
          <p className="text-2xl font-bold text-white mt-2" style={{ fontFamily: "var(--font-heading)" }}>{r.vendasComSdrIdentificavel}/{r.quantidadeVendas}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Com Stripe / Comprovante / Contrato</p>
          <p className="text-2xl font-bold text-white mt-2" style={{ fontFamily: "var(--font-heading)" }}>{r.vendasComStripe} / {r.vendasComComprovante} / {r.vendasComContrato}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Informação incompleta</p>
          <p className="text-2xl font-bold mt-2" style={{ fontFamily: "var(--font-heading)", color: r.vendasComInformacaoIncompleta > 0 ? "#F59E0B" : "white" }}>{r.vendasComInformacaoIncompleta}</p>
        </div>
      </div>

      {r.porCloser.length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-2">Por closer</p>
          <div className="flex flex-wrap gap-4">
            {r.porCloser.sort((a, b) => b.total - a.total).map((cl) => (
              <div key={cl.closerId} className="text-[12px]"><span className="text-white/70">{cl.nome}</span> <span className="text-white font-bold">{brl(cl.total)}</span> <span className="text-white/30">({cl.qtd})</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-abas dos 3 blocos */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-full border border-white/[0.08]" style={{ background: "rgba(255,255,255,0.04)" }}>
          {[
            { key: "vendas" as const, label: `Vendas fechadas (${data.vendas.length})` },
            { key: "agendas" as const, label: `Agendas realizadas (${data.agendas.length})` },
            { key: "atribuidas" as const, label: `Atribuídas a SDR (${data.atribuidas.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className="px-3.5 py-1.5 text-[12px] font-medium rounded-full transition-colors whitespace-nowrap"
              style={subTab === t.key ? { background: "#F5F5F5", color: "#0A0A0A" } : { color: "rgba(255,255,255,0.5)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={exportar} title="Exporta as 3 abas (Vendas/Agendas/Atribuídas) num único .xlsx, com o mesmo filtro aplicado na tela" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white/[0.06] text-white hover:bg-white/[0.1]">
          <Download className="w-3.5 h-3.5" /> Exportar planilha (.xlsx — todas as abas)
        </button>
      </div>

      {subTab === "vendas" && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40">
                {["Data", "Empresa", "Contato", "Closer", "SDR", "Família", "Valor", "Proposta", "Contrato", "Comprovante"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.vendas.map((v) => (
                <tr
                  key={v.negocioId}
                  onClick={() => router.push(`/negocios/${v.negocioId}`)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.05] cursor-pointer"
                  title="Abrir oportunidade"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-white/60">{dataFmt(v.ganhoAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white font-medium">{v.empresaNome ?? <span className="text-white/30">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/70">{v.contatoNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/70">{v.closerNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap" title={v.sdrEvidencia}>
                    {v.sdrNome ?? <span className="text-amber-400/70 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Não disponível</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/50">{v.serviceFamily ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-[#c8ff00] font-semibold">{brl((v.tipoReceita === "avulso" || v.tipoReceita === "projeto") ? v.valorTotal : v.mrrFechado)}</td>
                  <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {v.propostaNumero ? <Link href={`/propostas/${v.propostaId}`} className="text-white/60 hover:underline">#{v.propostaNumero}</Link> : "Não disponível"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/50">
                    {v.contratoId ? (v.contratoZohoId ? "histórico (Zoho)" : v.contratoStatus) : "Não disponível"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {v.faturaHostedUrl ? (
                      <a href={v.faturaHostedUrl} target="_blank" rel="noreferrer" className="text-[#c8ff00] hover:text-white flex items-center gap-1">
                        Comprovante <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : v.stripeSubscriptionId || v.stripeCustomerId ? (
                      <a
                        href={v.stripeSubscriptionId ? `https://dashboard.stripe.com/subscriptions/${v.stripeSubscriptionId}` : `https://dashboard.stripe.com/customers/${v.stripeCustomerId}`}
                        target="_blank" rel="noreferrer" className="text-white/60 hover:text-white flex items-center gap-1"
                        title="Sem fatura com link de comprovante — abre o painel Stripe"
                      >
                        {v.stripeSubscriptionId ? "Subscription" : "Customer"} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : "Não disponível"}
                  </td>
                </tr>
              ))}
              {data.vendas.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-white/30">Nenhuma venda no período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subTab === "agendas" && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40">
                {["Agendada em", "Lead", "Empresa", "SDR", "Realizada", "Closer", "Resultado atual", "Venda?"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.agendas.map((a) => (
                <tr
                  key={`${a.leadId}-${a.agendadaEm}`}
                  onClick={() => router.push(`/leads/${a.leadId}`)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.05] cursor-pointer"
                  title="Abrir lead"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-white/60">{dataFmt(a.agendadaEm)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white font-medium">{a.leadNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/70">{a.empresaNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/70">{a.sdrNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.realizadaEm ? <span className="text-emerald-400/80">{dataFmt(a.realizadaEm)}</span> : <span className="text-white/30">não</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/60">{a.closerNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/50">{a.resultadoAtual ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.vendaRelacionada ? <span className="text-[#c8ff00]">sim</span> : "não"}</td>
                </tr>
              ))}
              {data.agendas.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-white/30">Nenhuma agenda no período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subTab === "atribuidas" && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
          <p className="px-3 pt-3 text-[11px] text-white/35">Vendas cujo evento de agendamento mostra um SDR diferente do closer que fechou — fato exposto, não regra de comissão.</p>
          <table className="w-full text-left text-[12px] mt-2">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40">
                {["Ganho em", "SDR", "Closer", "Empresa", "Valor", "Família", "Evidência"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.atribuidas.map((v) => (
                <tr
                  key={v.negocioId}
                  onClick={() => router.push(`/negocios/${v.negocioId}`)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.05] cursor-pointer"
                  title="Abrir oportunidade"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-white/60">{dataFmt(v.ganhoAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/70">{v.sdrNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/70">{v.closerNome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white font-medium">{v.empresaNome ?? <span className="text-white/30">—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-[#c8ff00] font-semibold">{brl(v.valor)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/50">{v.serviceFamily ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-white/40">{v.origemAtribuicao}</td>
                </tr>
              ))}
              {data.atribuidas.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-white/30">Nenhuma venda atribuída a SDR no período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
