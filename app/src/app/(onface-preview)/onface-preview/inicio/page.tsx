import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { getClientesAtivos } from "@/lib/analytics/inicio";
import {
  getEvolucaoOperacao, getJornadaEtapas, getLeadsGerados, getOperacaoDetalhe,
  getOperacoesAtivas, getOperacoesPrioritarias, getReceitaMes,
} from "@/lib/analytics/onface-inicio";
import {
  HomePageFigma, type DadosInicio, type PontoSerie, type TomTendencia,
} from "@/components/onface/inicio/HomePageFigma";

export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (d: number | null) => (d === null ? "—" : `${d >= 0 ? "+ " : "− "}${Math.abs(d)}%`);
/**
 * O selo do card só pode ser verde quando o número subiu. O frame do Figma traz
 * os quatro cards com o mesmo selo positivo — no desenho todos os números eram
 * inventados e positivos — e ligado ao dado real isso pintava de verde uma
 * receita de −78%. Zero é "parado", não "bom".
 */
const tomDoDelta = (d: number | null): TomTendencia =>
  d === null || d === 0 ? "neutro" : d > 0 ? "ok" : "risco";
const dataCurta = (d: Date | null) =>
  d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * O subtítulo do card de evolução dizia "Crescimento consistente em todas as
 * frentes." — escrito na marcação, no mesmo card em que a receita caía 78%. Uma
 * afirmação sobre o dado tem que sair do dado; quando a série não permite
 * afirmar nada, o certo é dizer o período, não elogiar a operação.
 */
function resumoDaEvolucao(serie: PontoSerie[]): string {
  if (serie.length < 2) return "Histórico ainda curto para comparar.";
  const primeiro = serie[0], ultimo = serie[serie.length - 1];
  const janela = `${primeiro.label} a ${ultimo.label}`;
  const sobe = (a: number, b: number) => b > a;
  const subindo = [
    sobe(primeiro.receita, ultimo.receita) && "receita",
    sobe(primeiro.leads, ultimo.leads) && "leads",
    sobe(primeiro.ganhos, ultimo.ganhos) && "ganhos",
  ].filter(Boolean) as string[];
  if (subindo.length === 3) return `${janela}: receita, leads e ganhos em alta.`;
  if (subindo.length === 0) return `${janela}: as três frentes abaixo do início do período.`;
  return `${janela}: ${subindo.join(" e ")} em alta, o resto abaixo do início do período.`;
}

/**
 * Visão Geral ONFACE — preview.
 *
 * A tela é a marcação do Figma (ver `HomePageFigma`); esta página só resolve
 * os dados reais e os entrega. Vive fora das rotas oficiais até a promoção ser
 * aprovada — a `/inicio` atual segue intacta.
 */
export default async function OnfaceInicioPreview() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const hoje = new Date();

  const [receita, leads, ativas, clientes, jornada, prioritarias, evolucao] = await Promise.all([
    getReceitaMes(ctx.organizacaoId, hoje),
    getLeadsGerados(ctx.organizacaoId, hoje),
    getOperacoesAtivas(ctx.organizacaoId),
    getClientesAtivos(ctx.organizacaoId),
    getJornadaEtapas(ctx.organizacaoId, hoje),
    getOperacoesPrioritarias(ctx.organizacaoId, 5),
    getEvolucaoOperacao(ctx.organizacaoId, hoje),
  ]);

  const [entrega] = await db.execute<{ id: string }>(sql`
    SELECT id FROM fulfillments
     WHERE organizacao_id = ${ctx.organizacaoId}
       AND status NOT IN ('COMPLETED','CANCELED')
     ORDER BY updated_at DESC LIMIT 1
  `);
  const op = entrega ? await getOperacaoDetalhe(ctx.organizacaoId, entrega.id) : null;

  const primeiroNome = (ctx.userName || "").split(" ")[0];
  const horaSp = Number(hoje.toLocaleString("pt-BR", { timeZone: TZ, hour: "2-digit", hour12: false }));
  const periodo = horaSp < 12 ? "Bom dia" : horaSp < 18 ? "Boa tarde" : "Boa noite";
  const dataBruta = hoje.toLocaleDateString("pt-BR", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  });

  const prazoTexto =
    op?.sla === "vencido" && op.diasPrazo !== null
      ? `${Math.abs(op.diasPrazo)} dias em atraso`
      : op?.diasPrazo !== null && op?.diasPrazo !== undefined
        ? `${op.diasPrazo} dias restantes`
        : "Sem prazo definido";

  const pipelineParado = jornada.find((e) => e.chave === "pipeline")?.vencidos ?? 0;

  // `getEvolucaoOperacao` devolve doze meses já rotulados ("Jan"…"Dez").
  // Seis cabem na largura do card sem os rótulos se encavalarem.
  const serie = evolucao.slice(-6);

  const d: DadosInicio = {
    saudacao: primeiroNome ? `${periodo}, ${primeiroNome}.` : `${periodo}.`,
    dataExtenso: `${dataBruta.charAt(0).toUpperCase()}${dataBruta.slice(1)} · Callface`,
    receita: { valor: brl(receita.valor), delta: pct(receita.deltaPct), tom: tomDoDelta(receita.deltaPct) },
    leads: { valor: leads.valor.toLocaleString("pt-BR"), delta: pct(leads.deltaPct), tom: tomDoDelta(leads.deltaPct) },
    operacoesAtivas: ativas.toLocaleString("pt-BR"),
    // O desenho traz um badge fixo de "+ 8%" aqui, mas não existe série
    // histórica de operações ativas nem de clientes para comparar mês a mês.
    // Sem base, o selo fica neutro em vez de exibir número inventado.
    operacoesDelta: "—",
    operacoesTom: "neutro",
    clientesAtivos: clientes.toLocaleString("pt-BR"),
    clientesDelta: "—",
    clientesTom: "neutro",
    operacao: {
      empresa: op?.empresa ?? "Nenhuma entrega em curso",
      servico: op?.servico ?? "—",
      responsavel: op?.responsavel?.nome ?? "Sem responsável",
      cargo: op?.serviceFamily.replace(/_/g, " ") ?? "—",
      valor: op && op.valor > 0 ? brl(op.valor) : "—",
      proximoPasso: op?.proximoPasso?.titulo ?? "Nenhum item aberto",
      proximoPassoData: dataCurta(op?.proximoPasso?.prazo ?? null),
      prazo: op?.sla === "vencido" ? "Atrasado" : "No prazo",
      prazoApoio: op?.prazoEstimado ? `${prazoTexto} (estimado)` : prazoTexto,
      // O mockup traz "82 Saudável" num Health Score que o modelo não tem.
      // No lugar entra o risco, que sai de sinais reais: itens bloqueados,
      // faturas vencidas da empresa e prazo estourado.
      insight: pipelineParado > 0
        ? `${pipelineParado} negócios sem atividade há mais de 14 dias.`
        : "Nada fora do lugar na operação agora.",
      risco: op
        ? op.risco.nivel === "ok"
          ? "Sem risco"
          : op.risco.sinais.map((s) => `${s.valor} ${s.label.toLowerCase()}`).join(" · ")
        : "—",
    },
    resumo: {
      // "Prioridade" não existe em fulfillments — o que existe é severidade
      // derivada de bloqueio e prazo, que é o que entra aqui.
      prioridade: op?.risco.nivel === "critico" ? "Alta" : op?.risco.nivel === "atencao" ? "Média" : "Normal",
      status: op?.sla === "vencido" ? "Atrasada" : op?.proximoPasso ? "Em andamento" : "Sem itens abertos",
      origem: op?.serviceFamily.replace(/_/g, " ") ?? "—",
      inicio: dataCurta(op?.inicio ?? null),
      previsao: dataCurta(op?.prazo ?? null),
    },
    jornada0: jornada[0]?.label ?? "—",
    jornada1: jornada[1]?.label ?? "—",
    jornada2: jornada[2]?.label ?? "—",
    jornada3: jornada[3]?.label ?? "—",
    evolucao: serie,
    evolucaoResumo: resumoDaEvolucao(serie),
    operacoes: prioritarias.map((l) => ({
      empresa: l.empresa,
      descricao: l.descricao,
      etapa: l.etapa,
      valor: l.valor > 0 ? brl(l.valor) : "—",
    })),
    // O desenho tem quatro cards de progresso. Aqui entram os quatro
    // primeiros workstreams reais da entrega em foco; sem entrega em curso,
    // caem as etapas da jornada comercial.
    etapas: op?.etapas.length
      ? op.etapas.slice(0, 4).map((e) => ({
          nome: e.workstream.replace(/_/g, " "),
          pct: `${e.pct}%`,
        }))
      : jornada.slice(0, 4).map((e) => ({
          nome: e.label,
          pct: e.total > 0 ? `${Math.round(((e.total - e.vencidos) / e.total) * 100)}%` : "0%",
        })),
  };

  return (
    <div className="onface-figma-frame">
      <HomePageFigma d={d} />
    </div>
  );
}
