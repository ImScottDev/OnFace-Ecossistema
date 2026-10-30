/**
 * Fila priorizada do CS e pulso da carteira.
 *
 * A pergunta que a página principal responde é "o que exige ação agora?".
 * Cada item da fila tem cliente, motivo, urgência, responsável, última
 * interação, próxima ação e prazo — se não dá pra responder "por quê?",
 * não entra na fila.
 *
 * A fila é DERIVADA das entidades reais (riscos, tarefas, renovações,
 * cancelamentos, entregas), nunca uma tabela própria: uma "tabela de fila"
 * ficaria dessincronizada no minuto seguinte.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { nomeEmpresaSql } from "@/lib/vendas/texto";

export type MotivoFila =
  | "TAREFA_VENCIDA" | "TAREFA_HOJE" | "RISCO" | "RENOVACAO"
  | "CANCELAMENTO" | "MARCO" | "SEM_PROXIMA_ACAO";

interface LinhaFila {
  [k: string]: string | number | boolean | null;
}

export interface ItemFila {
  chave: string;
  empresaId: string;
  empresaNome: string;
  motivo: MotivoFila;
  rotulo: string;
  detalhe: string;
  urgencia: "CRITICA" | "ALTA" | "MEDIA";
  /** Severidade do sinal quando o item vem de um risco — mais granular que a urgência. */
  severidade: string | null;
  /** Tipo do risco (FATURA_ATRASADA, ENTREGA_PARADA...) — segmenta a fila sem nova query. */
  tipoRisco: string | null;
  ordem: number;
  /** MRR da conta: entre dois itens igualmente urgentes, o dinheiro decide. */
  mrr: string | null;
  servicoFamilia: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  ultimaInteracao: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  prazo: string | null;
  tarefaId: string | null;
  riscoId: string | null;
  renovacaoId: string | null;
  cancelamentoId: string | null;
  marcoId: string | null;
}

const ORDEM: Record<ItemFila["urgencia"], number> = { CRITICA: 0, ALTA: 1, MEDIA: 2 };

export interface FiltrosFila {
  organizacaoId: string;
  responsavelId?: string | null;
  /** "sem_dono" é um filtro real e importante: hoje é a maior parte da base. */
  semDono?: boolean;
  motivos?: MotivoFila[];
  empresaId?: string;
  limite?: number;
}

/**
 * Monta a fila. Uma query por fonte, unidas em memória — tentei um UNION
 * único e o plano ficava pior (cada fonte tem seletividade muito diferente)
 * além de ilegível pra auditar depois "de onde veio esse item".
 */
export async function montarFila(f: FiltrosFila): Promise<ItemFila[]> {
  const org = f.organizacaoId;
  const filtroDono = f.semDono
    ? sql`AND cli.responsavel_id IS NULL`
    : f.responsavelId
      ? sql`AND cli.responsavel_id = ${f.responsavelId}`
      : sql``;
  const filtroEmpresa = f.empresaId ? sql`AND cli.empresa_id = ${f.empresaId}` : sql``;

  // Contexto comum a todo item: quem é o dono, quando foi a última
  // interação, qual a próxima ação. Repetir isso em cada query abaixo
  // seria erro garantido de divergência.
  const contexto = sql`
    conta AS (
      SELECT cli.empresa_id, cli.responsavel_id, ${nomeEmpresaSql("e.nome")} AS empresa_nome, u.nome AS responsavel_nome
        FROM clientes cli
        JOIN empresas e ON e.id = cli.empresa_id
        LEFT JOIN usuarios u ON u.id = cli.responsavel_id
       WHERE cli.organizacao_id = ${org} AND cli.empresa_id IS NOT NULL
         ${filtroDono} ${filtroEmpresa}
    ),
    interacao_empresa AS (
      SELECT COALESCE(a.empresa_id, l.empresa_id) AS empresa_id, a.created_at
        FROM atividades a
        LEFT JOIN leads l ON l.id = a.lead_id
       WHERE COALESCE(a.empresa_id, l.empresa_id) IS NOT NULL
    ),
    ultima_interacao AS (
      SELECT c.empresa_id, MAX(ie.created_at) AS quando
        FROM conta c
        LEFT JOIN interacao_empresa ie ON ie.empresa_id = c.empresa_id
       GROUP BY c.empresa_id
    ),
    proxima_acao AS (
      SELECT DISTINCT ON (c.empresa_id) c.empresa_id, t.titulo, t.vence_em
        FROM conta c
        JOIN tarefas t ON t.empresa_id = c.empresa_id
       WHERE t.concluida = false AND t.vence_em > now()
       ORDER BY c.empresa_id, t.vence_em ASC
    ),
    familia AS (
      SELECT sc.empresa_id,
             string_agg(DISTINCT sc.service_family, ', ') AS familias,
             COALESCE(SUM(sc.current_recurring_value) FILTER (WHERE sc.revenue_nature = 'MRR'), 0)::text AS mrr
        FROM servicos_canonicos sc
       WHERE sc.portfolio_included = true
       GROUP BY sc.empresa_id
    )`;

  const colunasContexto = sql`
    c.empresa_id, c.empresa_nome, c.responsavel_id, c.responsavel_nome,
    ui.quando::text AS ultima_interacao,
    pa.titulo AS proxima_acao, pa.vence_em::text AS proxima_acao_em,
    fam.familias AS servico_familia, fam.mrr AS mrr_conta`;

  const joinsContexto = sql`
    LEFT JOIN ultima_interacao ui ON ui.empresa_id = c.empresa_id
    LEFT JOIN proxima_acao pa ON pa.empresa_id = c.empresa_id
    LEFT JOIN familia fam ON fam.empresa_id = c.empresa_id`;

  type Row = LinhaFila;
  const itens: ItemFila[] = [];

  const empurrar = (r: Row, item: Partial<ItemFila> & Pick<ItemFila, "chave" | "motivo" | "rotulo" | "detalhe" | "urgencia">) => {
    itens.push({
      empresaId: String(r.empresa_id),
      empresaNome: String(r.empresa_nome),
      responsavelId: (r.responsavel_id as string) ?? null,
      responsavelNome: (r.responsavel_nome as string) ?? null,
      ultimaInteracao: (r.ultima_interacao as string) ?? null,
      proximaAcao: (r.proxima_acao as string) ?? null,
      proximaAcaoEm: (r.proxima_acao_em as string) ?? null,
      servicoFamilia: (r.servico_familia as string) ?? null,
      mrr: (r.mrr_conta as string) ?? null,
      severidade: null,
      tipoRisco: null,
      prazo: null, tarefaId: null, riscoId: null, renovacaoId: null,
      cancelamentoId: null, marcoId: null,
      ordem: ORDEM[item.urgencia],
      ...item,
    } as ItemFila);
  };

  // 1. Cancelamento em aberto — nada é mais urgente.
  const cancel = await db.execute<Row>(sql`
    WITH ${contexto}
    SELECT ${colunasContexto}, cc.id AS cancelamento_id, cc.motivo, cc.status, cc.solicitado_em::text
      FROM conta c
      JOIN cs_cancelamentos cc ON cc.empresa_id = c.empresa_id AND cc.status IN ('SOLICITADO','EM_RETENCAO','APROVADO')
      ${joinsContexto}`);
  for (const r of cancel) {
    empurrar(r, {
      chave: `cancel:${r.cancelamento_id}`,
      motivo: "CANCELAMENTO",
      rotulo: "Pedido de cancelamento",
      detalhe: `Motivo: ${r.motivo} · status ${String(r.status).toLowerCase()}`,
      urgencia: "CRITICA",
      severidade: "CRITICO",
      cancelamentoId: String(r.cancelamento_id),
    });
  }

  // 2. Riscos abertos. ATENCAO fica de fora da fila de ação — vira coluna
  // na carteira. Fila é "o que eu faço hoje", não "tudo que está torto".
  const riscos = await db.execute<Row>(sql`
    WITH ${contexto}
    SELECT ${colunasContexto}, r.id AS risco_id, r.tipo, r.severidade, r.motivo, r.tarefa_id, r.aberto_em::text
      FROM conta c
      JOIN cs_riscos r ON r.empresa_id = c.empresa_id AND r.status = 'ABERTO' AND r.severidade IN ('CRITICO','EM_RISCO')
      ${joinsContexto}`);
  for (const r of riscos) {
    empurrar(r, {
      chave: `risco:${r.risco_id}`,
      motivo: "RISCO",
      rotulo: String(r.severidade) === "CRITICO" ? "Risco crítico" : "Cliente em risco",
      detalhe: String(r.motivo),
      urgencia: String(r.severidade) === "CRITICO" ? "CRITICA" : "ALTA",
      severidade: String(r.severidade),
      tipoRisco: String(r.tipo),
      riscoId: String(r.risco_id),
      tarefaId: (r.tarefa_id as string) ?? null,
    });
  }

  // 3. Tarefas de CS vencidas ou vencendo hoje.
  const tarefas = await db.execute<Row>(sql`
    WITH ${contexto}
    SELECT ${colunasContexto}, t.id AS tarefa_id, t.titulo, t.vence_em::text, t.prioridade, t.origem, t.motivo AS tarefa_motivo,
           (t.vence_em < now()) AS vencida
      FROM conta c
      JOIN tarefas t ON t.empresa_id = c.empresa_id
      ${joinsContexto}
     WHERE t.concluida = false AND t.vence_em IS NOT NULL
       AND t.vence_em < date_trunc('day', now()) + interval '1 day'`);
  for (const r of tarefas) {
    // `db.execute` devolve o boolean do Postgres já convertido, mas o tipo
    // da linha aqui é genérico — normaliza sem depender do runtime.
    const vencida = String(r.vencida) === "true";
    empurrar(r, {
      chave: `tarefa:${r.tarefa_id}`,
      motivo: vencida ? "TAREFA_VENCIDA" : "TAREFA_HOJE",
      rotulo: vencida ? "Tarefa vencida" : "Tarefa vence hoje",
      detalhe: `${r.titulo}${r.tarefa_motivo ? ` — ${r.tarefa_motivo}` : ""}`,
      urgencia: vencida ? (String(r.prioridade) === "alta" ? "CRITICA" : "ALTA") : "MEDIA",
      prazo: (r.vence_em as string) ?? null,
      tarefaId: String(r.tarefa_id),
    });
  }

  // 4. Renovações na janela.
  const renov = await db.execute<Row>(sql`
    WITH ${contexto}
    SELECT ${colunasContexto}, rn.id AS renovacao_id, rn.vencimento::text, rn.status,
           (rn.vencimento - CURRENT_DATE)::int AS dias
      FROM conta c
      JOIN cs_renovacoes rn ON rn.empresa_id = c.empresa_id AND rn.status IN ('ABERTA','EM_NEGOCIACAO')
      ${joinsContexto}`);
  for (const r of renov) {
    const dias = Number(r.dias);
    empurrar(r, {
      chave: `renov:${r.renovacao_id}`,
      motivo: "RENOVACAO",
      rotulo: dias < 0 ? "Renovação vencida" : `Renovação em ${dias} dias`,
      detalhe: `Vence ${r.vencimento} · ${String(r.status).toLowerCase().replace("_", " ")}`,
      urgencia: dias <= 15 ? "CRITICA" : dias <= 30 ? "ALTA" : "MEDIA",
      prazo: (r.vencimento as string) ?? null,
      renovacaoId: String(r.renovacao_id),
    });
  }

  // 5. Marcos vencidos que ainda não viraram tarefa (janela entre o
  // vencimento e a próxima passada do sweep).
  const marcos = await db.execute<Row>(sql`
    WITH ${contexto}
    SELECT ${colunasContexto}, m.id AS marco_id, m.codigo, m.titulo, m.due_date::text
      FROM conta c
      JOIN cs_marcos m ON m.empresa_id = c.empresa_id AND m.status = 'PENDENTE'
                      AND m.due_date <= CURRENT_DATE AND m.tarefa_id IS NULL
      ${joinsContexto}`);
  for (const r of marcos) {
    empurrar(r, {
      chave: `marco:${r.marco_id}`,
      motivo: "MARCO",
      rotulo: `Marco ${r.codigo} vencido`,
      detalhe: String(r.titulo),
      urgencia: "ALTA",
      prazo: (r.due_date as string) ?? null,
      marcoId: String(r.marco_id),
    });
  }

  const filtrados = f.motivos?.length ? itens.filter((i) => f.motivos!.includes(i.motivo)) : itens;

  filtrados.sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    // Dentro da mesma urgência, o que está parado há mais tempo primeiro.
    const pa = a.prazo ?? "9999-12-31";
    const pb = b.prazo ?? "9999-12-31";
    if (pa !== pb) return pa.localeCompare(pb);
    // Empate real: a conta maior primeiro. Mesma hora de trabalho do CS,
    // consequência diferente.
    return Number(b.mrr ?? 0) - Number(a.mrr ?? 0);
  });

  return filtrados.slice(0, f.limite ?? 200);
}

export interface PulsoCarteira {
  clientesAtivos: number;
  mrrCarteira: number;
  emOnboarding: number;
  emImplantacao: number;
  emRisco: number;
  inadimplentes: number;
  renovacoesProximas: number;
  expansoesAbertas: number;
  tarefasVencidas: number;
  checkpointsAtrasados: number;
  semProximaAcao: number;
  semDono: number;
}

/**
 * KPIs do topo. Todos são contagens de coisa real e clicável — cada número
 * corresponde exatamente a um filtro que a carteira sabe aplicar, senão o
 * card vira enfeite.
 */
export async function pulsoCarteira(organizacaoId: string, responsavelId?: string | null): Promise<PulsoCarteira> {
  const filtroDono = responsavelId ? sql`AND cli.responsavel_id = ${responsavelId}` : sql``;

  const [row] = await db.execute<Record<string, string>>(sql`
    WITH conta AS (
      SELECT cli.empresa_id FROM clientes cli
       WHERE cli.organizacao_id = ${organizacaoId} AND cli.empresa_id IS NOT NULL ${filtroDono}
    )
    SELECT
      (SELECT COUNT(DISTINCT sc.empresa_id) FROM servicos_canonicos sc JOIN conta c ON c.empresa_id = sc.empresa_id
        WHERE sc.portfolio_included = true)::text AS clientes_ativos,
      (SELECT COALESCE(SUM(sc.current_recurring_value), 0) FROM servicos_canonicos sc JOIN conta c ON c.empresa_id = sc.empresa_id
        WHERE sc.portfolio_included = true AND sc.revenue_nature = 'MRR' AND sc.commercial_lifecycle = 'ACTIVE')::text AS mrr_carteira,
      (SELECT COUNT(DISTINCT sc.empresa_id) FROM servicos_canonicos sc JOIN conta c ON c.empresa_id = sc.empresa_id
        JOIN fulfillments f ON f.servico_canonico_id = sc.id
        WHERE sc.service_family = 'CALLFACE_AI' AND f.status NOT IN ('COMPLETED','CANCELED'))::text AS em_onboarding,
      (SELECT COUNT(DISTINCT sc.empresa_id) FROM servicos_canonicos sc JOIN conta c ON c.empresa_id = sc.empresa_id
        JOIN fulfillments f ON f.servico_canonico_id = sc.id
        WHERE sc.service_family IN ('PABX','WHITE_LABEL','ASSISTANT') AND f.status NOT IN ('COMPLETED','CANCELED'))::text AS em_implantacao,
      (SELECT COUNT(DISTINCT r.empresa_id) FROM cs_riscos r JOIN conta c ON c.empresa_id = r.empresa_id
        WHERE r.status = 'ABERTO' AND r.severidade IN ('CRITICO','EM_RISCO'))::text AS em_risco,
      (SELECT COUNT(DISTINCT r.empresa_id) FROM cs_riscos r JOIN conta c ON c.empresa_id = r.empresa_id
        WHERE r.status = 'ABERTO' AND r.tipo IN ('FATURA_ATRASADA','PAGAMENTO_FALHOU'))::text AS inadimplentes,
      (SELECT COUNT(*) FROM cs_renovacoes rn JOIN conta c ON c.empresa_id = rn.empresa_id
        WHERE rn.status IN ('ABERTA','EM_NEGOCIACAO'))::text AS renovacoes_proximas,
      (SELECT COUNT(*) FROM negocios n JOIN conta c ON c.empresa_id = n.empresa_id
        WHERE n.commercial_motion = 'EXPANSION'
          -- QA pós-venda 06/10: as 161 expansões da carga têm etapa NULL, e
          -- NULL NOT IN (...) é NULL (sem crase: crase em comentário SQL fecha o template literal): o card mostrava 0 com 161 abertas.
          AND n.status NOT IN ('ganho','perdido') AND COALESCE(n.etapa, '') NOT IN ('ganho','perdido'))::text AS expansoes_abertas,
      (SELECT COUNT(*) FROM tarefas t JOIN conta c ON c.empresa_id = t.empresa_id
        WHERE t.concluida = false AND t.vence_em < now())::text AS tarefas_vencidas,
      (SELECT COUNT(*) FROM cs_marcos m JOIN conta c ON c.empresa_id = m.empresa_id
        WHERE m.status = 'PENDENTE' AND m.due_date < CURRENT_DATE)::text AS checkpoints_atrasados,
      (SELECT COUNT(DISTINCT r.empresa_id) FROM cs_riscos r JOIN conta c ON c.empresa_id = r.empresa_id
        WHERE r.status = 'ABERTO' AND r.tipo = 'SEM_PROXIMA_ACAO')::text AS sem_proxima_acao,
      (SELECT COUNT(*) FROM clientes cli WHERE cli.organizacao_id = ${organizacaoId}
        AND cli.empresa_id IS NOT NULL AND cli.responsavel_id IS NULL)::text AS sem_dono
  `);

  const n = (k: string) => Number(row?.[k] ?? 0);
  return {
    clientesAtivos: n("clientes_ativos"),
    mrrCarteira: n("mrr_carteira"),
    emOnboarding: n("em_onboarding"),
    emImplantacao: n("em_implantacao"),
    emRisco: n("em_risco"),
    inadimplentes: n("inadimplentes"),
    renovacoesProximas: n("renovacoes_proximas"),
    expansoesAbertas: n("expansoes_abertas"),
    tarefasVencidas: n("tarefas_vencidas"),
    checkpointsAtrasados: n("checkpoints_atrasados"),
    semProximaAcao: n("sem_proxima_acao"),
    semDono: n("sem_dono"),
  };
}
