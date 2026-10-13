/**
 * Calendário ponta a ponta contra um Graph FALSO (nenhuma chamada sai para a Microsoft):
 * fuso, editar = PATCH sem duplicar, 404 recria, cancelar nos dois sentidos, volta Outlook ->
 * ONFACE por delta e por notificação, e disponibilidade da equipe.
 *
 * Banco local (DATABASE_URL, migration 0110 aplicada). Cria organização, usuários e contas próprios,
 * com marca no nome, e remove tudo no fim.
 *
 *   cd app && npx tsx --env-file=.env --test src/lib/calendario/volta-outlook.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/email/encryption";
import { criarNaAgenda, atualizarNaAgenda, cancelarNaAgenda, usarProvidersDeTeste } from "./sincronizar";
import { microsoftCalendar } from "./microsoft";
import { rodarDelta, processarNotificacoes, refletirEvento, type ContaVolta } from "./volta";
import { horariosLivresEquipe } from "./disponibilidade";
import { dataHoraGraph } from "./fuso";

const MARCA = `qa-cal-${Date.now().toString(36)}`;
process.env.EMAIL_ENCRYPTION_KEY ||= "11".repeat(32); // só para cifrar o token falso desta conta de teste
const opts = { skip: process.env.DATABASE_URL ? false : "sem DATABASE_URL" };

// ─── Graph falso ────────────────────────────────────────────────────────────
type Ev = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const graph = {
  eventos: new Map<string, Ev>(),
  chamadas: [] as { m: string; caminho: string; corpo: any }[], // eslint-disable-line @typescript-eslint/no-explicit-any
  ocupado: [] as { start: string; end: string }[],
  scheduleComErro: false,
  cancelarRecusa: false,
  seq: 0,
};
const utc = (d: { dateTime: string; timeZone: string }) => {
  // "E. South America Standard Time" = UTC-3 fixo
  const t = new Date(`${d.dateTime}Z`).getTime() + (d.timeZone === "UTC" ? 0 : 3 * 3_600_000);
  return { dateTime: new Date(t).toISOString().replace("Z", "0000"), timeZone: "UTC" };
};
const resp = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const vezes = (m: string, re: RegExp) => graph.chamadas.filter((c) => c.m === m && re.test(c.caminho)).length;

const fetchReal = globalThis.fetch;
function instalarGraphFalso() {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const caminho = decodeURIComponent(u.pathname.replace("/v1.0", ""));
    const m = (init?.method ?? "GET").toUpperCase();
    const corpo = init?.body ? JSON.parse(String(init.body)) : null;
    graph.chamadas.push({ m, caminho, corpo });
    const id = caminho.match(/^\/me\/events\/([^/]+)/)?.[1];

    if (m === "POST" && caminho === "/me/events") {
      const novo = `EV${++graph.seq}`;
      graph.eventos.set(novo, { id: novo, subject: corpo.subject, start: utc(corpo.start), end: utc(corpo.end), isCancelled: false,
        attendees: (corpo.attendees ?? []).map((a: Ev) => ({ ...a, status: { response: "none" } })), onlineMeeting: { joinUrl: `https://teams.test/${novo}` }, organizer: { emailAddress: { address: `${MARCA}-closer@example.test` } } });
      return resp(201, { id: novo, webLink: `https://outlook.test/${novo}`, onlineMeeting: { joinUrl: `https://teams.test/${novo}` } });
    }
    if (id && m === "GET") { const e = graph.eventos.get(id); return e ? resp(200, e) : resp(404, { error: { code: "ErrorItemNotFound" } }); }
    if (id && m === "PATCH") {
      const e = graph.eventos.get(id); if (!e) return resp(404, {});
      if (corpo.subject) e.subject = corpo.subject;
      if (corpo.start) e.start = utc(corpo.start);
      if (corpo.end) e.end = utc(corpo.end);
      if (corpo.attendees) e.attendees = corpo.attendees;
      return resp(200, e);
    }
    if (id && m === "POST" && caminho.endsWith("/cancel")) {
      if (graph.cancelarRecusa) return resp(400, { error: { code: "ErrorInvalidRequest" } });
      const e = graph.eventos.get(id); if (!e) return resp(404, {});
      e.isCancelled = true; return resp(202);
    }
    if (id && m === "DELETE") { graph.eventos.delete(id); return resp(204); }
    if (m === "GET" && caminho === "/me/calendarView/delta") return resp(200, { value: [...graph.eventos.values()], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=t1" });
    if (m === "GET" && caminho === "/me/calendarView") {
      return resp(200, { value: graph.ocupado.map((o) => ({ start: { dateTime: o.start.replace("Z", "") }, end: { dateTime: o.end.replace("Z", "") }, showAs: "busy" })) });
    }
    if (m === "POST" && caminho === "/me/calendar/getSchedule") {
      if (graph.scheduleComErro) return resp(200, { value: [{ error: { message: "sem permissão" } }] });
      return resp(200, { value: [{ scheduleItems: graph.ocupado.map((o) => ({ status: "busy", start: { dateTime: o.start.replace("Z", "") }, end: { dateTime: o.end.replace("Z", "") } })) }] });
    }
    return resp(500, { error: `fake: rota não prevista ${m} ${caminho}` });
  }) as typeof fetch;
}

// ─── Cenário ────────────────────────────────────────────────────────────────
let org = "", lead = "", closer = "", contaId = "", conta: ContaVolta, closerSemConta = "", restaurar = () => {};
const ids = { reunioes: [] as string[] };

async function reuniao(titulo: string, participantes: string[] = ["cliente@example.test"]) {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO reunioes (organizacao_id, lead_id, titulo, data, duracao, status, responsavel_id, participantes)
    VALUES (${org}::uuid, ${lead}::uuid, ${`${MARCA} ${titulo}`}, '2026-10-20T12:00:00Z', 60, 'agendada', ${closer}::uuid,
            ARRAY[${sql.join(participantes.map((p) => sql`${p}`), sql`, `)}]::text[]) RETURNING id::text`);
  ids.reunioes.push(r.id);
  return r.id;
}
const linha = async (id: string) => (await db.execute<Record<string, any>>(sql`SELECT *, to_jsonb(participantes) AS pj FROM reunioes WHERE id = ${id}::uuid`))[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
const envelhecer = (id: string) => db.execute(sql`UPDATE reunioes SET calendar_sync_em = now() - interval '10 seconds', updated_at = now() - interval '10 seconds' WHERE id = ${id}::uuid`);

before(async () => {
  if (opts.skip) return;
  process.env.MICROSOFT_CLIENT_ID ||= "qa"; process.env.MICROSOFT_CLIENT_SECRET ||= "qa";
  process.env.MICROSOFT_CALENDAR_CLIENT_STATE = "segredo-de-teste";
  const [o] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${MARCA}, ${MARCA}) RETURNING id::text`);
  org = o.id;
  const usuario = async (nome: string) => (await db.execute<{ id: string }>(sql`
    INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, tipo, ativo) VALUES (${org}::uuid, ${nome}, ${`${MARCA}-${nome}@example.test`}, 'x', 'closer', 'humano', true) RETURNING id::text`))[0].id;
  lead = (await db.execute<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome) VALUES (${org}::uuid, ${MARCA}) RETURNING id::text`))[0].id;
  closer = await usuario("closer");
  closerSemConta = await usuario("semconta");
  for (const u of [closer, closerSemConta]) {
    await db.execute(sql`INSERT INTO closer_disponibilidade (organizacao_id, usuario_id, horario_trabalho, pausa_almoco)
      VALUES (${org}::uuid, ${u}::uuid, '{"inicio":"09:00","fim":"18:00","diasSemana":[0,1,2,3,4,5,6]}'::jsonb, '{"inicio":"12:00","fim":"13:00"}'::jsonb)`);
  }
  const [c] = await db.execute<{ id: string }>(sql`
    INSERT INTO email_contas (organizacao_id, usuario_id, tipo, email, access_token, token_expiry, sync_status)
    VALUES (${org}::uuid, ${closer}::uuid, 'microsoft', ${`${MARCA}-closer@example.test`}, ${encrypt("tok")}, now() + interval '1 hour', 'active') RETURNING id::text`);
  contaId = c.id;
  conta = { id: contaId, usuarioId: closer, organizacaoId: org, email: `${MARCA}-closer@example.test` };
  restaurar = usarProvidersDeTeste([microsoftCalendar]);
  instalarGraphFalso();
});

after(async () => {
  globalThis.fetch = fetchReal;
  restaurar();
  if (opts.skip || !org) return;
  await db.execute(sql`DELETE FROM vendas_eventos WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM reunioes WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM calendario_assinaturas WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM email_contas WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM closer_disponibilidade WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM atividades WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM leads WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM usuarios WHERE organizacao_id = ${org}::uuid`);
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`);
});

test("fuso: Graph recebe hora de Brasília + nome de fuso Windows, nunca UTC", () => {
  assert.deepEqual(dataHoraGraph("2026-10-20T12:00:00Z"), { dateTime: "2026-10-20T09:00:00", timeZone: "E. South America Standard Time" });
  assert.equal(dataHoraGraph("2026-10-20T02:30:00Z").dateTime, "2026-10-19T23:30:00");
});

let rid = "", evento = "";

test("criar: start/end em E. South America Standard Time, vínculo e conta gravados", opts, async () => {
  rid = await reuniao("principal");
  const r = await criarNaAgenda(org, rid);
  assert.equal(r.sincronizado, true, JSON.stringify(r) + JSON.stringify(graph.chamadas.slice(-3)));
  const post = graph.chamadas.find((c) => c.m === "POST" && c.caminho === "/me/events")!;
  assert.deepEqual(post.corpo.start, { dateTime: "2026-10-20T09:00:00", timeZone: "E. South America Standard Time" });
  assert.deepEqual(post.corpo.end, { dateTime: "2026-10-20T10:00:00", timeZone: "E. South America Standard Time" });
  const l = await linha(rid);
  evento = l.calendar_event_id;
  assert.ok(evento);
  assert.equal(l.calendar_conta_id, contaId);
  assert.equal(l.calendar_sync_status, "ok");
});

test("criações simultâneas não duplicam o evento", opts, async () => {
  const id = await reuniao("corrida");
  const antes = vezes("POST", /^\/me\/events$/);
  await Promise.all([criarNaAgenda(org, id), criarNaAgenda(org, id), atualizarNaAgenda(org, id)]);
  assert.equal(vezes("POST", /^\/me\/events$/) - antes, 1);
});

test("editar = PATCH do evento existente, com fuso, sem criar outro", opts, async () => {
  await db.execute(sql`UPDATE reunioes SET data = '2026-10-20T14:00:00Z', duracao = 30, titulo = ${`${MARCA} editada`} WHERE id = ${rid}::uuid`);
  const posts = vezes("POST", /^\/me\/events$/), eventos = graph.eventos.size;
  const r = await atualizarNaAgenda(org, rid);
  assert.equal(r.sincronizado, true);
  assert.equal(vezes("POST", /^\/me\/events$/), posts, "editar não pode criar evento");
  assert.equal(graph.eventos.size, eventos);
  const patch = graph.chamadas.filter((c) => c.m === "PATCH" && c.caminho === `/me/events/${evento}`).at(-1)!;
  assert.deepEqual(patch.corpo.start, { dateTime: "2026-10-20T11:00:00", timeZone: "E. South America Standard Time" });
  assert.deepEqual(patch.corpo.end, { dateTime: "2026-10-20T11:30:00", timeZone: "E. South America Standard Time" });
  assert.equal(graph.eventos.get(evento)!.subject, `${MARCA} editada`);
});

test("participantes: incluir e remover vira PATCH de attendees e preserva a resposta de quem ficou", opts, async () => {
  graph.eventos.get(evento)!.attendees = [{ emailAddress: { address: "cliente@example.test" }, type: "required", status: { response: "accepted" } }];
  await db.execute(sql`UPDATE reunioes SET participantes = ARRAY['cliente@example.test','novo@example.test']::text[] WHERE id = ${rid}::uuid`);
  await atualizarNaAgenda(org, rid, { convidados: true });
  let a = graph.eventos.get(evento)!.attendees as Ev[];
  assert.deepEqual(a.map((x) => x.emailAddress.address).sort(), ["cliente@example.test", "novo@example.test"]);
  assert.equal(a.find((x) => x.emailAddress.address === "cliente@example.test")!.status.response, "accepted", "a resposta de quem já estava não pode ser zerada");

  await db.execute(sql`UPDATE reunioes SET participantes = ARRAY['novo@example.test']::text[] WHERE id = ${rid}::uuid`);
  await atualizarNaAgenda(org, rid, { convidados: true });
  a = graph.eventos.get(evento)!.attendees as Ev[];
  assert.deepEqual(a.map((x) => x.emailAddress.address), ["novo@example.test"]);
});

test("Outlook -> ONFACE (delta): horário, duração, título, link, convidados e respostas; reaplicar não grava", opts, async () => {
  const e = graph.eventos.get(evento)!;
  e.subject = `${MARCA} remarcada no Outlook`;
  e.start = { dateTime: "2026-10-21T15:00:00.0000000", timeZone: "UTC" };
  e.end = { dateTime: "2026-10-21T16:30:00.0000000", timeZone: "UTC" };
  e.attendees = [
    { emailAddress: { address: "novo@example.test" }, status: { response: "accepted" } },
    { emailAddress: { address: "Outro@Example.test" }, status: { response: "declined" } },
    { emailAddress: { address: `${MARCA}-closer@example.test` }, status: { response: "organizer" } },
  ];
  await envelhecer(rid);
  const r1 = await rodarDelta(conta);
  assert.ok(r1.reunioes >= 1);
  const l = await linha(rid);
  assert.equal(new Date(l.data).toISOString(), "2026-10-21T15:00:00.000Z");
  assert.equal(l.duracao, 90);
  assert.equal(l.titulo, `${MARCA} remarcada no Outlook`);
  assert.deepEqual([...l.pj].sort(), ["novo@example.test", "outro@example.test"]);
  assert.deepEqual(l.participantes_respostas, { "novo@example.test": "accepted", "outro@example.test": "declined" });
  assert.equal(l.link, `https://teams.test/${evento}`);
  const [ev] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vendas_eventos WHERE reuniao_id = ${rid}::uuid AND tipo = 'MeetingRescheduled'`);
  assert.equal(ev.n, 1);

  const antes = (await linha(rid)).updated_at;
  assert.equal((await rodarDelta(conta)).reunioes, 0);
  assert.equal(String((await linha(rid)).updated_at), String(antes), "segunda passada não pode regravar nada");
  const [est] = await db.execute<{ delta_link: string }>(sql`SELECT delta_link FROM calendario_assinaturas WHERE conta_id = ${contaId}::uuid`);
  assert.match(est.delta_link, /deltatoken/);
});

test("a volta não desfaz alteração do ONFACE que ainda não foi ao Outlook", opts, async () => {
  await db.execute(sql`UPDATE reunioes SET titulo = ${`${MARCA} só no onface`}, updated_at = now(), calendar_sync_em = now() - interval '5 seconds' WHERE id = ${rid}::uuid`);
  assert.equal(await refletirEvento(conta, evento, graph.eventos.get(evento)! as never), "ignorada");
  assert.equal((await linha(rid)).titulo, `${MARCA} só no onface`);
});

test("evento apagado (404) no PATCH: recria e troca o id, sem deixar duplicata", opts, async () => {
  await envelhecer(rid);
  graph.eventos.delete(evento);
  const posts = vezes("POST", /^\/me\/events$/);
  const r = await atualizarNaAgenda(org, rid);
  assert.equal(r.sincronizado, true);
  assert.equal(vezes("POST", /^\/me\/events$/) - posts, 1);
  const novo = (await linha(rid)).calendar_event_id;
  assert.notEqual(novo, evento);
  assert.ok(graph.eventos.has(novo));
  evento = novo;
});

test("notificação: clientState errado é descartado; deleted cancela a reunião com evento na timeline, uma vez", opts, async () => {
  await db.execute(sql`INSERT INTO calendario_assinaturas (conta_id, organizacao_id, subscription_id, expira_em) VALUES (${contaId}::uuid, ${org}::uuid, ${`sub-${MARCA}`}, now() + interval '2 days')
    ON CONFLICT (conta_id) DO UPDATE SET subscription_id = EXCLUDED.subscription_id`);
  await envelhecer(rid);
  const forjada = await processarNotificacoes([{ subscriptionId: `sub-${MARCA}`, clientState: "errado", changeType: "deleted", resourceData: { id: evento } }], "segredo-de-teste");
  assert.equal(forjada.descartadas, 1);
  assert.equal((await linha(rid)).status, "agendada");

  const boa = { subscriptionId: `sub-${MARCA}`, clientState: "segredo-de-teste", changeType: "deleted", resourceData: { id: evento } };
  await processarNotificacoes([boa, boa], "segredo-de-teste");
  assert.equal((await linha(rid)).status, "cancelada");
  await processarNotificacoes([boa], "segredo-de-teste");
  const [ev] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vendas_eventos WHERE reuniao_id = ${rid}::uuid AND tipo = 'MeetingCancelled'`);
  assert.equal(ev.n, 1);
});

test("notificação updated: lê o evento e cancelamento do organizador (isCancelled) cancela", opts, async () => {
  const id = await reuniao("cancelada la");
  await criarNaAgenda(org, id);
  const ev = (await linha(id)).calendar_event_id as string;
  graph.eventos.get(ev)!.isCancelled = true;
  await envelhecer(id);
  await processarNotificacoes([{ subscriptionId: `sub-${MARCA}`, clientState: "segredo-de-teste", changeType: "updated", resourceData: { id: ev } }], "segredo-de-teste");
  assert.equal((await linha(id)).status, "cancelada");
});

test("cancelar no ONFACE: POST /cancel com comentário; se o Graph recusar (400) cai no DELETE; sem eco", opts, async () => {
  const a = await reuniao("cancela via cancel");
  await criarNaAgenda(org, a);
  const ea = (await linha(a)).calendar_event_id as string;
  const r = await cancelarNaAgenda(org, a, "Cliente desistiu");
  assert.equal(r.sincronizado, true);
  const c = graph.chamadas.filter((x) => x.caminho === `/me/events/${ea}/cancel`).at(-1)!;
  assert.equal(c.corpo.comment, "Cliente desistiu");
  assert.equal(graph.eventos.get(ea)!.isCancelled, true);

  const b = await reuniao("cancela via delete");
  await criarNaAgenda(org, b);
  const eb = (await linha(b)).calendar_event_id as string;
  graph.cancelarRecusa = true;
  await cancelarNaAgenda(org, b);
  graph.cancelarRecusa = false;
  assert.equal(graph.eventos.has(eb), false);
});

test("disponibilidade: grade em horário de Brasília menos o ocupado do Outlook; closer sem Outlook não oferece", opts, async () => {
  // bloqueia o primeiro horário que seria oferecido
  const livre0 = await horariosLivresEquipe({ organizacaoId: org, duracaoMin: 30, dias: 5, maxSlots: 20 });
  assert.equal(livre0.verificado, true);
  assert.ok(livre0.slots.length > 0);
  assert.ok(livre0.slots.every((s) => s.closerId === closer), "closer sem Outlook verificado não pode aparecer");
  assert.equal(livre0.closers.find((c) => c.id === closerSemConta)?.verificado, false);
  for (const s of livre0.slots) {
    const hora = Number(new Date(s.inicioISO).toLocaleString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }));
    assert.ok(hora >= 9 && hora < 18 && hora !== 12, `horário fora do expediente: ${s.label}`);
    assert.ok(new Date(s.inicioISO).getTime() >= Date.now() + 30 * 60_000, "antecedência mínima");
  }
  const alvo = livre0.slots[0];
  graph.ocupado = [{ start: alvo.inicioISO, end: alvo.fimISO }];
  const livre1 = await horariosLivresEquipe({ organizacaoId: org, duracaoMin: 30, dias: 5, maxSlots: 20 });
  assert.ok(!livre1.slots.some((s) => s.inicioISO === alvo.inicioISO), "horário ocupado no Outlook foi oferecido");

  // getSchedule com erro cai no calendarView: continua respeitando o ocupado, nunca vira livre
  graph.scheduleComErro = true;
  const livre2 = await horariosLivresEquipe({ organizacaoId: org, duracaoMin: 30, dias: 5, maxSlots: 20 });
  assert.ok(!livre2.slots.some((s) => s.inicioISO === alvo.inicioISO));
  graph.scheduleComErro = false; graph.ocupado = [];
});

test("rota do webhook: fail-closed, validationToken, clientState e 202", opts, async () => {
  const { POST } = await import("@/app/api/webhooks/microsoft-calendar/route");
  const req = (qs: string, corpo?: unknown) => new NextRequest(`https://crm.test/api/webhooks/microsoft-calendar${qs}`, { method: "POST", body: corpo ? JSON.stringify(corpo) : undefined });

  const salvo = process.env.MICROSOFT_CALENDAR_CLIENT_STATE;
  delete process.env.MICROSOFT_CALENDAR_CLIENT_STATE;
  assert.equal((await POST(req("?validationToken=abc"))).status, 503, "sem segredo recusa até a validação");
  process.env.MICROSOFT_CALENDAR_CLIENT_STATE = salvo;

  const v = await POST(req("?validationToken=abc%20123"));
  assert.equal(v.status, 200);
  assert.equal(await v.text(), "abc 123");
  assert.match(v.headers.get("content-type") ?? "", /text\/plain/);

  assert.equal((await POST(req("", { value: [{ clientState: "forjado", subscriptionId: "x", resourceData: { id: "y" } }] }))).status, 401);
  assert.equal((await POST(req("", { value: [{ clientState: "segredo-de-teste", subscriptionId: "inexistente", resourceData: { id: "y" } }] }))).status, 202);
});
