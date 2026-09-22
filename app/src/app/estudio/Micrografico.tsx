"use client";

import { Area, AreaChart, Bar, BarChart, Cell, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

/**
 * Micro-gráfico de indicador, sobre a biblioteca do projeto.
 *
 * Usa `recharts` pelo `ChartContainer` do shadcn (`components/ui/chart`), que é
 * a mesma base dos gráficos do produto. Não é SVG próprio: gráfico é exatamente
 * o tipo de peça que a biblioteca resolve melhor do que uma implementação
 * paralela, e uma segunda forma de desenhar série é o começo da divergência.
 *
 * A série é a leitura real das últimas doze semanas. Sem série no banco, o
 * indicador sai sem gráfico em vez de inventar uma linha bonita.
 */

const config = { v: { label: "Valor" } } satisfies ChartConfig;

function paraDados(serie: number[]) {
  return serie.map((v, i) => ({ i, v }));
}

/** Domínio do eixo Y.
 *
 * Sem isto o Recharts ancora a escala no zero, e uma série que varia de 455 a
 * 527 vira uma reta: a diferença de 14% some dentro de um eixo que começa em 0.
 * A folga abaixo do mínimo existe para a linha não encostar na base. */
function dominio(serie: number[], folga: number): [number, number] {
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const faixa = max - min || 1;
  return [min - faixa * folga, max + faixa * 0.1];
}

export function MicroLinha({ serie, cor, id }: { serie: number[]; cor: string; id: string }) {
  // `id` explícito: sem ele o ChartContainer cai no `useId()` do React, que
  // gera valores diferentes no servidor e no cliente e derruba a hidratação.
  const dados = paraDados(serie);

  return (
    <ChartContainer id={id} config={config} className="aspect-auto h-8 w-full">
      <AreaChart data={dados} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <YAxis hide domain={dominio(serie, 0.35)} />
        <defs>
          <linearGradient id={`preenche-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="v"
          type="monotone"
          stroke={cor}
          strokeWidth={1.5}
          fill={`url(#preenche-${id})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function MicroBarras({ serie, cor, id }: { serie: number[]; cor: string; id: string }) {
  const dados = paraDados(serie);
  const ultima = dados.length - 1;

  return (
    <ChartContainer id={id} config={config} className="aspect-auto h-8 w-full">
      <BarChart data={dados} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={3}>
        <YAxis hide domain={dominio(serie, 1.2)} />
        <Bar dataKey="v" radius={2} isAnimationActive={false}>
          {/* A última barra é o agora: cheia. As anteriores recuam, para a série
              ler como contexto em vez de doze valores de mesmo peso. */}
          {dados.map((d) => (
            <Cell key={d.i} fill={cor} fillOpacity={d.i === ultima ? 1 : 0.22} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
