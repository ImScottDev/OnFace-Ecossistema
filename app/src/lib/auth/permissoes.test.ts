/**
 * Paridade do cutover de autorização (SPEC §31).
 *
 * A pergunta que estes testes respondem é uma só: **trocar o gate tira o acesso
 * de alguém?** Autorização é a mudança em que errar é mais caro — quem perde
 * acesso descobre no meio do expediente, e quem ganha acesso indevido ninguém
 * descobre.
 *
 * Por isso o teste não verifica o mapa que eu escrevi contra ele mesmo. Ele
 * compara, usuário real por usuário real e permissão por permissão, o que o
 * RBAC normalizado responde contra o que o gate legado responderia.
 */
import test from "node:test";
import assert from "node:assert/strict";

const DB_URL = process.env.DATABASE_URL;

const TODAS = [
  "companies.read", "companies.write", "acquisition.read", "acquisition.manage",
  "sales.read", "sales.manage", "sales.approve_discount", "finance.read",
  "finance.manage", "cs.read", "cs.manage", "automation.manage", "ai.use",
  "ai.configure", "integrations.manage", "admin.manage_users",
] as const;

test("o RBAC normalizado responde igual ao gate legado, usuário por usuário", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { permissoesDoUsuario, permissaoPeloPapelLegado } = await import("./permissoes.js");

  const usuarios = await db.execute<{ id: string; role: string; organizacao_id: string; nome: string }>(sql`
    SELECT id::text, role, organizacao_id::text, nome FROM usuarios`);
  assert.ok(usuarios.length > 0, "sem usuário no banco não há o que comparar");

  const divergencias: string[] = [];
  for (const u of usuarios) {
    const doRbac = await permissoesDoUsuario(u.id, u.organizacao_id);
    for (const codigo of TODAS) {
      const novo = doRbac.has(codigo);
      const antigo = permissaoPeloPapelLegado(u.role, codigo);
      if (novo !== antigo) {
        divergencias.push(`${u.nome} (${u.role}) · ${codigo}: RBAC=${novo} legado=${antigo}`);
      }
    }
  }
  assert.deepEqual(
    divergencias, [],
    `o cutover de autorização mudaria o acesso de alguém:\n${divergencias.join("\n")}`,
  );
});

test("todo usuário tem papel vinculado — senão o fallback legado nunca sai", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  const [r] = await db.execute<{ total: number; sem_papel: number }>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM user_roles ur WHERE ur.usuario_id = u.id))::int AS sem_papel
      FROM usuarios u`);
  assert.equal(r.sem_papel, 0, `${r.sem_papel} de ${r.total} usuários sem papel vinculado`);
});

test("agente de IA não excede a permissão delegada na execução", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { temPermissao } = await import("./permissoes.js");

  // Um admin: pode tudo como humano.
  const [admin] = await db.execute<{ id: string; organizacao_id: string }>(sql`
    SELECT u.id::text, u.organizacao_id::text FROM usuarios u
      JOIN user_roles ur ON ur.usuario_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.codigo = 'admin' LIMIT 1`);
  if (!admin) return t.skip("sem admin no banco");

  const comoHumano = await temPermissao(
    { usuarioId: admin.id, organizacaoId: admin.organizacao_id, tipo: "HUMAN" },
    "finance.manage",
  );
  assert.equal(comoHumano, true, "o admin deveria poder mexer no financeiro");

  // O MESMO usuário, agindo por um agente que recebeu só leitura de vendas.
  const comoAgente = await temPermissao(
    {
      usuarioId: admin.id, organizacaoId: admin.organizacao_id, tipo: "AI",
      permissoesDelegadas: ["sales.read"],
    },
    "finance.manage",
  );
  assert.equal(
    comoAgente, false,
    "o agente excedeu a delegação: com o usuário certo por trás, a IA poderia tudo",
  );
});
