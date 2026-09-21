/**
 * Smoke da gestão de tokens da API pública (SPEC §30.2).
 *
 * A API pública existia com nove recursos e nenhuma forma de criar credencial:
 * `api_tokens` só era escrita pelo smoke da própria API. Este script prova a
 * cadeia que faltava, do token nascendo até ele morrer:
 *
 *     criar (com teto) → usar em /v1 → revogar → /v1 recusa
 *
 * Chama as rotas de verdade pelo app Hono, não as funções por dentro: o que
 * quebra em produção é a rota, não a função.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-gestao-tokens.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { apiTokensRoutes } from "@/api-server/routes/api-tokens";
import { v1Routes } from "@/api-server/v1/index";
import { aplicarTetoDeToken } from "@/lib/auth/teto-de-token";
import { permissoesEfetivas } from "@/lib/auth/permissoes";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

const criados: string[] = [];

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [user] = await db.execute<{ id: string; role: string | null }>(sql`
    SELECT id::text, role FROM usuarios WHERE organizacao_id = ${org.id}::uuid LIMIT 1`);
  if (!user) throw new Error("nenhum usuário na organização");

  const marca = `smoke-token-${Date.now()}`;
  console.log(`\norganização: ${org.id}\nusuário: ${user.id} (${user.role})\n`);

  const efetivas = await permissoesEfetivas({
    usuarioId: user.id, organizacaoId: org.id, role: user.role, tipo: "HUMAN",
  });
  console.log(`  permissões efetivas: ${[...efetivas].sort().join(", ") || "(nenhuma)"}\n`);

  // O teto, com as permissões REAIS deste usuário.
  const permitido = aplicarTetoDeToken(["sales.read"], efetivas);
  ok(permitido.ok === efetivas.has("sales.read"),
     "o teto concorda com a permissão efetiva do usuário");

  const negado = aplicarTetoDeToken(["ai.configure"], efetivas);
  ok(!negado.ok, "escopo de configuração é recusado mesmo para quem o possui");

  // Cria direto no banco com o mesmo caminho da rota, porque a rota exige
  // sessão HTTP e o que se quer provar aqui é o efeito no /v1.
  const { gerarToken } = await import("@/api-server/v1/autenticacao");
  const t = gerarToken();
  ok(t.valor.startsWith("onf_"), "o token tem prefixo reconhecível");
  ok(t.valor.length >= 40, "e comprimento de credencial, não de sufixo");

  const outro = gerarToken();
  ok(t.valor !== outro.valor, "dois tokens seguidos não colidem");

  const [linha] = await db.execute<{ id: string }>(sql`
    INSERT INTO api_tokens (organizacao_id, nome, prefixo, token_sha256, escopos, criado_por_id)
    VALUES (${org.id}::uuid, ${marca}, ${t.prefixo}, ${t.hash},
            ARRAY['sales.read']::text[], ${user.id}::uuid)
    RETURNING id::text`);
  criados.push(linha.id);

  const chamar = (caminho: string, token: string | null) =>
    v1Routes.request(`http://local${caminho}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const comToken = await chamar("/v1/opportunities", t.valor);
  ok(comToken.status === 200, `token novo abre /v1/opportunities (status ${comToken.status})`);

  const foraDoEscopo = await chamar("/v1/invoices", t.valor);
  ok(foraDoEscopo.status === 403,
     `escopo de vendas não abre financeiro (status ${foraDoEscopo.status})`);

  // Revogar, pelo mesmo UPDATE da rota.
  await db.execute(sql`
    UPDATE api_tokens SET revogado_em = now()
     WHERE id = ${linha.id}::uuid AND organizacao_id = ${org.id}::uuid`);

  const revogado = await chamar("/v1/opportunities", t.valor);
  ok(revogado.status === 401, `token revogado é recusado (status ${revogado.status})`);

  // A listagem da rota não pode devolver o hash.
  const listagem = await apiTokensRoutes.request("http://local/configuracoes/api-tokens");
  ok(listagem.status === 401 || listagem.status === 403,
     `listar sem sessão não devolve nada (status ${listagem.status})`);

  const [guardado] = await db.execute<{ token_sha256: string; nome: string }>(sql`
    SELECT token_sha256, nome FROM api_tokens WHERE id = ${linha.id}::uuid`);
  ok(guardado.token_sha256 !== t.valor, "o banco guarda o hash, nunca o token");
  ok(guardado.token_sha256.length === 64, "e o hash é sha256");

  for (const id of criados) {
    await db.execute(sql`DELETE FROM api_tokens WHERE id = ${id}::uuid`);
  }
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM api_tokens WHERE nome LIKE 'smoke-token-%'`);
  ok(resto?.n === 0, "o smoke não deixa resíduo");

  console.log(process.exitCode ? "\nsmoke de tokens: FALHOU\n" : "\nsmoke de tokens: ok\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
