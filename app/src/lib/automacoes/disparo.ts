/**
 * Gatilhos dos Fluxos (docs/produto/automacoes-fluxos.md §3): evento da
 * plataforma (outbox OU gatilho legado, nunca os dois), agenda e tarefa
 * vencida. O webhook e o "Rodar agora" chamam `iniciarExecucao` direto.
 *
 * Tudo aqui é best-effort por fluxo: uma automação quebrada não impede as
 * outras e nunca derruba quem publicou o fato.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { automacoes, automacaoVersoes, automacaoExecucoes } from "@/lib/db/schema";
import { EVENTOS_PLATAFORMA, avaliarRegras, type TipoEntidade } from "./grafo";
import { estadoVazio, hidratarContexto, origemAutomacao, type EntidadeRef } from "./contexto";
import { configDaVersao, iniciarExecucao, profundidadeParaEvento, retomarDevidas } from "./executor";
import { proximaExecucao } from "./agenda";

type Regra = Parameters<typeof avaliarRegras>[0][number];

interface EventoOutbox {
  id: string;
  organizacaoId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}

const ENTIDADES = new Set<string>(["lead", "negocio", "oportunidade", "contato", "empresa", "cliente", "servico"]);
const CHAVES: Record<string, string[]> = {
  lead: ["leadId", "lead_id", "lead_legado_id"], negocio: ["negocioId", "negocio_id", "negocio_legado_id", "dealId"], contato: ["contatoId", "contato_id"],
  oportunidade: ["oportunidadeId", "oportunidade_id"], cliente: ["clienteId", "cliente_id"], empresa: ["empresaId", "empresa_id"], servico: ["servicoId", "servico_id", "servicoCanonicoId"],
};
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/**
 * Registro sobre o qual o fluxo roda. Evento canônico de oportunidade/aquisição
 * é traduzido para o id legado (negócio/lead): é ele que os adapters, o board e
 * as telas conhecem.
 */
export function entidadeDoEvento(evento: Pick<EventoOutbox, "aggregateType" | "aggregateId" | "payload">, alvo: TipoEntidade): EntidadeRef | null {
  const p = (evento.payload ?? {}) as Record<string, unknown>;
  if (evento.aggregateType === "oportunidade" && uuid(p.negocio_legado_id)) return { tipo: "negocio", id: p.negocio_legado_id };
  if (evento.aggregateType === "aquisicao" && uuid(p.lead_legado_id)) return { tipo: "lead", id: p.lead_legado_id };
  if (typeof p.entityType === "string" && ENTIDADES.has(p.entityType) && uuid(p.entityId)) return { tipo: p.entityType as TipoEntidade, id: p.entityId };
  if (ENTIDADES.has(evento.aggregateType) && uuid(evento.aggregateId)) return { tipo: evento.aggregateType as TipoEntidade, id: evento.aggregateId };
  for (const k of CHAVES[alvo] ?? []) if (uuid(p[k])) return { tipo: alvo, id: p[k] as string };
  return null;
}

/** Payload do evento em {{ gatilho.* }}, com os nomes que o catálogo promete. */
export function payloadDoGatilho(eventType: string, payload: Record<string, unknown>): Record<string, unknown> {
  // O board grava OpportunityStageChanged com `de`/`para`; o catálogo fala status/statusAnterior.
  if (eventType === "OpportunityStageChanged") return { ...payload, status: payload.para ?? null, statusAnterior: payload.de ?? null };
  return payload;
}

interface FluxoAtivo { automacaoId: string; versaoId: string; trigger: Record<string, unknown>; settings: unknown }

async function fluxosAtivos(organizacaoId: string | null, filtro: ReturnType<typeof sql>): Promise<(FluxoAtivo & { organizacaoId: string })[]> {
  const rows = await db.select({ automacaoId: automacoes.id, organizacaoId: automacoes.organizacaoId, versaoId: automacaoVersoes.id, trigger: automacaoVersoes.triggerConfig, settings: automacaoVersoes.settings })
    .from(automacoes)
    .innerJoin(automacaoVersoes, eq(automacaoVersoes.id, automacoes.currentVersionId))
    .where(and(eq(automacoes.tipo, "fluxo"), eq(automacoes.ativo, true), organizacaoId ? eq(automacoes.organizacaoId, organizacaoId) : undefined, filtro));
  return rows.map((r) => ({ ...r, trigger: (r.trigger ?? {}) as Record<string, unknown> }));
}

/** Já existe execução desta automação, neste registro, nos últimos 60 s, vinda de um evento IRMÃO (outro tipo, mesmo fato)? O evento fica em `estado.gatilho._evento`. */
async function fatoJaDisparado(automacaoId: string, entidadeId: string, origem: { id: string; irmaos: string[] }): Promise<boolean> {
  if (origem.irmaos.length < 2) return false;
  const [ja] = await db.select({ id: automacaoExecucoes.id }).from(automacaoExecucoes)
    .where(and(
      eq(automacaoExecucoes.automacaoId, automacaoId), eq(automacaoExecucoes.entityId, entidadeId),
      sql`${automacaoExecucoes.executedAt} > now() - interval '60 seconds'`,
      sql`${automacaoExecucoes.estado}->'gatilho'->'_evento'->>'id' <> ${origem.id}`,
      sql`${automacaoExecucoes.estado}->'gatilho'->'_evento'->>'tipo' IN ${origem.irmaos}`,
    )).limit(1);
  return Boolean(ja);
}

async function dispararParaEventos(args: {
  organizacaoId: string; eventoIds: string[]; entidade: EntidadeRef | null; payload: Record<string, unknown>;
  chave: (automacaoId: string) => string | null;
  /** Evento de origem + os tipos do outbox que carregam o MESMO fato (ex.: LeadCreated e AcquisitionCreated). */
  origem?: { id: string; irmaos: string[] };
}): Promise<number> {
  if (!args.eventoIds.length) return 0;
  const fluxos = await fluxosAtivos(args.organizacaoId, sql`${automacaoVersoes.triggerConfig}->>'modo' = 'evento' AND ${automacaoVersoes.triggerConfig}->>'evento' IN ${args.eventoIds}`);
  if (!fluxos.length) return 0;
  // Todo evento do catálogo tem entidade; sem registro achável, nenhum bloco
  // que exige registro conseguiria rodar. Melhor não começar do que falhar no meio.
  if (!args.entidade) return 0;
  const ctx = await hidratarContexto(args.organizacaoId, args.entidade, estadoVazio(args.payload));
  if (!ctx.registro) return 0; // registro de outra organização ou apagado

  let n = 0;
  for (const f of fluxos) {
    try {
      const profundidade = profundidadeParaEvento(args.payload, f.automacaoId, f.trigger.permitirOrigemAutomacao === true);
      if (profundidade === null) continue;
      const filtros = (f.trigger.filtros as Regra[] | undefined) ?? [];
      if (filtros.length && !avaliarRegras(filtros, "e", ctx)) continue;
      // Uma ação do usuário grava o fato em dois tipos de evento (legado e canônico).
      // Sem isto a mesma automação rodava duas vezes: duas tarefas, duas mensagens.
      if (args.origem && await fatoJaDisparado(f.automacaoId, args.entidade.id, args.origem)) continue;
      const r = await iniciarExecucao({
        automacaoId: f.automacaoId, organizacaoId: args.organizacaoId, versaoId: f.versaoId, modo: "evento",
        entidade: args.entidade, payload: args.payload, idempotencyKey: args.chave(f.automacaoId), profundidade,
      });
      if ("execucaoId" in r && !r.replay) n++;
    } catch (e) {
      console.error(`[fluxos] falha ao disparar automação ${f.automacaoId} (best-effort):`, e);
    }
  }
  return n;
}

/** Chamado pelo consumer do outbox, logo depois do dispatcher das cadências. */
export async function dispararFluxosPorEvento(evento: EventoOutbox): Promise<number> {
  const ids = EVENTOS_PLATAFORMA.filter((e) => e.fontes.outbox?.includes(evento.eventType));
  if (!ids.length) return 0;
  const bruto = (evento.payload ?? {}) as Record<string, unknown>;
  // Criar oportunidade também grava OpportunityStageChanged (de = null): isso
  // é "Negócio criado", não mudança de etapa.
  if (evento.eventType === "OpportunityStageChanged" && !bruto.de) return 0;
  // `_evento` identifica o fato no estado da execução (barra o disparo em dobro e deixa rastro para relatório).
  const payload = { ...payloadDoGatilho(evento.eventType, (evento.payload ?? {}) as Record<string, unknown>), _evento: { id: evento.id, tipo: evento.eventType } };
  return dispararParaEventos({
    organizacaoId: evento.organizacaoId, eventoIds: ids.map((e) => e.id),
    entidade: entidadeDoEvento(evento, ids[0].entidade), payload,
    chave: (a) => `evento:${a}:${evento.id}`,
    origem: { id: evento.id, irmaos: [...new Set(ids.flatMap((e) => e.fontes.outbox ?? []))] },
  });
}

/**
 * Chamado no fim de `dispararAutomacoes` (motor antigo). Só para os gatilhos
 * cujo fato NÃO passa pelo outbox (`fontes.legado`): os que também viram
 * evento de outbox chegam por lá, e ouvir os dois dispararia em dobro.
 */
export async function dispararFluxosPorGatilhoLegado(gatilho: string, ctx: { organizacaoId: string; entityType: string; entityId: string; campos: Record<string, unknown> }): Promise<number> {
  const ids = EVENTOS_PLATAFORMA.filter((e) => e.fontes.legado === gatilho);
  if (!ids.length || !ENTIDADES.has(ctx.entityType)) return 0;
  // Fato produzido dentro de um nó de automação: carimba como o outbox faz.
  const origem = origemAutomacao.getStore();
  const payload = origem ? { ...ctx.campos, _automacao: origem } : ctx.campos;
  return dispararParaEventos({
    organizacaoId: ctx.organizacaoId, eventoIds: ids.map((e) => e.id),
    entidade: { tipo: ctx.entityType as TipoEntidade, id: ctx.entityId }, payload, chave: () => null,
  });
}

// ─── Agenda ────────────────────────────────────────────────────────────────

/** Registros do "para cada" do agendado. Filtros só da allowlist, sempre com organização, teto 500. */
async function alvosDaAgenda(organizacaoId: string, t: Record<string, unknown>): Promise<string[]> {
  const alvo = t.alvo === "negocio" ? "negocio" : "lead";
  const etapa = typeof t.alvoEtapa === "string" && t.alvoEtapa ? t.alvoEtapa : null;
  const tag = uuid(t.alvoTag) ? t.alvoTag : null;
  const resp = uuid(t.alvoResponsavelId) ? t.alvoResponsavelId : null;
  const dias = Number(t.alvoParadoHaDias) > 0 ? Math.floor(Number(t.alvoParadoHaDias)) : null;
  const rows = alvo === "lead"
    ? await db.execute<{ id: string }>(sql`
        SELECT l.id FROM leads l WHERE l.organizacao_id = ${organizacaoId}::uuid
          ${etapa ? sql`AND l.estagio_pre_vendas = ${etapa}` : sql``}
          ${tag ? sql`AND (EXISTS (SELECT 1 FROM lead_labels x WHERE x.lead_id = l.id AND x.label_id = ${tag}::uuid)
                       OR EXISTS (SELECT 1 FROM entity_labels x WHERE x.entity_type = 'lead' AND x.entity_id = l.id AND x.label_id = ${tag}::uuid))` : sql``}
          ${resp ? sql`AND l.responsavel_id = ${resp}::uuid` : sql``}
          ${dias ? sql`AND l.updated_at < now() - make_interval(days => ${dias})` : sql``}
        ORDER BY l.updated_at LIMIT 500`)
    : await db.execute<{ id: string }>(sql`
        SELECT n.id FROM negocios n WHERE n.organizacao_id = ${organizacaoId}::uuid
          ${etapa ? sql`AND n.etapa = ${etapa}` : sql`AND COALESCE(n.etapa, '') NOT IN ('ganho', 'perdido')`}
          ${tag ? sql`AND EXISTS (SELECT 1 FROM entity_labels x WHERE x.entity_type = 'negocio' AND x.entity_id = n.id AND x.label_id = ${tag}::uuid)` : sql``}
          ${resp ? sql`AND n.responsavel_id = ${resp}::uuid` : sql``}
          ${dias ? sql`AND n.updated_at < now() - make_interval(days => ${dias})` : sql``}
        ORDER BY n.updated_at LIMIT 500`);
  return (rows as unknown as { id: string }[]).map((r) => r.id);
}

export async function dispararAgendados(): Promise<number> {
  const devidos = await db.select({ id: automacoes.id, organizacaoId: automacoes.organizacaoId, versaoId: automacoes.currentVersionId, proxima: automacoes.proximaExecucaoEm, trigger: automacaoVersoes.triggerConfig, settings: automacaoVersoes.settings })
    .from(automacoes)
    .innerJoin(automacaoVersoes, eq(automacaoVersoes.id, automacoes.currentVersionId))
    .where(and(eq(automacoes.tipo, "fluxo"), eq(automacoes.ativo, true), sql`${automacoes.proximaExecucaoEm} <= now()`))
    .limit(50);
  let n = 0;
  for (const a of devidos) {
    try {
      const trigger = (a.trigger ?? {}) as Record<string, unknown>;
      const fuso = configDaVersao(a.settings).fuso;
      const proxima = trigger.modo === "agendado" ? proximaExecucao(trigger, fuso, new Date()) : null;
      // O UPDATE condicional é o claim: dois workers leem o mesmo slot, só um o move.
      const [claim] = await db.update(automacoes).set({ proximaExecucaoEm: proxima })
        .where(and(eq(automacoes.id, a.id), eq(automacoes.proximaExecucaoEm, a.proxima!))).returning({ id: automacoes.id });
      if (!claim || trigger.modo !== "agendado") continue;
      const slot = a.proxima!.toISOString();
      const base = { automacaoId: a.id, organizacaoId: a.organizacaoId, versaoId: a.versaoId!, modo: "agendado" as const, payload: { agendadoPara: slot } };
      if (!trigger.alvo || trigger.alvo === "nenhuma") {
        await iniciarExecucao({ ...base, entidade: null, idempotencyKey: `agenda:${a.id}:${slot}` });
        n++;
        continue;
      }
      const tipo = trigger.alvo === "negocio" ? "negocio" : "lead";
      for (const id of await alvosDaAgenda(a.organizacaoId, trigger)) {
        try {
          const r = await iniciarExecucao({ ...base, entidade: { tipo, id }, idempotencyKey: `agenda:${a.id}:${slot}:${id}` });
          if ("execucaoId" in r) n++;
        } catch (e) {
          console.error(`[fluxos] agenda ${a.id}: falha no registro ${id} (best-effort):`, e);
        }
      }
    } catch (e) {
      console.error(`[fluxos] falha no agendado ${a.id} (best-effort):`, e);
    }
  }
  return n;
}

// ─── Tarefa vencida ────────────────────────────────────────────────────────

/** Varre só quando há fluxo ativo ouvindo `tarefa.vencida`; janela das últimas 24 h. */
export async function dispararTarefasVencidas(): Promise<number> {
  const fluxos = await fluxosAtivos(null, sql`${automacaoVersoes.triggerConfig}->>'modo' = 'evento' AND ${automacaoVersoes.triggerConfig}->>'evento' = 'tarefa.vencida'`);
  let n = 0;
  for (const f of fluxos) {
    try {
      const tarefas = (await db.execute<{ id: string; titulo: string; lead_id: string | null; negocio_id: string | null }>(sql`
        SELECT id, titulo, lead_id, negocio_id FROM tarefas
         WHERE organizacao_id = ${f.organizacaoId}::uuid AND concluida = false AND status <> 'concluida'
           AND vence_em BETWEEN now() - interval '24 hours' AND now()
         LIMIT 500`)) as unknown as { id: string; titulo: string; lead_id: string | null; negocio_id: string | null }[];
      const filtros = (f.trigger.filtros as Regra[] | undefined) ?? [];
      for (const t of tarefas) {
        const entidade: EntidadeRef | null = t.lead_id ? { tipo: "lead", id: t.lead_id } : t.negocio_id ? { tipo: "negocio", id: t.negocio_id } : null;
        if (!entidade) continue;
        const payload = { titulo: t.titulo, tarefaId: t.id };
        if (filtros.length) {
          const ctx = await hidratarContexto(f.organizacaoId, entidade, estadoVazio(payload));
          if (!avaliarRegras(filtros, "e", ctx)) continue;
        }
        const r = await iniciarExecucao({
          automacaoId: f.automacaoId, organizacaoId: f.organizacaoId, versaoId: f.versaoId, modo: "evento",
          entidade, payload, idempotencyKey: `tarefa_vencida:${f.automacaoId}:${t.id}`,
        });
        if ("execucaoId" in r && !r.replay) n++;
      }
    } catch (e) {
      console.error(`[fluxos] falha na varredura de tarefas vencidas de ${f.automacaoId} (best-effort):`, e);
    }
  }
  return n;
}

/** Job `fluxos-sweep` do worker, a cada minuto: agendados, tarefas vencidas, retomadas. */
export async function sweepFluxos(): Promise<{ agendados: number; tarefas: number; retomadas: number }> {
  const agendados = await dispararAgendados().catch((e) => { console.error("[fluxos] sweep agendados:", e); return 0; });
  const tarefas = await dispararTarefasVencidas().catch((e) => { console.error("[fluxos] sweep tarefas:", e); return 0; });
  const retomadas = await retomarDevidas().catch((e) => { console.error("[fluxos] sweep retomadas:", e); return 0; });
  return { agendados, tarefas, retomadas };
}
