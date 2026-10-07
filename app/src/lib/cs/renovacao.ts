/**
 * Renovação como processo.
 *
 * Sai da vigência REAL do contrato do serviço. Serviço sem contrato com
 * `vencimento` não ganha renovação — assinatura Stripe sem termo renova
 * sozinha todo mês, e inventar "12 meses a partir do Won" encheria a fila
 * do CS de renovação que não existe.
 *
 * Medido na base ao construir isto: 20 dos 545 contratos ativos têm
 * `vencimento` preenchido. O número é honesto, não um bug daqui — é o
 * tamanho real da cobertura de vigência no CRM hoje.
 */
import { db } from "@/lib/db";
import { csRenovacoes, contratos, servicosCanonicos, tarefas } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { JANELAS_RENOVACAO_DIAS } from "./playbooks";
import { criarTarefaCs } from "./tarefas";

export type StatusRenovacao = "FUTURA" | "ABERTA" | "EM_NEGOCIACAO" | "RENOVADA" | "NAO_RENOVADA";

/** Maior janela configurada — a partir dela a renovação deixa de ser FUTURA. */
const JANELA_ABERTURA = Math.max(...JANELAS_RENOVACAO_DIAS);

/**
 * Cria/atualiza as renovações a partir dos contratos vigentes. Idempotente
 * por `CS_RENOV:<servicoId>:<vencimento>`: incluir o vencimento na chave é
 * o que permite um segundo ciclo nascer quando o contrato é renovado com
 * nova data, sem colidir com o ciclo anterior já decidido.
 */
export async function sincronizarRenovacoes(organizacaoId: string): Promise<{ criadas: number; abertas: number }> {
  const vigentes = await db.select({
    servicoId: servicosCanonicos.id,
    empresaId: servicosCanonicos.empresaId,
    contratoId: contratos.id,
    vencimento: contratos.vencimento,
    valor: servicosCanonicos.currentRecurringValue,
  })
    .from(servicosCanonicos)
    .innerJoin(contratos, eq(contratos.id, servicosCanonicos.contratoId))
    .where(and(
      eq(servicosCanonicos.organizacaoId, organizacaoId),
      eq(servicosCanonicos.commercialLifecycle, "ACTIVE"),
      eq(contratos.status, "ativo"),
      sql`${contratos.vencimento} IS NOT NULL`,
      sql`${servicosCanonicos.empresaId} IS NOT NULL`,
    ));

  let criadas = 0;
  for (const v of vigentes) {
    if (!v.empresaId || !v.vencimento) continue;
    const inserida = await db.insert(csRenovacoes).values({
      organizacaoId,
      empresaId: v.empresaId,
      servicoCanonicoId: v.servicoId,
      contratoId: v.contratoId,
      vencimento: v.vencimento,
      valorAtual: v.valor,
      chaveIdempotencia: `CS_RENOV:${v.servicoId}:${v.vencimento}`,
    }).onConflictDoNothing({ target: [csRenovacoes.organizacaoId, csRenovacoes.chaveIdempotencia] })
      .returning({ id: csRenovacoes.id });
    if (inserida.length > 0) criadas++;
  }

  // Abre a janela. Só toca em FUTURA: renovação que o CS já pôs em
  // negociação ou decidiu não volta pra ABERTA por causa do relógio.
  const abertas = await db.update(csRenovacoes)
    .set({ status: "ABERTA", janelaAbertaEm: new Date(), updatedAt: new Date() })
    .where(and(
      eq(csRenovacoes.organizacaoId, organizacaoId),
      eq(csRenovacoes.status, "FUTURA"),
      sql`${csRenovacoes.vencimento} <= CURRENT_DATE + (${JANELA_ABERTURA})::int`,
    ))
    .returning({ id: csRenovacoes.id });

  return { criadas, abertas: abertas.length };
}

/**
 * Uma tarefa por janela cruzada (90/60/30/15), não uma só no dia 90. O
 * escalonamento é o ponto: a tarefa de 15 dias tem prioridade alta e
 * reaparece na fila mesmo que a de 90 tenha sido concluída.
 */
export async function gerarTarefasDeRenovacao(organizacaoId: string): Promise<number> {
  const emJanela = await db.select({
    id: csRenovacoes.id,
    empresaId: csRenovacoes.empresaId,
    servicoId: csRenovacoes.servicoCanonicoId,
    vencimento: csRenovacoes.vencimento,
    responsavelId: csRenovacoes.responsavelId,
    diasRestantes: sql<number>`(${csRenovacoes.vencimento} - CURRENT_DATE)::int`,
  })
    .from(csRenovacoes)
    .where(and(
      eq(csRenovacoes.organizacaoId, organizacaoId),
      sql`${csRenovacoes.status} IN ('ABERTA','EM_NEGOCIACAO')`,
      sql`${csRenovacoes.vencimento} <= CURRENT_DATE + (${JANELA_ABERTURA})::int`,
    ));

  let criadas = 0;
  for (const r of emJanela) {
    // Janela vigente = a MENOR já cruzada (em D-45 vale a de 60; em D-20, a de 30).
    // Com `.find` sobre [90,60,30,15] o resultado era sempre 90: a tarefa nascia só
    // no D-90, nunca escalava para 60/30/15 e a prioridade "alta" (<=30) jamais valia.
    const janela = JANELAS_RENOVACAO_DIAS.filter((j) => r.diasRestantes <= j).at(-1);
    if (janela === undefined) continue;

    const { criada } = await criarTarefaCs({
      organizacaoId,
      empresaId: r.empresaId,
      servicoCanonicoId: r.servicoId,
      titulo: `Renovação em ${r.diasRestantes} dias (vence ${r.vencimento})`,
      motivo: `Janela de renovação D-${janela}`,
      tipo: "cs_renovacao",
      origem: "RENOVACAO",
      prioridade: janela <= 30 ? "alta" : "media",
      venceEm: new Date(Date.now() + Math.max(1, Math.floor(janela / 4)) * 86_400_000),
      usuarioId: r.responsavelId,
      chaveIdempotencia: `CS_RENOV_TAREFA:${r.id}:${janela}`,
    });
    if (criada) criadas++;
  }
  return criadas;
}

/**
 * Decisão da renovação. RENOVADA com novo vencimento fecha este ciclo e o
 * próximo `sincronizarRenovacoes` abre o seguinte — o histórico do ciclo
 * anterior fica de pé, com o valor que vigorava.
 */
export async function decidirRenovacao(input: {
  id: string; organizacaoId: string; usuarioId?: string | null;
  status: Extract<StatusRenovacao, "EM_NEGOCIACAO" | "RENOVADA" | "NAO_RENOVADA">;
  valorProposto?: string | null;
  novoVencimento?: string | null;
  novoPrazoMeses?: number | null;
  observacoes?: string | null;
  motivoNaoRenovacao?: string | null;
}) {
  /* Sem status válido não há decisão. `input.status !== "EM_NEGOCIACAO"` dava
     `true` para `undefined`: a chamada sem status carimbava `decidido_em` e
     `decidido_por`, concluía a tarefa de janela e deixava a renovação ABERTA —
     "decidida mas aberta", e o CS perdia a pendência da fila (QA 06/10). O
     tipo protege o caller TypeScript; a rota e o JS não. */
  const VALIDOS = ["EM_NEGOCIACAO", "RENOVADA", "NAO_RENOVADA"] as const;
  if (!VALIDOS.includes(input.status)) {
    throw new Error(`decidirRenovacao: status inválido (${String(input.status)}); use ${VALIDOS.join(", ")}`);
  }
  const decidido = input.status !== "EM_NEGOCIACAO";
  const [row] = await db.update(csRenovacoes)
    .set({
      status: input.status,
      valorProposto: input.valorProposto ?? undefined,
      novoVencimento: input.novoVencimento ?? undefined,
      novoPrazoMeses: input.novoPrazoMeses ?? undefined,
      observacoes: input.observacoes ?? undefined,
      motivoNaoRenovacao: input.motivoNaoRenovacao ?? undefined,
      decididoEm: decidido ? new Date() : null,
      decididoPor: decidido ? input.usuarioId ?? null : null,
      updatedAt: new Date(),
    })
    .where(and(eq(csRenovacoes.id, input.id), eq(csRenovacoes.organizacaoId, input.organizacaoId)))
    .returning();

  if (!row) return null;

  // QA pós-venda 06/10: decidida a renovação, a tarefa de janela (D-60/45/30...)
  // seguia aberta e a conta continuava "com pendência" na fila do CS.
  if (decidido) {
    await db.update(tarefas).set({ concluida: true, concluidaEm: new Date() })
      .where(and(
        eq(tarefas.organizacaoId, input.organizacaoId),
        eq(tarefas.concluida, false),
        sql`${tarefas.chaveIdempotencia} LIKE ${`CS_RENOV_TAREFA:${row.id}:%`}`,
      ));
  }

  // Renovada com nova data: o contrato precisa refletir isso, senão o
  // próximo sweep reabre a mesma renovação lendo o vencimento antigo.
  if (input.status === "RENOVADA" && input.novoVencimento && row.contratoId) {
    await db.update(contratos)
      .set({ vencimento: input.novoVencimento, prazoMeses: input.novoPrazoMeses ?? undefined, updatedAt: new Date() })
      .where(eq(contratos.id, row.contratoId));
  }
  return row;
}
