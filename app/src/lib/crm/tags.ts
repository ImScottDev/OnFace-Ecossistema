/**
 * A porta única de tag (Documento Mestre v0.13, Módulo 01 §9.3).
 *
 * "Tags são comportamento operacional, não decoração. Adicionar/remover tag
 * deve gerar evento estruturado — TagAdded / TagRemoved — e poder disparar
 * automações."
 *
 * POR QUE ESTE ARQUIVO EXISTE. A mesma lógica estava escrita DUAS vezes:
 * `cadencia/cadence-engine.ts::mutateTag` e `ai-platform/tools/registry.ts`.
 * As duas publicam o evento, as duas mexem em três tabelas, e a segunda só
 * sabe lidar com lead. Escrever a ação em massa por fora faria a terceira, e
 * duas cópias da mesma regra divergem em silêncio — é o defeito que este
 * refactor existe para acabar.
 *
 * AS TRÊS TABELAS, e por que todas: `entity_labels` é a canônica e vale para
 * qualquer entidade; `lead_labels` e `contato_labels` são as legadas, lidas
 * pelas telas antigas. Escrever só a canônica faria a tag sumir no CRM2 antes
 * da substituição.
 */
import { db } from "@/lib/db";
import { labels, entityLabels, leadLabels, contatoLabels, negocioLabels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { publicarEvento } from "@/lib/events/outbox";

export type EntidadeComTag = "lead" | "contato" | "empresa" | "negocio" | "oportunidade";

export interface ResultadoTag {
  ok: boolean;
  /** false quando a tag já estava (ou já não estava): não é erro, é no-op. */
  mudou: boolean;
  labelId?: string;
  erro?: string;
}

async function resolverLabel(organizacaoId: string, labelIdOuNome: string) {
  const [porId] = await db.select({ id: labels.id, nome: labels.nome })
    .from(labels)
    .where(and(eq(labels.id, labelIdOuNome), eq(labels.organizacaoId, organizacaoId)))
    .limit(1)
    .catch(() => []);
  if (porId) return porId;
  const [porNome] = await db.select({ id: labels.id, nome: labels.nome })
    .from(labels)
    .where(and(eq(labels.nome, labelIdOuNome), eq(labels.organizacaoId, organizacaoId)))
    .limit(1);
  return porNome ?? null;
}

export async function adicionarTag(opts: {
  organizacaoId: string;
  entityType: EntidadeComTag;
  entityId: string;
  /** Id da tag, ou o nome quando o chamador só tem isso. */
  label: string;
}): Promise<ResultadoTag> {
  const label = await resolverLabel(opts.organizacaoId, opts.label);
  if (!label) return { ok: false, mudou: false, erro: "tag não encontrada nesta organização" };

  const [assignment] = await db.insert(entityLabels)
    .values({
      organizacaoId: opts.organizacaoId, entityType: opts.entityType,
      entityId: opts.entityId, labelId: label.id,
    })
    .onConflictDoNothing()
    .returning({ id: entityLabels.id });

  // Espelho legado: as telas do CRM2 leem destas duas.
  if (opts.entityType === "lead") {
    await db.insert(leadLabels).values({ leadId: opts.entityId, labelId: label.id }).onConflictDoNothing();
  }
  if (opts.entityType === "contato") {
    await db.insert(contatoLabels).values({ contatoId: opts.entityId, labelId: label.id }).onConflictDoNothing();
  }
  // O board legado do CRM2 (/pipeline-crm2/board) lê de `negocio_labels`.
  if (opts.entityType === "negocio") {
    await db.insert(negocioLabels).values({ negocioId: opts.entityId, labelId: label.id }).onConflictDoNothing();
  }

  // Evento só quando MUDOU. Publicar em no-op faria a automação disparar de
  // novo a cada reexecução de cadência.
  if (assignment) {
    await publicarEvento({
      organizacaoId: opts.organizacaoId, eventType: "TagAdded",
      aggregateType: opts.entityType as "lead", aggregateId: opts.entityId,
      payload: { entityType: opts.entityType, entityId: opts.entityId, labelId: label.id, tag: label.nome },
      idempotencyKey: `tag:add:${assignment.id}`,
    });
  }
  return { ok: true, mudou: Boolean(assignment), labelId: label.id };
}

export async function removerTag(opts: {
  organizacaoId: string;
  entityType: EntidadeComTag;
  entityId: string;
  label: string;
}): Promise<ResultadoTag> {
  const label = await resolverLabel(opts.organizacaoId, opts.label);
  if (!label) return { ok: false, mudou: false, erro: "tag não encontrada nesta organização" };

  const [removed] = await db.delete(entityLabels)
    .where(and(
      eq(entityLabels.organizacaoId, opts.organizacaoId),
      eq(entityLabels.entityType, opts.entityType),
      eq(entityLabels.entityId, opts.entityId),
      eq(entityLabels.labelId, label.id),
    ))
    .returning({ id: entityLabels.id });

  if (opts.entityType === "lead") {
    await db.delete(leadLabels).where(and(eq(leadLabels.leadId, opts.entityId), eq(leadLabels.labelId, label.id)));
  }
  if (opts.entityType === "contato") {
    await db.delete(contatoLabels).where(and(eq(contatoLabels.contatoId, opts.entityId), eq(contatoLabels.labelId, label.id)));
  }
  if (opts.entityType === "negocio") {
    await db.delete(negocioLabels).where(and(eq(negocioLabels.negocioId, opts.entityId), eq(negocioLabels.labelId, label.id)));
  }

  if (removed) {
    await publicarEvento({
      organizacaoId: opts.organizacaoId, eventType: "TagRemoved",
      aggregateType: opts.entityType as "lead", aggregateId: opts.entityId,
      payload: { entityType: opts.entityType, entityId: opts.entityId, labelId: label.id, tag: label.nome },
      idempotencyKey: `tag:remove:${removed.id}`,
    });
  }
  return { ok: true, mudou: Boolean(removed), labelId: label.id };
}
