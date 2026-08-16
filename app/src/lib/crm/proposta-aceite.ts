/**
 * Commercial Core v2 (ADR-EXEC-021) — núcleo único do ACEITE de proposta.
 *
 * Usado tanto pelo aceite público (cliente, via /p/{id}) quanto pelo aceite
 * manual (vendedor, quando o cliente já topou em reunião) — mesma regra,
 * dois gatilhos. Substitui a lógica antiga que assumia "a proposta inteira
 * segue um caminho só" (achado real: quebra venda mista).
 *
 * O que este módulo NÃO faz: não marca Won (isso só acontece com evidência
 * real — contrato assinado ou pagamento confirmado, ver won-evidence.ts).
 * Aceitar é o cliente dizer "sim" — Won é o sistema confirmar que a
 * obrigação correspondente (contrato ou pagamento) realmente aconteceu.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { propostas } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { syncOportunidadeItensFromProposta } from "@/lib/crm/composicao-comercial";
import { formarGruposComerciais, vincularContratoAoGrupo, type GrupoComercialRow } from "@/lib/crm/grupo-comercial";
import { exigeContrato } from "@/lib/crm/commercial-model";
import { gerarContratoDeTemplate } from "@/lib/crm/contrato-template";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";
import { notificarPropostaRespondida } from "@/lib/crm/notificar-proposta";

export interface ResultadoGrupoAceite {
  grupoId: string;
  commercialModel: string;
  proximoPasso: "pagamento" | "contrato";
  checkoutUrl?: string | null;
  erro?: string;
}

export interface ResultadoAceite {
  ok: true;
  grupos: ResultadoGrupoAceite[];
}

/**
 * Processa o aceite de uma proposta: forma os grupos comerciais (um por
 * commercial_model distinto entre os itens) e dispara, PRA CADA GRUPO
 * independentemente, o próximo requisito real — contrato pros que exigem,
 * checkout automático pros que não exigem. Um grupo falhar (ex: Stripe
 * fora do ar) não trava os outros.
 */
export async function processarAceiteDaProposta(opts: {
  propostaId: string;
  organizacaoId: string;
  origem: "publico" | "manual";
}): Promise<ResultadoAceite | { ok: false; error: string }> {
  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, opts.propostaId)).limit(1);
  if (!proposta) return { ok: false, error: "Proposta não encontrada" };
  if (!["enviada", "ajuste_solicitado"].includes(proposta.status)) {
    return { ok: false, error: "Essa proposta não está mais aguardando resposta." };
  }

  await db.update(propostas).set({ status: "aceita", clienteRespondeuEm: new Date(), updatedAt: new Date() }).where(eq(propostas.id, opts.propostaId));

  await publicarEvento({
    organizacaoId: opts.organizacaoId, eventType: "ProposalAccepted", aggregateType: "proposta", aggregateId: opts.propostaId,
    payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, origem: opts.origem },
  });

  await syncOportunidadeItensFromProposta(opts.propostaId);
  const grupos: GrupoComercialRow[] = await formarGruposComerciais(opts.propostaId);

  const resultados: ResultadoGrupoAceite[] = [];
  for (const grupo of grupos) {
    if (exigeContrato(grupo.commercialModel)) {
      try {
        const { contratoId } = await gerarContratoDeTemplate(grupo.id);
        await vincularContratoAoGrupo(grupo.id, contratoId);
        await publicarEvento({
          organizacaoId: opts.organizacaoId, eventType: "ContractRequired", aggregateType: "contrato", aggregateId: contratoId,
          payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, commercialModel: grupo.commercialModel },
        });
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "contrato" });
      } catch (err) {
        console.error(`[proposta-aceite] falha ao gerar contrato do grupo ${grupo.id}:`, err);
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "contrato", erro: String(err) });
      }
    } else {
      const checkout = await criarCheckoutParaGrupo({ grupoId: grupo.id, origem: "automatico_pos_aceite" });
      if (checkout.ok) {
        await publicarEvento({
          organizacaoId: opts.organizacaoId, eventType: "PaymentStarted", aggregateType: "checkout", aggregateId: checkout.checkoutId,
          payload: { propostaId: opts.propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, checkoutUrl: checkout.url },
        });
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", checkoutUrl: checkout.url });
      } else {
        console.error(`[proposta-aceite] falha ao gerar checkout do grupo ${grupo.id}: ${checkout.error}`);
        resultados.push({ grupoId: grupo.id, commercialModel: grupo.commercialModel, proximoPasso: "pagamento", erro: checkout.error });
      }
    }
  }

  await notificarPropostaRespondida({
    propostaId: proposta.id, negocioId: proposta.negocioId, leadId: proposta.leadId,
    numero: proposta.numero, versao: proposta.versao, tipo: "aceita",
    motivo: resultados.length > 1
      ? `Cliente aceitou. Composição mista: ${resultados.map((r) => `${r.commercialModel}→${r.proximoPasso}`).join(", ")}.`
      : `Cliente aceitou e foi direcionado para ${resultados[0]?.proximoPasso === "contrato" ? "o contrato" : "o pagamento"}.`,
  });

  return { ok: true, grupos: resultados };
}
