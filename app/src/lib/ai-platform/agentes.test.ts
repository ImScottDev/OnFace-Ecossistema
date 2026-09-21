/**
 * NEXO e Hermes (SPEC §19).
 *
 * A plataforma de IA tinha 30 tabelas prontas e **zero agentes**. O SPEC manda
 * criar os dois e, mais importante, manda que as ferramentas sejam embrulho
 * sobre ação de domínio: `AI → direct SQL` e `AI → direct db.update()` são
 * proibidos por escrito.
 *
 * O motivo não é purismo. Escrita própria pula o gate comercial, o evento, a
 * projeção na timeline e a idempotência — tudo que a ação de domínio faz junto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DB_URL = process.env.DATABASE_URL;
const REGISTRY = path.resolve(import.meta.dirname, "tools/registry.ts");

test("NEXO e Hermes existem, com versão e ferramentas que existem de verdade", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { AGENT_TOOLS } = await import("./tools/registry.js");

  const agentes = await db.execute<{ slug: string; status: string; tools: string[] }>(sql`
    -- tools sai como jsonb: o driver converte para array JS. Um array nativo do
    -- Postgres chegaria como a string "{a,b,c}", e iterar isso percorre
    -- caractere por caractere — foi o que este teste acusou na primeira rodada.
    SELECT a.slug, a.status, v.tools AS tools
      FROM ai_agents a JOIN ai_agent_versions v ON v.agent_id = a.id AND v.versao = 1
     WHERE a.slug IN ('nexo', 'hermes')`);

  const slugs = agentes.map((a) => a.slug).sort();
  assert.deepEqual(slugs, ["hermes", "nexo"], "os dois agentes do SPEC precisam existir");

  // Ferramenta listada e inexistente só aparece quando o agente a chama, em
  // produção, no meio de uma conversa com cliente.
  const conhecidas = new Set(AGENT_TOOLS.map((f) => f.name));
  const desconhecidas: string[] = [];
  for (const a of agentes) {
    for (const nome of a.tools ?? []) {
      if (!conhecidas.has(nome)) desconhecidas.push(`${a.slug}: ${nome}`);
    }
  }
  assert.deepEqual(desconhecidas, [], "agente listando ferramenta que não existe no registry");

  // Agente que já nasce executando sozinho em base de produção é feature sem
  // revisão: pode dar certo, e quando dá errado ninguém sabe o que ele fez.
  const publicados = agentes.filter((a) => a.status !== "draft");
  assert.deepEqual(publicados.map((a) => a.slug), [], "agente publicado sem decisão de quem opera");
});

test("ferramenta que muda estado comercial não escreve direto no banco", () => {
  const src = fs.readFileSync(REGISTRY, "utf8");

  // As três que mudam estado comercial passaram a chamar o adapter, que é onde
  // vivem o gate do Ganho, o evento e a idempotência.
  for (const adapter of ["crm_create_task", "crm_update_stage"]) {
    assert.ok(src.includes(adapter), `as ferramentas deveriam delegar a ${adapter}`);
  }

  const proibidas = [
    /db\s*\.\s*update\(negocios\)/,
    /db\s*\.\s*insert\(tarefas\)/,
    /db\s*\.\s*update\(leads\)\.set\(\{\s*status/,
  ].filter((re) => re.test(src));
  assert.deepEqual(
    proibidas.map(String), [],
    "ferramenta de IA voltou a escrever direto no que o adapter governa",
  );
});
