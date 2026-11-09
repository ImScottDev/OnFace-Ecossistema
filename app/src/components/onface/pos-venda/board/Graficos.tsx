"use client";

/**
 * Gráficos do board. Saem do mesmo `ChartContainer` do repositório
 * (shadcn + recharts), com as três disciplinas do molde de `ds/graficos.tsx`:
 * esqueleto com a forma do gráfico, estado vazio que diz o motivo, e
 * `prefers-reduced-motion` desligando a animação.
 *
 * Cor aqui é ESTADO e só estado, e é a mesma do resto da tela (pílula, barra,
 * faixa): o leitor aprende uma vez que azul é andamento e âmbar é espera. Por
 * isso as cores vêm dos tokens `--pv-*-barra`, e não de uma paleta de série.
 *
 * Cada gráfico tem o equivalente em texto (a legenda em links), porque rosca
 * e coluna não são lidas por leitor de tela e o filtro mora na legenda.
 */
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { ChartColumnBig, ChartPie } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { EstadoDoProjeto, FiltrosDoBoard } from "@/lib/pos-venda/contrato";
import { ESTADO_DO_PROJETO } from "../formatos";
import { hrefDoBoard, type Vista } from "../parametros";
import type { SemanaDeEntrada } from "./analise";

/** Recharts desenha em unidades SVG e não lê `var()` em medida: as únicas
 *  medidas numéricas do arquivo ficam nomeadas aqui. */
const SVG = { furoRosca: "68%", bordaRosca: "96%", folga: 2, raioColuna: 4, espacoTick: 8 } as const;

const COR_DO_ESTADO: Record<EstadoDoProjeto, string> = {
  NAO_INICIADO: "var(--pv-neutro-barra)",
  EM_ANDAMENTO: "var(--pv-andamento-barra)",
  AGUARDANDO: "var(--pv-espera-barra)",
  EM_VALIDACAO: "var(--pv-validacao-barra)",
  CONCLUIDO: "var(--pv-ok-barra)",
  CANCELADO: "var(--pv-borda-forte)",
};

export function VazioDoGrafico({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="pv-g-vazio" role="status">
      <span className="pv-g-vazio-icone" aria-hidden>{icone}</span>
      <strong>{titulo}</strong>
      <p>{texto}</p>
    </div>
  );
}

export function EsqueletoDoGrafico({ forma }: { forma: "rosca" | "colunas" }) {
  return (
    <div className="pv-g-esqueleto" role="status" data-forma={forma}>
      <span className="pv-sr-only">Carregando gráfico</span>
      {forma === "rosca" ? (
        <Skeleton className="pv-g-esq-rosca" aria-hidden />
      ) : (
        <div className="pv-g-esq-colunas" aria-hidden>
          {[34, 58, 22, 70, 46, 82, 30, 52].map((h, i) => <Skeleton key={i} style={{ height: `${h}%` }} />)}
        </div>
      )}
    </div>
  );
}

/* ═══ Rosca: distribuição por estado ═════════════════════════════════════ */

export function RoscaDeEstados({
  dados,
  filtros,
  vista,
}: {
  dados: Array<{ estado: EstadoDoProjeto; n: number }>;
  filtros: FiltrosDoBoard;
  vista: Vista;
}) {
  const reduzido = useReducedMotion();
  const totalGeral = dados.reduce((s, d) => s + d.n, 0);
  // A rosca mostra o que está EM ABERTO: 36 concluídos pintando dois terços do
  // anel diriam "está tudo bem" justo onde há trabalho parado. Os encerrados
  // seguem na legenda, em cinza, e continuam sendo filtro. Se não há nada
  // aberto (recorte "concluídos"), a rosca mostra o que existe.
  const abertos = dados.filter((d) => d.estado !== "CONCLUIDO" && d.estado !== "CANCELADO");
  const noAnel = abertos.length > 0 ? abertos : dados;
  const total = noAnel.reduce((s, d) => s + d.n, 0);

  if (totalGeral === 0) {
    return <VazioDoGrafico icone={<ChartPie />} titulo="Nenhum projeto neste recorte" texto="Quando houver projetos, a distribuição por estado aparece aqui." />;
  }

  const config: ChartConfig = Object.fromEntries(noAnel.map((d) => [d.estado, { label: ESTADO_DO_PROJETO[d.estado].rotulo, color: COR_DO_ESTADO[d.estado] }]));
  const rotular = (d: { estado: EstadoDoProjeto; n: number }) => ({ ...d, rotulo: ESTADO_DO_PROJETO[d.estado].rotulo, fill: COR_DO_ESTADO[d.estado] });
  const pontos = noAnel.map(rotular);
  const encerrados = abertos.length > 0 ? dados.filter((d) => d.estado === "CONCLUIDO" || d.estado === "CANCELADO").map(rotular) : [];

  return (
    <div className="pv-g-rosca">
      <div className="pv-g-rosca-figura" role="img" aria-label={`${total} projetos: ${pontos.map((p) => `${p.n} ${p.rotulo.toLowerCase()}`).join(", ")}`}>
        <ChartContainer config={config} className="pv-g-rosca-grafico">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="rotulo" />} />
            <Pie data={pontos} dataKey="n" nameKey="rotulo" innerRadius={SVG.furoRosca} outerRadius={SVG.bordaRosca} paddingAngle={SVG.folga} strokeWidth={0} isAnimationActive={!reduzido}>
              {pontos.map((p) => <Cell key={p.estado} fill={p.fill} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pv-g-rosca-centro" aria-hidden>
          <strong>{total}</strong>
          <span>{abertos.length > 0 ? "em aberto" : total === 1 ? "projeto" : "projetos"}</span>
        </div>
      </div>
      <ul className="pv-g-legenda">
        {[...pontos, ...encerrados].map((p, i) => {
          const ativo = filtros.estado === p.estado;
          return (
            <li key={p.estado} data-encerrado={i >= pontos.length || undefined}>
              <Link
                href={ativo ? hrefDoBoard(filtros, { estado: null }, vista) : hrefDoBoard(filtros, { estado: p.estado, recorte: null }, vista)}
                aria-current={ativo ? "true" : undefined}
                aria-label={`${p.rotulo}: ${p.n}. ${ativo ? "Filtro ligado, clique para limpar" : "Clique para filtrar"}`}
              >
                <i style={{ background: p.fill }} aria-hidden />
                <span className="pv-g-legenda-nome">{p.rotulo}</span>
                <b>{p.n}</b>
                <span className="pv-g-legenda-pct">{Math.round((p.n / totalGeral) * 100)}%</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ═══ Colunas: entradas por janela de 7 dias ═════════════════════════════ */

const CONFIG_ENTRADAS = { entradas: { label: "Entraram", color: "var(--pv-andamento-barra)" } } satisfies ChartConfig;

export function ColunasDeEntradas({ dados }: { dados: SemanaDeEntrada[] }) {
  const reduzido = useReducedMotion();
  const total = dados.reduce((s, d) => s + d.entradas, 0);

  if (total === 0) {
    return <VazioDoGrafico icone={<ChartColumnBig />} titulo="Nada entrou nos últimos 70 dias" texto="Cada venda ganha abre um projeto. Quando entrarem, o ritmo aparece aqui." />;
  }

  const ultimas = dados.slice(-3).reduce((s, d) => s + d.entradas, 0);

  return (
    <div className="pv-g-colunas">
      <ChartContainer config={CONFIG_ENTRADAS} className="pv-g-colunas-grafico">
        <BarChart data={dados} accessibilityLayer margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} interval="preserveStartEnd" minTickGap={24} />
          <YAxis width={24} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator labelFormatter={(_, itens) => (itens?.[0]?.payload as SemanaDeEntrada | undefined)?.intervalo ?? ""} />} />
          <Bar dataKey="entradas" radius={SVG.raioColuna} isAnimationActive={!reduzido}>
            {dados.map((d) => <Cell key={d.rotulo} fill={d.entradas === 0 ? "var(--pv-borda)" : "var(--color-entradas)"} fillOpacity={d.atual ? 1 : 0.78} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="pv-g-nota">
        <b>{total}</b> {total === 1 ? "projeto entrou" : "projetos entraram"} em 70 dias
        {ultimas === 0 ? <> e <b>nenhum</b> nas últimas 3 semanas</> : null}.
      </p>
    </div>
  );
}
