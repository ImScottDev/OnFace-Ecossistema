// Clientes → Financeiro (CRM2, 18/08). Billing por empresa: assinaturas
// Stripe + faturas vinculadas, com destaque de atraso pra recovery
// operacional do CS. Regra fechada do projeto: billing != lifecycle — fatura
// atrasada não é churn, é sinal de cobrança. Arquivo separado de
// clientes-crm2.ts de propósito (módulo Clientes com trabalho em paralelo em
// andamento nele; evitar dois processos escrevendo o mesmo arquivo).
//
// Faturas nem sempre têm empresa_id populado direto (78 registros observados
// em dev só com assinatura_id) — resolução usa empresa_id OU assinatura_id
// (via assinaturas da empresa) OU contrato_id (via assinaturas.contratoId),
// nunca só a coluna direta.
//
// "Atrasada" = status 'aberta' (não paga, não void, não rascunho) E
// vencimento/data de referência já passou. Cobrança automática não tem
// due_date (vencimento null) — aging usa COALESCE(vencimento, emitida_em),
// mesmo padrão documentado no schema de faturas.
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { exigirCtx } from "../compat.js";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /clientes-crm2/:empresaId/financeiro
app.get("/clientes-crm2/:empresaId/financeiro", async (c) => {
  const ctx = await exigirCtx(c, "finance.read");
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "ID inválido" }, 400);

  const assinaturas = await db.execute(sql`
    SELECT id, produto, status, mrr, moeda, stripe_subscription_id, iniciada_em,
      cancelada_em, motivo_cancelamento, current_period_end
    FROM assinaturas
    WHERE organizacao_id = ${ctx.organizacaoId} AND empresa_id = ${empresaId}
    ORDER BY status = 'active' DESC, current_period_end DESC
  `);

  // Contrato IDs das assinaturas da empresa, pra alcançar faturas que só têm
  // contrato_id preenchido (nunca somar/filtrar contratos.mrr aqui — só usar
  // o ID como chave de junção).
  const contratoIds = [...new Set((assinaturas as unknown as { contrato_id: string | null }[])
    .map((a) => a.contrato_id)
    .filter((id): id is string => !!id))];

  const faturasRaw = await db.execute(sql`
    SELECT f.id, f.origem, f.external_id, f.valor, f.moeda, f.status,
      f.competencia, f.emitida_em, f.vencimento, f.hosted_invoice_url,
      f.paga_em, f.tentativas, f.acionado_cobranca,
      (f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()) AS atrasada
    FROM faturas f
    WHERE f.organizacao_id = ${ctx.organizacaoId}
      AND (
        f.empresa_id = ${empresaId}
        OR f.assinatura_id IN (SELECT id FROM assinaturas WHERE empresa_id = ${empresaId})
        ${contratoIds.length > 0 ? sql`OR f.contrato_id IN (${sql.join(contratoIds.map((id) => sql`${id}`), sql`, `)})` : sql``}
      )
    ORDER BY COALESCE(f.vencimento, f.emitida_em) DESC
  `);

  const faturas = (faturasRaw as unknown as { valor: string; atrasada: boolean }[]).map((f) => ({
    ...f,
    atrasada: !!f.atrasada,
  }));

  const atrasadas = faturas.filter((f) => f.atrasada);
  const emDia = faturas.filter((f) => !f.atrasada);
  const valorAtrasado = atrasadas.reduce((sum, f) => sum + parseFloat(f.valor || "0"), 0);

  return c.json({
    assinaturas,
    faturas,
    resumo: {
      totalFaturasAtrasadas: atrasadas.length,
      valorAtrasado,
      totalFaturasEmDia: emDia.length,
    },
  });
});

export const clientesFinanceiroRoutes = app;
