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
  //
  // A decisão de quem opera fica REGISTRADA aqui, por agente, com a nota que a prova. NEXO foi publicado por
  // decisão do Scott (08/10: age COMO o usuário; 12/10: é o harness do ONFACE, vault ONFACE/execucao/2026-10-12-mapa-nexo-e-agentes);
  // Hermes roda por evento dentro do teto restrito da versão. Agente novo publicado sem entrar nesta lista continua reprovando.
  const DECIDIDOS: Record<string, string> = {
    nexo: "decisão do Scott em 08/10 e 12/10: harness do ONFACE, age como o usuário, teto de permissão pela interseção",
    hermes: "orquestração por evento, teto restrito da versão (sem usuário), publicado junto do NEXO",
  };
  const publicados = agentes.filter((a) => a.status !== "draft" && !DECIDIDOS[a.slug]);
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

test("toda ferramenta que muta exige permissão delegada", async () => {
  const { AGENT_TOOLS } = await import("./tools/registry.js");
  const { PERMISSAO_POR_FERRAMENTA } = await import("./permissao-delegada.js");

  // Ferramenta que muda dado de negócio sem permissão mapeada é uma porta que
  // o RBAC não cobre: o agente faz por conversa o que o papel não permite.
  //
  // As exceções são deliberadas e todas da mesma família: é o que um agente faz
  // quando NÃO pode agir — pedir ajuda, abrir caso, levantar alerta. Negá-las
  // deixaria ele travado em silêncio, que é pior que agir demais.
  //
  // Nenhuma delas toca dado de negócio: escrevem em fila de trabalho humano.
  // O abuso possível é volume (agente levantando cem alertas), e isso é
  // limitação de taxa, não de permissão.
  const EXCECOES = new Set([
    "handoff.request", "case.open", "alert.create",
    "skill.activate", "message.prepare", "response.classify",
    // Anotação pessoal do usuário no NEXO: nenhum dado de negócio, e só ele a lê.
    "nexo.anotar", "nexo.esquecer",
  ]);

  const semGate = AGENT_TOOLS
    .filter((t) => t.mutates && !EXCECOES.has(t.id) && !PERMISSAO_POR_FERRAMENTA[t.id])
    .map((t) => t.id);

  assert.deepEqual(semGate, [], "ferramenta de escrita sem permissão exigida");
});

test("o gate roda no executor único, não em cada ferramenta", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const registry = fs.readFileSync(path.resolve(import.meta.dirname, "tools/registry.ts"), "utf8");

  // Verificar dentro de cada ferramenta seriam catorze lugares para alguém
  // esquecer um. O executor é por onde todas passam.
  const trecho = registry.slice(registry.indexOf("export async function executeRegisteredTool"));
  assert.match(trecho, /ferramentaPermitida/, "o executor único não checa permissão delegada");
  assert.match(trecho, /sem permissão delegada/, "a recusa precisa dizer o que faltou");
});

test("NEXO e Hermes têm tetos diferentes, e nenhum mexe em automação", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  const linhas = await db.execute<{ slug: string; permissoes: string[] | null }>(sql`
    SELECT a.slug, v.guardrail_config -> 'permissoes' AS permissoes
      FROM ai_agents a JOIN ai_agent_versions v ON v.agent_id = a.id
     WHERE a.slug IN ('nexo','hermes')`);

  const porSlug = new Map(linhas.map((l) => [l.slug, new Set(l.permissoes ?? [])]));
  const nexo = porSlug.get("nexo");
  const hermes = porSlug.get("hermes");
  assert.ok(nexo && hermes, "os dois agentes precisam de teto configurado");

  // Hermes roda sem humano por trás: o teto dele é o mais apertado.
  assert.ok(hermes!.size < nexo!.size, "o executor sem humano deveria ter teto menor que o copiloto");

  // Mudar fluxo de automação por conversa é como se perde o controle de um
  // sistema: o pedido vira configuração e ninguém revisou.
  for (const [slug, p] of porSlug) {
    assert.ok(!p.has("automation.manage"), `${slug} não deveria poder alterar automação`);
    assert.ok(!p.has("finance.manage"), `${slug} não deveria poder mexer em financeiro`);
    assert.ok(!p.has("admin.manage_users"), `${slug} não deveria poder gerir usuários`);
  }
});
