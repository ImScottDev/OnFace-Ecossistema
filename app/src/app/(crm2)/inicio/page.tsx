import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { getMetaComercialAgregada } from "@/lib/metas";
import { getPipelineAtual, getFechadoPeriodo } from "@/lib/relatorios/comercial";
import {
  getMrrComparativo, getFunilLeads, getAquisicaoPeriodo,
  getAtendimentoResumo, getCsResumo, getFinanceiroResumo,
} from "@/lib/analytics/command-center";
import {
  getEntregaResumoPorFamilia, getMetaPorProduto, getAgendaHoje, getPrecisaAtencao,
  getMrrSeries, getEquipeAtiva, getClientesAtivos, FAMILIAS_ONBOARDING_HOME, FAMILIAS_IMPLANTACAO_HOME,
} from "@/lib/analytics/inicio";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2HeroPulso, type KpiCard } from "@/components/crm2/inicio/HeroPulso";
import { Cf2JornadaOperacao } from "@/components/crm2/inicio/JornadaOperacao";
import { Cf2MrrEvolucao } from "@/components/crm2/inicio/MrrEvolucao";
import { Cf2MetaMes } from "@/components/crm2/inicio/MetaMes";
import { Cf2PrecisaAtencao } from "@/components/crm2/inicio/PrecisaAtencao";
import { Cf2OperacaoHoje } from "@/components/crm2/inicio/OperacaoHoje";
import { Cf2Workspaces, type WorkspaceCard } from "@/components/crm2/inicio/Workspaces";

const TZ = "America/Sao_Paulo";
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const brlK = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : brl0(v);

/** Semana ISO-8601 — mesma numeração que o time usa pra falar de "semana 36". */
function semanaIso(d: Date) {
  const alvo = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  alvo.setUTCDate(alvo.getUTCDate() + 4 - (alvo.getUTCDay() || 7));
  const inicioAno = new Date(Date.UTC(alvo.getUTCFullYear(), 0, 1));
  return Math.ceil(((alvo.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
}

function formatarEspera(min: number | null) {
  if (min === null) return "sem fila de espera";
  if (min < 60) return `espera de ${min}min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `espera de ${h}h` : `espera de ${Math.floor(h / 24)}d`;
}

/**
 * Home / Command Center (redesign 30/08 — Figma 559:2159).
 *
 * Tela única (o desenho tirou as abas Visão Geral/Pipeline/Pendências da
 * versão anterior): hero com o pulso do negócio, a jornada inteira da
 * operação numa faixa, evolução de MRR + meta, a fila do que precisa de
 * atenção, a agenda do dia e os atalhos por frente.
 *
 * Todo número aqui vem de fonte real. Onde o desenho mostra um sinal que o
 * produto não tem como calcular de verdade (ex.: variação de clientes ativos
 * no mês, "% fora do SLA" — SLA formal não existe no modelo), o elemento sai
 * em vez de aparecer com número inventado.
 */
export default async function InicioPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [
    org, metaMes, pipelineAtivo, mrrComparativo, funilLeads, aquisicao,
    atendimento, cs, financeiro, onboarding, implantacao, metaProdutos, mrrSeries,
    precisaAtencao, agendaHoje, equipe, fechadoMes, clientesAtivos,
  ] = await Promise.all([
    db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
    getMetaComercialAgregada(ctx.organizacaoId, hoje),
    getPipelineAtual(ctx.organizacaoId),
    getMrrComparativo(ctx.organizacaoId, hoje),
    getFunilLeads(ctx.organizacaoId, hoje),
    getAquisicaoPeriodo(ctx.organizacaoId, hoje),
    getAtendimentoResumo(ctx.organizacaoId),
    getCsResumo(ctx.organizacaoId),
    getFinanceiroResumo(ctx.organizacaoId),
    getEntregaResumoPorFamilia(ctx.organizacaoId, FAMILIAS_ONBOARDING_HOME, hoje),
    getEntregaResumoPorFamilia(ctx.organizacaoId, FAMILIAS_IMPLANTACAO_HOME, hoje),
    getMetaPorProduto(ctx.organizacaoId, hoje),
    getMrrSeries(ctx.organizacaoId, hoje),
    getPrecisaAtencao(ctx.organizacaoId, hoje),
    getAgendaHoje(ctx.organizacaoId, ctx.userId, hoje),
    getEquipeAtiva(ctx.organizacaoId, 5),
    getFechadoPeriodo(ctx.organizacaoId, inicioMes, fimMes),
    getClientesAtivos(ctx.organizacaoId),
  ]);

  const orgNome = org[0]?.nome || "Callface";
  const primeiroNome = (ctx.userName || "").split(" ")[0];
  const horaSp = Number(hoje.toLocaleString("pt-BR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  const periodo = horaSp < 12 ? "Bom dia" : horaSp < 18 ? "Boa tarde" : "Boa noite";
  const dataExtenso = hoje.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

  const conversasAguardando = atendimento.whatsappAbertas + atendimento.emailPendentes;
  // O gauge da meta usa a MESMA base do breakdown por produto (negócios
  // ganhos no mês), senão o "total realizado" não fecharia com a soma das
  // linhas logo abaixo dele — `metaMes.realizado` tem escopo diferente (só
  // negócios de closers com meta cadastrada).
  const realizadoMes = metaProdutos.reduce((s, p) => s + p.valor, 0);

  const kpiHero: KpiCard = {
    label: "MRR ativo",
    valor: brl0(mrrComparativo.atual),
    rodape: `${clientesAtivos} ${clientesAtivos === 1 ? "cliente ativo" : "clientes ativos"}`,
    icone: "wallet",
    href: "/clientes/financeiro",
    tendencia: mrrComparativo.deltaPct !== null
      ? {
          texto: `${mrrComparativo.deltaPct >= 0 ? "+" : ""}${mrrComparativo.deltaPct.toFixed(1)}%`,
          direcao: mrrComparativo.deltaPct >= 0 ? "up" : "down",
          tom: mrrComparativo.deltaPct >= 0 ? "positivo" : "negativo",
        }
      : undefined,
  };

  const kpis: KpiCard[] = [
    {
      label: "Pipeline aberto", valor: brl0(pipelineAtivo.total), icone: "layers", href: "/pipeline",
      rodape: `${pipelineAtivo.negociosAbertos} ${pipelineAtivo.negociosAbertos === 1 ? "negócio" : "negócios"}`,
    },
    {
      label: "Clientes ativos", valor: String(clientesAtivos), icone: "empresa", href: "/clientes",
      rodape: `${cs.renovacoesProximas30d} ${cs.renovacoesProximas30d === 1 ? "renovação próxima" : "renovações próximas"}`,
    },
    {
      label: "Onboardings", valor: String(onboarding.ativas), icone: "rocket", href: "/clientes/onboarding",
      rodape: `${onboarding.aguardandoContato} aguardando contato`,
    },
    {
      label: "Implantações PABX", valor: String(implantacao.ativas), icone: "server", href: "/clientes/implantacao",
      rodape: `${implantacao.bloqueadas} ${implantacao.bloqueadas === 1 ? "bloqueada" : "bloqueadas"}`,
      tendencia: implantacao.atrasadas > 0
        ? { texto: `${implantacao.atrasadas} atrasadas`, direcao: "down", tom: "negativo" }
        : undefined,
    },
    {
      label: "Atendimentos", valor: String(conversasAguardando), icone: "inbox", href: "/atendimento",
      rodape: formatarEspera(atendimento.esperaMaisAntigaMinutos),
    },
  ];

  const workspaces: WorkspaceCard[] = [
    {
      key: "vendas", titulo: "Vendas", href: "/pipeline", cta: "Abrir Vendas",
      metricas: [
        { label: "Em pipeline", valor: brlK(pipelineAtivo.total) },
        { label: "Negócios abertos", valor: String(pipelineAtivo.negociosAbertos) },
        { label: "Ganhos no mês", valor: brlK(mrrComparativo.atual), tom: "neutro" },
      ],
    },
    {
      key: "atendimento", titulo: "Atendimento", href: "/atendimento", cta: "Abrir Atendimento",
      metricas: [
        { label: "Conversas aguardando", valor: String(conversasAguardando) },
        { label: "WhatsApp abertos", valor: String(atendimento.whatsappAbertas), tom: atendimento.whatsappAbertas > 0 ? "warning" : "neutro" },
        { label: "E-mails pendentes", valor: String(atendimento.emailPendentes), tom: atendimento.emailPendentes > 0 ? "warning" : "neutro" },
      ],
    },
    {
      key: "onboarding", titulo: "Onboarding", href: "/clientes/onboarding", cta: "Abrir Onboarding",
      metricas: [
        { label: "Ativos", valor: String(onboarding.ativas) },
        { label: "Aguardando contato", valor: String(onboarding.aguardandoContato), tom: onboarding.aguardandoContato > 0 ? "warning" : "neutro" },
        { label: "Reuniões hoje", valor: String(onboarding.reunioesHoje) },
      ],
    },
    {
      key: "implantacao", titulo: "Implantação PABX", href: "/clientes/implantacao", cta: "Abrir Implantação",
      metricas: [
        { label: "Projetos ativos", valor: String(implantacao.ativas) },
        { label: "Bloqueados", valor: String(implantacao.bloqueadas), tom: implantacao.bloqueadas > 0 ? "danger" : "neutro" },
        { label: "Aguardando cliente", valor: String(implantacao.aguardandoCliente), tom: implantacao.aguardandoCliente > 0 ? "warning" : "neutro" },
      ],
    },
    {
      key: "cs", titulo: "Customer Success", href: "/clientes/sucesso", cta: "Abrir CS",
      metricas: [
        { label: "Ações pendentes", valor: String(cs.tarefasAtrasadas) },
        { label: "Renovações próximas", valor: String(cs.renovacoesProximas30d), tom: cs.renovacoesProximas30d > 0 ? "warning" : "neutro" },
        { label: "Sinais de risco", valor: String(cs.clientesEmRisco), tom: cs.clientesEmRisco > 0 ? "danger" : "neutro" },
      ],
    },
    {
      key: "financeiro", titulo: "Financeiro", href: "/clientes/financeiro", cta: "Abrir Financeiro",
      metricas: [
        { label: "MRR atual", valor: brlK(mrrComparativo.atual) },
        { label: "Valor vencido", valor: brlK(financeiro.atrasadoValor), tom: financeiro.atrasadoValor > 0 ? "danger" : "neutro" },
        { label: "Cobranças vencidas", valor: String(financeiro.atrasadoCount), tom: financeiro.atrasadoCount > 0 ? "warning" : "neutro" },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Só a topbar sangra até a borda (-mx-6 -mt-6): ela é o topo do shell.
          O hero escuro fica DENTRO do padding da página, alinhado com as
          demais seções (Jornada, MRR, Workspaces) — antes ele escapava junto
          e ficava colado nas laterais, destoando do resto da tela. */}
      <div className="-mx-6 -mt-6 px-4 sm:px-6 py-2.5 rounded-tl-2xl" style={{ background: "var(--cf2-bg-surface)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" compact compactTitle title="Início" actions={null} />
      </div>

      <Cf2HeroPulso
        eyebrow={`${dataExtenso} · Semana ${semanaIso(hoje)}`}
        saudacao={primeiroNome ? `${periodo}, ${primeiroNome}` : periodo}
        subtitulo="Aqui está o pulso da operação e o que merece a sua atenção agora."
        kpiHero={kpiHero}
        kpis={kpis}
        equipe={equipe}
      />

      <div className="pt-6">
        <Cf2JornadaOperacao
          comercial={[
            { label: "Aquisição", valor: String(aquisicao.total), apoio: "leads no período", href: "/prospeccao" },
            { label: "Pré-vendas", valor: String(funilLeads.emQualificacao.total), apoio: "em qualificação", href: "/pre-vendas" },
            { label: "Pipeline", valor: String(pipelineAtivo.negociosAbertos), apoio: "oportunidades", href: "/pipeline" },
            { label: "Ganhos", valor: String(fechadoMes.ganhos), apoio: "no período", href: "/pipeline?status=ganho" },
          ]}
          posVenda={[
            { label: "Ativação", valor: String(onboarding.ativas), apoio: "em andamento", href: "/clientes/onboarding" },
            { label: "Clientes ativos", valor: String(clientesAtivos), apoio: "base ativa", href: "/clientes" },
            { label: "CS", valor: String(cs.tarefasAtrasadas), apoio: "ações pendentes", href: "/clientes/sucesso" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <Cf2MrrEvolucao
          series={mrrSeries}
          totalFaturamento={mrrComparativo.atual}
          variacaoPct={mrrComparativo.deltaPct}
        />
        <Cf2MetaMes realizado={realizadoMes} meta={metaMes.valorAlvo} produtos={metaProdutos} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <Cf2PrecisaAtencao itens={precisaAtencao} />
        <Cf2OperacaoHoje itens={agendaHoje} />
      </div>

      <Cf2Workspaces cards={workspaces} />
    </div>
  );
}
