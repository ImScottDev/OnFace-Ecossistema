/**
 * Confere a assinatura no Stripe contra a última proposta ACEITA de cada negócio
 * ganho. Existe porque o CRM nunca reconcilia depois do checkout: se a
 * assinatura mudar no Stripe (ou tiver nascido errada), ninguém percebe.
 *
 * Casa pelo `leads.stripe_customer_id`, não pelo contrato — parte dos contratos
 * ficou sem `stripe_subscription_id` gravado.
 *
 * Classifica cada caso:
 *   colapso-qtd  assinatura com quantity=1 e unit_amount igual ao SUBTOTAL do
 *                item. É o bug do checkout anterior a 24/07/2026, que mandava
 *                `quantidade: 1` e jogava o subtotal no valor unitário. O total
 *                cobrado está certo, a quantidade não — e é a quantidade que
 *                libera acesso do lado da plataforma.
 *   sem-vinculo  a assinatura existe e bate, mas o contrato não guarda o sub id.
 *   divergente   quantidade ou total diferentes por outro motivo (mexeram na
 *                assinatura direto no Stripe, ou a proposta mudou depois).
 *
 * Uso:
 *   npx tsx --env-file=.env src/scripts/auditar-assinaturas-stripe.ts [--json]
 *   ... --corrigir-colapso [sub_...]   reescreve quantidade/valor unitário no
 *                                      Stripe mantendo o total (sem proration)
 *   ... --vincular                     grava o sub id nos contratos sem vínculo
 *
 * "divergente" nunca é corrigido automaticamente: pode ser upsell legítimo.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { contratos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const STRIPE_API = "https://api.stripe.com/v1";
const VIVAS = ["active", "past_due", "trialing", "unpaid"];

const centavos = (v: unknown) => Math.round(Number(v) * 100);

interface LinhaCrm {
  customer: string;
  sub: string | null;
  contrato_id: string | null;
  numero: number;
  cliente: string | null;
  item: string;
  quantidade: string;
  valor_unitario: string;
  subtotal: string;
}

interface ItemStripe {
  id: string;
  quantity: number;
  price: { unit_amount: number; product: string; currency: string; recurring?: { interval: string } };
}

async function stripe(path: string, body?: URLSearchParams) {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
  });
  if (!res.ok) throw new Error(`Stripe ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function carregarCrm(): Promise<LinhaCrm[]> {
  // Uma proposta por negócio: a última versão aceita.
  // O driver postgres.js devolve o array direto; node-postgres devolve { rows }.
  const res = await db.execute(sql`
    with ultima as (
      select distinct on (n.id) n.id as negocio_id, p.id as proposta_id, p.numero, n.lead_id
      from negocios n
      join propostas p on p.negocio_id = n.id and p.status = 'aceita'
      where n.status = 'ganho'
      order by n.id, p.versao desc nulls last, p.created_at desc
    )
    select l.stripe_customer_id as customer,
           c.stripe_subscription_id as sub,
           c.id as contrato_id,
           u.numero, l.nome as cliente,
           pi.nome as item, pi.quantidade, pi.valor_unitario, pi.subtotal
    from ultima u
    join leads l on l.id = u.lead_id and l.stripe_customer_id is not null
    join proposta_itens pi on pi.proposta_id = u.proposta_id and pi.tipo = 'recorrente'
    left join contratos c on c.negocio_id = u.negocio_id
  `);
  return (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as LinhaCrm[];
}

async function main() {
  const json = process.argv.includes("--json");
  const vincular = process.argv.includes("--vincular");
  const iCorrigir = process.argv.indexOf("--corrigir-colapso");
  const corrigir = iCorrigir >= 0;
  const alvo = corrigir ? process.argv[iCorrigir + 1]?.startsWith("sub_") ? process.argv[iCorrigir + 1] : null : null;

  const linhas = await carregarCrm();
  const porCliente = new Map<string, { numero: number; cliente: string | null; sub: string | null; contratoId: string | null; itens: LinhaCrm[] }>();
  for (const l of linhas) {
    if (!porCliente.has(l.customer)) {
      porCliente.set(l.customer, { numero: l.numero, cliente: l.cliente, sub: l.sub, contratoId: l.contrato_id, itens: [] });
    }
    porCliente.get(l.customer)!.itens.push(l);
  }

  const casos: Record<string, unknown>[] = [];

  for (const [customer, crm] of porCliente) {
    let assinaturas: { id: string; status: string; items: { data: ItemStripe[] } }[];
    try {
      assinaturas = (
        await stripe(`/subscriptions?customer=${customer}&status=all&limit=10&expand[]=data.items.data.price`)
      ).data;
    } catch (e) {
      casos.push({ tipo: "erro", customer, proposta: crm.numero, erro: String(e) });
      continue;
    }

    for (const s of assinaturas.filter((a) => VIVAS.includes(a.status))) {
      const qtdCrm = crm.itens.reduce((a, i) => a + Number(i.quantidade), 0);
      const totalCrm = crm.itens.reduce((a, i) => a + Number(i.subtotal), 0);
      const qtdStripe = s.items.data.reduce((a, i) => a + (i.quantity || 0), 0);
      const totalStripe = s.items.data.reduce((a, i) => a + (i.price.unit_amount * (i.quantity || 0)) / 100, 0);

      // Só item com quantidade > 1 na proposta pode ter sofrido o colapso.
      const subtotaisMulti = new Set(crm.itens.filter((i) => Number(i.quantidade) > 1).map((i) => centavos(i.subtotal)));
      const colapsados = s.items.data.filter((i) => (i.quantity || 0) === 1 && subtotaisMulti.has(i.price.unit_amount));
      const semVinculo = crm.sub !== s.id;
      const bate = qtdCrm === qtdStripe && centavos(totalCrm) === centavos(totalStripe);

      if (bate && !semVinculo) continue;

      const tipo = colapsados.length > 0 ? "colapso-qtd" : bate && semVinculo ? "sem-vinculo" : "divergente";
      casos.push({
        tipo, proposta: crm.numero, cliente: crm.cliente, customer, sub: s.id, status: s.status,
        contratoId: crm.contratoId, subNoContrato: crm.sub,
        crm: { qtd: qtdCrm, total: Number(totalCrm.toFixed(2)), itens: crm.itens.map((i) => `${Number(i.quantidade)}x ${i.item} @${i.valor_unitario} = ${i.subtotal}`) },
        stripe: { qtd: qtdStripe, total: Number(totalStripe.toFixed(2)), itens: s.items.data.map((i) => ({ item: i.id, qty: i.quantity, unit: i.price.unit_amount / 100, produto: i.price.product })) },
      });

      if (tipo === "colapso-qtd" && corrigir && (!alvo || alvo === s.id)) {
        for (const item of colapsados) {
          const origem = crm.itens.find((i) => centavos(i.subtotal) === item.price.unit_amount && Number(i.quantidade) > 1)!;
          const qtd = Math.round(Number(origem.quantidade));
          const unitario = Math.round(item.price.unit_amount / qtd);
          if (unitario * qtd !== item.price.unit_amount) {
            console.log(`  ! ${s.id} ${item.id}: ${item.price.unit_amount} não divide por ${qtd} — pulando (mexer à mão)`);
            continue;
          }
          const form = new URLSearchParams();
          form.append("items[0][id]", item.id);
          form.append("items[0][quantity]", String(qtd));
          form.append("items[0][price_data][currency]", item.price.currency);
          form.append("items[0][price_data][product]", item.price.product);
          form.append("items[0][price_data][unit_amount]", String(unitario));
          form.append("items[0][price_data][recurring][interval]", item.price.recurring?.interval || "month");
          // Total mensal não muda — nada a reproporcionar, nem cobrança extra agora.
          form.append("proration_behavior", "none");
          await stripe(`/subscriptions/${s.id}`, form);
          console.log(`  corrigido ${s.id} ${item.id}: 1x ${item.price.unit_amount / 100} -> ${qtd}x ${unitario / 100}`);
        }
      }

      if (semVinculo && vincular && crm.contratoId && (tipo === "sem-vinculo" || tipo === "colapso-qtd")) {
        await db.update(contratos).set({ stripeSubscriptionId: s.id }).where(eq(contratos.id, crm.contratoId));
        console.log(`  vinculado contrato ${crm.contratoId} -> ${s.id}`);
      }
    }
  }

  if (json) {
    console.log(JSON.stringify(casos, null, 2));
  } else {
    for (const tipo of ["colapso-qtd", "sem-vinculo", "divergente", "erro"]) {
      const bloco = casos.filter((c) => c.tipo === tipo);
      if (bloco.length === 0) continue;
      console.log(`\n===== ${tipo} (${bloco.length}) =====`);
      for (const c of bloco as any[]) {
        console.log(
          `P-${c.proposta} ${String(c.cliente).slice(0, 20).padEnd(20)} ${c.sub} ${String(c.status).padEnd(8)} ` +
            `CRM ${c.crm?.qtd}un R$${c.crm?.total} -> STRIPE ${c.stripe?.qtd}un R$${c.stripe?.total}`,
        );
      }
    }
  }
  const cont: Record<string, number> = {};
  for (const c of casos) cont[String(c.tipo)] = (cont[String(c.tipo)] || 0) + 1;
  console.error(`\nresumo: ${JSON.stringify(cont)} de ${porCliente.size} clientes analisados`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
