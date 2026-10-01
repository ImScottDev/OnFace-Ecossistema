"use client";

import { useEffect, useState } from "react";
import { moeda } from "@/components/onface/vendas/formato";

type Linha = {
  chave: string; leads: number; qualificados: number; oportunidades: number; ganhos: number;
  mrrReal: number; gastoMeta?: number; cpl?: number | null; roas?: number | null;
};
type Tracking = {
  totalLeads: number;
  leadsRastreados: number;
  atribuicao?: { mrrTotal: number; mrrAtribuido: number };
  porCampanha: Linha[];
  meta?: { configured: boolean; totalGasto: number; totalLeads: number; erro?: string };
};

const PERIODOS = [
  { v: "30d", l: "Últimos 30 dias" },
  { v: "90d", l: "Últimos 90 dias" },
  { v: "mes_atual", l: "Mês atual" },
  { v: "all", l: "Todo o histórico" },
] as const;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Funil por utm_campaign, lido de `GET /api/relatorios/tracking` — o mesmo
 * endpoint do relatório de marketing, servido pelo Hono. Nada é recalculado
 * aqui: CPL e ROAS só aparecem quando a campanha casou com a Meta (o servidor
 * só preenche nesse caso); sem casamento a célula fica "—", não zero.
 *
 * O efeito usa uma flag local de cancelamento, não `useRef`: com ref a troca
 * de período cancelava a requisição nova junto com a velha (memória
 * react_efeito_fetch_ref_dependencia).
 */
export function OrigemLeads() {
  const [periodo, setPeriodo] = useState<string>("30d");
  const [dados, setDados] = useState<Tracking | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro(null);
    fetch(`/api/relatorios/tracking?periodo=${periodo}`)
      .then(async (r) => {
        if (r.status === 403) throw new Error("Seu papel não tem acesso aos números de marketing.");
        if (!r.ok) throw new Error("Não consegui carregar a origem dos leads.");
        return (await r.json()) as Tracking;
      })
      .then((d) => { if (vivo) setDados(d); })
      .catch((e: Error) => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [periodo]);

  const meta = dados?.meta;

  return (
    <>
      <div className="ov-controles">
        <select className="ov-select" value={periodo} aria-label="Período" onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
        {dados ? (
          <span className="ov-nota">
            {dados.leadsRastreados} de {dados.totalLeads} leads do período têm utm de campanha
            {meta?.configured && !meta.erro ? ` · Meta: ${moeda(meta.totalGasto)} investidos, ${meta.totalLeads} leads atribuídos` : ""}
            {meta && !meta.configured ? " · Meta Ads não conectada: sem gasto, CPL e ROAS" : ""}
            {meta?.erro ? " · Meta indisponível agora: gasto, CPL e ROAS ficam em branco" : ""}
          </span>
        ) : null}
      </div>

      <div className="ov-tabela-wrap cp-superficie">
        <table className="ov-tabela">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col /><col /><col /><col /><col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr>
              <th>utm_campaign</th>
              <th className="ov-num">Leads</th>
              <th className="ov-num">Qualif.</th>
              <th className="ov-num">Oport.</th>
              <th className="ov-num">Ganhos</th>
              <th className="ov-num">MRR</th>
              <th className="ov-num">Gasto Meta</th>
              <th className="ov-num">CPL</th>
              <th className="ov-num">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {erro ? (
              <tr><td colSpan={9}><div className="ov-vazio"><strong>Sem dados</strong><p>{erro}</p></div></td></tr>
            ) : !dados ? (
              <tr><td colSpan={9}><div className="ov-vazio"><p>Carregando o funil por campanha…</p></div></td></tr>
            ) : dados.porCampanha.length === 0 ? (
              <tr><td colSpan={9}><div className="ov-vazio"><strong>Nenhum lead com utm no período</strong><p>Troque o período para ver o histórico.</p></div></td></tr>
            ) : dados.porCampanha.map((l) => (
              <tr key={l.chave} style={{ cursor: "default" }}>
                <td className="ov-tabela-principal" title={l.chave}>{l.chave}</td>
                <td className="ov-num">{l.leads}</td>
                <td className="ov-num">{l.qualificados} <span className="ov-tabela-apoio">{l.leads ? pct(l.qualificados / l.leads) : ""}</span></td>
                <td className="ov-num">{l.oportunidades}</td>
                <td className="ov-num">{l.ganhos}</td>
                <td className="ov-num">{l.mrrReal ? moeda(l.mrrReal) : "—"}</td>
                <td className="ov-num">{l.gastoMeta != null ? moeda(l.gastoMeta) : "—"}</td>
                <td className="ov-num">{l.cpl != null ? moeda(l.cpl) : "—"}</td>
                <td className="ov-num">{l.roas != null ? `${l.roas.toFixed(2)}×` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ov-nota cp-rodape">
        Leads e qualificados vêm do CRM pelo utm_campaign do lead e respeitam o período. Oportunidades e ganhos
        contam o histórico inteiro do e-mail do lead (o relatório de origem faz assim), por isso podem passar dos leads
        do período. MRR é assinatura ativa do próprio lead.
        Gasto, CPL e ROAS vêm da Meta e só existem para campanha que casou pelo nome ou pelo id.
      </p>
    </>
  );
}
