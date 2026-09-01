/**
 * Dados da tela de Início (redesign 30/08, Figma node 559:2159).
 *
 * Complementa `command-center.ts` — não substitui: tudo que já existia lá
 * e continua servindo (MRR comparativo, funil, atendimento, CS, financeiro)
 * segue sendo reusado pela página. Aqui ficam só os recortes que o desenho
 * novo pede e que ainda NÃO existiam:
 *
 *  - Entrega separada por família (o desenho separa "Onboardings" de
 *    "Implantações PABX"; `getImplantacaoResumo` agregava org-wide sem
 *    filtro, então o mesmo número aparecia nos dois lugares).
 *  - Meta do mês quebrada por produto (Callface AI / PABX / White Label).
 *  - Agenda do dia (reuniões + tarefas) agrupada em atrasadas/agora/a seguir.
 *  - "Precisa de atenção": os sinais operacionais reais, um por fonte.
 *  - Série do gráfico de MRR em 4 janelas (7D/30D/90D/12M).
 *
 * Mesma regra de sempre do projeto: métrica sem fonte real não é fabricada
 * — some da tela (lista vazia) em vez de virar número inventado.
 */
import { db } from "@/lib/db";
// Só as tabelas usadas pelo query builder — o resto (fulfillments, contratos,
// servicos_canonicos, propostas, faturas, mrr_movimentos) é acessado por SQL
// cru nas agregações abaixo, onde o CTE/generate_series não tem equivalente
// direto no builder.
import { leads, tarefas, reunioes, usuarios } from "@/lib/db/schema";
import { eq, and, gte, lt, lte, sql, isNull, or, asc } from "drizzle-orm";
import { classificarItensDaProposta, type FamiliaServico } from "@/lib/crm/classificar-produto";

function monthBounds(ref: Date) {
  return {
    inicio: new Date(ref.getFullYear(), ref.getMonth(), 1),
    fim: new Date(ref.getFullYear(), ref.getMonth() + 1, 1),
  };
}

/** Famílias de serviço por frente operacional — mesma divisão já fixada em
 *  `lib/crm/fulfillment.ts` (Onboarding = Callface AI; Implantação = PABX +
 *  White Label). Duplicado aqui como constante local só pra não importar o
 *  módulo de fulfillment (que carrega o motor de checklist) dentro de um
 *  módulo de analytics. */
export const FAMILIAS_ONBOARDING_HOME = ["CALLFACE_AI"] as const;
export const FAMILIAS_IMPLANTACAO_HOME = ["PABX", "WHITE_LABEL"] as const;

export interface EntregaResumoFamilia {
  ativas: number;
  aguardandoContato: number;
  aguardandoCliente: number;
  bloqueadas: number;
  atrasadas: number;
  reunioesHoje: number;
}

/**
 * Mesmo recorte de `getImplantacaoResumo` (command-center.ts), mas FILTRADO
 * por família — é o que permite o desenho mostrar "Onboardings 9" e
 * "Implantações PABX 6" como números diferentes, cada um da sua frente.
 * `reunioesHoje` conta reunião agendada de hoje de qualquer lead ligado a um
 * fulfillment ativo daquela família (dado real de `reunioes`, nunca estimado).
 */
export async function getEntregaResumoPorFamilia(
  orgId: string,
  familias: readonly string[],
  hoje = new Date(),
): Promise<EntregaResumoFamilia> {
  if (familias.length === 0) {
    return { ativas: 0, aguardandoContato: 0, aguardandoCliente: 0, bloqueadas: 0, atrasadas: 0, reunioesHoje: 0 };
  }
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);
  const lista = sql.join(familias.map((f) => sql`${f}`), sql`, `);

  const [row] = await db.execute<{
    ativas: number; aguardando_contato: number; aguardando_cliente: number;
    bloqueadas: number; atrasadas: number; reunioes_hoje: number;
  }>(sql`
    WITH base AS (
      SELECT * FROM fulfillments
      WHERE organizacao_id = ${orgId} AND service_family IN (${lista})
    )
    SELECT
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED','CANCELED')) AS ativas,
      (SELECT COUNT(*)::int FROM base WHERE status = 'NOT_STARTED') AS aguardando_contato,
      (SELECT COUNT(*)::int FROM base WHERE status = 'BLOCKED_CUSTOMER') AS aguardando_cliente,
      (SELECT COUNT(*)::int FROM base WHERE status IN ('BLOCKED_INTERNAL','BLOCKED_PROVIDER')) AS bloqueadas,
      (SELECT COUNT(*)::int FROM base WHERE status NOT IN ('COMPLETED','CANCELED')
         AND target_at IS NOT NULL AND target_at < now()) AS atrasadas,
      (SELECT COUNT(DISTINCT r.id)::int
         FROM reunioes r
         JOIN servicos_canonicos sc ON sc.lead_id = r.lead_id
         JOIN base b ON b.servico_canonico_id = sc.id
        WHERE r.status = 'agendada' AND r.data >= ${inicioDia.toISOString()} AND r.data < ${fimDia.toISOString()}
          AND b.status NOT IN ('COMPLETED','CANCELED')) AS reunioes_hoje
  `);

  return {
    ativas: Number(row?.ativas || 0),
    aguardandoContato: Number(row?.aguardando_contato || 0),
    aguardandoCliente: Number(row?.aguardando_cliente || 0),
    bloqueadas: Number(row?.bloqueadas || 0),
    atrasadas: Number(row?.atrasadas || 0),
    reunioesHoje: Number(row?.reunioes_hoje || 0),
  };
}

export interface MetaProdutoLinha { familia: string; label: string; valor: number; pct: number }

const FAMILIA_LABEL: Record<string, string> = {
  CALLFACE_AI: "Callface AI",
  WHITE_LABEL: "White Label",
  PABX: "PABX",
  UNKNOWN: "Não classificado",
};

/**
 * Realizado do mês quebrado por família de produto. A fonte do TOTAL é a
 * mesma de `getFechadoPeriodo` (negócios ganhos no mês, `mrr_fechado`), então
 * a soma das linhas bate com o realizado exibido — não é um segundo cálculo
 * paralelo de receita. A família vem do serviço canônico ligado ao contrato
 * do negócio; negócio ganho sem serviço canônico cai em "Não classificado"
 * em vez de sumir (o total continua fechando).
 */
export async function getMetaPorProduto(orgId: string, hoje = new Date()): Promise<MetaProdutoLinha[]> {
  const { inicio, fim } = monthBounds(hoje);

  // Cascata de classificação, da fonte mais forte pra mais fraca:
  //   1. `servicos_canonicos.service_family` — autoritativa quando existe,
  //      mas hoje só 3 dos 57 ganhos do mês têm serviço canônico materializado.
  //   2. `proposta_itens.service_family` — coluna existe mas vem 100% nula
  //      do banco real; fica na cascata pra funcionar sozinha no dia em que
  //      for populada.
  //   3. Nome do item vendido (`classificar-produto.ts`) — o que resolve
  //      hoje. Genéricos ("Setup", "Starter") herdam a família dominante da
  //      própria proposta em vez de virar palpite.
  // O valor de cada família é o `mrr_fechado` do negócio RATEADO pela
  // participação dos itens daquela família na proposta — assim a soma das
  // linhas continua fechando com o realizado do mês.
  const rows = await db.execute<{
    negocio_id: string; mrr: string; sc_family: string | null;
    item_nome: string | null; item_family: string | null; item_valor: string | null;
  }>(sql`
    SELECT n.id AS negocio_id,
           COALESCE(n.mrr_fechado, 0) AS mrr,
           sc.service_family AS sc_family,
           pi.nome AS item_nome,
           pi.service_family AS item_family,
           COALESCE(pi.subtotal, 0) AS item_valor
      FROM negocios n
      LEFT JOIN contratos c ON c.negocio_id = n.id
      LEFT JOIN servicos_canonicos sc ON sc.contrato_id = c.id
      LEFT JOIN propostas p ON p.negocio_id = n.id AND p.status = 'aceita'
      LEFT JOIN proposta_itens pi ON pi.proposta_id = p.id
     WHERE n.organizacao_id = ${orgId}
       AND n.status = 'ganho'
       AND n.ganho_at >= ${inicio.toISOString()} AND n.ganho_at < ${fim.toISOString()}
  `);

  // Agrupa por negócio (o JOIN com itens multiplica as linhas).
  const negocios = new Map<string, {
    mrr: number; scFamily: string | null;
    itens: { nome: string | null; familia: string | null; valor: number }[];
  }>();
  for (const r of rows) {
    const atual = negocios.get(r.negocio_id) ?? { mrr: Number(r.mrr) || 0, scFamily: r.sc_family, itens: [] };
    if (r.sc_family && !atual.scFamily) atual.scFamily = r.sc_family;
    if (r.item_nome) atual.itens.push({ nome: r.item_nome, familia: r.item_family, valor: Number(r.item_valor) || 0 });
    negocios.set(r.negocio_id, atual);
  }

  const totalPorFamilia = new Map<string, number>();
  const somar = (familia: string, v: number) => totalPorFamilia.set(familia, (totalPorFamilia.get(familia) ?? 0) + v);

  for (const neg of negocios.values()) {
    if (neg.mrr <= 0) continue;

    if (neg.scFamily) { somar(neg.scFamily, neg.mrr); continue; }

    const classificados = classificarItensDaProposta(
      neg.itens.map((i) => ({ nome: i.nome, valor: i.valor, familiaDeclarada: i.familia })),
    ).map((i) => ({ ...i, familia: (i.familiaDeclarada as FamiliaServico | null) ?? i.familia }));

    const base = classificados.reduce((s, i) => s + i.valor, 0);
    if (base <= 0 || classificados.length === 0) { somar("UNKNOWN", neg.mrr); continue; }

    // Rateio proporcional do MRR do negócio entre as famílias dos itens.
    const porFamiliaNoNegocio = new Map<string, number>();
    for (const i of classificados) {
      porFamiliaNoNegocio.set(i.familia, (porFamiliaNoNegocio.get(i.familia) ?? 0) + i.valor);
    }
    for (const [fam, v] of porFamiliaNoNegocio) somar(fam, neg.mrr * (v / base));
  }

  // "Não classificado" é categoria residual, não um produto — vai sempre pro
  // fim da lista, independente do valor.
  const linhas = [...totalPorFamilia.entries()]
    .map(([familia, valor]) => ({ familia, label: FAMILIA_LABEL[familia] ?? familia, valor }))
    .filter((l) => l.valor > 0)
    .sort((a, b) => {
      if (a.familia === "UNKNOWN") return 1;
      if (b.familia === "UNKNOWN") return -1;
      return b.valor - a.valor;
    });

  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return linhas.map((l) => ({ ...l, pct: total > 0 ? Math.round((l.valor / total) * 100) : 0 }));
}

export type AgendaGrupo = "atrasada" | "agora" | "a_seguir";
export interface AgendaItem {
  id: string;
  hora: string;
  titulo: string;
  detalhe: string;
  grupo: AgendaGrupo;
  icone: "reuniao" | "ligacao" | "tarefa" | "onboarding";
  href: string;
}

/**
 * Agenda do dia do usuário logado: reuniões agendadas de hoje + tarefas com
 * vencimento hoje ou atrasadas. Agrupamento por relógio real, não por campo
 * novo no banco: passou do horário = atrasada; dentro da janela da reunião
 * (ou até 30min depois do início) = agora; resto = a seguir. Tarefa sem hora
 * (`vence_em` nulo) usa só a data — entra como "a seguir" no dia, nunca
 * inventa um horário.
 */
export async function getAgendaHoje(orgId: string, usuarioId: string, hoje = new Date()): Promise<AgendaItem[]> {
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);
  const hojeStr = inicioDia.toISOString().split("T")[0];

  const [reunioesHoje, tarefasHoje] = await Promise.all([
    db.select({
      id: reunioes.id, titulo: reunioes.titulo, data: reunioes.data, duracao: reunioes.duracao,
      tipo: reunioes.tipo, link: reunioes.link, leadId: reunioes.leadId, negocioId: reunioes.negocioId,
    }).from(reunioes)
      .where(and(
        eq(reunioes.organizacaoId, orgId),
        eq(reunioes.status, "agendada"),
        gte(reunioes.data, inicioDia),
        lt(reunioes.data, fimDia),
        or(eq(reunioes.responsavelId, usuarioId), isNull(reunioes.responsavelId)),
      ))
      .orderBy(asc(reunioes.data)),
    db.select({
      id: tarefas.id, titulo: tarefas.titulo, tipo: tarefas.tipo,
      venceEm: tarefas.venceEm, dataVencimento: tarefas.dataVencimento, leadId: tarefas.leadId,
    }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, orgId),
        eq(tarefas.concluida, false),
        eq(tarefas.usuarioId, usuarioId),
        lte(tarefas.dataVencimento, hojeStr),
      ))
      .orderBy(asc(tarefas.venceEm))
      .limit(20),
  ]);

  const agora = hoje.getTime();
  const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const itens: AgendaItem[] = [];

  for (const r of reunioesHoje) {
    const inicio = new Date(r.data).getTime();
    const fim = inicio + (r.duracao ?? 30) * 60_000;
    const grupo: AgendaGrupo = agora >= inicio && agora < fim ? "agora" : agora >= fim ? "atrasada" : "a_seguir";
    const canal = r.link ? "Google Meet" : r.tipo === "call" ? "Ligação" : r.tipo === "presencial" ? "Presencial" : "Vídeo";
    itens.push({
      id: `reuniao-${r.id}`,
      hora: hhmm(new Date(r.data)),
      titulo: r.titulo,
      detalhe: [grupo === "agora" ? "Agora" : "Reunião", canal].filter(Boolean).join(" · "),
      grupo,
      icone: "reuniao",
      href: r.negocioId ? `/negocios/${r.negocioId}` : r.leadId ? `/leads/${r.leadId}` : "/calendario",
    });
  }

  for (const t of tarefasHoje) {
    const venc = t.venceEm ? new Date(t.venceEm) : null;
    const atrasadaPorData = !!t.dataVencimento && t.dataVencimento < hojeStr;
    const grupo: AgendaGrupo = atrasadaPorData || (venc && venc.getTime() < agora) ? "atrasada" : "a_seguir";
    itens.push({
      id: `tarefa-${t.id}`,
      hora: venc ? hhmm(venc) : "--:--",
      titulo: t.titulo,
      detalhe: grupo === "atrasada" ? "Tarefa · Atrasada" : "Tarefa · Hoje",
      grupo,
      icone: t.tipo === "ligar" ? "ligacao" : "tarefa",
      href: t.leadId ? `/leads/${t.leadId}` : "/tarefas",
    });
  }

  const ordem: Record<AgendaGrupo, number> = { atrasada: 0, agora: 1, a_seguir: 2 };
  return itens.sort((a, b) => ordem[a.grupo] - ordem[b.grupo] || a.hora.localeCompare(b.hora));
}

export type AtencaoSeveridade = "critico" | "aviso" | "info";
export interface AtencaoItem {
  id: string;
  severidade: AtencaoSeveridade;
  titulo: string;
  area: string;
  detalhe: string;
  icone: "pagamento" | "implantacao" | "lead" | "negocio" | "cs" | "proposta" | "onboarding";
  href: string;
}

const brlCompacto = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
    : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/**
 * "Precisa de atenção" — cada item é um sinal operacional REAL, com sua
 * própria fonte. Item com contagem zero simplesmente não entra na lista (o
 * card encolhe), em vez de aparecer zerado ou com número inventado. A ordem
 * é por severidade: crítico → aviso → info, que é a ordem de trabalho do time.
 */
export async function getPrecisaAtencao(orgId: string, hoje = new Date()): Promise<AtencaoItem[]> {
  const h24 = new Date(hoje.getTime() - 24 * 3_600_000);
  const d5 = new Date(hoje.getTime() - 5 * 86_400_000);
  const d3 = new Date(hoje.getTime() - 3 * 86_400_000);

  const [pagamentos, implantacaoBloqueada, leadsSemResposta, negociosParados, propostasParadas, onboardingSemContato] =
    await Promise.all([
      db.execute<{ n: number; valor: string }>(sql`
        SELECT COUNT(*)::int AS n, COALESCE(SUM(valor), 0) AS valor FROM faturas
         WHERE organizacao_id = ${orgId} AND status = 'aberta'
           AND COALESCE(vencimento, emitida_em) < ${d3.toISOString()}
      `),
      db.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n FROM fulfillments
         WHERE organizacao_id = ${orgId}
           AND service_family IN ('PABX','WHITE_LABEL')
           AND status IN ('BLOCKED_INTERNAL','BLOCKED_PROVIDER')
      `),
      db.select({ n: sql<number>`count(*)::int` }).from(leads)
        .where(and(
          eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"),
          eq(leads.sdrStatus, "pending"), lt(leads.createdAt, h24),
        )),
      db.execute<{ n: number; valor: string }>(sql`
        SELECT COUNT(*)::int AS n, COALESCE(SUM(n.valor_total), 0) AS valor
          FROM negocios n
         WHERE n.organizacao_id = ${orgId}
           AND n.status NOT IN ('ganho','perdido')
           AND n.updated_at < ${d5.toISOString()}
           AND NOT EXISTS (
             SELECT 1 FROM tarefas t WHERE t.negocio_id = n.id AND t.concluida = false
           )
      `),
      db.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n FROM propostas
         WHERE organizacao_id = ${orgId} AND status = 'enviada' AND enviada_em < ${d5.toISOString()}
      `),
      db.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n FROM fulfillments
         WHERE organizacao_id = ${orgId} AND service_family = 'CALLFACE_AI' AND status = 'NOT_STARTED'
      `),
    ]);

  const itens: AtencaoItem[] = [];
  const nPag = Number(pagamentos[0]?.n || 0);
  if (nPag > 0) itens.push({
    id: "pagamentos", severidade: "critico", icone: "pagamento", area: "Financeiro",
    titulo: `${nPag} ${nPag === 1 ? "pagamento falhou" : "pagamentos falharam"}`,
    detalhe: `${brlCompacto(Number(pagamentos[0]?.valor || 0))} em cobranças vencidas há 3+ dias`,
    href: "/clientes/financeiro",
  });

  const nImp = Number(implantacaoBloqueada[0]?.n || 0);
  if (nImp > 0) itens.push({
    id: "implantacao", severidade: "critico", icone: "implantacao", area: "Implantação",
    titulo: `${nImp} ${nImp === 1 ? "implantação bloqueada" : "implantações bloqueadas"}`,
    detalhe: "Aguardando liberação interna ou da operadora",
    href: "/clientes/implantacao",
  });

  const nLeads = Number(leadsSemResposta[0]?.n || 0);
  if (nLeads > 0) itens.push({
    id: "leads", severidade: "aviso", icone: "lead", area: "Pré-vendas",
    titulo: `${nLeads} ${nLeads === 1 ? "lead sem resposta" : "leads sem resposta"}`,
    detalhe: "Primeiro contato pendente há mais de 24h",
    href: "/pre-vendas",
  });

  const nNeg = Number(negociosParados[0]?.n || 0);
  if (nNeg > 0) itens.push({
    id: "negocios", severidade: "aviso", icone: "negocio", area: "Vendas",
    titulo: `${nNeg} ${nNeg === 1 ? "negócio sem próxima ação" : "negócios sem próxima ação"}`,
    detalhe: `${brlCompacto(Number(negociosParados[0]?.valor || 0))} parados no pipeline sem tarefa agendada`,
    href: "/pipeline",
  });

  const nProp = Number(propostasParadas[0]?.n || 0);
  if (nProp > 0) itens.push({
    id: "propostas", severidade: "info", icone: "proposta", area: "Vendas",
    titulo: `${nProp} ${nProp === 1 ? "proposta aguardando resposta" : "propostas aguardando resposta"}`,
    detalhe: "Enviadas há 5+ dias · follow-up recomendado",
    href: "/propostas",
  });

  const nOnb = Number(onboardingSemContato[0]?.n || 0);
  if (nOnb > 0) itens.push({
    id: "onboarding", severidade: "info", icone: "onboarding", area: "Onboarding",
    titulo: `${nOnb} ${nOnb === 1 ? "onboarding aguardando 1º contato" : "onboardings aguardando 1º contato"}`,
    detalhe: "Contrato assinado sem kickoff agendado",
    href: "/clientes/onboarding",
  });

  const peso: Record<AtencaoSeveridade, number> = { critico: 0, aviso: 1, info: 2 };
  return itens.sort((a, b) => peso[a.severidade] - peso[b.severidade]);
}

export interface PontoSerie { label: string; mrr: number; novo: number }
export interface MrrSeries {
  "7D": PontoSerie[];
  "30D": PontoSerie[];
  "90D": PontoSerie[];
  "12M": PontoSerie[];
}

/**
 * Série do gráfico "Evolução do MRR" nas 4 janelas do desenho. Duas séries
 * reais por ponto:
 *  - `mrr`   = MRR recorrente fechado no bucket (negócios ganhos, mesma
 *              fonte/critério de `getFechadoPeriodo`).
 *  - `novo`  = MRR novo de verdade vindo do ledger (`mrr_movimentos` tipo
 *              novo/reativação, escrito pelo stripe-sync).
 * As 4 janelas saem de 2 queries (uma diária p/ 7-30-90D, uma mensal p/ 12M)
 * — o toggle da UI só fatia o que já veio, sem novo round-trip.
 */
export async function getMrrSeries(orgId: string, hoje = new Date()): Promise<MrrSeries> {
  const inicio90 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 89);
  const inicio12m = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [diario, mensal] = await Promise.all([
    db.execute<{ dia: string; mrr: string; novo: string }>(sql`
      WITH dias AS (
        SELECT generate_series(${inicio90.toISOString()}::date, ${hoje.toISOString()}::date, '1 day')::date AS dia
      ),
      ganhos AS (
        SELECT ganho_at::date AS dia, COALESCE(SUM(mrr_fechado), 0) AS mrr
          FROM negocios
         WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at >= ${inicio90.toISOString()}
         GROUP BY ganho_at::date
      ),
      novos AS (
        SELECT ocorrido_em::date AS dia, COALESCE(SUM(delta), 0) AS novo
          FROM mrr_movimentos
         WHERE organizacao_id = ${orgId} AND tipo IN ('novo','reativacao') AND ocorrido_em >= ${inicio90.toISOString()}
         GROUP BY ocorrido_em::date
      )
      SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
             COALESCE(g.mrr, 0) AS mrr, COALESCE(nv.novo, 0) AS novo
        FROM dias d
        LEFT JOIN ganhos g ON g.dia = d.dia
        LEFT JOIN novos nv ON nv.dia = d.dia
       ORDER BY d.dia
    `),
    db.execute<{ mes: string; mrr: string; novo: string }>(sql`
      WITH meses AS (
        SELECT generate_series(${inicio12m.toISOString()}::date, ${fimMes.toISOString()}::date - interval '1 day', '1 month')::date AS mes
      ),
      ganhos AS (
        SELECT date_trunc('month', ganho_at)::date AS mes, COALESCE(SUM(mrr_fechado), 0) AS mrr
          FROM negocios
         WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at >= ${inicio12m.toISOString()}
         GROUP BY date_trunc('month', ganho_at)
      ),
      novos AS (
        SELECT date_trunc('month', ocorrido_em)::date AS mes, COALESCE(SUM(delta), 0) AS novo
          FROM mrr_movimentos
         WHERE organizacao_id = ${orgId} AND tipo IN ('novo','reativacao') AND ocorrido_em >= ${inicio12m.toISOString()}
         GROUP BY date_trunc('month', ocorrido_em)
      )
      SELECT to_char(m.mes, 'YYYY-MM') AS mes,
             COALESCE(g.mrr, 0) AS mrr, COALESCE(nv.novo, 0) AS novo
        FROM meses m
        LEFT JOIN ganhos g ON g.mes = m.mes
        LEFT JOIN novos nv ON nv.mes = m.mes
       ORDER BY m.mes
    `),
  ]);

  const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const dias = diario.map((r) => ({
    label: `${r.dia.slice(8, 10)}/${r.dia.slice(5, 7)}`,
    mrr: Number(r.mrr) || 0,
    novo: Number(r.novo) || 0,
  }));
  const meses = mensal.map((r) => ({
    label: MES_CURTO[Number(r.mes.slice(5, 7)) - 1] ?? r.mes,
    mrr: Number(r.mrr) || 0,
    novo: Number(r.novo) || 0,
  }));

  return {
    "7D": dias.slice(-7),
    "30D": dias.slice(-30),
    "90D": dias,
    "12M": meses,
  };
}

export interface JornadaOperacao {
  aquisicao: number;
  preVendas: number;
  pipeline: number;
  ganhos: number;
  ativacao: number;
  clientesAtivos: number;
  csPendentes: number;
}

/**
 * Clientes ativos — empresas com pelo menos um serviço canônico ACTIVE no
 * portfólio, MESMO critério que a Carteira de Clientes usa pra montar a
 * lista. Existe porque `getSaudeBaseClientes` (command-center) lê
 * `clientes.status_financeiro`, que está 100% NULL no banco real: o KPI
 * mostrava "0 clientes ativos" com 244 clientes cadastrados. Aqui o número
 * bate com o que a pessoa encontra ao clicar no card.
 */
export async function getClientesAtivos(orgId: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(DISTINCT sc.empresa_id)::int AS n
      FROM servicos_canonicos sc
     WHERE sc.organizacao_id = ${orgId}
       AND sc.commercial_lifecycle = 'ACTIVE'
       AND sc.portfolio_included = true
       AND sc.empresa_id IS NOT NULL
  `);
  return Number(row?.n || 0);
}

/** Contagem de "Equipe" do header — usuários ativos da organização, com as
 *  iniciais reais pros avatares. Sem invenção: quem está `ativo=false` não
 *  aparece. */
export async function getEquipeAtiva(orgId: string, limite = 5) {
  return db
    .select({ id: usuarios.id, nome: usuarios.nome, avatarUrl: usuarios.avatarUrl })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome))
    .limit(limite);
}
