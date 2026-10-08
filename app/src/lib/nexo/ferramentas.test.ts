/**
 * Ferramentas do NEXO contra o banco local, com papéis diferentes (admin x closer x leitor).
 * Dados de teste levam "[QA nexo]" no título e são apagados no fim. O provedor do modelo é
 * SUBSTITUÍDO por um stub determinístico (só aqui); o modelo real só roda no dev.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";
import { permissoesEfetivas, permissaoPeloPapelLegado, TODAS_PERMISSOES } from "@/lib/auth/permissoes";
import { ClaudeSubscriptionAdapter } from "@/lib/ai-platform/runtime/claude-subscription-adapter";
import { perguntar, confirmarAcao } from "./painel";

const ORG = "320a9052-dd43-4edb-9b74-34be53c5c419";
type U = { id: string; nome: string; role: string };
let admin: U | undefined, closer: U | undefined;
before(async () => {
  [admin] = await db.execute<U>(sql`SELECT id::text, nome, role FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo AND role='admin' LIMIT 1`);
  [closer] = await db.execute<U>(sql`SELECT id::text, nome, role FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo AND role='closer' LIMIT 1`);
});
const TITULO = "[QA nexo] ligar para Acelera";

const ctx = async (u: { id: string; role: string }, mode: "live" | "test" = "live", permissoes?: Set<string>) => ({
  organizacaoId: ORG, agentId: "00000000-0000-4000-8000-000000000000", runId: "00000000-0000-4000-8000-000000000001", usuarioId: u.id, mode, autonomy: "autonomous" as const,
  permissoesDelegadas: (permissoes ?? await permissoesEfetivas({ usuarioId: u.id, organizacaoId: ORG, role: u.role })) as never,
});

after(async () => {
  await db.execute(sql`DELETE FROM domain_events WHERE aggregate_type='tarefa' AND aggregate_id IN (SELECT id FROM tarefas WHERE titulo LIKE '[QA nexo]%')`);
  await db.execute(sql`DELETE FROM tarefas WHERE titulo LIKE '[QA nexo]%'`);
  await db.execute(sql`DELETE FROM ai_agent_runs WHERE input::text LIKE '%[QA nexo]%' OR input->'payload'->>'canal' = 'nexo_confirmacao' AND input->>'usuarioId' IN (${admin!.id}, ${closer!.id})`);
  process.exit(0);
});

test("admin cria atividade de verdade, com ator via NEXO no domain_events", async () => {
  const r = await executeRegisteredTool("nexo_criar_atividade", await ctx(admin!), { titulo: TITULO, vence_em: "2026-10-09T10:00:00-03:00", tipo: "ligar" });
  assert.equal(r.ok, true, r.error);
  const id = (r.data as { id: string }).id;
  const [t] = await db.execute<{ origem: string; usuario_id: string; venceem: string }>(sql`SELECT origem, usuario_id::text, vence_em::text AS venceem FROM tarefas WHERE id=${id}::uuid`);
  assert.equal(t!.origem, "NEXO"); assert.equal(t!.usuario_id, admin!.id);
  const [e] = await db.execute<{ source: string; actor_id: string; via: string }>(sql`SELECT source, actor_id::text, payload->>'via' AS via FROM domain_events WHERE aggregate_id=${id}::uuid AND event_type='TaskCreated'`);
  assert.deepEqual([e!.source, e!.actor_id, e!.via], ["nexo", admin!.id, "nexo"]);
});

test("em modo teste a escrita só devolve prévia (nada gravado)", async () => {
  const r = await executeRegisteredTool("nexo_criar_atividade", await ctx(admin!, "test"), { titulo: "[QA nexo] prévia" });
  assert.equal((r.data as { preview?: boolean }).preview, true);
  const [n] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM tarefas WHERE titulo='[QA nexo] prévia'`);
  assert.equal(n!.n, 0);
});

test("leitor é recusado dizendo a permissão que falta; closer cria, mas não edita atividade de outro", async () => {
  const leitor = new Set(TODAS_PERMISSOES.filter((c) => permissaoPeloPapelLegado("leitor", c)));
  const negado = await executeRegisteredTool("nexo_criar_atividade", await ctx(closer!, "live", leitor), { titulo: "[QA nexo] leitor" });
  assert.equal(negado.ok, false); assert.match(negado.error ?? "", /acquisition\.manage/);
  const [alheia] = await db.execute<{ id: string }>(sql`SELECT id::text FROM tarefas WHERE titulo=${TITULO}`);
  const r = await executeRegisteredTool("nexo_editar_atividade", await ctx(closer!), { id: alheia!.id, status: "concluida" });
  assert.equal(r.ok, false); assert.match(r.error ?? "", /outra pessoa/);
  const ok = await executeRegisteredTool("nexo_editar_atividade", await ctx(admin!), { id: alheia!.id, prioridade: "alta" });
  assert.equal(ok.ok, true, ok.error);
});

test("Ganho nunca; fora do escopo do papel pessoal é recusado", async () => {
  const [n] = await db.execute<{ id: string; r: string | null }>(sql`SELECT id::text, responsavel_id::text r FROM negocios WHERE organizacao_id=${ORG}::uuid AND etapa IN ('entrada','diagnostico') AND responsavel_id IS DISTINCT FROM ${closer!.id}::uuid AND responsavel_id IS NOT NULL LIMIT 1`);
  const g = await executeRegisteredTool("nexo_mover_etapa", await ctx(admin!), { entidade: "oportunidade", id: n!.id, para: "ganho" });
  assert.equal(g.ok, false); assert.match(g.error ?? "", /Ganho/);
  const alheio = await executeRegisteredTool("nexo_mover_etapa", await ctx(closer!), { entidade: "oportunidade", id: n!.id, para: "proposta" });
  assert.equal(alheio.ok, false); assert.match(alheio.error ?? "", /outra pessoa/);
});

test("excluir pede Confirmar: sem confirmado não apaga; com confirmado apaga (pela confirmarAcao, com run auditável)", async () => {
  const c = await ctx(admin!);
  const criada = await executeRegisteredTool("nexo_criar_atividade", c, { titulo: "[QA nexo] apagar" });
  const id = (criada.data as { id: string }).id;
  const pend = await executeRegisteredTool("nexo_excluir_atividade", c, { id });
  assert.equal((pend.data as { aguardandoConfirmacao?: boolean }).aguardandoConfirmacao, true);
  assert.equal((await db.execute(sql`SELECT 1 FROM tarefas WHERE id=${id}::uuid`)).length, 1);
  const feito = await executeRegisteredTool("nexo_excluir_atividade", { ...c, confirmado: true }, { id });
  assert.equal(feito.ok, true, feito.error);
  assert.equal((await db.execute(sql`SELECT 1 FROM tarefas WHERE id=${id}::uuid`)).length, 0);
});

test("ponta a ponta com provedor stub: 'crie uma atividade' cria, e exclusão fica aguardando Confirmar até o botão", async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN ||= "stub-local";
  const original = ClaudeSubscriptionAdapter.prototype.runAgent;
  let passo = 0;
  ClaudeSubscriptionAdapter.prototype.runAgent = async function (req: Parameters<typeof original>[0]) {
    const chamadas: { name: string; input: Record<string, unknown>; result: { ok: boolean; data?: unknown; error?: string } }[] = [];
    const alvo = passo++ === 0
      ? ["nexo_criar_atividade", { titulo: "[QA nexo] amanhã 10h", vence_em: "2026-10-09T10:00:00-03:00" }]
      : ["nexo_excluir_atividade", { id: (await db.execute<{ id: string }>(sql`SELECT id::text FROM tarefas WHERE titulo='[QA nexo] amanhã 10h'`))[0]!.id }];
    const result = await req.invokeTool(alvo[0] as string, alvo[1] as Record<string, unknown>);
    chamadas.push({ name: alvo[0] as string, input: alvo[1] as Record<string, unknown>, result });
    return { text: "stub: feito", durationMs: 1, turns: 1, tokensInput: 1, tokensOutput: 1, estimatedCostUsd: 0, toolCalls: chamadas };
  };
  try {
    const q = { organizacaoId: ORG, userId: admin!.id, userName: admin!.nome, userRole: admin!.role };
    const a = await perguntar(q, { pergunta: "[QA nexo] crie uma atividade para amanhã 10h", rota: "/tarefas", area: "Atividades" });
    assert.equal(a.falhou, undefined, a.mensagem.texto);
    assert.equal(a.executadas?.length, 1);
    assert.equal((await db.execute(sql`SELECT 1 FROM tarefas WHERE titulo='[QA nexo] amanhã 10h'`)).length, 1);
    const b = await perguntar(q, { pergunta: "[QA nexo] apague essa atividade", rota: "/tarefas", area: "Atividades" });
    assert.equal(b.confirmacoes?.length, 1);
    assert.equal((await db.execute(sql`SELECT 1 FROM tarefas WHERE titulo='[QA nexo] amanhã 10h'`)).length, 1, "não apagou antes do Confirmar");
    const c = await confirmarAcao(q, { runId: b.confirmacoes![0]!.runId, passo: b.confirmacoes![0]!.passo });
    assert.equal(c.ok, true, c.texto);
    assert.equal((await db.execute(sql`SELECT 1 FROM tarefas WHERE titulo='[QA nexo] amanhã 10h'`)).length, 0);
    const dup = await confirmarAcao(q, { runId: b.confirmacoes![0]!.runId, passo: b.confirmacoes![0]!.passo });
    assert.equal(dup.ok, false);
    const outro = await confirmarAcao({ ...q, userId: closer!.id }, { runId: b.confirmacoes![0]!.runId, passo: b.confirmacoes![0]!.passo });
    assert.equal(outro.ok, false, "confirmação de outro usuário é recusada");
  } finally { ClaudeSubscriptionAdapter.prototype.runAgent = original; }
});
