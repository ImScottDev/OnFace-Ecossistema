// Harness de verificação: `condicao ? ok(...) : falha(...)` é deliberado.
/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Catálogo Oficial Stripe -> CRM2: validação dos testes manuais esperados
 * (item 11 do briefing), com dado real no banco de dev.
 *
 * Cria propostas ZZTESTECAT, confere o que ficou gravado e limpa tudo no fim.
 * Nenhuma chamada ao Stripe, nenhuma cobrança.
 *
 *   npx tsx --env-file=.env src/scripts/validar-catalogo-oficial.ts
 */
import { db } from "@/lib/db";
import { and, eq, inArray, like, sql, asc } from "drizzle-orm";
import {
  organizacoes, usuarios, pipelines, empresas, leads, negocios, propostas, propostaItens,
  servicosCatalogo, catalogoPrecos, oportunidades, oportunidadeItens, propostaGrupoComercial,
  propostaGrupoComercialItens, contratos, checkouts, atividades, statusChanges, negocioLeads, comercialEvidencia,
  pessoas, pontosContato, clientes,
} from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";

const TAG = "ZZTESTECAT";
const falhas: string[] = [];
const ok = (t: string) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const falha = (t: string) => { console.log(`  \x1b[31m✗ ${t}\x1b[0m`); falhas.push(t); };
const info = (t: string) => console.log(`    ${t}`);

async function limpar() {
  const ps = await db.select({ id: propostas.id, negocioId: propostas.negocioId, leadId: propostas.leadId })
    .from(propostas).where(like(propostas.observacoes, `${TAG}%`));
  const propostaIds = ps.map((p) => p.id);
  const negocioIds = [...new Set(ps.map((p) => p.negocioId).filter((v): v is string => !!v))];
  const leadIds = [...new Set(ps.map((p) => p.leadId).filter((v): v is string => !!v))];
  const ls = await db.select({ id: leads.id, empresaId: leads.empresaId }).from(leads).where(like(leads.nome, `${TAG}%`));
  for (const l of ls) if (!leadIds.includes(l.id)) leadIds.push(l.id);
  const empresaIds = [...new Set(ls.map((l) => l.empresaId).filter((v): v is string => !!v))];
  const grupos = propostaIds.length ? (await db.select({ id: propostaGrupoComercial.id }).from(propostaGrupoComercial).where(inArray(propostaGrupoComercial.propostaId, propostaIds))).map((g) => g.id) : [];
  const oportIds = negocioIds.length ? (await db.select({ id: oportunidades.id }).from(oportunidades).where(inArray(oportunidades.negocioIdLegado, negocioIds))).map((o) => o.id) : [];

  // oportunidade_itens.grupo_comercial_id e catalogo_preco_id têm FK — os
  // itens caem antes do grupo, senão o DELETE do grupo é recusado.
  if (oportIds.length) await db.delete(oportunidadeItens).where(inArray(oportunidadeItens.oportunidadeId, oportIds));
  if (grupos.length) {
    await db.delete(comercialEvidencia).where(inArray(comercialEvidencia.grupoComercialId, grupos));
    await db.delete(propostaGrupoComercialItens).where(inArray(propostaGrupoComercialItens.grupoId, grupos));
    await db.update(propostaGrupoComercial).set({ contratoId: null, checkoutId: null }).where(inArray(propostaGrupoComercial.id, grupos));
    await db.delete(contratos).where(inArray(contratos.grupoComercialId, grupos));
    await db.delete(checkouts).where(inArray(checkouts.grupoComercialId, grupos));
    await db.delete(propostaGrupoComercial).where(inArray(propostaGrupoComercial.id, grupos));
  }
  if (propostaIds.length) { await db.delete(propostaItens).where(inArray(propostaItens.propostaId, propostaIds)); await db.delete(propostas).where(inArray(propostas.id, propostaIds)); }
  if (negocioIds.length) {
    await db.delete(atividades).where(inArray(atividades.negocioId, negocioIds));
    await db.delete(statusChanges).where(inArray(statusChanges.negocioId, negocioIds));
    await db.delete(negocioLeads).where(inArray(negocioLeads.negocioId, negocioIds));
    await db.delete(comercialEvidencia).where(inArray(comercialEvidencia.negocioId, negocioIds));
  }
  if (oportIds.length) await db.delete(oportunidades).where(inArray(oportunidades.id, oportIds));
  if (negocioIds.length) await db.delete(negocios).where(inArray(negocios.id, negocioIds));
  if (leadIds.length) {
    await db.delete(atividades).where(inArray(atividades.leadId, leadIds));
    await db.delete(statusChanges).where(inArray(statusChanges.leadId, leadIds));
    // `pessoas` e `clientes` nascem do dual-write do modelo de domínio v2 e
    // referenciam o lead — caem antes dele.
    const pessoaIds = (await db.select({ id: pessoas.id }).from(pessoas).where(inArray(pessoas.leadIdLegado, leadIds))).map((p) => p.id);
    if (pessoaIds.length) {
      await db.delete(pontosContato).where(inArray(pontosContato.pessoaId, pessoaIds));
      await db.delete(pessoas).where(inArray(pessoas.id, pessoaIds));
    }
    await db.delete(clientes).where(inArray(clientes.leadIdLegado, leadIds));
    await db.delete(leads).where(inArray(leads.id, leadIds));
  }
  if (empresaIds.length) {
    await db.delete(clientes).where(inArray(clientes.empresaId, empresaIds));
    await db.delete(empresas).where(inArray(empresas.id, empresaIds));
  }
}

/** Busca um price oficial pelo lookup_key — a chave estável da planilha. */
async function preco(lookupKey: string) {
  const [r] = await db
    .select({
      id: catalogoPrecos.id, valor: catalogoPrecos.valor, tipo: catalogoPrecos.tipo,
      variacao: catalogoPrecos.variacao, exigeContrato: catalogoPrecos.exigeContrato,
      revenueNature: catalogoPrecos.revenueNature, sku: catalogoPrecos.sku,
      stripePriceId: catalogoPrecos.stripePriceId,
      produtoId: servicosCatalogo.id, produtoNome: servicosCatalogo.nome,
      stripeProductId: servicosCatalogo.stripeProductId, serviceFamily: servicosCatalogo.serviceFamily,
    })
    .from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(eq(catalogoPrecos.lookupKey, lookupKey)).limit(1);
  if (!r) throw new Error(`price não encontrado pelo lookup_key: ${lookupKey}`);
  return r;
}

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const [user] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.organizacaoId, org.id)).limit(1);
  await limpar();

  console.log("\n=== 1. ESTRUTURA DO CATÁLOGO NO CRM\n");
  const arvore = await db.execute<{ familia: string; categoria: string; produto: string; precos: number; menor: string; maior: string }>(sql`
    SELECT sc.service_family AS familia, sc.categoria, sc.nome AS produto,
           COUNT(cp.id)::int AS precos, MIN(cp.valor)::text AS menor, MAX(cp.valor)::text AS maior
    FROM servicos_catalogo sc JOIN catalogo_precos cp ON cp.servico_catalogo_id = sc.id
    WHERE sc.origem_catalogo='oficial_stripe' AND sc.ativo AND cp.ativo
    GROUP BY 1,2,3 ORDER BY 1,2,3
  `);
  let famAtual = "";
  for (const r of arvore) {
    if (r.familia !== famAtual) { console.log(`  ${r.familia}`); famAtual = r.familia; }
    console.log(`    ${r.categoria.padEnd(12)} ${r.produto.padEnd(34)} ${String(r.precos).padStart(3)} price(s)  R$ ${r.menor} – ${r.maior}`);
  }

  console.log("\n=== 2. TESTES DO BUILDER\n");

  // Teste: Callface AI Starter tem mensal e anual
  const starterMensal = await preco("callface_ai_starter_mensal");
  const starterAnual = await preco("callface_ai_starter_anual");
  starterMensal.produtoId === starterAnual.produtoId
    ? ok(`Starter: mensal e anual no MESMO produto CRM (${starterMensal.produtoNome}) — 1 produto, 2 prices`)
    : falha("Starter mensal e anual em produtos CRM diferentes");
  info(`mensal R$ ${starterMensal.valor} · anual R$ ${starterAnual.valor} · product ${starterMensal.stripeProductId}`);

  // Teste: White Label Setup e Licença com faixas e contrato divergente
  const wlSetup = await preco("callface_ai_white_label_setup_faixa_1_1_a_99_licencas");
  const wlLic = await preco("callface_ai_white_label_licenca_faixa_1_1_a_99_licencas");
  const [{ n: faixasSetup }] = await db.select({ n: sql<number>`count(*)::int` }).from(catalogoPrecos).where(eq(catalogoPrecos.servicoCatalogoId, wlSetup.produtoId));
  const [{ n: faixasLic }] = await db.select({ n: sql<number>`count(*)::int` }).from(catalogoPrecos).where(eq(catalogoPrecos.servicoCatalogoId, wlLic.produtoId));
  Number(faixasSetup) === 4 && Number(faixasLic) === 4
    ? ok(`White Label: Setup com ${faixasSetup} faixas e Licença com ${faixasLic} faixas`)
    : falha(`White Label faixas: setup=${faixasSetup} licenca=${faixasLic}, esperado 4 e 4`);
  wlSetup.exigeContrato && !wlLic.exigeContrato
    ? ok("White Label: Setup exige contrato, Licença NÃO (regra 7 — licença isolada não precisa)")
    : falha(`White Label contrato: setup=${wlSetup.exigeContrato} licenca=${wlLic.exigeContrato}, esperado true e false`);
  wlSetup.tipo === "setup" && wlLic.tipo === "recorrente" && wlSetup.revenueNature === "SETUP" && wlLic.revenueNature === "MRR"
    ? ok(`White Label: Setup=${wlSetup.revenueNature}/único, Licença=${wlLic.revenueNature}/mensal (setup nunca vira MRR)`)
    : falha(`White Label naturezas: setup=${wlSetup.revenueNature}/${wlSetup.tipo} licenca=${wlLic.revenueNature}/${wlLic.tipo}`);

  // Teste: PABX por categoria
  const catsPabx = await db.execute<{ categoria: string; produtos: number; precos: number }>(sql`
    SELECT sc.categoria, COUNT(DISTINCT sc.id)::int AS produtos, COUNT(cp.id)::int AS precos
    FROM servicos_catalogo sc JOIN catalogo_precos cp ON cp.servico_catalogo_id = sc.id
    WHERE sc.origem_catalogo='oficial_stripe' AND sc.service_family='PABX' GROUP BY 1 ORDER BY 1
  `);
  const esperadas = ["canais", "hardware", "integracao", "linha", "minutos", "plano", "ramal", "servico", "setup"];
  const achadas = catsPabx.map((c) => c.categoria).sort();
  esperadas.every((e) => achadas.includes(e))
    ? ok(`PABX aparece em ${achadas.length} categorias: ${achadas.join(", ")}`)
    : falha(`PABX categorias faltando: ${esperadas.filter((e) => !achadas.includes(e)).join(", ")}`);

  console.log("\n=== 3. PROPOSTA COM ITEM RECORRENTE + AVULSO/SETUP + DESCONTO\n");
  const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} Cliente LTDA` }).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id, nome: `${TAG} Comprador`, email: "zztestecat@exemplo.invalid",
    empresaId: empresa.id, tipo: "lead", status: "qualified",
  }).returning({ id: leads.id });
  const [negocio] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id,
    titulo: `${TAG} venda`, status: "proposta_enviada", responsavelId: user.id,
  }).returning({ id: negocios.id });
  await syncOportunidadeFromNegocio(negocio.id);

  const pabxSetup = await preco((await db.select({ lk: catalogoPrecos.lookupKey }).from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(and(eq(servicosCatalogo.serviceFamily, "PABX"), eq(catalogoPrecos.tipo, "setup")))
    .orderBy(asc(catalogoPrecos.ordem)).limit(1))[0].lk!);

  // Desconto de 15% no recorrente; setup com valor negociado (desconto em valor).
  const DESC_PCT = 15;
  const propostaCriada = await criarPropostaComItens({
    organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, moeda: "BRL",
    observacoes: `${TAG} proposta de validação`, vencimentoDias: 15, prazoContratoMeses: 12,
    signatarios: [{ nome: `${TAG} Comprador`, email: "zztestecat@exemplo.invalid", papel: "signatario", ordem: 1 }],
    itens: [
      { catalogoPrecoId: starterMensal.id, servicoCatalogoId: starterMensal.produtoId, nome: `${starterMensal.produtoNome} — ${starterMensal.variacao}`,
        tipo: "recorrente", quantidade: 3, valorUnitario: parseFloat(starterMensal.valor), desconto: DESC_PCT, descontoTipo: "percentual" },
      { catalogoPrecoId: pabxSetup.id, servicoCatalogoId: pabxSetup.produtoId, nome: `${pabxSetup.produtoNome} — ${pabxSetup.variacao}`,
        tipo: "setup", quantidade: 1, valorUnitario: parseFloat(pabxSetup.valor), desconto: 0, descontoTipo: "percentual" },
    ],
    criadoPorId: user.id,
  });

  const itensGravados = await db.select().from(propostaItens).where(eq(propostaItens.propostaId, propostaCriada.id)).orderBy(asc(propostaItens.ordem));
  itensGravados.length === 2 ? ok("proposta criada com 2 itens (1 recorrente + 1 setup)") : falha(`${itensGravados.length} itens gravados`);

  const rec = itensGravados.find((i) => i.tipo === "recorrente")!;
  const set = itensGravados.find((i) => i.tipo === "setup")!;

  const camposOk = (i: typeof rec, esperado: typeof starterMensal, rotulo: string) => {
    const checks: [string, boolean][] = [
      ["stripe_product_id", i.stripeProductId === esperado.stripeProductId],
      ["stripe_price_id", i.stripePriceId === esperado.stripePriceId],
      ["sku_preco", i.skuPreco === esperado.sku],
      ["catalogo_preco_id", i.catalogoPrecoId === esperado.id],
      ["variacao", i.variacao === esperado.variacao],
      ["service_family", i.serviceFamily === esperado.serviceFamily],
      ["revenue_nature", i.revenueNature === esperado.revenueNature],
      ["valor_tabela", parseFloat(i.valorTabela || "0") === parseFloat(esperado.valor)],
    ];
    const ruins = checks.filter(([, v]) => !v).map(([k]) => k);
    ruins.length === 0
      ? ok(`${rotulo}: grava ${checks.map(([k]) => k).join(", ")}`)
      : falha(`${rotulo}: campos errados -> ${ruins.join(", ")}`);
  };
  camposOk(rec, starterMensal, "item recorrente");
  camposOk(set, pabxSetup, "item setup");

  // Desconto: preserva o oficial e registra o negociado.
  const esperadoSub = (3 * parseFloat(starterMensal.valor)) * (1 - DESC_PCT / 100);
  const subOk = Math.abs(parseFloat(rec.subtotal) - esperadoSub) < 0.02;
  subOk && parseFloat(rec.valorTabela!) === parseFloat(starterMensal.valor) && rec.stripePriceId === starterMensal.stripePriceId
    ? ok(`desconto de ${DESC_PCT}%: subtotal R$ ${rec.subtotal} (tabela R$ ${rec.valorTabela}/un), price oficial PRESERVADO — nenhum produto/price novo`)
    : falha(`desconto: subtotal=${rec.subtotal} esperado=${esperadoSub.toFixed(2)} valorTabela=${rec.valorTabela}`);

  const [{ n: precosDepois }] = await db.select({ n: sql<number>`count(*)::int` }).from(catalogoPrecos);
  const [{ n: produtosDepois }] = await db.select({ n: sql<number>`count(*)::int` }).from(servicosCatalogo).where(eq(servicosCatalogo.origemCatalogo, "oficial_stripe"));
  Number(precosDepois) === 213 && Number(produtosDepois) === 21
    ? ok(`catálogo intacto depois do desconto: ${produtosDepois} produtos, ${precosDepois} prices`)
    : falha(`catálogo mudou: ${produtosDepois} produtos, ${precosDepois} prices`);

  // Propagação pro modelo de domínio v2.
  const oi = await db.select({ produto: oportunidadeItens.produto, serviceFamily: oportunidadeItens.serviceFamily, revenueNature: oportunidadeItens.revenueNature, stripePriceId: oportunidadeItens.stripePriceId, skuPreco: oportunidadeItens.skuPreco })
    .from(oportunidadeItens)
    .innerJoin(oportunidades, eq(oportunidades.id, oportunidadeItens.oportunidadeId))
    .where(eq(oportunidades.negocioIdLegado, negocio.id));
  oi.length === 2 && oi.every((x) => !!x.stripePriceId)
    ? ok(`oportunidade_itens propagou o price: ${oi.map((x) => `${x.serviceFamily}/${x.revenueNature}`).join(", ")}`)
    : falha(`oportunidade_itens: ${oi.length} itens, com price=${oi.filter((x) => !!x.stripePriceId).length}`);

  console.log("\n=== 4. REGRA 7 — WHITE LABEL LICENÇA ISOLADA NÃO EXIGE CONTRATO\n");
  for (const [rotulo, lookup, esperaContrato] of [
    ["Licença isolada", "callface_ai_white_label_licenca_faixa_1_1_a_99_licencas", false],
    ["Setup", "callface_ai_white_label_setup_faixa_1_1_a_99_licencas", true],
  ] as const) {
    const pr = await preco(lookup);
    const [emp] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} WL ${rotulo} LTDA` }).returning({ id: empresas.id });
    const [ld] = await db.insert(leads).values({ organizacaoId: org.id, nome: `${TAG} WL ${rotulo}`, email: `zztestecat.wl.${esperaContrato}@exemplo.invalid`, empresaId: emp.id, tipo: "lead", status: "qualified" }).returning({ id: leads.id });
    const [ng] = await db.insert(negocios).values({ organizacaoId: org.id, leadId: ld.id, empresaId: emp.id, pipelineId: pipeline.id, titulo: `${TAG} WL ${rotulo}`, status: "proposta_enviada", responsavelId: user.id }).returning({ id: negocios.id });
    await syncOportunidadeFromNegocio(ng.id);
    const pc = await criarPropostaComItens({
      organizacaoId: org.id, leadId: ld.id, negocioId: ng.id, moeda: "BRL", observacoes: `${TAG} WL ${rotulo}`,
      prazoContratoMeses: esperaContrato ? 12 : null,
      signatarios: [{ nome: `${TAG} WL ${rotulo}`, email: `zztestecat.wl.${esperaContrato}@exemplo.invalid`, papel: "signatario", ordem: 1 }],
      itens: [{ catalogoPrecoId: pr.id, servicoCatalogoId: pr.produtoId, nome: `${pr.produtoNome} — ${pr.variacao}`, tipo: pr.tipo as "recorrente" | "setup", quantidade: 10, valorUnitario: parseFloat(pr.valor), desconto: 0, descontoTipo: "percentual" }],
      criadoPorId: user.id,
    });
    await db.update(propostas).set({ status: "enviada" }).where(eq(propostas.id, pc.id));
    const aceite = await processarAceiteDaProposta({ propostaId: pc.id, organizacaoId: org.id, origem: "manual" });
    if (!aceite.ok) { falha(`${rotulo}: aceite falhou — ${aceite.error}`); continue; }
    const passo = aceite.grupos[0]?.proximoPasso;
    const certo = esperaContrato ? passo === "contrato" : passo === "pagamento";
    certo
      ? ok(`${rotulo} (10 licenças): aceite -> ${passo === "contrato" ? "CONTRATO" : "PAGAMENTO"} (família ${aceite.grupos[0]?.serviceFamily})`)
      : falha(`${rotulo}: proximoPasso=${passo}, esperado ${esperaContrato ? "contrato" : "pagamento"}`);
  }

  console.log("\n=== 5. LEGADO INTOCADO\n");
  const [{ legado, legadoAtivo, oficial }] = await db.execute<{ legado: number; legadoAtivo: number; oficial: number }>(sql`
    SELECT (SELECT COUNT(*)::int FROM servicos_catalogo WHERE origem_catalogo='legado') AS legado,
           (SELECT COUNT(*)::int FROM servicos_catalogo WHERE origem_catalogo='legado' AND ativo) AS "legadoAtivo",
           (SELECT COUNT(*)::int FROM servicos_catalogo WHERE origem_catalogo='oficial_stripe') AS oficial
  `);
  Number(legado) === 217 ? ok(`${legado} produtos legados preservados (${legadoAtivo} ativos), ${oficial} oficiais`) : falha(`legado=${legado}, esperado 217`);

  console.log(`\n=== RESULTADO`);
  if (falhas.length === 0) console.log(`\x1b[32mTodas as verificações passaram.\x1b[0m`);
  else { console.log(`\x1b[31m${falhas.length} falha(s):\x1b[0m`); falhas.forEach((f) => console.log(`  - ${f}`)); }
  console.log("\nLimpando dados de teste...");
  await limpar();
  process.exitCode = falhas.length === 0 ? 0 : 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
