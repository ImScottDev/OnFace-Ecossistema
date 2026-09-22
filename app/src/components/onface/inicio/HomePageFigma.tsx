"use client";

import Link from "next/link";
import { useState } from "react";

/** Direct Figma frame 316:34672. Keep its structure and geometry intact. */
// O selo de variação é o único ponto em que esta tela sai do desenho e entra no
// Design System, e por um motivo: o frame do Figma traz os quatro cards com o
// MESMO selo verde, porque no desenho todos os números eram positivos. Ligado ao
// dado real, isso virou receita de −78% pintada de verde e dois selos verdes com
// "—" dentro. `ds/crm.css` já tem o padrão com os três tons — só não estava
// sendo usado aqui. Todos os seletores desse arquivo são de classe `.of-`/`.ds-`,
// então importá-lo não mexe na geometria do frame.
import "../ds/crm.css";
export interface OperacaoItem { empresa: string; descricao: string; etapa: string; valor: string; }
export interface EtapaItem { nome: string; pct: string; }
/** Um mês da série de evolução, do jeito que a tela consome.
 *  Estruturalmente igual ao `PontoEvolucao` de `analytics/onface-inicio`, mas com
 *  nome próprio: o componente não importa de analytics, e dois tipos com o mesmo
 *  nome no projeto só geram confusão na hora de ler o erro do compilador. */
export interface PontoSerie { label: string; receita: number; leads: number; ganhos: number; }

/* ───────────────────────── Evolução da operação ─────────────────────────
 * O frame do Figma desenha este gráfico como uma pilha de `<img>` de segmento
 * de reta, cada um girado num ângulo fixo (−6.16deg, −8.37deg, …), com os meses
 * Jul a Dez escritos na marcação. Era decoração: subia sempre, terminava em
 * dezembro e não olhava o banco — enquanto `getEvolucaoOperacao` já devolvia 12
 * meses reais e ninguém a chamava.
 *
 * Aqui é SVG de verdade, na mesma caixa do desenho (506.58 × 108.836), para o
 * card não mudar de geometria. Cada série é normalizada pelo PRÓPRIO máximo:
 * receita em dezenas de milhares e ganhos em dezenas não cabem num eixo só, e
 * forçá-las nele achataria duas das três linhas até virarem o mesmo traço no
 * chão. A leitura que o card oferece é de tendência, e é isso que a legenda diz.
 */
const CHART_W = 506.58;
const CHART_H = 108.836;

function GraficoEvolucao({ pontos }: { pontos: PontoSerie[] }) {
  const series = [
    { chave: "receita", rotulo: "Receita", cor: "#FE4F2B", valores: pontos.map((p) => p.receita) },
    { chave: "leads", rotulo: "Leads", cor: "#3B82F6", valores: pontos.map((p) => p.leads) },
    { chave: "ganhos", rotulo: "Ganhos", cor: "#94A3B8", valores: pontos.map((p) => p.ganhos) },
  ];
  // 4px de respiro em cima e embaixo: sem isso o pico encosta na borda do card
  // e o traço fica cortado pela metade da sua espessura.
  const MARGEM = 4;
  const util = CHART_H - MARGEM * 2;
  const passo = pontos.length > 1 ? CHART_W / (pontos.length - 1) : 0;
  const traco = (valores: number[]) => {
    const max = Math.max(...valores, 1);
    return valores
      .map((v, i) => `${(i * passo).toFixed(2)},${(CHART_H - MARGEM - (v / max) * util).toFixed(2)}`)
      .join(" ");
  };

  if (!pontos.length) {
    return (
      <div className="flex h-[108.836px] items-center justify-center relative shrink-0 w-[506.58px]">
        <p className="text-[#4e5d73] text-[11.873px]">Sem histórico para o período</p>
      </div>
    );
  }

  return (
    <svg
      className="h-[108.836px] relative shrink-0 w-[506.58px]"
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        `Evolução de ${pontos.length} meses, de ${pontos[0].label} a ${pontos[pontos.length - 1].label}. ` +
        series.map((s) => `${s.rotulo}: ${s.valores[s.valores.length - 1]}`).join("; ")
      }
    >
      {[0, 0.33, 0.66, 1].map((f) => (
        <line key={f} x1="0" x2={CHART_W} y1={f * CHART_H} y2={f * CHART_H} stroke="#30363d" strokeWidth="0.99" />
      ))}
      {series.map((s) => (
        <polyline
          key={s.chave}
          points={traco(s.valores)}
          fill="none"
          stroke={s.cor}
          strokeWidth="1.98"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
/**
 * Tom do selo de variação, na convenção do Design System
 * (`ds/crm.css` → `.of-tendencia[data-tom]`): verde é resultado consumado,
 * vermelho é piora, cinza é parado ou sem base de comparação.
 */
export type TomTendencia = "ok" | "risco" | "neutro";

export interface DadosInicio {
  saudacao: string; dataExtenso: string;
  receita: { valor: string; delta: string; tom: TomTendencia };
  leads: { valor: string; delta: string; tom: TomTendencia };
  operacoesAtivas: string; operacoesDelta: string; operacoesTom: TomTendencia;
  clientesAtivos: string; clientesDelta: string; clientesTom: TomTendencia;
  operacao: { empresa: string; servico: string; responsavel: string; cargo: string; valor: string; proximoPasso: string; proximoPassoData: string; prazo: string; prazoApoio: string; risco: string; insight: string };
  jornada0: string; jornada1: string; jornada2: string; jornada3: string;
  resumo: { prioridade: string; status: string; origem: string; inicio: string; previsao: string };
  operacoes: OperacaoItem[]; etapas: EtapaItem[];
  evolucao: PontoSerie[];
  /** Frase do subtítulo, derivada da série — o frame trazia "Crescimento consistente em todas as frentes." fixo. */
  evolucaoResumo: string;
  /** Estado de cada card de "Áreas em destaque", derivado de número. */
  areaOperacao: string; areaComercial: string; areaFinanceiro: string; areaSuporte: string;
}
const assetPathPrefix = "/onface/inicio";
const imgAvatarBadge = `${assetPathPrefix}/fe7b6.svg`;
const imgAvatarImage = `${assetPathPrefix}/9c78e.png`;
const imgBannerIcon = `${assetPathPrefix}/608b7.svg`;
const imgBaseBackground = `${assetPathPrefix}/1ea3f.svg`;
const imgBrandSeparator = `${assetPathPrefix}/96642.svg`;
const imgBtnBell = `${assetPathPrefix}/a23f4.svg`;
const imgEllipse = `${assetPathPrefix}/17d06.svg`;
const imgEllipse1 = `${assetPathPrefix}/2f3b8.svg`;
const imgEllipse2 = `${assetPathPrefix}/a0b93.svg`;
const imgHeroDashboard = `${assetPathPrefix}/9fd5a.png`;
const imgHugeiconsLoading03 = `${assetPathPrefix}/e7676.svg`;
const imgIconArrowRight = `${assetPathPrefix}/aa7c5.svg`;
const imgIconBarChart = `${assetPathPrefix}/e72c3.svg`;
const imgIconBriefcase = `${assetPathPrefix}/a7e5b.svg`;
const imgIconHome = `${assetPathPrefix}/e6560.svg`;
const imgIconPlus = `${assetPathPrefix}/b0d36.svg`;
const imgIconSearch = `${assetPathPrefix}/993a4.svg`;
const imgIconSettings = `${assetPathPrefix}/69dfb.svg`;
const imgIconSettings1 = `${assetPathPrefix}/d0625.svg`;
const imgIconTrendingUp = `${assetPathPrefix}/6862c.svg`;
const imgIconTrendingUp1 = `${assetPathPrefix}/a127d.svg`;
const imgIconTrendingUp2 = `${assetPathPrefix}/3de6f.svg`;
const imgIconUsers = `${assetPathPrefix}/202dd.svg`;
const imgIconUsers1 = `${assetPathPrefix}/71e21.svg`;
const imgIconZap = `${assetPathPrefix}/26c8f.svg`;
const imgIconZap1 = `${assetPathPrefix}/861b2.svg`;
const imgLine = `${assetPathPrefix}/263c7.svg`;
const imgLine1 = `${assetPathPrefix}/a3cd8.png`;
const imgLine2 = `${assetPathPrefix}/a2e9d.png`;
const imgLine3 = `${assetPathPrefix}/30b5d.png`;
const imgLine4 = `${assetPathPrefix}/2bcc8.png`;
const imgLine5 = `${assetPathPrefix}/07d5a.png`;
const imgLucideArrowUp = `${assetPathPrefix}/71e7d.svg`;
const imgLucideBadgePlus = `${assetPathPrefix}/8294b.svg`;
const imgLucideBadgePlus1 = `${assetPathPrefix}/b4004.svg`;
const imgLucidePlus = `${assetPathPrefix}/e7c73.svg`;
const imgOnLogo = `${assetPathPrefix}/b9e20.svg`;
const imgPriorityDot = `${assetPathPrefix}/a2711.svg`;
const imgRemixBriefcase4 = `${assetPathPrefix}/f305f.svg`;
const imgSectorIcon = `${assetPathPrefix}/d28c7.svg`;
const imgSectorIcon1 = `${assetPathPrefix}/f9fd5.svg`;
const imgSectorIcon2 = `${assetPathPrefix}/55755.svg`;
const imgSectorIcon3 = `${assetPathPrefix}/b702b.svg`;
const imgTablerTrendingUp = `${assetPathPrefix}/a2289.svg`;
const imgUserAvatar = `${assetPathPrefix}/43d99.png`;

export function HomePageFigma({ d }: { d: DadosInicio }) {
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [statusTab, setStatusTab] = useState("Todas");
  const priorityRows = Array.from({ length: 5 }, (_, index) => d.operacoes[index] ?? {
    empresa: "—",
    descricao: "Sem operação prioritária",
    etapa: "Sem etapa",
    valor: "—",
  });
  const sendAssistantQuery = () => {
    const query = assistantQuery.trim();
    if (!query) return;
    setAssistantReply(`${d.operacao.empresa}: ${d.operacao.proximoPasso}. SLA ${d.operacao.prazo.toLowerCase()} — ${d.operacao.prazoApoio}.`);
    setAssistantQuery("");
  };

  return (
    <div className="bg-white relative" style={{ width: 1440, height: 967 }} data-node-id="316:34672" data-name="HomePage">
            <div className="absolute content-stretch flex gap-[13px] h-[570px] items-start left-0 overflow-clip p-[24px] top-0 w-[1440px]" data-node-id="316:34673" data-name="HeroDashboard">
              <div aria-hidden className="absolute inset-0 pointer-events-none">
                <div className="absolute bg-[var(--preto---logo,#12171d)] inset-0" />
                <img alt="" className="absolute max-w-none object-cover size-full" src={imgHeroDashboard} />
              </div>
              <div className="content-stretch flex flex-[1_0_0] flex-col gap-[15.9px] h-[456px] items-start min-w-px overflow-clip relative" data-node-id="316:34674" data-name="DashboardMainContent">
                <div className="content-stretch flex gap-[15.9px] items-start relative shrink-0 w-full" data-node-id="316:34675" data-name="GreetingAndMetricsRow">
                  <div className="content-stretch flex flex-col gap-[15.9px] items-start justify-center relative shrink-0 w-[269px]" data-node-id="316:34676" data-name="GreetingBlock">
                    <div className="content-stretch flex flex-col items-start relative rounded-[23.85px] shrink-0 w-[245px]" data-node-id="316:34677" data-name="hero-intro-card">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full whitespace-nowrap" data-node-id="316:34678" data-name="welcome-text-group">
                        <p className="font-['Plus_Jakarta_Sans:ExtraBold'] font-extrabold leading-[normal] relative shrink-0 text-[31.8px] text-white" data-node-id="316:34679">
                          {d.saudacao}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[1.4] relative shrink-0 text-[#8b949e] text-[12.919px]" data-node-id="316:34680">
                          {d.dataExtenso}
                        </p>
                      </div>
                    </div>
                    <div className="content-stretch flex gap-[11.925px] items-center relative shrink-0 w-full" data-node-id="316:34681" data-name="action-row">
                      <Link href="/tarefas?nova=1" className="bg-[#fe4f2b] content-stretch flex gap-[7.95px] items-center px-[15.9px] py-[9.938px] relative rounded-[99.375px] shrink-0" data-node-id="316:34682" data-name="btn-nova-atividade">
                        <div className="relative shrink-0 size-[13.912px]" data-node-id="316:34683" data-name="icon-plus">
                          <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconPlus} />
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[12.919px] text-white whitespace-nowrap" data-node-id="316:34685">
                          Nova Atividade
                        </p>
                      </Link>
                      <div className="[word-break:break-word] content-stretch flex flex-col font-['Plus_Jakarta_Sans:Bold'] font-bold gap-[1.987px] items-start leading-[normal] relative shrink-0 text-[#8b949e] text-[8.944px] tracking-[0.3578px] whitespace-nowrap" data-node-id="316:34686" data-name="tagline-block">
                        <p className="relative shrink-0" data-node-id="316:34687">
                          MAIS POSSIBILIDADES.
                        </p>
                        <p className="relative shrink-0" data-node-id="316:34688">
                          MAIS RESULTADOS.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="content-stretch flex flex-[1_0_0] items-start min-w-px relative" data-node-id="316:34689" data-name="MetricsSection">
                    <div className="content-stretch flex flex-[1_0_0] gap-[11.925px] items-start justify-end min-w-px relative" data-node-id="316:34690" data-name="MetricsGrid">
                      <div className="bg-[#161b22] border-[#30363d] border-[0.994px] border-solid content-stretch flex flex-[1_0_0] flex-col gap-[11.925px] h-[166px] items-start justify-center min-w-px px-[20px] py-[50px] relative rounded-[19.875px]" data-node-id="316:34691" data-name="MetricCard-Revenue">
                        <div className="content-stretch flex flex-col gap-[9px] items-start relative shrink-0 w-full" data-node-id="316:34692" data-name="metric-header">
                          <div className="relative shrink-0 size-[22.429px]" data-node-id="316:34693" data-name="icon-trending-up">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconTrendingUp} />
                          </div>
                          <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#8b949e] text-[11.925px] whitespace-nowrap" data-node-id="316:34695">
                            Receita do mês
                          </p>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:ExtraBold'] font-extrabold leading-[normal] min-w-full relative shrink-0 text-[16px] text-white w-[min-content]" data-node-id="316:34696">
                          {d.receita.valor}
                        </p>
                        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-node-id="316:34697" data-name="metric-badge-row">
                          <div className="of-tendencia" data-tom={d.receita.tom} data-node-id="316:34698" data-name="metric-badge">
                            <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[10.931px] whitespace-nowrap" data-node-id="316:34699">
                              {d.receita.delta}
                            </p>
                          </div>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#484f58] text-[10.931px] whitespace-nowrap" data-node-id="316:34700">
                          vs. mês anterior
                        </p>
                      </div>
                      <div className="bg-[#161b22] border-[#30363d] border-[0.994px] border-solid content-stretch flex flex-[1_0_0] flex-col gap-[11.925px] h-[166px] items-start justify-center min-w-px px-[20px] py-[50px] relative rounded-[19.875px]" data-node-id="316:34701" data-name="MetricCard-Operations">
                        <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-node-id="316:34702" data-name="metric-header">
                          <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-node-id="316:34703" data-name="metric-header-inner">
                            <div className="relative shrink-0 size-[22.429px]" data-node-id="316:34704" data-name="icon-trending-up">
                              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconTrendingUp1} />
                            </div>
                            <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#8b949e] text-[11.925px] whitespace-nowrap" data-node-id="316:34706">
                              Operações ativas
                            </p>
                          </div>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:ExtraBold'] font-extrabold leading-[normal] min-w-full relative shrink-0 text-[16px] text-white w-[min-content]" data-node-id="316:34707">
                          {d.operacoesAtivas}
                        </p>
                        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-node-id="316:34708" data-name="metric-badge-row">
                          <div className="of-tendencia" data-tom={d.operacoesTom} data-node-id="316:34709" data-name="metric-badge">
                            <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[10.931px] whitespace-nowrap" data-node-id="316:34710">
                              {d.operacoesDelta}
                            </p>
                          </div>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#484f58] text-[10.931px] whitespace-nowrap" data-node-id="316:34711">
                          vs. mês anterior
                        </p>
                      </div>
                      <div className="bg-[#161b22] border-[#30363d] border-[0.994px] border-solid content-stretch flex flex-[1_0_0] flex-col gap-[11.925px] h-[166px] items-start justify-center min-w-px p-[19.875px] relative rounded-[19.875px]" data-node-id="316:34712" data-name="MetricCard-Clients">
                        <div className="content-stretch flex flex-col gap-[9px] items-start relative shrink-0 w-[204.25px]" data-node-id="316:34713" data-name="metric-header">
                          <div className="relative shrink-0 size-[22.458px]" data-node-id="316:34714" data-name="icon-users">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconUsers} />
                          </div>
                          <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#8b949e] text-[11.925px] whitespace-nowrap" data-node-id="316:34716">
                            Clientes ativos
                          </p>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:ExtraBold'] font-extrabold leading-[normal] relative shrink-0 text-[16px] text-white whitespace-nowrap" data-node-id="316:34717">
                          {d.clientesAtivos}
                        </p>
                        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-node-id="316:34718" data-name="metric-badge-row">
                          <div className="of-tendencia" data-tom={d.clientesTom} data-node-id="316:34719" data-name="metric-badge">
                            <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[10.931px] whitespace-nowrap" data-node-id="316:34720">
                              {d.clientesDelta}
                            </p>
                          </div>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#484f58] text-[10.931px] whitespace-nowrap" data-node-id="316:34721">
                          vs. mês anterior
                        </p>
                      </div>
                      <div className="bg-[#161b22] border-[#30363d] border-[0.994px] border-solid content-stretch flex flex-[1_0_0] flex-col gap-[11.925px] h-[166px] items-start justify-center min-w-px p-[19.875px] relative rounded-[19.875px]" data-node-id="316:34722" data-name="MetricCard-Automations">
                        <div className="content-stretch flex flex-col gap-[9px] items-start relative shrink-0 w-[203.25px]" data-node-id="316:34723" data-name="metric-header">
                          <div className="relative shrink-0 size-[22.5px]" data-node-id="316:34724" data-name="icon-zap">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconZap} />
                          </div>
                          <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#8b949e] text-[11.925px] whitespace-nowrap" data-node-id="316:34726">
                            Leads gerados
                          </p>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:ExtraBold'] font-extrabold leading-[normal] relative shrink-0 text-[16px] text-white whitespace-nowrap" data-node-id="316:34727">
                          {d.leads.valor}
                        </p>
                        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-node-id="316:34728" data-name="metric-badge-row">
                          <div className="of-tendencia" data-tom={d.leads.tom} data-node-id="316:34729" data-name="metric-badge">
                            <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[10.931px] whitespace-nowrap" data-node-id="316:34730">
                              {d.leads.delta}
                            </p>
                          </div>
                        </div>
                        <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] relative shrink-0 text-[#484f58] text-[10.931px] whitespace-nowrap" data-node-id="316:34731">
                          vs. mês anterior
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="content-stretch flex gap-[15.9px] h-[274px] items-start overflow-clip relative shrink-0 w-full" data-node-id="316:34732" data-name="ChartsAndHighlights">
                  <div className="border-[#30363d] border-[0.989px] border-solid content-stretch flex flex-col gap-[15.831px] h-[271.1px] items-start overflow-clip p-[23.746px] relative rounded-[23.85px] shrink-0 w-[565.945px]" data-node-id="316:34733" data-name="OperationEvolutionChart - Variação 1 (Dark)">
                    <div aria-hidden className="absolute bg-[#161b22] inset-0 pointer-events-none rounded-[23.85px]" />
                    <div className="absolute bg-[var(--laranja,#fe4f2b)] h-[271.1px] left-[-0.99px] top-[-0.99px] w-[3.958px]" data-node-id="316:34734" data-name="Rectangle" />
                    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-node-id="316:34735" data-name="Frame">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[1.979px] items-start leading-[normal] relative shrink-0 w-[296.824px] whitespace-nowrap" data-node-id="316:34736" data-name="Frame">
                        <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[15.9px] text-white" data-node-id="316:34737">
                          Evolução da operação
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-[var(--weight\/normal,400)] relative shrink-0 text-[#8b949e] text-[11.925px]" data-node-id="316:34738">
                          {d.evolucaoResumo}
                        </p>
                      </div>
                      <div className="content-stretch flex gap-[11.873px] items-center relative shrink-0" data-node-id="316:34739" data-name="Frame">
                        <div className="content-stretch flex gap-[5.936px] items-center relative shrink-0" data-node-id="316:34740" data-name="Frame">
                          <div className="relative shrink-0 size-[7.915px]" data-node-id="316:34741" data-name="Ellipse">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse} />
                          </div>
                          <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-[var(--weight\/medium,500)] leading-[15.831px] relative shrink-0 text-[11.873px] text-white whitespace-nowrap" data-node-id="316:34742" style={{ fontVariationSettings: '"opsz" 14' }}>
                            Receita
                          </p>
                        </div>
                        <div className="content-stretch flex gap-[5.936px] items-center relative shrink-0" data-node-id="316:34743" data-name="Frame">
                          <div className="relative shrink-0 size-[7.915px]" data-node-id="316:34744" data-name="Ellipse">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse1} />
                          </div>
                          <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-[var(--weight\/medium,500)] leading-[15.831px] relative shrink-0 text-[11.873px] text-white whitespace-nowrap" data-node-id="316:34745" style={{ fontVariationSettings: '"opsz" 14' }}>
                            Leads
                          </p>
                        </div>
                        <div className="content-stretch flex gap-[5.936px] items-center relative shrink-0" data-node-id="316:34746" data-name="Frame">
                          <div className="relative shrink-0 size-[7.915px]" data-node-id="316:34747" data-name="Ellipse">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse2} />
                          </div>
                          <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-[var(--weight\/medium,500)] leading-[15.831px] relative shrink-0 text-[11.873px] text-white whitespace-nowrap" data-node-id="316:34748" style={{ fontVariationSettings: '"opsz" 14' }}>
                            Ganhos
                          </p>
                        </div>
                      </div>
                    </div>
                    <GraficoEvolucao pontos={d.evolucao} />
                    {/* Os rótulos saem da série, não da marcação: o frame trazia
                        "Jul … Dez" escrito à mão, com três meses no futuro. */}
                    <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Medium'] font-[var(--weight\/medium,500)] items-center justify-between leading-[15.831px] px-[5.936px] relative shrink-0 text-[#4e5d73] text-[11.873px] w-full whitespace-nowrap" data-node-id="316:34773" data-name="Frame">
                      {d.evolucao.map((ponto) => (
                        <p key={ponto.label} className="relative shrink-0" style={{ fontVariationSettings: '"opsz" 14' }}>
                          {ponto.label}
                        </p>
                      ))}
                    </div>
                    <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0.989px_0.989px_0px_0px_rgba(255,255,255,0.08)]" />
                  </div>
                  <div className="bg-[#161b22] border-[#30363d] border-[0.994px] border-solid content-stretch flex flex-col gap-[15.9px] items-start p-[23.85px] relative rounded-[23.85px] shrink-0 w-[425px]" data-node-id="316:34780" data-name="HighlightAreasPanel">
                    <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] relative shrink-0 w-full whitespace-nowrap" data-node-id="316:34781" data-name="panel-header">
                      <div className="content-stretch flex flex-col gap-[3.975px] items-start relative shrink-0" data-node-id="316:34782" data-name="panel-title-block">
                        <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[15.9px] text-white" data-node-id="316:34783">
                          Áreas em destaque
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#8b949e] text-[11.925px]" data-node-id="316:34784">
                          Módulos do ecossistema ONFACE.
                        </p>
                      </div>
                      <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[#8b949e] text-[10.931px]" data-node-id="316:34785">{`Ver todos os módulos >`}</p>
                    </div>
                    <div className="gap-x-[7.949999809265137px] gap-y-[7.949999809265137px] grid grid-cols-[repeat(2,minmax(0,1fr))] grid-rows-[repeat(2,minmax(0,1fr))] h-[169px] relative shrink-0 w-[377px]" data-node-id="316:34786" data-name="SectorGrid">
                      <Link href="/clientes/onboarding" className="bg-[#fe4f2b] col-1 content-stretch flex flex-col gap-[11.925px] items-start justify-self-stretch p-[11.925px] relative rounded-[15.9px] row-1 self-stretch shrink-0" data-node-id="316:34787" data-name="SectorCard-Operacao">
                        <div className="relative shrink-0 size-[17.888px]" data-node-id="316:34788" data-name="sector-icon">
                          <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgSectorIcon} />
                        </div>
                        <div className="[word-break:break-word] content-stretch flex flex-col gap-[1.987px] items-start leading-[normal] relative shrink-0 whitespace-nowrap" data-node-id="316:34790" data-name="sector-info">
                          <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[12.919px] text-white" data-node-id="316:34791">
                            Operação
                          </p>
                          <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[8.944px] text-[rgba(255,255,255,0.8)]" data-node-id="316:34792">{`${d.areaOperacao} >`}</p>
                        </div>
                      </Link>
                      <Link href="/negocios" className="bg-[#1f242c] border-[#30363d] border-[0.994px] border-solid col-2 content-stretch flex flex-col gap-[11.925px] items-start justify-self-stretch p-[11.925px] relative rounded-[15.9px] row-1 self-stretch shrink-0" data-node-id="316:34793" data-name="SectorCard-Comercial">
                        <div className="relative shrink-0 size-[17.888px]" data-node-id="316:34794" data-name="sector-icon">
                          <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgSectorIcon1} />
                        </div>
                        <div className="[word-break:break-word] content-stretch flex flex-col gap-[1.987px] items-start leading-[normal] relative shrink-0 whitespace-nowrap" data-node-id="316:34796" data-name="sector-info">
                          <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[12.919px] text-white" data-node-id="316:34797">
                            Comercial
                          </p>
                          <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#8b949e] text-[8.944px]" data-node-id="316:34798">{`${d.areaComercial} >`}</p>
                        </div>
                      </Link>
                      <Link href="/clientes/financeiro" className="bg-[#1f242c] border-[#30363d] border-[0.994px] border-solid col-1 content-stretch flex flex-col gap-[11.925px] items-start justify-self-stretch p-[11.925px] relative rounded-[15.9px] row-2 self-stretch shrink-0" data-node-id="316:34799" data-name="SectorCard-Financeiro">
                        <div className="relative shrink-0 size-[17.888px]" data-node-id="316:34800" data-name="sector-icon">
                          <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgSectorIcon2} />
                        </div>
                        <div className="[word-break:break-word] content-stretch flex flex-col gap-[1.987px] items-start leading-[normal] relative shrink-0 whitespace-nowrap" data-node-id="316:34802" data-name="sector-info">
                          <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[12.919px] text-white" data-node-id="316:34803">
                            Financeiro
                          </p>
                          <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#8b949e] text-[8.944px]" data-node-id="316:34804">{`${d.areaFinanceiro} >`}</p>
                        </div>
                      </Link>
                      <Link href="/clientes" className="bg-[#1f242c] border-[#30363d] border-[0.994px] border-solid col-2 content-stretch flex flex-col gap-[11.925px] items-start justify-self-stretch p-[11.925px] relative rounded-[15.9px] row-2 self-stretch shrink-0" data-node-id="316:34805" data-name="SectorCard-Suporte">
                        <div className="relative shrink-0 size-[17.888px]" data-node-id="316:34806" data-name="sector-icon">
                          <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgSectorIcon3} />
                        </div>
                        <div className="[word-break:break-word] content-stretch flex flex-col gap-[1.987px] items-start leading-[normal] relative shrink-0 whitespace-nowrap" data-node-id="316:34808" data-name="sector-info">
                          <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[12.919px] text-white" data-node-id="316:34809">
                            Suporte
                          </p>
                          <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#8b949e] text-[8.944px]" data-node-id="316:34810">{`${d.areaSuporte} >`}</p>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#faf9f6] border border-[#e2e8f0] border-solid content-stretch flex flex-col h-[444px] items-start justify-between overflow-clip p-[24px] relative rounded-[24px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.02)] shrink-0 w-[366px]" data-node-id="316:34811" data-name="AssistantPanel">
                <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-node-id="316:34812" data-name="AssistantHeader">
                  <div className="content-stretch flex gap-[7.95px] items-center relative shrink-0" data-node-id="316:34813" data-name="assistant-identity">
                    <div className="relative rounded-[var(--rounded-full,8786.231px)] shrink-0 size-[35.148px]" data-node-id="316:34814" data-name="Avatar">
                      <div className="absolute inset-0 rounded-[var(--rounded-full,8786.231px)]" data-node-id="I316:34814;2192:2584" data-name="Avatar image">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[var(--rounded-full,8786.231px)]">
                          <img alt="" className="absolute h-[796.59%] left-[-509.66%] max-w-none top-[-307.39%] w-[637.5%]" src={imgAvatarImage} />
                        </div>
                      </div>
                      <div className="absolute bottom-0 right-0 size-[10.545px]" data-node-id="I316:34814;2195:638" data-name="AvatarBadge">
                        <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgAvatarBadge} />
                      </div>
                    </div>
                    <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[13.912px] text-[color:var(--cinza,#6d747e)] whitespace-nowrap" data-node-id="316:34815">
                      Assistente ON
                    </p>
                  </div>
                  <div className="bg-[var(--branco-logo,#eeeff3)] content-stretch flex items-start p-[5.963px] relative rounded-[98.381px] shrink-0" data-node-id="316:34816" data-name="settings-button">
                    <div className="relative shrink-0 size-[13.912px]" data-node-id="316:34817" data-name="icon-settings">
                      <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconSettings} />
                    </div>
                  </div>
                </div>
                <div className="content-stretch flex flex-col h-[342px] items-center justify-end relative rounded-bl-[var(--radius-xl,14px)] rounded-br-[var(--radius-xl,14px)] shrink-0 w-full" data-node-id="316:34819" data-name="AssistantBody">
                  <div className="bg-[var(--muted,#f5f5f5)] content-stretch flex flex-col h-[342px] items-center justify-between relative rounded-[var(--radius-3xl,22px)] shrink-0 w-full" data-node-id="316:34820" data-name="assistant-content">
                    <div className="h-[98.974px] relative shrink-0 w-[318px]" data-node-id="316:34821" data-name="AssistantQuickActions">
                      <div className="absolute content-stretch flex h-[43.825px] items-start left-0 top-0 w-[318px]" data-node-id="316:34822" data-name="PrimaryActionRow">
                        <a href="#operacoes-prioritarias" className="bg-[var(--laranja,#fe4f2b)] content-stretch flex flex-[1_0_0] items-center justify-between min-w-px p-[13.912px] relative rounded-[11.925px]" data-node-id="316:34823" data-name="btn-ver-prioridades">
                          <p className="[word-break:break-word] font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] relative shrink-0 text-[12.919px] text-[color:var(--branco-logo,#eeeff3)] whitespace-nowrap" data-node-id="316:34824">
                            Ver prioridades
                          </p>
                          <div className="relative shrink-0 size-[13.912px]" data-node-id="316:34825" data-name="icon-arrow-right">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconArrowRight} />
                          </div>
                        </a>
                      </div>
                      <div className="absolute content-stretch flex flex-col h-[40px] items-start left-0 top-[58.97px] w-[318px]" data-node-id="316:34827" data-name="QuickActionsRow">
                        <div className="content-stretch flex gap-[10px] items-start relative shrink-0 w-full" data-node-id="316:34828" data-name="QuickActionsContent">
                          <Link href="/relatorios" className="bg-[#f1f5f9] content-stretch flex flex-[1_0_0] gap-[6px] items-center justify-center min-w-px p-[12px] relative rounded-[12px]" data-node-id="316:34829" data-name="btn-gerar-resumo">
                            <div className="relative shrink-0 size-[13px]" data-node-id="316:34830" data-name="remix/briefcase-4">
                              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgRemixBriefcase4} />
                            </div>
                            <p className="[word-break:break-word] font-['Manrope:Medium'] font-medium leading-[normal] relative shrink-0 text-[#475569] text-[12px] whitespace-nowrap" data-node-id="316:34831">
                              Gerar resumo
                            </p>
                          </Link>
                          <Link href="/relatorios" className="bg-[#f1f5f9] content-stretch flex flex-[1_0_0] gap-[6px] items-center justify-center min-w-px p-[12px] relative rounded-[12px]" data-node-id="316:34832" data-name="btn-analisar-gargalos">
                            <div className="relative shrink-0 size-[13px]" data-node-id="316:34833" data-name="tabler/trending-up">
                              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgTablerTrendingUp} />
                            </div>
                            <p className="[word-break:break-word] font-['Manrope:Medium'] font-medium leading-[normal] relative shrink-0 text-[#475569] text-[12px] whitespace-nowrap" data-node-id="316:34834">
                              Analisar gargalos
                            </p>
                          </Link>
                        </div>
                      </div>
                    </div>
                    {assistantReply && (
                      <p className="mx-[12px] -mb-[8px] overflow-hidden rounded-[12px] bg-white px-[12px] py-[10px] text-[11px] leading-[1.35] text-[#475569]" aria-live="polite">
                        {assistantReply}
                      </p>
                    )}
                    <form className="h-[84px] relative shrink-0 w-[318px]" data-node-id="316:34835" data-name="AssistantComposer" onSubmit={(event) => { event.preventDefault(); sendAssistantQuery(); }}>
                      <div className="absolute bg-white content-stretch flex items-center justify-center left-0 px-[var(--px-3,12px)] py-[var(--py-2\,5,10px)] rounded-tl-[20px] rounded-tr-[20px] top-0 w-[318px]" data-node-id="316:34836" data-name="composer-input">
                        <input value={assistantQuery} onChange={(event) => setAssistantQuery(event.target.value)} className="flex-[1_0_0] min-w-px bg-transparent text-[14px] text-[#334155] outline-none placeholder:text-[#6d747e]" placeholder="Como posso ajudar?" aria-label="Pergunta para o Assistente ON" />
                      </div>
                      <div className="absolute bg-white content-stretch flex gap-[var(--gap-2,8px)] items-center left-0 pb-[var(--pb-2,8px)] pt-[var(--pt-1,4px)] px-[var(--px-2\,5,10px)] top-[40px] w-[318px]" data-node-id="316:34838" data-name="composer-toolbar">
                        <div className="content-stretch flex flex-[1_0_0] gap-[var(--gap-2,8px)] items-center min-w-px relative" data-node-id="316:34839" data-name="toolbar-left">
                        <button type="button" onClick={() => setAssistantQuery("Quais são as prioridades da operação?")} className="bg-[var(--background,white)] border-[length:var(--border-width,1px)] border-[var(--border,#e5e5e5)] border-solid content-stretch flex flex-col items-center justify-center px-[var(--px-2\,5,10px)] relative rounded-[var(--radius-full,9999px)] shrink-0 size-[32px]" aria-label="Inserir pergunta sugerida" data-node-id="316:34840" data-name="Dropdown menu trigger">
                            <div className="relative shrink-0 size-[16px]" data-node-id="I316:34840;1892:1973" data-name="lucide/circle-fading-plus">
                              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgLucidePlus} />
                            </div>
                          </button>
                        </div>
                        <button type="submit" disabled={!assistantQuery.trim()} className="bg-[#fe4f2b] content-stretch flex flex-col items-center justify-center px-[var(--px-2\,5,10px)] relative rounded-[var(--radius-full,9999px)] shrink-0 size-[32px] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Enviar pergunta" data-node-id="316:34841" data-name="Icon Button">
                          <div className="relative shrink-0 size-[16px]" data-node-id="I316:34841;1892:1875" data-name="lucide/circle-fading-plus">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgLucideArrowUp} />
                          </div>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
      <div className="absolute h-[444px] left-[5px] top-[516px] w-[1435px]" data-node-id="316:34846" data-name="LowerWorkspace">
            <div className="absolute bg-[#f4f6f8] h-[428px] left-0 rounded-bl-[12px] rounded-br-[12px] rounded-tl-[24px] rounded-tr-[24px] top-[13px] w-[1430px]" data-node-id="316:34847" data-name="LowerSurface" />
            <div className="absolute h-[431px] left-0 opacity-50 overflow-clip rounded-tl-[32px] rounded-tr-[32px] top-[13px] w-[1435px]" data-node-id="316:34848" data-name="BackgroundGridEffect">
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-0 top-0 w-[1.195px]" data-node-id="316:34849" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[71.7px] top-0 w-[1.195px]" data-node-id="316:34850" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[143.4px] top-0 w-[1.195px]" data-node-id="316:34851" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[215.11px] top-0 w-[1.195px]" data-node-id="316:34852" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[286.81px] top-0 w-[1.195px]" data-node-id="316:34853" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[358.51px] top-0 w-[1.195px]" data-node-id="316:34854" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[430.21px] top-0 w-[1.195px]" data-node-id="316:34855" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[501.92px] top-0 w-[1.195px]" data-node-id="316:34856" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[573.62px] top-0 w-[1.195px]" data-node-id="316:34857" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[645.32px] top-0 w-[1.195px]" data-node-id="316:34858" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[717.02px] top-0 w-[1.195px]" data-node-id="316:34859" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[788.73px] top-0 w-[1.195px]" data-node-id="316:34860" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[860.43px] top-0 w-[1.195px]" data-node-id="316:34861" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[932.13px] top-0 w-[1.195px]" data-node-id="316:34862" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1003.83px] top-0 w-[1.195px]" data-node-id="316:34863" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1075.53px] top-0 w-[1.195px]" data-node-id="316:34864" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1147.24px] top-0 w-[1.195px]" data-node-id="316:34865" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1218.94px] top-0 w-[1.195px]" data-node-id="316:34866" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1290.64px] top-0 w-[1.195px]" data-node-id="316:34867" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1362.34px] top-0 w-[1.195px]" data-node-id="316:34868" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1846.334px] left-[1434.05px] top-0 w-[1.195px]" data-node-id="316:34869" data-name="v-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-0 w-[1434.046px]" data-node-id="316:34870" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[71.7px] w-[1434.046px]" data-node-id="316:34871" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[143.4px] w-[1434.046px]" data-node-id="316:34872" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[215.11px] w-[1434.046px]" data-node-id="316:34873" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[286.81px] w-[1434.046px]" data-node-id="316:34874" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[358.51px] w-[1434.046px]" data-node-id="316:34875" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[430.21px] w-[1434.046px]" data-node-id="316:34876" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[501.92px] w-[1434.046px]" data-node-id="316:34877" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[573.62px] w-[1434.046px]" data-node-id="316:34878" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[645.32px] w-[1434.046px]" data-node-id="316:34879" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[717.02px] w-[1434.046px]" data-node-id="316:34880" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[788.73px] w-[1434.046px]" data-node-id="316:34881" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[860.43px] w-[1434.046px]" data-node-id="316:34882" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[932.13px] w-[1434.046px]" data-node-id="316:34883" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1003.83px] w-[1434.046px]" data-node-id="316:34884" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1075.53px] w-[1434.046px]" data-node-id="316:34885" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1147.24px] w-[1434.046px]" data-node-id="316:34886" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1218.94px] w-[1434.046px]" data-node-id="316:34887" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1290.64px] w-[1434.046px]" data-node-id="316:34888" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1362.34px] w-[1434.046px]" data-node-id="316:34889" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1434.05px] w-[1434.046px]" data-node-id="316:34890" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1505.75px] w-[1434.046px]" data-node-id="316:34891" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1577.45px] w-[1434.046px]" data-node-id="316:34892" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1649.15px] w-[1434.046px]" data-node-id="316:34893" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1720.86px] w-[1434.046px]" data-node-id="316:34894" data-name="h-line" />
              <div className="absolute bg-[#d9dee5] h-[1.195px] left-0 top-[1792.56px] w-[1434.046px]" data-node-id="316:34895" data-name="h-line" />
            </div>
            <div className="absolute bg-[#12171d] h-[42.004px] left-[calc(50%-12px)] overflow-clip rounded-[21.002px] top-[-9px] w-[449.884px]" data-node-id="316:34896" data-name="StatusTabs">
              <div className="absolute bg-[#ff5a3c] h-[35.372px] rounded-[17.686px] top-[3.32px] w-[97.272px] transition-[left]" style={{ left: { Todas: "3.32px", "Em andamento": "105px", "Atenção": "235px", "Concluídas": "340px" }[statusTab] }} data-node-id="316:34897" data-name="tab-active-bg" />
              <button type="button" onClick={() => setStatusTab("Todas")} aria-pressed={statusTab === "Todas"} className="absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] left-[20px] text-[12.159px] text-white top-[8px] h-[35px] w-[70px] whitespace-nowrap" data-node-id="316:34898">
                Todas
              </button>
              <button type="button" onClick={() => setStatusTab("Em andamento")} aria-pressed={statusTab === "Em andamento"} className="absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[105px] text-[12.159px] text-white top-[8px] h-[35px] w-[130px] whitespace-nowrap" data-node-id="316:34899">
                Em andamento
              </button>
              <button type="button" onClick={() => setStatusTab("Atenção")} aria-pressed={statusTab === "Atenção"} className="absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[235px] text-[12.159px] text-white top-[8px] h-[35px] w-[105px] whitespace-nowrap" data-node-id="316:34900">
                Atenção
              </button>
              <button type="button" onClick={() => setStatusTab("Concluídas")} aria-pressed={statusTab === "Concluídas"} className="absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[340px] text-[12.159px] text-white top-[8px] h-[35px] w-[105px] whitespace-nowrap" data-node-id="316:34901">
                Concluídas
              </button>
            </div>
            <div className="absolute content-stretch flex gap-[13px] h-[344px] items-start left-[23px] top-[74px] w-[1383px]" data-node-id="316:34902" data-name="OperationsContent">
              <div className="bg-[#12171d] border border-[#2a3540] border-solid h-[342px] overflow-clip relative rounded-[14px] shrink-0 w-[560px]" data-node-id="316:34903" data-name="OperationDetails">
                <div className="absolute h-[35px] left-[15px] top-[12px] w-[526px]" data-node-id="316:34904" data-name="details-header">
                  <div className="[word-break:break-word] absolute content-stretch flex flex-col gap-[2px] items-start leading-[normal] left-0 top-px whitespace-nowrap" data-node-id="316:34905" data-name="details-title-block">
                    <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[#f8f9fa] text-[15px]" data-node-id="316:34906">
                      Detalhes da operação
                    </p>
                    <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#8b949e] text-[10px]" data-node-id="316:34907">
                      Acompanhe o progresso e os principais indicadores.
                    </p>
                  </div>
                  <Link href="/clientes/onboarding" className="absolute h-[29px] left-[414px] top-0 w-[112px]" data-node-id="316:34908" data-name="btn-abrir-operacao" aria-label="Abrir operação">
                    <div className="absolute bg-[#1b222b] border border-[#2a3540] border-solid h-[29px] left-0 rounded-[14px] top-0 w-[112px]" data-node-id="316:34909" data-name="btn-abrir-bg" />
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[16px] text-[#f8f9fa] text-[10px] top-[8px] whitespace-pre" data-node-id="316:34910">{`Abrir operação  ↗`}</p>
                  </Link>
                </div>
                <div className="absolute h-[38px] left-[15px] top-[71px] w-[526px]" data-node-id="316:34911" data-name="ClientAndResponsible">
                  <div className="[word-break:break-word] absolute h-[32px] leading-[normal] left-0 top-[2px] w-[126.319px]" data-node-id="316:34912" data-name="client-info">
                    <p className="absolute font-['Plus_Jakarta_Sans:Bold'] font-bold left-0 text-[#f8f9fa] text-[16px] top-0 whitespace-nowrap" data-node-id="316:34913">
                      {d.operacao.empresa}
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9px] top-[21px] whitespace-pre" data-node-id="316:34914">{`Implantação ERP  •  Enterprise`}</p>
                  </div>
                  <div className="absolute h-[38px] left-[404.62px] right-0 top-0" data-node-id="316:34915" data-name="responsible-info">
                    <div className="-translate-x-1/2 -translate-y-1/2 absolute bg-[var(--primary,#fe4f2b)] content-stretch flex flex-col items-center justify-center left-[calc(50%-40.31px)] rounded-[14px] size-[28px] top-[calc(50%+5px)]" data-node-id="316:34916" data-name="responsible-avatar">
                      <p className="[word-break:break-word] font-['Manrope:ExtraBold'] font-extrabold leading-[normal] relative shrink-0 text-[9.333px] text-[color:var(--primary-foreground,white)] whitespace-nowrap" data-node-id="316:34917">
                        KS
                      </p>
                    </div>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-[40px] text-[#8b949e] text-[8px] top-0 whitespace-nowrap" data-node-id="316:34918">
                      Responsável
                    </p>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] left-[40px] text-[#f8f9fa] text-[10px] top-[13px] whitespace-nowrap" data-node-id="316:34919">
                      {d.operacao.responsavel}
                    </p>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-[40px] text-[#8b949e] text-[8px] top-[28px] whitespace-nowrap" data-node-id="316:34920">
                      {d.operacao.cargo}
                    </p>
                  </div>
                </div>
                <div className="absolute content-stretch flex gap-[10px] h-[54px] items-start left-[15px] top-[122px] w-[526px]" data-node-id="316:34921" data-name="ProgressCardsRow">
                  <div className="h-[54px] relative shrink-0 w-[125px]" data-node-id="316:34922" data-name="ProgressCard-Comercial">
                    <div className="absolute bg-[#1b222b] border border-[#2a3540] border-solid h-[54px] left-0 rounded-[9px] top-0 w-[122px]" data-node-id="316:34923" data-name="card-bg" />
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-[10px] text-[#aeb6c2] text-[9px] top-[8px] whitespace-nowrap" data-node-id="316:34924">
                      Comercial
                    </p>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] left-[10px] text-[#f8f9fa] text-[12px] top-[23px] whitespace-nowrap" data-node-id="316:34925">
                      100%
                    </p>
                    <div className="absolute bg-[#33404c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[102px]" data-node-id="316:34926" data-name="progress-bar-bg" />
                    <div className="absolute bg-[#ff5a3c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[102px]" data-node-id="316:34927" data-name="progress-bar-fill" />
                  </div>
                  <div className="h-[54px] relative shrink-0 w-[125px]" data-node-id="316:34928" data-name="ProgressCard-Operacao">
                    <div className="absolute bg-[#1b222b] border border-[#2a3540] border-solid h-[54px] left-0 rounded-[9px] top-0 w-[122px]" data-node-id="316:34929" data-name="card-bg" />
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-[10px] text-[#aeb6c2] text-[9px] top-[8px] whitespace-nowrap" data-node-id="316:34930">
                      Operação
                    </p>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] left-[10px] text-[#f8f9fa] text-[12px] top-[23px] whitespace-nowrap" data-node-id="316:34931">
                      65%
                    </p>
                    <div className="absolute bg-[#33404c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[102px]" data-node-id="316:34932" data-name="progress-bar-bg" />
                    <div className="absolute bg-[#ff5a3c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[66.3px]" data-node-id="316:34933" data-name="progress-bar-fill" />
                  </div>
                  <div className="h-[54px] relative shrink-0 w-[125px]" data-node-id="316:34934" data-name="ProgressCard-Financeiro">
                    <div className="absolute bg-[#1b222b] border border-[#2a3540] border-solid h-[54px] left-0 rounded-[9px] top-0 w-[122px]" data-node-id="316:34935" data-name="card-bg" />
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-[10px] text-[#aeb6c2] text-[9px] top-[8px] whitespace-nowrap" data-node-id="316:34936">
                      Financeiro
                    </p>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] left-[10px] text-[#f8f9fa] text-[12px] top-[23px] whitespace-nowrap" data-node-id="316:34937">
                      30%
                    </p>
                    <div className="absolute bg-[#33404c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[102px]" data-node-id="316:34938" data-name="progress-bar-bg" />
                    <div className="absolute bg-[#ff5a3c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[30.6px]" data-node-id="316:34939" data-name="progress-bar-fill" />
                  </div>
                  <div className="h-[54px] relative shrink-0 w-[123px]" data-node-id="316:34940" data-name="ProgressCard-Implantacao">
                    <div className="absolute bg-[#1b222b] border border-[#2a3540] border-solid h-[54px] left-0 rounded-[9px] top-0 w-[122px]" data-node-id="316:34941" data-name="card-bg" />
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-[10px] text-[#aeb6c2] text-[9px] top-[8px] whitespace-nowrap" data-node-id="316:34942">
                      Implantação
                    </p>
                    <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Bold'] font-bold leading-[normal] left-[10px] text-[#f8f9fa] text-[12px] top-[23px] whitespace-nowrap" data-node-id="316:34943">
                      80%
                    </p>
                    <div className="absolute bg-[#33404c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[102px]" data-node-id="316:34944" data-name="progress-bar-bg" />
                    <div className="absolute bg-[#ff5a3c] h-[5px] left-[10px] rounded-[3px] top-[41px] w-[81.6px]" data-node-id="316:34945" data-name="progress-bar-fill" />
                  </div>
                </div>
                <div className="absolute h-[46px] left-[15px] top-[195px] w-[528px]" data-node-id="316:34946" data-name="InsightBanner">
                  <div className="absolute bg-[#1b222b] border border-[#2a3540] border-solid h-[46px] left-0 rounded-[10px] top-0 w-[528px]" data-node-id="316:34947" data-name="banner-bg" />
                  <div className="absolute left-[10px] size-[28px] top-[9px]" data-node-id="316:34948" data-name="banner-icon">
                    <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgBannerIcon} />
                  </div>
                  <div className="[word-break:break-word] absolute content-stretch flex flex-col gap-[3px] items-start leading-[normal] left-[48px] top-[6px] whitespace-nowrap" data-node-id="316:34949" data-name="banner-text-block">
                    <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[#ff5a3c] text-[10px]" data-node-id="316:34950">
                      Insight do Assistente ON
                    </p>
                    <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#aeb6c2] text-[9px]" data-node-id="316:34951">
                      {d.operacao.insight}
                    </p>
                  </div>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[440px] text-[#f8f9fa] text-[9px] top-[14px] whitespace-pre" data-node-id="316:34952">{`Ver detalhes  ›`}</p>
                </div>
                <div className="absolute h-[49.492px] left-[15px] top-[258.75px] w-[526px]" data-node-id="316:34953" data-name="BottomMetrics">
                  <div className="[word-break:break-word] absolute h-[37.982px] leading-[normal] left-0 top-0 w-[97.834px] whitespace-nowrap" data-node-id="316:34954" data-name="Metric-ValorTotal">
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9.208px] top-0" data-node-id="316:34955">
                      Valor total
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:Bold'] font-bold left-0 text-[#f8f9fa] text-[14.963px] top-[19.57px]" data-node-id="316:34956">
                      {d.operacao.valor}
                    </p>
                  </div>
                  <div className="absolute bg-[#2a3540] h-[43.737px] left-[143.87px] top-[1.15px] w-[1.151px]" data-node-id="316:34957" data-name="metric-separator" />
                  <div className="[word-break:break-word] absolute h-[49.492px] leading-[normal] left-[151.93px] top-0 w-[88.626px] whitespace-nowrap" data-node-id="316:34958" data-name="Metric-ProximoPasso">
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9.208px] top-0" data-node-id="316:34959">
                      Próximo passo
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold left-0 text-[#f8f9fa] text-[11.51px] top-[19.57px]" data-node-id="316:34960">
                      {d.operacao.proximoPasso}
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9.208px] top-[37.98px]" data-node-id="316:34961">
                      {d.operacao.proximoPassoData}
                    </p>
                  </div>
                  <div className="absolute bg-[#2a3540] h-[43.737px] left-[295.8px] top-[1.15px] w-[1.151px]" data-node-id="316:34962" data-name="metric-separator" />
                  <div className="[word-break:break-word] absolute h-[49.492px] leading-[normal] left-[303.86px] top-0 w-[69.059px] whitespace-nowrap" data-node-id="316:34963" data-name="Metric-SLA">
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9.208px] top-0" data-node-id="316:34964">
                      SLA
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold left-0 text-[#22c55e] text-[11.51px] top-[19.57px]" data-node-id="316:34965">
                      ↑ No prazo
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9.208px] top-[37.98px]" data-node-id="316:34966">
                      {d.operacao.prazoApoio}
                    </p>
                  </div>
                  <div className="absolute bg-[#2a3540] h-[43.737px] left-[447.73px] top-[1.15px] w-[1.151px]" data-node-id="316:34967" data-name="metric-separator" />
                  <div className="[word-break:break-word] absolute h-[34.53px] leading-[normal] left-[455.79px] top-0 w-[70.21px]" data-node-id="316:34968" data-name="Metric-HealthScore">
                    <p className="absolute font-['Plus_Jakarta_Sans:Regular'] font-normal left-0 text-[#8b949e] text-[9.208px] top-0 whitespace-nowrap" data-node-id="316:34969">
                      Risco
                    </p>
                    <p className="absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold left-0 text-[#f8f9fa] text-[11.51px] top-[19.57px] whitespace-pre" data-node-id="316:34970">{d.operacao.risco}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#e5e7eb] border-solid h-[344px] overflow-clip relative rounded-[14px] shrink-0 w-[340px]" data-node-id="316:34971" data-name="OperationSummary">
                <div className="[word-break:break-word] absolute content-stretch flex flex-col gap-[3px] items-start leading-[normal] left-[15px] top-[15px] whitespace-nowrap" data-node-id="316:34972" data-name="summary-header">
                  <p className="font-['Plus_Jakarta_Sans:Bold'] font-bold relative shrink-0 text-[#111827] text-[15px]" data-node-id="316:34973">
                    Resumo
                  </p>
                  <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[#6b7280] text-[10px]" data-node-id="316:34974">
                    Informações principais da operação.
                  </p>
                </div>
                <div className="absolute h-[24px] left-[15px] top-[73px] w-[308px]" data-node-id="316:34975" data-name="SummaryRow-Cliente">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-0 whitespace-nowrap" data-node-id="316:34976">
                    Empresa
                  </p>
                  <p className="absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] overflow-hidden right-0 text-[#111827] text-[9px] text-ellipsis text-right top-0 w-[160px] whitespace-nowrap" data-node-id="316:34977" title={d.operacao.empresa}>
                    {d.operacao.empresa}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[23px] w-[308px]" data-node-id="316:34978" data-name="row-divider" />
                </div>
                <div className="absolute h-[24px] left-[15px] top-[104px] w-[308px]" data-node-id="316:34979" data-name="SummaryRow-Responsavel">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-0 whitespace-nowrap" data-node-id="316:34980">
                    Responsável
                  </p>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] left-[246px] text-[#111827] text-[9px] top-px whitespace-nowrap" data-node-id="316:34981">
                    {d.operacao.responsavel}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[23px] w-[308px]" data-node-id="316:34982" data-name="row-divider" />
                </div>
                <div className="absolute h-[28px] left-[15px] top-[131px] w-[308px]" data-node-id="316:34983" data-name="SummaryRow-Prioridade">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-[4px] whitespace-nowrap" data-node-id="316:34984">
                    Prioridade
                  </p>
                  <div className="absolute bg-[#fff0ec] h-[20px] left-[254px] rounded-[10px] top-0 w-[52px]" data-node-id="316:34985" data-name="priority-badge-bg" />
                  <div className="absolute left-[266px] size-[6px] top-[7px]" data-node-id="316:34986" data-name="priority-dot">
                    <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgPriorityDot} />
                  </div>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[280px] text-[#111827] text-[9px] top-[4px] whitespace-nowrap" data-node-id="316:34987">
                    {d.resumo.prioridade}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[27px] w-[308px]" data-node-id="316:34988" data-name="row-divider" />
                </div>
                <div className="absolute h-[28px] left-[15px] top-[162px] w-[308px]" data-node-id="316:34989" data-name="SummaryRow-Etapa">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-[4px] whitespace-nowrap" data-node-id="316:34990">
                    Status
                  </p>
                  <div className="absolute bg-[#fff0ec] h-[20px] left-[211px] rounded-[10px] top-0 w-[95px]" data-node-id="316:34991" data-name="status-badge-bg" />
                  <div className="absolute left-[221px] size-[6px] top-[7px]" data-node-id="316:34992" data-name="status-dot">
                    <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgPriorityDot} />
                  </div>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[234px] text-[#111827] text-[9px] top-[4px] whitespace-nowrap" data-node-id="316:34993">
                    {d.resumo.status}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[27px] w-[308px]" data-node-id="316:34994" data-name="row-divider" />
                </div>
                <div className="absolute h-[24px] left-[15px] top-[197px] w-[308px]" data-node-id="316:34995" data-name="SummaryRow-Valor">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-0 whitespace-nowrap" data-node-id="316:34996">
                    Origem
                  </p>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] left-[260px] text-[#111827] text-[9px] top-0 whitespace-nowrap" data-node-id="316:34997">
                    {d.resumo.origem}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[23px] w-[308px]" data-node-id="316:34998" data-name="row-divider" />
                </div>
                <div className="absolute h-[24px] left-[15px] top-[228px] w-[308px]" data-node-id="316:34999" data-name="SummaryRow-Inicio">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-0 whitespace-nowrap" data-node-id="316:35000">
                    Início
                  </p>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] left-[226px] text-[#111827] text-[9px] top-0 whitespace-nowrap" data-node-id="316:35001">
                    {d.resumo.inicio}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[23px] w-[308px]" data-node-id="316:35002" data-name="row-divider" />
                </div>
                <div className="absolute h-[29px] left-[15px] top-[259px] w-[308px]" data-node-id="316:35003" data-name="SummaryRow-Atualizacao">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-0 whitespace-nowrap" data-node-id="316:35004">
                    Previsão de entrega
                  </p>
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:SemiBold'] font-semibold leading-[normal] left-[224px] text-[#111827] text-[9px] top-0 whitespace-nowrap" data-node-id="316:35005">
                    {d.resumo.previsao}
                  </p>
                  <div className="absolute bg-[#e5e7eb] h-px left-0 top-[28px] w-[308px]" data-node-id="316:35006" data-name="row-divider" />
                </div>
                <div className="absolute h-[20px] left-[15px] top-[294px] w-[297px]" data-node-id="316:35007" data-name="SummaryRow-Tags">
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Regular'] font-normal leading-[normal] left-0 text-[#6b7280] text-[9px] top-[3px] whitespace-nowrap" data-node-id="316:35008">
                    Tags
                  </p>
                  <div className="absolute bg-[#f4f6f8] h-[20px] left-[115px] rounded-[10px] top-0 w-[31px]" data-node-id="316:35009" data-name="tag-bg-0" />
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[123px] text-[#6b7280] text-[8px] top-[5px] whitespace-nowrap" data-node-id="316:35010">
                    ERP
                  </p>
                  <div className="absolute bg-[#f4f6f8] h-[20px] left-[152px] rounded-[10px] top-0 w-[74px]" data-node-id="316:35011" data-name="tag-bg-1" />
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[160px] text-[#6b7280] text-[8px] top-[5px] whitespace-nowrap" data-node-id="316:35012">
                    Implantação
                  </p>
                  <div className="absolute bg-[#f4f6f8] h-[20px] left-[232px] rounded-[10px] top-0 w-[65px]" data-node-id="316:35013" data-name="tag-bg-2" />
                  <p className="[word-break:break-word] absolute font-['Plus_Jakarta_Sans:Medium'] font-medium leading-[normal] left-[246px] text-[#6b7280] text-[8px] top-[4px] whitespace-nowrap" data-node-id="316:35014">
                    Enterprise
                  </p>
                </div>
              </div>
              <div id="operacoes-prioritarias" className="bg-[var(--background,white)] border-[length:var(--border-width,1px)] border-[var(--border,#e3e7e8)] border-solid content-stretch flex flex-col h-[344px] items-start overflow-clip relative rounded-[14px] shrink-0 w-[464px]" data-node-id="316:35015" data-name="PriorityOperations">
                <div className="content-stretch flex gap-[var(--gap-1,4px)] h-[66px] items-start justify-end px-[var(--px-4,16px)] py-[16px] relative shrink-0 w-full" data-node-id="316:35016" data-name="PriorityOperationsHeader">
                  <div className="content-stretch flex flex-[1_0_0] flex-col gap-[var(--gap-1,4px)] items-start min-w-px relative" data-node-id="I316:35016;2203:7514">
                    <div className="content-stretch flex items-center relative shrink-0 w-full" data-node-id="I316:35016;2203:7515" data-name="Card title">
                      <p className="[word-break:break-word] flex-[1_0_0] font-['DM_Sans:Medium'] font-medium leading-[24px] min-w-px relative text-[16px] text-[color:var(--card-foreground,#090b0c)]" data-node-id="I316:35016;2203:7516" style={{ fontVariationSettings: '"opsz" 14' }}>
                        Operações prioritárias
                      </p>
                    </div>
                    <div className="content-stretch flex items-center relative shrink-0 w-full" data-node-id="I316:35016;2203:7517" data-name="Card description">
                      <p className="[word-break:break-word] flex-[1_0_0] font-['DM_Sans:Regular'] font-normal leading-[20px] min-w-px relative text-[14px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="I316:35016;2203:7518" style={{ fontVariationSettings: '"opsz" 14' }}>
                        Suas operações mais relevantes no momento.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="content-stretch flex h-[36px] items-center px-[10px] relative shrink-0 w-full" data-node-id="316:35017" data-name="table-column-headers">
                  <div className="content-stretch flex gap-[var(--gap-1\,5,6px)] h-[40px] items-center px-[var(--px-2,8px)] relative shrink-0 w-[180px]" data-node-id="316:35018" data-name="TableHead-Empresa">
                    <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[20px] overflow-hidden relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)] text-ellipsis whitespace-nowrap" data-node-id="I316:35018;1945:4063" style={{ fontVariationSettings: '"opsz" 14' }}>
                      Empresa
                    </p>
                  </div>
                  <div className="content-stretch flex gap-[var(--gap-1\,5,6px)] h-[40px] items-center px-[var(--px-2,8px)] relative shrink-0 w-[150px]" data-node-id="316:35019" data-name="TableHead-Etapa">
                    <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[20px] overflow-hidden relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)] text-ellipsis whitespace-nowrap" data-node-id="I316:35019;1945:4063" style={{ fontVariationSettings: '"opsz" 14' }}>
                      Etapa
                    </p>
                  </div>
                  <div className="content-stretch flex gap-[var(--gap-1\,5,6px)] h-[40px] items-center px-[var(--px-2,8px)] relative shrink-0 w-[100px]" data-node-id="316:35020" data-name="TableHead-Valor">
                    <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[20px] overflow-hidden relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)] text-ellipsis whitespace-nowrap" data-node-id="I316:35020;1945:4063" style={{ fontVariationSettings: '"opsz" 14' }}>
                      Valor
                    </p>
                  </div>
                </div>
                <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-node-id="316:35021" data-name="table-rows">
                  <div className="bg-[var(--secondary,#f4f4f5)] content-stretch flex flex-col items-start px-[18px] relative shrink-0 w-full" data-node-id="316:35022" data-name="TableRow-BlueRock">
                    <div className="content-stretch flex items-center py-[6px] relative shrink-0 w-full" data-node-id="316:35023" data-name="row-content">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative shrink-0 w-[180px] whitespace-nowrap" data-node-id="316:35024" data-name="cell-company">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35025">
                          {priorityRows[0].empresa}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[8px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35026">
                          {priorityRows[0].descricao}
                        </p>
                      </div>
                      <div className="content-stretch flex items-center relative shrink-0 w-[150px]" data-node-id="316:35027" data-name="cell-status">
                        <div className="bg-[var(--primary,#fe4f2b)] content-stretch flex gap-[var(--gap-1,4px)] h-[22px] items-center justify-center px-[var(--px-2,8px)] py-[var(--py-0\,5,2px)] relative rounded-[var(--radius-4xl,26px)] shrink-0" data-node-id="316:35028" data-name="Badge">
                          <div className="relative shrink-0 size-[12px]" data-node-id="I316:35028;1868:927" data-name="lucide/badge-plus">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgHugeiconsLoading03} />
                          </div>
                          <div className="content-stretch flex items-center justify-center relative shrink-0" data-node-id="I316:35028;1868:309" data-name="Text">
                            <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[16px] relative shrink-0 text-[12px] text-[color:var(--primary-foreground,white)] text-center whitespace-nowrap" data-node-id="I316:35028;1868:310" style={{ fontVariationSettings: '"opsz" 14' }}>
                              {priorityRows[0].etapa}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] relative shrink-0 w-[100px] whitespace-nowrap" data-node-id="316:35029" data-name="cell-value">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35030">
                          {priorityRows[0].valor}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35031">
                          ›
                        </p>
                      </div>
                    </div>
                    <div className="bg-[var(--border,#e3e7e8)] h-px opacity-30 relative shrink-0 w-full" data-node-id="316:35032" data-name="row-divider" />
                  </div>
                  <div className="content-stretch flex flex-col items-start px-[18px] relative shrink-0 w-full" data-node-id="316:35033" data-name="TableRow-NovaTech">
                    <div className="content-stretch flex items-center py-[6px] relative shrink-0 w-full" data-node-id="316:35034" data-name="row-content">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative shrink-0 w-[180px] whitespace-nowrap" data-node-id="316:35035" data-name="cell-company">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35036">
                          {priorityRows[1].empresa}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[8px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35037">
                          {priorityRows[1].descricao}
                        </p>
                      </div>
                      <div className="content-stretch flex items-center relative shrink-0 w-[150px]" data-node-id="316:35038" data-name="cell-status">
                        <div className="border-[length:var(--border-width,1px)] border-[var(--border,#e3e7e8)] border-solid content-stretch flex gap-[var(--gap-1,4px)] h-[22px] items-center justify-center px-[var(--px-2,8px)] py-[var(--py-0\,5,2px)] relative rounded-[var(--radius-4xl,26px)] shrink-0" data-node-id="316:35039" data-name="Badge">
                          <div className="relative shrink-0 size-[12px]" data-node-id="I316:35039;1868:473" data-name="lucide/badge-plus">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgLucideBadgePlus} />
                          </div>
                          <div className="content-stretch flex items-center justify-center relative shrink-0" data-node-id="I316:35039;1868:320" data-name="Text">
                            <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-[var(--weight\/medium,500)] leading-[var(--leading\/4,16px)] relative shrink-0 text-[color:var(--foreground,#090b0c)] text-[length:var(--size\/xs,12px)] text-center tracking-[var(--tracking\/normal,0px)] whitespace-nowrap" data-node-id="I316:35039;1868:321" style={{ fontVariationSettings: '"opsz" 14' }}>
                              {priorityRows[1].etapa}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] relative shrink-0 w-[100px] whitespace-nowrap" data-node-id="316:35040" data-name="cell-value">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35041">
                          {priorityRows[1].valor}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35042">
                          ›
                        </p>
                      </div>
                    </div>
                    <div className="bg-[var(--border,#e3e7e8)] h-px relative shrink-0 w-full" data-node-id="316:35043" data-name="row-divider" />
                  </div>
                  <div className="content-stretch flex flex-col items-start px-[18px] relative shrink-0 w-full" data-node-id="316:35044" data-name="TableRow-ApiceDigital">
                    <div className="content-stretch flex items-center py-[6px] relative shrink-0 w-full" data-node-id="316:35045" data-name="row-content">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative shrink-0 w-[180px] whitespace-nowrap" data-node-id="316:35046" data-name="cell-company">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35047">
                          {priorityRows[2].empresa}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[8px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35048">
                          {priorityRows[2].descricao}
                        </p>
                      </div>
                      <div className="content-stretch flex items-center relative shrink-0 w-[150px]" data-node-id="316:35049" data-name="cell-status">
                        <div className="bg-[var(--secondary,#f4f4f5)] content-stretch flex gap-[var(--gap-1,4px)] h-[22px] items-center justify-center px-[var(--px-2,8px)] py-[var(--py-0\,5,2px)] relative rounded-[var(--radius-4xl,26px)] shrink-0" data-node-id="316:35050" data-name="Badge">
                          <div className="relative shrink-0 size-[12px]" data-node-id="I316:35050;1868:461" data-name="lucide/badge-plus">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgLucideBadgePlus1} />
                          </div>
                          <div className="content-stretch flex items-center justify-center relative shrink-0" data-node-id="I316:35050;1868:312" data-name="Text">
                            <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[16px] relative shrink-0 text-[12px] text-[color:var(--secondary-foreground,#18181b)] text-center whitespace-nowrap" data-node-id="I316:35050;1868:313" style={{ fontVariationSettings: '"opsz" 14' }}>
                              {priorityRows[2].etapa}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] relative shrink-0 w-[100px] whitespace-nowrap" data-node-id="316:35051" data-name="cell-value">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35052">
                          {priorityRows[2].valor}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35053">
                          ›
                        </p>
                      </div>
                    </div>
                    <div className="bg-[var(--border,#e3e7e8)] h-px relative shrink-0 w-full" data-node-id="316:35054" data-name="row-divider" />
                  </div>
                  <div className="content-stretch flex flex-col items-start px-[18px] relative shrink-0 w-full" data-node-id="316:35055" data-name="TableRow-LumeSaude">
                    <div className="content-stretch flex items-center py-[6px] relative shrink-0 w-full" data-node-id="316:35056" data-name="row-content">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative shrink-0 w-[180px] whitespace-nowrap" data-node-id="316:35057" data-name="cell-company">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35058">
                          {priorityRows[3].empresa}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[8px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35059">
                          {priorityRows[3].descricao}
                        </p>
                      </div>
                      <div className="content-stretch flex items-center relative shrink-0 w-[150px]" data-node-id="316:35060" data-name="cell-status">
                        <div className="bg-[var(--secondary,#f4f4f5)] content-stretch flex gap-[var(--gap-1,4px)] h-[22px] items-center justify-center px-[var(--px-2,8px)] py-[var(--py-0\,5,2px)] relative rounded-[var(--radius-4xl,26px)] shrink-0" data-node-id="316:35061" data-name="Badge">
                          <div className="relative shrink-0 size-[12px]" data-node-id="I316:35061;1868:461" data-name="lucide/badge-plus">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgLucideBadgePlus1} />
                          </div>
                          <div className="content-stretch flex items-center justify-center relative shrink-0" data-node-id="I316:35061;1868:312" data-name="Text">
                            <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[16px] relative shrink-0 text-[12px] text-[color:var(--secondary-foreground,#18181b)] text-center whitespace-nowrap" data-node-id="I316:35061;1868:313" style={{ fontVariationSettings: '"opsz" 14' }}>
                              {priorityRows[3].etapa}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] relative shrink-0 w-[100px] whitespace-nowrap" data-node-id="316:35062" data-name="cell-value">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35063">
                          {priorityRows[3].valor}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35064">
                          ›
                        </p>
                      </div>
                    </div>
                    <div className="bg-[var(--border,#e3e7e8)] h-px relative shrink-0 w-full" data-node-id="316:35065" data-name="row-divider" />
                  </div>
                  <div className="content-stretch flex flex-col items-start px-[18px] relative shrink-0 w-full" data-node-id="316:35066" data-name="TableRow-OrionFoods">
                    <div className="content-stretch flex items-center py-[6px] relative shrink-0 w-full" data-node-id="316:35067" data-name="row-content">
                      <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative shrink-0 w-[180px] whitespace-nowrap" data-node-id="316:35068" data-name="cell-company">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35069">
                          {priorityRows[4].empresa}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[8px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35070">
                          {priorityRows[4].descricao}
                        </p>
                      </div>
                      <div className="content-stretch flex items-center relative shrink-0 w-[150px]" data-node-id="316:35071" data-name="cell-status">
                        <div className="bg-[var(--secondary,#f4f4f5)] content-stretch flex gap-[var(--gap-1,4px)] h-[22px] items-center justify-center px-[var(--px-2,8px)] py-[var(--py-0\,5,2px)] relative rounded-[var(--radius-4xl,26px)] shrink-0" data-node-id="316:35072" data-name="Badge">
                          <div className="relative shrink-0 size-[12px]" data-node-id="I316:35072;1868:461" data-name="lucide/badge-plus">
                            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgLucideBadgePlus1} />
                          </div>
                          <div className="content-stretch flex items-center justify-center relative shrink-0" data-node-id="I316:35072;1868:312" data-name="Text">
                            <p className="[word-break:break-word] font-['DM_Sans:Medium'] font-medium leading-[16px] relative shrink-0 text-[12px] text-[color:var(--secondary-foreground,#18181b)] text-center whitespace-nowrap" data-node-id="I316:35072;1868:313" style={{ fontVariationSettings: '"opsz" 14' }}>
                              {priorityRows[4].etapa}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] relative shrink-0 w-[100px] whitespace-nowrap" data-node-id="316:35073" data-name="cell-value">
                        <p className="font-['Plus_Jakarta_Sans:SemiBold'] font-semibold relative shrink-0 text-[10px] text-[color:var(--foreground,#090b0c)]" data-node-id="316:35074">
                          {priorityRows[4].valor}
                        </p>
                        <p className="font-['Plus_Jakarta_Sans:Regular'] font-normal relative shrink-0 text-[14px] text-[color:var(--muted-foreground,#67787c)]" data-node-id="316:35075">
                          ›
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
  
    </div>
  );
}
