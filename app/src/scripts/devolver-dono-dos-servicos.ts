/**
 * Devolve o dono às assinaturas presas na empresa-balde "Unresolved billing identity".
 *
 * ## Por que elas estão presas
 *
 * Até 15/10/2026 o sync do Stripe só achava o dono de uma assinatura pelo
 * `stripe_customer_id` ou pelo e-mail do Customer. E-mail de cobrança diferente
 * do contato da proposta ⇒ a assinatura caía num registro guarda-chuva. A
 * correção (`resolveBillingCustomer` lendo `negocioId`/`propostaId` da própria
 * assinatura) já está em produção e funciona: o sync fecha 326 assinaturas com
 * 3 sem lead.
 *
 * Mas o sync só ATUALIZA valor e status de uma chave canônica que já existe —
 * ele não reavalia de quem ela é. As linhas criadas antes da correção ficaram
 * apontando para o balde para sempre, e com elas R$ 7.355,50/mês de assinatura
 * ATIVA que não aparece em nenhuma ficha de cliente, nem em Cliente 360, nem no
 * uso do Callface AI.
 *
 * ## O que este script faz
 *
 * Para cada assinatura presa, pergunta ao `resolveBillingCustomer` de hoje de
 * quem ela é e, só quando a resposta é CONFIRMED e tem empresa, re-aponta o
 * serviço canônico para essa empresa e esse lead.
 *
 * Regras que ele não quebra:
 *  - **Só CONFIRMED.** REVIEW e UNRESOLVED ficam onde estão: identidade de
 *    cobrança duvidosa é decisão humana, e o plano diz que nome nunca decide.
 *  - **Só com empresa.** Lead sem empresa não rende ficha de cliente; mover
 *    para `empresa_id` nulo trocaria um buraco por outro.
 *  - **Não cria, não apaga, não cancela nada no Stripe.** Só muda a quem o
 *    serviço pertence dentro do CRM.
 *  - **Guarda como desfazer:** `evidence.devolucao_de_dono` registra a empresa
 *    anterior, a fonte da prova e a data.
 *
 * Simula por padrão. `--aplicar` grava.
 *
 *   npx tsx src/scripts/devolver-dono-dos-servicos.ts            # só mostra
 *   npx tsx src/scripts/devolver-dono-dos-servicos.ts --aplicar  # grava
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveBillingCustomer } from "@/lib/integrations/billing-identity";
import { stripe } from "@/lib/integrations/stripe-assinatura";

const EMPRESA_BALDE = "Unresolved billing identity";

type Assin = {
  metadata?: Record<string, string>;
  customer: string | { id: string; email?: string | null; metadata?: Record<string, string> };
};

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  console.log(aplicar ? "APLICANDO (grava no banco)\n" : "SIMULAÇÃO — nada é alterado (use --aplicar)\n");

  const linhas = (await db.execute(sql`
    SELECT s.id::text, s.organizacao_id::text AS org, s.empresa_id::text AS empresa_antiga,
           s.current_subscription_id AS sub, s.current_recurring_value::text AS valor,
           s.commercial_lifecycle AS ciclo
      FROM servicos_canonicos s JOIN empresas e ON e.id = s.empresa_id
     WHERE e.nome = ${EMPRESA_BALDE}
       AND s.current_subscription_id IS NOT NULL AND s.current_subscription_id <> ''
     ORDER BY s.current_recurring_value DESC
  `)) as unknown as Array<{ id: string; org: string; empresa_antiga: string; sub: string; valor: string; ciclo: string }>;

  let movidos = 0, mrrDevolvido = 0;
  const parados: string[] = [];

  for (const l of linhas) {
    const assinatura = await stripe<Assin>(`subscriptions/${l.sub}?expand[]=customer`);
    const c = assinatura.customer;
    const customer = typeof c === "string"
      ? { id: c, assinaturaMetadata: assinatura.metadata }
      : { id: c.id, email: c.email ?? undefined, metadata: c.metadata, assinaturaMetadata: assinatura.metadata };

    const r = await resolveBillingCustomer(l.org, customer);
    if (r.kind !== "CONFIRMED" || !r.empresaId) {
      parados.push(`${l.sub} R$ ${l.valor} — ${r.kind}${r.kind === "CONFIRMED" ? " sem empresa" : ""}`);
      continue;
    }

    const [emp] = (await db.execute(sql`SELECT nome FROM empresas WHERE id = ${r.empresaId}::uuid`)) as unknown as Array<{ nome: string }>;
    const ativa = l.ciclo === "ACTIVE";
    console.log(`${l.sub}  R$ ${Number(l.valor).toFixed(2).padStart(9)}  ${ativa ? "ATIVA " : "encerr"}  → ${emp?.nome ?? r.empresaId}  (${r.source})`);

    if (aplicar) {
      await db.execute(sql`
        UPDATE servicos_canonicos
           SET empresa_id = ${r.empresaId}::uuid,
               lead_id = coalesce(${r.leadId ?? null}::uuid, lead_id),
               updated_at = now(),
               evidence = coalesce(evidence, '{}'::jsonb) || ${JSON.stringify({
                 devolucao_de_dono: {
                   em: new Date().toISOString(),
                   empresa_anterior: l.empresa_antiga,
                   empresa_anterior_nome: EMPRESA_BALDE,
                   fonte: r.source,
                   script: "devolver-dono-dos-servicos",
                 },
               })}::jsonb
         WHERE id = ${l.id}::uuid
      `);
    }
    movidos++;
    if (ativa) mrrDevolvido += Number(l.valor);
  }

  console.log(`\n${movidos} serviços ${aplicar ? "devolvidos" : "seriam devolvidos"} ao dono · MRR ativo: R$ ${mrrDevolvido.toFixed(2)}`);
  if (parados.length) {
    console.log(`\n${parados.length} ficam no balde (decisão humana, por desenho):`);
    for (const p of parados) console.log(`  ${p}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
