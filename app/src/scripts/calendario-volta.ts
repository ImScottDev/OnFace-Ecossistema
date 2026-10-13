/**
 * Roda UMA vez a volta Outlook -> ONFACE (assinatura + delta) e mostra o estado
 * por conta. O worker faz o mesmo a cada 5 min; use isto para criar as
 * assinaturas logo após o deploy e conferir o resultado.
 *
 *     pnpm tsx --env-file=.env src/scripts/calendario-volta.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sincronizarVoltaMicrosoft } from "@/lib/calendario/volta";

async function main() {
  console.log("MICROSOFT_CALENDAR_CLIENT_STATE:", process.env.MICROSOFT_CALENDAR_CLIENT_STATE ? "definido" : "AUSENTE (só delta; a rota recusa notificações)");
  console.log(await sincronizarVoltaMicrosoft());
  const linhas = await db.execute(sql`
    SELECT ec.email, a.subscription_id IS NOT NULL AS assinada, a.expira_em, a.ultimo_delta_em, a.ultimo_erro
      FROM calendario_assinaturas a JOIN email_contas ec ON ec.id = a.conta_id ORDER BY ec.email`);
  console.table(linhas);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
