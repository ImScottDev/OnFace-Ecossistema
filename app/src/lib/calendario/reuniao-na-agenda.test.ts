/**
 * Toda reunião passa pela mesma porta de calendário (criar, reagendar, convidar, cancelar).
 *
 * Fake no lugar do Graph/Google: o que se prova é o que a porta pede ao provedor e o que
 * grava de volta (vínculo, estado, participantes). Roda no banco local (DATABASE_URL);
 * sem ele, pula. Limpa só as linhas que cria (título com marca).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { convidadosDe, criarNaAgenda, atualizarNaAgenda, cancelarNaAgenda, usarProvidersDeTeste } from "./sincronizar";
import { agendarReuniao } from "@/lib/vendas/pipeline";
import type { CalendarProvider, EventoParaAtualizar, EventoParaCriar, ResultadoProvider } from "./provider";

const MARCA = `[QA agenda ${Date.now().toString(36)}]`;
const opts = { skip: process.env.DATABASE_URL ? false : "sem DATABASE_URL" };

const chamadas = { criar: [] as EventoParaCriar[], atualizar: [] as EventoParaAtualizar[], cancelar: [] as string[] };
let falhar: ResultadoProvider | null = null;
const fake: CalendarProvider = {
  nome: "microsoft",
  configurado: () => true,
  contaDoUsuario: async () => "conta-fake",
  criar: async (_c, ev) => { chamadas.criar.push(ev); return falhar ?? { ok: true, eventId: "evt-1", joinUrl: "https://teams.example/j/1", link: "https://outlook.example/1" }; },
  atualizar: async (_c, id, m) => { chamadas.atualizar.push(m); return falhar ?? { ok: true, eventId: id }; },
  cancelar: async (_c, id) => { chamadas.cancelar.push(id); return falhar ?? { ok: true, eventId: id }; },
  ocupados: async () => ({ ok: true, faixas: [] }),
};

let org = "", usuario = "", restaurar: () => void = () => {};
const novaReuniao = async (participantes: string[] | null) => {
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO reunioes (organizacao_id, titulo, data, duracao, status, responsavel_id, participantes)
    VALUES (${org}::uuid, ${MARCA + " r"}, now() + interval '2 days', 30, 'agendada', ${usuario}::uuid,
            ${participantes ? sql`ARRAY[${sql.join(participantes.map((p) => sql`${p}`), sql`, `)}]::text[]` : null})
    RETURNING id::text`);
  return r.id;
};
const linha = async (id: string) => (await db.execute<Record<string, unknown>>(sql`
  SELECT calendar_provider, calendar_event_id, outlook_event_id, calendar_sync_status, calendar_sync_erro, link, participantes
    FROM reunioes WHERE id = ${id}::uuid`))[0];

before(async () => {
  if (!opts.skip) {
    const [u] = await db.execute<{ id: string; organizacao_id: string }>(sql`SELECT id::text, organizacao_id::text FROM usuarios WHERE ativo = true AND tipo <> 'agente' LIMIT 1`);
    org = u.organizacao_id; usuario = u.id;
    restaurar = usarProvidersDeTeste([fake]);
  }
});
after(async () => {
  restaurar();
  if (!opts.skip) {
    await db.execute(sql`DELETE FROM vendas_eventos WHERE reuniao_id IN (SELECT id FROM reunioes WHERE titulo LIKE ${MARCA + "%"})`);
    await db.execute(sql`DELETE FROM reunioes WHERE titulo LIKE ${MARCA + "%"}`);
  }
});

test("convidados = participantes com e-mail + contato do processo, sem repetir", () => {
  assert.deepEqual(convidadosDe({ participantes: ["A@x.com", "sem-email", "b@x.com"], convidado_email: "a@x.com" }), ["a@x.com", "b@x.com"]);
  assert.deepEqual(convidadosDe({ participantes: null, convidado_email: null }), []);
});

test("criar: evento com todos os participantes, vínculo e estado gravados", opts, async () => {
  chamadas.criar.length = 0; falhar = null;
  const id = await novaReuniao(["cliente@x.com", "colega@x.com"]);
  const r = await criarNaAgenda(org, id);
  assert.equal(r.sincronizado, true);
  assert.deepEqual(chamadas.criar[0].convidados, ["cliente@x.com", "colega@x.com"]);
  const l = await linha(id);
  assert.equal(l.calendar_event_id, "evt-1");
  assert.equal(l.outlook_event_id, "evt-1"); // ponte com o sync de volta do Outlook
  assert.equal(l.calendar_sync_status, "ok");
  assert.equal(l.link, "https://teams.example/j/1");
});

test("criar sem ninguém para convidar: cria o evento e avisa", opts, async () => {
  falhar = null;
  const id = await novaReuniao(null);
  const r = await criarNaAgenda(org, id);
  assert.equal(r.sincronizado, true);
  assert.equal(r.semConvidado, true);
});

test("falha do provedor não some: estado 'falhou', erro gravado, frase para a tela", opts, async () => {
  falhar = { ok: false, motivo: "token_expirado", detalhe: "invalid_grant", tentarDeNovo: false };
  const id = await novaReuniao(["cliente@x.com"]);
  const r = await criarNaAgenda(org, id);
  falhar = null;
  assert.equal(r.sincronizado, false);
  assert.match(r.aviso ?? "", /expirou/);
  const l = await linha(id);
  assert.equal(l.calendar_sync_status, "falhou");
  assert.equal(l.calendar_event_id, null);
});

test("reagendar e mudar participantes atualizam o MESMO evento; remover participante tira do convite", opts, async () => {
  falhar = null; chamadas.atualizar.length = 0; chamadas.criar.length = 0;
  const id = await novaReuniao(["cliente@x.com", "colega@x.com"]);
  await criarNaAgenda(org, id);
  await db.execute(sql`UPDATE reunioes SET data = data + interval '1 day', participantes = ARRAY['cliente@x.com']::text[] WHERE id = ${id}::uuid`);
  const r = await atualizarNaAgenda(org, id, { convidados: true });
  assert.equal(r.sincronizado, true);
  assert.equal(chamadas.criar.length, 1, "não cria um segundo convite");
  assert.deepEqual(chamadas.atualizar[0].convidados, ["cliente@x.com"]);
  // sem mudar participantes, a lista do evento não é tocada (preserva o que mexeram no Outlook)
  await atualizarNaAgenda(org, id);
  assert.equal(chamadas.atualizar[1].convidados, undefined);
});

test("cancelar cancela o evento no provedor", opts, async () => {
  falhar = null; chamadas.cancelar.length = 0;
  const id = await novaReuniao(["cliente@x.com"]);
  await criarNaAgenda(org, id);
  const r = await cancelarNaAgenda(org, id);
  assert.equal(r.sincronizado, true);
  assert.deepEqual(chamadas.cancelar, ["evt-1"]);
});

test("o agendamento do Pipeline/Pré-vendas/NEXO (pipeline.agendarReuniao) cria o evento", opts, async () => {
  falhar = null; chamadas.criar.length = 0;
  const [n] = await db.execute<{ id: string; organizacao_id: string }>(sql`SELECT id::text, organizacao_id::text FROM negocios ORDER BY created_at DESC LIMIT 1`);
  if (!n) return;
  const r = await agendarReuniao({
    organizacaoId: n.organizacao_id, negocioId: n.id, data: new Date(Date.now() + 3 * 864e5).toISOString(),
    titulo: MARCA + " pipeline", responsavelId: usuario, ator: { tipo: "HUMAN", usuarioId: usuario } as never,
  });
  assert.equal(chamadas.criar.length, 1);
  const l = await linha(r.reuniaoId);
  assert.equal(l.calendar_sync_status, "ok");
  assert.equal(l.calendar_event_id, "evt-1");
});
