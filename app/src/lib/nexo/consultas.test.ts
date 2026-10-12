import { before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { permissoesEfetivas } from "@/lib/auth/permissoes";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";
import { permissoesDoNexo } from "@/lib/ai-platform/permissao-delegada";

const ORG = "320a9052-dd43-4edb-9b74-34be53c5c419";
let usuario: { id: string; role: string };
let permissoes: Awaited<ReturnType<typeof permissoesEfetivas>>;

before(async () => {
  [usuario] = await db.execute<{ id: string; role: string }>(sql`
    SELECT id::text, role FROM usuarios WHERE organizacao_id = ${ORG}::uuid AND ativo AND role = 'admin' LIMIT 1`);
  assert.ok(usuario, "banco de teste sem administrador");
  permissoes = await permissoesEfetivas({ usuarioId: usuario.id, organizacaoId: ORG, role: usuario.role });
});

function consultar(nome: string, input: Record<string, unknown>) {
  return executeRegisteredTool(nome, {
    organizacaoId: ORG, agentId: "00000000-0000-4000-8000-000000000000",
    runId: "00000000-0000-4000-8000-000000000001", usuarioId: usuario.id,
    mode: "test", autonomy: "suggest", permissoesDelegadas: permissoes,
  }, input);
}

test("entradas por data usa aquisições canônicas e informa campanha ausente", async () => {
  const dia = "2026-10-08";
  const resposta = await consultar("nexo_entradas", { de: dia, ate: dia, limite: 5 });
  assert.equal(resposta.ok, true, resposta.error);
  const dados = resposta.data as { total: number; semCampanha: number; leads: { campanha: string | null; href: string }[] };
  const [esperado] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int n FROM aquisicoes WHERE organizacao_id = ${ORG}::uuid
      AND created_at >= (${dia}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND created_at < ((${dia}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
  assert.equal(dados.total, esperado.n);
  assert.ok(dados.semCampanha >= 0 && dados.semCampanha <= dados.total);
  assert.ok(dados.leads.every((lead) => lead.href.startsWith("/")));
});

test("pico por hora soma exatamente a amostra consultada", async () => {
  const resposta = await consultar("nexo_horarios_entrada", { dia_semana: 4, de: "2026-09-01", ate: "2026-10-08" });
  assert.equal(resposta.ok, true, resposta.error);
  const dados = resposta.data as { amostra: number; horarios: { dia_semana: number; total: number }[] };
  assert.equal(dados.amostra, dados.horarios.reduce((n, grupo) => n + grupo.total, 0));
  assert.ok(dados.horarios.every((grupo) => grupo.dia_semana === 4));
});

test("não respondidas consulta mensagens, não apenas badge de não lidas", async () => {
  const resposta = await consultar("nexo_nao_respondidas", { limite: 5 });
  assert.equal(resposta.ok, true, resposta.error);
  const dados = resposta.data as { total: number; conversas: { id: string; mensagem: string; href: string }[] };
  assert.ok(dados.total >= dados.conversas.length);
  assert.ok(dados.conversas.every((conversa) => conversa.href.includes(conversa.id) && conversa.mensagem.length > 0));
});

test("harness não amplia permissões além da versão interna e do usuário", async () => {
  const [versao] = await db.execute<{ id: string; permitidas: string[] }>(sql`
    SELECT v.id::text, COALESCE(v.guardrail_config->'permissoes', '[]'::jsonb) permitidas
      FROM ai_agents a JOIN ai_agent_versions v ON v.id = a.published_version_id
     WHERE a.organizacao_id = ${ORG}::uuid AND a.slug = 'nexo' LIMIT 1`);
  assert.ok(versao, "configuração interna do NEXO ausente");
  const teto = await permissoesDoNexo({ organizacaoId: ORG, agentVersionId: versao.id, usuarioId: usuario.id, usuarioPapel: usuario.role });
  assert.ok([...teto].every((codigo) => versao.permitidas.includes(codigo) && permissoes.has(codigo)));
  const semVersao = await permissoesDoNexo({ organizacaoId: ORG, agentVersionId: "00000000-0000-4000-8000-000000000000", usuarioId: usuario.id, usuarioPapel: usuario.role });
  assert.equal(semVersao.size, 0);
});
