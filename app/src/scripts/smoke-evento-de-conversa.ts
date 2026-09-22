/**
 * Evento de conversa sai do fato, não do relógio.
 *
 * As duas rotas que mexem no dono de uma conversa construíam a chave de
 * idempotência com o horário da própria requisição:
 *
 *     `contato:${id}:${acao}:${agora.getTime()}`
 *     `contato:${id}:assignment:${updated.updatedAt.getTime()}`
 *
 * Cada chamada gerava uma chave nova, então **nada dedupicava**: dois cliques no
 * mesmo botão publicavam dois eventos, e quem os consome reagia duas vezes.
 * Idempotência decorativa.
 *
 * E em `contatos.ts` a condição do tipo de evento estava invertida:
 * `responsavelId === targetUserId` quer dizer que a conversa JÁ era daquela
 * pessoa — não mudou nada — e mesmo assim publicava `ConversationClaimed`;
 * assumir uma conversa SEM dono, que é o significado de "claim", caía em
 * `ConversationTransferred`.
 *
 * `domain_events` não tinha nenhum `Conversation*`: o caminho nunca foi
 * exercido, e por isso nenhuma contagem denunciava.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-evento-de-conversa.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { contatosRoutes } from "@/api-server/routes/contatos";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const MARCA = "smoke-conversa-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM domain_events WHERE aggregate_id::text IN (SELECT id::text FROM contatos WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM event_outbox WHERE aggregate_id::text IN (SELECT id::text FROM contatos WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM contatos WHERE nome LIKE ${MARCA + "%"}`,
  ]) await db.execute(q).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  const usuarios = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios WHERE organizacao_id = ${org.id}::uuid AND ativo = true LIMIT 2`);
  if (usuarios.length < 2) { console.log("  (menos de 2 usuários ativos — sem cenário de transferência)"); process.exit(0); }
  const sessao = await sessaoDeSmoke();
  const marca = `${MARCA}${Date.now()}`;

  // Conversa SEM dono: é esse o estado que faz "claim" significar reivindicar.
  const [contato] = await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, nome, telefone, canal, responsavel_id)
    VALUES (${org.id}::uuid, ${marca}, '11999990000', 'whatsapp', NULL) RETURNING id::text`);

  const atribuir = (usuarioId: string) =>
    contatosRoutes.request(`http://local/contatos/${contato.id}/atribuir`, {
      method: "POST", headers: { "content-type": "application/json", cookie: sessao.cookie },
      body: JSON.stringify({ usuarioId }),
    });

  const eventos = async () => db.execute<{ event_type: string; idempotency_key: string }>(sql`
    SELECT event_type, idempotency_key FROM domain_events
     WHERE aggregate_id::text = ${contato.id} ORDER BY occurred_at`);

  console.log("═══ assumir conversa SEM dono é Claimed ═══");
  const r1 = await atribuir(usuarios[0].id);
  ok(r1.status === 200, `a rota respondeu (HTTP ${r1.status})`);
  const e1 = await eventos();
  ok(e1.length === 1, `um evento publicado (${e1.length})`);
  ok(e1[0]?.event_type === "ConversationClaimed",
     `e é ConversationClaimed, não Transferred (${e1[0]?.event_type})`);

  console.log("\n═══ atribuir de novo ao MESMO dono não é fato ═══");
  const r2 = await atribuir(usuarios[0].id);
  const e2 = await eventos();
  ok(r2.status === 200, `a rota responde normalmente (HTTP ${r2.status})`);
  ok(e2.length === 1, `nenhum evento novo (${e2.length}) — antes a chave tinha o relógio e publicava de novo`);

  console.log("\n═══ trocar de dono é Transferred ═══");
  const r3 = await atribuir(usuarios[1].id);
  const e3 = await eventos();
  ok(r3.status === 200, `a rota respondeu (HTTP ${r3.status})`);
  ok(e3.length === 2, `um evento novo (${e3.length})`);
  ok(e3[1]?.event_type === "ConversationTransferred",
     `e é ConversationTransferred (${e3[1]?.event_type})`);

  console.log("\n═══ a chave descreve o estado, não o instante ═══");
  ok(e3.every((e) => !/\d{13}/.test(e.idempotency_key ?? "")),
     `nenhuma chave carrega timestamp (${e3.map((e) => e.idempotency_key).join(" · ")})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM contatos WHERE nome LIKE ${MARCA + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nevento de conversa: ok\n" : "\nevento de conversa: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
