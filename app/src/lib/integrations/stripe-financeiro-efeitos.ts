/**
 * Efeitos financeiros de um evento do Stripe no banco: timeline, `pagamentos`,
 * `faturas.receivable_state` e avisos. A leitura do payload mora em
 * `stripe-financeiro.ts` (pura); aqui só se escreve, e tudo é idempotente.
 */
import { and, desc, eq, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkouts } from "@/lib/db/schema";
import { registrarEvento } from "@/lib/vendas/eventos";
import { destinatariosDaConta, inserirNotificacaoUmaVez, leadDoCustomer } from "./stripe-webhook-handlers";
import { estadoDoRecebivel, estadoPorEvento, type FatoFinanceiro, type PagamentoDoEvento } from "./stripe-financeiro";

const linhas = <T>(r: unknown) => r as unknown as T[];

/**
 * Fato financeiro → timeline da empresa (e do negócio, quando há `negocioId`).
 * Usa a porta `registrarEvento`; nunca insert solto. NÃO passa `leadId` de
 * propósito: isso dispararia a sincronização de aquisição, que não tem nada a ver
 * com cobrança. Idempotente pela chave do fato (`contexto.stripeChave`, com
 * índice único na migration 0113).
 */
export async function registrarFatoNaTimeline(organizacaoId: string, fato: FatoFinanceiro): Promise<string> {
  const lead = fato.customerId ? await leadDoCustomer(fato.customerId) : null;
  const leadOk = lead && lead.organizacaoId === organizacaoId ? lead : null;

  let negocioId = fato.negocioId;
  if (!negocioId && (fato.invoiceId || fato.subscriptionId)) {
    const vinculos = [
      fato.invoiceId ? eq(checkouts.stripeInvoiceId, fato.invoiceId) : undefined,
      fato.subscriptionId ? eq(checkouts.stripeSubscriptionId, fato.subscriptionId) : undefined,
    ].filter((x): x is NonNullable<typeof x> => !!x);
    const [c] = await db.select({ negocioId: checkouts.negocioId }).from(checkouts)
      .where(and(eq(checkouts.organizacaoId, organizacaoId), or(...vinculos)))
      .orderBy(desc(checkouts.criadoEm)).limit(1);
    negocioId = c?.negocioId ?? null;
  }

  // O id da metadata vem de fora: só vale se o negócio existe NESTA organização.
  let empresaDoNegocio: string | null = null;
  if (negocioId) {
    const [n] = linhas<{ empresa_id: string | null }>(await db.execute(sql`
      SELECT empresa_id::text FROM negocios WHERE id = ${negocioId}::uuid AND organizacao_id = ${organizacaoId}::uuid LIMIT 1`));
    if (n) empresaDoNegocio = n.empresa_id; else negocioId = null;
  }
  const empresaId = leadOk?.empresaId ?? empresaDoNegocio ?? null;
  if (!empresaId && !negocioId) return "sem empresa nem negócio vinculados — timeline não gravada";

  const [ja] = linhas<{ id: string }>(await db.execute(sql`
    SELECT id::text FROM vendas_eventos
     WHERE organizacao_id = ${organizacaoId}::uuid AND contexto->>'stripeChave' = ${fato.chave} LIMIT 1`));
  if (ja) return `já registrado (${fato.chave})`;

  try {
    await registrarEvento({
      organizacaoId,
      tipo: fato.tipo,
      ator: { tipo: "SYSTEM", usuarioId: null, ref: "stripe" },
      negocioId, empresaId,
      ocorridoEm: fato.ocorridoEm,
      contexto: {
        fonte: "stripe", titulo: fato.titulo, descricao: fato.descricao, stripeChave: fato.chave,
        customerId: fato.customerId, invoiceId: fato.invoiceId, subscriptionId: fato.subscriptionId,
        valor: fato.valorCentavos != null ? fato.valorCentavos / 100 : null, moeda: fato.moeda,
        ...fato.contexto,
      },
      timeline: { tipo: "financeiro", titulo: fato.titulo, descricao: fato.descricao },
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23505" || /duplicate key/i.test(err.message ?? "")) return `já registrado (${fato.chave})`;
    throw e;
  }
  return `${fato.tipo} gravado${negocioId ? " (empresa + negócio)" : " (empresa)"}`;
}

/** `pagamentos` passa a registrar PAID, FAILED e REFUNDED (a constraint já admite os três). */
export async function gravarPagamento(organizacaoId: string, p: PagamentoDoEvento, customerId: string | null): Promise<string> {
  const lead = customerId ? await leadDoCustomer(customerId) : null;
  const leadOk = lead && lead.organizacaoId === organizacaoId ? lead : null;

  type F = { id: string; empresa_id: string | null; servico: string | null };
  let fatura: F | null = null;
  let vinculo = "fatura";
  if (p.invoiceId) {
    fatura = linhas<F>(await db.execute(sql`
      SELECT id::text, empresa_id::text, servico_canonico_id::text AS servico FROM faturas
       WHERE organizacao_id = ${organizacaoId}::uuid AND origem = 'stripe' AND external_id = ${p.invoiceId} LIMIT 1`))[0] ?? null;
  }
  // No basil o charge não aponta mais para a fatura. O estorno procura o pagamento PAID
  // da mesma empresa com o MESMO valor da cobrança original; fica marcado como heurística.
  if (!fatura && p.status === "REFUNDED" && leadOk?.empresaId && p.valorOriginalCentavos) {
    fatura = linhas<F>(await db.execute(sql`
      SELECT f.id::text, f.empresa_id::text, f.servico_canonico_id::text AS servico
        FROM pagamentos pg JOIN faturas f ON f.id = pg.fatura_id
       WHERE pg.organizacao_id = ${organizacaoId}::uuid AND pg.empresa_id = ${leadOk.empresaId}::uuid
         AND pg.status = 'PAID' AND pg.amount = ${(p.valorOriginalCentavos / 100).toFixed(2)}::numeric
       ORDER BY pg.paid_at DESC NULLS LAST LIMIT 1`))[0] ?? null;
    if (fatura) vinculo = "heuristica_valor_empresa";
  }
  if (!fatura) return "fatura ainda não está no espelho local — pagamento não gravado (o sync a traz)";
  const empresaId = fatura.empresa_id ?? leadOk?.empresaId ?? null;
  if (!empresaId) return "fatura sem empresa — pagamento não gravado";

  let valor = (p.valorCentavos ?? 0) / 100;
  if (p.status === "REFUNDED") {
    // charge.refunded traz o ACUMULADO; a linha guarda o que foi devolvido DESTA vez.
    const [prev] = linhas<{ s: string }>(await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0)::text AS s FROM pagamentos
       WHERE organizacao_id = ${organizacaoId}::uuid AND provider = 'stripe' AND status = 'REFUNDED'
         AND metadata->>'chargeId' = ${p.chargeId}`));
    valor = valor - Number(prev?.s ?? 0);
    if (valor < 0.005) return "estorno já registrado";
  }
  const agora = p.quando.toISOString();
  const r = linhas<{ id: string }>(await db.execute(sql`
    INSERT INTO pagamentos (organizacao_id, fatura_id, empresa_id, servico_canonico_id, provider, external_payment_id,
                            payment_method, amount, currency, status, paid_at, failed_at, refunded_at, idempotency_key, metadata)
    VALUES (${organizacaoId}::uuid, ${fatura.id}::uuid, ${empresaId}::uuid, ${fatura.servico}::uuid, 'stripe', ${p.externalPaymentId},
            ${p.metodo}, ${valor.toFixed(2)}::numeric, ${(p.moeda ?? "brl").toUpperCase()}, ${p.status},
            ${p.status === "PAID" ? agora : null}::timestamptz, ${p.status === "FAILED" ? agora : null}::timestamptz,
            ${p.status === "REFUNDED" ? agora : null}::timestamptz, ${p.idempotencyKey},
            ${JSON.stringify({ origem: "webhook", vinculo, chargeId: p.chargeId, invoiceId: p.invoiceId, cumulativoCentavos: p.valorCentavos })}::jsonb)
    ON CONFLICT DO NOTHING RETURNING id::text`));
  return r.length ? `pagamento ${p.status} gravado (${vinculo})` : `pagamento ${p.status} já existia (idempotente)`;
}

/** `faturas.receivable_state` a partir do que a fatura é depois do sync (+ o que o evento já diz). */
export async function atualizarRecebivel(organizacaoId: string, invoiceId: string, tipoEvento: string): Promise<string> {
  const [f] = linhas<{ status: string; vencimento: string | null; receivable_state: string | null }>(await db.execute(sql`
    SELECT status, vencimento::text, receivable_state FROM faturas
     WHERE organizacao_id = ${organizacaoId}::uuid AND origem = 'stripe' AND external_id = ${invoiceId} LIMIT 1`));
  if (!f) return "fatura fora do espelho local";
  const doBanco = estadoDoRecebivel(f.status, f.vencimento ? new Date(f.vencimento) : null);
  const doEvento = estadoPorEvento(tipoEvento);
  const final = doBanco === "paid" || doBanco === "void" || doBanco === "uncollectible"
    ? doBanco
    : doEvento === "overdue" ? "overdue" : (doBanco ?? doEvento);
  if (!final || final === f.receivable_state) return `recebível já era ${final ?? "indefinido"}`;
  await db.execute(sql`
    UPDATE faturas SET receivable_state = ${final}, updated_at = now()
     WHERE organizacao_id = ${organizacaoId}::uuid AND origem = 'stripe' AND external_id = ${invoiceId}`);
  return `recebível ${f.receivable_state ?? "nulo"} → ${final}`;
}

/** Mesma regra do backfill da 0113, para o que ficou desatualizado (ex.: aberta que venceu sem evento). */
export async function recalcularRecebiveis(organizacaoId: string): Promise<string> {
  const r = linhas<{ id: string }>(await db.execute(sql`
    UPDATE faturas SET receivable_state = CASE status
        WHEN 'paga' THEN 'paid' WHEN 'void' THEN 'void' WHEN 'uncollectible' THEN 'uncollectible'
        WHEN 'aberta' THEN CASE WHEN vencimento IS NOT NULL AND vencimento < now() THEN 'overdue' ELSE 'open' END
        WHEN 'falhou' THEN 'overdue' END, updated_at = now()
     WHERE organizacao_id = ${organizacaoId}::uuid AND origem = 'stripe'
       AND status IN ('paga','void','uncollectible','aberta','falhou')
       AND receivable_state IS DISTINCT FROM CASE status
        WHEN 'paga' THEN 'paid' WHEN 'void' THEN 'void' WHEN 'uncollectible' THEN 'uncollectible'
        WHEN 'aberta' THEN CASE WHEN vencimento IS NOT NULL AND vencimento < now() THEN 'overdue' ELSE 'open' END
        WHEN 'falhou' THEN 'overdue' END
    RETURNING id::text`));
  return `${r.length} recebível(is) atualizado(s)`;
}

/** Aviso interno (responsável da conta, ou admins), sem repetir a mesma mensagem. */
export async function avisarEquipe(a: { organizacaoId: string; customerId: string | null; tipo: string; titulo: string; mensagem: string }): Promise<string> {
  const lead = a.customerId ? await leadDoCustomer(a.customerId) : null;
  if (!lead || lead.organizacaoId !== a.organizacaoId) return "customer sem lead no CRM — sem aviso";
  const quem = lead.empresa || lead.nome || "cliente";
  const dest = await destinatariosDaConta(lead.responsavelId);
  for (const usuarioId of dest) {
    await inserirNotificacaoUmaVez({
      usuarioId, tipo: a.tipo, titulo: `${a.titulo} — ${quem}`, mensagem: a.mensagem,
      link: `/clientes${lead.empresaId ? `/${lead.empresaId}` : ""}`,
    });
  }
  return `${dest.length} notificado(s)`;
}
