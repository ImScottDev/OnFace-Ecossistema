/**
 * Envio de WhatsApp pelo NEXO: nunca sai sozinho; o Confirmar leva o texto
 * EDITADO pela pessoa; a mensagem gravada é a que a tela de Atendimento lê
 * (whatsapp_mensagens, direcao out, status pending, rastro de IA em dados).
 * Dados de QA (sessão, contato, mensagem) são apagados no fim.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";
import { permissoesEfetivas } from "@/lib/auth/permissoes";
import { confirmarAcao, perguntar } from "./painel";
import { ClaudeSubscriptionAdapter } from "@/lib/ai-platform/runtime/claude-subscription-adapter";

const ORG = "320a9052-dd43-4edb-9b74-34be53c5c419";
const SESSAO = "qa-nexo-envio";
let admin: { id: string; nome: string; role: string };
let closer: { id: string; nome: string; role: string };
let sessaoId: string; let contatoId: string;

before(async () => {
  admin = (await db.execute<typeof admin>(sql`SELECT id::text, nome, role FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo AND role='admin' LIMIT 1`))[0]!;
  closer = (await db.execute<typeof closer>(sql`SELECT id::text, nome, role FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo AND role='closer' LIMIT 1`))[0]!;
  assert.ok(admin && closer, "banco sem admin/closer");
  await limpar();
  [{ id: sessaoId }] = await db.execute<{ id: string }>(sql`
    INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, usuario_id) VALUES (${ORG}::uuid, ${SESSAO}, '[QA nexo] número', 'connected', ${closer.id}::uuid) RETURNING id::text`);
  [{ id: contatoId }] = await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, responsavel_id, status) VALUES (${ORG}::uuid, 'whatsapp', '[QA nexo] Cliente', '5511999990000', ${sessaoId}::uuid, ${closer.id}::uuid, 'open') RETURNING id::text`);
});
async function limpar() {
  await db.execute(sql`DELETE FROM whatsapp_mensagens WHERE contato_id IN (SELECT id FROM contatos WHERE nome LIKE '[QA nexo]%')`);
  await db.execute(sql`DELETE FROM contatos WHERE nome LIKE '[QA nexo]%'`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE session_name = ${SESSAO}`);
  await db.execute(sql`DELETE FROM ai_agent_run_steps WHERE run_id IN (SELECT id FROM ai_agent_runs WHERE input::text LIKE '%[QA nexo]%')`);
  await db.execute(sql`DELETE FROM ai_agent_runs WHERE input::text LIKE '%[QA nexo]%'`);
}
after(async () => { await limpar(); process.exit(0); });

const ctx = async (u: { id: string; role: string }) => ({
  organizacaoId: ORG, agentId: "00000000-0000-4000-8000-000000000000", runId: "00000000-0000-4000-8000-000000000001", usuarioId: u.id,
  mode: "live" as const, autonomy: "autonomous" as const, permissoesDelegadas: (await permissoesEfetivas({ usuarioId: u.id, organizacaoId: ORG, role: u.role })) as never,
});

test("sem Confirmar nada sai; a resposta traz o rascunho para editar", async () => {
  const r = await executeRegisteredTool("nexo_enviar_whatsapp", await ctx(closer), { contato_id: contatoId, conteudo: "[QA nexo] Olá, rascunho" });
  assert.equal(r.ok, true, r.error);
  const d = r.data as { aguardandoConfirmacao?: boolean; input?: { conteudo?: string } };
  assert.equal(d.aguardandoConfirmacao, true);
  assert.equal(d.input?.conteudo, "[QA nexo] Olá, rascunho");
  assert.equal((await db.execute(sql`SELECT 1 FROM whatsapp_mensagens WHERE contato_id=${contatoId}::uuid`)).length, 0);
});

test("conversa de outra pessoa é recusada para papel pessoal", async () => {
  const [outro] = await db.execute<{ id: string; role: string }>(sql`SELECT id::text, role FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo AND role='closer' AND id <> ${closer.id}::uuid LIMIT 1`);
  if (!outro) return;
  const r = await executeRegisteredTool("nexo_enviar_whatsapp", await ctx(outro), { contato_id: contatoId, conteudo: "x" });
  assert.equal(r.ok, false);
});

test("ponta a ponta: o NEXO propõe, a pessoa edita e confirma, e a mensagem gravada é a editada", async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN ||= "stub-local";
  const original = ClaudeSubscriptionAdapter.prototype.runAgent;
  ClaudeSubscriptionAdapter.prototype.runAgent = async function (req: Parameters<typeof original>[0]) {
    const input = { contato_id: contatoId, conteudo: "[QA nexo] texto do modelo" };
    const result = await req.invokeTool("nexo_enviar_whatsapp", input);
    return { text: "stub: aguardando confirmação", durationMs: 1, turns: 1, tokensInput: 1, tokensOutput: 1, estimatedCostUsd: 0, toolCalls: [{ name: "nexo_enviar_whatsapp", input, result }] };
  };
  try {
    const q = { organizacaoId: ORG, userId: closer.id, userName: closer.nome, userRole: closer.role };
    const a = await perguntar(q, { pergunta: "[QA nexo] responda o cliente", rota: "/atendimento", area: "Atendimento" });
    assert.equal(a.falhou, undefined, a.mensagem.texto);
    assert.equal(a.confirmacoes?.length, 1);
    assert.equal(a.confirmacoes![0]!.rascunho, "[QA nexo] texto do modelo");
    assert.equal((await db.execute(sql`SELECT 1 FROM whatsapp_mensagens WHERE contato_id=${contatoId}::uuid`)).length, 0, "não enviou antes do Confirmar");

    const c = await confirmarAcao(q, { runId: a.confirmacoes![0]!.runId, passo: a.confirmacoes![0]!.passo, conteudo: "[QA nexo] texto EDITADO pela pessoa" });
    assert.equal(c.ok, true, c.texto);
    assert.equal(c.href, `/atendimento?contatoId=${contatoId}`);
    const [m] = await db.execute<{ conteudo: string; direcao: string; status: string; sessao_id: string; enviado_por_id: string; dados: { aiGenerated?: boolean; via?: string } }>(sql`
      SELECT conteudo, direcao, status, sessao_id::text, enviado_por_id::text, dados FROM whatsapp_mensagens WHERE contato_id=${contatoId}::uuid`);
    assert.ok(m, "mensagem não gravada");
    assert.equal(m.conteudo, "[QA nexo] texto EDITADO pela pessoa");
    assert.deepEqual([m.direcao, m.status, m.sessao_id, m.enviado_por_id], ["out", "pending", sessaoId, closer.id]);
    assert.equal(m.dados.aiGenerated, true); assert.equal(m.dados.via, "nexo");
    const [ct] = await db.execute<{ ultima_msg: string }>(sql`SELECT ultima_msg FROM contatos WHERE id=${contatoId}::uuid`);
    assert.equal(ct!.ultima_msg, "[QA nexo] texto EDITADO pela pessoa");

    const dup = await confirmarAcao(q, { runId: a.confirmacoes![0]!.runId, passo: a.confirmacoes![0]!.passo });
    assert.equal(dup.ok, false, "segundo Confirmar não envia de novo");
    assert.equal((await db.execute(sql`SELECT 1 FROM whatsapp_mensagens WHERE contato_id=${contatoId}::uuid`)).length, 1);
  } finally { ClaudeSubscriptionAdapter.prototype.runAgent = original; }
});
