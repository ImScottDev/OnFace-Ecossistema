"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink } from "lucide-react";
import { moedaExata } from "@/components/onface/vendas/formato";
import { Radiogroup } from "@/components/onface/ds/escolha";

/**
 * Fechamento Comercial — aba restaurada.
 *
 * Existia no shell legado (Financeiro fechando julho/2026, 20/08) e sumiu na
 * migração para o CRM2, embora a API continuasse viva:
 * GET /api/relatorios/fechamento-comercial (+ /export em .xlsx). Gate no Hono:
 * admin/gestão/leitor; o menu só mostra a aba para esses papéis.
 *
 * Regra de ouro herdada: rastreabilidade > estética. Toda linha leva ao
 * registro original e o que não tem evidência aparece como "Não disponível",
 * nunca escondido nem inventado. Mesma regra de receita da aba Comercial
 * (recorrente = mrr_fechado, avulso/projeto = valor_total): os totais batem.
 */

interface VendaFechada {
  negocioId: string; ganhoAt: string | null; empresaId: string | null; empresaNome: string | null;
  contatoId: string | null; contatoNome: string | null;
  closerNome: string | null; sdrNome: string | null; sdrEvidencia: string;
  serviceFamily: string | null; tipoReceita: string | null;
  mrrFechado: number; valorTotal: number;
  propostaId: string | null; propostaNumero: number | null;
  contratoId: string | null; contratoStatus: string | null; contratoZohoId: string | null;
  stripeSubscriptionId: string | null; stripeCustomerId: string | null; faturaHostedUrl: string | null;
}
interface AgendaRealizada {
  leadId: string; leadNome: string | null; empresaNome: string | null; sdrNome: string | null;
  agendadaEm: string | null; realizadaEm: string | null;
  closerNome: string | null; resultadoAtual: string | null; vendaRelacionada: boolean;
}
interface VendaAtribuidaSdr {
  negocioId: string; sdrNome: string | null; closerNome: string | null;
  empresaNome: string | null; ganhoAt: string | null; valor: number; serviceFamily: string | null; origemAtribuicao: string;
}
interface FechamentoData {
  resumo: {
    totalVendido: number; quantidadeVendas: number;
    porCloser: { closerId: string; nome: string; total: number; qtd: number }[];
    vendasComSdrIdentificavel: number; vendasComStripe: number; vendasComComprovante: number;
    vendasComContrato: number; vendasComInformacaoIncompleta: number;
  };
  vendas: VendaFechada[]; agendas: AgendaRealizada[]; atribuidas: VendaAtribuidaSdr[];
  opcoes: { closers: { id: string; nome: string }[]; sdrs: { id: string; nome: string }[]; familias: string[]; empresas: { id: string; nome: string }[] };
}

const data = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const valorDaVenda = (v: VendaFechada) => (v.tipoReceita === "avulso" || v.tipoReceita === "projeto" ? v.valorTotal : v.mrrFechado);
const ND = <span className="ins-falta">Não disponível</span>;

export function TabFechamento({ periodo }: { periodo: string }) {
  const [sub, setSub] = useState<"vendas" | "agendas" | "atribuidas">("vendas");
  const [closerId, setCloserId] = useState("");
  const [sdrId, setSdrId] = useState("");
  const [familia, setFamilia] = useState("");
  const [empresaId, setEmpresaId] = useState("");

  const qs = new URLSearchParams({
    periodo,
    ...(closerId ? { closerId } : {}),
    ...(sdrId ? { sdrId } : {}),
    ...(familia ? { familia } : {}),
    ...(empresaId ? { empresaId } : {}),
  }).toString();

  const { data: d, isLoading, isError } = useQuery<FechamentoData>({
    queryKey: ["relatorios", "fechamento-comercial", periodo, closerId, sdrId, familia, empresaId],
    queryFn: async () => {
      const r = await fetch(`/api/relatorios/fechamento-comercial?${qs}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });

  if (isLoading) return <p className="ins-vazio">Carregando fechamento…</p>;
  if (isError || !d) return <p className="ins-vazio">Não foi possível carregar o fechamento comercial.</p>;

  const r = d.resumo;
  const o = d.opcoes;
  const filtrado = !!(closerId || sdrId || familia || empresaId);

  return (
    <div className="flex flex-col gap-3">
      <div className="ins-filtros">
        <select aria-label="Closer" value={closerId} onChange={(e) => setCloserId(e.target.value)}>
          <option value="">Todos os closers</option>
          {o.closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select aria-label="SDR" value={sdrId} onChange={(e) => setSdrId(e.target.value)}>
          <option value="">Todos os SDRs</option>
          {o.sdrs.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select aria-label="Família" value={familia} onChange={(e) => setFamilia(e.target.value)}>
          <option value="">Todas as famílias</option>
          {o.familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select aria-label="Empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todas as empresas</option>
          {o.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {filtrado ? (
          <button type="button" className="ins-link" onClick={() => { setCloserId(""); setSdrId(""); setFamilia(""); setEmpresaId(""); }}>
            Limpar filtros
          </button>
        ) : null}
      </div>

      <div className="ins-tiles">
        <div className="ins-tile"><span>Total vendido</span><strong>{moedaExata(r.totalVendido)}</strong><small>{r.quantidadeVendas} venda{r.quantidadeVendas === 1 ? "" : "s"}</small></div>
        <div className="ins-tile"><span>Com SDR identificável</span><strong>{r.vendasComSdrIdentificavel}/{r.quantidadeVendas}</strong><small>pelo evento de agendamento</small></div>
        <div className="ins-tile"><span>Stripe · comprovante · contrato</span><strong>{r.vendasComStripe} · {r.vendasComComprovante} · {r.vendasComContrato}</strong><small>evidências por venda</small></div>
        <div className="ins-tile" data-sinal={r.vendasComInformacaoIncompleta > 0 || undefined}><span>Informação incompleta</span><strong>{r.vendasComInformacaoIncompleta}</strong><small>vendas com algum campo sem fonte</small></div>
      </div>

      {r.porCloser.length > 0 ? (
        <div className="ins-chips" aria-label="Vendido por closer">
          {[...r.porCloser].sort((a, b) => b.total - a.total).map((c) => (
            <span key={c.closerId} className="ins-chip">{c.nome} <b>{moedaExata(c.total)}</b> ({c.qtd})</span>
          ))}
        </div>
      ) : null}

      <section className="ins-painel">
        <div className="ins-painel-cab">
          {/* Chip de filtro: mesma tabela, outro recorte. Era role="tab" com
              aria-pressed ao mesmo tempo — dois papéis contraditórios e
              nenhum painel de aba. */}
          <Radiogroup className="ins-chips" rotulo="Blocos do fechamento" orientacao="horizontal">
            {([
              ["vendas", `Vendas fechadas (${d.vendas.length})`],
              ["agendas", `Agendas realizadas (${d.agendas.length})`],
              ["atribuidas", `Atribuídas a SDR (${d.atribuidas.length})`],
            ] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={sub === k} className="ins-chip" onClick={() => setSub(k)}>{l}</button>
            ))}
          </Radiogroup>
          {/* Link real para o .xlsx (3 abas, mesmo filtro da tela). Download
              direto, sem window.open: funciona com bloqueador de pop-up. */}
          <a className="ins-acao" href={`/api/relatorios/fechamento-comercial/export?${qs}`} title="Exporta Vendas, Agendas e Atribuídas num único .xlsx, com o filtro aplicado">
            <Download size={14} aria-hidden /> Exportar .xlsx
          </a>
        </div>

        <div className="ins-tabela-wrap">
          {sub === "vendas" ? (
            <table className="ins-tabela">
              <thead><tr>{["Data", "Empresa", "Contato", "Closer", "SDR", "Família", "Valor", "Proposta", "Contrato", "Comprovante"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {d.vendas.map((v) => (
                  <tr key={v.negocioId}>
                    <td>{data(v.ganhoAt)}</td>
                    <td className="ins-forte"><Link href={`/pipeline/${v.negocioId}`} title="Abrir oportunidade">{v.empresaNome ?? "—"}</Link></td>
                    <td>{v.contatoId ? <Link href={`/pessoas/${v.contatoId}`}>{v.contatoNome ?? "—"}</Link> : v.contatoNome ?? "—"}</td>
                    <td>{v.closerNome ?? "—"}</td>
                    <td title={v.sdrEvidencia}>{v.sdrNome ?? ND}</td>
                    <td>{v.serviceFamily ?? "—"}</td>
                    <td className="ins-num">{moedaExata(valorDaVenda(v))}</td>
                    <td>{v.propostaId && v.propostaNumero ? <Link href={`/propostas/${v.propostaId}`}>#{v.propostaNumero}</Link> : ND}</td>
                    <td>{v.contratoId ? (v.contratoZohoId ? "histórico (Zoho)" : v.contratoStatus ?? "—") : ND}</td>
                    <td>
                      {v.faturaHostedUrl ? (
                        <a href={v.faturaHostedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">Comprovante <ExternalLink size={12} aria-hidden /></a>
                      ) : v.stripeSubscriptionId || v.stripeCustomerId ? (
                        <a
                          href={v.stripeSubscriptionId ? `https://dashboard.stripe.com/subscriptions/${v.stripeSubscriptionId}` : `https://dashboard.stripe.com/customers/${v.stripeCustomerId}`}
                          target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"
                          title="Sem fatura com comprovante: abre o painel Stripe"
                        >
                          {v.stripeSubscriptionId ? "Assinatura" : "Cliente"} Stripe <ExternalLink size={12} aria-hidden />
                        </a>
                      ) : ND}
                    </td>
                  </tr>
                ))}
                {d.vendas.length === 0 ? <tr><td colSpan={10} className="ins-vazio">Nenhuma venda no período.</td></tr> : null}
              </tbody>
            </table>
          ) : sub === "agendas" ? (
            <table className="ins-tabela">
              <thead><tr>{["Agendada em", "Lead", "Empresa", "SDR", "Realizada", "Closer", "Resultado atual", "Venda?"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {d.agendas.map((a) => (
                  <tr key={`${a.leadId}-${a.agendadaEm}`}>
                    <td>{data(a.agendadaEm)}</td>
                    <td className="ins-forte"><Link href={`/pessoas/${a.leadId}`} title="Abrir pessoa">{a.leadNome ?? "—"}</Link></td>
                    <td>{a.empresaNome ?? "—"}</td>
                    <td>{a.sdrNome ?? "—"}</td>
                    <td>{a.realizadaEm ? data(a.realizadaEm) : <span className="ins-fraco">não</span>}</td>
                    <td>{a.closerNome ?? "—"}</td>
                    <td>{a.resultadoAtual ?? "—"}</td>
                    <td>{a.vendaRelacionada ? <b style={{ color: "var(--ins-grafite)" }}>sim</b> : "não"}</td>
                  </tr>
                ))}
                {d.agendas.length === 0 ? <tr><td colSpan={8} className="ins-vazio">Nenhuma agenda no período.</td></tr> : null}
              </tbody>
            </table>
          ) : (
            <>
              <p className="ins-ressalva">Vendas cujo evento de agendamento mostra um SDR diferente do closer que fechou. É fato exposto, não regra de comissão.</p>
              <table className="ins-tabela">
                <thead><tr>{["Ganho em", "SDR", "Closer", "Empresa", "Valor", "Família", "Evidência"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {d.atribuidas.map((v) => (
                    <tr key={v.negocioId}>
                      <td>{data(v.ganhoAt)}</td>
                      <td>{v.sdrNome ?? "—"}</td>
                      <td>{v.closerNome ?? "—"}</td>
                      <td className="ins-forte"><Link href={`/pipeline/${v.negocioId}`} title="Abrir oportunidade">{v.empresaNome ?? "—"}</Link></td>
                      <td className="ins-num">{moedaExata(v.valor)}</td>
                      <td>{v.serviceFamily ?? "—"}</td>
                      <td className="ins-fraco">{v.origemAtribuicao}</td>
                    </tr>
                  ))}
                  {d.atribuidas.length === 0 ? <tr><td colSpan={7} className="ins-vazio">Nenhuma venda atribuída a SDR no período.</td></tr> : null}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
