"use client";

/**
 * Catálogo da família de gráficos. Cada tipo aparece com TODAS as variações
 * lado a lado — é assim que dá pra dizer "esse não, quero o empilhado" e a
 * troca ser uma prop, não uma reescrita.
 */
import * as React from "react";
import { Secao, Amostra, Grade, Painel } from "./Base";
import {
  Cf2GraficoArea, Cf2GraficoBarra, Cf2GraficoLinha, Cf2GraficoPizza,
  Cf2GraficoRadar, Cf2GraficoRadial, Cf2Sparkline, moedaCurta,
} from "@/components/crm2/ds/Graficos";

const MESES = [
  { mes: "mar", mrr: 28400, novo: 6200 },
  { mes: "abr", mrr: 31100, novo: 5400 },
  { mes: "mai", mrr: 33800, novo: 7100 },
  { mes: "jun", mrr: 36200, novo: 4900 },
  { mes: "jul", mrr: 39500, novo: 8300 },
  { mes: "ago", mrr: 43800, novo: 9100 },
];

const CANAIS = [
  { canal: "Meta Ads", leads: 184, ganhos: 31 },
  { canal: "Indicação", leads: 96, ganhos: 22 },
  { canal: "Orgânico", leads: 74, ganhos: 11 },
  { canal: "Outbound", leads: 58, ganhos: 9 },
];

const ORIGEM = [
  { origem: "Meta Ads", valor: 184 },
  { origem: "Indicação", valor: 96 },
  { origem: "Orgânico", valor: 74 },
  { origem: "Outbound", valor: 58 },
  { origem: "Evento", valor: 22 },
];

const PERFIL = [
  { eixo: "Prospecção", mayara: 88, time: 64 },
  { eixo: "Qualificação", mayara: 72, time: 70 },
  { eixo: "Proposta", mayara: 91, time: 58 },
  { eixo: "Negociação", mayara: 66, time: 61 },
  { eixo: "Fechamento", mayara: 84, time: 55 },
];

const SERIE_MRR = [{ mrr: 28400 }, { mrr: 31100 }, { mrr: 33800 }, { mrr: 36200 }, { mrr: 39500 }, { mrr: 43800 }];

const S_MRR = [{ chave: "mrr", rotulo: "MRR" }];
const S_DUPLA = [{ chave: "mrr", rotulo: "MRR" }, { chave: "novo", rotulo: "Novo negócio" }];
const S_CANAL = [{ chave: "leads", rotulo: "Leads" }, { chave: "ganhos", rotulo: "Ganhos" }];

export function CatalogoGraficos() {
  return (
    <div className="flex flex-col gap-10">
      <Secao
        id="graficos-regras"
        titulo="Gráficos — regras da família"
        descricao="Seis componentes parametrizados, não trinta fixos: trocar de variação é trocar uma prop. Paleta única (série 1 sempre a principal), grade só horizontal, eixo sem linha nem tick, moeda abreviada no eixo e completa no tooltip, altura sempre vinda de fora."
      >
        <Grade min={320}>
          <Amostra rotulo="Sparkline — tendência dentro de um KPI" codigo="<Cf2Sparkline />">
            <div className="flex items-end gap-4">
              <div>
                <p className="text-micro uppercase text-tinta-fraca">MRR</p>
                <p className="text-kpi font-semibold font-display text-tinta tabular-nums">R$ 43.800</p>
              </div>
              <div className="w-28"><Cf2Sparkline dados={SERIE_MRR} chave="mrr" tom="positivo" /></div>
            </div>
            <p className="text-apoio text-tinta-fraca">Sem eixo, sem grade, sem tooltip: é forma, não leitura de valor.</p>
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-area"
        titulo="Área"
        descricao="A escolha padrão para evolução no tempo. Gradiente por baixo dá volume sem pesar; empilhado responde composição do total."
      >
        <Grade min={340}>
          <Amostra rotulo="Gradiente (padrão)" codigo='variante="gradiente"'>
            <Cf2GraficoArea dados={MESES} eixo="mes" series={S_MRR} formatarValor={moedaCurta} eixoY />
          </Amostra>
          <Amostra rotulo="Empilhado" codigo='variante="empilhado"'>
            <Cf2GraficoArea dados={MESES} eixo="mes" series={S_DUPLA} variante="empilhado" formatarValor={moedaCurta} legenda />
          </Amostra>
          <Amostra rotulo="Simples (só linha)" codigo='variante="simples"'>
            <Cf2GraficoArea dados={MESES} eixo="mes" series={S_DUPLA} variante="simples" formatarValor={moedaCurta} />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-barra"
        titulo="Barra"
        descricao="Comparar categorias. Horizontal quando o rótulo é longo — nome de canal ou de vendedor não cabe embaixo de uma barra vertical sem virar de lado, e texto inclinado é ilegível."
      >
        <Grade min={340}>
          <Amostra rotulo="Vertical agrupado" codigo='orientacao="vertical"'>
            <Cf2GraficoBarra dados={CANAIS} eixo="canal" series={S_CANAL} legenda />
          </Amostra>
          <Amostra rotulo="Horizontal com rótulo" codigo='orientacao="horizontal" rotulos'>
            <Cf2GraficoBarra dados={CANAIS} eixo="canal" series={[{ chave: "leads", rotulo: "Leads" }]} orientacao="horizontal" rotulos />
          </Amostra>
          <Amostra rotulo="Empilhado" codigo='variante="empilhado"'>
            <Cf2GraficoBarra dados={CANAIS} eixo="canal" series={S_CANAL} variante="empilhado" legenda />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-linha"
        titulo="Linha"
        descricao="Quando importa a inclinação e não o volume — comparar duas séries de grandezas parecidas. Tracejada distingue realizado de projetado sem gastar outra cor."
      >
        <Grade min={340}>
          <Amostra rotulo="Múltipla com pontos" codigo="pontos">
            <Cf2GraficoLinha dados={MESES} eixo="mes" series={S_DUPLA} pontos legenda />
          </Amostra>
          <Amostra rotulo="Realizado vs. projetado" codigo="tracejada">
            <Cf2GraficoLinha dados={MESES} eixo="mes" series={S_DUPLA} tracejada legenda />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-pizza"
        titulo="Pizza e rosca"
        descricao="Só para composição de um todo, com poucas fatias. Acima de 5 categorias vira barra horizontal — o olho não compara ângulos parecidos."
      >
        <Grade min={280}>
          <Amostra rotulo="Rosca com total" codigo='variante="rosca-total"'>
            <Cf2GraficoPizza dados={ORIGEM} chaveRotulo="origem" chaveValor="valor" variante="rosca-total" total="434" rotuloTotal="leads" />
          </Amostra>
          <Amostra rotulo="Rosca" codigo='variante="rosca"'>
            <Cf2GraficoPizza dados={ORIGEM} chaveRotulo="origem" chaveValor="valor" variante="rosca" />
          </Amostra>
          <Amostra rotulo="Pizza cheia" codigo='variante="pizza"'>
            <Cf2GraficoPizza dados={ORIGEM} chaveRotulo="origem" chaveValor="valor" variante="pizza" />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-radar"
        titulo="Radar"
        descricao="Perfil em vários eixos ao mesmo tempo — desempenho de um vendedor contra a média do time, por etapa do funil. Serve para ver FORMATO, não para ler valor exato."
      >
        <Grade min={300}>
          <Amostra rotulo="Comparativo preenchido" codigo="<Cf2GraficoRadar />">
            <Cf2GraficoRadar
              dados={PERFIL}
              eixo="eixo"
              series={[{ chave: "mayara", rotulo: "Mayara" }, { chave: "time", rotulo: "Média do time" }]}
              legenda
            />
          </Amostra>
          <Amostra rotulo="Só contorno" codigo="preenchido={false}">
            <Cf2GraficoRadar
              dados={PERFIL}
              eixo="eixo"
              series={[{ chave: "mayara", rotulo: "Mayara" }, { chave: "time", rotulo: "Média do time" }]}
              preenchido={false}
              legenda
            />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-radial"
        titulo="Radial / medidor"
        descricao="Progresso contra meta. Enche no sentido horário a partir do topo — invertido, a leitura de progresso se perde. O tom muda com o estado, então bater e não bater a meta se distinguem de longe."
      >
        <Grade min={220}>
          <Amostra rotulo="Meta batida" codigo='tom="positivo"'>
            <Cf2GraficoRadial valor={125} maximo={100} tom="positivo" legenda="da meta do mês" />
          </Amostra>
          <Amostra rotulo="Em andamento" codigo='tom="marca"'>
            <Cf2GraficoRadial valor={68} tom="marca" legenda="da meta do mês" />
          </Amostra>
          <Amostra rotulo="Em risco" codigo='tom="atencao"'>
            <Cf2GraficoRadial valor={34} tom="atencao" legenda="da meta do mês" />
          </Amostra>
          <Amostra rotulo="Com valor no centro" codigo="rotulo">
            <Cf2GraficoRadial valor={43800} maximo={50000} rotulo="R$ 43,8 mil" tom="marca" legenda="de R$ 50 mil" />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="grafico-card"
        titulo="Gráfico dentro de card"
        descricao="Como fica no produto: título e valor dominante em cima, gráfico embaixo. O gráfico não fixa a própria altura — quem compõe decide."
      >
        <Painel className="cf2-p-card max-w-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-micro uppercase text-tinta-fraca">MRR acumulado</p>
              <p className="text-destaque font-semibold font-display text-tinta tabular-nums mt-1">R$ 43.800</p>
              <p className="text-apoio text-positivo mt-1">+10,9% vs. julho</p>
            </div>
          </div>
          <Cf2GraficoArea dados={MESES} eixo="mes" series={S_MRR} altura={160} formatarValor={moedaCurta} />
        </Painel>
      </Secao>
    </div>
  );
}
