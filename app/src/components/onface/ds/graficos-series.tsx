"use client";

/** Séries do ONFACE: as formas que respondem "como isso andou no tempo".
 *
 * Terceira leva da família. Mesma disciplina de sempre: `ChartContainer` do
 * repo, cor só de `--chart-*`, coral só na série que responde à pergunta, e
 * nenhuma medida fora de token.
 *
 * O que entra de novo aqui é PREENCHIMENTO POR PADRÃO (`<pattern>` SVG). Ele
 * existe por dois motivos concretos: separa séries sem gastar mais uma cor
 * (a regra do ONFACE é uma série em coral, o resto em cinza) e continua legível
 * para quem não distingue as duas pontas do cinza. É textura a serviço de
 * leitura, não decoração — degradê e sombra continuam fora.
 *
 * Composição estudada nas referências que o dono do produto mandou; código,
 * tokens e dados são nossos. */

import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ReferenceDot, ReferenceLine, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { Abas } from "./graficos-medidores";
import {
  CANAIS_SEMANAIS, DESEMPENHO_RADAR, NEGOCIOS, RECEITA_SEMANAL, brl, compacto,
} from "./dados";
import "./graficos-series.css";

/** Medidas que o recharts desenha em unidade SVG, onde `var()` não chega.
 *  Nomeadas em um lugar só, na mesma régua de 1440 do `--onface-u`. */
const SVG = {
  traco: 2,
  tracoApoio: 1.5,
  tracejado: "5 4",
  preenchimento: 0.12,
  raioBarra: 4,
  raioPonto: 5,
  espacoTick: 8,
} as const;

/** `useId` devolve algo com `:`, que não serve dentro de `url(#…)`. Nome em
 *  inglês porque a regra `rules-of-hooks` exige o prefixo `use` para enxergar
 *  que isto é um hook e cobrar as regras dele. */
function useIdSvg(prefixo: string) {
  const bruto = React.useId();
  return `${prefixo}-${bruto.replace(/:/g, "")}`;
}

/* ═══ 5. Linha de saldo com referência e extremos ═════════════════════════ */

const CONFIG_SALDO = { atual: { label: "Receita ganha", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Linha com a média do período marcada e os dois extremos apontados.
 *
 * Linha crua responde "subiu ou caiu". A régua tracejada responde "isso é bom?"
 * — que é a pergunta seguinte e a que o time faz de verdade. Pico e vale ficam
 * marcados porque em doze pontos ninguém acha o maior olhando. */
export function SaldoComReferencia() {
  const reduzido = useReducedMotion();

  const { media, pico, vale, ultimo, variacao } = React.useMemo(() => {
    const valores = RECEITA_SEMANAL.map((p) => p.atual);
    const soma = valores.reduce((s, v) => s + v, 0);
    const maior = Math.max(...valores);
    const menor = Math.min(...valores);
    const fim = RECEITA_SEMANAL.at(-1)!;
    const anterior = RECEITA_SEMANAL.at(-2)!;
    return {
      media: Math.round(soma / valores.length),
      pico: RECEITA_SEMANAL[valores.indexOf(maior)],
      vale: RECEITA_SEMANAL[valores.indexOf(menor)],
      ultimo: fim,
      variacao: Math.round((fim.atual / anterior.atual - 1) * 100),
    };
  }, []);

  return (
    <div className="ser-cartao">
      <header className="ser-estatistica">
        <div>
          <p className="ser-rotulo">Receita ganha · semana corrente</p>
          <p className="ser-numero">
            {brl(ultimo.atual)}
            <span className="ser-delta" data-sentido={variacao < 0 ? "queda" : "alta"}>
              {variacao < 0 ? <ArrowDownRight aria-hidden /> : <ArrowUpRight aria-hidden />}
              {variacao > 0 ? "+" : ""}{variacao}%
            </span>
          </p>
        </div>
        <dl className="ser-extremos">
          <div><dt>Média 12 sem.</dt><dd>{compacto(media)}</dd></div>
          <div><dt>Máxima</dt><dd>{compacto(pico.atual)} · {pico.semana}</dd></div>
          <div><dt>Mínima</dt><dd>{compacto(vale.atual)} · {vale.semana}</dd></div>
        </dl>
      </header>

      <ChartContainer config={CONFIG_SALDO} className="ser-chart" style={{ height: "calc(210 * var(--onface-u))" }}>
        <AreaChart data={RECEITA_SEMANAL} margin={{ left: 4, right: 12, top: 20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compacto(v)} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />} />

          {/* A régua é cinza e tracejada de propósito: ela não é série, é
              contexto. Em coral disputaria a leitura com a própria linha. */}
          <ReferenceLine
            y={media}
            stroke="var(--chart-3)"
            strokeDasharray={SVG.tracejado}
            label={{ value: `média ${compacto(media)}`, position: "insideTopLeft", fill: "var(--text-muted)", fontSize: 10 }}
          />

          <Area
            dataKey="atual"
            type="monotone"
            stroke="var(--color-atual)"
            strokeWidth={SVG.traco}
            fill="var(--color-atual)"
            fillOpacity={SVG.preenchimento}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={!reduzido}
          />

          <ReferenceDot x={pico.semana} y={pico.atual} r={SVG.raioPonto} fill="var(--chart-1)" stroke="var(--surface-card)" strokeWidth={SVG.traco}
            label={{ value: "pico", position: "top", fill: "var(--text-muted)", fontSize: 10 }} />
          <ReferenceDot x={vale.semana} y={vale.atual} r={SVG.raioPonto} fill="var(--chart-3)" stroke="var(--surface-card)" strokeWidth={SVG.traco}
            label={{ value: "vale", position: "bottom", fill: "var(--text-muted)", fontSize: 10 }} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ 6. Funil no tempo ═══════════════════════════════════════════════════ */

type PontoFunil = { periodo: string; qualificacao: number; negociacao: number; proposta: number; fechamento: number };

const FUNIL_TEMPO: { chave: string; rotulo: string; pontos: PontoFunil[] }[] = [
  {
    chave: "8s",
    rotulo: "8 semanas",
    pontos: [
      { periodo: "28 jul", qualificacao: 42, negociacao: 24, proposta: 15, fechamento: 6 },
      { periodo: "04 ago", qualificacao: 48, negociacao: 27, proposta: 17, fechamento: 7 },
      { periodo: "11 ago", qualificacao: 39, negociacao: 25, proposta: 16, fechamento: 6 },
      { periodo: "18 ago", qualificacao: 53, negociacao: 31, proposta: 19, fechamento: 8 },
      { periodo: "25 ago", qualificacao: 58, negociacao: 34, proposta: 22, fechamento: 9 },
      { periodo: "01 set", qualificacao: 51, negociacao: 33, proposta: 21, fechamento: 8 },
      { periodo: "08 set", qualificacao: 62, negociacao: 38, proposta: 24, fechamento: 11 },
      { periodo: "15 set", qualificacao: 57, negociacao: 36, proposta: 26, fechamento: 12 },
    ],
  },
  {
    chave: "6m",
    rotulo: "6 meses",
    pontos: [
      { periodo: "abr", qualificacao: 168, negociacao: 92, proposta: 54, fechamento: 21 },
      { periodo: "mai", qualificacao: 182, negociacao: 101, proposta: 61, fechamento: 24 },
      { periodo: "jun", qualificacao: 174, negociacao: 96, proposta: 58, fechamento: 22 },
      { periodo: "jul", qualificacao: 196, negociacao: 112, proposta: 68, fechamento: 27 },
      { periodo: "ago", qualificacao: 218, negociacao: 127, proposta: 76, fechamento: 31 },
      { periodo: "set", qualificacao: 231, negociacao: 138, proposta: 84, fechamento: 36 },
    ],
  },
];

const ETAPAS_TEMPO = [
  { chave: "qualificacao" as const, rotulo: "Qualificação", serie: 1 },
  { chave: "negociacao" as const, rotulo: "Negociação", serie: 2 },
  { chave: "proposta" as const, rotulo: "Proposta", serie: 3 },
  { chave: "fechamento" as const, rotulo: "Fechamento", serie: 4 },
];

const CONFIG_FUNIL_TEMPO = {
  qualificacao: { label: "Qualificação", color: "var(--chart-1)" },
  negociacao: { label: "Negociação", color: "var(--chart-2)" },
  proposta: { label: "Proposta", color: "var(--chart-3)" },
  fechamento: { label: "Fechamento", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** O funil no TEMPO, não o de agora.
 *
 * O funil estático responde "onde os negócios estão hoje". Este responde "o
 * funil está engordando ou secando, e em qual etapa". Os tiles em cima trazem a
 * taxa de passagem do período inteiro, porque é ela que diz onde o problema
 * está — volume que sobe com passagem que cai é topo inflado, não crescimento. */
export function FunilNoTempo() {
  const reduzido = useReducedMotion();
  const [recorte, setRecorte] = React.useState(FUNIL_TEMPO[0].chave);
  const atual = FUNIL_TEMPO.find((r) => r.chave === recorte) ?? FUNIL_TEMPO[0];

  const passagens = React.useMemo(() => {
    const soma = (chave: keyof Omit<PontoFunil, "periodo">) =>
      atual.pontos.reduce((s, p) => s + p[chave], 0);
    const totais = ETAPAS_TEMPO.map((e) => ({ ...e, total: soma(e.chave) }));
    return totais.map((etapa, i) => ({
      ...etapa,
      /* Passagem da etapa anterior para esta. A primeira não tem de onde vir. */
      taxa: i === 0 ? null : Math.round((etapa.total / totais[i - 1].total) * 100),
    }));
  }, [atual]);

  return (
    <div className="ser-cartao">
      <header className="ser-cartao-topo">
        <p className="ser-rotulo">Funil ao longo do tempo</p>
        <Abas rotulo="Período do funil" itens={FUNIL_TEMPO} ativo={recorte} aoTrocar={setRecorte} />
      </header>

      <ul className="ser-tiles">
        {passagens.map((p) => (
          <li key={p.chave} className="ser-tile">
            <span className="ser-tile-rotulo">
              <i style={{ background: `var(--chart-${p.serie})` }} aria-hidden />
              {p.rotulo}
            </span>
            <strong className="ser-tile-valor">{p.total}</strong>
            <span className="ser-tile-apoio" data-gargalo={p.taxa !== null && p.taxa < 50 ? "true" : undefined}>
              {p.taxa === null ? "entrada do funil" : `${p.taxa}% da etapa anterior`}
            </span>
          </li>
        ))}
      </ul>

      <ChartContainer config={CONFIG_FUNIL_TEMPO} className="ser-chart" style={{ height: "calc(210 * var(--onface-u))" }}>
        <AreaChart data={atual.pontos} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="periodo" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          {/* Empilhado, não sobreposto: a altura total é o funil inteiro e cada
              faixa é a etapa. Sobrepor daria quatro leituras concorrentes. */}
          {ETAPAS_TEMPO.map((e) => (
            <Area
              key={e.chave}
              dataKey={e.chave}
              stackId="funil"
              type="monotone"
              stroke={`var(--color-${e.chave})`}
              strokeWidth={SVG.tracoApoio}
              fill={`var(--color-${e.chave})`}
              fillOpacity={0.24}
              isAnimationActive={!reduzido}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ 7. Painel escuro composto ═══════════════════════════════════════════ */

const OPERACAO = [
  {
    chave: "dia", rotulo: "Dia",
    pontos: [
      { t: "08h", chamadas: 38, atendimento: 61 }, { t: "09h", chamadas: 96, atendimento: 68 },
      { t: "10h", chamadas: 124, atendimento: 72 }, { t: "11h", chamadas: 118, atendimento: 70 },
      { t: "14h", chamadas: 102, atendimento: 66 }, { t: "15h", chamadas: 131, atendimento: 74 },
      { t: "16h", chamadas: 147, atendimento: 78 }, { t: "17h", chamadas: 112, atendimento: 69 },
    ],
  },
  {
    chave: "semana", rotulo: "Semana",
    pontos: [
      { t: "Seg", chamadas: 684, atendimento: 71 }, { t: "Ter", chamadas: 742, atendimento: 74 },
      { t: "Qua", chamadas: 711, atendimento: 72 }, { t: "Qui", chamadas: 806, atendimento: 77 },
      { t: "Sex", chamadas: 598, atendimento: 68 },
    ],
  },
  {
    chave: "mes", rotulo: "Mês",
    pontos: [
      { t: "S1", chamadas: 3182, atendimento: 70 }, { t: "S2", chamadas: 3446, atendimento: 73 },
      { t: "S3", chamadas: 3298, atendimento: 71 }, { t: "S4", chamadas: 3712, atendimento: 76 },
    ],
  },
];

const CONFIG_OPERACAO = {
  chamadas: { label: "Chamadas", color: "var(--chart-1)" },
  atendimento: { label: "Atendidas", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Painel de monitoramento em grafite.
 *
 * O escuro não é tema deste componente: é o escopo `data-onface-superficie` que
 * já existe na fundação. Ele reaponta a camada semântica inteira, então eixo,
 * grade, tooltip e abas vêm legíveis sem uma linha de cor aqui. Use em tela de
 * parede e em momento de decisão, não porque ficou bonito no meio do papel. */
export function PainelOperacaoEscuro() {
  const reduzido = useReducedMotion();
  const [recorte, setRecorte] = React.useState(OPERACAO[0].chave);
  const atual = OPERACAO.find((r) => r.chave === recorte) ?? OPERACAO[0];
  const total = atual.pontos.reduce((s, p) => s + p.chamadas, 0);

  return (
    <div className="ser-cartao" data-onface-superficie="escura">
      <header className="ser-cartao-topo">
        <div>
          <p className="ser-rotulo">Operação ao vivo · chamadas</p>
          <p className="ser-numero">{total.toLocaleString("pt-BR")}</p>
        </div>
        <Abas rotulo="Recorte da operação" itens={OPERACAO} ativo={recorte} aoTrocar={setRecorte} />
      </header>

      <ChartContainer config={CONFIG_OPERACAO} className="ser-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
        <ComposedChart data={atual.pontos} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} />
          <YAxis yAxisId="vol" tickLine={false} axisLine={false} width={44} />
          <YAxis yAxisId="taxa" orientation="right" tickLine={false} axisLine={false} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            yAxisId="vol" dataKey="chamadas" type="monotone"
            stroke="var(--color-chamadas)" strokeWidth={SVG.traco}
            fill="var(--color-chamadas)" fillOpacity={0.18}
            isAnimationActive={!reduzido}
          />
          <Line
            yAxisId="taxa" dataKey="atendimento" type="monotone"
            stroke="var(--color-atendimento)" strokeWidth={SVG.tracoApoio}
            strokeDasharray={SVG.tracejado} dot={false} activeDot={{ r: 4 }}
            isAnimationActive={!reduzido}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ 8. Barras horizontais (ranking) ═════════════════════════════════════ */

type Ranking = { chave: string; rotulo: string; linhas: { rotulo: string; valor: number }[] };

/** Ranking é agrupamento do funil de verdade, não número inventado. */
function agrupar(campo: "empresa" | "produto" | "origem"): { rotulo: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const n of NEGOCIOS) {
    if (n.etapa === "Perdido") continue; // pipeline em aberto e ganho; perdido não é ranking
    mapa.set(n[campo], (mapa.get(n[campo]) ?? 0) + n.valor);
  }
  return [...mapa].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6);
}

const CONFIG_RANKING = { valor: { label: "Em pipeline", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Barra horizontal porque o rótulo é NOME.
 *
 * Em barra vertical "Imobiliária Costa Verde" vira `Imobiliá…`, gira 45° ou
 * some. Deitada, o nome ocupa a linha inteira e a comparação continua sendo
 * comprimento, que é o que o olho mede melhor. Até uns dez itens; acima disso a
 * leitura vira tabela ordenável, não gráfico. */
export function RankingHorizontal() {
  const reduzido = useReducedMotion();
  const recortes: Ranking[] = React.useMemo(
    () => [
      { chave: "conta", rotulo: "Contas", linhas: agrupar("empresa") },
      { chave: "produto", rotulo: "Produtos", linhas: agrupar("produto") },
      { chave: "origem", rotulo: "Origens", linhas: agrupar("origem") },
    ],
    []
  );
  const [recorte, setRecorte] = React.useState("conta");
  const atual = recortes.find((r) => r.chave === recorte) ?? recortes[0];

  return (
    <div className="ser-cartao">
      <header className="ser-cartao-topo">
        <p className="ser-rotulo">Maiores em pipeline</p>
        <Abas rotulo="Recorte do ranking" itens={recortes} ativo={recorte} aoTrocar={setRecorte} />
      </header>

      <ChartContainer config={CONFIG_RANKING} className="ser-chart" style={{ height: "calc(220 * var(--onface-u))" }}>
        <BarChart data={atual.linhas} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category" dataKey="rotulo" tickLine={false} axisLine={false}
            width={132} tickMargin={SVG.espacoTick}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v) => brl(Number(v))} />} cursor={{ fill: "var(--onface-coral-subtle)" }} />
          <Bar dataKey="valor" radius={[0, SVG.raioBarra, SVG.raioBarra, 0]} maxBarSize={22} isAnimationActive={!reduzido}>
            {/* Só o primeiro em coral: ranking já ordena, então a cor não precisa
                repetir a ordem — ela marca quem responde à pergunta. */}
            {atual.linhas.map((linha, i) => (
              <Cell key={linha.rotulo} fill={i === 0 ? "var(--chart-1)" : "var(--chart-3)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ 9. Área em degrau com preenchimento pontilhado ══════════════════════ */

const LICENCAS = [
  { mes: "out", contratadas: 180, emUso: 142 },
  { mes: "nov", contratadas: 180, emUso: 158 },
  { mes: "dez", contratadas: 180, emUso: 166 },
  { mes: "jan", contratadas: 240, emUso: 178 },
  { mes: "fev", contratadas: 240, emUso: 201 },
  { mes: "mar", contratadas: 240, emUso: 219 },
  { mes: "abr", contratadas: 240, emUso: 232 },
  { mes: "mai", contratadas: 320, emUso: 244 },
  { mes: "jun", contratadas: 320, emUso: 268 },
  { mes: "jul", contratadas: 320, emUso: 291 },
  { mes: "ago", contratadas: 400, emUso: 312 },
  { mes: "set", contratadas: 400, emUso: 344 },
];

const CONFIG_LICENCAS = {
  contratadas: { label: "Licenças contratadas", color: "var(--chart-3)" },
  emUso: { label: "Em uso", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Degrau para o que muda em SALTO.
 *
 * Licença contratada não sobe em rampa: ela fica parada e pula no dia em que o
 * contrato é aditado. Interpolar isso com curva desenha um crescimento que
 * nunca existiu e faz alguém ler "estávamos em 210 em fevereiro". O degrau
 * mostra o patamar e o dia do salto.
 *
 * O preenchimento pontilhado marca o que é CAPACIDADE (contratado, teto) contra
 * o que é USO (chapado). Padrão em vez de mais uma cor: o teto não é outra
 * série disputando atenção, é o fundo contra o qual o uso é lido. */
export function AreaEmDegrau() {
  const reduzido = useReducedMotion();
  const id = useIdSvg("ser-pontilhado");

  return (
    <ChartContainer config={CONFIG_LICENCAS} className="ser-chart" style={{ height: "calc(210 * var(--onface-u))" }}>
      <AreaChart data={LICENCAS} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {/* `userSpaceOnUse` para o ponto ter o mesmo tamanho em qualquer
              largura do cartão; `objectBoundingBox` esticaria o padrão junto
              com a área e o pontilhado viraria oval. */}
          <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1.6" cy="1.6" r="1.1" fill="var(--color-contratadas)" fillOpacity="0.55" />
          </pattern>
        </defs>

        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />

        <Area
          dataKey="contratadas" type="stepAfter"
          stroke="var(--color-contratadas)" strokeWidth={SVG.tracoApoio} strokeDasharray={SVG.tracejado}
          fill={`url(#${id})`} fillOpacity={1}
          isAnimationActive={!reduzido}
        />
        <Area
          dataKey="emUso" type="monotone"
          stroke="var(--color-emUso)" strokeWidth={SVG.traco}
          fill="var(--color-emUso)" fillOpacity={SVG.preenchimento}
          isAnimationActive={!reduzido}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/* ═══ 10. Área empilhada com hachura cruzada ══════════════════════════════ */

const CONFIG_HACHURA = {
  ligacao: { label: "Ligações", color: "var(--chart-1)" },
  whatsapp: { label: "WhatsApp", color: "var(--chart-2)" },
  email: { label: "E-mails", color: "var(--chart-3)" },
} satisfies ChartConfig;

const SERIES_HACHURA = [
  { chave: "ligacao" as const, angulo: 45 },
  { chave: "whatsapp" as const, angulo: -45 },
  { chave: "email" as const, angulo: 0 },
];

/** Empilhada com textura: a série é reconhecível sem depender de cor.
 *
 * Três faixas coladas no mesmo eixo, distinguidas só por tom, são exatamente o
 * caso em que a pessoa daltônica (e quem imprime em preto e branco) perde o
 * gráfico. A hachura muda de ângulo por série, então a diferença sobrevive à
 * cor. Use quando as faixas se tocam; em série separada é excesso. */
export function AreaHachurada() {
  const reduzido = useReducedMotion();
  const base = useIdSvg("ser-hachura");

  return (
    <ChartContainer config={CONFIG_HACHURA} className="ser-chart" style={{ height: "calc(210 * var(--onface-u))" }}>
      <AreaChart data={CANAIS_SEMANAIS} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {SERIES_HACHURA.map((s) => (
            <pattern
              key={s.chave}
              id={`${base}-${s.chave}`}
              width="7" height="7"
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${s.angulo})`}
            >
              {/* Fundo chapado fraco + traço: só o traço deixaria a faixa
                  transparente e o empilhamento perderia o contorno de volume. */}
              <rect width="7" height="7" fill={`var(--color-${s.chave})`} fillOpacity="0.1" />
              <line x1="0" y1="0" x2="0" y2="7" stroke={`var(--color-${s.chave})`} strokeWidth="1.6" strokeOpacity="0.5" />
            </pattern>
          ))}
        </defs>

        <CartesianGrid vertical={false} />
        <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />

        {SERIES_HACHURA.map((s) => (
          <Area
            key={s.chave}
            dataKey={s.chave}
            stackId="canais"
            type="monotone"
            stroke={`var(--color-${s.chave})`}
            strokeWidth={SVG.tracoApoio}
            fill={`url(#${base}-${s.chave})`}
            fillOpacity={1}
            isAnimationActive={!reduzido}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/* ═══ Bônus. Radar com preenchimento em degradê ═══════════════════════════ */

const CONFIG_RADAR_GRAD = { mayara: { label: "Mayara", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Variante do `RadarDesempenho` com o miolo em degradê da MESMA cor.
 *
 * O degradê aqui não é enfeite e não é arco-íris: ele é de opacidade, do centro
 * para a borda, e serve a um polígono só. Isso tira o peso da mancha central
 * (onde cinco eixos se sobrepõem e o preenchimento chapado empasta) sem perder
 * a silhueta. Com duas séries no mesmo quadro, volte para o chapado: dois
 * degradês sobrepostos não deixam ler nenhum dos dois. */
export function RadarGradiente() {
  const reduzido = useReducedMotion();
  const id = useIdSvg("ser-radar-grad");

  return (
    <ChartContainer config={CONFIG_RADAR_GRAD} className="ser-chart" style={{ height: "calc(200 * var(--onface-u))" }}>
      <RadarChart data={DESEMPENHO_RADAR} outerRadius="72%">
        <defs>
          <radialGradient id={id}>
            <stop offset="0%" stopColor="var(--color-mayara)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--color-mayara)" stopOpacity="0.4" />
          </radialGradient>
        </defs>
        <PolarGrid gridType="circle" radialLines={false} />
        <PolarAngleAxis dataKey="eixo" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar
          dataKey="mayara"
          stroke="var(--color-mayara)"
          strokeWidth={SVG.traco}
          fill={`url(#${id})`}
          fillOpacity={1}
          dot={{ r: 3, fillOpacity: 1 }}
          isAnimationActive={!reduzido}
        />
      </RadarChart>
    </ChartContainer>
  );
}
