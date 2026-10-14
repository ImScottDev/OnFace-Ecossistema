/**
 * Upgrade, downgrade, cross-sell e renovação contra o banco (cenário 8 da matriz da jornada comercial).
 * Um cliente atravessa a vida inteira: venda nova -> upgrade -> cross-sell -> renovação -> downgrade, e a
 * cada passo o teste confere serviço, MRR, entrega, etapas herdadas, recebível e ausência de duplicata.
 *
 * NÃO ENTRA NO PORTÃO (precisa de banco com o schema; cria a própria organização e não limpa).
 * Só roda em banco descartável: o nome termina em _tmp ou _test. Sem isso, pula.
 *
 *   createdb onface_upgrade_tmp && pg_dump -s <base> | psql onface_upgrade_tmp && DATABASE_URL=.../onface_upgrade_tmp pnpm db:migrar
 *   DATABASE_URL=postgresql://localhost:5432/onface_upgrade_tmp pnpm exec tsx --test src/lib/crm/upgrade-cross-sell.db.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL ?? "";
const bancoDescartavel = /_(tmp|test)$/.test(url.split("?")[0]);

test("a vida do cliente: venda nova, upgrade, cross-sell, renovação e downgrade", async (t) => {
  if (!url) return t.skip("DATABASE_URL não definida");
  if (!bancoDescartavel) return t.skip("banco não é descartável (nome precisa terminar em _tmp ou _test)");

  const { db } = await import("@/lib/db");
  const { materializarServicosCanonicosDoNegocio } = await import("@/lib/crm/servico-canonico");
  const { criarFulfillmentsParaServicos } = await import("@/lib/crm/fulfillment");
  const { criarPosVendaDoNegocio } = await import("@/lib/crm/pos-venda");
  const { registrarPendenciaFinanceira } = await import("@/lib/crm/pendencia-financeira");

  const rows = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
  const um = async <T,>(q: ReturnType<typeof sql>) => (await rows<T>(q))[0];
  const marca = `upg-${Date.now()}`;

  const org = (await um<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${marca}, ${marca}) RETURNING id::text`)).id;
  const vendedor = (await um<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role) VALUES (${org}::uuid, 'Closer', ${`${marca}@teste.local`}, 'x', 'closer') RETURNING id::text`)).id;
  const csm = (await um<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role) VALUES (${org}::uuid, 'Onboarding', ${`${marca}-cs@teste.local`}, 'x', 'closer') RETURNING id::text`)).id;
  const empresa = (await um<{ id: string }>(sql`INSERT INTO empresas (organizacao_id, nome) VALUES (${org}::uuid, ${`Empresa ${marca}`}) RETURNING id::text`)).id;
  const lead = (await um<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, empresa_id, empresa, tipo, status) VALUES (${org}::uuid, 'Contato', ${empresa}::uuid, ${`Empresa ${marca}`}, 'lead', 'novo') RETURNING id::text`)).id;

  type Item = { produto: string; natureza: "MRR" | "SETUP"; valor: number };
  /** Uma venda ganha: negócio + oportunidade + itens; Ganho materializa os serviços e cria a entrega (o que o produto faz). */
  async function venda(o: { familia: string; motion?: string; tipoVenda?: string; itens: Item[]; tipoContratual?: string; materializar?: boolean }) {
    const campos = o.tipoVenda ? JSON.stringify({ tipo_venda: o.tipoVenda }) : "{}";
    const negocio = (await um<{ id: string }>(sql`
      INSERT INTO negocios (organizacao_id, lead_id, empresa_id, responsavel_id, titulo, status, service_family, commercial_motion, campos_custom, ganho_at)
      VALUES (${org}::uuid, ${lead}::uuid, ${empresa}::uuid, ${vendedor}::uuid, ${`Venda ${o.itens[0].produto}`}, 'ganho', ${o.familia}, ${o.motion ?? "EXPANSION"}, ${campos}::jsonb, now())
      RETURNING id::text`)).id;
    const opp = (await um<{ id: string }>(sql`
      INSERT INTO oportunidades (organizacao_id, empresa_id, lead_id, responsavel_id, stage, service_family, commercial_motion, negocio_id_legado)
      VALUES (${org}::uuid, ${empresa}::uuid, ${lead}::uuid, ${vendedor}::uuid, 'ganho', ${o.familia}, ${o.motion ?? "EXPANSION"}, ${negocio}::uuid) RETURNING id::text`)).id;
    for (const it of o.itens) {
      await db.execute(sql`
        INSERT INTO oportunidade_itens (organizacao_id, oportunidade_id, produto, service_family, revenue_nature, quantidade, preco_unitario, valor_total, origem_legado)
        VALUES (${org}::uuid, ${opp}::uuid, ${it.produto}, ${o.familia}, ${it.natureza}, 1, ${it.valor}, ${it.valor}, 'manual')`);
    }
    let proposta: string | null = null;
    if (o.tipoContratual) {
      proposta = (await um<{ id: string }>(sql`
        INSERT INTO propostas (organizacao_id, lead_id, negocio_id, numero, versao, status, tipo_contratual)
        VALUES (${org}::uuid, ${lead}::uuid, ${negocio}::uuid, ${Math.floor(Math.random() * 1e6)}, 1, 'aceita', ${o.tipoContratual}) RETURNING id::text`)).id;
    }
    let servicoIds: string[] = [];
    if (o.materializar !== false) {
      ({ servicoIds } = await materializarServicosCanonicosDoNegocio({ negocioId: negocio, organizacaoId: org, contratoId: null, wonAt: new Date(), stripeSubscriptionId: null }));
      await criarFulfillmentsParaServicos(servicoIds, org);
    }
    return { negocio, opp, proposta, servicoIds };
  }

  const servicos = (extra = sql``) => rows<{ id: string; family: string; produto: string | null; lifecycle: string; valor: string; incl: boolean; evidence: Record<string, unknown> }>(sql`
    SELECT id::text, service_family AS family, canonical_product AS produto, commercial_lifecycle AS lifecycle,
           current_recurring_value::text AS valor, portfolio_included AS incl, evidence
      FROM servicos_canonicos WHERE organizacao_id = ${org}::uuid AND empresa_id = ${empresa}::uuid ${extra} ORDER BY created_at, id`);
  /** MRR ativo da carteira do cliente, do jeito que as leituras do produto somam: ACTIVE, com GROUP BY empresa. */
  const mrrAtivo = async () => Number((await um<{ mrr: string }>(sql`
    SELECT COALESCE(SUM(current_recurring_value), 0)::text AS mrr FROM servicos_canonicos
     WHERE organizacao_id = ${org}::uuid AND empresa_id = ${empresa}::uuid AND commercial_lifecycle = 'ACTIVE' AND revenue_nature = 'MRR'
     GROUP BY empresa_id`))?.mrr ?? 0);
  const entregas = () => rows<{ id: string; status: string; oportunidade_id: string | null; anterior: string | null; n_servicos: number; family: string }>(sql`
    SELECT f.id::text, f.status, f.oportunidade_id::text, f.fulfillment_anterior_id::text AS anterior, f.service_family AS family,
           (SELECT count(*)::int FROM fulfillment_servicos fs WHERE fs.fulfillment_id = f.id) AS n_servicos
      FROM fulfillments f WHERE f.organizacao_id = ${org}::uuid ORDER BY f.created_at, f.id`);

  /* ══ 1. Venda nova: Callface AI Start (mensalidade) + implantação. Dois itens, UM onboarding. ══ */
  const v1 = await venda({ familia: "CALLFACE_AI", motion: "NEW_BUSINESS", itens: [
    { produto: "Callface AI Start", natureza: "MRR", valor: 189.9 },
    { produto: "Implantação", natureza: "SETUP", valor: 99.9 },
  ] });
  assert.equal((await servicos()).length, 2, "um serviço por item");
  assert.equal(await mrrAtivo(), 189.9);
  const e1 = await entregas();
  assert.equal(e1.length, 1, "REGRA 3: venda de dois itens = UM onboarding");
  assert.equal(e1[0].n_servicos, 2);

  // O time cumpre as 5 primeiras etapas, com data e responsável próprios.
  const DATA_ORIGINAL = "2026-03-10T14:00:00.000Z";
  await db.execute(sql`
    UPDATE fulfillment_itens SET status = 'DONE', completed_at = ${DATA_ORIGINAL}::timestamptz, completed_by = ${csm}::uuid, responsavel_id = ${csm}::uuid
     WHERE id IN (SELECT id FROM fulfillment_itens WHERE fulfillment_id = ${e1[0].id}::uuid ORDER BY ordem LIMIT 5)`);
  const totalEtapas = (await um<{ n: number }>(sql`SELECT count(*)::int AS n FROM fulfillment_itens WHERE fulfillment_id = ${e1[0].id}::uuid`)).n;
  assert.ok(totalEtapas > 5);

  /* ══ 2. Upgrade Start -> Full: SOMA ao histórico, o serviço de hoje é o novo, o antigo vira histórico. ══ */
  const v2 = await venda({ familia: "CALLFACE_AI", tipoVenda: "upgrade", itens: [
    { produto: "Callface AI Full", natureza: "MRR", valor: 379.9 },
  ] });
  const s2 = await servicos();
  const start = s2.find((s) => s.produto === "Callface AI Start")!;
  const full = s2.find((s) => s.produto === "Callface AI Full")!;
  assert.equal(start.lifecycle, "SUPERSEDED", "REGRA 1: o que ele tinha vira histórico");
  assert.equal(start.incl, false);
  assert.equal(start.valor, "189.90", "o valor antigo fica preservado no histórico");
  assert.equal(full.lifecycle, "ACTIVE");
  assert.equal(full.evidence.substitui && (full.evidence.substitui as string[])[0], start.id, "o novo sabe quem substituiu");
  assert.equal(start.evidence.substituido_por, full.id, "o antigo sabe quem o substituiu");
  assert.equal((s2.find((s) => s.produto === "Implantação")!).lifecycle, "ACTIVE", "setup pago não é tocado");
  assert.equal(await mrrAtivo(), 379.9, "MRR = só o plano de hoje (não 189,90 + 379,90)");

  const e2 = await entregas();
  assert.equal(e2.length, 2, "REGRA 3: cada venda tem o seu board; nada de três");
  const nova = e2.find((e) => e.oportunidade_id === v2.opp)!;
  assert.equal(nova.anterior, e1[0].id, "o board novo aponta o anterior");
  const itensNovos = await rows<{ status: string; completed_at: string | null; completed_by: string | null; responsavel_id: string | null; herdada: string | null }>(sql`
    SELECT status, to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS completed_at, completed_by::text, responsavel_id::text, metadata->>'herdadaDe' AS herdada
      FROM fulfillment_itens WHERE fulfillment_id = ${nova.id}::uuid ORDER BY ordem`);
  assert.equal(itensNovos.length, totalEtapas, "o checklist inteiro nasce no board novo");
  const herdadas = itensNovos.filter((i) => i.herdada);
  assert.equal(herdadas.length, 5, "REGRA 4: as 5 etapas cumpridas nascem cumpridas");
  for (const h of herdadas) {
    assert.equal(h.status, "DONE");
    assert.equal(h.completed_at, DATA_ORIGINAL, "com a data original");
    assert.equal(h.completed_by, csm, "e o responsável original");
    assert.equal(h.responsavel_id, csm);
    assert.equal(h.herdada, e1[0].id);
  }
  assert.ok(itensNovos.filter((i) => !i.herdada).every((i) => i.status === "PENDING" && !i.completed_at), "o que falta continua pendente");
  const etapasHerdadasJson = (await um<{ j: { concluidaPor: string }[] }>(sql`SELECT etapas_herdadas AS j FROM fulfillments WHERE id = ${nova.id}::uuid`)).j;
  assert.equal(etapasHerdadasJson.length, 5);
  assert.equal(etapasHerdadasJson[0].concluidaPor, csm, "o registro das herdadas guarda quem fez");

  // Idempotência do upgrade: rodar o Ganho de novo não duplica serviço, entrega nem encerra mais nada.
  const antesServicos = (await servicos()).length;
  await materializarServicosCanonicosDoNegocio({ negocioId: v2.negocio, organizacaoId: org, contratoId: null, wonAt: new Date(), stripeSubscriptionId: null })
    .then((r) => criarFulfillmentsParaServicos(r.servicoIds, org));
  assert.equal((await servicos()).length, antesServicos);
  assert.equal((await entregas()).length, 2);
  assert.equal(await mrrAtivo(), 379.9);

  /* ══ 3. Cross-sell: PABX com dois ramais soma. Não encerra nada do Callface AI. ══ */
  const v3 = await venda({ familia: "PABX", tipoVenda: "crosssell", itens: [
    { produto: "Ramais A", natureza: "MRR", valor: 100 },
    { produto: "Ramais B", natureza: "MRR", valor: 50 },
  ] });
  assert.equal((await servicos(sql`AND service_family = 'CALLFACE_AI'`)).filter((s) => s.lifecycle === "ACTIVE").length, 2, "Callface AI intacto (Full + Implantação)");
  assert.equal((await servicos(sql`AND service_family = 'PABX'`)).filter((s) => s.lifecycle === "ACTIVE").length, 2);
  assert.equal(await mrrAtivo(), 529.9);
  const e3 = await entregas();
  assert.equal(e3.filter((e) => e.family === "PABX").length, 1, "REGRA 3: dois itens PABX = UMA implantação");
  assert.equal(e3.length, 3);

  /* ══ 4. Renovação do Full: nada duplica (serviço, entrega, recebível). ══ */
  const v4 = await venda({ familia: "CALLFACE_AI", motion: "RENEWAL", tipoVenda: "renovacao", itens: [
    { produto: "Callface AI Full", natureza: "MRR", valor: 379.9 },
  ] });
  assert.deepEqual(v4.servicoIds, [], "REGRA 5: renovação não cria serviço");
  assert.equal((await servicos()).length, antesServicos + 2, "serviços iguais ao de antes (só o cross-sell PABX somou)");
  assert.equal((await entregas()).length, 3, "REGRA 5: nem onboarding novo");
  assert.equal(await mrrAtivo(), 529.9, "MRR não dobra");
  const vinculo = await um<{ servico: string | null }>(sql`SELECT servico_canonico_id::text AS servico FROM oportunidade_itens WHERE oportunidade_id = ${v4.opp}::uuid`);
  assert.equal(vinculo.servico, full.id, "o item da renovação aponta o serviço que ele renova");
  // O caminho legado de pós-venda também recusa renovação (senão criaria serviço UNKNOWN e roteamento de entrega).
  const posVenda = await criarPosVendaDoNegocio(v4.negocio, { ignorarFlag: true });
  assert.equal(posVenda.criado, false);
  assert.match(posVenda.motivo ?? "", /renovação/);
  assert.equal((await servicos()).length, antesServicos + 2);
  assert.equal((await entregas()).length, 3);

  /* ── Recebível: a venda nova gera o recebível (mensalidade + setup, do mesmo grupo); a renovação, nenhum. ── */
  async function grupoComRecebivel(negocio: string, opp: string, itens: Item[], tipoContratual: string | null) {
    const proposta = (await um<{ id: string }>(sql`
      INSERT INTO propostas (organizacao_id, lead_id, negocio_id, numero, versao, status, tipo_contratual)
      VALUES (${org}::uuid, ${lead}::uuid, ${negocio}::uuid, ${Math.floor(Math.random() * 1e6)}, 1, 'aceita', ${tipoContratual}) RETURNING id::text`)).id;
    const grupo = (await um<{ id: string }>(sql`
      INSERT INTO proposta_grupo_comercial (organizacao_id, proposta_id, negocio_id, oportunidade_id, commercial_model, service_family, status)
      VALUES (${org}::uuid, ${proposta}::uuid, ${negocio}::uuid, ${opp}::uuid, 'CONTRATO_ASSINATURA', 'CALLFACE_AI', 'aguardando_pagamento') RETURNING id::text`)).id;
    let ordem = 0;
    for (const it of itens) {
      const pi = (await um<{ id: string }>(sql`
        INSERT INTO proposta_itens (proposta_id, nome, tipo, moeda, quantidade, valor_unitario, desconto, desconto_tipo, subtotal, ordem, commercial_model, service_family, revenue_nature)
        VALUES (${proposta}::uuid, ${it.produto}, ${it.natureza === "MRR" ? "recorrente" : "setup"}, 'BRL', 1, ${it.valor}, 0, 'valor', ${it.valor}, ${++ordem}, 'CONTRATO_ASSINATURA', 'CALLFACE_AI', ${it.natureza}) RETURNING id::text`)).id;
      await db.execute(sql`INSERT INTO proposta_grupo_comercial_itens (grupo_id, proposta_item_id) VALUES (${grupo}::uuid, ${pi}::uuid)`);
    }
    return grupo;
  }
  const faturasDe = (grupo: string) => rows<{ external_id: string; valor: string }>(sql`SELECT external_id, valor::text FROM faturas WHERE grupo_comercial_id = ${grupo}::uuid ORDER BY external_id`);

  const vControle = await venda({ familia: "CALLFACE_AI", tipoVenda: "expansao", materializar: false, itens: [
    { produto: "Add-on", natureza: "MRR", valor: 50 }, { produto: "Add-on setup", natureza: "SETUP", valor: 30 },
  ] });
  const grupoControle = await grupoComRecebivel(vControle.negocio, vControle.opp, [{ produto: "Add-on", natureza: "MRR", valor: 50 }, { produto: "Add-on setup", natureza: "SETUP", valor: 30 }], null);
  const pCtrl = await registrarPendenciaFinanceira({ grupoId: grupoControle, motivo: "ganho_por_contrato_sem_pagamento" });
  assert.ok(pCtrl && !pCtrl.jaExistia, "a venda que soma gera o recebível");
  assert.equal((await faturasDe(grupoControle)).length, 2, "mensalidade e setup do MESMO grupo, na mesma venda");
  const pCtrl2 = await registrarPendenciaFinanceira({ grupoId: grupoControle, motivo: "ganho_por_contrato_sem_pagamento" });
  assert.equal(pCtrl2?.jaExistia, true);
  assert.equal((await faturasDe(grupoControle)).length, 2, "reprocessar não duplica");

  const grupoRenov = await grupoComRecebivel(v4.negocio, v4.opp, [{ produto: "Callface AI Full", natureza: "MRR", valor: 379.9 }], null);
  assert.equal(await registrarPendenciaFinanceira({ grupoId: grupoRenov, motivo: "ganho_por_contrato_sem_pagamento" }), null);
  assert.equal((await faturasDe(grupoRenov)).length, 0, "REGRA 5: renovação não gera recebível");

  /* ══ 5. Downgrade por proposta (tipo_contratual = DOWNGRADE): Full -> Start. ══ */
  const mrrAntesDown = await mrrAtivo(); // 379,90 (Full) + 150 (PABX) + 50 (add-on, materializado? não: materializar:false) = 529,90
  assert.equal(mrrAntesDown, 529.9);
  const v5 = await venda({ familia: "CALLFACE_AI", tipoContratual: "DOWNGRADE", itens: [
    { produto: "Callface AI Start", natureza: "MRR", valor: 189.9 },
  ] });
  const s5 = await servicos(sql`AND service_family = 'CALLFACE_AI' AND revenue_nature = 'MRR'`);
  assert.equal(s5.find((s) => s.id === full.id)!.lifecycle, "SUPERSEDED", "o Full vira histórico");
  assert.equal(s5.filter((s) => s.lifecycle === "ACTIVE").length, 1);
  assert.equal(s5.filter((s) => s.lifecycle === "ACTIVE")[0].valor, "189.90");
  assert.equal(await mrrAtivo(), 339.9, "para baixo: 189,90 + 150 PABX");
  // O histórico inteiro continua lá: Start (1º), Full, Start (atual).
  assert.equal(s5.length, 3);
  assert.equal((await entregas()).filter((e) => e.oportunidade_id === v5.opp).length, 1);

  /* ══ 6. Upgrade ambíguo: dois serviços recorrentes de PABX, nenhum declarado -> não adivinha. ══ */
  const v6 = await venda({ familia: "PABX", tipoVenda: "upgrade", itens: [{ produto: "PABX Pro", natureza: "MRR", valor: 400 }] });
  const pabx = await servicos(sql`AND service_family = 'PABX'`);
  assert.equal(pabx.filter((s) => s.lifecycle === "ACTIVE").length, 3, "nada foi encerrado por palpite");
  const novoPabx = pabx.find((s) => s.produto === "PABX Pro")!;
  assert.ok(novoPabx.evidence.substituicao_pendente, "fica registrada a pendência de decisão humana");

  // ...e com a origem DECLARADA na oportunidade, o mesmo upgrade resolve.
  const ramaisA = pabx.find((s) => s.produto === "Ramais A")!;
  const v7 = await venda({ familia: "PABX", tipoVenda: "upgrade", materializar: false, itens: [{ produto: "PABX Enterprise", natureza: "MRR", valor: 800 }] });
  await db.execute(sql`UPDATE negocios SET servico_origem_id = ${ramaisA.id}::uuid WHERE id = ${v7.negocio}::uuid`);
  const r7 = await materializarServicosCanonicosDoNegocio({ negocioId: v7.negocio, organizacaoId: org, contratoId: null, wonAt: new Date(), stripeSubscriptionId: null });
  assert.equal(r7.servicoIds.length, 1);
  const pabx7 = await servicos(sql`AND service_family = 'PABX'`);
  assert.equal(pabx7.find((s) => s.id === ramaisA.id)!.lifecycle, "SUPERSEDED", "origem declarada: só ela é encerrada");
  assert.equal(pabx7.find((s) => s.produto === "Ramais B")!.lifecycle, "ACTIVE");
  void v6;
});
