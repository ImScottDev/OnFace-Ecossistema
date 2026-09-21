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

test("as rotas financeiras separam leitura de escrita", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const APP = path.resolve(import.meta.dirname, "../../..");

  // `isAdminView` responde "é gestão?" e quem passa pode tudo. Separar leitura
  // de escrita é o que permite um perfil ver receita sem poder importar
  // lançamento — e é o que o SPEC §31 pede para poder delegar a um agente.
  const LEITURA = [
    "src/app/api/financeiro/metricas/route.ts",
    "src/app/api/financeiro/churn/route.ts",
    "src/app/api/financeiro/cobranca/route.ts",
    "src/app/api/financeiro/inadimplencia/route.ts",
    "src/app/api/financeiro/vendas/route.ts",
  ];
  const ESCRITA = ["src/app/api/financeiro/pabx-import/route.ts"];

  const semLeitura = LEITURA.filter(
    (f) => !fs.readFileSync(path.join(APP, f), "utf8").includes('"finance.read"'),
  );
  assert.deepEqual(semLeitura, [], "rota de leitura financeira sem finance.read");

  const semEscrita = ESCRITA.filter(
    (f) => !fs.readFileSync(path.join(APP, f), "utf8").includes('"finance.manage"'),
  );
  assert.deepEqual(semEscrita, [], "rota que importa dado financeiro sem finance.manage");

  // A separação só vale se os dois escopos forem de fato diferentes para
  // alguém. Se todo mundo tivesse os dois, isto seria teatro.
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const [r] = await db.execute<{ so_leitura: number }>(sql`
    SELECT count(*)::int AS so_leitura FROM roles r
     WHERE EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = r.id AND p.codigo = 'finance.read')
       AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                        WHERE rp.role_id = r.id AND p.codigo = 'finance.manage')`);
  assert.ok(r.so_leitura > 0, "nenhum papel tem só leitura financeira: a separação não separa nada");
});

test("criar automação e configurar agente exigem permissão", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const ROTAS = path.resolve(import.meta.dirname, "../../api-server/routes");

  // Estas rotas estavam SEM gate nenhum: qualquer usuário autenticado podia
  // criar automação e editar a versão de um agente.
  //
  // Por que isso é grave e não um detalhe de permissão:
  //
  //   uma automação move etapa, cria tarefa e manda mensagem — um SDR criaria
  //   uma regra que faz o que o papel dele não permite fazer direto;
  //
  //   a versão do agente guarda o TETO DE PERMISSÃO dele (guardrail_config).
  //   Sem gate aqui, qualquer um se dá permissão via agente, e o RBAC inteiro
  //   cai por um caminho que ninguém olha.
  const ESPERADO: Array<[string, string]> = [
    ["automacoes.ts", "automation.manage"],
    ["automacoes-cadencias.ts", "automation.manage"],
    ["automacoes-agentes.ts", "ai.configure"],
    ["automacoes-tags.ts", "acquisition.manage"],
  ];

  const semGate: string[] = [];
  for (const [arquivo, permissao] of ESPERADO) {
    const src = fs.readFileSync(path.join(ROTAS, arquivo), "utf8");
    if (!src.includes(`exigirCtx(c, "${permissao}")`)) semGate.push(`${arquivo} → ${permissao}`);
  }
  assert.deepEqual(semGate, [], "rota de escrita de automação/agente sem permissão exigida");

  // E nenhuma rota de ESCRITA nesses arquivos pode ficar só com getCtx.
  for (const [arquivo] of ESPERADO) {
    const src = fs.readFileSync(path.join(ROTAS, arquivo), "utf8");
    const escritas = [...src.matchAll(/app\.(post|patch|put|delete)\("([^"]+)"/g)];
    for (const m of escritas) {
      const corpo = src.slice(m.index, m.index + 600);
      const temGate = /exigirCtx\(c, "/.test(corpo);
      assert.ok(
        temGate,
        `${arquivo}: ${m[1].toUpperCase()} ${m[2]} não exige permissão`,
      );
    }
  }
});
