/**
 * AssignOwner/ChangeOwner (19/08, correção de escopo — Responsável precisa
 * ser operacional). A capability de TROCAR responsável já existia — os
 * PATCH genéricos de /leads/:id e /negocios/:id sempre aceitaram
 * `responsavelId` no body. O gap real era duplo: (1) ninguém na UI chamava
 * isso (Responsável aparecia só como texto), e (2) a troca não deixava
 * rastro (sem audit_log, sem actor/timestamp/before/after).
 *
 * Esta função é o ÚNICO lugar que registra a troca — não recria a lógica
 * de update por entidade (cada tabela continua com seu próprio PATCH), só
 * centraliza o rastro de auditoria pra não duplicar isso em N endpoints.
 *
 * **E também propaga o dono para o modelo canônico (21/09).** O update de cada
 * tabela continua onde estava; o que passou a morar aqui é a consequência dele
 * no canônico, porque é aqui que TODA troca de dono passa.
 *
 * O motivo é concreto e foi medido: o board de pré-vendas conta "sem
 * responsável" a partir de `aquisicoes.responsavel_id`, e trocar o dono de um
 * lead escrevia só em `leads`. A pessoa reatribuía, recarregava, e a tela
 * continuava mostrando o dono antigo.
 *
 * A divergência era ZERO no banco, porque o backfill sincronizou os dois lados,
 * e isso escondia o defeito: ele só apareceria na primeira reatribuição depois
 * da carga. Por isso a prova é `smoke-dono-propaga.ts`, que provoca uma troca
 * pela rota de verdade em vez de medir o que já está lá.
 */
import { db as dbPadrao } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auditLog, notificacoes } from "@/lib/db/schema";

/**
 * Instância de banco a usar.
 *
 * O worker cria a PRÓPRIA conexão (`drizzle(pgSql)` no topo de `worker/index.ts`)
 * e por isso `sdr-escalation` recebe `db` por parâmetro em vez de importar. Se
 * esta função importasse a instância da aplicação e fosse chamada de lá, o
 * processo do worker abriria um segundo pool — o tipo de coisa que não aparece
 * em teste e aparece como conexão esgotada no Postgres.
 */
type ExecutorDb = typeof dbPadrao;

export type OwnerEntityType = "lead" | "negocio" | "pessoa" | "fulfillment" | "cliente" | "fulfillment_item";

/**
 * Onde o dono daquela entidade vive no canônico.
 *
 * `pessoa`, `cliente` e os `fulfillment*` já SÃO canônicos: o update deles não
 * tem para onde propagar, e ficam de fora sem exceção escrita à mão.
 */
const DESTINO_CANONICO: Partial<Record<OwnerEntityType, { tabela: string; chave: string }>> = {
  lead: { tabela: "aquisicoes", chave: "lead_legado_id" },
  negocio: { tabela: "oportunidades", chave: "negocio_id_legado" },
};

export async function registrarMudancaResponsavel(opts: {
  organizacaoId: string;
  entityType: OwnerEntityType;
  entityId: string;
  previousOwnerId: string | null;
  newOwnerId: string | null;
  /** Null quando quem trocou foi automação ou o sistema, não uma pessoa. */
  actorId: string | null;
  /** De onde veio a troca. "api" é o default histórico das rotas. */
  source?: "api" | "automation" | "system";
  /** Quem chama de dentro do worker passa a instância dele. Ver `ExecutorDb`. */
  db?: ExecutorDb;
}): Promise<void> {
  const db = opts.db ?? dbPadrao;
  if (opts.previousOwnerId === opts.newOwnerId) return; // sem mudança real, sem ruído no audit

  // O canônico primeiro: se o processo morrer entre as duas escritas, é melhor
  // ter o dono certo sem linha de auditoria do que a auditoria de uma troca que
  // a tela não mostra.
  const destino = DESTINO_CANONICO[opts.entityType];
  if (destino) {
    await db.execute(sql`
      UPDATE ${sql.raw(destino.tabela)}
         SET responsavel_id = ${opts.newOwnerId}::uuid, updated_at = now()
       WHERE ${sql.raw(destino.chave)} = ${opts.entityId}::uuid
         AND organizacao_id = ${opts.organizacaoId}::uuid`);
  }

  await db.insert(auditLog).values({
    organizacaoId: opts.organizacaoId,
    actorId: opts.actorId,
    action: `${opts.entityType}.responsavel_alterado`,
    entityType: opts.entityType,
    entityId: opts.entityId,
    before: { responsavelId: opts.previousOwnerId },
    after: { responsavelId: opts.newOwnerId },
    source: opts.source ?? "api",
  });

  /* O novo responsável é avisado no sininho — antes a troca de dono só ia pro
     audit_log e ninguém sabia que recebeu o lead/negócio. Fire-and-forget. */
  if (opts.newOwnerId && opts.newOwnerId !== opts.actorId) {
    const link = opts.entityType === "lead" ? `/pessoas/${opts.entityId}`
      : opts.entityType === "negocio" ? `/pipeline/${opts.entityId}`
      : opts.entityType === "cliente" ? `/clientes/${opts.entityId}` : "/";
    const rotulo = opts.entityType === "negocio" ? "negócio" : opts.entityType === "lead" ? "lead" : "registro";
    try {
      await db.insert(notificacoes).values({
        usuarioId: opts.newOwnerId,
        tipo: "responsavel_atribuido",
        titulo: `Um ${rotulo} foi atribuído a você`,
        mensagem: `Você é o novo responsável por este ${rotulo}.`,
        link,
      });
    } catch (e) {
      console.error("[owner] falha ao notificar novo responsável:", e);
    }
  }

  /* Gatilho "agente virou responsável": esta é a porta de toda troca de dono de lead, negócio e cliente. */
  if (opts.entityType === "lead" || opts.entityType === "negocio" || opts.entityType === "cliente") {
    const { aoMudarResponsavel } = await import("@/lib/ai-platform/operacao/atribuicoes");
    await aoMudarResponsavel({
      organizacaoId: opts.organizacaoId, entidade: opts.entityType, entidadeId: opts.entityId,
      anteriorId: opts.previousOwnerId, novoId: opts.newOwnerId, ator: { usuarioId: opts.actorId },
    });
  }
}
