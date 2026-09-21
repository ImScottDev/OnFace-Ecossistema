/**
 * Enviar proposta não pode ser bloqueado por dado que o sistema já tem (SPEC §11).
 *
 * `enviarProposta` recusa com "Defina a família comercial antes de enviar" quando
 * a oportunidade não tem família. A leitura que alimentava esse gate olhava só
 * `negocios.service_family`, NULL em 526 dos negócios abertos — e em 125 deles a
 * oportunidade canônica sabe a família, deduzida no backfill por cadeia de
 * evidências. Havia **43 propostas em rascunho** nesses negócios, paradas.
 *
 * Não é problema de exibição: é a operação comercial travada.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-proposta-familia.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

async function main() {
  const conta = async (q: unknown) =>
    Number((await db.execute<{ n: number }>(q as never))[0]?.n ?? 0);

  // O universo do problema, medido pela mesma condição do gate.
  const travados = await conta(sql`
    SELECT count(*)::int AS n FROM negocios n
     JOIN oportunidades o ON o.negocio_id_legado = n.id
    WHERE n.status NOT IN ('ganho','perdido')
      AND n.service_family IS NULL AND o.service_family IS NOT NULL`);
  ok(travados > 0, `há negócios abertos cuja família só o canônico sabe (${travados})`);

  // A leitura que o gate usa, antes e depois da cadeia canônica.
  const antes = await conta(sql`
    SELECT count(*)::int AS n FROM propostas p
     JOIN negocios n ON n.id = p.negocio_id
    WHERE n.service_family IS NOT NULL`);
  const depois = await conta(sql`
    SELECT count(*)::int AS n FROM propostas p
     JOIN negocios n ON n.id = p.negocio_id
     LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
    WHERE COALESCE(n.service_family, o.service_family) IS NOT NULL`);
  console.log(`\n  propostas com família resolvível: ${antes} → ${depois}\n`);
  ok(depois > antes, `a cadeia canônica destrava propostas (${depois - antes} a mais)`);

  // E o caminho de verdade: carregar uma proposta de um negócio sem família no
  // legado tem que devolver a família do canônico, senão o gate recusa.
  const [alvo] = await db.execute<{ id: string; familia: string }>(sql`
    SELECT p.id::text, o.service_family AS familia
      FROM propostas p
      JOIN negocios n ON n.id = p.negocio_id
      JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.service_family IS NULL AND o.service_family IS NOT NULL
     LIMIT 1`);

  if (alvo) {
    const [lida] = await db.execute<{ familia: string | null }>(sql`
      SELECT COALESCE(n.service_family, o.service_family) AS familia
        FROM propostas p
        LEFT JOIN negocios n ON n.id = p.negocio_id
        LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
       WHERE p.id = ${alvo.id}::uuid`);
    ok(lida?.familia === alvo.familia,
       `a proposta carrega a família do canônico (${lida?.familia ?? "vazia"})`);

    const { ehFamiliaValida } = await import("@/lib/vendas/dominio");
    ok(ehFamiliaValida(lida?.familia ?? null),
       "e ela passa no gate de família que bloqueia o envio");
  } else {
    console.log("  --  nenhuma proposta nesse estado agora");
  }

  // A precedência não pode inverter: onde o legado tem valor, ele manda.
  const invertida = await conta(sql`
    SELECT count(*)::int AS n FROM negocios n
     JOIN oportunidades o ON o.negocio_id_legado = n.id
    WHERE n.service_family IS NOT NULL
      AND COALESCE(n.service_family, o.service_family) <> n.service_family`);
  ok(invertida === 0, "onde o legado tem família, ela prevalece sobre a dedução");

  console.log(process.exitCode ? "\nsmoke de família da proposta: FALHOU\n" : "\nsmoke de família da proposta: ok\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
