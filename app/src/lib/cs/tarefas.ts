/**
 * Criação de tarefa e registro de interação no eixo do CS (empresa).
 *
 * Todas as tarefas automáticas passam por aqui com `chaveIdempotencia`:
 * o sweep horário reavalia a base inteira toda hora e não pode empilhar
 * cópias da mesma tarefa. A chave é determinística (marco, sinal, janela
 * de renovação), nunca um uuid novo.
 */
import { db } from "@/lib/db";
import { tarefas, atividades, clientes, leads, empresas } from "@/lib/db/schema";
import { and, eq, desc, isNull, sql } from "drizzle-orm";

export type OrigemTarefa =
  | "MANUAL" | "PLAYBOOK" | "BILLING" | "ONBOARDING" | "IMPLANTACAO"
  | "RENOVACAO" | "RISCO" | "EXPANSAO" | "AUTOMACAO";

export interface NovaTarefaCs {
  organizacaoId: string;
  empresaId: string;
  titulo: string;
  tipo: string;
  origem: OrigemTarefa;
  descricao?: string | null;
  motivo?: string | null;
  prioridade?: "alta" | "media" | "baixa";
  venceEm?: Date | null;
  servicoCanonicoId?: string | null;
  usuarioId?: string | null;
  /** Presente = tarefa automática, criada no máximo uma vez. */
  chaveIdempotencia?: string | null;
}

/**
 * Resolve quem é o dono da tarefa quando o call site não sabe: o CS owner
 * da conta. Sem owner definido, a tarefa nasce sem responsável e cai no
 * filtro "Sem responsável" — atribuir a um admin aleatório só esconderia
 * o buraco (foi o que o job legado de renovação fazia).
 */
export async function ownerDaConta(empresaId: string): Promise<string | null> {
  const [c] = await db.select({ responsavelId: clientes.responsavelId })
    .from(clientes).where(eq(clientes.empresaId, empresaId)).limit(1);
  return c?.responsavelId ?? null;
}

/** Lead representativo da empresa — só pra manter compatibilidade com as telas que ainda leem tarefa por lead. */
async function leadDaEmpresa(empresaId: string): Promise<string | null> {
  const [l] = await db.select({ id: leads.id }).from(leads)
    .where(eq(leads.empresaId, empresaId)).orderBy(desc(leads.updatedAt)).limit(1);
  return l?.id ?? null;
}

/**
 * Cria a tarefa. Com `chaveIdempotencia`, a segunda chamada não cria nada
 * e devolve `{ criada: false }` com o id existente — quem chama pode
 * distinguir "já existia" de "acabei de criar" sem consultar antes.
 */
export async function criarTarefaCs(input: NovaTarefaCs): Promise<{ id: string | null; criada: boolean }> {
  if (input.chaveIdempotencia) {
    const [existente] = await db.select({ id: tarefas.id }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, input.organizacaoId),
        eq(tarefas.chaveIdempotencia, input.chaveIdempotencia),
      )).limit(1);
    if (existente) return { id: existente.id, criada: false };
  }

  const usuarioId = input.usuarioId ?? (await ownerDaConta(input.empresaId));
  const leadId = await leadDaEmpresa(input.empresaId);

  const [criada] = await db.insert(tarefas).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    servicoCanonicoId: input.servicoCanonicoId ?? null,
    leadId,
    usuarioId,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    motivo: input.motivo ?? null,
    tipo: input.tipo,
    origem: input.origem,
    prioridade: input.prioridade ?? "media",
    venceEm: input.venceEm ?? null,
    dataVencimento: input.venceEm ? input.venceEm.toISOString().slice(0, 10) : null,
    chaveIdempotencia: input.chaveIdempotencia ?? null,
  })
    // Corrida entre dois workers no mesmo sweep: o índice único resolve,
    // e o SELECT abaixo devolve quem ganhou.
    .onConflictDoNothing()
    .returning({ id: tarefas.id });

  if (criada) return { id: criada.id, criada: true };

  if (input.chaveIdempotencia) {
    const [existente] = await db.select({ id: tarefas.id }).from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, input.organizacaoId),
        eq(tarefas.chaveIdempotencia, input.chaveIdempotencia),
      )).limit(1);
    return { id: existente?.id ?? null, criada: false };
  }
  return { id: null, criada: false };
}

export interface NovaInteracao {
  organizacaoId: string;
  empresaId: string;
  tipo: string;              // ligacao | reuniao | whatsapp | email | nota
  titulo?: string | null;
  descricao?: string | null;
  usuarioId?: string | null;
  dados?: Record<string, unknown> | null;
}

/**
 * Registra interação de CS em `atividades` — a MESMA tabela da timeline
 * comercial, de propósito: o Cliente 360 mostra uma linha do tempo única.
 * Escreve `empresaId` (novo em 08/09) e também o lead representativo,
 * pra que as telas que ainda leem por lead continuem vendo o registro.
 */
export async function registrarInteracao(input: NovaInteracao): Promise<{ id: string }> {
  const leadId = await leadDaEmpresa(input.empresaId);
  const [row] = await db.insert(atividades).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    leadId,
    usuarioId: input.usuarioId ?? null,
    tipo: input.tipo,
    titulo: input.titulo ?? null,
    descricao: input.descricao ?? null,
    dados: input.dados ?? null,
  }).returning({ id: atividades.id });
  return { id: row.id };
}

/** Empresas da carteira sem CS owner — visão "Sem responsável". */
export async function contasSemOwner(organizacaoId: string) {
  return db.select({ empresaId: clientes.empresaId, nome: empresas.nome })
    .from(clientes)
    .innerJoin(empresas, eq(empresas.id, clientes.empresaId))
    .where(and(eq(clientes.organizacaoId, organizacaoId), isNull(clientes.responsavelId)));
}


// ───────────────────────────────────────────────────────────────────────────
// Tarefa AUTOMÁTICA que acompanha um fato vivo (silêncio de uso, queda, teto…).
//
// `criarTarefaCs` com chave de idempotência cria no máximo UMA vez para sempre;
// isso serve a marco e renovação, que acontecem uma vez. Um fato que dura dias
// e some quando o cliente volta precisa de outro ciclo de vida:
//
//   uma tarefa ABERTA por empresa e motivo → o fato novo ATUALIZA a aberta;
//   o motivo some → ela se FECHA sozinha, registrando o fato;
//   fechada por uma PESSOA → período de respiro antes de a regra reabrir.
// ───────────────────────────────────────────────────────────────────────────

export interface TarefaAutomaticaAberta {
  id: string; titulo: string; descricao: string | null; prioridade: string; venceEm: Date | null;
  usuarioId: string | null; createdAt: Date;
}

/** A tarefa automática ainda viva (nem concluída nem declinada) desta empresa e deste tipo. */
export async function tarefaAutomaticaAberta(organizacaoId: string, empresaId: string, tipo: string): Promise<TarefaAutomaticaAberta | null> {
  const [r] = await db.execute<{
    id: string; titulo: string; descricao: string | null; prioridade: string; vence_em: Date | null;
    usuario_id: string | null; created_at: Date;
  }>(sql`
    SELECT id::text, titulo, descricao, prioridade, vence_em, usuario_id::text, created_at
      FROM tarefas
     WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
       AND tipo = ${tipo} AND origem = 'AUTOMACAO'
       AND concluida = false AND status NOT IN ('concluida', 'declinada')
     ORDER BY created_at DESC LIMIT 1`);
  return r ? { id: r.id, titulo: r.titulo, descricao: r.descricao, prioridade: r.prioridade, venceEm: r.vence_em,
    usuarioId: r.usuario_id, createdAt: r.created_at } : null;
}

/** Uma PESSOA fechou tarefa deste tipo nos últimos `dias` dias? (Fechamento automático não conta.) */
export async function fechadaPorPessoaRecentemente(organizacaoId: string, empresaId: string, tipo: string, dias: number): Promise<boolean> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM tarefas
     WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
       AND tipo = ${tipo} AND origem = 'AUTOMACAO'
       AND (concluida = true OR status IN ('concluida', 'declinada'))
       AND coalesce(chave_idempotencia, '') NOT LIKE '%:auto-fechada'
       AND coalesce(concluida_em, created_at) > now() - make_interval(days => ${dias})`);
  return (r?.n ?? 0) > 0;
}

async function fatoDaTarefa(organizacaoId: string, tarefaId: string, tipo: "TaskStatusChanged" | "TaskRescheduled" | "TaskCreated", payload: Record<string, unknown>) {
  try {
    await db.execute(sql`
      INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id, actor_type, source, payload)
      VALUES (${organizacaoId}::uuid, ${tipo}, 'tarefa', ${tarefaId}::uuid, 'AUTOMATION', 'callface_ai_saude',
              ${JSON.stringify({ ...payload, via: "callface_ai_saude" })}::jsonb)`);
  } catch (e) {
    console.error(`[tarefas] fato ${tipo} não registrado:`, e);
  }
}

/** Atualiza título, corpo, prioridade e (se pedido) o prazo da tarefa aberta. Só grava o que mudou. */
export async function atualizarTarefaAutomatica(
  organizacaoId: string, atual: TarefaAutomaticaAberta,
  novo: { titulo: string; descricao: string; prioridade: string; venceEm?: Date | null },
): Promise<boolean> {
  const mudou = atual.titulo !== novo.titulo || (atual.descricao ?? "") !== novo.descricao || atual.prioridade !== novo.prioridade
    || (novo.venceEm !== undefined && (novo.venceEm?.getTime() ?? null) !== (atual.venceEm?.getTime() ?? null));
  if (!mudou) return false;
  await db.execute(sql`
    UPDATE tarefas SET titulo = ${novo.titulo}, descricao = ${novo.descricao}, prioridade = ${novo.prioridade}
          ${novo.venceEm !== undefined ? sql`, vence_em = ${novo.venceEm ? novo.venceEm.toISOString() : null}::timestamptz,
            data_vencimento = ${novo.venceEm ? novo.venceEm.toISOString().slice(0, 10) : null}::date` : sql``}
     WHERE id = ${atual.id}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  if (atual.prioridade !== novo.prioridade) {
    await fatoDaTarefa(organizacaoId, atual.id, "TaskStatusChanged", { prioridadeDe: atual.prioridade, prioridadePara: novo.prioridade, titulo: novo.titulo });
  }
  return true;
}

/**
 * Fecha a tarefa porque o motivo acabou, deixando o fato escrito nela.
 * A chave de idempotência ganha o sufixo `:auto-fechada`: marca que NÃO foi uma
 * pessoa (não gera período de respiro) e libera a chave.
 */
export async function fecharTarefaAutomatica(organizacaoId: string, tarefaId: string, fato: string): Promise<void> {
  await db.execute(sql`
    UPDATE tarefas
       SET concluida = true, concluida_em = now(), status = 'concluida',
           descricao = coalesce(descricao, '') || E'\n\n— Fechada automaticamente: ' || ${fato},
           chave_idempotencia = coalesce(chave_idempotencia, 'auto:' || id::text) || ':auto-fechada'
     WHERE id = ${tarefaId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND concluida = false`);
  await fatoDaTarefa(organizacaoId, tarefaId, "TaskStatusChanged", { de: "aberta", para: "concluida", automatica: true, fato });
}
