/**
 * F1 (Domain Model) — sincronização incremental legado -> schema novo.
 *
 * Mesma lógica do backfill (`lib/db/backfill-domain-model.ts`), mas por
 * registro único e idempotente por `leadIdLegado`/`negocioIdLegado` — usada
 * pelas rotas reais (dual-write) em vez de duplicar a regra de negócio em
 * cada handler (a mesma lição da auditoria: regra duplicada em 2 lugares é
 * exatamente como o bug de MRR nasceu).
 *
 * Nunca lança erro que quebre o fluxo legado — dual-write é best-effort
 * (loga e segue); o legado continua sendo a fonte de verdade até a F8.
 */
import { db } from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  leads,
  negocios,
  pessoas,
  pontosContato,
  oportunidades,
  clientes,
} from "@/lib/db/schema";

type TipoOrigem = "manual" | "organica" | "indicacao" | "sdr" | "importacao" | "campanha";

function classificarOrigem(origem: string | null, utmSource: string | null): TipoOrigem {
  const o = (origem || "").toLowerCase();
  if (utmSource) return "campanha";
  if (o.includes("indica")) return "indicacao";
  if (o.includes("manual") || o.includes("cadastro")) return "manual";
  if (o.includes("import")) return "importacao";
  if (o.includes("sdr") || o.includes("outreach") || o.includes("apollo")) return "sdr";
  return "organica";
}

/**
 * Sincroniza Pessoa + Ponto de Contato (+ Cliente, se aplicável) a partir de
 * um Lead legado. Idempotente: se já existe `pessoas.leadIdLegado = leadId`,
 * atualiza os campos em vez de duplicar. Retorna o pessoaId (ou null se o
 * lead não existir mais / falha não-crítica).
 */
export async function syncPessoaFromLead(leadId: string): Promise<string | null> {
  try {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return null;

    const [jaSincronizada] = await db
      .select({ id: pessoas.id })
      .from(pessoas)
      .where(eq(pessoas.leadIdLegado, leadId))
      .limit(1);

    let pessoaId: string;

    if (jaSincronizada) {
      // Já existe pra ESTE lead específico — só atualiza os campos (não
      // cria touchpoint novo, nada mudou de origem, só dado de perfil).
      pessoaId = jaSincronizada.id;
      await db
        .update(pessoas)
        .set({
          empresaId: lead.empresaId,
          nome: lead.nome,
          email: lead.email,
          telefone: lead.telefone,
          whatsapp: lead.whatsapp,
          cargo: lead.cargo,
          updatedAt: new Date(),
        })
        .where(eq(pessoas.id, pessoaId));
    } else {
      // Novo lead — checa dedup por e-mail (reengajamento de pessoa existente).
      const emailNorm = lead.email?.trim().toLowerCase() || null;
      let pessoaExistente: { id: string } | undefined;
      if (emailNorm) {
        [pessoaExistente] = await db
          .select({ id: pessoas.id })
          .from(pessoas)
          .where(and(eq(pessoas.organizacaoId, lead.organizacaoId), sql`lower(${pessoas.email}) = ${emailNorm}`))
          .limit(1);
      }

      if (pessoaExistente) {
        pessoaId = pessoaExistente.id;
      } else {
        const [nova] = await db
          .insert(pessoas)
          .values({
            organizacaoId: lead.organizacaoId,
            empresaId: lead.empresaId,
            nome: lead.nome,
            email: lead.email,
            telefone: lead.telefone,
            whatsapp: lead.whatsapp,
            cargo: lead.cargo,
            leadIdLegado: lead.id,
          })
          .returning({ id: pessoas.id });
        pessoaId = nova.id;
      }

      // Touchpoint novo — sempre, mesmo em reengajamento (isFirstTouch só se
      // for genuinamente o primeiro touchpoint dessa pessoa).
      const [{ n: touchpointsExistentes }] = await db
        .select({ n: sql<number>`count(*)` })
        .from(pontosContato)
        .where(eq(pontosContato.pessoaId, pessoaId));

      await db
        .update(pontosContato)
        .set({ isLastTouch: false })
        .where(and(eq(pontosContato.pessoaId, pessoaId), eq(pontosContato.isLastTouch, true)));

      await db.insert(pontosContato).values({
        organizacaoId: lead.organizacaoId,
        pessoaId,
        empresaId: lead.empresaId,
        source: lead.utmSource || lead.origem || null,
        medium: lead.utmMedium,
        campaign: lead.utmCampaign,
        term: lead.utmTerm,
        content: lead.utmContent,
        landingPage: lead.landingPage,
        campaignId: lead.metaCampaignId,
        tipoOrigem: classificarOrigem(lead.origem, lead.utmSource),
        isFirstTouch: Number(touchpointsExistentes) === 0,
        isLastTouch: true,
        ocorridoEm: lead.createdAt,
        raw: { leadIdLegado: lead.id, origemLegado: lead.origem },
      });
    }

    // Cliente — dedup por empresa quando possível, mesma regra do backfill.
    if (lead.tipo === "cliente") {
      const filtroCliente = lead.empresaId
        ? eq(clientes.empresaId, lead.empresaId)
        : eq(clientes.pessoaPrincipalId, pessoaId);
      const [clienteExistente] = await db.select({ id: clientes.id }).from(clientes).where(filtroCliente).limit(1);
      if (!clienteExistente) {
        await db.insert(clientes).values({
          organizacaoId: lead.organizacaoId,
          empresaId: lead.empresaId,
          pessoaPrincipalId: pessoaId,
          clienteDesde: lead.clienteDesde,
          leadIdLegado: lead.id,
        });
      }
    }

    return pessoaId;
  } catch (err) {
    console.error(`[sync-domain-model] falha ao sincronizar pessoa do lead ${leadId} (best-effort, legado não afetado):`, err);
    return null;
  }
}

/**
 * Sincroniza Oportunidade a partir de um Negócio legado. Idempotente por
 * `negocioIdLegado`. Resolve pessoaId via `pessoas.leadIdLegado` — se o Lead
 * ainda não foi sincronizado, sincroniza ele primeiro.
 */
export async function syncOportunidadeFromNegocio(negocioId: string): Promise<void> {
  try {
    const [negocio] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);
    if (!negocio) return;

    let pessoaId: string | null = null;
    if (negocio.leadId) {
      const [pessoa] = await db.select({ id: pessoas.id }).from(pessoas).where(eq(pessoas.leadIdLegado, negocio.leadId)).limit(1);
      pessoaId = pessoa?.id || (await syncPessoaFromLead(negocio.leadId));
    }

    let perdidoAt: Date | null = null;
    if (negocio.status === "perdido") {
      const { statusChanges } = await import("@/lib/db/schema");
      const [ultimaMudanca] = await db
        .select({ createdAt: statusChanges.createdAt })
        .from(statusChanges)
        .where(and(eq(statusChanges.negocioId, negocioId), eq(statusChanges.paraStatus, "perdido")))
        .orderBy(desc(statusChanges.createdAt))
        .limit(1);
      perdidoAt = ultimaMudanca?.createdAt || negocio.updatedAt;
    }

    const [existente] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, negocioId)).limit(1);

    const valores = {
      organizacaoId: negocio.organizacaoId,
      pessoaId,
      empresaId: negocio.empresaId,
      pipelineId: negocio.pipelineId,
      stage: negocio.status,
      responsavelId: negocio.responsavelId,
      valor: negocio.valorTotal,
      mrr: negocio.mrrFechado || negocio.mrrEstimado,
      ganhoAt: negocio.ganhoAt,
      perdidoAt,
      motivoPerda: negocio.motivoPerda,
      updatedAt: new Date(),
    };

    if (existente) {
      await db.update(oportunidades).set(valores).where(eq(oportunidades.id, existente.id));
    } else {
      await db.insert(oportunidades).values({ ...valores, negocioIdLegado: negocioId });
    }
  } catch (err) {
    console.error(`[sync-domain-model] falha ao sincronizar oportunidade do negócio ${negocioId} (best-effort, legado não afetado):`, err);
  }
}
