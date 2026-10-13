/**
 * Reparo idempotente do evento de UMA reunião no calendário do responsável.
 *
 *   1. regrava o evento vinculado com o fuso certo (E. South America Standard Time)
 *      e com os dados atuais da reunião (PATCH; se o evento sumiu, recria);
 *   2. acha no mesmo calendário os eventos de mesmo assunto que NÃO são o vinculado
 *      (duplicatas deixadas por edições antigas) e os cancela.
 *
 * Sem --aplicar só mostra o plano. Rodar duas vezes dá o mesmo resultado.
 *
 *     pnpm tsx --env-file=.env src/scripts/reparar-evento-reuniao.ts <reuniao_id> [--aplicar]
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { atualizarNaAgenda } from "@/lib/calendario/sincronizar";
import { eventosNaJanela, lerEvento } from "@/lib/calendario/graph-calendario";
import { cancelOutlookEvent } from "@/lib/email/microsoft";

const [id, flag] = process.argv.slice(2);
const aplicar = flag === "--aplicar";
const norm = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

async function main() {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("uso: reparar-evento-reuniao.ts <reuniao_id> [--aplicar]");
  const [r] = await db.execute<{ organizacao_id: string; titulo: string; data: Date; created_at: Date; evento: string | null; conta_id: string | null; responsavel_id: string | null }>(sql`
    SELECT organizacao_id::text, titulo, data, created_at, COALESCE(calendar_event_id, outlook_event_id) AS evento,
           calendar_conta_id::text AS conta_id, responsavel_id::text
      FROM reunioes WHERE id = ${id}::uuid`);
  if (!r) throw new Error("reunião não encontrada");

  const [conta] = await db.execute<{ id: string; email: string }>(sql`
    SELECT id::text, email FROM email_contas
     WHERE tipo = 'microsoft' AND sync_status = 'active'
       AND (id = ${r.conta_id}::uuid OR (${r.conta_id}::uuid IS NULL AND usuario_id = ${r.responsavel_id}::uuid))
     ORDER BY created_at LIMIT 1`);
  if (!conta) throw new Error("o responsável não tem conta Microsoft ativa");
  console.log(`reunião "${r.titulo}" em ${new Date(r.data).toISOString()} · conta ${conta.email} · evento vinculado ${r.evento ?? "(nenhum)"}`);

  // 1. Regrava o vinculado (a criação recria se o evento não existir).
  if (aplicar) {
    const sync = await atualizarNaAgenda(r.organizacao_id, id, { convidados: true });
    console.log(sync.sincronizado ? `evento regravado: ${sync.eventId}` : `FALHA ao regravar: ${sync.aviso}`);
  } else {
    console.log(`[plano] regravar o evento ${r.evento ?? "(criar)"} com fuso America/Sao_Paulo`);
  }

  // 2. Duplicatas: mesmo assunto, mesmo calendário, organizado por esta conta, id diferente do vinculado.
  const [vinculado] = await db.execute<{ evento: string | null }>(sql`SELECT COALESCE(calendar_event_id, outlook_event_id) AS evento FROM reunioes WHERE id = ${id}::uuid`);
  const keeper = vinculado?.evento ?? null;
  const ini = new Date(Math.min(new Date(r.data).getTime(), new Date(r.created_at).getTime()) - 86_400_000);
  const fim = new Date(Math.max(new Date(r.data).getTime(), Date.now()) + 86_400_000);
  const janelaFim = new Date(Math.min(fim.getTime(), ini.getTime() + 14 * 86_400_000));
  // Todas as contas Microsoft ativas do responsável: com duas contas, a duplicata pode estar na outra.
  const contas = await db.execute<{ id: string; email: string }>(sql`
    SELECT id::text, email FROM email_contas WHERE tipo = 'microsoft' AND sync_status = 'active' AND usuario_id = ${r.responsavel_id}::uuid`);
  if (keeper && !(await lerEvento(conta.id, keeper))) console.log("AVISO: o evento vinculado não existe no Outlook (será recriado ao aplicar).");
  let achou = 0;
  for (const c of contas) {
    const eventos = await eventosNaJanela(c.id, ini.toISOString(), janelaFim.toISOString());
    const duplicados = eventos.filter((e) =>
      !(c.id === conta.id && e.id === keeper) && !e.isCancelled && norm(e.subject) === norm(r.titulo)
      && (!e.organizer?.emailAddress?.address || norm(e.organizer.emailAddress.address) === norm(c.email)));
    for (const d of duplicados) {
      achou++;
      console.log(`${aplicar ? "cancelando" : "[plano] cancelar"} duplicata ${d.id} em ${c.email} (${d.start?.dateTime} ${d.start?.timeZone ?? ""})`);
      if (aplicar) await cancelOutlookEvent(c.id, d.id, "Evento duplicado removido pelo ONFACE.");
    }
  }
  if (!achou) console.log("nenhuma duplicata encontrada");
  if (!aplicar) console.log("\nNada foi alterado. Rode de novo com --aplicar.");
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
