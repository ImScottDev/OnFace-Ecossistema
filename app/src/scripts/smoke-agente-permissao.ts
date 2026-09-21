/**
 * Smoke do teto de permissão do agente (SPEC §31).
 *
 * O caso que importa é o quarto: **um usuário limitado pedindo ao agente uma
 * ação que ele mesmo não pode fazer.** Se o agente executar, o RBAC inteiro
 * vira decoração — basta pedir ao robô.
 *
 * Também prova que o teto é INTERSEÇÃO: o agente não empresta poder ao usuário
 * nem o usuário empresta poder ao agente.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { delegacaoDoRun, ferramentaPermitida } from "@/lib/ai-platform/permissao-delegada";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const marca = `smoke-perm-${Date.now()}`;
  let usuarioTemporario: string | null = null;
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const nexo = await um<{ version_id: string }>(sql`
    SELECT v.id::text AS version_id FROM ai_agents a
      JOIN ai_agent_versions v ON v.agent_id = a.id
     WHERE a.slug = 'nexo' AND a.organizacao_id = ${org.id}::uuid LIMIT 1`);
  const hermes = await um<{ version_id: string }>(sql`
    SELECT v.id::text AS version_id FROM ai_agents a
      JOIN ai_agent_versions v ON v.agent_id = a.id
     WHERE a.slug = 'hermes' AND a.organizacao_id = ${org.id}::uuid LIMIT 1`);

  const admin = await um<{ id: string; nome: string }>(sql`
    SELECT u.id::text, u.nome FROM usuarios u
      JOIN user_roles ur ON ur.usuario_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.codigo = 'admin' LIMIT 1`);
  // Um papel de operação: tem venda e aquisição, não tem automação nem finanças.
  const operacional = await um<{ id: string; nome: string; papel: string }>(sql`
    SELECT u.id::text, u.nome, r.codigo AS papel FROM usuarios u
      JOIN user_roles ur ON ur.usuario_id = u.id
      JOIN roles r ON r.id = ur.role_id
     WHERE r.codigo IN ('closer','sdr') LIMIT 1`);

  console.log("");
  const semUsuario = await delegacaoDoRun({ organizacaoId: org.id, agentVersionId: nexo.version_id });
  console.log(`  1. NEXO sem usuário (teto da versão)    ${semUsuario.permissoes.size} permissões, origem=${semUsuario.origem}`);

  const comAdmin = await delegacaoDoRun({ organizacaoId: org.id, agentVersionId: nexo.version_id, usuarioId: admin.id });
  console.log(`  2. NEXO acionado por admin              ${comAdmin.permissoes.size} permissões (interseção)`);

  const comOperacional = operacional
    ? await delegacaoDoRun({ organizacaoId: org.id, agentVersionId: nexo.version_id, usuarioId: operacional.id })
    : null;
  if (comOperacional) {
    console.log(`  3. NExO acionado por ${operacional.papel.padEnd(7)}           ${comOperacional.permissoes.size} permissões (interseção)`);
  }

  // O caso que PROVA a interseção: um papel que tem MENOS que o agente.
  //
  // Closer e admin já têm tudo que o NEXO tem, então a interseção com eles dá
  // o mesmo número e não prova nada. Leitor só tem leitura — se a interseção
  // funcionar, ele perde toda a escrita do agente.
  const leitorRole = await um<{ id: string }>(sql`
    SELECT id::text FROM roles WHERE codigo = 'leitor' AND organizacao_id = ${org.id}::uuid LIMIT 1`);
  const leitor = await um<{ id: string }>(sql`
    INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, ativo)
    VALUES (${org.id}::uuid, ${marca}, ${marca + "@teste.local"}, 'x', 'leitor', false)
    RETURNING id::text`);
  usuarioTemporario = leitor.id;
  await db.execute(sql`
    INSERT INTO user_roles (usuario_id, role_id, organizacao_id)
    VALUES (${leitor.id}::uuid, ${leitorRole.id}::uuid, ${org.id}::uuid)`);

  const comLeitor = await delegacaoDoRun({ organizacaoId: org.id, agentVersionId: nexo.version_id, usuarioId: leitor.id });
  const escritaDoLeitor = [...comLeitor.permissoes].filter((p) => !p.endsWith(".read"));
  console.log(`  3b. NEXO acionado por LEITOR            ${comLeitor.permissoes.size} permissões, ${escritaDoLeitor.length} de escrita`);

  const hermesDelegacao = await delegacaoDoRun({ organizacaoId: org.id, agentVersionId: hermes.version_id });
  console.log(`  4. Hermes por evento (sem usuário)      ${hermesDelegacao.permissoes.size} permissões`);

  const semVersao = await delegacaoDoRun({ organizacaoId: org.id, agentVersionId: null });
  console.log(`  5. agente sem versão configurada        ${semVersao.permissoes.size} permissões (padrão restritivo)`);

  // O caso que importa: a ferramenta é de fato barrada em runtime?
  const ctxSemPermissao = {
    organizacaoId: org.id, agentId: "smoke", runId: "smoke",
    mode: "live" as const, autonomy: "autonomous" as const,
    permissoesDelegadas: new Set<string>(["acquisition.read"]),
  };
  const barrada = await executeRegisteredTool("deal_advance", ctxSemPermissao, {
    negocio_id: "00000000-0000-0000-0000-000000000000", status: "negociacao",
  });
  console.log(`\n  6. ferramenta sem permissão em runtime  ok=${barrada.ok}`);
  console.log(`     ${barrada.error}`);

  const liberada = await executeRegisteredTool("deal_advance", {
    ...ctxSemPermissao, permissoesDelegadas: new Set<string>(["sales.manage"]),
  }, { negocio_id: "00000000-0000-0000-0000-000000000000", status: "negociacao" });
  console.log(`  7. a MESMA com permissão               ok=${liberada.ok} (passou do gate: ${!/sem permissão delegada/.test(liberada.error ?? "")})`);

  console.log("\n  RESULTADO");
  const checagens: [string, boolean, string][] = [
    ["versão define teto", semUsuario.permissoes.size > 0, "a versão do agente é o limite superior"],
    ["interseção", comAdmin.permissoes.size <= semUsuario.permissoes.size, "acionar por admin não amplia além da versão"],
    ["usuário limita", comLeitor.permissoes.size < semUsuario.permissoes.size, "o leitor reduz o teto do agente de 7 para menos"],
    ["leitor não escreve", escritaDoLeitor.length === 0, "quem só lê não ganha escrita por pedir ao agente"],
    ["Hermes mais restrito", hermesDelegacao.permissoes.size < semUsuario.permissoes.size, "executor sem humano por trás tem teto menor"],
    ["sem versão, sem escrita", semVersao.permissoes.size === 0, "agente que nasce podendo tudo é porta que ninguém abriu"],
    ["runtime barra", !barrada.ok && /sem permissão delegada/.test(barrada.error ?? ""), "pedir ao robô não contorna o RBAC"],
    ["runtime libera", !/sem permissão delegada/.test(liberada.error ?? ""), "com permissão, a ferramenta roda"],
    ["automação fora do NEXO", !semUsuario.permissoes.has("automation.manage"), "mudar fluxo por conversa é como se perde o controle de um sistema"],
  ];
  let ok = true;
  for (const [nome, passou, desc] of checagens) {
    if (!passou) ok = false;
    console.log(`    ${nome.padEnd(24)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
  }
  console.log(`\n  ${ok ? "SMOKE PASSOU: pedir ao agente não contorna a permissão de quem pediu" : "SMOKE FALHOU"}\n`);

  if (usuarioTemporario) {
    await db.execute(sql`DELETE FROM user_roles WHERE usuario_id = ${usuarioTemporario}::uuid`);
    await db.execute(sql`DELETE FROM usuarios WHERE id = ${usuarioTemporario}::uuid`);
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
