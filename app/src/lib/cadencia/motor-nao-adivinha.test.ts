/**
 * Seis regras que o motor de cadência não tinha, medidas em produção:
 *
 * 1. tipo da inscrição tem de bater com o da definição (um LEAD estava numa
 *    cadência de `negocio`);
 * 2. `{{variavel}}` vale nos três canais, não só no template (os 10 passos de
 *    e-mail publicados começam com "Olá, tudo bem?" sem nome);
 * 3. mais de um número conectado e nenhum critério: erro, nunca sorteio
 *    (3 conectados, `is_default` em nenhum);
 * 4. pausou/esgotou/falhou avisa o responsável, e a reentrega não duplica;
 * 5. resposta do lead para a inscrição do negócio/oportunidade dele;
 * 6. nó de mensagem de IA não publica sem agente (18 nós publicados sem).
 *
 * Banco real, nenhum envio externo. Limpa tudo o que cria.
 * pnpm exec tsx --env-file=.env --test src/lib/cadencia/motor-nao-adivinha.test.ts
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import {
  cadenceDefinitions, cadenceEnrollments, cadenceEnrollmentEvents, contatos, leads, negocios,
  notificacoes, whatsappSessao,
} from "@/lib/db/schema";
import { validateFollowupForPublish } from "@/lib/ai-platform/followup/validate";
import type { FollowupGraph } from "@/lib/ai-platform/followup/graph";
import { aplicarVariaveis, avancarEnrollment, escolherSessao, iniciarCadencia, registrarRespostaEmCadencias, SessaoAmbiguaError } from "./cadence-engine";

const comBanco = Boolean(process.env.DATABASE_URL);
const opts = { skip: comBanco ? false : "sem DATABASE_URL" };
const MARCA = `[QA motor ${Date.now().toString(36)}]`;

let org = ""; let usuario = "";
let leadId = ""; let contatoId = ""; let negocioId = "";
let defNegocio = "";
const defs: string[] = [];
const sessoes: string[] = [];

/** Definição de negócio com os passos dados. Registrada para limpeza. */
async function criarDef(nome: string, steps: unknown[]): Promise<string> {
  const [d] = await db.insert(cadenceDefinitions).values({ organizacaoId: org, nome: `${MARCA} ${nome}`, entityType: "negocio", steps }).returning({ id: cadenceDefinitions.id });
  defs.push(d.id);
  return d.id;
}

/** Avisos gravados para o responsável, por título. */
async function avisos(titulo: string): Promise<number> {
  return (await db.select({ id: notificacoes.id }).from(notificacoes).where(and(
    eq(notificacoes.usuarioId, usuario), eq(notificacoes.tipo, "cadencia"), eq(notificacoes.titulo, titulo),
    sql`${notificacoes.mensagem} LIKE ${`%${MARCA}%`}`,
  ))).length;
}

before(async () => {
  if (!comBanco) return;
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id::text, organizacao_id::text AS org FROM usuarios WHERE role IN ('admin','super_admin') AND ativo = true ORDER BY created_at LIMIT 1`);
  usuario = u.id; org = u.org;

  [{ id: leadId }] = await db.insert(leads).values({ organizacaoId: org, nome: `${MARCA} Lead`, telefone: "5511999990000", email: "qa@exemplo.invalido", responsavelId: usuario }).returning({ id: leads.id });
  [{ id: contatoId }] = await db.insert(contatos).values({ organizacaoId: org, canal: "whatsapp", nome: `${MARCA} Contato`, telefone: "5511999990000", leadId }).returning({ id: contatos.id });
  [{ id: negocioId }] = await db.insert(negocios).values({ organizacaoId: org, leadId, titulo: `${MARCA} Negócio`, status: "proposta_apresentada" }).returning({ id: negocios.id });
  // Passo de espera: a inscrição existe e avança sem mandar nada para ninguém.
  defNegocio = await criarDef("pós-proposta", [{ id: "s1", tipo: "wait", esperaMinutos: 60, branches: [] }]);
});

after(async () => {
  if (!comBanco) return;
  if (defs.length) {
    const inscricoes = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments).where(inArray(cadenceEnrollments.cadenceDefinitionId, defs));
    if (inscricoes.length) await db.delete(cadenceEnrollmentEvents).where(inArray(cadenceEnrollmentEvents.enrollmentId, inscricoes.map((i) => i.id)));
    await db.delete(cadenceEnrollments).where(inArray(cadenceEnrollments.cadenceDefinitionId, defs));
    await db.delete(cadenceDefinitions).where(inArray(cadenceDefinitions.id, defs));
  }
  if (negocioId) await db.delete(negocios).where(eq(negocios.id, negocioId));
  if (contatoId) await db.delete(contatos).where(eq(contatos.id, contatoId));
  if (leadId) await db.delete(leads).where(eq(leads.id, leadId));
  await db.delete(notificacoes).where(and(eq(notificacoes.usuarioId, usuario), eq(notificacoes.tipo, "cadencia"), sql`${notificacoes.mensagem} LIKE ${`%${MARCA}%`}`));
  if (sessoes.length) await db.delete(whatsappSessao).where(inArray(whatsappSessao.id, sessoes));
  await fecharConexao();
});

// ─── 2 e 6: regras puras ───────────────────────────────────────────────────

test("{{nome}}, {{primeiro_nome}} e {{empresa}} valem na mesma função dos três canais", () => {
  const vars = { nome: "Maria Souza Lima", empresa: "Callface" };
  assert.equal(aplicarVariaveis("Olá, {{nome}}!", vars), "Olá, Maria Souza Lima!");
  assert.equal(aplicarVariaveis("Oi {{primeiro_nome}}, tudo bem?", vars), "Oi Maria, tudo bem?");
  assert.equal(aplicarVariaveis("sobre a {{empresa}}", vars), "sobre a Callface");
  assert.equal(aplicarVariaveis("{{ nome }} e {{empresa}}", vars), "Maria Souza Lima e Callface");
  // Sem dado: vazio, nunca o literal — o e-mail não pode sair com "{{empresa}}".
  assert.equal(aplicarVariaveis("Olá {{primeiro_nome}}, da {{empresa}}", {}), "Olá , da ");
  // Chave desconhecida fica literal (comportamento do template), não apaga nada.
  assert.equal(aplicarVariaveis("cargo: {{cargo}}", vars), "cargo: {{cargo}}");
  assert.equal(aplicarVariaveis("{{valor}}", { valor: 1200 }), "1200");
});

test("WhatsApp, e-mail e template passam a mensagem pela mesma substituição", async () => {
  const fonte = await (await import("node:fs/promises")).readFile(new URL("./cadence-engine.ts", import.meta.url), "utf8");
  const chamadas = fonte.match(/aplicarVariaveis\(/g) ?? [];
  // 1 declaração + whatsapp + email (mensagem e assunto) + template.
  assert.ok(chamadas.length >= 5, `substituição usada em poucos lugares: ${chamadas.length}`);
  assert.doesNotMatch(fonte, /const mensagem = \(ctx\.step\.config\?\.mensagem as string \| undefined\)\?\.trim\(\)/, "mensagem crua voltou a ser enviada sem substituição");
});

test("nó de mensagem de IA não publica sem agente escolhido", () => {
  const grafo = (agentId?: string): FollowupGraph => ({
    schema_version: 2,
    nodes: [
      { id: "t", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: { event: "manual", filters: {} } },
      { id: "a", type: "action", label: "Mensagem da IA", position: { x: 0, y: 100 }, config: { mode: "ai_message", prompt_hint: "retoma a proposta", ...(agentId ? { agent_id: agentId } : {}) } },
      { id: "f", type: "end", label: "Fim", position: { x: 0, y: 200 }, config: { outcome: "exhausted" } },
    ],
    edges: [
      { id: "e1", source: "t", target: "a", priority: 0, condition: { type: "always" } },
      { id: "e2", source: "a", target: "f", priority: 0, condition: { type: "always" } },
    ],
  });
  const sem = validateFollowupForPublish(grafo());
  assert.equal(sem.ok, false);
  assert.ok(sem.errors.some((e) => e.code === "ai_message_sem_agente" && e.nodeId === "a"), `faltou o erro de agente: ${JSON.stringify(sem.errors)}`);
  const com = validateFollowupForPublish(grafo(randomUUID()));
  assert.equal(com.ok, true, `grafo com agente deveria publicar: ${JSON.stringify(com.errors)}`);
});

// ─── 1, 3, 4 e 5: regras com banco ─────────────────────────────────────────

test("inscrição com tipo diferente do da definição é recusada com erro legível", opts, async () => {
  await assert.rejects(
    () => iniciarCadencia({ cadenceDefinitionId: defNegocio, organizacaoId: org, entityType: "lead", entityId: leadId }),
    /é de negocio e este registro é lead/,
    "LEAD não pode entrar em cadência de negócio",
  );
  const [nenhuma] = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments).where(eq(cadenceEnrollments.cadenceDefinitionId, defNegocio)).limit(1);
  assert.equal(nenhuma, undefined, "a recusa não pode deixar inscrição no banco");
});

test("resposta do lead pausa a inscrição do negócio dele e avisa o responsável uma vez", opts, async () => {
  const enrollmentId = await iniciarCadencia({ cadenceDefinitionId: defNegocio, organizacaoId: org, entityType: "negocio", entityId: negocioId });
  assert.ok(enrollmentId, "inscrição de negócio deveria nascer");

  const recebidaEm = new Date();
  const afetados = await registrarRespostaEmCadencias({ organizacaoId: org, contatoId, leadId, recebidaEm });
  assert.ok(afetados >= 1, "a resposta do lead tem de alcançar a inscrição do negócio");

  const [depois] = await db.select().from(cadenceEnrollments).where(eq(cadenceEnrollments.id, enrollmentId!));
  assert.equal(depois.status, "paused", "inscrição de negócio precisa pausar quando o lead responde");

  const titulo = "Lead respondeu — cadência pausada";
  assert.equal(await avisos(titulo), 1, "pausar por resposta tem de avisar o responsável do lead");

  // Reentrega: o estado volta a vivo e a MESMA resposta chega de novo.
  await db.update(cadenceEnrollments).set({ status: "active" }).where(eq(cadenceEnrollments.id, enrollmentId!));
  await registrarRespostaEmCadencias({ organizacaoId: org, contatoId, leadId, recebidaEm });
  assert.equal(await avisos(titulo), 1, "reentrega não pode duplicar o aviso");
});

test("cadência esgotada avisa o responsável, e avançar de novo não reavisa", opts, async () => {
  const def = await criarDef("esgota", [{ id: "s1", tipo: "wait", esperaMinutos: 0, branches: [] }]);
  const id = await iniciarCadencia({ cadenceDefinitionId: def, organizacaoId: org, entityType: "negocio", entityId: negocioId });
  await avancarEnrollment(id!);

  const [fim] = await db.select().from(cadenceEnrollments).where(eq(cadenceEnrollments.id, id!));
  assert.equal(fim.status, "completed");
  const titulo = "Cadência esgotada sem resposta";
  assert.equal(await avisos(titulo), 1, "esgotar sem resposta tem de avisar");

  await db.update(cadenceEnrollments).set({ status: "active", currentStepId: null }).where(eq(cadenceEnrollments.id, id!));
  await avancarEnrollment(id!);
  assert.equal(await avisos(titulo), 1, "reentrega não pode duplicar o aviso");
});

test("cadência que falha avisa o responsável com o motivo", opts, async () => {
  // Passo de WhatsApp sem `config.mensagem`: o adapter recusa sem tocar em
  // nada externo, e sem `retry` a inscrição vai direto para `failed`.
  const def = await criarDef("falha", [{ id: "s1", tipo: "action", adapter: "whatsapp", config: {}, branches: [] }]);
  const id = await iniciarCadencia({ cadenceDefinitionId: def, organizacaoId: org, entityType: "negocio", entityId: negocioId });
  await avancarEnrollment(id!);

  const [fim] = await db.select().from(cadenceEnrollments).where(eq(cadenceEnrollments.id, id!));
  assert.equal(fim.status, "failed");
  assert.equal(await avisos("Cadência falhou"), 1, "falhar tem de avisar o responsável");
  const [aviso] = await db.select({ mensagem: notificacoes.mensagem }).from(notificacoes).where(and(
    eq(notificacoes.usuarioId, usuario), eq(notificacoes.titulo, "Cadência falhou"), sql`${notificacoes.mensagem} LIKE ${`%${MARCA}%`}`,
  ));
  assert.match(aviso.mensagem ?? "", /config\.mensagem/, "o aviso tem de dizer o motivo");
});

test("mais de um número conectado e nenhum critério: erro nomeado, nunca sorteio", opts, async () => {
  const reais = await db.select({ id: whatsappSessao.id, status: whatsappSessao.status }).from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, org));
  await db.update(whatsappSessao).set({ status: "disconnected" }).where(eq(whatsappSessao.organizacaoId, org));
  after(async () => { for (const r of reais) await db.update(whatsappSessao).set({ status: r.status }).where(eq(whatsappSessao.id, r.id)); });

  for (const nome of ["um", "dois", "tres"]) {
    const [s] = await db.insert(whatsappSessao).values({ organizacaoId: org, sessionName: `qa-amb-${nome}-${randomUUID()}`, label: `${MARCA} ${nome}`, isDefault: false, status: "connected" }).returning({ id: whatsappSessao.id });
    sessoes.push(s.id);
  }

  await assert.rejects(escolherSessao(org, {}), SessaoAmbiguaError, "3 conectadas e nenhum critério: para, não sorteia");
  await assert.rejects(escolherSessao(org, {}), /3 números de WhatsApp conectados/, "o erro diz o que fazer");

  // Um critério resolve: marca uma como padrão e a escolha volta a ser única.
  await db.update(whatsappSessao).set({ isDefault: true }).where(eq(whatsappSessao.id, sessoes[1]));
  assert.equal((await escolherSessao(org, {})).id, sessoes[1], "com padrão definido, escolhe o padrão");
});
