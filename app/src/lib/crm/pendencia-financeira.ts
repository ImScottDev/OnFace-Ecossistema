/**
 * Frente 2C.1 — pendência financeira de venda ganha por contrato.
 *
 * Quando PABX/White Label viram ganho pela ASSINATURA, o pagamento pode ainda
 * não ter acontecido. Esse fato precisa existir como recebível de verdade, não
 * como flag solta: senão o Financeiro não cobra e o CS herda um cliente sem
 * saber que tem dinheiro em aberto.
 *
 * Decisão de arquitetura: NÃO criar tabela de pendência. `faturas` já é a
 * tabela de recebível do CRM (788 linhas reais vindas do Stripe) e já é a base
 * de tudo que lê inadimplência — a Carteira calcula "em risco" com
 * `fatura.status='aberta' AND COALESCE(vencimento, emitida_em) < now()`, e
 * /clientes/financeiro tem a fila de cobrança com `acionado_cobranca`. Gravar
 * a pendência ali faz ela aparecer nessas telas sem UI nova e sem uma segunda
 * definição de "está devendo".
 *
 * Uma linha por natureza (mensalidade × implantação, esta parcelável): ver
 * `pendencia-linhas.ts`. A linha legada `CRM2:<grupoId>` (mistura das duas)
 * continua válida e não é recriada.
 *
 * Idempotência: `external_id` começa com `CRM2:<grupoId>` com o índice único
 * (origem, external_id) que já existia. Reprocessar assinatura/webhook nunca
 * duplica a pendência.
 */
import { db } from "@/lib/db";
import { eq, and, or, like, sql } from "drizzle-orm";
import {
  faturas, negocios, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens, propostas,
} from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { resolverVencimentoDoGrupo } from "@/lib/crm/politica-familia";
import { linhasDoRecebivel } from "@/lib/crm/pendencia-linhas";

const ORIGEM_CRM2 = "crm2_comercial";

export interface PendenciaCriada {
  faturaId: string;
  valor: number;
  vencimento: Date | null;
  jaExistia: boolean;
}

/**
 * Registra (ou reaproveita) a pendência financeira de um grupo comercial cuja
 * entrega foi liberada sem pagamento confirmado. Best-effort: uma falha aqui
 * NUNCA pode desfazer o ganho — o fato comercial (contrato assinado) já é
 * real. Retorna null quando não há o que registrar (grupo sem itens, sem
 * organização resolvível, ou pagamento já confirmado).
 */
export async function registrarPendenciaFinanceira(opts: {
  grupoId: string;
  motivo: "ganho_por_contrato_sem_pagamento";
}): Promise<PendenciaCriada | null> {
  try {
    const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, opts.grupoId)).limit(1);
    if (!grupo) return null;
    if (grupo.pagamentoStatus === "confirmado") return null;

    // Idempotência: qualquer linha já gravada para o grupo (a legada mista
    // `CRM2:<grupo>` ou as separadas `CRM2:<grupo>:<natureza>`) vale como "já existe".
    const base = `CRM2:${grupo.id}`;
    const existentes = await db
      .select({ id: faturas.id, valor: faturas.valor, vencimento: faturas.vencimento })
      .from(faturas)
      .where(and(
        eq(faturas.organizacaoId, grupo.organizacaoId), eq(faturas.origem, ORIGEM_CRM2),
        or(eq(faturas.externalId, base), like(faturas.externalId, `${base}:%`)),
      ));
    if (existentes.length > 0) {
      const datas = existentes.map((e) => e.vencimento).filter((d): d is Date => !!d).sort((x, y) => x.getTime() - y.getTime());
      return {
        faturaId: existentes[0].id,
        valor: existentes.reduce((acc, e) => acc + (parseFloat(e.valor) || 0), 0),
        vencimento: datas[0] ?? null,
        jaExistia: true,
      };
    }

    // Itens DO GRUPO (não da proposta inteira: numa venda mista o grupo
    // Callface AI pode já estar pago), com a natureza de cada um.
    const itens = await db
      .select({ subtotal: propostaItens.subtotal, tipo: propostaItens.tipo, revenueNature: propostaItens.revenueNature })
      .from(propostaGrupoComercialItens)
      .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
      .where(eq(propostaGrupoComercialItens.grupoId, grupo.id));
    if (itens.length === 0) return null;

    const agora = new Date();
    const vencimento = grupo.pagamentoVenceEm ?? (await resolverVencimentoDoGrupo(grupo.id, agora));
    const [prop] = await db.select({ parcelas: propostas.parcelas, condicao: propostas.condicaoPagamentoTipo }).from(propostas).where(eq(propostas.id, grupo.propostaId)).limit(1);

    const linhas = linhasDoRecebivel(itens, { vencimento, parcelas: prop?.parcelas });
    if (linhas.length === 0) return null;
    const valor = linhas.reduce((acc, l) => acc + l.valor, 0);

    let empresaId: string | null = null;
    let leadId: string | null = null;
    if (grupo.negocioId) {
      const [neg] = await db.select({ empresaId: negocios.empresaId, leadId: negocios.leadId }).from(negocios).where(eq(negocios.id, grupo.negocioId)).limit(1);
      empresaId = neg?.empresaId ?? null;
      leadId = neg?.leadId ?? null;
    }

    const criadas = await db.insert(faturas).values(linhas.map((l) => ({
      organizacaoId: grupo.organizacaoId,
      leadId,
      empresaId,
      contratoId: grupo.contratoId,
      negocioId: grupo.negocioId,
      grupoComercialId: grupo.id,
      origem: ORIGEM_CRM2,
      externalId: `${base}:${l.sufixo}`,
      valor: l.valor.toFixed(2),
      status: "aberta",
      emitidaEm: agora,
      vencimento: l.vencimento,
      raw: {
        motivo: opts.motivo,
        natureza: l.natureza,
        parcela: l.parcela,
        totalParcelas: l.totalParcelas,
        condicaoPagamentoTipo: prop?.condicao ?? null,
        propostaId: grupo.propostaId,
        negocioId: grupo.negocioId,
        grupoComercialId: grupo.id,
        commercialModel: grupo.commercialModel,
        serviceFamily: grupo.serviceFamily,
        // Sem vencimento definido na condição de pagamento da proposta a
        // pendência nasce sem data — registrado explicitamente pra ninguém
        // ler `vencimento: null` como bug de gravação.
        vencimentoIndefinido: !l.vencimento,
      },
    }))).returning({ id: faturas.id });

    await db.update(propostaGrupoComercial).set({
      pagamentoStatus: "pendente",
      pagamentoVenceEm: vencimento,
      updatedAt: agora,
    }).where(eq(propostaGrupoComercial.id, grupo.id));

    await publicarEvento({
      organizacaoId: grupo.organizacaoId,
      eventType: "PaymentPending",
      aggregateType: "grupo_comercial",
      aggregateId: grupo.id,
      payload: {
        faturaId: criadas[0].id, faturaIds: criadas.map((c) => c.id), negocioId: grupo.negocioId, propostaId: grupo.propostaId, contratoId: grupo.contratoId,
        serviceFamily: grupo.serviceFamily, valor: valor.toFixed(2), vencimento: vencimento?.toISOString() ?? null, motivo: opts.motivo,
        linhas: linhas.map((l) => ({ natureza: l.natureza, valor: l.valor.toFixed(2), vencimento: l.vencimento?.toISOString() ?? null })),
      },
      idempotencyKey: `payment-pending:${grupo.id}`,
    });

    return { faturaId: criadas[0].id, valor, vencimento, jaExistia: false };
  } catch (err) {
    console.error(`[pendencia-financeira] falha ao registrar pendência do grupo ${opts.grupoId} (best-effort):`, err);
    return null;
  }
}

/**
 * Quita a pendência quando o pagamento daquele grupo confirma de verdade
 * (webhook do Stripe). Só toca em fatura de origem `crm2_comercial` — nunca
 * mexe em fatura vinda do Stripe/planilha, que tem a própria fonte de verdade.
 */
export async function quitarPendenciaFinanceira(grupoId: string, pagoEm: Date): Promise<{ quitadas: number }> {
  try {
    const atualizadas = await db
      .update(faturas)
      .set({ status: "paga", pagaEm: pagoEm, updatedAt: new Date() })
      .where(and(eq(faturas.origem, ORIGEM_CRM2), or(eq(faturas.externalId, `CRM2:${grupoId}`), like(faturas.externalId, `CRM2:${grupoId}:%`)), eq(faturas.status, "aberta")))
      .returning({ id: faturas.id });
    return { quitadas: atualizadas.length };
  } catch (err) {
    console.error(`[pendencia-financeira] falha ao quitar pendência do grupo ${grupoId} (best-effort):`, err);
    return { quitadas: 0 };
  }
}

/** Pendências abertas de um negócio — usado pelo detalhe da oportunidade. */
export async function listarPendenciasDoNegocio(negocioId: string) {
  return db
    .select({
      id: faturas.id, valor: faturas.valor, status: faturas.status, vencimento: faturas.vencimento,
      emitidaEm: faturas.emitidaEm, natureza: sql<string | null>`${faturas.raw}->>'natureza'`, grupoComercialId: faturas.grupoComercialId, contratoId: faturas.contratoId,
    })
    .from(faturas)
    .where(and(eq(faturas.negocioId, negocioId), eq(faturas.origem, ORIGEM_CRM2)));
}
