/**
 * O board do CRM2 mostra a família que o sistema conhece (SPEC §42).
 *
 * `negocios.service_family` é NULL em 526 dos 527 negócios abertos. Em 125
 * deles a oportunidade canônica tem a família, deduzida no backfill por cadeia
 * de evidências. O board lia só o legado e anunciava "sem família" para cards
 * cujo produto o sistema sabe qual é.
 *
 * Mede pela CONSULTA da rota, com o dado real carregado de produção.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-board-familia.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

async function main() {
  const um = async (q: unknown) => Number((await db.execute<{ n: number }>(q as never))[0]?.n ?? 0);

  const abertos = await um(sql`
    SELECT count(*)::int AS n FROM negocios WHERE status NOT IN ('ganho','perdido')`);

  // Como era: só o legado.
  const antes = await um(sql`
    SELECT count(*)::int AS n FROM negocios n
     WHERE n.status NOT IN ('ganho','perdido') AND n.service_family IS NOT NULL`);

  // Como ficou: o COALESCE que a rota agora faz.
  const depois = await um(sql`
    SELECT count(*)::int AS n FROM negocios n
     WHERE n.status NOT IN ('ganho','perdido')
       AND COALESCE(n.service_family,
             (SELECT o.service_family FROM oportunidades o
               WHERE o.negocio_id_legado = n.id LIMIT 1)) IS NOT NULL`);

  console.log(`\n  cards abertos no board: ${abertos}`);
  console.log(`  com família ANTES: ${antes}`);
  console.log(`  com família DEPOIS: ${depois}\n`);

  ok(depois > antes, `o board passa a mostrar família em mais cards (${antes} → ${depois})`);

  // O ganho é conferido contra a IDENTIDADE, não contra um número de uma carga.
  //
  // Isto travava em `depois - antes === 125`, medido numa carga de produção de
  // uma data. Desde que o DEV passou a ser recarregado com dump fresco o número
  // sobe sozinho (128 em 23/09) e o smoke acusava regressão onde só havia dado
  // novo — verificador que mente sobre o estado é pior que verificador ausente.
  //
  // A propriedade que importa não é o tamanho do ganho: é que cada card ganho
  // seja exatamente um negócio aberto sem família no legado cuja oportunidade
  // canônica tem família. Isso é verdade em qualquer carga.
  const deduzidos = await um(sql`
    SELECT count(*)::int AS n FROM negocios n
     WHERE n.status NOT IN ('ganho','perdido')
       AND n.service_family IS NULL
       AND EXISTS (SELECT 1 FROM oportunidades o
                    WHERE o.negocio_id_legado = n.id AND o.service_family IS NOT NULL)`);
  ok(depois - antes === deduzidos,
     `o ganho (${depois - antes}) é exatamente o que a dedução canônica cobre (${deduzidos})`);

  // O legado continua mandando onde tem valor: editar ganha de deduzir.
  const legadoManda = await um(sql`
    SELECT count(*)::int AS n FROM negocios n
     JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.service_family IS NOT NULL
       AND COALESCE(n.service_family, o.service_family) <> n.service_family`);
  ok(legadoManda === 0, "onde o legado tem valor, ele prevalece sobre a dedução");

  // E nenhum card duplica: a subconsulta existe por causa de bundle.
  const duplicados = await um(sql`
    SELECT count(*)::int AS n FROM (
      SELECT negocio_id_legado FROM oportunidades
       WHERE negocio_id_legado IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x`);
  ok(duplicados === 0,
     `hoje nenhum negócio tem oportunidades irmãs (${duplicados}); a subconsulta protege quando tiver`);

  console.log(process.exitCode ? "\nsmoke do board: FALHOU\n" : "\nsmoke do board: ok\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
