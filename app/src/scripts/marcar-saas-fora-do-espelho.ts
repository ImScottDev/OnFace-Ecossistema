/**
 * Marca como "não é do CRM" as assinaturas e faturas do SaaS Callface que o sync
 * do Stripe espelhou por engano (conta Stripe compartilhada; regra em
 * lib/integrations/stripe-origem.ts). Marca, não apaga: grava
 * `fora_do_espelho_em` (migration 0119) e guarda a linha inteira em
 * `_saas_fora_do_espelho_20261013` antes.
 *
 * Só LÊ o Stripe (GET) e só escreve no banco do CRM.
 *
 * Uso (na raiz de app/):
 *   npx tsx --env-file=.env src/scripts/marcar-saas-fora-do-espelho.ts            # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/marcar-saas-fora-do-espelho.ts --aplicar  # escreve, em UMA transação
 *
 * Idempotente: linha já marcada não é remarcada nem tem o backup sobrescrito.
 * Objeto sem marca ou com marca dos dois lados NÃO é tocado; só é contado.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ehDoSaas, origemDaAssinatura, origemDaFatura, type OrigemDecidida } from "@/lib/integrations/stripe-origem";

const BACKUP = "_saas_fora_do_espelho_20261013";
const VIVAS = ["active", "past_due", "unpaid", "trialing"];
const aplicar = process.argv.includes("--aplicar");

async function listar<T extends { id: string }>(path: string, params: Record<string, string>): Promise<T[]> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada");
  const out: T[] = [];
  let depois: string | undefined;
  for (;;) {
    const u = new URL(`https://api.stripe.com/v1/${path}`);
    for (const [k, v] of Object.entries({ ...params, limit: "100", "expand[]": "data.customer" })) u.searchParams.set(k, v);
    if (depois) u.searchParams.set("starting_after", depois);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Stripe ${path}: HTTP ${r.status}`);
    const j = (await r.json()) as { data: T[]; has_more: boolean };
    out.push(...j.data);
    if (!j.has_more) return out;
    depois = j.data[j.data.length - 1].id;
  }
}

const in_ = (ids: string[]) => sql.join(ids.map((i) => sql`${i}`), sql`, `);
const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

async function main() {
  const subs = await listar<Parameters<typeof origemDaAssinatura>[0] & { id: string }>("subscriptions", { status: "all" });
  const invs = await listar<Parameters<typeof origemDaFatura>[0] & { id: string }>("invoices", {});
  const subOrigem = new Map<string, OrigemDecidida>(subs.map((s) => [s.id, origemDaAssinatura(s)]));
  const invOrigem = new Map<string, OrigemDecidida>(invs.map((i) => [i.id, origemDaFatura(i)]));
  const saasSubs = [...subOrigem].filter(([, o]) => ehDoSaas(o)).map(([id]) => id);
  const saasInvs = [...invOrigem].filter(([, o]) => ehDoSaas(o)).map(([id]) => id);

  // Linhas do espelho que são do SaaS e ainda não foram marcadas.
  const colunas = await rows<{ n: string }>(sql`SELECT count(*)::text n FROM information_schema.columns WHERE table_name IN ('assinaturas','faturas') AND column_name = 'fora_do_espelho_em'`);
  if (Number(colunas[0].n) < 2) throw new Error("migration 0119 não aplicada (coluna fora_do_espelho_em)");

  const ass = saasSubs.length === 0 ? [] : await rows<{ id: string; stripe_subscription_id: string; status: string; mrr: string; ja: boolean }>(sql`
    SELECT id, stripe_subscription_id, status, COALESCE(mrr,0)::text mrr, fora_do_espelho_em IS NOT NULL ja
      FROM assinaturas WHERE stripe_subscription_id IN (${in_(saasSubs)})`);
  const fat = saasInvs.length === 0 ? [] : await rows<{ id: string; status: string; valor: string; ja: boolean }>(sql`
    SELECT id, status, valor::text, fora_do_espelho_em IS NOT NULL ja
      FROM faturas WHERE origem = 'stripe' AND external_id IN (${in_(saasInvs)})`);

  const novasAss = ass.filter((a) => !a.ja);
  const novasFat = fat.filter((f) => !f.ja);
  const vivas = novasAss.filter((a) => VIVAS.includes(a.status));
  const abertas = novasFat.filter((f) => f.status === "aberta" || f.status === "uncollectible");

  // O que fica no espelho sem marca do CRM: mantido e sinalizado, nunca descartado.
  const restantes = await rows<{ stripe_subscription_id: string; status: string; mrr: string }>(sql`
    SELECT stripe_subscription_id, status, COALESCE(mrr,0)::text mrr FROM assinaturas WHERE fora_do_espelho_em IS NULL`);
  const naoMarcadas: Record<string, { n: number; vivas: number; mrr_vivo: number }> = {};
  for (const r of restantes) {
    const o = subOrigem.get(r.stripe_subscription_id)?.origem ?? "nao_no_stripe";
    if (o === "crm" || o === "saas") continue; // saas aqui = a marcar nesta rodada
    const x = (naoMarcadas[o] ||= { n: 0, vivas: 0, mrr_vivo: 0 });
    x.n++;
    if (VIVAS.includes(r.status)) { x.vivas++; x.mrr_vivo += Number(r.mrr); }
  }

  console.log(`\n=== ${aplicar ? "APLICAR" : "SIMULAÇÃO"} ===`);
  console.log(`Stripe: ${subs.length} assinaturas (${saasSubs.length} do SaaS), ${invs.length} faturas (${saasInvs.length} do SaaS)`);
  console.log(`Assinaturas a marcar: ${novasAss.length} (já marcadas: ${ass.length - novasAss.length})`);
  const porEv = (l: typeof novasAss) => `objeto=${l.filter((a) => subOrigem.get(a.stripe_subscription_id)?.evidencia === "objeto").length} cliente(inferido)=${l.filter((a) => subOrigem.get(a.stripe_subscription_id)?.evidencia === "cliente").length}`;
  console.log(`  evidência: ${porEv(novasAss)}`);
  const porStatus: Record<string, { n: number; mrr: number }> = {};
  for (const a of novasAss) { const s = (porStatus[a.status] ||= { n: 0, mrr: 0 }); s.n++; s.mrr += Number(a.mrr); }
  console.table(porStatus);
  console.log(`  vivas (${VIVAS.join("/")}): ${vivas.length}, MRR ${brl(vivas.reduce((t, a) => t + Number(a.mrr), 0))}`);
  console.log(`Faturas a marcar: ${novasFat.length} (já marcadas: ${fat.length - novasFat.length}); abertas/uncollectible: ${abertas.length}, ${brl(abertas.reduce((t, f) => t + Number(f.valor), 0))}`);
  console.log(`Assinaturas que ficam SEM marca do CRM (mantidas, para revisão):`);
  console.table(naoMarcadas);

  if (!aplicar) return console.log("\nNada foi escrito. Use --aplicar para gravar.");

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${BACKUP} (
      tabela text NOT NULL, linha_id uuid NOT NULL, linha jsonb NOT NULL, feito_em timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tabela, linha_id))`));
    if (novasAss.length) {
      const ids = in_(novasAss.map((a) => a.id));
      await tx.execute(sql`INSERT INTO ${sql.raw(BACKUP)} (tabela, linha_id, linha)
        SELECT 'assinaturas', a.id, to_jsonb(a) FROM assinaturas a WHERE a.id IN (${ids}) ON CONFLICT DO NOTHING`);
      await tx.execute(sql`UPDATE assinaturas SET fora_do_espelho_em = now(), fora_do_espelho_motivo = 'saas_callface', updated_at = updated_at
        WHERE id IN (${ids}) AND fora_do_espelho_em IS NULL`);
    }
    if (novasFat.length) {
      const ids = in_(novasFat.map((f) => f.id));
      await tx.execute(sql`INSERT INTO ${sql.raw(BACKUP)} (tabela, linha_id, linha)
        SELECT 'faturas', f.id, to_jsonb(f) FROM faturas f WHERE f.id IN (${ids}) ON CONFLICT DO NOTHING`);
      await tx.execute(sql`UPDATE faturas SET fora_do_espelho_em = now(), fora_do_espelho_motivo = 'saas_callface', updated_at = updated_at
        WHERE id IN (${ids}) AND fora_do_espelho_em IS NULL`);
    }
  });
  console.log(`\nMarcadas ${novasAss.length} assinaturas e ${novasFat.length} faturas. Backup em ${BACKUP}.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
