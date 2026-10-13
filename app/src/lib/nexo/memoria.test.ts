/**
 * Memória do NEXO contra o banco local: recuperação por relevância, isolamento
 * por usuário e por organização, ligações e o que o modelo enxerga.
 * Registros de teste levam "[QA mem]" no título e são apagados no fim.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";
import { anotar, lembrar, abrir, esquecer } from "./memoria";

const ORG = "320a9052-dd43-4edb-9b74-34be53c5c419";
const OUTRA_ORG = "00000000-0000-4000-8000-0000000000aa";
let ana = "", beto = "";
before(async () => {
  const us = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE organizacao_id=${ORG}::uuid AND ativo ORDER BY id LIMIT 2`);
  assert.equal(us.length, 2, "precisa de 2 usuários ativos no banco local");
  [ana, beto] = us.map((u) => u.id);
});
after(async () => {
  await db.execute(sql`DELETE FROM nexo_memoria WHERE titulo LIKE '[QA mem]%'`);
  process.exit(0);
});
const A = () => ({ organizacaoId: ORG, usuarioId: ana });

test("grava um fato por registro e recupera pelo assunto, sem trazer o corpo", async () => {
  const preco = await anotar(A(), { titulo: "[QA mem] Preço do plano Pro", resumo: "Ana prefere falar de preço anual com desconto de 10%", corpo: "Combinamos que proposta de plano anual sempre sai com 10% e pagamento no boleto." });
  const horario = await anotar(A(), { titulo: "[QA mem] Horário de ligação", resumo: "Ana só atende ligações depois das 14h" });
  assert.ok(preco.ok && horario.ok);
  const r = await lembrar(A(), "qual era o desconto do plano anual?");
  assert.equal(r.porRelevancia, true);
  assert.equal(r.resultados[0]!.titulo, "[QA mem] Preço do plano Pro");
  assert.ok(!r.resultados.some((x) => x.titulo.includes("Horário")), "não casa o que não tem relação");
  assert.ok(!("corpo" in r.resultados[0]!), "a busca devolve título e resumo, o corpo só vem com abrir");
});

test("sem correspondência devolve as recentes, marcadas", async () => {
  const r = await lembrar(A(), "banana quântica");
  assert.equal(r.porRelevancia, false);
  assert.ok(r.resultados.length > 0);
});

test("mesmo título atualiza em vez de duplicar", async () => {
  const a = await anotar(A(), { titulo: "[QA mem] Horário de ligação", resumo: "Ana atende depois das 15h agora" });
  assert.ok(a.ok && !a.criada);
  const n = await db.execute(sql`SELECT 1 FROM nexo_memoria WHERE titulo = '[QA mem] Horário de ligação' AND usuario_id = ${ana}::uuid`);
  assert.equal(n.length, 1);
});

test("outro usuário e outra organização não recuperam nem abrem", async () => {
  const [{ id }] = await db.execute<{ id: string }>(sql`SELECT id::text FROM nexo_memoria WHERE titulo = '[QA mem] Preço do plano Pro'`);
  const deBeto = { organizacaoId: ORG, usuarioId: beto };
  assert.equal((await lembrar(deBeto, "desconto plano anual")).resultados.filter((x) => x.titulo.startsWith("[QA mem]")).length, 0);
  assert.equal(await abrir(deBeto, id), null);
  assert.equal(await esquecer(deBeto, id), false);
  const deOutraOrg = { organizacaoId: OUTRA_ORG, usuarioId: ana };
  assert.equal((await lembrar(deOutraOrg, "desconto plano anual")).resultados.length, 0);
  assert.equal(await abrir(deOutraOrg, id), null);
});

test("ligações: abrir traz os vizinhos nos dois sentidos; id de outro dono é ignorado", async () => {
  const [{ id: precoId }] = await db.execute<{ id: string }>(sql`SELECT id::text FROM nexo_memoria WHERE titulo = '[QA mem] Preço do plano Pro'`);
  const [{ id: alheio }] = await db.execute<{ id: string }>(sql`INSERT INTO nexo_memoria (organizacao_id, usuario_id, titulo, resumo) VALUES (${ORG}::uuid, ${beto}::uuid, '[QA mem] do Beto', 'segredo') RETURNING id::text`);
  const c = await anotar(A(), { titulo: "[QA mem] Cliente Acme", resumo: "Acme quer o plano Pro anual", ligaA: [precoId, alheio] });
  assert.ok(c.ok);
  const acme = await abrir(A(), c.ok ? c.id : "");
  assert.deepEqual(acme!.ligadas.map((x) => x.titulo), ["[QA mem] Preço do plano Pro"], "o registro do Beto não entra");
  const preco = await abrir(A(), precoId);
  assert.ok(preco!.ligadas.some((x) => x.titulo === "[QA mem] Cliente Acme"), "link de volta");
  assert.match(preco!.corpo ?? "", /10%/);
});

test("esquecer tira da recuperação", async () => {
  const c = await anotar(A(), { titulo: "[QA mem] Efêmera", resumo: "coisa temporária de zebra" });
  assert.ok(c.ok);
  assert.equal((await lembrar(A(), "zebra")).porRelevancia, true);
  assert.equal(await esquecer(A(), c.ok ? c.id : ""), true);
  assert.equal((await lembrar(A(), "zebra")).porRelevancia, false);
});

test("as ferramentas usam a sessão, não um id do modelo; sem usuário não rodam", async () => {
  const ctx = { organizacaoId: ORG, agentId: "00000000-0000-4000-8000-000000000000", runId: "00000000-0000-4000-8000-000000000001", usuarioId: ana, mode: "live" as const, autonomy: "autonomous" as const };
  const a = await executeRegisteredTool("nexo_anotar", ctx, { titulo: "[QA mem] Via ferramenta", resumo: "teste da ferramenta anotar" });
  assert.equal(a.ok, true, a.error);
  const l = await executeRegisteredTool("nexo_lembrar", ctx, { consulta: "ferramenta anotar" });
  const achada = (l.data as { resultados: { id: string; titulo: string }[] }).resultados[0]!;
  assert.equal(achada.titulo, "[QA mem] Via ferramenta");
  const aberta = await executeRegisteredTool("nexo_abrir_anotacao", ctx, { id: achada.id });
  assert.equal((aberta.data as { titulo: string }).titulo, "[QA mem] Via ferramenta");
  assert.equal((await executeRegisteredTool("nexo_anotar", ctx, { resumo: "sem título" })).ok, false, "titulo é obrigatório");
  assert.equal((await executeRegisteredTool("nexo_esquecer", ctx, { id: achada.id })).ok, true);
  assert.equal((await executeRegisteredTool("nexo_abrir_anotacao", ctx, { id: achada.id })).ok, false, "esquecida não abre");
  const sem = await executeRegisteredTool("nexo_lembrar", { ...ctx, usuarioId: null }, { consulta: "ferramenta" });
  assert.equal(sem.ok, false);
  const prev = await executeRegisteredTool("nexo_anotar", { ...ctx, mode: "test" }, { titulo: "[QA mem] Prévia", resumo: "não grava em teste" });
  assert.equal((prev.data as { preview?: boolean }).preview, true);
  assert.equal((await db.execute(sql`SELECT 1 FROM nexo_memoria WHERE titulo = '[QA mem] Prévia'`)).length, 0);
});
