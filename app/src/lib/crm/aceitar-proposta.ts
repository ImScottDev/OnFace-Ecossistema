/**
 * Lógica de "proposta aceita" (negócio ganho) compartilhada entre:
 *  - o endpoint manual `POST /propostas/:id/aceitar` (Hono)
 *  - o webhook do Stripe (`checkout.session.completed`) quando o cliente paga
 *
 * Faz: cria contrato (ativo), marca a proposta como aceita, e se houver negócio
 * vinculado → marca ganho, promove o lead a cliente e clona o negócio pra
 * carteira. Idêntico ao fluxo manual original (extraído pra reuso).
 */
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, contratos, atividades, statusChanges } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";

type PropostaRow = typeof propostas.$inferSelect;

export async function marcarPropostaAceita(opts: {
  proposta: PropostaRow;
  organizacaoId: string;
  /** ator da ação; no webhook usamos o criador da proposta */
  userId: string | null;
  avancarLead?: boolean;
}): Promise<{ contratoId: string }> {
  const { proposta, organizacaoId, userId, avancarLead = false } = opts;

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, proposta.id))
    .orderBy(asc(propostaItens.ordem));

  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  const totalAvulso = parseFloat(proposta.totalAvulso || "0");
  const setupTotal = itens
    .filter((i) => i.tipo === "setup")
    .reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);

  let tipoReceita = "recorrente";
  if (totalRecorrente > 0 && totalAvulso > 0) tipoReceita = "hibrido";
  else if (totalAvulso > 0 && totalRecorrente === 0) tipoReceita = "projeto";

  const servicoNomes = itens.map((i) => i.nome);
  const today = new Date().toISOString().split("T")[0];

  const [contrato] = await db
    .insert(contratos)
    .values({
      organizacaoId,
      leadId: proposta.leadId,
      negocioId: proposta.negocioId,
      tipo: itens.length > 0 ? itens[0].nome : "proposta",
      descricao: `Gerado da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
      moeda: proposta.moeda || "BRL",
      mrr: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      servicos: servicoNomes,
      inicio: today,
      status: "ativo",
    })
    .returning();

  await db
    .update(propostas)
    .set({ status: "aceita", contratoId: contrato.id, updatedAt: new Date() })
    .where(eq(propostas.id, proposta.id));

  if (proposta.negocioId) {
    const [currentNeg] = await db.select().from(negocios).where(eq(negocios.id, proposta.negocioId)).limit(1);

    await db.update(negocios).set({
      status: "ganho",
      ganhoAt: new Date(),
      mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      tipoReceita,
      updatedAt: new Date(),
    }).where(eq(negocios.id, proposta.negocioId));

    await db.insert(statusChanges).values({
      leadId: proposta.leadId,
      negocioId: proposta.negocioId,
      deStatus: currentNeg?.status || "proposta_apresentada",
      paraStatus: "ganho",
      usuarioId: userId,
      motivo: "Proposta aceita",
    });

    await db.update(leads).set({
      tipo: "cliente",
      clienteDesde: new Date(),
      updatedAt: new Date(),
    }).where(eq(leads.id, proposta.leadId));

    if (currentNeg) {
      await db.insert(negocios).values({
        organizacaoId,
        leadId: currentNeg.leadId,
        empresaId: currentNeg.empresaId,
        titulo: currentNeg.titulo,
        status: "ativo",
        temperatura: currentNeg.temperatura,
        valorTotal: currentNeg.valorTotal,
        tipoReceita,
        mrrEstimado: currentNeg.mrrEstimado,
        valorProjeto: currentNeg.valorProjeto,
        mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
        valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
        moeda: currentNeg.moeda,
        servicosInteresse: currentNeg.servicosInteresse,
        responsavelId: currentNeg.responsavelId,
        pipelineId: currentNeg.pipelineId,
        contratoTipo: currentNeg.contratoTipo,
        origemNegocio: "carteira",
        negocioOrigemId: proposta.negocioId,
      });
    }
  } else if (avancarLead) {
    const leadUpdates: Record<string, unknown> = {
      tipoReceita,
      tipo: "cliente",
      clienteDesde: new Date(),
      updatedAt: new Date(),
    };
    if (totalRecorrente > 0) leadUpdates.mrrFechado = totalRecorrente.toFixed(2);
    if (totalAvulso > 0) leadUpdates.valorProjeto = totalAvulso.toFixed(2);
    if (setupTotal > 0) leadUpdates.valorSetup = setupTotal.toFixed(2);
    await db.update(leads).set(leadUpdates).where(eq(leads.id, proposta.leadId));
  }

  await db.insert(atividades).values({
    organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    usuarioId: userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} aceita`,
    descricao: `Contrato gerado. Valor total: R$ ${parseFloat(proposta.totalGeral || "0").toLocaleString("pt-BR")}`,
    dados: { propostaId: proposta.id, contratoId: contrato.id, acao: "aceita" },
  });

  if (proposta.negocioId) {
    await syncNegocioValoresFromPropostas(proposta.negocioId);
  }

  return { contratoId: contrato.id };
}
