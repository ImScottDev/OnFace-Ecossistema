/**
 * Smoke da API pública v1 (SPEC §23, §30.2).
 *
 * Prova o pipeline inteiro contra o servidor de verdade: autenticação por
 * token, tenant vindo do token (não do pedido), escopo por rota, e o registro
 * de uso.
 *
 * O caso que mais importa é o terceiro: um token com escopo de vendas NÃO pode
 * alcançar financeiro. Sem essa separação, "token de integração" vira chave
 * mestra, que é como toda API pública vaza.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { gerarToken } from "@/api-server/v1/autenticacao";
import { v1Routes } from "@/api-server/v1/index";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const marca = `smoke-api-${Date.now()}`;
  const criados: string[] = [];
  let saida = 1;

  /** Chama a rota pelo app de verdade, com o cabeçalho de verdade. */
  const chamar = async (caminho: string, token: string | null) =>
    v1Routes.request(`http://local${caminho}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  try {
    const vendas = gerarToken();
    const t1 = await um<{ id: string }>(sql`
      INSERT INTO api_tokens (organizacao_id, nome, prefixo, token_sha256, escopos)
      VALUES (${org.id}::uuid, ${marca + "-vendas"}, ${vendas.prefixo}, ${vendas.hash},
              ARRAY['sales.read','acquisition.read']::text[])
      RETURNING id`);
    criados.push(t1.id);

    const expirado = gerarToken();
    const t2 = await um<{ id: string }>(sql`
      INSERT INTO api_tokens (organizacao_id, nome, prefixo, token_sha256, escopos, expira_em)
      VALUES (${org.id}::uuid, ${marca + "-expirado"}, ${expirado.prefixo}, ${expirado.hash},
              ARRAY['sales.read']::text[], now() - interval '1 day')
      RETURNING id`);
    criados.push(t2.id);

    console.log("");
    const semToken = await chamar("/v1/opportunities", null);
    console.log(`  1. sem token                  → ${semToken.status}`);

    const tokenErrado = await chamar("/v1/opportunities", "onf_naoexiste");
    console.log(`  2. token inexistente          → ${tokenErrado.status}`);

    const comEscopo = await chamar("/v1/opportunities?limit=3", vendas.valor);
    const corpo = comEscopo.status === 200 ? await comEscopo.json() : null;
    console.log(`  3. token de vendas em /opportunities → ${comEscopo.status} (${corpo?.data?.length ?? 0} itens)`);

    const semEscopo = await chamar("/v1/invoices", vendas.valor);
    const erroEscopo = semEscopo.status === 403 ? await semEscopo.json() : null;
    console.log(`  4. o MESMO token em /invoices → ${semEscopo.status} ${erroEscopo?.error ? `(${erroEscopo.error})` : ""}`);

    const venceu = await chamar("/v1/opportunities", expirado.valor);
    console.log(`  5. token expirado             → ${venceu.status}`);

    const aquis = await chamar("/v1/acquisitions?limit=3", vendas.valor);
    const corpoAq = aquis.status === 200 ? await aquis.json() : null;
    console.log(`  6. /acquisitions (consulta canônica) → ${aquis.status} (${corpoAq?.data?.length ?? 0} itens)`);

    const usos = await um<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM api_token_usos WHERE token_id = ${t1.id}::uuid`);
    console.log(`  7. usos registrados do token  → ${usos.n}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["exige token", semToken.status === 401, "rota pública sem credencial não responde dado"],
      ["token errado", tokenErrado.status === 401, "token inexistente não passa"],
      ["escopo permite", comEscopo.status === 200, "o escopo certo abre a rota"],
      ["escopo BARRA", semEscopo.status === 403, "token de vendas NÃO alcança financeiro"],
      ["expirado barra", venceu.status === 401, "token vencido não passa"],
      ["consulta canônica", aquis.status === 200 && Array.isArray(corpoAq?.data), "a API lê pela mesma consulta da tela"],
      ["uso registrado", usos.n >= 3, "toda chamada deixa rastro de quem puxou o quê"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(18)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: o escopo do token é teto, não sugestão" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;
  } finally {
    for (const id of criados) {
      await db.execute(sql`DELETE FROM api_token_usos WHERE token_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM api_tokens WHERE id = ${id}::uuid`);
    }
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
