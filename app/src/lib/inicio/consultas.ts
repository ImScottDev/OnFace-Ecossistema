/**
 * Leituras do Início, uma por bloco.
 *
 * Duas regras vêm do resto do produto e valem aqui:
 *   - toda leitura filtra `organizacao_id` (vem da sessão no servidor, nunca do cliente);
 *   - número que a tela mostra sai de `count()` sobre a tabela inteira, nunca do
 *     tamanho de uma lista cortada para caber na tela.
 *
 * E uma regra deste arquivo: **reusar antes de escrever**. MRR, meta, ranking,
 * agenda, atenção, implantação, CS, financeiro, atendimento e inventário de
 * integrações já têm dono, e uma segunda conta para o mesmo nome é o defeito que
 * o Metric Catalog existe para acabar (ver `arquitetura/metrica-definicao-unica`).
 * O que nenhuma função existente devolve — séries diárias, fila de 1º contato,
 * propostas do closer — nasce aqui, enxuto, com uma ida ao banco por pergunta.
 */
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { condicaoMinhasConversas } from "@/lib/whatsapp/acesso";
import { somenteDePreVendas } from "@onface/acquisition";
import { getMetaComercialAgregada, getMetasDoUsuario, getRealizadoMeta } from "@/lib/metas";
import { PAPEIS_QUE_SOMAM_NA_META } from "@/lib/metas-shared";
import { getMrrAtivo, getImplantacaoResumo, getCsResumo, getFinanceiroResumo, getAtendimentoResumo } from "@/lib/analytics/command-center";
import { getAgendaHoje, getClientesAtivos } from "@/lib/analytics/inicio";
import { inventarioDeIntegracoes } from "@/lib/integrations/inventario";
import { visaoGeralVendasMes } from "@/lib/vendas/visao-geral";
import { resumoSlaPreVendas } from "@/lib/vendas/sla-lead";
import {
  brlInteiro, chaveDoDia, classificarFila, deltaDe, deltaDePct, diasUteisAteOFimDoMes, duracaoCurta,
  mesesDeFaturamento, mesesDeMrr, moedaCompacta, pctDaMeta, ritmoPorDia, ultimosDias, type LinhaLedger,
} from "./lente";
import type {
  Agenda, Atencao, Entrega, EstadoSaude, EtapaFunil, Financeiro, Funil, HeroEntrega, HeroFila, HeroFaturamento, HeroMeta,
  ItemAgenda, ItemAtencao, ItemSaude, Kpi, Saude,
} from "./tipos";
import { contarPorSeveridade, ordenarPorUrgencia } from "./lente";

const FUSO = "America/Sao_Paulo";
/** O Brasil não tem horário de verão desde 2019: o fuso fixo é -03:00. */
const OFFSET = "-03:00";

export interface Ctx {
  orgId: string;
  userId: string;
  agora: Date;
}

/* ═══ Calendário ═══════════════════════════════════════════════════════════ */

const inicioDoDia = (chave: string) => `${chave}T00:00:00${OFFSET}`;

/* ═══ Séries diárias ═══════════════════════════════════════════════════════ */

const JANELA = 30;

/** Preenche com zero o dia sem registro: dia vazio é zero, não buraco. */
async function serie60(consulta: (desdeIso: string) => Promise<Array<{ dia: string; v: string | number }>>, agora: Date): Promise<number[]> {
  const dias = ultimosDias(agora, JANELA * 2);
  const linhas = await consulta(inicioDoDia(dias[0]));
  const porDia = new Map(linhas.map((l) => [l.dia, Number(l.v) || 0]));
  return dias.map((d) => porDia.get(d) ?? 0);
}

const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

/** Os 30 dias mais recentes contra os 30 anteriores: a mesma régua para todo KPI
 *  (comparar "o mês até hoje" com "o mês passado inteiro" mente nos primeiros dias). */
export function janelasDe(serie: number[]): { atual: number[]; anterior: number[] } {
  return { atual: serie.slice(-JANELA), anterior: serie.slice(0, -JANELA) };
}

function kpiDeSerie(opts: {
  chave: string; rotulo: string; serie: number[]; formato: (n: number) => string;
  apoio: string; href: string | null; maisEhMelhor?: boolean; agora: Date;
}): Kpi {
  const { atual, anterior } = janelasDe(opts.serie);
  const total = soma(atual);
  return {
    chave: opts.chave,
    rotulo: opts.rotulo,
    valor: opts.formato(total),
    apoio: opts.apoio,
    delta: deltaDe(total, soma(anterior), { maisEhMelhor: opts.maisEhMelhor }),
    serie: atual,
    serieRotulo: "últimos 30 dias",
    serieFim: chaveDoDia(opts.agora),
    href: opts.href,
  };
}

/* Definição de faturamento do Início: a MESMA de Relatórios > Comercial
 * (`getFechadoPeriodo`, lib/relatorios/comercial.ts): negócio ganho, no mês de
 * `ganho_at`; recorrente e híbrido contam a mensalidade (`mrr_fechado`), avulso e
 * projeto contam o valor cheio (`valor_total`). O setup de negócio híbrido NÃO
 * entra. Duas telas com o mesmo nome e contas diferentes foi o defeito de
 * setembro (R$ 88,4 mil aqui contra R$ 61,3 mil lá, por causa do setup).
 * A META segue a definição das Metas (mensalidade + setup, `lib/metas.ts`). */
const FATURAMENTO = sql`CASE WHEN n.tipo_receita IN ('avulso','projeto') THEN COALESCE(n.valor_total,0)::numeric ELSE COALESCE(n.mrr_fechado,0)::numeric END`;
const APOIO_JANELA = "últimos 30 dias · vs 30 anteriores";

const faturamentoPorDia = (orgId: string, agora: Date, responsavelId: string | null) =>
  serie60(async (desde) => db.execute<{ dia: string; v: string }>(sql`
    SELECT to_char((n.ganho_at AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS dia, SUM(${FATURAMENTO})::text AS v
      FROM negocios n
     WHERE n.organizacao_id = ${orgId}::uuid AND n.status = 'ganho'
       AND n.ganho_at >= ${desde}::timestamptz
       AND (${responsavelId}::uuid IS NULL OR n.responsavel_id = ${responsavelId}::uuid)
     GROUP BY 1`), agora);

const leadsPorDia = (orgId: string, agora: Date, responsavelId: string | null) =>
  serie60(async (desde) => db.execute<{ dia: string; v: number }>(sql`
    SELECT to_char((COALESCE(lg.pre_qualificado_em, a.created_at) AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS dia, count(*)::int AS v
      FROM aquisicoes a LEFT JOIN leads lg ON lg.id = a.lead_legado_id
     WHERE a.organizacao_id = ${orgId}::uuid AND ${somenteDePreVendas(sql)}
       AND COALESCE(lg.pre_qualificado_em, a.created_at) >= ${desde}::timestamptz
       AND (${responsavelId}::uuid IS NULL OR a.responsavel_id = ${responsavelId}::uuid)
     GROUP BY 1`), agora);

const qualificadosPorDia = (orgId: string, agora: Date, responsavelId: string) =>
  serie60(async (desde) => db.execute<{ dia: string; v: number }>(sql`
    SELECT to_char((a.qualificado_em AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS dia, count(*)::int AS v
      FROM aquisicoes a LEFT JOIN leads lg ON lg.id = a.lead_legado_id
     WHERE a.organizacao_id = ${orgId}::uuid AND ${somenteDePreVendas(sql)}
       AND a.qualificado_em >= ${desde}::timestamptz AND a.responsavel_id = ${responsavelId}::uuid
     GROUP BY 1`), agora);

const propostasEnviadasPorDia = (orgId: string, agora: Date, responsavelId: string | null) =>
  serie60(async (desde) => db.execute<{ dia: string; v: number }>(sql`
    SELECT to_char((p.enviada_em AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS dia, count(*)::int AS v
      FROM propostas p JOIN negocios n ON n.id = p.negocio_id
     WHERE p.organizacao_id = ${orgId}::uuid AND p.enviada_em >= ${desde}::timestamptz
       AND (${responsavelId}::uuid IS NULL OR n.responsavel_id = ${responsavelId}::uuid)
     GROUP BY 1`), agora);

const entregasConcluidasPorDia = (orgId: string, agora: Date) =>
  serie60(async (desde) => db.execute<{ dia: string; v: number }>(sql`
    SELECT to_char((completed_at AT TIME ZONE ${FUSO})::date, 'YYYY-MM-DD') AS dia, count(*)::int AS v
      FROM fulfillments
     WHERE organizacao_id = ${orgId}::uuid AND status = 'COMPLETED' AND completed_at >= ${desde}::timestamptz
     GROUP BY 1`), agora);

/* ═══ Conversas aguardando (WhatsApp) ══════════════════════════════════════ */

const SEM_SONECA = or(isNull(contatos.snoozedUntil), sql`${contatos.snoozedUntil} <= now()`)!;

async function conversasAguardando(orgId: string, userId: string | null, limite: number) {
  const condicoes = and(
    eq(contatos.organizacaoId, orgId),
    userId ? condicaoMinhasConversas(userId) : undefined,
    eq(contatos.canal, "whatsapp"),
    eq(contatos.status, "open"),
    gt(contatos.naoLidas, 0),
    SEM_SONECA,
  );
  const [lista, [tot]] = await Promise.all([
    db.select({ id: contatos.id, nome: contatos.nome, leadId: contatos.leadId, desde: contatos.ultimaMsgAt })
      .from(contatos).where(condicoes).orderBy(asc(contatos.ultimaMsgAt)).limit(limite),
    db.select({ n: sql<number>`count(*)::int` }).from(contatos).where(condicoes),
  ]);
  return { lista, total: Number(tot?.n ?? 0) };
}

/* ═══ Heróis ═══════════════════════════════════════════════════════════════ */

export async function heroFaturamento(ctx: Ctx): Promise<HeroFaturamento> {
  const { orgId, agora } = ctx;
  const hoje = chaveDoDia(agora);
  const diaHoje = Number(hoje.slice(8, 10));
  const grade = mesesDeFaturamento(new Map(), hoje, 6);
  const [mrr, linhas, ledger, meta] = await Promise.all([
    getMrrAtivo(orgId),
    // Mesma conta de Relatórios > Comercial e do KPI "Faturamento" (ver FATURAMENTO),
    // agrupada por mês de São Paulo. `ate_hoje` é o mês só até
    // o dia de hoje: comparar o mês parcial com o anterior inteiro mente no dia 3.
    db.execute<{ mes: string; v: string; n: number; ate_hoje: string }>(sql`
      SELECT to_char(n.ganho_at AT TIME ZONE ${FUSO}, 'YYYY-MM') AS mes, SUM(${FATURAMENTO})::text AS v, count(*)::int AS n,
             COALESCE(SUM(${FATURAMENTO}) FILTER (WHERE EXTRACT(day FROM n.ganho_at AT TIME ZONE ${FUSO}) <= ${diaHoje}), 0)::text AS ate_hoje
        FROM negocios n
       WHERE n.organizacao_id = ${orgId}::uuid AND n.status = 'ganho'
         AND n.ganho_at >= ${inicioDoDia(`${grade[0].chave}-01`)}::timestamptz
       GROUP BY 1`),
    db.execute<{ tipo: string; delta: string }>(sql`
      SELECT tipo, COALESCE(SUM(delta), 0)::text AS delta
        FROM mrr_movimentos
       WHERE organizacao_id = ${orgId}::uuid AND ocorrido_em >= ${inicioDoDia(`${grade[5].chave}-01`)}::timestamptz
       GROUP BY 1`),
    getMetaComercialAgregada(orgId, agora),
  ]);
  const porMes = new Map(linhas.map((l) => [l.mes, Number(l.v) || 0]));
  const meses = mesesDeFaturamento(porMes, hoje, 6);
  const atual = linhas.find((l) => l.mes === grade[5].chave);
  const anterior = linhas.find((l) => l.mes === grade[4].chave);
  const realizado = Math.round(meses[5].valor);
  const anteriorAteHoje = Number(anterior?.ate_hoje) || 0;
  const mov = mesesDeMrr(ledger.map((l) => ({ mes: grade[5].chave, tipo: l.tipo, delta: Number(l.delta) || 0 })), new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, 15), 1)[0];
  const dias = diasUteisAteOFimDoMes(agora);
  return {
    tipo: "faturamento",
    realizado,
    deltaPct: anteriorAteHoje > 0 ? ((realizado - anteriorAteHoje) / anteriorAteHoje) * 100 : null,
    mesAnterior: meses[4].valor,
    ganhos: Number(atual?.n) || 0,
    meses,
    metaMes: meta.valorAlvo > 0
      ? {
          alvo: meta.valorAlvo,
          realizado: meta.realizado,
          pct: pctDaMeta(meta.valorAlvo, meta.realizado) ?? 0,
          diasUteisRestantes: dias,
          ritmoPorDia: ritmoPorDia(meta.valorAlvo, meta.realizado, dias),
        }
      : null,
    mrr: { atual: mrr.atual, deltaPct: mrr.deltaPct, janelaDias: mrr.janelaDias, liquidoMes: mov.liquido },
  };
}

const mesDe = (agora: Date) => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

export async function heroMetaCloser(ctx: Ctx): Promise<HeroMeta> {
  const { orgId, userId, agora } = ctx;
  const mes = mesDe(agora);
  const [visao, realizado, [equipe]] = await Promise.all([
    visaoGeralVendasMes(orgId, mes, "pessoal", userId),
    getRealizadoMeta(orgId, userId, agora, "faturamento_fechado"),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM usuarios
       WHERE organizacao_id = ${orgId}::uuid AND ativo = true AND role = ANY(${`{${PAPEIS_QUE_SOMAM_NA_META.join(",")}}`}::text[])`),
  ]);
  const linha = visao.ranking[0] ?? null;
  const alvo = linha && linha.meta > 0 ? linha.meta : null;
  const diaHoje = Number(chaveDoDia(agora).slice(8, 10));
  const dias = diasUteisAteOFimDoMes(agora);
  const de = equipe?.n ?? 0;
  return {
    tipo: "meta",
    unidade: "faturamento",
    rotuloMeta: "Faturamento fechado no mês",
    realizado,
    alvo,
    pct: pctDaMeta(alvo, realizado),
    diasNoMes: visao.diasNoMes,
    diaHoje,
    acumulado: visao.acumuladoPorDia.slice(0, diaHoje),
    diasUteisRestantes: dias,
    ritmoPorDia: ritmoPorDia(alvo, realizado, dias),
    ganhos: visao.ganhosEscopo,
    // Posição só vale com 2+ closers E com alguém tendo faturado: com tudo zero a
    // ordem é desempate por nome, e "1º de 2" sobre zero seria elogio inventado.
    posicao: linha && de >= 2 && realizado > 0 ? { n: linha.posicao, de } : null,
  };
}

type LinhaFila = { lead_id: string | null; empresa: string | null; pessoa: string | null; horas: number; origem: string | null };

/** Leads meus, abertos e nunca contatados (mesma regra de "sem 1º contato" do board). */
const FILA_BASE = (orgId: string, userId: string) => sql`
  FROM aquisicoes a
  LEFT JOIN leads lg ON lg.id = a.lead_legado_id
  LEFT JOIN empresas em ON em.id = a.empresa_id
  LEFT JOIN pessoas pe ON pe.id = a.pessoa_id
 WHERE a.organizacao_id = ${orgId}::uuid AND ${somenteDePreVendas(sql)}
   AND a.closed_at IS NULL AND a.desqualificado_em IS NULL AND COALESCE(a.nutricao_status, '') = ''
   AND a.responsavel_id = ${userId}::uuid
   AND (a.last_touch_at IS NULL OR a.last_touch_at <= a.first_touch_at)`;

export async function filaDeContato(orgId: string, userId: string, limite: number) {
  const [todas, itens, [semDono]] = await Promise.all([
    db.execute<{ horas: number }>(sql`
      SELECT (extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at)) / 3600)::float AS horas
      ${FILA_BASE(orgId, userId)}`),
    db.execute<LinhaFila>(sql`
      SELECT a.lead_legado_id::text AS lead_id,
             COALESCE(NULLIF(trim(em.nome), ''), NULLIF(trim(lg.empresa), ''), NULLIF(trim(lg.nome), '')) AS empresa,
             COALESCE(NULLIF(trim(concat_ws(' ', pe.nome, pe.sobrenome)), ''), NULLIF(trim(lg.nome), '')) AS pessoa,
             (extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at)) / 3600)::float AS horas,
             a.origem
      ${FILA_BASE(orgId, userId)}
      -- Ordem de trabalho: o que está prestes a estourar o SLA primeiro (ainda dá
      -- para salvar), depois o que acabou de chegar, e só então o que já estourou,
      -- do mais recente para o mais antigo (o mais recuperável).
      ORDER BY CASE WHEN extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at)) / 3600 >= 24 THEN 2
                    WHEN extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at)) / 3600 >= 4 THEN 0
                    ELSE 1 END,
               CASE WHEN extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at)) / 3600 >= 24
                    THEN -extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at))
                    ELSE extract(epoch FROM now() - COALESCE(lg.pre_qualificado_em, a.created_at)) END DESC
      LIMIT ${limite}`),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM aquisicoes a LEFT JOIN leads lg ON lg.id = a.lead_legado_id
       WHERE a.organizacao_id = ${orgId}::uuid AND ${somenteDePreVendas(sql)}
         AND a.closed_at IS NULL AND a.desqualificado_em IS NULL AND COALESCE(a.nutricao_status, '') = ''
         AND a.responsavel_id IS NULL`),
  ]);
  return { horas: todas.map((t) => Number(t.horas)), itens, semDono: semDono?.n ?? 0 };
}

export async function heroFila(ctx: Ctx): Promise<HeroFila> {
  const { orgId, userId, agora } = ctx;
  const mes = mesDe(agora);
  const [fila, sla, metas] = await Promise.all([
    filaDeContato(orgId, userId, 1),
    resumoSlaPreVendas(orgId, { desde: new Date(agora.getTime() - 30 * 86_400_000), responsavelId: userId }),
    getMetasDoUsuario(orgId, userId, `${mes}-01`),
  ]);
  const metaReunioes = metas.find((m) => m.tipo === "reunioes_agendadas");
  const alvo = metaReunioes ? parseFloat(String(metaReunioes.valorAlvo)) || 0 : 0;
  const realizado = alvo > 0 ? await getRealizadoMeta(orgId, userId, `${mes}-01`, "reunioes_agendadas") : 0;
  const c = classificarFila(fila.horas);
  return {
    tipo: "fila",
    semContato: fila.horas.length,
    ...c,
    semDono: fila.semDono,
    medianaHoras: sla.horasAteContato,
    meta: alvo > 0 ? { alvo, realizado, pct: pctDaMeta(alvo, realizado) ?? 0 } : null,
  };
}

export async function heroEntrega(ctx: Ctx): Promise<HeroEntrega> {
  const [imp, cs, mrr] = await Promise.all([getImplantacaoResumo(ctx.orgId), getCsResumo(ctx.orgId), getMrrAtivo(ctx.orgId)]);
  return {
    tipo: "entrega",
    ativas: imp.ativas,
    aguardandoCliente: imp.aguardandoCliente,
    bloqueadas: imp.bloqueadas,
    atrasadas: imp.atrasadas,
    emAndamento: Math.max(0, imp.ativas - imp.aguardandoCliente - imp.bloqueadas),
    clientesEmRisco: cs.clientesEmRisco,
    renovacoes30d: cs.renovacoesProximas30d,
    tarefasCsAtrasadas: cs.tarefasAtrasadas,
    mrrAtual: mrr.atual,
  };
}

/* ═══ KPIs ═════════════════════════════════════════════════════════════════ */

export async function kpis(ctx: Ctx, lente: "gestao" | "operacao" | "closer" | "sdr" | "leitor"): Promise<Kpi[]> {
  const { orgId, userId, agora } = ctx;
  const inteiro = (n: number) => n.toLocaleString("pt-BR");

  if (lente === "gestao" || lente === "leitor") {
    const [fat, leads, props, clientes] = await Promise.all([
      faturamentoPorDia(orgId, agora, null), leadsPorDia(orgId, agora, null),
      propostasEnviadasPorDia(orgId, agora, null), getClientesAtivos(orgId),
    ]);
    const href = (h: string) => (lente === "leitor" ? null : h);
    return [
      kpiDeSerie({ chave: "faturamento", rotulo: "Faturamento, 30 dias", serie: fat, formato: brlInteiro, apoio: APOIO_JANELA, href: href("/vendas"), agora }),
      kpiDeSerie({ chave: "leads", rotulo: "Leads novos", serie: leads, formato: inteiro, apoio: APOIO_JANELA, href: href("/pre-vendas"), agora }),
      kpiDeSerie({ chave: "propostas", rotulo: "Propostas enviadas", serie: props, formato: inteiro, apoio: APOIO_JANELA, href: href("/propostas"), agora }),
      { chave: "clientes", rotulo: "Clientes ativos", valor: inteiro(clientes), apoio: "com serviço ativo", delta: null, serie: null, serieRotulo: null, serieFim: null, href: href("/clientes") },
    ];
  }

  if (lente === "operacao") {
    const [mrr, clientes, concluidas, cs] = await Promise.all([
      getMrrAtivo(orgId), getClientesAtivos(orgId), entregasConcluidasPorDia(orgId, agora), getCsResumo(orgId),
    ]);
    return [
      { chave: "mrr", rotulo: "MRR ativo", valor: brlInteiro(mrr.atual), apoio: `vs ${mrr.janelaDias} dias atrás`, delta: deltaDePct(mrr.deltaPct), serie: null, serieRotulo: null, serieFim: null, href: "/clientes" },
      { chave: "clientes", rotulo: "Clientes ativos", valor: inteiro(clientes), apoio: "com serviço ativo", delta: null, serie: null, serieRotulo: null, serieFim: null, href: "/clientes" },
      kpiDeSerie({ chave: "concluidas", rotulo: "Entregas concluídas", serie: concluidas, formato: inteiro, apoio: APOIO_JANELA, href: "/pos-vendas", agora }),
      { chave: "renovacoes", rotulo: "Renovações em 30 dias", valor: inteiro(cs.renovacoesProximas30d), apoio: "contratos que vencem na janela", delta: null, serie: null, serieRotulo: null, serieFim: null, href: "/clientes/cs" },
    ];
  }

  const aguardando = await conversasAguardando(orgId, userId, 1);
  const espera = aguardando.lista[0]?.desde ? duracaoCurta((agora.getTime() - new Date(aguardando.lista[0].desde).getTime()) / 60_000) : null;
  const conversas: Kpi = {
    chave: "conversas", rotulo: "Conversas aguardando", valor: inteiro(aguardando.total),
    apoio: espera ? `a mais antiga espera há ${espera}` : "nenhuma esperando resposta",
    delta: null, serie: null, serieRotulo: null, serieFim: null, href: "/atendimento",
  };

  if (lente === "closer") {
    const [fat, props, pipeline] = await Promise.all([
      faturamentoPorDia(orgId, agora, userId), propostasEnviadasPorDia(orgId, agora, userId),
      funilPessoal(orgId, userId),
    ]);
    return [
      kpiDeSerie({ chave: "faturamento", rotulo: "Fechado por você", serie: fat, formato: brlInteiro, apoio: APOIO_JANELA, href: "/pipeline", agora }),
      {
        chave: "pipeline", rotulo: "Seu pipeline aberto", valor: brlInteiro(pipeline.valorAberto),
        apoio: `${inteiro(pipeline.abertas)} ${pipeline.abertas === 1 ? "oportunidade" : "oportunidades"}`,
        delta: null, serie: null, serieRotulo: null, serieFim: null, href: "/pipeline",
      },
      kpiDeSerie({ chave: "propostas", rotulo: "Propostas enviadas", serie: props, formato: inteiro, apoio: APOIO_JANELA, href: "/propostas", agora }),
      conversas,
    ];
  }

  // sdr
  const [leads, qualificados, agenda] = await Promise.all([
    leadsPorDia(orgId, agora, userId), qualificadosPorDia(orgId, agora, userId), agendaDoDia(ctx),
  ]);
  return [
    kpiDeSerie({ chave: "leads", rotulo: "Leads para você", serie: leads, formato: inteiro, apoio: APOIO_JANELA, href: "/pre-vendas?view=meus", agora }),
    kpiDeSerie({ chave: "qualificados", rotulo: "Qualificados por você", serie: qualificados, formato: inteiro, apoio: APOIO_JANELA, href: "/pre-vendas?view=meus", agora }),
    conversas,
    {
      chave: "tarefas", rotulo: "Tarefas de hoje", valor: inteiro(agenda.tarefasHoje),
      apoio: agenda.atrasadas > 0 ? `${inteiro(agenda.atrasadas)} em atraso` : "nenhuma em atraso",
      delta: null, serie: null, serieRotulo: null, serieFim: null, href: "/tarefas",
    },
  ];
}

/* ═══ Funil ════════════════════════════════════════════════════════════════ */

const ETAPAS_ABERTAS = [
  { chave: "entrada", rotulo: "Entrada" },
  { chave: "diagnostico", rotulo: "Diagnóstico" },
  { chave: "proposta", rotulo: "Proposta" },
  { chave: "negociacao", rotulo: "Negociação" },
] as const;

/** O pipeline aberto por etapa, no canônico (`oportunidades`), com as MESMAS
 *  condições do board (etapa aberta, fora a cópia 'ativo' da carteira). */
async function pipelineAberto(orgId: string, responsavelId: string | null) {
  const linhas = await db.execute<{ etapa: string; n: number; valor: string }>(sql`
    SELECT o.etapa, count(*)::int AS n, COALESCE(SUM(o.valor), 0)::text AS valor
      FROM oportunidades o
     WHERE o.organizacao_id = ${orgId}::uuid AND o.ganho_at IS NULL AND o.perdido_at IS NULL
       AND o.etapa = ANY(${`{${ETAPAS_ABERTAS.map((e) => e.chave).join(",")}}`}::text[])
       AND COALESCE(o.stage, '') <> 'ativo'
       AND (${responsavelId}::uuid IS NULL OR o.responsavel_id = ${responsavelId}::uuid)
     GROUP BY 1`);
  const mapa = new Map(linhas.map((l) => [l.etapa, l]));
  const etapas: EtapaFunil[] = ETAPAS_ABERTAS.map((e) => ({
    chave: e.chave, rotulo: e.rotulo,
    n: Number(mapa.get(e.chave)?.n ?? 0), valor: Number(mapa.get(e.chave)?.valor ?? 0),
    href: responsavelId ? `/pipeline?responsavel=${responsavelId}` : "/pipeline",
  }));
  return {
    etapas,
    abertas: etapas.reduce((s, e) => s + e.n, 0),
    valorAberto: etapas.reduce((s, e) => s + e.valor, 0),
  };
}

async function funilPessoal(orgId: string, userId: string) {
  return pipelineAberto(orgId, userId);
}

async function ganhosDoMes(orgId: string, agora: Date, responsavelId: string | null): Promise<number> {
  const ini = `${mesDe(agora)}-01T00:00:00${OFFSET}`;
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM negocios n
     WHERE n.organizacao_id = ${orgId}::uuid AND n.status = 'ganho' AND n.ganho_at >= ${ini}::timestamptz
       AND (${responsavelId}::uuid IS NULL OR n.responsavel_id = ${responsavelId}::uuid)`);
  return r?.n ?? 0;
}

export interface PreVendasResumo {
  colunas: Array<{ chave: string; rotulo: string; total: number }>;
  semPrimeiroContato: number;
  foraDoSla: number;
  medianaHoras: number | null;
}

export async function funil(
  ctx: Ctx, escopo: "organizacao" | "pessoal", preVendas: PreVendasResumo | null, incluirPipeline = true,
): Promise<Funil> {
  const responsavelId = escopo === "pessoal" ? ctx.userId : null;
  if (!incluirPipeline) {
    return { escopo, etapas: [], abertas: 0, valorAberto: 0, ganhosMes: 0, preVendas };
  }
  const [pipeline, ganhos] = await Promise.all([
    pipelineAberto(ctx.orgId, responsavelId),
    ganhosDoMes(ctx.orgId, ctx.agora, responsavelId),
  ]);
  return { escopo, ...pipeline, ganhosMes: ganhos, preVendas };
}

/* ═══ Agenda ═══════════════════════════════════════════════════════════════ */

export async function agendaDoDia(ctx: Ctx): Promise<Agenda & { itensTodos: ItemAgenda[] }> {
  const { orgId, userId, agora } = ctx;
  const hoje = chaveDoDia(agora);
  const [lista, [cont]] = await Promise.all([
    getAgendaHoje(orgId, userId, agora),
    db.execute<{ hoje: number; atrasadas: number }>(sql`
      SELECT count(*) FILTER (WHERE data_vencimento = ${hoje}::date)::int AS hoje,
             count(*) FILTER (WHERE data_vencimento < ${hoje}::date)::int AS atrasadas
        FROM tarefas
       WHERE organizacao_id = ${orgId}::uuid AND usuario_id = ${userId}::uuid AND concluida = false`),
  ]);
  const itens: ItemAgenda[] = lista
    // Tarefa que já venceu não é compromisso de hoje: é atenção, e o card
    // "Precisa de você" e o contador abaixo já a carregam.
    .filter((i) => !(i.id.startsWith("tarefa-") && i.grupo === "atrasada"))
    .map((i) => ({
      id: i.id, hora: i.hora === "--:--" ? "Hoje" : i.hora, titulo: i.titulo,
      detalhe: i.detalhe, tipo: i.icone, grupo: i.grupo,
      href: i.href,
    }))
    .sort((a, b) => (a.hora === "Hoje" ? 1 : 0) - (b.hora === "Hoje" ? 1 : 0) || a.hora.localeCompare(b.hora));
  return {
    itens: itens.slice(0, 7),
    itensTodos: itens,
    reunioes: itens.filter((i) => i.tipo === "reuniao").length,
    tarefasHoje: cont?.hoje ?? 0,
    atrasadas: cont?.atrasadas ?? 0,
  };
}

/* ═══ Saúde ════════════════════════════════════════════════════════════════ */

const dataCurta = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
};

export async function saude(ctx: Ctx): Promise<Saude> {
  const { orgId } = ctx;
  const [inv, stripe, documenso] = await Promise.all([
    inventarioDeIntegracoes(orgId),
    db.execute<{ pendentes: number; processados: number; ultimo: string | null }>(sql`
      SELECT count(*) FILTER (WHERE upper(status) NOT IN ('PROCESSED'))::int AS pendentes,
             count(*) FILTER (WHERE upper(status) = 'PROCESSED')::int AS processados,
             max(received_at)::date::text AS ultimo
        FROM stripe_webhook_events WHERE organizacao_id = ${orgId}::uuid`),
    db.execute<{ enviados: number; aguardando: number; ultimo: string | null }>(sql`
      SELECT count(*)::int AS enviados,
             count(*) FILTER (WHERE signature_status IN ('sent_for_signature', 'pending'))::int AS aguardando,
             max(signature_enviado_em)::date::text AS ultimo
        FROM contratos WHERE organizacao_id = ${orgId}::uuid AND signature_provider = 'documenso'`),
  ]);
  const por = (chave: string) => inv.find((i) => i.chave === chave);
  const itens: ItemSaude[] = [];

  const wa = por("whatsapp");
  if (wa) {
    const total = wa.volume ?? 0;
    const conectadas = total - (wa.comErro ?? 0);
    itens.push({
      chave: "whatsapp", rotulo: "WhatsApp",
      estado: total === 0 ? "ocioso" : conectadas === 0 ? "falha" : conectadas < total ? "atencao" : "ok",
      detalhe: total === 0 ? "nenhum número conectado" : `${conectadas} de ${total} ${total === 1 ? "sessão conectada" : "sessões conectadas"}`,
      href: "/ajustes/whatsapp",
    });
  }
  const em = por("email");
  if (em) {
    const total = em.volume ?? 0;
    itens.push({
      chave: "email", rotulo: "E-mail",
      estado: total === 0 ? "ocioso" : (em.comErro ?? 0) > 0 ? "atencao" : em.estado === "em_uso" ? "ok" : "ocioso",
      detalhe: total === 0 ? "nenhuma caixa conectada"
        : (em.comErro ?? 0) > 0 ? `${em.comErro} de ${total} com erro de sincronização`
        : `${total} ${total === 1 ? "caixa sincronizada" : "caixas sincronizadas"}`,
      href: "/ajustes/email",
    });
  }
  const st = stripe[0];
  const stripeInv = por("stripe");
  if (st || stripeInv) {
    const pend = st?.pendentes ?? 0;
    const sem = (st?.processados ?? 0) === 0 && pend === 0;
    itens.push({
      chave: "stripe", rotulo: "Stripe",
      estado: pend > 0 ? "atencao" : sem ? "ocioso" : "ok",
      detalhe: pend > 0 ? `${pend} ${pend === 1 ? "evento pendente" : "eventos pendentes"}`
        : sem ? "sem evento recebido"
        : `${(st?.processados ?? 0).toLocaleString("pt-BR")} eventos · último em ${dataCurta(st?.ultimo ?? stripeInv?.ultimoSinal ?? "")}`,
      href: null,
    });
  }
  const meta = por("meta_lead_ads");
  if (meta) {
    itens.push({
      chave: "meta", rotulo: "Meta Lead Ads",
      estado: meta.estado === "em_uso" ? "ok" : "ocioso",
      detalhe: meta.estado === "em_uso" && meta.ultimoSinal ? `último lead em ${dataCurta(meta.ultimoSinal)}`
        : meta.estado === "configurada" ? "configurada, sem lead recebido" : "não configurada",
      href: null,
    });
  }
  const d = documenso[0];
  const documensoConfigurado = Boolean(process.env.DOCUMENSO_API_TOKEN?.trim());
  if (d && (documensoConfigurado || d.enviados > 0)) {
    itens.push({
      chave: "documenso", rotulo: "Documenso",
      estado: d.enviados > 0 ? "ok" : "ocioso",
      detalhe: d.enviados === 0 ? "configurado, nenhum contrato enviado"
        : `${d.aguardando} ${d.aguardando === 1 ? "contrato aguardando assinatura" : "contratos aguardando assinatura"}`,
      href: "/propostas",
    });
  }
  const ms = por("microsoft_graph");
  if (ms) {
    itens.push({
      chave: "agenda", rotulo: "Agenda (Microsoft 365)",
      estado: ms.estado === "em_uso" ? "ok" : "ocioso",
      detalhe: ms.estado === "em_uso" && ms.ultimoSinal ? `convite criado em ${dataCurta(ms.ultimoSinal)}` : ms.estado === "configurada" ? "configurada, sem convite criado" : "não configurada",
      href: "/ajustes/email",
    });
  }
  const ia = por("ia");
  if (ia) {
    itens.push({
      chave: "ia", rotulo: "IA do NEXO e dos agentes",
      estado: (ia.comErro ?? 0) > 0 ? "atencao" : ia.estado === "nao_configurada" ? "falha" : "ok",
      detalhe: (ia.comErro ?? 0) > 0 ? `${ia.comErro} ${ia.comErro === 1 ? "chave com erro" : "chaves com erro"}`
        : ia.estado === "nao_configurada" ? "nenhuma chave de IA" : (ia.volume ?? 0) > 0 ? "chave da organização ativa" : "usando a IA da plataforma",
      href: null,
    });
  }
  const rank: Record<EstadoSaude, number> = { falha: 0, atencao: 1, ok: 2, ocioso: 3 };
  return { itens: itens.sort((a, b) => rank[a.estado] - rank[b.estado]) };
}

/* ═══ Entrega e financeiro ═════════════════════════════════════════════════ */

export async function entrega(ctx: Ctx): Promise<Entrega> {
  const [imp, cs] = await Promise.all([getImplantacaoResumo(ctx.orgId), getCsResumo(ctx.orgId)]);
  return {
    ativas: imp.ativas,
    emAndamento: Math.max(0, imp.ativas - imp.aguardandoCliente - imp.bloqueadas),
    aguardandoCliente: imp.aguardandoCliente,
    bloqueadas: imp.bloqueadas,
    atrasadas: imp.atrasadas,
    clientesEmRisco: cs.clientesEmRisco,
    renovacoes30d: cs.renovacoesProximas30d,
    tarefasCsAtrasadas: cs.tarefasAtrasadas,
  };
}

export async function financeiro(ctx: Ctx): Promise<Financeiro> {
  return getFinanceiroResumo(ctx.orgId);
}

/* ═══ Precisa de você ══════════════════════════════════════════════════════ */

type ComOrdem = ItemAtencao & { ordem: number };

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

function fecharAtencao(itens: ComOrdem[], total: number, escopo: Atencao["escopo"], limite = 7): Atencao {
  const ordenados = ordenarPorUrgencia(itens);
  return {
    itens: ordenados.slice(0, limite).map(({ ordem: _ordem, ...i }) => i),
    total,
    porSeveridade: contarPorSeveridade(ordenados),
    escopo,
  };
}

export interface SinaisDaOrganizacao {
  atencao: Awaited<ReturnType<typeof import("@/lib/analytics/inicio").getPrecisaAtencao>>;
  implantacao: Awaited<ReturnType<typeof getImplantacaoResumo>>;
  cs: Awaited<ReturnType<typeof getCsResumo>>;
  atendimento: Awaited<ReturnType<typeof getAtendimentoResumo>>;
  /** Saúde de uso da Callface AI (a MESMA função da carteira em /clientes/uso). null = sem leitura. */
  usoCallfaceAi?: { vermelhos: number; semUsar: number; semResponsavel: number } | null;
}

/** Gestão: sinais agregados, cada um com a lista que o resolve. Nada de nome de pessoa. */
export function atencaoDaOrganizacao(s: SinaisDaOrganizacao): Atencao {
  const itens: ComOrdem[] = s.atencao.map((a) => ({
    id: a.id,
    severidade: a.severidade === "critico" ? "critico" : a.severidade === "aviso" ? "alto" : "moderado",
    tipo: a.area,
    titulo: a.titulo,
    detalhe: a.detalhe,
    peso: null,
    href: a.href,
    acao: ACAO_DO_SINAL[a.icone] ?? "Abrir",
    agregado: true,
    ordem: 0,
  }));
  if (s.implantacao.atrasadas > 0) {
    itens.push({
      id: "entregas-atrasadas", severidade: "alto", tipo: "Implantação",
      titulo: plural(s.implantacao.atrasadas, "entrega com prazo vencido", "entregas com prazo vencido"),
      detalhe: "Prazo-alvo já passou e a entrega segue aberta", peso: null,
      href: "/pos-vendas?aba=imp", acao: "Resolver", agregado: true, ordem: s.implantacao.atrasadas,
    });
  }
  if (s.cs.clientesEmRisco > 0) {
    itens.push({
      id: "cs-risco", severidade: "alto", tipo: "Clientes",
      titulo: plural(s.cs.clientesEmRisco, "cliente em risco", "clientes em risco"),
      detalhe: "Risco crítico ou em risco aberto na carteira", peso: null,
      href: "/clientes/risco", acao: "Ver risco", agregado: true, ordem: s.cs.clientesEmRisco,
    });
  }
  if (s.usoCallfaceAi && s.usoCallfaceAi.vermelhos > 0) {
    const u = s.usoCallfaceAi;
    itens.push({
      id: "uso-callface-ai", severidade: u.semUsar > 0 ? "critico" : "alto", tipo: "Clientes",
      titulo: plural(u.vermelhos, "cliente em risco no Callface AI", "clientes em risco no Callface AI"),
      detalhe: [u.semUsar > 0 ? `${u.semUsar} parou de usar` : null, u.semResponsavel > 0 ? `${u.semResponsavel} sem CS responsável` : null].filter(Boolean).join(" · ") || "Churn de uso: o CS já tem a tarefa",
      peso: null, href: "/clientes/uso", acao: "Ver carteira de uso", agregado: true, ordem: u.vermelhos,
    });
  }
  if (s.atendimento.whatsappAbertas > 0) {
    const espera = s.atendimento.esperaMaisAntigaMinutos;
    itens.push({
      id: "conversas", severidade: "alto", tipo: "Atendimento",
      titulo: plural(s.atendimento.whatsappAbertas, "conversa aguardando resposta", "conversas aguardando resposta"),
      detalhe: espera !== null ? `A mais antiga espera há ${duracaoCurta(espera)}` : "WhatsApp com mensagem não lida",
      peso: null, href: "/atendimento?escopo=equipe", acao: "Responder", agregado: true, ordem: s.atendimento.whatsappAbertas,
    });
  }
  // Desempate dentro da severidade: mais itens primeiro.
  for (const i of itens) if (i.ordem === 0) i.ordem = Number(i.titulo.match(/^[\d.]+/)?.[0]?.replace(/\./g, "") ?? 0);
  return fecharAtencao(itens, itens.length, "organizacao", 6);
}

const ACAO_DO_SINAL: Record<string, string> = {
  pagamento: "Cobrar", implantacao: "Resolver", lead: "Assumir", negocio: "Retomar",
  cs: "Ver caso", proposta: "Acompanhar", onboarding: "Agendar",
};

type LinhaProposta = {
  id: string; numero: number; status: string; valor: string | null; empresa: string | null;
  dias: number; visualizacoes: number | null;
};

/** Propostas vigentes do closer que pedem uma jogada. */
async function propostasParaFechar(orgId: string, userId: string): Promise<{ itens: ComOrdem[]; total: number; valor: number }> {
  const [linhas, [tot]] = await Promise.all([
    db.execute<LinhaProposta>(sql`
      SELECT p.id::text AS id, p.numero, p.status, p.total_geral::text AS valor,
             COALESCE(NULLIF(trim(e.nome), ''), NULLIF(trim(l.empresa), ''), NULLIF(trim(l.nome), ''), n.titulo) AS empresa,
             floor(extract(epoch FROM now() - p.enviada_em) / 86400)::int AS dias, p.visualizacoes
        FROM propostas p
        JOIN negocios n ON n.id = p.negocio_id
        LEFT JOIN leads l ON l.id = n.lead_id
        LEFT JOIN empresas e ON e.id = n.empresa_id
       WHERE p.organizacao_id = ${orgId}::uuid AND n.responsavel_id = ${userId}::uuid
         AND p.status IN ('enviada', 'visualizada', 'ajuste_solicitado')
         AND p.enviada_em IS NOT NULL
         AND (p.status = 'ajuste_solicitado' OR p.enviada_em < now() - interval '5 days'
              OR (COALESCE(p.visualizacoes, 0) > 0 AND p.enviada_em < now() - interval '2 days'))
       ORDER BY (p.status = 'ajuste_solicitado') DESC, (COALESCE(p.visualizacoes, 0) > 0) DESC, p.total_geral DESC NULLS LAST
       LIMIT 4`),
    db.execute<{ n: number; valor: string }>(sql`
      SELECT count(*)::int AS n, COALESCE(SUM(p.total_geral), 0)::text AS valor
        FROM propostas p JOIN negocios n ON n.id = p.negocio_id
       WHERE p.organizacao_id = ${orgId}::uuid AND n.responsavel_id = ${userId}::uuid
         AND p.status IN ('enviada', 'visualizada', 'ajuste_solicitado') AND p.enviada_em IS NOT NULL
         AND (p.status = 'ajuste_solicitado' OR p.enviada_em < now() - interval '5 days'
              OR (COALESCE(p.visualizacoes, 0) > 0 AND p.enviada_em < now() - interval '2 days'))`),
  ]);
  const itens: ComOrdem[] = linhas.map((p) => {
    const aberta = (p.visualizacoes ?? 0) > 0;
    const ajuste = p.status === "ajuste_solicitado";
    return {
      id: `proposta-${p.id}`,
      severidade: ajuste ? "critico" : aberta ? "alto" : "moderado",
      tipo: "Proposta",
      titulo: p.empresa?.trim() || `Proposta #${p.numero}`,
      detalhe: ajuste ? `O cliente pediu ajuste na proposta #${p.numero}`
        : aberta ? `Proposta #${p.numero} aberta ${p.visualizacoes}x, sem resposta há ${p.dias} d`
        : `Proposta #${p.numero} enviada há ${p.dias} d, ainda não aberta`,
      peso: p.valor && Number(p.valor) > 0 ? moedaCompacta(Number(p.valor)) : null,
      href: `/propostas/${p.id}`,
      acao: ajuste ? "Ajustar" : "Retomar",
      agregado: false,
      ordem: Number(p.valor ?? 0),
    };
  });
  return { itens, total: tot?.n ?? 0, valor: Number(tot?.valor ?? 0) };
}

async function semProximaAcaoDoCloser(orgId: string, userId: string) {
  const [r] = await db.execute<{ n: number; valor: string }>(sql`
    SELECT count(*)::int AS n, COALESCE(SUM(o.valor), 0)::text AS valor
      FROM oportunidades o
     WHERE o.organizacao_id = ${orgId}::uuid AND o.responsavel_id = ${userId}::uuid
       AND o.ganho_at IS NULL AND o.perdido_at IS NULL
       AND o.etapa = ANY(${`{${ETAPAS_ABERTAS.map((e) => e.chave).join(",")}}`}::text[])
       AND COALESCE(o.stage, '') <> 'ativo'
       AND NOT EXISTS (SELECT 1 FROM negocios nx WHERE nx.id = o.negocio_id_legado AND nx.proxima_acao IS NOT NULL)`);
  return { n: r?.n ?? 0, valor: Number(r?.valor ?? 0) };
}

async function tarefasAtrasadasDoUsuario(orgId: string, userId: string, agora: Date, limite: number) {
  const hoje = chaveDoDia(agora);
  const [lista, [tot]] = await Promise.all([
    db.execute<{ id: string; titulo: string; dias: number; lead_id: string | null }>(sql`
      SELECT id::text, titulo, (${hoje}::date - data_vencimento)::int AS dias, lead_id::text AS lead_id
        FROM tarefas
       WHERE organizacao_id = ${orgId}::uuid AND usuario_id = ${userId}::uuid AND concluida = false
         AND data_vencimento < ${hoje}::date
       ORDER BY data_vencimento DESC LIMIT ${limite}`),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM tarefas
       WHERE organizacao_id = ${orgId}::uuid AND usuario_id = ${userId}::uuid AND concluida = false
         AND data_vencimento < ${hoje}::date`),
  ]);
  return { lista, total: tot?.n ?? 0 };
}

function itensDeConversa(c: Awaited<ReturnType<typeof conversasAguardando>>, agora: Date): ComOrdem[] {
  return c.lista.map((x) => {
    const min = x.desde ? (agora.getTime() - new Date(x.desde).getTime()) / 60_000 : 0;
    return {
      id: `conversa-${x.id}`,
      severidade: min >= 24 * 60 ? "alto" : "moderado",
      tipo: "Conversa",
      titulo: x.nome?.trim() || "Contato sem nome",
      detalhe: x.desde ? `Mensagem sem resposta há ${duracaoCurta(min)}` : "Mensagem não lida",
      peso: null,
      href: x.leadId ? `/atendimento?leadId=${x.leadId}` : "/atendimento",
      acao: "Responder",
      agregado: false,
      ordem: min,
    };
  });
}

export async function atencaoDoCloser(ctx: Ctx): Promise<Atencao> {
  const { orgId, userId, agora } = ctx;
  const [props, semAcao, tarefas, conversas] = await Promise.all([
    propostasParaFechar(orgId, userId),
    semProximaAcaoDoCloser(orgId, userId),
    tarefasAtrasadasDoUsuario(orgId, userId, agora, 2),
    conversasAguardando(orgId, userId, 2),
  ]);
  const itens: ComOrdem[] = [...props.itens, ...itensDeConversa(conversas, agora)];
  for (const t of tarefas.lista) {
    itens.push({
      id: `tarefa-${t.id}`, severidade: t.dias >= 7 ? "alto" : "moderado", tipo: "Tarefa",
      titulo: t.titulo, detalhe: `Venceu há ${t.dias} ${t.dias === 1 ? "dia" : "dias"}`, peso: null,
      href: `/tarefas?atv=${encodeURIComponent(`p:${t.id}`)}`, acao: "Abrir", agregado: false, ordem: t.dias,
    });
  }
  if (semAcao.n > 0) {
    itens.push({
      id: "sem-proxima-acao", severidade: "moderado", tipo: "Pipeline",
      titulo: plural(semAcao.n, "oportunidade sem próxima ação", "oportunidades sem próxima ação"),
      detalhe: "Sem passo combinado, a negociação esfria", peso: semAcao.valor > 0 ? moedaCompacta(semAcao.valor) : null,
      href: `/pipeline?loop=sem-proxima-acao&responsavel=${userId}`, acao: "Definir", agregado: true, ordem: semAcao.n,
    });
  }
  // O total conta os registros que existem, não os 7 do corte: propostas e
  // conversas e tarefas pelas contagens reais, mais o item agregado.
  const total = props.total + conversas.total + tarefas.total + (semAcao.n > 0 ? 1 : 0);
  return fecharAtencao(itens, total, "pessoal");
}

export async function atencaoDoSdr(ctx: Ctx): Promise<Atencao> {
  const { orgId, userId, agora } = ctx;
  const [fila, tarefas, conversas] = await Promise.all([
    filaDeContato(orgId, userId, 5),
    tarefasAtrasadasDoUsuario(orgId, userId, agora, 1),
    conversasAguardando(orgId, userId, 2),
  ]);
  const itens: ComOrdem[] = fila.itens.map((l) => {
    const h = Number(l.horas);
    const c = classificarFila([h]);
    return {
      id: `lead-${l.lead_id ?? l.empresa}`,
      severidade: c.vencendo ? "critico" : c.foraDoSla ? "alto" : "moderado",
      tipo: "Lead",
      titulo: l.empresa?.trim() || l.pessoa?.trim() || "Lead sem nome",
      detalhe: [l.pessoa && l.empresa ? l.pessoa : null, l.origem].filter(Boolean).join(" · ") || "Sem 1º contato",
      peso: c.foraDoSla ? `fora do SLA · ${duracaoCurta(h * 60)}` : c.vencendo ? `vence em ${duracaoCurta((24 - h) * 60)}` : `chegou há ${duracaoCurta(h * 60)}`,
      href: l.lead_id ? `/atendimento?leadId=${l.lead_id}` : "/pre-vendas?view=meus",
      acao: "Chamar",
      agregado: false,
      ordem: 0,
    };
  });
  itens.push(...itensDeConversa(conversas, agora));
  for (const t of tarefas.lista) {
    itens.push({
      id: `tarefa-${t.id}`, severidade: "moderado", tipo: "Tarefa", titulo: t.titulo,
      detalhe: `Venceu há ${t.dias} ${t.dias === 1 ? "dia" : "dias"}`, peso: null,
      href: `/tarefas?atv=${encodeURIComponent(`p:${t.id}`)}`, acao: "Abrir", agregado: false, ordem: t.dias,
    });
  }
  // A fila já vem na ordem de trabalho do SQL; `ordenarPorUrgencia` é estável.
  const total = fila.horas.length + conversas.total + tarefas.total;
  return fecharAtencao(itens, total, "pessoal");
}

/* ═══ Pré-vendas (resumo para a gestão) ════════════════════════════════════ */

export type BoardResumo = {
  colunas: Array<{ chave: string; rotulo: string; total: number }>;
  resumo: { semPrimeiroContato: number; horasAteContato: number | null };
  contadores: { atrasados: number };
};

export function resumoDePreVendas(b: BoardResumo): PreVendasResumo {
  const ordem = ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade"];
  return {
    colunas: ordem.map((c) => b.colunas.find((x) => x.chave === c)).filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ chave: c.chave, rotulo: c.rotulo, total: c.total })),
    semPrimeiroContato: b.resumo.semPrimeiroContato,
    foraDoSla: b.contadores.atrasados,
    medianaHoras: b.resumo.horasAteContato,
  };
}
