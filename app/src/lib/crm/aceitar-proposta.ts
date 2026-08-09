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
import { propostas, propostaItens, leads, negocios, contratos, atividades, statusChanges, auditLog } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { notificarNegocioGanho } from "@/lib/crm/notificar";
import { syncPessoaFromLead, syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { avaliarContratosAtivosDuplicados, marcarContratoComoRenovado } from "@/lib/crm/contrato-duplicidade";

type PropostaRow = typeof propostas.$inferSelect;

export async function marcarPropostaAceita(opts: {
  proposta: PropostaRow;
  organizacaoId: string;
  /** ator da ação; no webhook usamos o criador da proposta */
  userId: string | null;
  avancarLead?: boolean;
}): Promise<{ contratoId: string }> {
  const { proposta, organizacaoId, userId } = opts;

  // Proposta pode não ter negocioId (ex.: nova versão que perdeu o vínculo,
  // ou criada direto do contato/lead). Antes de tratar como "sem negócio" e
  // criar um negócio novo do zero, tenta achar o negócio ATIVO do lead — assim
  // a proposta aceita atualiza o negócio que o closer já está trabalhando em
  // vez de gerar um duplicado (e a meta ir pro dono errado).
  let negocioId = proposta.negocioId;
  if (!negocioId) {
    const [leadRow0] = await db
      .select({ negocioAtivoId: leads.negocioAtivoId })
      .from(leads)
      .where(eq(leads.id, proposta.leadId))
      .limit(1);
    if (leadRow0?.negocioAtivoId) {
      const [ativo] = await db
        .select({ id: negocios.id, status: negocios.status })
        .from(negocios)
        .where(eq(negocios.id, leadRow0.negocioAtivoId))
        .limit(1);
      if (ativo && ativo.status !== "ganho" && ativo.status !== "perdido") {
        negocioId = ativo.id;
      }
    }
  }

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
      negocioId,
      tipo: itens.length > 0 ? itens[0].nome : "proposta",
      descricao: `Gerado da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
      moeda: proposta.moeda || "BRL",
      mrr: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      servicos: servicoNomes,
      inicio: today,
      status: "ativo",
      // Venda via proposta/checkout é sempre do produto AI — sem isso o contrato
      // nasce com produto NULL e some da aba Financeiro (filtro produto='ai').
      produto: "ai",
    })
    .returning();

  await db
    .update(propostas)
    .set({ status: "aceita", contratoId: contrato.id, negocioId, updatedAt: new Date() })
    .where(eq(propostas.id, proposta.id));

  // F4: preventivo contra duplicidade — checa se o lead JÁ tinha outro
  // contrato "ativo" do mesmo produto (produto="ai" nesta função) além do
  // que acabamos de criar. "obsoleto_confirmado" (sem assinatura viva) é
  // seguro marcar como renovado automaticamente; "upsell_confirmado" nunca
  // se toca (é venda real em paralelo); "ambiguo" NUNCA decide sozinho —
  // só registra em audit_log pra revisão humana (best-effort, não bloqueia
  // o aceite real da proposta).
  try {
    const antigos = await avaliarContratosAtivosDuplicados(proposta.leadId, "ai", organizacaoId, contrato.id);
    for (const antigo of antigos) {
      if (antigo.classificacao === "obsoleto_confirmado") {
        await marcarContratoComoRenovado(antigo.contrato.id, contrato.id);
      } else if (antigo.classificacao === "ambiguo") {
        await db.insert(auditLog).values({
          organizacaoId,
          actorId: userId,
          action: "contrato.duplicidade_ambigua_detectada",
          entityType: "contrato",
          entityId: antigo.contrato.id,
          after: { contratoNovoId: contrato.id, motivo: "lead já tinha contrato ativo do mesmo produto, sem assinatura Stripe vinculada pra desempatar — revisão humana necessária" },
          source: "api",
        });
      }
      // "upsell_confirmado" — não toca, é venda real em paralelo.
    }
  } catch (err) {
    console.error("[F4] falha ao avaliar duplicidade de contrato (best-effort, aceite da proposta não afetado):", err);
  }

  if (negocioId) {
    const [currentNeg] = await db.select().from(negocios).where(eq(negocios.id, negocioId)).limit(1);

    await db.update(negocios).set({
      status: "ganho",
      ganhoAt: new Date(),
      mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      tipoReceita,
      updatedAt: new Date(),
    }).where(eq(negocios.id, negocioId));

    await db.insert(statusChanges).values({
      leadId: proposta.leadId,
      negocioId,
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
        negocioOrigemId: negocioId,
      });
    }
  } else {
    // Proposta SEM negócio vinculado e lead sem negócio ativo aproveitável
    // (ex.: criada direto do contato/lead, do zero). Cria um negócio JÁ GANHO
    // pra CREDITAR A META de quem realmente vendeu — prioriza o criador da
    // proposta (o closer que montou/enviou), caindo pro responsável do lead
    // só se não houver criador. Sem isso, proposta avulsa aceita/paga não
    // conta pra ninguém. (Independe de avancarLead: aceitar = fechou = conta.)
    const [leadRow] = await db.select().from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
    const valorTotal =
      totalRecorrente > 0 ? totalRecorrente.toFixed(2) : totalAvulso > 0 ? totalAvulso.toFixed(2) : undefined;

    const [novoNeg] = await db
      .insert(negocios)
      .values({
        organizacaoId,
        leadId: proposta.leadId,
        empresaId: leadRow?.empresaId ?? null,
        titulo: `${leadRow?.empresa || leadRow?.nome || "Proposta"} - Ganho`,
        status: "ganho",
        ganhoAt: new Date(),
        tipoReceita,
        valorTotal,
        mrrEstimado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
        mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
        valorProjeto: totalAvulso > 0 ? totalAvulso.toFixed(2) : undefined,
        valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
        moeda: proposta.moeda || "BRL",
        responsavelId: proposta.criadoPorId ?? leadRow?.responsavelId ?? userId ?? null,
        origemNegocio: "novo",
        origemQualificacao: "direta", // proposta avulsa aceita = fechou sem fluxo de reunião
      })
      .returning();

    // vincula a proposta e o contrato ao negócio recém-criado
    await db.update(propostas).set({ negocioId: novoNeg.id, updatedAt: new Date() }).where(eq(propostas.id, proposta.id));
    await db.update(contratos).set({ negocioId: novoNeg.id }).where(eq(contratos.id, contrato.id));

    await db.insert(statusChanges).values({
      leadId: proposta.leadId,
      negocioId: novoNeg.id,
      deStatus: null,
      paraStatus: "ganho",
      usuarioId: userId,
      motivo: "Proposta aceita (negócio criado no fechamento)",
    });

    await db.update(leads).set({
      tipo: "cliente",
      clienteDesde: new Date(),
      updatedAt: new Date(),
    }).where(eq(leads.id, proposta.leadId));

    await syncNegocioValoresFromPropostas(novoNeg.id);
  }

  await db.insert(atividades).values({
    organizacaoId,
    leadId: proposta.leadId,
    negocioId,
    usuarioId: userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} aceita`,
    descricao: `Contrato gerado. Valor total: R$ ${parseFloat(proposta.totalGeral || "0").toLocaleString("pt-BR")}`,
    dados: { propostaId: proposta.id, contratoId: contrato.id, acao: "aceita" },
  });

  if (negocioId) {
    await syncNegocioValoresFromPropostas(negocioId);
  }

  // Sino: avisa gestão + responsável que o negócio fechou (link pro card).
  // No branch sem negócio vinculado, a proposta foi religada ao negócio novo acima.
  const [pAtual] = await db.select({ negocioId: propostas.negocioId }).from(propostas).where(eq(propostas.id, proposta.id)).limit(1);
  if (pAtual?.negocioId) await notificarNegocioGanho(pAtual.negocioId);

  // F1/dual-write: este é o caminho de receita real (proposta aceita = Won),
  // usado tanto pelo endpoint manual quanto pelo webhook do Stripe — best-effort.
  await syncPessoaFromLead(proposta.leadId);
  if (pAtual?.negocioId) await syncOportunidadeFromNegocio(pAtual.negocioId);

  return { contratoId: contrato.id };
}
