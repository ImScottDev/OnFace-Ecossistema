/**
 * Captação rastreável + distribuição por campanha + números operacionais (0131).
 *
 * Contra o banco real. A maior parte roda numa org de QA própria, apagada no
 * fim. O teste do webhook do RD usa a org fixa da rota (scott-studio) com uma
 * regra de prioridade 0 presa a uma utm_campaign única deste teste, para não
 * pegar lead de mais ninguém.
 *
 * node --import tsx --env-file=.env --test src/lib/captacao/captacao.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ErroDeRegra, ordenarRegras, regraCasaAtribuicao, resolverPorRegra, salvarRegra,
} from "@/lib/agentes/distribuicao";
import { abrirEntrega, chaveDaMeta, chaveDoRd, chavePorMinuto, fecharEntrega } from "./entregas";
import {
  ErroDeNumero, listarNumerosOperacionais, marcarOperacional, numeroOperacional, validarMarcacaoDoNumero,
} from "@/lib/whatsapp/uso-automatico";

const T = `qa-capt-${Date.now().toString(36)}`;
let org = "";
const usuarios: string[] = [];
let ator = "";
const sessoes: Record<string, string> = {};

before(async () => {
  const [o] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  org = o.id;
  for (let i = 0; i < 5; i++) {
    const [u] = await db.execute<{ id: string }>(sql`
      INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, ativo)
      VALUES (${org}::uuid, ${`QA ${i}`}, ${`${T}-${i}@qa.local`}, 'x', 'sdr', true) RETURNING id::text`);
    usuarios.push(u.id);
  }
  ator = usuarios[0];
  const nova = async (nome: string, p: { privado?: boolean; operacional?: boolean; status?: string; finalidade?: string }) => {
    const [s] = await db.execute<{ id: string }>(sql`
      INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, privado, operacional, status, finalidade)
      VALUES (${org}::uuid, ${`${T}-${nome}`}, ${nome}, ${p.privado ?? false}, ${p.operacional ?? false}, ${p.status ?? "connected"}, ${p.finalidade ?? null})
      RETURNING id::text`);
    sessoes[nome] = s.id;
  };
  await nova("privado", { privado: true });
  await nova("op-sdr", { operacional: true, finalidade: "SDR" });
  await nova("op-lia", { operacional: true, finalidade: "lia" });
  await nova("op-off", { operacional: true, status: "disconnected" });
  await nova("comum", {});
});

after(async () => {
  for (const t of ["captacao_entregas", "audit_log", "regras_distribuicao_leads", "whatsapp_sessao", "usuarios"]) {
    await db.execute(sql.raw(`DELETE FROM ${t} WHERE organizacao_id = '${org}'`)).catch((e) => console.error(t, e));
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`).catch(() => {});
});

const limparRegras = () => db.execute(sql`DELETE FROM regras_distribuicao_leads WHERE organizacao_id = ${org}::uuid`);

/* ── Critérios (regra pura) ─────────────────────────────────────────────── */

test("regra sem critério casa com qualquer lead; com critério, só com todos os critérios", () => {
  assert.equal(regraCasaAtribuicao({}, null), true, "sem critério = como antes da 0131");
  assert.equal(regraCasaAtribuicao({ origem: [], utmCampaign: null }, { origem: "Site" }), true, "lista vazia é 'qualquer'");
  const r = { utmCampaign: ["Black-Friday", "natal"], origem: ["Mídia Paga"] };
  assert.equal(regraCasaAtribuicao(r, { utmCampaign: " black-friday ", origem: "mídia paga" }), true, "sem caixa e sem espaço nas pontas");
  assert.equal(regraCasaAtribuicao(r, { utmCampaign: "black-friday", origem: "Site" }), false, "um critério falhando derruba a regra");
  assert.equal(regraCasaAtribuicao(r, { origem: "Mídia Paga" }), false, "lead sem a campanha não casa com regra de campanha");
  assert.equal(regraCasaAtribuicao({ utmCampaign: ["black"] }, { utmCampaign: "black-friday" }), false, "igualdade exata, não prefixo");
  assert.equal(regraCasaAtribuicao({ metaCampaignIds: ["123"], formulario: ["F1"] }, { metaCampaignId: "123", formulario: "f1" }), true);
});

test("ordem: prioridade, depois a regra mais específica, depois a mais antiga", () => {
  const t0 = new Date("2026-01-01"), t1 = new Date("2026-02-01");
  const ordem = ordenarRegras([
    { id: "geral-antiga", prioridade: 100, createdAt: t0 },
    { id: "campanha-nova", prioridade: 100, createdAt: t1, utmCampaign: ["x"] },
    { id: "urgente", prioridade: 10, createdAt: t1 },
    { id: "geral-nova", prioridade: 100, createdAt: t1 },
  ]).map((r) => r.id);
  assert.deepEqual(ordem, ["urgente", "campanha-nova", "geral-antiga", "geral-nova"]);
});

/* ── Resolução contra o banco ───────────────────────────────────────────── */

test("regra de campanha pega só o lead da campanha; o resto cai na regra geral", async () => {
  await limparRegras();
  const geral = await salvarRegra(org, ator, { nome: "Geral", alvoTipo: "usuario", alvoUsuarioId: usuarios[1] });
  const bf = await salvarRegra(org, ator, {
    nome: "Black Friday", alvoTipo: "usuario", alvoUsuarioId: usuarios[2],
    utmCampaign: ["black-friday"], sessaoWhatsappId: sessoes["op-sdr"], descricao: "Campanha de novembro",
  });
  const daCampanha = await resolverPorRegra({ organizacaoId: org, atribuicao: { utmCampaign: "Black-Friday", origem: "Mídia Paga" } });
  assert.equal(daCampanha?.regraId, bf.id);
  assert.equal(daCampanha?.responsavelId, usuarios[2]);
  assert.equal(daCampanha?.sessaoWhatsappId, sessoes["op-sdr"], "a regra devolve o número operacional");
  assert.match(daCampanha!.motivo, /Black Friday.*utm_campaign = black-friday/);

  const outra = await resolverPorRegra({ organizacaoId: org, atribuicao: { utmCampaign: "natal" } });
  assert.equal(outra?.regraId, geral.id, "campanha que não casa vai para a regra sem critério");
  assert.equal(outra?.sessaoWhatsappId, null);
  assert.match(outra!.motivo, /qualquer lead/);

  const semNada = await resolverPorRegra({ organizacaoId: org });
  assert.equal(semNada?.regraId, geral.id, "chamador antigo, sem atribuição, segue como antes");
});

test("prioridade manda sobre especificidade", async () => {
  await limparRegras();
  const urgente = await salvarRegra(org, ator, { nome: "Tudo para a Lia", alvoTipo: "usuario", alvoUsuarioId: usuarios[3], prioridade: 1 });
  await salvarRegra(org, ator, { nome: "Campanha", alvoTipo: "usuario", alvoUsuarioId: usuarios[2], utmCampaign: ["x"], prioridade: 50 });
  const r = await resolverPorRegra({ organizacaoId: org, atribuicao: { utmCampaign: "x" } });
  assert.equal(r?.regraId, urgente.id);
});

test("sem regra que case, devolve null (o chamador cai na política de inbound)", async () => {
  await limparRegras();
  await salvarRegra(org, ator, { nome: "Só formulário F", alvoTipo: "usuario", alvoUsuarioId: usuarios[2], formulario: ["F"] });
  assert.equal(await resolverPorRegra({ organizacaoId: org, atribuicao: { formulario: "G" } }), null);
});

test("rodízio é atômico: 10 leads simultâneos em 5 pessoas dão exatamente 2 para cada", async () => {
  await limparRegras();
  await salvarRegra(org, ator, { nome: "Rodízio", alvoTipo: "rodizio", rodizioUsuarioIds: usuarios });
  const r = await Promise.all(Array.from({ length: 10 }, () => resolverPorRegra({ organizacaoId: org })));
  const contagem = new Map<string, number>();
  for (const x of r) contagem.set(x!.responsavelId, (contagem.get(x!.responsavelId) ?? 0) + 1);
  assert.equal(contagem.size, 5, JSON.stringify([...contagem]));
  for (const [, n] of contagem) assert.equal(n, 2, `distribuição desigual: ${JSON.stringify([...contagem])}`);
});

test("número privado é recusado como alvo de regra; número de outra org também", async () => {
  await limparRegras();
  await assert.rejects(
    salvarRegra(org, ator, { nome: "Privado", alvoTipo: "usuario", alvoUsuarioId: usuarios[1], sessaoWhatsappId: sessoes.privado }),
    (e: unknown) => e instanceof ErroDeRegra && /privado/i.test(e.message),
  );
  await assert.rejects(
    salvarRegra(org, ator, { nome: "Alheio", alvoTipo: "usuario", alvoUsuarioId: usuarios[1], sessaoWhatsappId: randomUUID() }),
    ErroDeRegra,
  );
  const ok = await salvarRegra(org, ator, { nome: "Comum", alvoTipo: "usuario", alvoUsuarioId: usuarios[1], sessaoWhatsappId: sessoes.comum });
  assert.equal(ok.sessaoWhatsappId, sessoes.comum, "número compartilhado comum ainda é aceito");
});

test("número que virou privado depois da regra deixa de ser devolvido", async () => {
  await limparRegras();
  const [s] = await db.execute<{ id: string }>(sql`
    INSERT INTO whatsapp_sessao (organizacao_id, session_name, status) VALUES (${org}::uuid, ${`${T}-vira`}, 'connected') RETURNING id::text`);
  await salvarRegra(org, ator, { nome: "Com número", alvoTipo: "usuario", alvoUsuarioId: usuarios[1], sessaoWhatsappId: s.id });
  await db.execute(sql`UPDATE whatsapp_sessao SET privado = true WHERE id = ${s.id}::uuid`);
  const r = await resolverPorRegra({ organizacaoId: org });
  assert.equal(r?.responsavelId, usuarios[1], "o dono continua valendo");
  assert.equal(r?.sessaoWhatsappId, null);
  assert.match(r!.motivo, /número da regra ignorado/);
});

/* ── Números operacionais ───────────────────────────────────────────────── */

test("pool operacional: só conectado, não privado, marcado; privado nunca vira operacional", async () => {
  assert.equal(numeroOperacional({ operacional: true, privado: false }), true);
  assert.equal(numeroOperacional({ operacional: true, privado: true }), false);
  assert.ok(validarMarcacaoDoNumero({ privado: true, operacional: true }));
  assert.equal(validarMarcacaoDoNumero({ privado: false, operacional: true }), null);

  const lista = await listarNumerosOperacionais(org);
  assert.deepEqual(lista.map((n) => n.nome).sort(), ["op-lia", "op-sdr"]);
  assert.deepEqual((await listarNumerosOperacionais(org, { finalidade: "sdr" })).map((n) => n.nome), ["op-sdr"]);
  assert.equal((await listarNumerosOperacionais(org, { incluirDesconectados: true })).length, 3);

  await assert.rejects(marcarOperacional(org, sessoes.privado, true), ErroDeNumero);
  await assert.rejects(
    db.execute(sql`UPDATE whatsapp_sessao SET operacional = true WHERE id = ${sessoes.privado}::uuid`),
    "o CHECK do banco também recusa",
  );
  await marcarOperacional(org, sessoes.comum, true);
  assert.equal((await listarNumerosOperacionais(org)).length, 3);
  await marcarOperacional(org, sessoes.comum, false);
});

/* ── Caixa de entrada ───────────────────────────────────────────────────── */

test("caixa de entrada: reentrega do processado é duplicada; do que falhou, reprocessa", async () => {
  const chave = `leadgen:${T}`;
  const a = await abrirEntrega({ organizacaoId: org, canal: "meta", chave, payload: { leadgen_id: T } });
  assert.equal(a.duplicada, false);
  assert.ok(a.id);
  const emAndamento = await abrirEntrega({ organizacaoId: org, canal: "meta", chave, payload: {} });
  assert.equal(emAndamento.duplicada, true, "a mesma chave chegando enquanto a primeira processa não roda duas vezes");

  await fecharEntrega(a.id, { status: "falhou", erro: new Error("Graph sem permissão") });
  const retry = await abrirEntrega({ organizacaoId: org, canal: "meta", chave, payload: {} });
  assert.equal(retry.duplicada, false, "o que falhou é reprocessado na reentrega");
  assert.equal(retry.id, a.id, "na mesma linha");

  const lead = randomUUID();
  await fecharEntrega(retry.id, { status: "processada" });
  const depois = await abrirEntrega({ organizacaoId: org, canal: "meta", chave, payload: {} });
  assert.equal(depois.duplicada, true);
  const [linha] = await db.execute<{ status: string; entregas: number; erro: string | null; n: number }>(sql`
    SELECT status, entregas, erro, (SELECT count(*)::int FROM captacao_entregas WHERE organizacao_id = ${org}::uuid AND chave_idempotencia = ${chave}) AS n
      FROM captacao_entregas WHERE id = ${a.id}::uuid`);
  assert.equal(linha.n, 1, "uma linha por chave");
  assert.equal(linha.entregas, 4);
  assert.equal(linha.status, "processada");
  void lead;

  // A mesma chave em OUTRO canal é outra entrega.
  assert.equal((await abrirEntrega({ organizacaoId: org, canal: "rd", chave, payload: {} })).duplicada, false);
});

test("caixa de entrada: 'recebida' parada além do tempo de uma requisição é reprocessada", async () => {
  const chave = `travada:${T}`;
  const ontem = new Date(Date.now() - 24 * 3600_000);
  await abrirEntrega({ organizacaoId: org, canal: "site", chave, payload: {}, agora: ontem });
  assert.equal((await abrirEntrega({ organizacaoId: org, canal: "site", chave, payload: {} })).duplicada, false);
});

test("chaves de idempotência", () => {
  assert.equal(chaveDaMeta({ leadgen_id: "99" }), "leadgen:99");
  assert.equal(chaveDaMeta({ b: 1, a: 2 }), chaveDaMeta({ a: 2, b: 1 }), "hash independe da ordem das chaves");
  assert.equal(chaveDoRd({ uuid: "u", last_conversion: { created_at: "2026-10-20T10:00" } }), "lead:u:2026-10-20T10:00");
  const m = new Date("2026-10-20T10:00:10Z"), m2 = new Date("2026-10-20T10:00:50Z"), m3 = new Date("2026-10-20T10:01:01Z");
  assert.equal(chavePorMinuto({ x: 1 }, m), chavePorMinuto({ x: 1 }, m2), "clique duplo no mesmo minuto");
  assert.notEqual(chavePorMinuto({ x: 1 }, m), chavePorMinuto({ x: 1 }, m3));
});

/* ── Webhook do RD, ponta a ponta ───────────────────────────────────────── */

test("RD: lote distribui POR LEAD, reentrega não gasta vez do rodízio e o lead guarda a proveniência", async () => {
  process.env.RD_WEBHOOK_SECRET = process.env.RD_WEBHOOK_SECRET || `qa-${T}`;
  const { POST } = await import("@/app/api/webhooks/rd-lead/route");
  const { NextRequest } = await import("next/server");
  const [cf] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes WHERE slug = 'scott-studio'`);
  assert.ok(cf, "org scott-studio precisa existir no banco de teste");
  const donos = (await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios WHERE organizacao_id = ${cf.id}::uuid AND ativo = true ORDER BY email LIMIT 2`)).map((u) => u.id);
  assert.equal(donos.length, 2);
  const campanha = `qa-campanha-${T}`;
  const [regra] = await db.execute<{ id: string }>(sql`
    INSERT INTO regras_distribuicao_leads (organizacao_id, nome, alvo_tipo, rodizio_usuario_ids, utm_campaign, prioridade)
    VALUES (${cf.id}::uuid, ${`QA ${T}`}, 'rodizio', ${`{${donos.join(",")}}`}::uuid[], ${`{${campanha}}`}::text[], 0) RETURNING id::text`);

  const sufixo = String(Date.now()).slice(-6);
  const leadRd = (n: number) => ({
    name: `QA Rd ${n} ${T}`, email: `${T}-rd${n}@qa.local`, personal_phone: `1197${sufixo}${n}`,
    last_conversion: {
      content: { conversion_identifier: "cf-qa-form" },
      conversion_origin: { source: "facebook", medium: "cpc", campaign: campanha },
    },
  });
  const enviar = (leadsRd: unknown[]) => POST(new NextRequest(`http://local/api/webhooks/rd-lead?token=${process.env.RD_WEBHOOK_SECRET}`, {
    method: "POST", body: JSON.stringify({ leads: leadsRd }), headers: { "content-type": "application/json" },
  }));
  const criados: string[] = [];
  try {
    // Lote com dois leads: antes, o lote inteiro ia para a mesma pessoa.
    const r1 = await (await enviar([leadRd(1), leadRd(2)])).json() as { results: { status: string; leadId?: string }[] };
    assert.deepEqual(r1.results.map((x) => x.status), ["created", "created"], JSON.stringify(r1));
    criados.push(...r1.results.map((x) => x.leadId!));
    // Reentrega do lead 1 (mesmo payload): pulada, sem gastar vez.
    const r2 = await (await enviar([leadRd(1)])).json() as { results: { status: string; leadId?: string }[] };
    assert.equal(r2.results[0].status, "skipped:duplicate", JSON.stringify(r2));
    // Mesma pessoa, conversão nova (payload diferente): atualiza o lead existente, também sem gastar vez.
    const r2b = await (await enviar([{ ...leadRd(1), last_conversion: { ...leadRd(1).last_conversion, created_at: "2026-10-20T12:00:00Z" } }])).json() as { results: { status: string }[] };
    assert.equal(r2b.results[0].status, "updated", JSON.stringify(r2b));
    // Lead 3: a vez seguinte do rodízio, como se a reentrega não tivesse existido.
    const r3 = await (await enviar([leadRd(3)])).json() as { results: { status: string; leadId?: string }[] };
    assert.equal(r3.results[0].status, "created", JSON.stringify(r3));
    criados.push(r3.results[0].leadId!);

    const linhas = await db.execute<{ id: string; responsavel_id: string; distribuicao_regra_id: string; distribuicao_motivo: string }>(sql`
      SELECT id::text, responsavel_id::text, distribuicao_regra_id::text, distribuicao_motivo FROM leads
       WHERE id = ANY(${`{${criados.join(",")}}`}::uuid[])`);
    const porId = new Map(linhas.map((l) => [l.id, l]));
    const seq = criados.map((id) => porId.get(id)!.responsavel_id);
    assert.notEqual(seq[0], seq[1], "lote distribuído por lead");
    assert.equal(seq[2], seq[0], "com dois no rodízio, o 3º volta ao 1º: a reentrega não gastou vez");
    for (const l of linhas) {
      assert.equal(l.distribuicao_regra_id, regra.id);
      assert.match(l.distribuicao_motivo, /utm_campaign/);
    }
    const entregas = await db.execute<{ status: string; entregas: number; lead_id: string | null }>(sql`
      SELECT status, entregas, lead_id::text FROM captacao_entregas
       WHERE organizacao_id = ${cf.id}::uuid AND canal = 'rd' AND lead_id = ANY(${`{${criados.join(",")}}`}::uuid[]) ORDER BY created_at`);
    assert.deepEqual(entregas.map((e) => [e.status, e.entregas]), [["processada", 2], ["processada", 1], ["duplicada", 1], ["processada", 1]]);
    const [evento] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM vendas_eventos WHERE tipo = 'LeadAssigned' AND lead_id = ANY(${`{${criados.join(",")}}`}::uuid[])`);
    assert.equal(evento.n, 3, "a atribuição pelo webhook deixa evento LeadAssigned");
  } finally {
    const ids = `{${criados.filter(Boolean).join(",")}}`;
    for (const q of [
      sql`DELETE FROM captacao_entregas WHERE organizacao_id = ${cf.id}::uuid AND (lead_id = ANY(${ids}::uuid[]) OR payload->>'email' LIKE ${`${T}%`})`,
      sql`DELETE FROM vendas_eventos WHERE lead_id = ANY(${ids}::uuid[])`,
      sql`DELETE FROM tarefas WHERE lead_id = ANY(${ids}::uuid[])`,
      sql`DELETE FROM status_changes WHERE lead_id = ANY(${ids}::uuid[])`,
      sql`DELETE FROM notas WHERE lead_id = ANY(${ids}::uuid[])`,
      sql`DELETE FROM pontos_contato WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ANY(${ids}::uuid[]))`,
      sql`DELETE FROM aquisicoes WHERE lead_legado_id = ANY(${ids}::uuid[])`,
      sql`DELETE FROM pessoas WHERE lead_id_legado = ANY(${ids}::uuid[])`,
      sql`DELETE FROM leads WHERE id = ANY(${ids}::uuid[])`,
      sql`DELETE FROM regras_distribuicao_leads WHERE id = ${regra.id}::uuid`,
    ]) await db.execute(q).catch((e) => console.error("[limpeza]", String(e).slice(0, 200)));
  }
});

after(async () => {
  const { fecharConexao } = await import("@/lib/db");
  await fecharConexao();
});
