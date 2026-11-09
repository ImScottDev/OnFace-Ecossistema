/**
 * Smoke de ponta a ponta da venda de autoatendimento (09/11/2026).
 *
 * Roda contra um banco de VERDADE (homologação) com uma assinatura inventada —
 * não toca o Stripe. Prova o que os testes puros não alcançam:
 *   1. nasce empresa, contato, serviço, venda ganha e Cliente 360;
 *   2. a venda sai com a marca `self_checkout`, sem responsável, com o valor e a
 *      data da assinatura;
 *   3. chamar de novo NÃO cria segunda venda (índice único da migration 0146);
 *   4. a mesma empresa não é criada duas vezes.
 *
 * Apaga o que criou no fim. Recusa rodar contra o banco de produção.
 *
 *   DATABASE_URL=... npx tsx src/scripts/smoke-venda-de-autoatendimento.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarVendaDeAutoatendimento } from "@/lib/vendas/venda-de-autoatendimento";

const marca = Date.now().toString(36);
const SUB = `sub_smoke_${marca}`;
const CUS = `cus_smoke_${marca}`;
const NOME = `Smoke Autoatendimento ${marca}`;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (/callface_crm_mz/.test(url)) throw new Error("este smoke cria e apaga dado: não rode contra produção");

  const [org] = (await db.execute(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`)) as unknown as Array<{ id: string }>;
  if (!org) throw new Error("sem organização");

  const inicio = new Date();
  const assinatura = {
    id: SUB, status: "active", inicio, valorMensal: 269.8, produto: "Callface AI - Starter",
    customer: { id: CUS, name: NOME, email: `${marca}@smoke.exemplo`, phone: "+5511999999999", metadata: {} },
  };

  const primeira = await registrarVendaDeAutoatendimento(org.id, assinatura);
  console.log("1ª chamada:", primeira);
  if (!primeira.criou) throw new Error("FALHOU: a venda não foi criada");

  const segunda = await registrarVendaDeAutoatendimento(org.id, assinatura);
  console.log("2ª chamada:", segunda);
  if (segunda.criou) throw new Error("FALHOU: criou venda duplicada");

  const [v] = (await db.execute(sql`
    SELECT n.titulo, n.status, n.origem_negocio, n.mrr_fechado::text, n.valor_total::text,
           n.responsavel_id IS NULL AS sem_responsavel, n.servico_origem_id IS NOT NULL AS ligado_a_assinatura,
           (n.ganho_at AT TIME ZONE 'America/Sao_Paulo')::date::text AS ganho,
           (SELECT count(*)::int FROM empresas e WHERE e.nome = ${NOME}) AS empresas,
           (SELECT count(*)::int FROM pessoas p WHERE p.empresa_id = n.empresa_id) AS pessoas,
           (SELECT count(*)::int FROM clientes c WHERE c.empresa_id = n.empresa_id) AS cliente360,
           (SELECT count(*)::int FROM servicos_canonicos s WHERE s.current_subscription_id = ${SUB}) AS servicos
      FROM negocios n WHERE n.id = ${primeira.negocioId}::uuid
  `)) as unknown as Array<Record<string, unknown>>;
  console.log("venda criada:", v);

  const problemas: string[] = [];
  if (v.origem_negocio !== "self_checkout") problemas.push("origem errada");
  if (v.status !== "ganho") problemas.push("não nasceu ganha");
  if (Number(v.mrr_fechado) !== 269.8) problemas.push("mensalidade errada");
  if (!v.sem_responsavel) problemas.push("nasceu com responsável");
  if (!v.ligado_a_assinatura) problemas.push("sem vínculo com a assinatura");
  if (v.empresas !== 1) problemas.push(`empresa criada ${v.empresas}x`);
  if (Number(v.pessoas) < 1) problemas.push("sem contato");
  if (v.cliente360 !== 1) problemas.push("sem Cliente 360");
  if (Number(v.servicos) < 1) problemas.push("sem serviço canônico");

  // Limpeza: tudo que este smoke criou, na ordem das dependências.
  await db.execute(sql`DELETE FROM negocios WHERE id = ${primeira.negocioId}::uuid`);
  await db.execute(sql`DELETE FROM clientes WHERE empresa_id = ${primeira.empresaId}::uuid`);
  await db.execute(sql`DELETE FROM servicos_canonicos WHERE current_subscription_id = ${SUB}`);
  await db.execute(sql`DELETE FROM aquisicoes WHERE organizacao_id = ${org.id}::uuid AND empresa_id = ${primeira.empresaId}::uuid`);
  await db.execute(sql`DELETE FROM pessoas WHERE empresa_id = ${primeira.empresaId}::uuid`);
  await db.execute(sql`DELETE FROM leads WHERE stripe_customer_id = ${CUS}`);
  await db.execute(sql`DELETE FROM empresas WHERE id = ${primeira.empresaId}::uuid`);
  console.log("limpeza feita");

  if (problemas.length > 0) { console.error("FALHOU:", problemas.join(" · ")); process.exit(1); }
  console.log("OK");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
