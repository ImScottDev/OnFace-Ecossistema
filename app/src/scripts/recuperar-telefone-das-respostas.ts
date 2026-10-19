/**
 * Devolve ao lead o telefone que ficou parado nas respostas do formulário.
 *
 * O normalizador casava o campo do formulário por igualdade exata, e a
 * campanha White Label pergunta "número_do_whatsapp" — nenhum sinônimo
 * casava, então o lead entrava sem telefone e o número ficava em
 * `campos_custom`. A entrada já foi corrigida (packages/integrations/meta);
 * este script é para quem JÁ entrou.
 *
 * Só escreve em lead que está sem telefone E sem whatsapp: não sobrescreve
 * nada que alguém tenha digitado depois.
 *
 *   npx tsx --env-file=.env src/scripts/recuperar-telefone-das-respostas.ts         # mostra
 *   npx tsx --env-file=.env src/scripts/recuperar-telefone-das-respostas.ts --gravar
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Mesma regra da entrada: a chave CONTÉM o sinônimo, sem acento atrapalhar. */
const SINONIMOS = ["phone_number", "telefone", "celular", "whatsapp", "phone"];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digitos = (v: string) => (v.match(/\d/g) ?? []).length;

function telefoneDasRespostas(respostas: Record<string, unknown> | null): string | null {
  if (!respostas) return null;
  for (const [chave, valor] of Object.entries(respostas)) {
    if (typeof valor !== "string" || digitos(valor) < 8) continue;
    const k = semAcento(chave);
    if (SINONIMOS.some((n) => k.includes(semAcento(n)))) return valor.trim();
  }
  return null;
}

async function main() {
  const gravar = process.argv.includes("--gravar");

  const linhas = await db.execute<{ id: string; nome: string | null; campanha: string | null; campos: Record<string, unknown> | null }>(sql`
    SELECT id::text, nome, utm_campaign AS campanha, campos_custom AS campos
      FROM leads
     WHERE COALESCE(telefone, '') = '' AND COALESCE(whatsapp, '') = ''
       AND campos_custom IS NOT NULL AND campos_custom <> '{}'::jsonb`);

  const achados = linhas
    .map((l) => ({ ...l, telefone: telefoneDasRespostas(l.campos) }))
    .filter((l): l is typeof l & { telefone: string } => Boolean(l.telefone));

  console.log(`${linhas.length} leads sem telefone com respostas; ${achados.length} têm número guardado.`);
  for (const l of achados.slice(0, 20)) {
    console.log(`  ${l.id}  ${l.nome ?? "—"}  ${l.telefone}  ${l.campanha ?? ""}`);
  }
  if (achados.length > 20) console.log(`  ... e mais ${achados.length - 20}`);

  if (!gravar) {
    console.log("\nNada gravado. Rode com --gravar para aplicar.");
    return;
  }

  for (const l of achados) {
    await db.execute(sql`
      UPDATE leads SET telefone = ${l.telefone}, updated_at = now()
       WHERE id = ${l.id}::uuid AND COALESCE(telefone, '') = '' AND COALESCE(whatsapp, '') = ''`);
  }
  console.log(`\n${achados.length} leads voltaram a ter telefone.`);
}

await main();
process.exit(0);
