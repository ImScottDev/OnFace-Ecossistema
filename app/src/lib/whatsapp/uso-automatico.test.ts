/**
 * Número PRIVADO não é canal de automação (lib/whatsapp/uso-automatico.ts).
 * Liga números de teste no banco local, com uma conversa de lead num número
 * privado, e prova que nenhum caminho automático escolhe, lê ou fala por ele.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { contatos, leads, whatsappSessao } from "@/lib/db/schema";
import { escolherSessao } from "@/lib/cadencia/cadence-engine";
import { avaliarEnvio } from "@/lib/ai-platform/operacao/politica-canal";
import { contatoDoLead } from "@/lib/agentes/autonomia";
import { numeroAceitaAutomacao, sessaoEhPrivada, sessoesPrivadas } from "./uso-automatico";

const sessoes: string[] = [];
const leadsCriados: string[] = [];
after(async () => {
  if (leadsCriados.length) {
    await db.delete(contatos).where(inArray(contatos.leadId, leadsCriados));
    await db.delete(leads).where(inArray(leads.id, leadsCriados));
  }
  if (sessoes.length) await db.delete(whatsappSessao).where(inArray(whatsappSessao.id, sessoes));
  await fecharConexao();
});

test("regra pura: só número privado recusa automação", () => {
  assert.equal(numeroAceitaAutomacao({ privado: true }), false);
  assert.equal(numeroAceitaAutomacao({ privado: false }), true);
  assert.equal(numeroAceitaAutomacao(null), true, "conversa sem número não é privada");
});

test("nenhum caminho automático escolhe, lê ou fala por número privado", async () => {
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id, organizacao_id AS org FROM usuarios WHERE role = 'admin' AND ativo = true ORDER BY created_at LIMIT 1`);
  const reais = await db.select({ id: whatsappSessao.id, status: whatsappSessao.status, isDefault: whatsappSessao.isDefault }).from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, u.org));
  await db.update(whatsappSessao).set({ status: "disconnected", isDefault: false }).where(eq(whatsappSessao.organizacaoId, u.org));
  after(async () => { for (const r of reais) await db.update(whatsappSessao).set({ status: r.status, isDefault: r.isDefault }).where(eq(whatsappSessao.id, r.id)); });

  const nova = async (nome: string, p: { usuarioId?: string; isDefault?: boolean; privado?: boolean }) => {
    const [s] = await db.insert(whatsappSessao).values({
      organizacaoId: u.org, sessionName: `qa-${nome}-${randomUUID()}`, label: nome, usuarioId: p.usuarioId ?? null,
      isDefault: p.isDefault ?? false, status: "connected", privado: p.privado ?? false, tipo: p.privado ? "pessoal" : "compartilhada",
    }).returning({ id: whatsappSessao.id });
    sessoes.push(s.id);
    return s.id;
  };
  const privada = await nova("privada-do-gestor", { usuarioId: u.id, privado: true, isDefault: false });
  const operacional = await nova("operacional", { isDefault: true });

  assert.equal(await sessaoEhPrivada(u.org, privada), true);
  assert.equal(await sessaoEhPrivada(u.org, operacional), false);
  assert.deepEqual([...await sessoesPrivadas(u.org, [privada, operacional, null])], [privada]);

  const [lead] = await db.insert(leads).values({ organizacaoId: u.org, nome: "[QA] numero privado", telefone: "11999990000", responsavelId: u.id }).returning({ id: leads.id });
  leadsCriados.push(lead.id);
  const entidade = { tipo: "lead", id: lead.id };

  // Cadência/fluxo: o responsável só tem número privado → cai no operacional, nunca no privado.
  assert.equal((await escolherSessao(u.org, { entidade })).id, operacional, "escolha automática pula o número privado do responsável");
  // Escolha explícita do próprio número continua possível (o dono falando pelo que é dele).
  assert.equal((await escolherSessao(u.org, { preferidaId: privada, entidade })).id, privada);

  // Só número privado conectado: erro claro, nada de sair por ele.
  await db.update(whatsappSessao).set({ status: "disconnected" }).where(eq(whatsappSessao.id, operacional));
  await assert.rejects(escolherSessao(u.org, { entidade }), /só há números privados/);
  await db.update(whatsappSessao).set({ status: "connected" }).where(eq(whatsappSessao.id, operacional));

  // A conversa do lead existe no número privado (o gestor falou com ele pelo pessoal).
  const [conversaPrivada] = await db.insert(contatos).values({ organizacaoId: u.org, canal: "whatsapp", nome: "[QA] lead", telefone: "5511999990000", sessaoId: privada, responsavelId: u.id, leadId: lead.id }).returning();

  // Agente: a política de canal recusa falar na conversa privada.
  const decisao = await avaliarEnvio({ organizacaoId: u.org, contatoId: conversaPrivada.id, proativo: true });
  assert.equal(decisao.permitido, false);
  assert.equal(decisao.permitido === false && decisao.codigo, "numero_privado");

  // Lead do gestor, conversa única dele no privado: o agente fica sem conversa (null), não usa a privada.
  assert.equal(await contatoDoLead(u.org, lead.id, null), null);

  // Lead passa para outro responsável (a agente, um SDR): o agente abre conversa no número operacional.
  await db.update(leads).set({ responsavelId: null }).where(eq(leads.id, lead.id));
  const doAgente = await contatoDoLead(u.org, lead.id, null);
  assert.ok(doAgente);
  assert.notEqual(doAgente!.id, conversaPrivada.id, "não reaproveita a conversa do número privado");
  assert.equal(doAgente!.sessaoId, operacional);
});
