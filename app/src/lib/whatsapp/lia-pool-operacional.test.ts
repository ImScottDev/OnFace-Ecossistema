/**
 * Lia no pool operacional (decisão de 20/10/2026, migration 0132): o agente com
 * `canais.pool = "operacional"` só usa número operacional, e a conversa nova nasce
 * no número que a distribuição escolheu para o lead.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { aiAgents, aiAgentVersions, contatos, leads, whatsappSessao } from "@/lib/db/schema";
import { contatoDoLead } from "@/lib/agentes/autonomia";
import { LIA_VERSAO } from "@/lib/ai-platform/lia/definicao";
import { usaPoolOperacional } from "./uso-automatico";

const sessoes: string[] = [];
const leadsCriados: string[] = [];
const agentes: string[] = [];
after(async () => {
  if (leadsCriados.length) {
    await db.delete(contatos).where(inArray(contatos.leadId, leadsCriados));
    await db.delete(leads).where(inArray(leads.id, leadsCriados));
  }
  if (agentes.length) {
    await db.delete(aiAgentVersions).where(inArray(aiAgentVersions.agentId, agentes));
    await db.delete(aiAgents).where(inArray(aiAgents.id, agentes));
  }
  if (sessoes.length) await db.delete(whatsappSessao).where(inArray(whatsappSessao.id, sessoes));
  await fecharConexao();
});

test("a definição da Lia nasce no pool operacional", () => {
  assert.equal(usaPoolOperacional(LIA_VERSAO.guardrailConfig), true);
  assert.equal(usaPoolOperacional({ canais: { sessoes: ["x"] } }), false);
  assert.equal(usaPoolOperacional(null), false);
});

test("conversa do agente no pool: só número operacional, e o preferido pela distribuição vence", async () => {
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id, organizacao_id AS org FROM usuarios WHERE role = 'admin' AND ativo = true ORDER BY created_at LIMIT 1`);
  const nova = async (nome: string, p: { operacional?: boolean; isDefault?: boolean }) => {
    const [s] = await db.insert(whatsappSessao).values({
      organizacaoId: u.org, sessionName: `qa-${nome}-${randomUUID()}`, label: nome, status: "connected",
      tipo: "compartilhada", operacional: p.operacional ?? false, isDefault: p.isDefault ?? false,
    }).returning({ id: whatsappSessao.id });
    sessoes.push(s.id);
    return s.id;
  };
  const comum = await nova("comum", {});
  const op1 = await nova("operacional-1", { operacional: true });
  const op2 = await nova("operacional-2", { operacional: true });

  const [lead] = await db.insert(leads).values({ organizacaoId: u.org, nome: "[QA] lia pool", telefone: "11988887777", sessaoWhatsappPreferidaId: op2 }).returning({ id: leads.id });
  leadsCriados.push(lead.id);
  // Conversa antiga num número comum (não operacional): o agente no pool não a usa.
  await db.insert(contatos).values({ organizacaoId: u.org, canal: "whatsapp", nome: "[QA] lia", telefone: "5511988887777", sessaoId: comum, responsavelId: u.id, leadId: lead.id });

  const c = await contatoDoLead(u.org, lead.id, null, { poolOperacional: true });
  assert.ok(c);
  assert.equal(c!.sessaoId, op2, "nasce no número escolhido pela distribuição");
  assert.notEqual(c!.sessaoId, op1);

  // Sem pool: comportamento de sempre (reaproveita a conversa existente).
  const semPool = await contatoDoLead(u.org, lead.id, null);
  assert.ok(semPool);
});

test("migration 0132 solta a Lia do número fixo e a põe no pool, de forma idempotente", async () => {
  const [u] = await db.execute<{ org: string }>(sql`SELECT organizacao_id AS org FROM usuarios WHERE role = 'admin' AND ativo = true ORDER BY created_at LIMIT 1`);
  const existente = await db.select({ id: aiAgents.id }).from(aiAgents).where(eq(aiAgents.slug, "lia-sdr"));
  if (existente.length) return; // banco com Lia real: não mexe nela no teste
  const [ag] = await db.insert(aiAgents).values({ organizacaoId: u.org, nome: "[QA] Lia", slug: "lia-sdr" }).returning({ id: aiAgents.id });
  agentes.push(ag.id);
  await db.insert(aiAgentVersions).values({ organizacaoId: u.org, agentId: ag.id, versao: 1, guardrailConfig: { autonomia: "autonomous", canais: { sessoes: [randomUUID()] } } });

  const sqlMig = fs.readFileSync(path.join(import.meta.dirname, "../db/migrations/0132_lia_no_pool_operacional.sql"), "utf8");
  await db.execute(sql.raw(sqlMig));
  await db.execute(sql.raw(sqlMig));

  const [v] = await db.select({ g: aiAgentVersions.guardrailConfig, canal: aiAgentVersions.channelSessionId }).from(aiAgentVersions).where(eq(aiAgentVersions.agentId, ag.id));
  assert.equal(usaPoolOperacional(v.g), true);
  assert.equal((v.g as { canais: { sessoes?: unknown } }).canais.sessoes, undefined, "lista fixa com número inexistente some");
  assert.equal((v.g as { autonomia: string }).autonomia, "autonomous", "o resto da configuração fica");
  assert.equal(v.canal, null);
});
