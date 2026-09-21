/**
 * Reagendar chega na agenda — ou diz por que não chegou (Módulo 09).
 *
 * O gap era concreto: existia criar e cancelar, não existia atualizar. O
 * cliente Graph tinha create, get e delete e mais nada. `PATCH /reunioes/:id`
 * mudava a data no ONFACE e só avisava o provedor quando o status virava
 * "cancelada" — reagendar deixava o convite antigo de pé na agenda do cliente,
 * sem ninguém ser avisado.
 *
 * Este smoke roda a rota DE VERDADE e não precisa de credencial externa: o que
 * ele prova é que a rota chama o provider, que a falha vira estado visível e
 * que o reprocessamento pega a fila. Com conta conectada, o mesmo caminho
 * chama a Graph/Google.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-calendar-provider.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { reunioesRoutes } from "@/api-server/routes/reunioes";
import { sessaoDeSmoke } from "./_sessao-de-smoke";
import { microsoftCalendar } from "@/lib/calendario/microsoft";
import { googleCalendar } from "@/lib/calendario/google";
import { providerPorNome, reprocessarSyncPendente } from "@/lib/calendario/sincronizar";

const MARCA = "smoke-calendar-%";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

let reuniaoId: string | null = null;

async function limpar() {
  await db.execute(sql`DELETE FROM reunioes WHERE titulo LIKE ${MARCA}`).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE ativo = true LIMIT 1`);
  const sessao = await sessaoDeSmoke();

  console.log("\n═══ os dois adapters existem e declaram capacidade ═══");
  ok(providerPorNome("microsoft") === microsoftCalendar, "Microsoft registrado no CalendarProvider");
  ok(providerPorNome("google") === googleCalendar, "Google registrado no CalendarProvider");
  ok(providerPorNome("carteiro") === null, "provedor inexistente não é inventado");
  for (const p of [microsoftCalendar, googleCalendar]) {
    console.log(`         ${p.nome.padEnd(10)} configurado=${p.configurado()}`);
  }
  // As três operações do requisito precisam existir nos dois.
  for (const p of [microsoftCalendar, googleCalendar]) {
    ok(typeof p.criar === "function" && typeof p.atualizar === "function" && typeof p.cancelar === "function",
       `${p.nome}: create, update e cancel implementados`);
  }

  console.log("\n═══ reagendar pela rota chama o provider ═══");
  const daquiADias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const [r] = await db.execute<{ id: string }>(sql`
    INSERT INTO reunioes (organizacao_id, titulo, data, duracao, status, responsavel_id)
    VALUES (${org.id}::uuid, ${"smoke-calendar-" + Date.now()}, ${daquiADias(2)}::timestamptz, 30, 'agendada', ${u.id}::uuid)
    RETURNING id::text`);
  reuniaoId = r.id;

  const novaData = daquiADias(5);
  const resp = await reunioesRoutes.request(`http://local/reunioes/${reuniaoId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: sessao.cookie },
    body: JSON.stringify({ data: novaData }),
  });
  const corpo = await resp.json().catch(() => ({})) as { avisoAgenda?: string | null; data?: string };
  ok(resp.status === 200, `a rota aceita o reagendamento (HTTP ${resp.status})`);
  ok(new Date(String(corpo.data)).toISOString() === new Date(novaData).toISOString(),
     "a data muda no ONFACE");

  const [depois] = await db.execute<{ status: string | null; erro: string | null }>(sql`
    SELECT calendar_sync_status AS status, calendar_sync_erro AS erro
      FROM reunioes WHERE id = ${reuniaoId}::uuid`);
  ok(depois.status !== null,
     `o reagendamento registra estado de sincronização ("${depois.status}")`);
  // Sem conta conectada, o correto NÃO é silêncio: é aviso.
  ok(typeof corpo.avisoAgenda === "string" && corpo.avisoAgenda.length > 0,
     `e a tela recebe o motivo: "${String(corpo.avisoAgenda).slice(0, 62)}..."`);
  ok(!/undefined|null/.test(String(corpo.avisoAgenda)), "o aviso é uma frase, não um código");

  console.log("\n═══ a falha é reprocessável, não perdida ═══");
  await db.execute(sql`
    UPDATE reunioes SET calendar_sync_status = 'falhou', calendar_sync_erro = 'smoke',
                        calendar_sync_em = now() - interval '1 hour'
     WHERE id = ${reuniaoId}::uuid`);
  const [naFila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM reunioes
     WHERE organizacao_id = ${org.id}::uuid AND calendar_sync_status = 'falhou'`);
  ok(naFila.n >= 1, `a reunião entra na fila de reprocessamento (${naFila.n})`);

  const rep = await reprocessarSyncPendente(org.id, 10);
  ok(rep.tentadas >= 1, `o reprocessamento pega a fila (${rep.tentadas} tentada(s), ${rep.resolvidas} resolvida(s))`);

  console.log("\n═══ cancelar não quebra sem evento externo ═══");
  const respCancel = await reunioesRoutes.request(`http://local/reunioes/${reuniaoId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: sessao.cookie },
    body: JSON.stringify({ status: "cancelada" }),
  });
  ok(respCancel.status === 200, `cancelar responde 200 mesmo sem evento na agenda (HTTP ${respCancel.status})`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM reunioes WHERE titulo LIKE ${MARCA}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\ncalendar provider: ok\n" : "\ncalendar provider: FALHOU\n");
}

main()
  .then(() => process.exit(saida))
  .catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
