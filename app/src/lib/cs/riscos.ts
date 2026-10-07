/**
 * Motor de risco do CS.
 *
 * Regra fechada do projeto, mantida aqui: NUNCA um score 0-100 com pesos
 * inventados. Cada risco é um sinal real, com motivo em português, fonte
 * auditável e um `detalhe` que permite conferir a afirmação no banco.
 *
 * Sinais deliberadamente FORA desta v1, por não existir dado real:
 *   - baixa utilização (não há telemetria de uso por cliente no CRM)
 *   - CSAT (só existe NPS/health check ao vivo, já usado abaixo)
 * Quando o dado existir, entra como mais um `AvaliadorRisco` — a lista é
 * aberta justamente pra isso.
 */
import { db } from "@/lib/db";
import { csRiscos } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { criarTarefaCs } from "./tarefas";
import { resolveFollowupOwnerId } from "@/lib/crm/sdr-escalation";

export type TipoRisco =
  | "FATURA_ATRASADA"
  | "PAGAMENTO_FALHOU"
  | "ENTREGA_PARADA"
  | "TAREFA_VENCIDA"
  | "SEM_PROXIMA_ACAO"
  | "SEM_INTERACAO"
  | "RENOVACAO_SEM_CONTATO"
  | "PEDIDO_CANCELAMENTO"
  | "NPS_BAIXO"
  | "HEALTH_CHECK_BAIXO"
  | "INTENCAO_SAIDA"
  | "ASSINATURA_INADIMPLENTE"
  | "MANUAL";

export type Severidade = "ATENCAO" | "EM_RISCO" | "CRITICO";

export const ROTULO_RISCO: Record<TipoRisco, string> = {
  FATURA_ATRASADA: "Fatura vencida em aberto",
  PAGAMENTO_FALHOU: "Falha de pagamento",
  ENTREGA_PARADA: "Entrega parada",
  TAREFA_VENCIDA: "Tarefa vencida",
  SEM_PROXIMA_ACAO: "Sem próxima ação",
  SEM_INTERACAO: "Muito tempo sem interação",
  RENOVACAO_SEM_CONTATO: "Renovação próxima sem contato",
  PEDIDO_CANCELAMENTO: "Pedido de cancelamento",
  NPS_BAIXO: "Health check baixo",
  HEALTH_CHECK_BAIXO: "Percepção baixa no health check",
  INTENCAO_SAIDA: "Cliente declarou intenção de sair",
  ASSINATURA_INADIMPLENTE: "Assinatura Stripe irregular",
  MANUAL: "Risco marcado pelo CS",
};

/** Ordem de gravidade, usada pra ordenar a fila e resumir a conta. */
export const PESO_SEVERIDADE: Record<Severidade, number> = { CRITICO: 3, EM_RISCO: 2, ATENCAO: 1 };

interface SinalDetectado {
  empresaId: string;
  servicoCanonicoId?: string | null;
  tipo: TipoRisco;
  severidade: Severidade;
  motivo: string;
  fonte: string;
  detalhe: Record<string, unknown>;
}

/**
 * Consulta os sinais automáticos. Uma query por sinal, com o critério
 * escrito por extenso — é mais fácil auditar "por que esse cliente está em
 * risco" quando dá pra ler o SQL que gerou a afirmação.
 *
 * `SEM_INTERACAO` usa 90 dias, não 14. Medido na base: a 14 dias, 71% dos
 * clientes ativos entram — não é sinal, é ruído, porque `atividades`
 * registra cadência de VENDAS, não de pós-venda. Aos 90 dias volta a
 * discriminar.
 */
async function detectarSinais(organizacaoId: string, empresaId?: string): Promise<SinalDetectado[]> {
  const filtroEmpresa = empresaId ? sql`AND alvo.empresa_id = ${empresaId}` : sql``;
  const sinais: SinalDetectado[] = [];

  // Universo: quem está na carteira de CS.
  const base = sql`
    SELECT c.empresa_id
      FROM clientes c
     WHERE c.organizacao_id = ${organizacaoId} AND c.empresa_id IS NOT NULL`;

  // 1. Fatura vencida em aberto — o sinal mais duro que existe hoje.
  const faturas = await db.execute<{ empresa_id: string; n: number; valor: string; mais_antiga: string }>(sql`
    WITH alvo AS (${base})
    SELECT alvo.empresa_id, COUNT(*)::int AS n, SUM(f.valor)::text AS valor,
           MIN(COALESCE(f.vencimento, f.emitida_em))::text AS mais_antiga
      FROM alvo
      JOIN faturas f ON f.empresa_id = alvo.empresa_id
     WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
       ${filtroEmpresa}
     GROUP BY alvo.empresa_id`);
  for (const r of faturas) {
    const dias = Math.floor((Date.now() - new Date(r.mais_antiga).getTime()) / 86_400_000);
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "FATURA_ATRASADA",
      // 30+ dias de atraso deixa de ser esquecimento e vira inadimplência.
      severidade: dias >= 30 ? "CRITICO" : "EM_RISCO",
      motivo: `${r.n} fatura${r.n > 1 ? "s" : ""} vencida${r.n > 1 ? "s" : ""} em aberto (R$ ${Number(r.valor).toFixed(2)}), a mais antiga há ${dias} dias`,
      fonte: "faturas",
      detalhe: { faturas: r.n, valor: r.valor, diasAtraso: dias },
    });
  }

  // 2. Entrega parada. `fulfillments.target_at` não é preenchido em lugar
  // nenhum hoje (0 de 415 na base), então "atrasada" não é mensurável por
  // prazo — o que é mensurável, e é o problema real, é entrega criada há
  // mais de 15 dias que nunca começou.
  const entregas = await db.execute<{ empresa_id: string; n: number; dias: number; familias: string }>(sql`
    WITH alvo AS (${base})
    SELECT alvo.empresa_id, COUNT(*)::int AS n,
           MAX(EXTRACT(DAY FROM now() - f.created_at))::int AS dias,
           string_agg(DISTINCT f.service_family, ', ') AS familias
      FROM alvo
      JOIN servicos_canonicos sc ON sc.empresa_id = alvo.empresa_id AND sc.portfolio_included = true
      JOIN fulfillments f ON f.servico_canonico_id = sc.id
     WHERE f.status = 'NOT_STARTED' AND f.started_at IS NULL
       AND f.created_at < now() - interval '15 days'
       ${filtroEmpresa}
     GROUP BY alvo.empresa_id`);
  for (const r of entregas) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "ENTREGA_PARADA",
      severidade: r.dias >= 45 ? "EM_RISCO" : "ATENCAO",
      motivo: `${r.n} entrega${r.n > 1 ? "s" : ""} (${r.familias}) sem iniciar há ${r.dias} dias`,
      fonte: "fulfillments",
      detalhe: { entregas: r.n, diasParada: r.dias, familias: r.familias },
    });
  }

  // 3. Tarefa vencida em aberto.
  const tarefasVencidas = await db.execute<{ empresa_id: string; n: number; dias: number }>(sql`
    WITH alvo AS (${base})
    SELECT alvo.empresa_id, COUNT(*)::int AS n,
           MAX(EXTRACT(DAY FROM now() - t.vence_em))::int AS dias
      FROM alvo
      JOIN tarefas t ON t.empresa_id = alvo.empresa_id
     WHERE t.concluida = false AND t.vence_em IS NOT NULL AND t.vence_em < now()
       ${filtroEmpresa}
     GROUP BY alvo.empresa_id`);
  for (const r of tarefasVencidas) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "TAREFA_VENCIDA",
      severidade: r.dias >= 15 ? "EM_RISCO" : "ATENCAO",
      motivo: `${r.n} tarefa${r.n > 1 ? "s" : ""} de CS vencida${r.n > 1 ? "s" : ""} há até ${r.dias} dias`,
      fonte: "tarefas",
      detalhe: { tarefas: r.n, diasAtraso: r.dias },
    });
  }

  // 4. Sem próxima ação agendada. Só conta pra quem está ATIVO — cliente em
  // implantação tem o time de entrega em cima, não é abandono.
  const semAcao = await db.execute<{ empresa_id: string }>(sql`
    WITH alvo AS (${base})
    SELECT alvo.empresa_id
      FROM alvo
     WHERE EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = alvo.empresa_id AND sc.portfolio_included = true)
       AND NOT EXISTS (
         SELECT 1 FROM tarefas t
          WHERE t.empresa_id = alvo.empresa_id AND t.concluida = false
            AND t.vence_em IS NOT NULL AND t.vence_em > now())
       AND NOT EXISTS (
         SELECT 1 FROM servicos_canonicos sc
           JOIN fulfillments f ON f.servico_canonico_id = sc.id
          WHERE sc.empresa_id = alvo.empresa_id AND f.status NOT IN ('COMPLETED','CANCELED'))
       ${filtroEmpresa}`);
  for (const r of semAcao) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "SEM_PROXIMA_ACAO",
      severidade: "ATENCAO",
      motivo: "Cliente ativo sem nenhuma próxima ação agendada",
      fonte: "tarefas",
      detalhe: {},
    });
  }

  // 5. Sem interação há 90 dias (ver nota no cabeçalho da função).
  const semInteracao = await db.execute<{ empresa_id: string; dias: number | null }>(sql`
    WITH alvo AS (${base}),
    interacao_empresa AS (
      SELECT COALESCE(a.empresa_id, l.empresa_id) AS empresa_id, a.created_at
        FROM atividades a
        LEFT JOIN leads l ON l.id = a.lead_id
       WHERE COALESCE(a.empresa_id, l.empresa_id) IS NOT NULL
    ),
    ultima AS (
      SELECT alvo.empresa_id, MAX(ie.created_at) AS quando
        FROM alvo
        LEFT JOIN interacao_empresa ie ON ie.empresa_id = alvo.empresa_id
       GROUP BY alvo.empresa_id)
    SELECT u.empresa_id, EXTRACT(DAY FROM now() - u.quando)::int AS dias
      FROM ultima u
      JOIN alvo ON alvo.empresa_id = u.empresa_id
     WHERE (u.quando IS NULL OR u.quando < now() - interval '90 days')
       AND EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = u.empresa_id AND sc.portfolio_included = true)
       ${filtroEmpresa}`);
  for (const r of semInteracao) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "SEM_INTERACAO",
      severidade: "ATENCAO",
      motivo: r.dias === null ? "Nenhuma interação registrada com este cliente" : `${r.dias} dias sem nenhuma interação registrada`,
      fonte: "atividades",
      detalhe: { diasSemInteracao: r.dias },
    });
  }

  // 6. Health check baixo (NPS respondido ao vivo pelo CS).
  const nps = await db.execute<{ empresa_id: string; score: number; respondido_em: string }>(sql`
    WITH alvo AS (${base})
    SELECT DISTINCT ON (alvo.empresa_id) alvo.empresa_id, np.score, np.respondido_em::text
      FROM alvo
      JOIN leads l ON l.empresa_id = alvo.empresa_id
      JOIN nps_respostas np ON np.lead_id = l.id
     WHERE np.tipo = 'health_check' AND np.score IS NOT NULL
       ${filtroEmpresa}
     ORDER BY alvo.empresa_id, np.respondido_em DESC`);
  for (const r of nps) {
    if (r.score > 6) continue;
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "NPS_BAIXO",
      severidade: r.score <= 4 ? "EM_RISCO" : "ATENCAO",
      motivo: `Health check ${r.score}/10 (${r.score <= 4 ? "detrator" : "neutro"})`,
      fonte: "nps_respostas",
      detalhe: { score: r.score, respondidoEm: r.respondido_em },
    });
  }

  // 7. Renovação abrindo e ninguém falou com o cliente nos últimos 30 dias.
  const renovacaoSemContato = await db.execute<{ empresa_id: string; vencimento: string; dias: number }>(sql`
    WITH alvo AS (${base}),
    interacao_empresa AS (
      SELECT COALESCE(a.empresa_id, l.empresa_id) AS empresa_id, a.created_at
        FROM atividades a
        LEFT JOIN leads l ON l.id = a.lead_id
       WHERE COALESCE(a.empresa_id, l.empresa_id) IS NOT NULL
    )
    SELECT DISTINCT ON (alvo.empresa_id) alvo.empresa_id, r.vencimento::text,
           (r.vencimento - CURRENT_DATE)::int AS dias
      FROM alvo
      JOIN cs_renovacoes r ON r.empresa_id = alvo.empresa_id
     WHERE r.status IN ('ABERTA','FUTURA') AND r.vencimento <= CURRENT_DATE + 60
       AND NOT EXISTS (
         SELECT 1 FROM interacao_empresa ie
          WHERE ie.empresa_id = alvo.empresa_id AND ie.created_at > now() - interval '30 days')
       ${filtroEmpresa}
     ORDER BY alvo.empresa_id, r.vencimento`);
  for (const r of renovacaoSemContato) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "RENOVACAO_SEM_CONTATO",
      severidade: r.dias <= 30 ? "EM_RISCO" : "ATENCAO",
      motivo: `Renovação em ${r.dias} dias (${r.vencimento}) sem contato nos últimos 30 dias`,
      fonte: "cs_renovacoes",
      detalhe: { vencimento: r.vencimento, diasAteVencimento: r.dias },
    });
  }

  // 8. Assinatura Stripe irregular. Distinto de FATURA_ATRASADA: a fatura é
  // uma cobrança específica em aberto; isto é o estado da própria assinatura,
  // que o Stripe muda para past_due/unpaid depois de esgotar as tentativas.
  // Medido na base: 18 past_due + 13 unpaid — 31 assinaturas que a régua de
  // faturas sozinha não flagrava.
  const assinaturasIrregulares = await db.execute<{ empresa_id: string; status: string; n: number; produto: string | null; mrr: string }>(sql`
    WITH alvo AS (${base})
    SELECT alvo.empresa_id, a.status, COUNT(*)::int AS n,
           MAX(a.produto) AS produto, COALESCE(SUM(a.mrr), 0)::text AS mrr
      FROM alvo
      JOIN assinaturas a ON a.empresa_id = alvo.empresa_id
     WHERE a.status IN ('past_due', 'unpaid')
       ${filtroEmpresa}
     GROUP BY alvo.empresa_id, a.status`);
  for (const r of assinaturasIrregulares) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "ASSINATURA_INADIMPLENTE",
      // `unpaid` é o estado final do Stripe depois de todas as tentativas —
      // mais grave que `past_due`, que ainda vai tentar de novo.
      severidade: r.status === "unpaid" ? "CRITICO" : "EM_RISCO",
      motivo: `${r.n} assinatura${r.n > 1 ? "s" : ""} Stripe em ${r.status === "unpaid" ? "não paga (tentativas esgotadas)" : "atraso"}${r.produto ? ` — ${r.produto}` : ""} · R$ ${Number(r.mrr).toFixed(2)} de MRR`,
      fonte: "assinaturas:stripe",
      detalhe: { status: r.status, assinaturas: r.n, mrrEmRisco: r.mrr },
    });
  }

  // 9. Pedido de cancelamento em aberto — o sinal mais grave que existe.
  const cancelamentos = await db.execute<{ empresa_id: string; motivo: string; status: string }>(sql`
    WITH alvo AS (${base})
    SELECT DISTINCT ON (alvo.empresa_id) alvo.empresa_id, cc.motivo, cc.status
      FROM alvo
      JOIN cs_cancelamentos cc ON cc.empresa_id = alvo.empresa_id
     WHERE cc.status IN ('SOLICITADO','EM_RETENCAO','APROVADO')
       ${filtroEmpresa}
     ORDER BY alvo.empresa_id, cc.solicitado_em DESC`);
  for (const r of cancelamentos) {
    sinais.push({
      empresaId: r.empresa_id,
      tipo: "PEDIDO_CANCELAMENTO",
      severidade: "CRITICO",
      motivo: `Pedido de cancelamento em aberto (${r.status.toLowerCase()}) — motivo: ${r.motivo}`,
      fonte: "cs_cancelamentos",
      detalhe: { status: r.status, motivo: r.motivo },
    });
  }

  return sinais;
}

/**
 * Reconcilia os riscos automáticos com a realidade: abre o que apareceu,
 * atualiza severidade/motivo do que continua, resolve o que sumiu.
 *
 * Riscos MANUAIS nunca são tocados aqui — quem marcou na mão é quem tira.
 */
export async function reavaliarRiscos(
  organizacaoId: string,
  empresaId?: string,
): Promise<{ abertos: number; atualizados: number; resolvidos: number }> {
  const sinais = await detectarSinais(organizacaoId, empresaId);

  const existentes = await db.select()
    .from(csRiscos)
    .where(and(
      eq(csRiscos.organizacaoId, organizacaoId),
      eq(csRiscos.status, "ABERTO"),
      eq(csRiscos.origem, "AUTOMATICO"),
      empresaId ? eq(csRiscos.empresaId, empresaId) : undefined,
    ));

  const chave = (empresa: string, tipo: string, servico?: string | null) => `${empresa}|${tipo}|${servico ?? ""}`;
  const detectados = new Map(sinais.map((s) => [chave(s.empresaId, s.tipo, s.servicoCanonicoId), s]));
  const abertosPorChave = new Map(existentes.map((r) => [chave(r.empresaId, r.tipo, r.servicoCanonicoId), r]));

  let abertos = 0, atualizados = 0, resolvidos = 0;

  // E3: risco automático nasce com dono = Jenifer (default da carteira).
  const donoPadraoId = await resolveFollowupOwnerId(db, organizacaoId);
  for (const [k, sinal] of detectados) {
    const jaAberto = abertosPorChave.get(k);
    if (jaAberto) {
      // Só escreve se algo de fato mudou — evita `updated_at` girando de hora
      // em hora e poluindo qualquer auditoria por data de alteração.
      if (jaAberto.severidade !== sinal.severidade || jaAberto.motivo !== sinal.motivo) {
        await db.update(csRiscos)
          .set({ severidade: sinal.severidade, motivo: sinal.motivo, detalhe: sinal.detalhe, updatedAt: new Date() })
          .where(eq(csRiscos.id, jaAberto.id));
        atualizados++;
      }
      continue;
    }
    await db.insert(csRiscos).values({
      organizacaoId,
      empresaId: sinal.empresaId,
      servicoCanonicoId: sinal.servicoCanonicoId ?? null,
      tipo: sinal.tipo,
      severidade: sinal.severidade,
      origem: "AUTOMATICO",
      responsavelId: donoPadraoId,
      motivo: sinal.motivo,
      fonte: sinal.fonte,
      detalhe: sinal.detalhe,
    }).onConflictDoNothing();
    abertos++;
  }

  for (const [k, risco] of abertosPorChave) {
    if (detectados.has(k)) continue;
    await db.update(csRiscos)
      .set({
        status: "RESOLVIDO",
        resolvidoEm: new Date(),
        resolucao: "Sinal deixou de existir na reavaliação automática",
        updatedAt: new Date(),
      })
      .where(eq(csRiscos.id, risco.id));
    resolvidos++;
  }

  return { abertos, atualizados, resolvidos };
}

/**
 * Abre um risco manual e, opcionalmente, já cria a tarefa de tratativa.
 * Risco manual sem dono e sem prazo é só um post-it — por isso a tarefa é
 * o default.
 */
export async function marcarRiscoManual(input: {
  organizacaoId: string;
  empresaId: string;
  servicoCanonicoId?: string | null;
  severidade: Severidade;
  motivo: string;
  responsavelId?: string | null;
  abertoPor?: string | null;
  criarTarefa?: boolean;
  prazo?: Date | null;
}) {
  const [risco] = await db.insert(csRiscos).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    servicoCanonicoId: input.servicoCanonicoId ?? null,
    tipo: "MANUAL",
    severidade: input.severidade,
    origem: "MANUAL",
    motivo: input.motivo,
    fonte: "cs_manual",
    responsavelId: input.responsavelId ?? null,
    abertoPor: input.abertoPor ?? null,
  }).returning();

  if (input.criarTarefa !== false) {
    const { id: tarefaId } = await criarTarefaCs({
      organizacaoId: input.organizacaoId,
      empresaId: input.empresaId,
      titulo: `Tratar risco: ${input.motivo.slice(0, 120)}`,
      motivo: "Risco marcado manualmente pelo CS",
      tipo: "cs_risco",
      origem: "RISCO",
      prioridade: input.severidade === "CRITICO" ? "alta" : "media",
      venceEm: input.prazo ?? null,
      usuarioId: input.responsavelId ?? null,
      chaveIdempotencia: `CS_RISCO:${risco.id}`,
    });
    if (tarefaId) {
      await db.update(csRiscos).set({ tarefaId }).where(eq(csRiscos.id, risco.id));
    }
  }
  return risco;
}

export async function resolverRisco(id: string, organizacaoId: string, resolucao: string, usuarioId?: string | null) {
  const [row] = await db.update(csRiscos)
    .set({ status: "RESOLVIDO", resolvidoEm: new Date(), resolvidoPor: usuarioId ?? null, resolucao, updatedAt: new Date() })
    .where(and(eq(csRiscos.id, id), eq(csRiscos.organizacaoId, organizacaoId), eq(csRiscos.status, "ABERTO")))
    .returning();
  return row ?? null;
}

/** Evita "Rótulo: rótulo em minúscula..." quando o motivo já diz a mesma coisa. */
function tituloDaTarefaDeRisco(tipo: TipoRisco, motivo: string): string {
  const rotulo = ROTULO_RISCO[tipo] ?? tipo;
  const inicioDoMotivo = motivo.slice(0, 60).toLowerCase();
  const palavrasDoRotulo = rotulo.toLowerCase().split(" ").filter((p) => p.length > 4);
  const jaDiz = palavrasDoRotulo.length > 0 && palavrasDoRotulo.every((p) => inicioDoMotivo.includes(p));
  return jaDiz ? motivo.slice(0, 160) : `${rotulo}: ${motivo.slice(0, 110)}`;
}

/**
 * Cria tarefa pros riscos automáticos graves que ainda não têm nenhuma.
 * Só CRITICO e EM_RISCO: gerar tarefa pra todo ATENCAO transformaria a
 * fila num relatório e ninguém trataria nada.
 */
export async function gerarTarefasDeRisco(organizacaoId: string): Promise<number> {
  const graves = await db.select()
    .from(csRiscos)
    .where(and(
      eq(csRiscos.organizacaoId, organizacaoId),
      eq(csRiscos.status, "ABERTO"),
      eq(csRiscos.origem, "AUTOMATICO"),
      sql`${csRiscos.severidade} IN ('CRITICO','EM_RISCO')`,
      sql`${csRiscos.tarefaId} IS NULL`,
      // Criar tarefa para "tem tarefa vencida" é tarefa sobre tarefa: a
      // ação já existe e está atrasada, o que falta é fazê-la.
      sql`${csRiscos.tipo} <> 'TAREFA_VENCIDA'`,
    ))
    .limit(300);

  let criadas = 0;
  for (const risco of graves) {
    const { id: tarefaId, criada } = await criarTarefaCs({
      organizacaoId,
      empresaId: risco.empresaId,
      servicoCanonicoId: risco.servicoCanonicoId,
      // O motivo do sinal já é uma frase completa ("3 faturas vencidas em
      // aberto (R$ ...)"), e prefixá-lo com o rótulo produzia "Fatura vencida
      // em aberto: 1 fatura vencida em aberto..." — o mesmo texto duas vezes.
      titulo: tituloDaTarefaDeRisco(risco.tipo as TipoRisco, risco.motivo),
      motivo: risco.motivo,
      tipo: "cs_risco",
      origem: ["FATURA_ATRASADA", "PAGAMENTO_FALHOU", "ASSINATURA_INADIMPLENTE"].includes(risco.tipo) ? "BILLING" : "RISCO",
      prioridade: risco.severidade === "CRITICO" ? "alta" : "media",
      venceEm: new Date(Date.now() + 2 * 86_400_000),
      chaveIdempotencia: `CS_RISCO:${risco.id}`,
    });
    if (tarefaId) await db.update(csRiscos).set({ tarefaId }).where(eq(csRiscos.id, risco.id));
    if (criada) criadas++;
  }
  return criadas;
}

/**
 * A conclusão de marco mora em `lib/cs/checkpoint.ts` desde 08/09: concluir um
 * checkpoint dispara health check, risco, expansão, próxima ação e virada de
 * ciclo, o que é execução de jornada, não motor de risco.
 */
