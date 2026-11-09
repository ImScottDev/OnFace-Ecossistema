/**
 * O motor e as leituras do pós-venda contra o banco: Ganho -> projeto preenchido -> board/projeto -> upgrade -> espera.
 *
 * NÃO ENTRA NO PORTÃO (precisa de banco com o schema; cria a própria organização e não limpa).
 * Só roda em banco descartável: o nome termina em _tmp ou _test.
 *
 *   createdb onface_pv_tmp && pg_dump -s <base> | psql onface_pv_tmp
 *   DATABASE_URL=postgresql://localhost:5432/onface_pv_tmp ./node_modules/.bin/tsx --test src/lib/pos-venda/pos-venda.db.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL ?? "";
const bancoDescartavel = /_(tmp|test)$/.test(url.split("?")[0]);

test("do Ganho ao projeto preenchido, com upgrade e espera", async (t) => {
  if (!url) return t.skip("DATABASE_URL não definida");
  if (!bancoDescartavel) return t.skip("banco não é descartável (nome precisa terminar em _tmp ou _test)");

  const { db } = await import("@/lib/db");
  const { materializarServicosCanonicosDoNegocio } = await import("@/lib/crm/servico-canonico");
  const { criarFulfillmentsParaServicos } = await import("@/lib/crm/fulfillment");
  const { prepararProjeto } = await import("./motor");
  const { projetoCompleto } = await import("./projeto");
  const { boardDoPosVenda } = await import("./board");
  const { iniciarEspera, encerrarEspera } = await import("./espera");

  const rows = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
  const um = async <T,>(q: ReturnType<typeof sql>) => (await rows<T>(q))[0];
  const marca = `pv-${Date.now()}`;

  const org = (await um<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${marca}, ${marca}) RETURNING id::text`)).id;
  // O seed do playbook é da migration (idempotente): rodar de novo semeia a organização nova.
  const migracao = fs.readFileSync(path.join(import.meta.dirname, "../db/migrations/0144_pos_venda_playbook_e_espera.sql"), "utf8");
  const cru = (await import("postgres")).default(url, { max: 1, onnotice: () => {} });
  await cru.unsafe(migracao);
  await cru.end();

  const csm = (await um<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role) VALUES (${org}::uuid, 'Victoria CS', ${`${marca}@t.local`}, 'x', 'closer') RETURNING id::text`)).id;
  await db.execute(sql`UPDATE pos_venda_playbooks SET responsavel_padrao_id = ${csm}::uuid WHERE organizacao_id = ${org}::uuid`);
  const empresa = (await um<{ id: string }>(sql`INSERT INTO empresas (organizacao_id, nome, cnpj) VALUES (${org}::uuid, ${`Empresa ${marca}`}, '11.222.333/0001-44') RETURNING id::text`)).id;
  const lead = (await um<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, empresa_id, empresa, tipo, status) VALUES (${org}::uuid, 'Contato', ${empresa}::uuid, ${`Empresa ${marca}`}, 'lead', 'novo') RETURNING id::text`)).id;
  const pessoa = (await um<{ id: string }>(sql`INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email) VALUES (${org}::uuid, ${empresa}::uuid, 'Ana', 'Lima', 'ana@t.local') RETURNING id::text`)).id;
  // Pessoa só pelo vínculo (o outro caminho): precisa aparecer também.
  const pessoa2 = (await um<{ id: string }>(sql`INSERT INTO pessoas (organizacao_id, nome, email) VALUES (${org}::uuid, 'Bruno', 'b@t.local') RETURNING id::text`)).id;
  await db.execute(sql`INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel) VALUES (${org}::uuid, ${pessoa2}::uuid, ${empresa}::uuid, 'financeiro')`);
  assert.ok(pessoa);

  async function venda(itens: Array<{ produto: string; valor: number; qtd: number }>) {
    const negocio = (await um<{ id: string }>(sql`
      INSERT INTO negocios (organizacao_id, lead_id, empresa_id, responsavel_id, titulo, status, service_family, commercial_motion, ganho_at)
      VALUES (${org}::uuid, ${lead}::uuid, ${empresa}::uuid, ${csm}::uuid, 'Venda', 'ganho', 'CALLFACE_AI', 'EXPANSION', now()) RETURNING id::text`)).id;
    const opp = (await um<{ id: string }>(sql`
      INSERT INTO oportunidades (organizacao_id, empresa_id, lead_id, responsavel_id, stage, service_family, commercial_motion, negocio_id_legado)
      VALUES (${org}::uuid, ${empresa}::uuid, ${lead}::uuid, ${csm}::uuid, 'ganho', 'CALLFACE_AI', 'EXPANSION', ${negocio}::uuid) RETURNING id::text`)).id;
    for (const it of itens) {
      await db.execute(sql`
        INSERT INTO oportunidade_itens (organizacao_id, oportunidade_id, produto, service_family, revenue_nature, quantidade, preco_unitario, valor_total, origem_legado)
        VALUES (${org}::uuid, ${opp}::uuid, ${it.produto}, 'CALLFACE_AI', 'MRR', ${it.qtd}, ${it.valor}, ${it.valor * it.qtd}, 'manual')`);
    }
    const { servicoIds } = await materializarServicosCanonicosDoNegocio({ negocioId: negocio, organizacaoId: org, contratoId: null, wonAt: new Date(), stripeSubscriptionId: null });
    await criarFulfillmentsParaServicos(servicoIds, org);
    const f = await um<{ id: string }>(sql`SELECT id::text FROM fulfillments WHERE organizacao_id = ${org}::uuid AND oportunidade_id = ${opp}::uuid`);
    return { opp, f: f.id };
  }

  // ── 1. Ganho: projeto nasce preenchido ───────────────────────────────────
  const v1 = await venda([{ produto: "Callface AI - Full · mensal", valor: 100, qtd: 3 }, { produto: "Callface AI - Agente IA · Mensal", valor: 50, qtd: 1 }]);
  const f1 = await um<{ target: string | null; due: string | null; snap: unknown; resp: string | null; status: string }>(sql`
    SELECT target_at::text AS target, due_at::text AS due, escopo_vendido_snapshot AS snap, responsavel_id::text AS resp, status FROM fulfillments WHERE id = ${v1.f}::uuid`);
  assert.ok(f1.target && f1.due, "target_at e due_at preenchidos");
  assert.ok(f1.snap, "escopo congelado");
  assert.equal(f1.resp, csm, "responsável vem da configuração por família");

  const tarefas1 = await rows<{ chave: string; titulo: string; descricao: string; origem: string; venceH: number; subs: number }>(sql`
    SELECT chave_idempotencia AS chave, titulo, descricao, origem,
           (extract(epoch FROM vence_em - (SELECT started_at FROM fulfillments WHERE id = ${v1.f}::uuid)) / 3600)::float AS "venceH",
           (SELECT count(*)::int FROM tarefa_subtarefas s WHERE s.tarefa_id = tarefas.id) AS subs
      FROM tarefas WHERE organizacao_id = ${org}::uuid AND chave_idempotencia LIKE ${`ONBOARDING:${v1.f}:%`} ORDER BY vence_em, chave_idempotencia`);
  assert.equal(tarefas1.length, 7, "as 7 tarefas do playbook");
  const contato = tarefas1.find((x) => x.chave.endsWith(":contato_boas_vindas"))!;
  assert.ok(Math.abs(contato.venceH - 2) < 0.01, `SLA de 2 horas (veio ${contato.venceH}h)`);
  assert.ok(tarefas1.every((x) => x.origem === "ONBOARDING"));
  assert.equal(tarefas1.find((x) => x.chave.endsWith(":reuniao_onboarding"))!.subs, 8, "7 itens + treino do Agente de IA DENTRO da reunião");
  assert.match(tarefas1.find((x) => x.chave.endsWith(":reuniao_onboarding"))!.descricao, /Agente de IA contratado/);
  const ultimo = tarefas1.find((x) => x.chave.endsWith(":encerramento_nps"))!;
  assert.ok(Math.abs(ultimo.venceH - 15 * 24) < 0.01, "encerramento no dia 15");

  // idempotência: rodar de novo não cria nada
  const de_novo = await prepararProjeto({ organizacaoId: org, fulfillmentId: v1.f });
  assert.equal(de_novo.tarefasCriadas, 0);
  assert.equal(de_novo.tarefasJaExistiam, 7);

  // ── 2. As leituras devolvem o que foi gravado ────────────────────────────
  const p1 = (await projetoCompleto(org, v1.f))!;
  assert.equal(p1.familia, "CALLFACE_AI");
  assert.equal(p1.tarefas.length, 7);
  assert.equal(p1.tarefas[0].passo, "contato_boas_vindas");
  assert.equal(p1.tarefas[2].condicional, true, "a reunião carrega o treino do agente");
  assert.equal(p1.tarefas[2].itens.length, 8);
  assert.equal(p1.escopo?.quantidade, 4);
  assert.equal(p1.escopo?.mensalidade, 350);
  assert.deepEqual(p1.escopo?.complementos, ["agente_ia"]);
  assert.equal(p1.pessoas.length, 2, "união dos dois caminhos de pessoa");
  assert.equal(p1.relogios.prazoDias, 15);
  assert.equal(p1.empresa.documento, "11.222.333/0001-44");
  assert.equal(p1.responsavel?.nome, "Victoria CS");
  assert.equal(p1.progresso, 0);
  assert.equal(p1.nps, null, "sem NPS enviado: null, não zero");
  assert.equal(p1.retratoDeUso?.indisponivel, true, "sem vínculo com a plataforma: indisponível");
  assert.equal(p1.retratoDeUso?.ligacoesFeitas, null);
  assert.equal(await projetoCompleto(org, "nao-e-uuid"), null);
  assert.equal(await projetoCompleto("320a9052-dd43-4edb-9b74-34be53c5c419", v1.f), null, "outra organização não enxerga");

  const b1 = await boardDoPosVenda(org, { tipo: null, familia: null, responsavelId: null, estado: null, recorte: null, busca: null });
  assert.equal(b1.total, 1);
  assert.equal(b1.cartoes[0].tarefasTotal, 7);
  assert.equal(b1.cartoes[0].proximaTarefa?.titulo, "Contato de boas-vindas");
  assert.equal(b1.indicadores.npsMedio, null);
  assert.equal(b1.indicadores.tempoMedianoDias, null, "sem amostra: null");
  assert.equal(b1.cartoes[0].escopoResumo, "4 usuários · Callface AI - Full · mensal + Callface AI - Agente IA · Mensal");

  // ── 3. Espera: o relógio do time pausa, o do cliente corre ───────────────
  const antes = new Date(Date.now() - 10 * 3_600_000);
  await db.execute(sql`UPDATE fulfillments SET started_at = ${antes.toISOString()}::timestamptz WHERE id = ${v1.f}::uuid`);
  const ini = await iniciarEspera({ organizacaoId: org, fulfillmentId: v1.f, motivo: "cliente", detalhe: "aguardando materiais", usuarioId: csm, agora: new Date(Date.now() - 4 * 3_600_000) });
  assert.equal(ini.ok, true);
  const dupla = await iniciarEspera({ organizacaoId: org, fulfillmentId: v1.f, motivo: "operadora", detalhe: null, usuarioId: csm, agora: new Date(Date.now() - 2 * 3_600_000) });
  assert.equal(dupla.ok, true, "trocar de lado fecha a espera anterior");
  const aberta = await rows<{ n: number }>(sql`SELECT count(*)::int AS n FROM pos_venda_esperas WHERE fulfillment_id = ${v1.f}::uuid AND fim IS NULL`);
  assert.equal(aberta[0].n, 1, "no máximo uma espera aberta");
  const p1b = (await projetoCompleto(org, v1.f))!;
  assert.equal(p1b.estado, "AGUARDANDO");
  assert.equal(p1b.relogios.esperando?.motivo, "operadora");
  assert.ok(Math.abs(p1b.relogios.horasCorridas - 10) < 0.1);
  // 10h corridas - 2h esperando o cliente - 2h esperando a operadora (ainda aberta) = 6h do time
  assert.ok(Math.abs(p1b.relogios.horasDoTime - 6) < 0.1, `horas do time (veio ${p1b.relogios.horasDoTime})`);
  assert.ok(Math.abs(p1b.relogios.esperaAcumulada.cliente - 2) < 0.1 && Math.abs(p1b.relogios.esperaAcumulada.operadora - 2) < 0.1);
  assert.equal((await boardDoPosVenda(org, { tipo: null, familia: null, responsavelId: null, estado: null, recorte: "aguardando_cliente", busca: null })).total, 0, "bola com a operadora, não com o cliente");
  assert.equal((await encerrarEspera({ organizacaoId: org, fulfillmentId: v1.f, usuarioId: csm })).ok, true);
  assert.equal((await encerrarEspera({ organizacaoId: org, fulfillmentId: v1.f, usuarioId: csm })).ok, false, "sem espera em curso, recusa");

  // ── 4. Upgrade: a primeira jornada conclui; a segunda herda e cria SÓ o contato ──
  await db.execute(sql`UPDATE fulfillments SET status = 'COMPLETED', completed_at = now() - interval '1 day' WHERE id = ${v1.f}::uuid`);
  await db.execute(sql`UPDATE tarefas SET status = 'concluida', concluida = true, concluida_em = now() - interval '2 days' WHERE organizacao_id = ${org}::uuid AND chave_idempotencia LIKE ${`ONBOARDING:${v1.f}:%`}`);
  const v2 = await venda([{ produto: "Callface AI - Full · mensal", valor: 100, qtd: 2 }]);
  const f2 = await um<{ ant: string | null; etapas: Array<{ passo: string }> | null; status: string }>(sql`
    SELECT fulfillment_anterior_id::text AS ant, etapas_herdadas AS etapas, status FROM fulfillments WHERE id = ${v2.f}::uuid`);
  assert.equal(f2.ant, v1.f);
  assert.equal(f2.status, "NOT_STARTED", "upgrade reaparece em onboarding, não nasce concluído");
  assert.equal(f2.etapas?.length, 7);
  const tarefas2 = await rows<{ chave: string; titulo: string }>(sql`SELECT chave_idempotencia AS chave, titulo FROM tarefas WHERE organizacao_id = ${org}::uuid AND chave_idempotencia LIKE ${`ONBOARDING:${v2.f}:%`}`);
  assert.equal(tarefas2.length, 1, "só a tarefa de contato");
  assert.match(tarefas2[0].titulo, /suporte, dúvida ou treinamento agregado/);
  const p2 = (await projetoCompleto(org, v2.f))!;
  assert.equal(p2.herdadoDe?.projetoId, v1.f);
  assert.equal(p2.herdadoDe?.passosHerdados.length, 7);
  assert.equal(p2.tarefas.filter((x) => x.estado === "CONCLUIDA").length, 7, "as 7 anteriores aparecem concluídas, com a data histórica");
  assert.equal(p2.tarefas.length, 8);
  assert.ok(p2.tarefas.filter((x) => x.estado === "CONCLUIDA").every((x) => x.concluidaEm != null));
});

test("o caminho pelo NEGÓCIO (criarPosVendaDoNegocio) também passa pelo motor", async (t) => {
  if (!url) return t.skip("DATABASE_URL não definida");
  if (!bancoDescartavel) return t.skip("banco não é descartável (nome precisa terminar em _tmp ou _test)");
  const { db } = await import("@/lib/db");
  const { criarPosVendaDoNegocio } = await import("@/lib/crm/pos-venda");
  const um = async <T,>(q: ReturnType<typeof sql>) => ((await db.execute(q)) as unknown as T[])[0];
  const marca = `pvn-${Date.now()}`;
  const org = (await um<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${marca}, ${marca}) RETURNING id::text`)).id;
  const cru = (await import("postgres")).default(url, { max: 1, onnotice: () => {} });
  await cru.unsafe(fs.readFileSync(path.join(import.meta.dirname, "../db/migrations/0144_pos_venda_playbook_e_espera.sql"), "utf8"));
  await cru.end();
  const u = (await um<{ id: string }>(sql`INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role) VALUES (${org}::uuid, 'Closer', ${`${marca}@t.local`}, 'x', 'closer') RETURNING id::text`)).id;
  const empresa = (await um<{ id: string }>(sql`INSERT INTO empresas (organizacao_id, nome) VALUES (${org}::uuid, ${`Empresa ${marca}`}) RETURNING id::text`)).id;
  const lead = (await um<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, empresa_id, empresa, tipo, status) VALUES (${org}::uuid, 'Contato', ${empresa}::uuid, ${`Empresa ${marca}`}, 'lead', 'novo') RETURNING id::text`)).id;
  const negocio = (await um<{ id: string }>(sql`
    INSERT INTO negocios (organizacao_id, lead_id, empresa_id, responsavel_id, titulo, status, service_family, ganho_at)
    VALUES (${org}::uuid, ${lead}::uuid, ${empresa}::uuid, ${u}::uuid, 'Venda', 'ganho', 'CALLFACE_AI', now()) RETURNING id::text`)).id;
  const opp = (await um<{ id: string }>(sql`
    INSERT INTO oportunidades (organizacao_id, empresa_id, lead_id, responsavel_id, stage, service_family, negocio_id_legado)
    VALUES (${org}::uuid, ${empresa}::uuid, ${lead}::uuid, ${u}::uuid, 'ganho', 'CALLFACE_AI', ${negocio}::uuid) RETURNING id::text`)).id;
  await db.execute(sql`INSERT INTO oportunidade_itens (organizacao_id, oportunidade_id, produto, service_family, revenue_nature, quantidade, preco_unitario, valor_total, origem_legado)
    VALUES (${org}::uuid, ${opp}::uuid, 'Callface AI - Starter · Mensal', 'CALLFACE_AI', 'MRR', 5, 10, 50, 'manual')`);

  const r = await criarPosVendaDoNegocio(negocio, { ignorarFlag: true });
  assert.equal(r.criado, true, r.motivo);
  const f = await um<{ opp: string | null; snap: unknown; target: string | null; n: number }>(sql`
    SELECT oportunidade_id::text AS opp, escopo_vendido_snapshot AS snap, target_at::text AS target,
           (SELECT count(*)::int FROM tarefas WHERE organizacao_id = ${org}::uuid AND chave_idempotencia LIKE ${`ONBOARDING:${r.fulfillmentId}:%`}) AS n
      FROM fulfillments WHERE id = ${r.fulfillmentId}::uuid`);
  assert.equal(f.opp, opp);
  assert.ok(f.snap && f.target);
  assert.equal(f.n, 7);
  const velha = await um<{ n: number }>(sql`SELECT count(*)::int AS n FROM tarefas WHERE organizacao_id = ${org}::uuid AND tipo = 'onboarding_agendar_reuniao'`);
  assert.equal(velha.n, 0, "a tarefa avulsa antiga não nasce junto com o playbook");
});
