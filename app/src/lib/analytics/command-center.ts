/**
 * Cálculos reais do Command Center (V1 do App Shell novo, 09/08). Cada
 * função documenta a REGRA exata usada — pedido explícito do Kauã: métrica
 * sem fonte confiável ou definição formal fica indisponível/N-A, nunca
 * inventada. Reusa funções já validadas (`getFechadoPeriodo`, dual-source
 * do MRR já corrigido) em vez de reimplementar — mesmo princípio de Data
 * Governance do resto do projeto.
 */
import { db } from "@/lib/db";
import { leads, negocios, ligacoes, whatsappMensagens, emails, contatos, usuarios } from "@/lib/db/schema";
import { eq, and, gte, lt, sql, inArray, isNotNull, desc } from "drizzle-orm";
import { getFechadoPeriodo } from "@/lib/relatorios/comercial";

function monthBounds(ref: Date) {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { inicio, fim };
}

/**
 * MRR fechado no mês atual x mês anterior (mesma fonte de `getFechadoPeriodo`
 * — ganho_at + mrr_fechado, já validada/corrigida nesta reconstrução).
 * Delta% = (atual - anterior) / anterior. anterior=0 → delta null (evita
 * divisão por zero / "infinito%" sem sentido).
 */
export async function getMrrComparativo(orgId: string, hoje = new Date()) {
  const atual = monthBounds(hoje);
  const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const anterior = monthBounds(mesAnteriorRef);

  const [fechadoAtual, fechadoAnterior] = await Promise.all([
    getFechadoPeriodo(orgId, atual.inicio, atual.fim),
    getFechadoPeriodo(orgId, anterior.inicio, anterior.fim),
  ]);

  const deltaPct = fechadoAnterior.recorrente > 0
    ? ((fechadoAtual.recorrente - fechadoAnterior.recorrente) / fechadoAnterior.recorrente) * 100
    : null;

  return { atual: fechadoAtual.recorrente, anterior: fechadoAnterior.recorrente, deltaPct };
}

/**
 * Série diária acumulada de MRR fechado (ganho_at) — mês atual x mês
 * anterior, pro gráfico "Desempenho Diário". Calculado direto de `negocios`
 * (fato histórico imutável, dá pra reconstruir qualquer mês passado — não
 * depende de `metricas_diarias` acumular histórico, que só existe desde
 * 09/08 e não tem mês anterior ainda).
 */
export async function getDesempenhoDiario(orgId: string, hoje = new Date()) {
  async function serieDoMes(ref: Date) {
    const { inicio, fim } = monthBounds(ref);
    const rows = await db
      .select({
        dia: sql<string>`date_trunc('day', ${negocios.ganhoAt})`,
        mrr: sql<string>`sum(${negocios.mrrFechado})`,
      })
      .from(negocios)
      .where(and(
        eq(negocios.organizacaoId, orgId),
        eq(negocios.status, "ganho"),
        gte(negocios.ganhoAt, inicio),
        lt(negocios.ganhoAt, fim),
        sql`${negocios.tipoReceita} != 'avulso'`,
      ))
      .groupBy(sql`date_trunc('day', ${negocios.ganhoAt})`);

    const porDia = new Map<number, number>();
    for (const r of rows) porDia.set(new Date(r.dia).getDate(), Number(r.mrr) || 0);

    const diasNoMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    let acumulado = 0;
    const serie: { dia: number; valorAcumulado: number }[] = [];
    for (let d = 1; d <= diasNoMes; d++) {
      acumulado += porDia.get(d) || 0;
      serie.push({ dia: d, valorAcumulado: acumulado });
    }
    return serie;
  }

  const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [atual, anterior] = await Promise.all([serieDoMes(hoje), serieDoMes(mesAnteriorRef)]);
  return { atual, anterior };
}

/**
 * Funil de Leads — snapshot AGORA (não é "no mês", é "no estado atual"),
 * mesma categorização real usada no board de Pré-vendas (sdrBoardColumn):
 * Novos = sdr_status pending · Em Qualificação = contacted/qualifying ·
 * Qualificados = tem negócio ativo vinculado · No Show = negócios em
 * status no_show. Contagem org-wide, não filtrada por responsável.
 *
 * Cada bucket também traz "noMes" (quantos ENTRARAM nesse bucket este mês
 * — leads/negócios com `createdAt` no mês corrente), pedido do Kauã pra
 * dar a mesma leitura de vazão que o "26 negócios" do Pipeline Comercial.
 */
export async function getFunilLeads(orgId: string, hoje = new Date()) {
  const { inicio, fim } = monthBounds(hoje);
  const noMesFiltro = and(gte(leads.createdAt, inicio), lt(leads.createdAt, fim));

  const [porStatus, porStatusMes, comNegocioAtivo, comNegocioAtivoMes, noShow, noShowMes] = await Promise.all([
    db.select({ status: leads.sdrStatus, total: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead")))
      .groupBy(leads.sdrStatus),
    db.select({ status: leads.sdrStatus, total: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), noMesFiltro))
      .groupBy(leads.sdrStatus),
    db.select({ total: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), isNotNull(leads.negocioAtivoId))),
    db.select({ total: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), isNotNull(leads.negocioAtivoId), noMesFiltro)),
    db.select({ total: sql<number>`count(*)` })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, orgId), eq(negocios.status, "no_show"))),
    db.select({ total: sql<number>`count(*)` })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, orgId), eq(negocios.status, "no_show"), gte(negocios.createdAt, inicio), lt(negocios.createdAt, fim))),
  ]);

  const map = new Map(porStatus.map((r) => [r.status, Number(r.total)]));
  const mapMes = new Map(porStatusMes.map((r) => [r.status, Number(r.total)]));

  return {
    novos: { total: map.get("pending") || 0, noMes: mapMes.get("pending") || 0 },
    emQualificacao: {
      total: (map.get("contacted") || 0) + (map.get("qualifying") || 0),
      noMes: (mapMes.get("contacted") || 0) + (mapMes.get("qualifying") || 0),
    },
    qualificados: { total: Number(comNegocioAtivo[0]?.total || 0), noMes: Number(comNegocioAtivoMes[0]?.total || 0) },
    noShow: { total: Number(noShow[0]?.total || 0), noMes: Number(noShowMes[0]?.total || 0) },
  };
}

// Mapeamento explícito Figma→stages reais (documentado — NÃO é 1:1 óbvio,
// é decisão registrada em ADR): "Fechamento" não é etapa aberta de pipeline,
// é negócio GANHO no período (fato encerrado, não snapshot em andamento).
const BUCKET_STATUSES: Record<string, string[]> = {
  reuniao: ["reuniao_agendada", "reuniao_realizada"],
  proposta: ["trial", "proposta_apresentada"],
  negociacao: ["negociacao_iniciada"],
};

/**
 * Pipeline Comercial — 3 buckets abertos (contagem/valor SNAPSHOT agora) +
 * "Fechamento" = ganho no mês corrente (fato, não snapshot).
 *
 * Achado real na validação (09/08): a primeira versão calculava "conversão"
 * como razão simples entre contagens de buckets ADJACENTES agora — e deu
 * "Conv. 231%" (Proposta tinha mais negócios acumulados que Reunião no
 * momento do snapshot). Isso prova que a métrica não é válida: conversão de
 * verdade precisa de COORTE (o mesmo grupo de negócios acompanhado no
 * tempo), não uma razão entre contagens de momentos diferentes do funil.
 * Não temos funil-eventos com granularidade de coorte ainda — regra do
 * Kauã (09/08): métrica sem definição confiável fica indisponível, não
 * fabricada. `convPct` fica sempre `null` de propósito; UI mostra
 * "Indisponível" em vez de %.
 */
export async function getPipelineComercial(orgId: string, hoje = new Date()) {
  const rows = await db
    .select({ status: negocios.status, total: sql<number>`count(*)`, valor: sql<string>`sum(${negocios.valorTotal})` })
    .from(negocios)
    .where(and(eq(negocios.organizacaoId, orgId), inArray(negocios.status, Object.values(BUCKET_STATUSES).flat())))
    .groupBy(negocios.status);

  const byStatus = new Map(rows.map((r) => [r.status, { total: Number(r.total), valor: Number(r.valor) || 0 }]));
  const somaBucket = (statuses: string[]) =>
    statuses.reduce((acc, s) => {
      const r = byStatus.get(s);
      return { total: acc.total + (r?.total || 0), valor: acc.valor + (r?.valor || 0) };
    }, { total: 0, valor: 0 });

  const reuniao = somaBucket(BUCKET_STATUSES.reuniao);
  const proposta = somaBucket(BUCKET_STATUSES.proposta);
  const negociacao = somaBucket(BUCKET_STATUSES.negociacao);
  const { inicio, fim } = monthBounds(hoje);
  const fechado = await getFechadoPeriodo(orgId, inicio, fim);

  return [
    { label: "Reunião", total: reuniao.total, valor: reuniao.valor, convPct: null as number | null },
    { label: "Proposta", total: proposta.total, valor: proposta.valor, convPct: null as number | null },
    { label: "Negociação", total: negociacao.total, valor: negociacao.valor, convPct: null as number | null },
    { label: "Fechamento", total: fechado.ganhos, valor: fechado.receita, convPct: null as number | null },
  ];
}

/**
 * Comunicações — só CONTAGEM real por canal no mês (fato simples, sem
 * fórmula nenhuma). Deliberadamente SEM taxa de atendida/resposta/abertura
 * — regra explícita do Kauã (09/08): não inventar % sem fonte confiável
 * (email nem tem tracking de abertura no schema; ligação/whatsapp não têm
 * definição formal do que conta como "sucesso" ainda). UI mostra a taxa
 * como indisponível, não fabrica o número.
 */
export async function getComunicacoesResumo(orgId: string, hoje = new Date()) {
  const { inicio, fim } = monthBounds(hoje);
  const [ligacoesCount, waCount, emailCount] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(ligacoes)
      .where(and(eq(ligacoes.organizacaoId, orgId), gte(ligacoes.createdAt, inicio), lt(ligacoes.createdAt, fim))),
    db.select({ total: sql<number>`count(*)` }).from(whatsappMensagens)
      .innerJoin(contatos, eq(contatos.id, whatsappMensagens.contatoId))
      .where(and(eq(contatos.organizacaoId, orgId), gte(whatsappMensagens.createdAt, inicio), lt(whatsappMensagens.createdAt, fim))),
    db.select({ total: sql<number>`count(*)` }).from(emails)
      .where(and(eq(emails.organizacaoId, orgId), gte(emails.createdAt, inicio), lt(emails.createdAt, fim))),
  ]);
  return {
    ligacoes: Number(ligacoesCount[0]?.total || 0),
    whatsapp: Number(waCount[0]?.total || 0),
    email: Number(emailCount[0]?.total || 0),
  };
}

export interface AtividadeRecenteItem {
  id: string;
  texto: string;
  canal: "ligacao" | "whatsapp" | "email";
  quando: Date;
}

/** Feed real de atividade recente cross-canal — últimos eventos reais, sem cálculo nenhum, só ordenação por data. */
export async function getAtividadeRecente(orgId: string, limite = 3): Promise<AtividadeRecenteItem[]> {
  const [ultimasLigacoes, ultimasWa, ultimosEmails] = await Promise.all([
    db.select({
      id: ligacoes.id, createdAt: ligacoes.createdAt, duracao: ligacoes.duracaoSegundos,
      userName: ligacoes.userName, destino: ligacoes.destinationNumber,
    }).from(ligacoes).where(eq(ligacoes.organizacaoId, orgId)).orderBy(desc(ligacoes.createdAt)).limit(limite),
    db.select({
      id: whatsappMensagens.id, createdAt: whatsappMensagens.createdAt, direcao: whatsappMensagens.direcao,
      nome: contatos.nome,
    }).from(whatsappMensagens).innerJoin(contatos, eq(contatos.id, whatsappMensagens.contatoId))
      .where(and(eq(contatos.organizacaoId, orgId), eq(whatsappMensagens.direcao, "in")))
      .orderBy(desc(whatsappMensagens.createdAt)).limit(limite),
    db.select({
      id: emails.id, createdAt: emails.createdAt, para: emails.para, direcao: emails.direcao,
    }).from(emails).where(eq(emails.organizacaoId, orgId)).orderBy(desc(emails.createdAt)).limit(limite),
  ]);

  const itens: AtividadeRecenteItem[] = [
    ...ultimasLigacoes.map((l) => ({
      id: `lig-${l.id}`,
      canal: "ligacao" as const,
      quando: l.createdAt,
      texto: `Ligação completada${l.userName ? ` por ${l.userName}` : ""}${l.destino ? ` para ${l.destino}` : ""}${l.duracao ? ` (${Math.floor(l.duracao / 60)}m ${l.duracao % 60}s)` : ""}`,
    })),
    ...ultimasWa.map((w) => ({
      id: `wa-${w.id}`,
      canal: "whatsapp" as const,
      quando: w.createdAt,
      texto: `Mensagem recebida de ${w.nome} via WhatsApp`,
    })),
    ...ultimosEmails.map((e) => ({
      id: `email-${e.id}`,
      canal: "email" as const,
      quando: e.createdAt,
      texto: e.direcao === "out" ? `E-mail enviado para ${e.para}` : `E-mail recebido de ${e.para}`,
    })),
  ];

  return itens.sort((a, b) => b.quando.getTime() - a.quando.getTime()).slice(0, limite);
}
