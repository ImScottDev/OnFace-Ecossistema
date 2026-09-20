"use client";

/** Gráficos avançados do ONFACE.
 *
 * Segunda leva da família. Vive em arquivo próprio para o primeiro não virar
 * um módulo de mil linhas, mas obedece exatamente às mesmas regras:
 * `ChartContainer` do repo, cor só de `--chart-*`, coral só na série que a
 * pessoa veio ver, e três estados de verdade (carregando, vazio, com dado).
 *
 * As referências que o Scott mandou (shadcn.io, reui) entraram como estudo de
 * COMPOSIÇÃO e de comportamento: cabeçalho com métrica selecionável, radar de
 * perfil, grade circular sem eixo, combo de volume e taxa. O código é nosso,
 * escrito sobre os nossos tokens; a biblioteca do reui, além disso, é paga e
 * responde 401 sem licença, então nada de lá foi baixado. */

import * as React from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Area, AreaChart, Line, LineChart, ComposedChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  RadialBar, RadialBarChart, ReferenceLine, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "motion/react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ADOCAO_MODULOS, CANAIS_SEMANAIS, CONTATO_POR_HORA, DESEMPENHO_RADAR, DIAS_UTEIS,
  HORAS, MOVIMENTO_FUNIL, RECEITA_SEMANAL, brl, compacto,
} from "./dados";
import "./graficos-avancados.css";

/* ═══ Área simples ════════════════════════════════════════════════════════ */

const CONFIG_AREA = {
  atual: { label: "Receita ganha", color: "var(--cf2-serie-1)" },
} satisfies ChartConfig;

/** Uma série, sem comparação. O caso mais comum do produto: "como isso vem
 *  andando". Comparar período é outro gráfico, não uma opção deste. */
export function AreaSimples({ altura = 180 }: { altura?: number }) {
  return (
    <ChartContainer config={CONFIG_AREA} className="gav-chart" style={{ height: `calc(${altura} * var(--onface-u))` }}>
      <AreaChart data={RECEITA_SEMANAL} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compacto(v)} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />} />
        <Area
          dataKey="atual"
          type="natural"
          fill="var(--color-atual)"
          fillOpacity={0.12}
          stroke="var(--color-atual)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/* ═══ Barras com métrica selecionável ═════════════════════════════════════ */

const METRICAS_CANAL = [
  { chave: "ligacao" as const, rotulo: "Ligações" },
  { chave: "whatsapp" as const, rotulo: "WhatsApp" },
  { chave: "email" as const, rotulo: "E-mails" },
];

const CONFIG_CANAL = {
  ligacao: { label: "Ligações", color: "var(--cf2-serie-1)" },
  whatsapp: { label: "WhatsApp", color: "var(--cf2-serie-2)" },
  email: { label: "E-mails", color: "var(--cf2-serie-3)" },
  reunioes: { label: "Reuniões", color: "var(--cf2-serie-3)" },
  conversao: { label: "Conversão", color: "var(--cf2-serie-1)" },
} satisfies ChartConfig;

/** Cabeçalho que também é controle: cada métrica mostra o total do período e
 *  vira a série do gráfico ao ser escolhida. Três gráficos empilhados diriam a
 *  mesma coisa ocupando três vezes o espaço, e ninguém compararia nada. */
export function BarrasInterativas() {
  const [ativa, setAtiva] = React.useState<(typeof METRICAS_CANAL)[number]["chave"]>("ligacao");

  const totais = React.useMemo(
    () =>
      METRICAS_CANAL.reduce<Record<string, number>>((acc, m) => {
        acc[m.chave] = CANAIS_SEMANAIS.reduce((soma, linha) => soma + linha[m.chave], 0);
        return acc;
      }, {}),
    []
  );

  return (
    <div className="gav-interativo">
      <div className="gav-metricas" role="tablist" aria-label="Métrica do gráfico">
        {METRICAS_CANAL.map((m) => (
          <button
            key={m.chave}
            type="button"
            role="tab"
            aria-selected={ativa === m.chave}
            className="gav-metrica"
            onClick={() => setAtiva(m.chave)}
          >
            <span className="gav-metrica-rotulo">{m.rotulo}</span>
            <strong className="gav-metrica-valor">{totais[m.chave].toLocaleString("pt-BR")}</strong>
          </button>
        ))}
      </div>

      <ChartContainer config={CONFIG_CANAL} className="gav-chart" style={{ height: "calc(190 * var(--onface-u))" }}>
        <BarChart data={CANAIS_SEMANAIS} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--onface-coral-subtle)" }} />
          <Bar dataKey={ativa} fill={`var(--color-${ativa})`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ Radar ═══════════════════════════════════════════════════════════════ */

const CONFIG_RADAR = {
  mayara: { label: "Mayara", color: "var(--cf2-serie-1)" },
  media: { label: "Média do time", color: "var(--cf2-serie-3)" },
} satisfies ChartConfig;

/** Perfil em cinco eixos. Serve para comparar UMA pessoa com a régua do time,
 *  não para empilhar o time inteiro: cinco polígonos viram sopa. */
export function RadarDesempenho({ comMedia = true }: { comMedia?: boolean }) {
  return (
    <ChartContainer config={CONFIG_RADAR} className="gav-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
      <RadarChart data={DESEMPENHO_RADAR} outerRadius="72%">
        <PolarGrid />
        <PolarAngleAxis dataKey="eixo" />
        <ChartTooltip content={<ChartTooltipContent />} />
        {comMedia ? (
          <Radar dataKey="media" stroke="var(--color-media)" fill="var(--color-media)" fillOpacity={0.1} strokeWidth={1} />
        ) : null}
        <Radar dataKey="mayara" stroke="var(--color-mayara)" fill="var(--color-mayara)" fillOpacity={0.18} strokeWidth={2} />
      </RadarChart>
    </ChartContainer>
  );
}

/** Mesma leitura, grade circular e sem os raios: quando os eixos já estão
 *  nomeados, o raio vira ruído e o polígono ganha a atenção. */
export function RadarGradeCircular() {
  return (
    <ChartContainer config={CONFIG_RADAR} className="gav-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
      <RadarChart data={DESEMPENHO_RADAR} outerRadius="72%">
        <PolarGrid gridType="circle" radialLines={false} />
        <PolarAngleAxis dataKey="eixo" />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar dataKey="mayara" stroke="var(--color-mayara)" fill="var(--color-mayara)" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fillOpacity: 1 }} />
      </RadarChart>
    </ChartContainer>
  );
}

/* ═══ Linha múltipla com foco ═════════════════════════════════════════════ */

/** Três canais na mesma escala. A legenda liga e desliga série: com tudo
 *  ligado o gráfico responde "qual canal cresce"; com um só, "como este canal
 *  está". São duas perguntas diferentes no mesmo espaço. */
export function LinhasPorCanal() {
  const [ocultas, setOcultas] = React.useState<string[]>([]);
  const alternar = (chave: string) =>
    setOcultas((atual) => (atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]));

  return (
    <div className="gav-linhas">
      <div className="gav-legenda" role="group" aria-label="Séries do gráfico">
        {METRICAS_CANAL.map((m) => (
          <button
            key={m.chave}
            type="button"
            className="gav-legenda-item"
            aria-pressed={!ocultas.includes(m.chave)}
            onClick={() => alternar(m.chave)}
          >
            <i style={{ background: `var(--color-${m.chave})` }} aria-hidden />
            {m.rotulo}
          </button>
        ))}
      </div>

      <ChartContainer config={CONFIG_CANAL} className="gav-chart" style={{ height: "calc(190 * var(--onface-u))" }}>
        <LineChart data={CANAIS_SEMANAIS} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {METRICAS_CANAL.filter((m) => !ocultas.includes(m.chave)).map((m) => (
            <Line
              key={m.chave}
              dataKey={m.chave}
              type="monotone"
              stroke={`var(--color-${m.chave})`}
              strokeWidth={m.chave === "ligacao" ? 2.5 : 1.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ Combo: volume e taxa ════════════════════════════════════════════════ */

/** Duas perguntas que só fazem sentido juntas: quanto a operação falou
 *  (barra, eixo da esquerda) e quanto disso virou negócio (linha, eixo da
 *  direita). Separado em dois cartões, ninguém cruza. */
export function VolumeEConversao() {
  return (
    <ChartContainer config={CONFIG_CANAL} className="gav-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
      <ComposedChart data={CANAIS_SEMANAIS} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis yAxisId="volume" tickLine={false} axisLine={false} width={40} />
        <YAxis
          yAxisId="taxa"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--onface-coral-subtle)" }} />
        <Bar yAxisId="volume" dataKey="reunioes" fill="var(--color-reunioes)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          yAxisId="taxa"
          dataKey="conversao"
          type="monotone"
          stroke="var(--color-conversao)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

/* ═══ Barra radial ════════════════════════════════════════════════════════ */

const CONFIG_ADOCAO = {
  valor: { label: "Adoção" },
} satisfies ChartConfig;

/** Adoção por módulo. Quatro anéis concêntricos leem a comparação de uma vez;
 *  quatro anéis soltos lado a lado obrigam a comparar de memória. */
export function AdocaoRadial() {
  const reduzido = useReducedMotion();
  const dados = ADOCAO_MODULOS.map((m, i) => ({
    ...m,
    fill: i === 0 ? "var(--cf2-serie-1)" : i === 1 ? "var(--cf2-serie-2)" : i === 2 ? "var(--cf2-serie-3)" : "var(--cf2-serie-4)",
  }));

  return (
    <div className="gav-radial">
      <ChartContainer config={CONFIG_ADOCAO} className="gav-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
        <RadialBarChart data={dados} innerRadius="28%" outerRadius="100%" startAngle={90} endAngle={-270}>
          <ChartTooltip content={<ChartTooltipContent nameKey="modulo" />} />
          <RadialBar dataKey="valor" background cornerRadius={8} isAnimationActive={!reduzido} />
        </RadialBarChart>
      </ChartContainer>
      <ul className="gav-radial-legenda">
        {dados.map((m) => (
          <li key={m.modulo}>
            <i style={{ background: m.fill }} aria-hidden />
            {m.modulo}
            <b>{m.valor}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══ Cascata do funil ════════════════════════════════════════════════════ */

const CONFIG_CASCATA = { valor: { label: "Movimento" } } satisfies ChartConfig;

type BarraCascata = (typeof MOVIMENTO_FUNIL)[number] & { base: number; corpo: number };

/** De onde saiu e para onde foi o dinheiro do funil no mês. A cascata existe
 *  porque saldo sozinho não explica nada: 1,7 MM pode ser um mês ótimo ou o
 *  resultado de ganhar pouco e perder menos ainda. */
export function CascataDoFunil() {
  /* Cada barra flutua: a base transparente empilha o ponto de partida e só a
     segunda parte pinta. É assim que waterfall se faz em recharts sem
     biblioteca nova. */
  /* `reduce` em vez de variável reatribuída dentro do `map`: o acumulador anda
     junto com a lista, sem estado solto no meio do cálculo. Além de ser mais
     honesto sobre a dependência entre as barras, é o que o compilador do React
     aceita (`react-hooks/immutability` reprova reatribuição dentro do memo). */
  const barras = React.useMemo(
    () =>
      MOVIMENTO_FUNIL.reduce<{ acumulado: number; linhas: BarraCascata[] }>(
        (estado, m) => {
          if (m.tipo === "base" || m.tipo === "total") {
            return {
              acumulado: m.valor,
              linhas: [...estado.linhas, { ...m, base: 0, corpo: m.valor }],
            };
          }
          const inicio = m.valor >= 0 ? estado.acumulado : estado.acumulado + m.valor;
          return {
            acumulado: estado.acumulado + m.valor,
            linhas: [...estado.linhas, { ...m, base: inicio, corpo: Math.abs(m.valor) }],
          };
        },
        { acumulado: 0, linhas: [] }
      ).linhas,
    []
  );

  const cor = (tipo: string) =>
    tipo === "entrada" ? "var(--cf2-serie-5)" : tipo === "saida" ? "var(--cf2-serie-2)" : "var(--cf2-serie-1)";

  return (
    <ChartContainer config={CONFIG_CASCATA} className="gav-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
      <BarChart data={barras} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="etapa" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compacto(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="etapa"
              formatter={(_v, _n, item) => brl(Number((item?.payload as { valor?: number })?.valor ?? 0))}
            />
          }
          cursor={{ fill: "var(--onface-coral-subtle)" }}
        />
        <ReferenceLine y={0} stroke="var(--line-hairline)" />
        <Bar dataKey="base" stackId="cascata" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="corpo" stackId="cascata" radius={[4, 4, 0, 0]}>
          {barras.map((b) => (
            <Cell key={b.etapa} fill={cor(b.tipo)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/* ═══ Mapa de calor ═══════════════════════════════════════════════════════ */

/** Quando vale a pena ligar. Não é recharts: é uma grade de células com uma
 *  escala de intensidade em coral. Gráfico cartesiano responderia "quantos
 *  contatos por hora"; o mapa responde "qual é a janela", que é a pergunta que
 *  a operação faz de verdade. */
export function MapaDeContato() {
  const [foco, setFoco] = React.useState<{ dia: number; hora: number } | null>(null);
  const pico = Math.max(...CONTATO_POR_HORA.flat());
  const selecionado = foco ? CONTATO_POR_HORA[foco.dia][foco.hora] : null;

  return (
    <div className="gav-mapa">
      <div className="gav-mapa-grade" style={{ gridTemplateColumns: `auto repeat(${HORAS.length}, minmax(0, 1fr))` }}>
        <span />
        {HORAS.map((h) => (
          <span key={h} className="gav-mapa-hora">{h}</span>
        ))}

        {DIAS_UTEIS.map((dia, d) => (
          <React.Fragment key={dia}>
            <span className="gav-mapa-dia">{dia}</span>
            {CONTATO_POR_HORA[d].map((valor, h) => (
              <button
                key={`${dia}-${HORAS[h]}`}
                type="button"
                className="gav-mapa-celula"
                style={{ "--intensidade": (valor / pico).toFixed(2) } as React.CSSProperties}
                data-foco={foco?.dia === d && foco?.hora === h ? "true" : undefined}
                onMouseEnter={() => setFoco({ dia: d, hora: h })}
                onFocus={() => setFoco({ dia: d, hora: h })}
                onMouseLeave={() => setFoco(null)}
                onBlur={() => setFoco(null)}
                aria-label={`${dia} às ${HORAS[h]}: ${valor} contatos`}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      <p className="gav-mapa-leitura" role="status">
        {foco ? (
          <>
            <strong>{DIAS_UTEIS[foco.dia]} às {HORAS[foco.hora]}</strong> · {selecionado} contatos atendidos
          </>
        ) : (
          <>Passe o mouse ou navegue com Tab para ler uma faixa. Pico da semana: <strong>{pico} contatos</strong>.</>
        )}
      </p>
    </div>
  );
}
