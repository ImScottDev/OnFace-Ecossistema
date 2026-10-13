/**
 * Resolve os vínculos Callface AI que ficaram INEQUÍVOCOS depois da eleição de
 * empresa canônica entre duplicatas (mesmo CNPJ de 14 dígitos no ONFACE).
 *
 *     pnpm tsx --env-file=.env src/scripts/resolver-duplicadas-callface-ai.ts              # simula (padrão)
 *     pnpm tsx --env-file=.env src/scripts/resolver-duplicadas-callface-ai.ts --simular    # idem
 *     pnpm tsx --env-file=.env src/scripts/resolver-duplicadas-callface-ai.ts --aplicar    # grava
 *
 * SIMULAR não escreve nada: lê o ONFACE e o SaaS (só SELECT) e imprime, por
 * empresa, o que seria vinculado e o que ficaria pendente COM O MOTIVO.
 *
 * APLICAR grava SÓ os vínculos `auto` que dependeram da eleição de canônica
 * (evidência com `canonica`). Os demais casamentos e as pendências seguem com o
 * sync normal (a cada 6h), que usa a MESMA decisão (`decidirIdentidades`).
 * Antes de qualquer escrita, numa transação única:
 *   1. cria `_bkp_callface_ai_vinculos_<AAAAMMDDHHMM>` e copia para ela as
 *      linhas de vínculo e de pendência das empresas e organizações envolvidas;
 *   2. só então grava (ON CONFLICT DO NOTHING: reexecutar não duplica; empresa
 *      já vinculada nem entra mais na lista).
 * Desfazer: apagar das tabelas originais as linhas cujo id está no backup como
 * `vinculo_novo` (o backup guarda o estado ANTERIOR e os ids criados).
 * Escreve só no banco do ONFACE; o banco do SaaS é somente leitura.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fecharConexao } from "@onface/integrations-callface-ai";
import { decidirIdentidades, gravarVinculoAuto } from "@/lib/integrations/callface-ai/identidade";

const APLICAR = process.argv.includes("--aplicar");
if (APLICAR && process.argv.includes("--simular")) {
  console.error("Use --simular OU --aplicar, não os dois.");
  process.exit(2);
}

const agoraStamp = () => new Date(Date.now() - 3 * 3600_000).toISOString().replace(/\D/g, "").slice(0, 12);

async function main() {
  console.log(APLICAR ? "MODO APLICAR (grava no ONFACE)" : "MODO SIMULAR (nada é gravado)");
  const orgs = await db.execute<{ id: string; slug: string }>(sql`SELECT id::text, slug FROM organizacoes`);
  for (const org of orgs) {
    console.log(`\n═══ ${org.slug} ═══`);
    const d = await decidirIdentidades(org.id);
    if (!d.ok) {
      console.log(`  ✘ ${d.naoConfigurado ? "CALLFACE_AI_DATABASE_URL não configurada neste ambiente." : (d.erro || "banco do Callface AI não respondeu.")}`);
      continue;
    }
    const nome = new Map(d.alvos.map((a) => [a.empresaId, a.nome]));
    const porTipo = new Map<string, number>();
    for (const x of d.decisoes) {
      const k = x.tipo === "pendente" ? `pendente:${x.sinal}` : x.tipo;
      porTipo.set(k, (porTipo.get(k) ?? 0) + 1);
    }
    console.log(`  avaliadas ${d.alvos.length} · já vinculadas ${d.jaVinculadas}`);
    for (const [k, n] of [...porTipo].sort()) console.log(`    ${k.padEnd(34)} ${n}`);

    const porCanonica = d.decisoes.flatMap((x) => (x.tipo === "auto" && x.evidencia.canonica ? [x] : []));
    console.log(`\n  VINCULOS QUE A ELEIÇÃO DE CANÔNICA DESTRAVA: ${porCanonica.length}`);
    for (const x of porCanonica) {
      const dup = (x.evidencia.canonica?.duplicadas ?? []).map((id) => nome.get(id) ?? id).join(", ");
      console.log(`    ${nome.get(x.empresaId)}  ->  ${d.nomePorOrg.get(x.orgId) ?? x.orgId}   [${x.evidencia.regra}]`);
      console.log(`      canônica: ${x.evidencia.canonica?.criterio}; duplicatas: ${dup}`);
    }
    const duplicadas = d.decisoes.flatMap((x) => (x.tipo === "pendente" && (x.sinal === "duplicada" || x.sinal === "duplicada_indecisa") ? [x] : []));
    console.log(`\n  DUPLICATAS QUE FICAM PENDENTES (com motivo): ${duplicadas.length}`);
    for (const x of duplicadas) console.log(`    [${x.sinal}] ${nome.get(x.empresaId) ?? x.empresaId}: ${x.razao}`);

    if (!APLICAR || !porCanonica.length) continue;

    const bkp = `_bkp_callface_ai_vinculos_${agoraStamp()}`;
    if (!/^_bkp_callface_ai_vinculos_\d{12}$/.test(bkp)) throw new Error("nome de backup inesperado");
    const lista = (ids: string[], tipo: "uuid" | "text") =>
      sql`ARRAY[${sql.join(ids.map((i) => (tipo === "uuid" ? sql`${i}::uuid` : sql`${i}::text`)), sql`, `)}]`;
    const empresaIds = lista(porCanonica.map((x) => x.empresaId), "uuid");
    const orgIds = lista(porCanonica.map((x) => x.orgId), "text");
    let criados = 0;
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE TABLE ${bkp} (tabela text NOT NULL, linha jsonb NOT NULL, criado_em timestamptz NOT NULL DEFAULT now())`));
      await tx.execute(sql`
        INSERT INTO ${sql.raw(bkp)} (tabela, linha)
        SELECT 'callface_ai_external_identities', to_jsonb(i) FROM callface_ai_external_identities i
         WHERE (i.entity_type = 'empresa' AND i.entity_id = ANY(${empresaIds}))
            OR (i.external_type = 'organization' AND i.external_id = ANY(${orgIds}))`);
      await tx.execute(sql`
        INSERT INTO ${sql.raw(bkp)} (tabela, linha)
        SELECT 'callface_ai_reconciliation_candidates', to_jsonb(c) FROM callface_ai_reconciliation_candidates c
         WHERE c.empresa_id = ANY(${empresaIds})`);
      for (const x of porCanonica) {
        const ok = await gravarVinculoAuto(org.id, x.empresaId, x.orgId, d.nomePorOrg.get(x.orgId) ?? null, x.evidencia, tx);
        if (ok) {
          criados++;
          await tx.execute(sql`
            INSERT INTO ${sql.raw(bkp)} (tabela, linha)
            SELECT 'vinculo_novo', jsonb_build_object('id', i.id, 'empresa_id', i.entity_id, 'organization_id', i.external_id)
              FROM callface_ai_external_identities i
             WHERE i.entity_type = 'empresa' AND i.entity_id = ${x.empresaId}::uuid AND i.external_id = ${x.orgId}`);
        }
      }
    });
    console.log(`\n  ✔ ${criados} vínculo(s) gravado(s). Backup: ${bkp}`);
  }
}

main()
  .then(async () => { await fecharConexao(); process.exit(0); })
  .catch(async (e) => { console.error(e); await fecharConexao(); process.exit(1); });
