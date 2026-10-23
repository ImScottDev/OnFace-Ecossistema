/**
 * Quem assina o Callface AI e é atendido pelo comercial também é cliente.
 *
 * A conta Stripe é compartilhada entre o CRM e a plataforma. O sync ignora de
 * propósito a assinatura marcada como do SaaS (`organization_id`/`plan_id`/
 * `user_id` na metadata): ela não é venda comercial e não pode entrar no MRR
 * nem gerar contrato, fatura ou movimento de receita do CRM.
 *
 * Só que "ignorar para receita" virou "ignorar para tudo", e o preço apareceu na
 * ficha: a Agência Consult paga R$ 89,90/mês pela plataforma, o Customer do
 * Stripe tem `crm_company_id` apontando para a empresa dela no CRM — e mesmo
 * assim o 360 mostrava "Contato · Desqualificado" e "Não classificado", porque
 * "quem é cliente" se lê do serviço canônico e nenhum serviço existia.
 *
 * Este módulo fecha só esse buraco, e nada além: para a assinatura do SaaS cujo
 * Customer o PRÓPRIO CRM carimbou com a empresa, materializa um serviço
 * canônico **fora do portfólio** (`portfolio_included = false`,
 * `revenue_nature = UNKNOWN`, valor 0). O efeito é um só — a empresa passa a ter
 * serviço ativo, logo é Cliente, e o produto aparece com a família certa.
 * Nenhum real entra em MRR, carteira ou relatório de receita: quem reconhece
 * receita filtra por `portfolio_included AND revenue_nature = 'MRR'`.
 *
 * A fronteira de verdade — quem manda na assinatura de um cliente que usa o
 * produto e é atendido pelo comercial — continua aberta e é decisão de negócio
 * (Fase 4 de docs/operacao/plano-identidade-de-cobranca.md). Isto aqui não a
 * decide: só para de mentir na ficha enquanto ela não é decidida.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { servicosCanonicos } from "@/lib/db/schema";
import { classificarProdutoPorNome } from "@/lib/crm/classificar-produto";

/** A empresa que o próprio CRM carimbou no Customer. Só ela vale: nome não decide. */
export function empresaCarimbadaNoCustomer(metadata: Record<string, string> | null | undefined): string | null {
  for (const chave of ["crm_company_id", "empresaId"]) {
    const v = metadata?.[chave]?.trim();
    if (v) return v;
  }
  return null;
}

/** Assinatura viva no Stripe: cobrança em curso conta como cliente; past_due ainda é cobrança. */
export const VIVA = new Set(["active", "trialing", "past_due"]);

export interface AssinaturaDoSaas {
  id: string;
  status: string;
  produto: string | null;
  empresaId: string;
}

/**
 * Materializa (ou atualiza) o serviço canônico de uma assinatura do SaaS.
 * Idempotente pela chave `CALLFACE_AI:<assinatura>`.
 */
export async function reconhecerClienteDoSaas(organizacaoId: string, a: AssinaturaDoSaas): Promise<void> {
  const ciclo = VIVA.has(a.status) ? "ACTIVE" : "CHURNED";
  await db
    .insert(servicosCanonicos)
    .values({
      organizacaoId,
      empresaId: a.empresaId,
      /* A chave é a MESMA do sync do Stripe (`STRIPE:<sub>`), porque é a mesma
         assinatura. Com o prefixo `CALLFACE_AI:` os dois sincronizadores
         gravavam duas linhas para uma assinatura só — o conflito nunca batia —
         e o cliente aparecia com o produto duplicado. Medido em 23/10/2026:
         30 pares exatamente assim, um com o valor real e outro zerado. */
      canonicalKey: `STRIPE:${a.id}`,
      serviceFamily: classificarProdutoPorNome(a.produto),
      canonicalProduct: a.produto,
      // Fora do portfólio e sem natureza de receita: não entra em MRR nem na carteira.
      revenueNature: "UNKNOWN",
      billingSource: "CALLFACE_AI",
      commercialLifecycle: ciclo,
      billingStatus: VIVA.has(a.status) ? "ACTIVE" : "CANCELED",
      currentRecurringValue: "0",
      currentSubscriptionId: a.id,
      portfolioIncluded: false,
      confidence: "CONFIRMED",
      evidence: { origem: "assinatura_do_saas", status_stripe: a.status, em: new Date().toISOString() },
    })
    .onConflictDoUpdate({
      target: [servicosCanonicos.organizacaoId, servicosCanonicos.canonicalKey],
      set: {
        commercialLifecycle: ciclo,
        billingStatus: VIVA.has(a.status) ? "ACTIVE" : "CANCELED",
        /* Preenche o produto/família quando o gravado está vazio e agora se
           sabe o nome — nunca por cima de um valor que já diz algo. */
        serviceFamily: sql`CASE WHEN ${servicosCanonicos.serviceFamily} IN ('UNKNOWN','') OR ${servicosCanonicos.serviceFamily} IS NULL
                                THEN ${classificarProdutoPorNome(a.produto)} ELSE ${servicosCanonicos.serviceFamily} END`,
        canonicalProduct: sql`COALESCE(${servicosCanonicos.canonicalProduct}, ${a.produto})`,
        updatedAt: new Date(),
      },
      /* Só quando o estado MUDA ou o produto ainda não é conhecido. Sem isto o sync reescreveria a mesma linha de
         30 em 30 minutos e `updated_at` diria "mexido agora" para sempre — o
         mesmo defeito que a guarda do encerramento já evita do outro lado. */
      setWhere: sql`${servicosCanonicos.commercialLifecycle} IS DISTINCT FROM ${ciclo}
                    OR (${a.produto}::text IS NOT NULL AND ${servicosCanonicos.canonicalProduct} IS NULL)`,
    });
}

/** Quantos serviços do SaaS esta organização reconhece hoje (para o log do sync). */
export async function contarReconhecidos(organizacaoId: string): Promise<number> {
  const [r] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM servicos_canonicos
     WHERE organizacao_id = ${organizacaoId}::uuid AND billing_source = 'CALLFACE_AI'`)) as unknown as Array<{ n: number }>;
  return r?.n ?? 0;
}
