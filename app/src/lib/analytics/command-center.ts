/**
 * Cálculos reais do Command Center (V1 do App Shell novo, 09/08). Cada
 * função documenta a REGRA exata usada — pedido explícito do Kauã: métrica
 * sem fonte confiável ou definição formal fica indisponível/N-A, nunca
 * inventada. Reusa funções já validadas (`getFechadoPeriodo`, dual-source
 * do MRR já corrigido) em vez de reimplementar — mesmo princípio de Data
 * Governance do resto do projeto.
 */
import { db } from "@/lib/db";
import { leads, negocios, ligacoes, whatsappMensagens, emails, contatos, usuarios, tarefas, mrrMovimentos, clientes } from "@/lib/db/schema";
import { eq, and, gte, lt, sql, inArray, isNotNull, isNull, or, desc } from "drizzle-orm";
import { getFechadoPeriodo, PIPELINE_ATIVO_STATUSES } from "@/lib/relatorios/comercial";
import { getFluxoMes, getCalendarioRenovacao } from "@/lib/financeiro/metricas";
import { medir } from "@/lib/metricas/catalogo";
import { condicaoMinhasConversas } from "@/lib/whatsapp/acesso";

/**
 * Dias úteis (seg-sex) restantes no mês a partir de `hoje`, incluindo hoje
 * se for dia útil. Cálculo puro de calendário — NÃO considera feriados
 * (sem fonte de feriados no projeto), registrado como aproximação no
 * relatório da rodada.
 */
export function diasUteisRestantesNoMes(hoje = new Date()): number {
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let count = 0;
  while (cursor <= fimMes) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function monthBounds(ref: Date) {
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { inicio, fim };
}

/**
 * MRR ATIVO da carteira — soma dos serviços canônicos recorrentes que estão
 * no portfólio e vivos. Mesma fonte que `lib/cs/metricas.ts` usa como MRR
 * atual, pra que o herói da home e o módulo de CS nunca divirjam.
 *
 * O delta é reconstruído de `mrr_movimentos` na janela (MRR de 30 dias atrás
 * = atual - movimento líquido do período), e não de uma foto histórica — a
 * base não guarda snapshot diário de MRR. Sem movimento na janela o delta é
 * `null`, nunca 0%: "não houve mexida" e "não sei" são coisas diferentes.
 */
export async function getMrrAtivo(orgId: string, janelaDias = 30) {
  const [[ativo], [mov]] = await Promise.all([
    // O número vem do Metric Catalog (Módulo 12): uma métrica, uma definição.
    // Esta query era uma das CINCO expressões de MRR no repositório, e as
    // cinco davam números diferentes — de R$ 61 mil a R$ 497 mil.
    medir(orgId, "mrr_atual").then((m) => [{ mrr: String(m.valor) }]),
    db.execute<{ liquido: string; qtd: string }>(sql`
      SELECT COALESCE(SUM(delta), 0)::text AS liquido,
             COUNT(*)::text                AS qtd
        FROM mrr_movimentos
       WHERE organizacao_id = ${orgId}
         AND ocorrido_em >= now() - (${janelaDias} || ' days')::interval`),
  ]);

  const atual = Number(ativo?.mrr ?? 0);
  const liquido = Number(mov?.liquido ?? 0);
  const anterior = atual - liquido;
  const temMovimento = Number(mov?.qtd ?? 0) > 0;
  const deltaPct = temMovimento && anterior > 0 ? (liquido / anterior) * 100 : null;

  return { atual, anterior, deltaPct, janelaDias };
}

/**
 * MRR fechado no mês atual x MESMO PERÍODO do mês anterior (mesma fonte de
 * `getFechadoPeriodo` — ganho_at + mrr_fechado, já validada/corrigida nesta
 * reconstrução). Delta% = (atual - anterior) / anterior. anterior=0 → delta
 * null (evita divisão por zero / "infinito%" sem sentido).
 */
export async function getMrrComparativo(orgId: string, hoje = new Date()) {
  const atual = monthBounds(hoje);
  const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const anterior = monthBounds(mesAnteriorRef);

  // Mês em curso é parcial: comparar os 8 dias já corridos contra os 30 do mês
  // anterior produz uma queda que não existe (o dia 8 marcava -100%). O
  // recorte do mês anterior para no mesmo dia do mês, então os dois lados
  // cobrem a mesma fatia de calendário. `Math.min` cuida do mês curto — dia 31
  // comparado contra fevereiro vira o fim de fevereiro, não o mês seguinte.
  const diasNoMesAnterior = new Date(mesAnteriorRef.getFullYear(), mesAnteriorRef.getMonth() + 1, 0).getDate();
  const diaCorte = Math.min(hoje.getDate(), diasNoMesAnterior);
  const fimAnteriorParcial = new Date(mesAnteriorRef.getFullYear(), mesAnteriorRef.getMonth(), diaCorte);
  fimAnteriorParcial.setHours(23, 59, 59, 999);

  const [fechadoAtual, fechadoAnterior] = await Promise.all([
    getFechadoPeriodo(orgId, atual.inicio, atual.fim),
    getFechadoPeriodo(orgId, anterior.inicio, fimAnteriorParcial),
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

// ─── Jornada Operacional + Saúde da Receita (App Shell V2, 16/08) ─────
// Funções novas pro frame "crm-command-center-light" (Figma node 172:1259).
// Cada uma documenta se é RECORTE NOVO de dado real já existente (ok, é só
// filtro/agregação) vs. algo que exigiria conceito novo no domínio — esse
// segundo caso NÃO tem função aqui, fica documentado como pendência no
// relatório da rodada e a UI usa Cf2UnavailableMetric.

/**
 * Aquisição de leads no período — total + split Inbound/Outbound pela
 * convenção JÁ usada em produção (getPreVendasVisoes/getMetasPorVendedor/
 * isOutboundLead): leads.origem = 'outbound' (trim+lowercase) é Outbound;
 * qualquer outro valor (incluindo vazio) é Inbound. Não é categorização
 * nova, é reaproveitar a regra canônica existente.
 */
export async function getAquisicaoPeriodo(orgId: string, hoje = new Date()) {
  const { inicio, fim } = monthBounds(hoje);
  const rows = await db
    .select({ origem: leads.origem, total: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), gte(leads.createdAt, inicio), lt(leads.createdAt, fim)))
    .groupBy(leads.origem);

  let outbound = 0, total = 0;
  for (const r of rows) {
    const n = Number(r.total) || 0;
    total += n;
    if ((r.origem || "").trim().toLowerCase() === "outbound") outbound += n;
  }
  return { total, outbound, inbound: total - outbound };
}

/**
 * Tarefas atrasadas de leads em fase de pré-vendas/qualificação (mesmo
 * bucket sdrStatus contacted|qualifying do "Em Qualificação" no Funil de
 * Leads). Recorte novo — antes só existia a lista geral da organização
 * (tarefasPendentesLista, sem filtro de fase); "atrasado" usa a mesma
 * regra visual do resto da página (vencimento antes de hoje).
 */
export async function getPreVendasAtrasados(orgId: string): Promise<number> {
  const hojeStr = new Date().toISOString().split("T")[0];
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(tarefas)
    .innerJoin(leads, eq(leads.id, tarefas.leadId))
    .where(and(
      eq(tarefas.organizacaoId, orgId),
      eq(tarefas.concluida, false),
      lt(tarefas.dataVencimento, hojeStr),
      inArray(leads.sdrStatus, ["contacted", "qualifying"]),
    ));
  return Number(rows[0]?.total || 0);
}

export interface NegociosTravadosResumo { total: number; valor: number; diasMin: number }

/**
 * Negócios abertos sem atividade há >= diasMin dias — AGREGADO org-wide
 * (count+soma), mesmo conceito e mesmo threshold (5 dias) que
 * `getPipelineEsfriando` (comercial.ts) já usa pra listar top-N pro
 * vendedor na Carol. Não duplica regra nova, só agrega em vez de listar.
 */
export async function getNegociosTravadosResumo(orgId: string, diasMin = 5): Promise<NegociosTravadosResumo> {
  const corte = new Date(Date.now() - diasMin * 86_400_000);
  const rows = await db
    .select({ total: sql<number>`count(*)`, valor: sql<string>`sum(${negocios.valorTotal})` })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, PIPELINE_ATIVO_STATUSES),
      lt(negocios.updatedAt, corte),
    ));
  return { total: Number(rows[0]?.total || 0), valor: Number(rows[0]?.valor) || 0, diasMin };
}

export interface MrrLedgerPeriodo { novo: number; expansao: number; churn: number }

/**
 * Ledger de MRR do mês — agrega `mrr_movimentos.tipo` (5 valores reais,
 * escritos só pelo stripe-sync: novo|reativacao|expansao|contracao|churn)
 * nas 3 categorias visuais do Command Center: Novo = novo+reativação ·
 * Expansão = expansao · Downgrades e Churn = contração+churn (delta já
 * vem negativo nesses 2). Escopo real hoje: só produto='ai' passa pelo
 * stripe-sync — MRR de PABX não tem ledger ainda (pendência registrada
 * no relatório da rodada, não é omissão silenciosa).
 */
export async function getMrrLedgerPeriodo(orgId: string, hoje = new Date()): Promise<MrrLedgerPeriodo> {
  const { inicio, fim } = monthBounds(hoje);
  const rows = await db
    .select({ tipo: mrrMovimentos.tipo, delta: sql<string>`sum(${mrrMovimentos.delta})` })
    .from(mrrMovimentos)
    .where(and(eq(mrrMovimentos.organizacaoId, orgId), gte(mrrMovimentos.ocorridoEm, inicio), lt(mrrMovimentos.ocorridoEm, fim)))
    .groupBy(mrrMovimentos.tipo);

  const byTipo = new Map(rows.map((r) => [r.tipo, Number(r.delta) || 0]));
  return {
    novo: (byTipo.get("novo") || 0) + (byTipo.get("reativacao") || 0),
    expansao: byTipo.get("expansao") || 0,
    churn: (byTipo.get("contracao") || 0) + (byTipo.get("churn") || 0),
  };
}

export interface SaudeBaseClientes { ativo: number; inadimplente: number; churned: number }

/**
 * Distribuição real de `clientes.statusFinanceiro` (ativo|inadimplente|
 * churned — cache de leitura já existente, nunca fonte de escrita),
 * mapeada 1:1 pro conceito visual do Figma (Saudáveis/Atenção/Risco).
 * Achado da correção de 17/08: não é health score novo — é a MESMA
 * coluna 3-valores que já existia, eu só não tinha reaproveitado direito
 * na primeira versão desta tela. "Expansão"/"MRR em risco" continuam sem
 * fonte real (não tem MRR corrente por cliente nem flag de risco de MRR
 * estruturada) — ver pendência no relatório da rodada.
 */
export async function getSaudeBaseClientes(orgId: string): Promise<SaudeBaseClientes> {
  const rows = await db
    .select({ status: clientes.statusFinanceiro, total: sql<number>`count(*)` })
    .from(clientes)
    .where(eq(clientes.organizacaoId, orgId))
    .groupBy(clientes.statusFinanceiro);
  const map = new Map(rows.map((r) => [r.status, Number(r.total) || 0]));
  return { ativo: map.get("ativo") || 0, inadimplente: map.get("inadimplente") || 0, churned: map.get("churned") || 0 };
}

export interface PontoMensal { mes: string; valor: number }

/**
 * Série MENSAL (não diária) de MRR fechado recorrente — mesma fonte real
 * de `getFechadoPeriodo`, agregada por mês em vez de por dia. Correção de
 * 17/08: a V1 desta tela reaproveitou por engano o acumulado diário do
 * mês corrente (`getDesempenhoDiario`) pra essa seção — o Figma pede
 * tendência de `meses` meses (Mar→Ago no frame de referência), não
 * acumulado do mês atual. `meses` inclui o mês corrente (parcial).
 */
export async function getDesempenhoMensalTrend(orgId: string, hoje = new Date(), meses = 6): Promise<PontoMensal[]> {
  const refs = Array.from({ length: meses }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1 - i), 1));
  const dados = await Promise.all(refs.map((ref) => {
    const { inicio, fim } = monthBounds(ref);
    return getFechadoPeriodo(orgId, inicio, fim);
  }));
  return refs.map((ref, i) => {
    const label = ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return { mes: label.charAt(0).toUpperCase() + label.slice(1), valor: dados[i].recorrente };
  });
}

// ─── Blocos executivos de "Início" (23/08) — Atendimento/Implantação/CS/
// Financeiro. Contrato do Kauã (prompt mestre): a tela precisa responder
// "como está a operação hoje?" nos 6 eixos (Receita/Comercial já existiam
// nas seções acima; estes 4 fecham o resto). Cada função abaixo REUSA um
// critério real já validado em produção em outro módulo — nunca inventa um
// conceito novo de risco/SLA/atraso. Onde não existe fonte confiável, a
// função simplesmente não existe e a UI usa Cf2UnavailableMetric.

export interface AtendimentoResumo {
  whatsappAbertas: number;
  emailPendentes: number;
  esperaMaisAntigaMinutos: number | null;
}

/**
 * Atendimento — conversas aguardando resposta. Mesmo critério do bucket
 * "todas" de GET /atendimento/conversas (atendimento.ts): WhatsApp aberto
 * (`contatos.status='open'`) com `naoLidas>0` e não adormecido
 * (snoozedUntil nulo ou já expirado); e-mail usa `emails.lido=false` +
 * direção "in" (o inbox de e-mail não passa por `contatos`, é lido direto
 * de `emails` — mesma fonte que `buscarEmail`). Não existe SLA formal (alvo
 * de tempo de resposta) definido em nenhum lugar do produto hoje — em vez
 * de inventar um threshold, expõe o tempo real de espera da mensagem mais
 * antiga da fila (`esperaMaisAntigaMinutos`), que é 100% dado real.
 */
export async function getAtendimentoResumo(orgId: string, usuarioId?: string): Promise<AtendimentoResumo> {
  const [wa] = await db
    .select({ total: sql<number>`count(*)`, minTs: sql<string | null>`min(${contatos.ultimaMsgAt})` })
    .from(contatos)
    .where(and(
      eq(contatos.organizacaoId, orgId),
      // Com usuário: só as conversas dele (a mesma regra "Minhas" da tela de Atendimento e do badge da
      // casca). Sem ele, a organização inteira. O bloco do Início aponta para /atendimento, que abre
      // em "Minhas": o número do bloco tem que ser o que a pessoa encontra lá.
      usuarioId ? condicaoMinhasConversas(usuarioId) : undefined,
      eq(contatos.canal, "whatsapp"),
      eq(contatos.status, "open"),
      sql`${contatos.naoLidas} > 0`,
      or(isNull(contatos.snoozedUntil), sql`${contatos.snoozedUntil} <= now()`)!,
    ));
  const [email] = await db
    .select({ total: sql<number>`count(*)` })
    .from(emails)
    .where(and(eq(emails.organizacaoId, orgId), eq(emails.direcao, "in"), eq(emails.lido, false)));

  const minTs = wa?.minTs ? new Date(wa.minTs) : null;
  return {
    whatsappAbertas: Number(wa?.total || 0),
    emailPendentes: Number(email?.total || 0),
    esperaMaisAntigaMinutos: minTs ? Math.max(0, Math.floor((Date.now() - minTs.getTime()) / 60_000)) : null,
  };
}

export interface ImplantacaoResumo {
  ativas: number;
  ativasNovas30d: number;
  aguardandoCliente: number;
  bloqueadas: number;
  atrasadas: number;
}

/**
 * Implantação — mesmo recorte de GET /fulfillments/resumo (fulfillments.ts),
 * agregado org-wide sem filtro de família. `atrasadas` é um recorte NOVO
 * (não existia lá) mas sobre dado 100% real já existente
 * (`fulfillments.targetAt`, preenchido manualmente pelo time de entrega):
 * ativo (não COMPLETED/CANCELED) com prazo-alvo já passado. Sem targetAt
 * preenchido não entra — nunca fabricar atraso pra quem não tem prazo
 * definido.
 */
export async function getImplantacaoResumo(orgId: string): Promise<ImplantacaoResumo> {
  const [row] = await db.execute<{
    ativas: number; ativas_novas_30d: number; aguardando_cliente: number; bloqueadas: number; atrasadas: number;
  }>(sql`
    WITH base AS (SELECT * FROM fulfillments WHERE organizacao_id = ${orgId})
    SELECT
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED', 'CANCELED')) AS ativas,
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED', 'CANCELED') AND started_at >= now() - interval '30 days') AS ativas_novas_30d,
      (SELECT COUNT(*)::int FROM base WHERE status = 'BLOCKED_CUSTOMER') AS aguardando_cliente,
      (SELECT COUNT(*)::int FROM base WHERE status IN ('BLOCKED_INTERNAL', 'BLOCKED_PROVIDER')) AS bloqueadas,
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED', 'CANCELED') AND target_at IS NOT NULL AND target_at < now()) AS atrasadas
  `);
  return {
    ativas: Number(row?.ativas || 0),
    ativasNovas30d: Number(row?.ativas_novas_30d || 0),
    aguardandoCliente: Number(row?.aguardando_cliente || 0),
    bloqueadas: Number(row?.bloqueadas || 0),
    atrasadas: Number(row?.atrasadas || 0),
  };
}

export interface CsResumo {
  clientesEmRisco: number;
  tarefasAbertas: number;
  tarefasAtrasadas: number;
  renovacoesProximas30d: number;
}

/**
 * CS — `clientesEmRisco` usa o critério JÁ CORRIGIDO de GET
 * /clientes-crm2/resumo (linha ~40-49 daquele arquivo): fatura atrasada,
 * ponto. NÃO usa os 3 sinais originais da fila de GET /clientes-crm2/sucesso
 * (fatura atrasada OU sem próxima tarefa OU sem atividade há >=14 dias) —
 * validado agora no Postgres dev (23/08) que aqueles 3 sinais devolvem
 * 272 em risco pra uma base de 272 clientes ativos (100%, mesmo achado de
 * ruído já documentado no comentário daquele arquivo: "sem próxima ação"
 * tem 0% de cobertura, "sem atividade" flagra a maioria da base). Um
 * card executivo com 100% "em risco" não informa nada — por isso usa a
 * MESMA correção que o Kauã já aceitou pra /resumo (real: 13 clientes
 * hoje), não um critério novo. `tarefasAtrasadas` é um recorte novo sobre
 * o MESMO join leads→empresa já usado em `proxima_tarefa_agg` daquela
 * rota (tarefa vinculada a lead de empresa cliente ativa), só trocando
 * "vence no futuro" por "já venceu". `renovacoesProximas30d` reusa 1:1
 * `getCalendarioRenovacao` (mesma função que já alimenta o Financeiro/
 * metricas.ts), `dias=30` em vez do padrão 90 — "próximas" pede uma
 * janela mais curta que o alerta geral do calendário.
 */
export async function getCsResumo(orgId: string): Promise<CsResumo> {
  // Fonte canônica é o próprio módulo de CS (`cs_riscos` + tarefas com
  // `empresa_id`), não uma releitura de faturas. Dois defeitos que isto
  // corrige:
  //
  // 1. o JOIN antigo era `leads l ON l.id = t.lead_id`, e tarefa de CS nasce
  //    no eixo empresa com `lead_id` nulo — a home mostrava 0 ações pendentes
  //    com a fila de CS cheia. O COALESCE é resolvido numa CTE, nunca com OR
  //    na condição de join (isso já travou o Postgres aqui uma vez).
  // 2. "sinais de risco" contava fatura atrasada. Agora conta risco aberto de
  //    severidade acionável: ATENCAO é ruído de fundo (SEM_INTERACAO pega 200+
  //    contas por design) e não entra na fila, então também não vira alerta.
  const [row] = await db.execute<{ em_risco: number; tarefas_abertas: number; tarefas_atrasadas: number }>(sql`
    WITH carteira AS (
      SELECT DISTINCT sc.empresa_id
        FROM servicos_canonicos sc
        JOIN empresas e ON e.id = sc.empresa_id AND e.organizacao_id = ${orgId}
       WHERE sc.portfolio_included = true AND sc.empresa_id IS NOT NULL
    ),
    tarefa_empresa AS (
      SELECT COALESCE(t.empresa_id, l.empresa_id) AS empresa_id, t.vence_em
        FROM tarefas t
        LEFT JOIN leads l ON l.id = t.lead_id
       WHERE t.organizacao_id = ${orgId} AND t.concluida = false
    )
    SELECT
      (SELECT COUNT(DISTINCT r.empresa_id)::int
         FROM cs_riscos r
         JOIN carteira c ON c.empresa_id = r.empresa_id
        WHERE r.organizacao_id = ${orgId} AND r.status = 'ABERTO'
          AND r.severidade IN ('CRITICO', 'EM_RISCO')
      ) AS em_risco,
      (SELECT COUNT(*)::int FROM tarefa_empresa te
         JOIN carteira c ON c.empresa_id = te.empresa_id
      ) AS tarefas_abertas,
      (SELECT COUNT(*)::int FROM tarefa_empresa te
         JOIN carteira c ON c.empresa_id = te.empresa_id
        WHERE te.vence_em IS NOT NULL AND te.vence_em < now()
      ) AS tarefas_atrasadas
  `);

  const renovacoes = await getCalendarioRenovacao(orgId, 30);
  return {
    clientesEmRisco: Number(row?.em_risco || 0),
    tarefasAbertas: Number(row?.tarefas_abertas || 0),
    tarefasAtrasadas: Number(row?.tarefas_atrasadas || 0),
    renovacoesProximas30d: renovacoes.length,
  };
}

export interface FinanceiroResumo {
  recebidoMes: number;
  emAberto: number;
  atrasadoValor: number;
  atrasadoCount: number;
}

/**
 * Financeiro — `recebidoMes`/`emAberto` reusam 1:1 `getFluxoMes` (mesma
 * função que já alimenta a aba Visão Geral do Financeiro em
 * lib/financeiro/metricas.ts). `atrasadoValor`/`atrasadoCount` são um
 * recorte novo, mas sobre o MESMO critério de "atrasada" repetido em todo
 * o resto do projeto (`status='aberta' AND COALESCE(vencimento,emitida_em)
 * < now()`, ver clientes-crm2.ts/clientes-financeiro.ts) — é o subconjunto
 * vencido dentro de `emAberto`, nunca um valor paralelo.
 */
export async function getFinanceiroResumo(orgId: string): Promise<FinanceiroResumo> {
  const fluxo = await getFluxoMes(orgId);
  const [row] = await db.execute<{ n: number; valor: string }>(sql`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(f.valor), 0) AS valor
    FROM faturas f
    WHERE f.organizacao_id = ${orgId} AND f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
  `);
  return {
    recebidoMes: fluxo.recebidoMes,
    emAberto: fluxo.emAberto,
    atrasadoValor: Number(row?.valor || 0),
    atrasadoCount: Number(row?.n || 0),
  };
}
