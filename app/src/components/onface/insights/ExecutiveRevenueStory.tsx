"use client";

import { ArrowRight, TrendingDown, TrendingUp, CalendarDays } from "lucide-react";
import { historiaCompetencia, type PontoCompetencia } from "@/lib/relatorios/insights-narrativa";
import { dinheiro, rotuloPonto } from "@/components/onface/relatorios/explorador-formato";
import "./insights-bi.css";

const percentual = (v: number) => (v > 0 ? "+" : "") + (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

export function ExecutiveRevenueStory({ pontos, mes, aoExplorar }: {
  pontos: PontoCompetencia[]; mes: string | null; aoExplorar: (mes: string) => void;
}) {
  const h = historiaCompetencia(pontos, mes);
  if (!h) return null;
  const { atual, anterior, deltaPercentual, desvioMediaPercentual, mediaAnterior3, picoDaJanela } = h;
  const Tendencia = deltaPercentual !== null && deltaPercentual < 0 ? TrendingDown : TrendingUp;
  return (
    <section className="ins-bi-story" aria-label="História dos dados de faturamento">
      <div className="ins-bi-story-principal">
        <span className="ins-bi-kicker"><CalendarDays size={14} /> COMPETÊNCIA · {rotuloPonto(atual.inicio, "mes")}</span>
        <strong className="ins-bi-valor">{dinheiro(atual.valor, "BRL")}</strong>
        <p>{atual.registros.toLocaleString("pt-BR")} linhas compõem o valor.
          {picoDaJanela ? " Maior competência observada até este mês." : " Explore os registros e descubra sua composição."}</p>
        <button type="button" className="ins-bi-acao" onClick={() => aoExplorar(atual.inicio)}>
          Examinar a competência <ArrowRight size={15} />
        </button>
      </div>
      <div className="ins-bi-story-metricas">
        <div className="ins-bi-story-metrica">
          <span>EVOLUÇÃO MENSAL</span>
          <strong data-queda={deltaPercentual !== null && deltaPercentual < 0}><Tendencia size={16}/>{deltaPercentual === null ? "—" : percentual(deltaPercentual)}</strong>
          <small>{anterior ? "Em relação a " + rotuloPonto(anterior.inicio, "mes") : "Mês anterior ausente: não tratado como zero."}</small>
        </div>
        <div className="ins-bi-story-metrica">
          <span>VS. MÉDIA DOS 3 MESES ANTERIORES</span>
          <strong>{desvioMediaPercentual === null ? "—" : percentual(desvioMediaPercentual)}</strong>
          <small>{mediaAnterior3 === null ? "Sem três competências anteriores consecutivas." : "Média: " + dinheiro(mediaAnterior3, "BRL")}</small>
        </div>
        <p className="ins-bi-fonte">Fonte: faturamento por competência fechada. Não representa MRR nem caixa recebido.</p>
      </div>
    </section>
  );
}
