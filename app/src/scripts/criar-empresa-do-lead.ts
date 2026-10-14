/**
 * Lead que trouxe o nome da empresa no formulário ganha a empresa de verdade.
 *
 * `leads.empresa` guarda o que a pessoa escreveu ("Maíra cred"); `empresa_id` só
 * é preenchido se a empresa JÁ existir no instante em que o lead entra. Quem
 * entrou antes de a porta resolver a empresa (`resolverEmpresaId`) ficou só com
 * o texto: a tela casava pelo nome e mostrava "empresa vinculada", mas clicar
 * não abria nada, e a ficha da empresa não existia.
 *
 * Este script fecha o histórico pela MESMA porta que o lead novo usa hoje —
 * `resolverEmpresaId` (CNPJ > nome > domínio > cria) — e leva junto a pessoa e a
 * AQUISIÇÃO, que é de onde a ficha da empresa tira responsável, origem e
 * "Relações em andamento".
 *
 *   npx tsx --env-file=.env src/scripts/criar-empresa-do-lead.ts            # simula
 *   npx tsx --env-file=.env src/scripts/criar-empresa-do-lead.ts --aplicar
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolverEmpresaId } from "@/lib/crm/resolver-empresa";

const aplicar = process.argv.includes("--aplicar");

interface Pendente extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  empresa: string;
  email: string | null;
}

async function main() {
  const pendentes = await db.execute<Pendente>(sql`
    SELECT id::text, organizacao_id::text, btrim(empresa) AS empresa, email
      FROM leads
     WHERE empresa_id IS NULL
       AND NULLIF(btrim(empresa), '') IS NOT NULL
       AND canonical_lead_id IS NULL
     ORDER BY created_at DESC`);

  console.log(`leads com nome de empresa em texto e sem vínculo: ${pendentes.length}`);
  if (!aplicar) {
    for (const l of pendentes.slice(0, 20)) console.log(`  ${l.empresa}`);
    if (pendentes.length > 20) console.log(`  … e mais ${pendentes.length - 20}`);
    console.log("simulação — rode com --aplicar para gravar.");
    return;
  }

  let ligados = 0;
  for (const l of pendentes) {
    /* O domínio do e-mail entra como pista: `resolverEmpresaId` reconhece a
       empresa de um e-mail corporativo e NUNCA casa provedor público. */
    const dominio = l.email?.includes("@") ? l.email.split("@")[1] : null;
    const empresaId = await resolverEmpresaId({
      organizacaoId: l.organizacao_id,
      nome: l.empresa,
      website: dominio,
    });
    if (!empresaId) continue;

    await db.execute(sql`
      UPDATE leads SET empresa_id = ${empresaId}::uuid
       WHERE id = ${l.id}::uuid AND empresa_id IS NULL`);
    await db.execute(sql`
      UPDATE pessoas SET empresa_id = ${empresaId}::uuid
       WHERE organizacao_id = ${l.organizacao_id}::uuid
         AND empresa_id IS NULL AND lead_id_legado = ${l.id}::uuid`);
    await db.execute(sql`
      UPDATE aquisicoes SET empresa_id = ${empresaId}::uuid, updated_at = now()
       WHERE organizacao_id = ${l.organizacao_id}::uuid
         AND empresa_id IS NULL AND lead_legado_id = ${l.id}::uuid`);
    ligados += 1;
  }

  const [sobrou] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM leads
     WHERE empresa_id IS NULL AND NULLIF(btrim(empresa), '') IS NOT NULL
       AND canonical_lead_id IS NULL`);
  console.log(`ligados: ${ligados} · ainda sem vínculo: ${sobrou.n}`);
}

void main().then(() => process.exit(0));
