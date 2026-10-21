/**
 * Quem é o dono das assinaturas presas na empresa-balde "Unresolved billing identity"?
 *
 * O sync do Stripe já resolve a identidade pela metadata da assinatura
 * (`negocioId`/`propostaId`) desde a correção de 15/10 — hoje ele fecha 326
 * assinaturas com apenas 3 sem lead. Mas as linhas de `servicos_canonicos`
 * criadas ANTES dessa correção continuam apontando para a empresa-balde: o
 * sync atualiza valor e status da chave que já existe, e não reavalia de quem
 * ela é. Por isso R$ 7.535/mês de assinatura ativa não aparece em nenhuma
 * ficha de cliente.
 *
 * Este script só LÊ (Stripe em GET, banco em SELECT) e imprime o que o
 * `resolveBillingCustomer` de hoje responderia para cada uma. Nada é alterado:
 * é o retrato que decide se dá para re-apontar em lote ou se é caso a caso.
 *
 *   npx tsx src/scripts/diagnosticar-servicos-sem-dono.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveBillingCustomer } from "@/lib/integrations/billing-identity";
import { stripe } from "@/lib/integrations/stripe-assinatura";

const EMPRESA_BALDE = "Unresolved billing identity";

async function main() {
  const linhas = (await db.execute(sql`
    SELECT s.id::text, s.organizacao_id::text AS org, s.current_subscription_id AS sub,
           s.current_recurring_value::text AS valor, s.commercial_lifecycle AS ciclo, s.canonical_key AS chave
      FROM servicos_canonicos s JOIN empresas e ON e.id = s.empresa_id
     WHERE e.nome = ${EMPRESA_BALDE}
       AND s.current_subscription_id IS NOT NULL AND s.current_subscription_id <> ''
     ORDER BY s.current_recurring_value DESC
  `)) as unknown as Array<{ id: string; org: string; sub: string; valor: string; ciclo: string; chave: string }>;

  console.log(`${linhas.length} assinaturas presas na empresa-balde\n`);
  const resumo = { confirmado: 0, revisao: 0, sem: 0, erro: 0 };
  let mrrRecuperavel = 0;

  for (const l of linhas) {
    try {
      type Assin = { metadata?: Record<string, string>; customer: string | { id: string; email?: string | null; metadata?: Record<string, string> } };
      const assinatura = await stripe<Assin>(`subscriptions/${l.sub}?expand[]=customer`);
      const c = assinatura.customer;
      const customer = typeof c === "string"
        ? { id: c, assinaturaMetadata: assinatura.metadata }
        : { id: c.id, email: c.email ?? undefined, metadata: c.metadata, assinaturaMetadata: assinatura.metadata };

      const r = await resolveBillingCustomer(l.org, customer);
      let nomeEmpresa = "—";
      if (r.kind === "CONFIRMED" && r.empresaId) {
        const [e] = (await db.execute(sql`SELECT nome FROM empresas WHERE id = ${r.empresaId}::uuid`)) as unknown as Array<{ nome: string }>;
        nomeEmpresa = e?.nome ?? "(empresa sem nome)";
      }
      const ativo = l.ciclo === "ACTIVE";
      if (r.kind === "CONFIRMED") {
        resumo.confirmado++;
        if (ativo) mrrRecuperavel += Number(l.valor);
      } else if (r.kind === "REVIEW") resumo.revisao++;
      else resumo.sem++;

      console.log(
        `${l.sub}  R$ ${Number(l.valor).toFixed(2).padStart(9)}  ${ativo ? "ATIVA " : "encerr"}  ` +
        `${r.kind.padEnd(9)} ${("source" in r ? r.source : "—").toString().padEnd(14)} ${nomeEmpresa}`,
      );
    } catch (e) {
      resumo.erro++;
      console.log(`${l.sub}  ERRO: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\nconfirmado: ${resumo.confirmado} · revisão: ${resumo.revisao} · sem dono: ${resumo.sem} · erro: ${resumo.erro}`);
  console.log(`MRR ativo com dono identificável: R$ ${mrrRecuperavel.toFixed(2)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
