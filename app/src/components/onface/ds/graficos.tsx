"use client";

/** Gráficos do ONFACE.
 *
 * Todos os gráficos cartesianos e a rosca saem do `ChartContainer` do repo
 * (shadcn + recharts), não de um wrapper novo: é ele que injeta as variáveis
 * `--color-<serie>` e normaliza grade, cursor e foco. Um segundo container
 * seria um segundo design system.
 *
 * Disciplina de cor: coral (`--cf2-serie-1`) é sempre a série que a pessoa
 * veio ver; o resto é apoio em cinza. Comparativo, meta batida e etapa final
 * são os únicos lugares onde a cor carrega significado.
 *
 * Todo componente aqui tem três estados de verdade, porque os três acontecem
 * em produção: carregando (esqueleto com a forma do gráfico), vazio (conta
 * nova, filtro que zerou) e com dado. */

import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis,
} from "recharts";
import { useReducedMotion, motion } from "motion/react";
import { ChartColumnBig, ChartSpline, ChevronDown, PieChart as IconePizza, Target } from "lucide-react";
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, compacto, FUNIL, ORIGENS, RECEITA_SEMANAL, RESPONSAVEIS } from "./dados";
import { MOLA } from "./motion";
import "./graficos.css";

/** Recharts desenha em unidades SVG e não entende `var()` nem `calc()`. Estas
 * são as únicas medidas numéricas do arquivo: ficam nomeadas em um lugar só,
 * em vez de viradas número mágico dentro do JSX. 1 unidade = 1px da prancheta
 * de 1440, a mesma régua de `--onface-u`. */
const SVG = {
  /** --radius-xs */
  raioBarra: 4,
  traco: 2,
  /** --space-8 entre o eixo e o rótulo */
  espacoTick: 8,
  tracejado: "5 4",
  preenchimento: 0.12,
  furoRosca: "64%",
  bordaRosca: "92%",
  folgaFatia: 2,
  fatiaApagada: 0.35,
} as const;

/* ═══ Leitura do payload do recharts ══════════════════════════════════════
 * O tooltip entrega o ponto como objeto solto. Em vez de espalhar `as` por
 * todo lado, a leitura é feita em um lugar só e devolve tipo fechado. */
function leCampo(fonte: unknown, chave: string): unknown {
  return fonte && typeof fonte === "object" ? (fonte as Record<string, unknown>)[chave] : undefined;
}
function leNumero(fonte: unknown, chave: string): number {
  const valor = leCampo(fonte, chave);
  return typeof valor === "number" ? valor : 0;
}
function leTexto(fonte: unknown, chave: string): string {
  const valor = leCampo(fonte, chave);
  return typeof valor === "string" ? valor : "";
}

/** O `ChartTooltipContent` só formata número cru (`toLocaleString`): "42.600"
 * em vez de "R$ 42.600". Quem passa `formatter` assume a linha inteira, então
 * o ponto da série é redesenhado aqui junto com o rótulo. */
function moedaPorSerie(config: ChartConfig) {
  return function formatarMoeda(valor: unknown, nome: unknown, item: unknown): React.ReactNode {
    const chave = String(nome ?? "");
    return (
      <>
        <span
          className="of-g-tt-ponto"
          style={{ background: leTexto(item, "color") || "var(--cf2-serie-1)" }}
          aria-hidden="true"
        />
        <span className="of-g-tt-nome">{config[chave]?.label ?? chave}</span>
        <span className="of-g-tt-valor">{typeof valor === "number" ? brl(valor) : String(valor)}</span>
      </>
    );
  };
}

/* ═══ Estados compartilhados ═════════════════════════════════════════════ */

type Forma = "area" | "barras" | "rosca" | "funil" | "lista" | "mini";

/** O esqueleto tem a forma do gráfico que vem depois. Bloco cinza genérico
 * avisa "carregando" mas não prepara o olho para o que vai aparecer, e a
 * página ainda pula de altura na troca. */
function EsqueletoGrafico({ forma }: { forma: Forma }) {
  return (
    <div className="of-g-moldura" data-forma={forma} role="status">
      <span className="sr-only">Carregando gráfico</span>
      {forma === "area" ? (
        <div className="of-g-esq-area" aria-hidden="true">
          <Skeleton className="of-g-esq-bloco" />
          <div className="of-g-esq-eixo">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="of-g-esq-tick" />)}
          </div>
        </div>
      ) : null}
      {forma === "barras" ? (
        <div className="of-g-esq-area" aria-hidden="true">
          <div className="of-g-esq-barras">
            {[62, 88, 100, 46, 34].map((altura) => (
              <Skeleton key={altura} className="of-g-esq-barra" style={{ height: `${altura}%` }} />
            ))}
          </div>
          <div className="of-g-esq-eixo">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="of-g-esq-tick" />)}
          </div>
        </div>
      ) : null}
      {forma === "rosca" ? (
        <Skeleton className="of-g-esq-rosca" aria-hidden="true">
          <span className="of-g-esq-furo" />
        </Skeleton>
      ) : null}
      {forma === "funil" ? (
        <div className="of-g-esq-funil" aria-hidden="true">
          {[100, 76, 54, 32].map((largura) => (
            <Skeleton key={largura} className="of-g-esq-faixa" style={{ width: `${largura}%` }} />
          ))}
        </div>
      ) : null}
      {forma === "lista" ? (
        <div className="of-g-esq-lista" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="of-g-esq-par">
              <Skeleton className="of-g-esq-rotulo" />
              <Skeleton className="of-g-esq-trilho" />
            </div>
          ))}
        </div>
      ) : null}
      {forma === "mini" ? <Skeleton className="of-g-esq-mini" aria-hidden="true" /> : null}
    </div>
  );
}

function VazioGrafico({
  forma, icone, titulo, texto,
}: {
  forma: Forma;
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="of-g-moldura" data-forma={forma}>
      <div className="ds-vazio">
        <span className="ds-vazio-figura">{icone}</span>
        <strong>{titulo}</strong>
        <p>{texto}</p>
      </div>
    </div>
  );
}

/* ═══ Área comparativa ═══════════════════════════════════════════════════ */

export type PontoReceita = { semana: string; atual: number; anterior: number };

const CONFIG_RECEITA = {
  atual: { label: "Período atual", color: "var(--cf2-serie-1)" },
  anterior: { label: "Período anterior", color: "var(--cf2-serie-3)" },
} satisfies ChartConfig;

const FORMATA_RECEITA = moedaPorSerie(CONFIG_RECEITA);

/** Receita ganha por semana contra o mesmo intervalo anterior.
 *
 * O período anterior é linha tracejada sem preenchimento: ele é régua, não
 * assunto. Duas áreas cheias empilhariam duas manchas e a leitura viraria
 * "qual das duas é a minha?". */
export function AreaComparativa({
  dados = RECEITA_SEMANAL,
  carregando = false,
}: {
  dados?: PontoReceita[];
  carregando?: boolean;
}) {
  const reduzido = useReducedMotion();

  if (carregando) return <EsqueletoGrafico forma="area" />;
  if (dados.length === 0) {
    return (
      <VazioGrafico
        forma="area"
        icone={<ChartSpline />}
        titulo="Sem receita no período"
        texto="Nenhum negócio ganho entre as datas selecionadas. Amplie o intervalo ou revise os filtros."
      />
    );
  }

  return (
    <ChartContainer config={CONFIG_RECEITA} className="of-g">
      <AreaChart data={dados} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} />
        <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={compacto} />
        <ChartTooltip content={<ChartTooltipContent formatter={FORMATA_RECEITA} />} />
        <Area
          dataKey="anterior"
          type="monotone"
          stroke="var(--color-anterior)"
          strokeWidth={SVG.traco}
          strokeDasharray={SVG.tracejado}
          fill="none"
          dot={false}
          isAnimationActive={!reduzido}
        />
        <Area
          dataKey="atual"
          type="monotone"
          stroke="var(--color-atual)"
          strokeWidth={SVG.traco}
          fill="var(--color-atual)"
          fillOpacity={SVG.preenchimento}
          dot={false}
          isAnimationActive={!reduzido}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}

/* ═══ Barras por etapa ═══════════════════════════════════════════════════ */

export type PontoEtapa = { etapa: string; quantidade: number; valor: number };

const CONFIG_ETAPA = {
  quantidade: { label: "Negócios", color: "var(--cf2-serie-1)" },
} satisfies ChartConfig;

/** Quantidade manda na altura, valor vive no tooltip: as duas métricas têm
 * ordem de grandeza diferente (dezenas contra centenas de milhares) e no mesmo
 * eixo uma delas viraria uma linha rente ao chão. */
const FORMATA_ETAPA = (valor: unknown, _nome: unknown, item: unknown): React.ReactNode => (
  <div className="of-g-tt-duplo">
    <span className="of-g-tt-nome">Negócios</span>
    <span className="of-g-tt-valor">{typeof valor === "number" ? valor : 0}</span>
    <span className="of-g-tt-nome">Valor em aberto</span>
    <span className="of-g-tt-valor">{brl(leNumero(leCampo(item, "payload"), "valor"))}</span>
  </div>
);

export function BarrasPorEtapa({
  dados = FUNIL,
  carregando = false,
}: {
  dados?: PontoEtapa[];
  carregando?: boolean;
}) {
  const reduzido = useReducedMotion();

  if (carregando) return <EsqueletoGrafico forma="barras" />;
  if (dados.length === 0) {
    return (
      <VazioGrafico
        forma="barras"
        icone={<ChartColumnBig />}
        titulo="Funil sem negócios"
        texto="Nenhuma etapa tem negócio aberto com os filtros atuais."
      />
    );
  }

  return (
    <ChartContainer config={CONFIG_ETAPA} className="of-g">
      <BarChart data={dados} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="etapa" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick} />
        <YAxis width="auto" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent hideIndicator formatter={FORMATA_ETAPA} />} />
        <Bar
          dataKey="quantidade"
          fill="var(--color-quantidade)"
          radius={SVG.raioBarra}
          isAnimationActive={!reduzido}
        />
      </BarChart>
    </ChartContainer>
  );
}

/* ═══ Rosca de origem ════════════════════════════════════════════════════ */

export type FatiaOrigem = { origem: string; valor: number };

/** Quatro degraus só: acima disso a rosca vira paleta e ninguém lê fatia de
 * 3%. O que sobra entra como "Outros", que é o que `dados.ts` já faz.
 *
 * O coral não é o primeiro item da lista: é a origem que MAIS traz pipeline,
 * calculada a cada render. O resto desce por uma escada de cinza que vai do
 * escuro ao claro — contraste de valor, não de matiz. Coral mais um coral
 * claro, como era antes, dava duas fatias quentes disputando o mesmo papel. */
const CINZAS_ORIGEM = ["var(--onface-cinza-3)", "var(--onface-cinza)", "var(--onface-slate)"] as const;

function indicePrincipal(dados: FatiaOrigem[]): number {
  return dados.reduce((maior, fatia, i) => (fatia.valor > (dados[maior]?.valor ?? 0) ? i : maior), 0);
}

function corDaFatia(indice: number, principal: number): string {
  if (indice === principal) return "var(--cf2-serie-1)";
  // Quem vem depois da líder não pula um degrau de cinza por causa dela.
  const posicao = indice > principal ? indice - 1 : indice;
  return CINZAS_ORIGEM[posicao % CINZAS_ORIGEM.length] ?? "var(--cf2-serie-4)";
}

function configDeOrigem(dados: FatiaOrigem[], principal: number): ChartConfig {
  return Object.fromEntries(
    dados.map((fatia, i) => [fatia.origem, { label: fatia.origem, color: corDaFatia(i, principal) }]),
  );
}

/** Rosca de participação por origem.
 *
 * O centro não é enfeite: em repouso mostra o total e, ao passar por uma
 * fatia (mouse, foco ou toque na legenda), vira o valor daquela origem. É o
 * que substitui o rótulo em cima de cada fatia, que em 13% não cabe. */
export function RoscaOrigem({
  dados = ORIGENS,
  carregando = false,
}: {
  dados?: FatiaOrigem[];
  carregando?: boolean;
}) {
  const reduzido = useReducedMotion();
  const [ativa, setAtiva] = React.useState<number | null>(null);
  const principal = React.useMemo(() => indicePrincipal(dados), [dados]);
  const config = React.useMemo(() => configDeOrigem(dados, principal), [dados, principal]);
  const total = React.useMemo(() => dados.reduce((soma, fatia) => soma + fatia.valor, 0), [dados]);

  if (carregando) return <EsqueletoGrafico forma="rosca" />;
  if (dados.length === 0) {
    return (
      <VazioGrafico
        forma="rosca"
        icone={<IconePizza />}
        titulo="Origem não rastreada"
        texto="Nenhum negócio do período tem origem preenchida. Confira a integração do Meta Ads e do formulário do site."
      />
    );
  }

  const destaque = ativa === null ? null : dados[ativa];

  return (
    <div className="of-g-duo">
      <div className="of-g-rosca">
        <ChartContainer config={config} className="of-g" data-forma="rosca">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="origem" hideLabel />} />
            <Pie
              data={dados}
              dataKey="valor"
              nameKey="origem"
              innerRadius={SVG.furoRosca}
              outerRadius={SVG.bordaRosca}
              paddingAngle={SVG.folgaFatia}
              isAnimationActive={!reduzido}
              onMouseEnter={(_: unknown, indice: number) => setAtiva(indice)}
              onMouseLeave={() => setAtiva(null)}
            >
              {dados.map((fatia, i) => (
                /* `opacity` em vez de data-attribute: recharts filtra as props
                   do Cell pelas conhecidas do SVG antes de desenhar o setor,
                   então um `data-*` nunca chegaria no DOM. */
                <Cell
                  key={fatia.origem}
                  fill={corDaFatia(i, principal)}
                  className="of-g-fatia"
                  opacity={ativa !== null && ativa !== i ? SVG.fatiaApagada : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="of-g-rosca-centro">
          <span className="of-g-rosca-valor">{destaque ? destaque.valor : total}%</span>
          <span className="of-g-rosca-rotulo">{destaque ? destaque.origem : "do pipeline com origem"}</span>
        </div>
      </div>

      {/* A legenda é a própria navegação da rosca: no toque não existe hover, e
          fatia de 13% é alvo pequeno demais para o dedo. */}
      <ul className="of-g-legenda">
        {dados.map((fatia, i) => (
          <li key={fatia.origem}>
            <button
              type="button"
              className="of-g-legenda-item"
              data-principal={i === principal ? "true" : undefined}
              data-ativa={ativa === i}
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva(null)}
              onFocus={() => setAtiva(i)}
              onBlur={() => setAtiva(null)}
              onClick={() => setAtiva(i)}
            >
              <span
                className="of-g-legenda-marca"
                style={{ background: corDaFatia(i, principal) }}
                aria-hidden="true"
              />
              <span className="of-g-legenda-nome">{fatia.origem}</span>
              <span className="of-g-legenda-valor">{fatia.valor}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══ Funil comercial ════════════════════════════════════════════════════ */

/** Ganho fica de fora do funil de propósito: os 11 ganhos do período não são
 * a passagem dos 6 negócios que estão em Fechamento agora (coortes
 * diferentes), e a taxa sairia em 183% — o gráfico mentiria com dado certo. */
const ETAPAS_ABERTAS: PontoEtapa[] = FUNIL.filter((etapa) => etapa.etapa !== "Ganho");

/** Funil com largura proporcional e taxa de passagem entre as etapas.
 *
 * Uma série, uma cor: o que muda entre as etapas é a força do coral, que
 * aumenta conforme o negócio chega perto do fechamento. Cor diferente por
 * etapa inventaria cinco métricas onde existe uma. */
export function FunilComercial({
  dados = ETAPAS_ABERTAS,
  carregando = false,
  /** Abaixo disso a passagem é gargalo, não variação. */
  limiteGargalo = 0.5,
}: {
  dados?: PontoEtapa[];
  carregando?: boolean;
  limiteGargalo?: number;
}) {
  const reduzido = useReducedMotion();
  const [aberta, setAberta] = React.useState<string | null>(null);

  if (carregando) return <EsqueletoGrafico forma="funil" />;
  if (dados.length === 0) {
    return (
      <VazioGrafico
        forma="funil"
        icone={<Target />}
        titulo="Nada no funil"
        texto="Sem negócio aberto, não há passagem para medir. Cadastre um negócio ou limpe os filtros."
      />
    );
  }

  const topo = Math.max(...dados.map((etapa) => etapa.quantidade));

  return (
    <div className="of-g-funil">
      {dados.map((etapa, i) => {
        const proxima = dados[i + 1];
        const taxa = proxima ? proxima.quantidade / etapa.quantidade : null;
        const selecionada = aberta === etapa.etapa;
        // 0,72 a 1: a etapa mais próxima do fechamento fica no coral cheio. O
        // piso subiu porque coral a 55% sobre papel branco lê como rosa apagado
        // — a escada tem que continuar sendo coral em todos os degraus.
        const peso = 0.72 + (i / Math.max(dados.length - 1, 1)) * 0.28;

        return (
          <React.Fragment key={etapa.etapa}>
            <button
              type="button"
              className="of-g-funil-etapa"
              aria-pressed={selecionada}
              onClick={() => setAberta(selecionada ? null : etapa.etapa)}
            >
              <span className="of-g-funil-cabeca">
                <span className="of-g-funil-nome">{etapa.etapa}</span>
                <span className="of-g-funil-meta">
                  {etapa.quantidade} negócios · {compacto(etapa.valor)}
                </span>
              </span>
              {/* A proporção da etapa é largura (layout, calculada uma vez); a
                  entrada é scaleX. Animar `width` recalcularia layout a cada
                  quadro, que é justo o que a fundação de movimento proíbe. */}
              <motion.span
                className="of-g-funil-barra"
                style={{ opacity: peso, width: `${(etapa.quantidade / topo) * 100}%` }}
                initial={reduzido ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={reduzido ? { duration: 0 } : MOLA.suave}
              />
              {selecionada ? (
                <span className="of-g-funil-detalhe">
                  Ticket médio de {brl(etapa.valor / etapa.quantidade)} nesta etapa.
                </span>
              ) : null}
            </button>

            {taxa === null ? null : (
              <span className="of-g-funil-passagem" data-alerta={taxa < limiteGargalo}>
                <ChevronDown aria-hidden="true" />
                {Math.round(taxa * 100)}% passa para {proxima?.etapa}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ═══ Minitendência (sparkline) ══════════════════════════════════════════ */

const CONFIG_MINI = {
  ponto: { label: "Tendência", color: "var(--cf2-serie-1)" },
} satisfies ChartConfig;

/** Sparkline para dentro de KPI: sem eixo, sem grade, sem tooltip.
 *
 * Ela responde "subiu ou caiu", não "quanto". O número exato é o KPI que está
 * logo acima; repetir isso no hover só disputaria atenção com ele. Por isso
 * entra como `role="img"` com o resumo no rótulo — leitor de tela recebe a
 * conclusão, não doze pontos soltos. */
export function Minitendencia({
  dados,
  rotulo,
  carregando = false,
}: {
  dados: number[];
  rotulo: string;
  carregando?: boolean;
}) {
  const reduzido = useReducedMotion();
  const pontos = React.useMemo(() => dados.map((ponto, i) => ({ i, ponto })), [dados]);

  if (carregando) return <EsqueletoGrafico forma="mini" />;
  if (pontos.length < 2) {
    return (
      <div className="of-g-moldura" data-forma="mini">
        <p className="of-g-mini-vazio">Sem histórico suficiente</p>
      </div>
    );
  }

  return (
    <div role="img" aria-label={rotulo}>
      <ChartContainer config={CONFIG_MINI} className="of-g" data-forma="mini">
        <AreaChart data={pontos}>
          <Area
            dataKey="ponto"
            type="monotone"
            stroke="var(--color-ponto)"
            strokeWidth={SVG.traco}
            fill="var(--color-ponto)"
            fillOpacity={SVG.preenchimento}
            dot={false}
            isAnimationActive={!reduzido}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/* ═══ Meta por responsável ═══════════════════════════════════════════════ */

export type MetaResponsavel = { nome: string; iniciais: string; meta: number; realizado: number };

/** Barra de meta por responsável.
 *
 * A marca no trilho é o ritmo esperado para a data de hoje. Sem ela, 60% da
 * meta parece bom em qualquer dia do mês — e no dia 25 não é. Quem está
 * abaixo do ritmo fica em coral, pela regra de sinal: coral é o que pede ação
 * agora. Quem está no ritmo é informação neutra e vai para o cinza. */
export function MetaPorResponsavel({
  dados = RESPONSAVEIS,
  carregando = false,
  /** Percentual da meta esperado para hoje dentro do período. */
  ritmoEsperado = 70,
}: {
  dados?: MetaResponsavel[];
  carregando?: boolean;
  ritmoEsperado?: number;
}) {
  const [mostrarFalta, setMostrarFalta] = React.useState(false);

  if (carregando) return <EsqueletoGrafico forma="lista" />;
  if (dados.length === 0) {
    return (
      <VazioGrafico
        forma="lista"
        icone={<Target />}
        titulo="Sem meta no período"
        texto="Defina a meta do time para acompanhar o realizado contra o ritmo esperado."
      />
    );
  }

  return (
    <div className="of-g-meta">
      <div className="of-g-titulo">
        <strong>Meta do trimestre</strong>
        <Button variant="ghost" size="sm" onClick={() => setMostrarFalta((v) => !v)}>
          {mostrarFalta ? "Ver realizado" : "Ver quanto falta"}
        </Button>
      </div>

      {dados.map((pessoa) => {
        const percentual = Math.round((pessoa.realizado / pessoa.meta) * 100);
        const falta = Math.max(pessoa.meta - pessoa.realizado, 0);
        const atras = percentual < ritmoEsperado;

        return (
          <div key={pessoa.nome} className="of-g-meta-linha">
            <div className="of-g-meta-cabeca">
              <span className="of-g-meta-iniciais" aria-hidden="true">{pessoa.iniciais}</span>
              <span className="of-g-meta-nome">{pessoa.nome}</span>
              <span className="of-g-meta-num">
                {mostrarFalta ? (
                  <>faltam <b>{compacto(falta)}</b></>
                ) : (
                  <><b>{compacto(pessoa.realizado)}</b> de {compacto(pessoa.meta)}</>
                )}
              </span>
            </div>
            <div
              className="of-g-meta-trilho"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentual}
              aria-valuetext={`${percentual}% da meta, ${brl(pessoa.realizado)} de ${brl(pessoa.meta)}`}
              aria-label={pessoa.nome}
            >
              {/* Proporção entra como custom property e vira scaleX no CSS:
                  transform não força layout, `width` força. */}
              <div
                className="of-g-meta-preenche"
                data-ritmo={atras ? "atras" : "no-ritmo"}
                style={{ "--of-g-meta-p": Math.min(percentual, 100) / 100 } as React.CSSProperties}
              />
              <span
                className="of-g-meta-marca"
                style={{ left: `${ritmoEsperado}%` }}
                title={`Ritmo esperado: ${ritmoEsperado}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
