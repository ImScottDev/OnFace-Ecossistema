/**
 * Liga à empresa as pessoas SEM empresa cujo e-mail corporativo aponta para UMA
 * única empresa da mesma organização. Mesma regra de `resolverEmpresaId`
 * (`empresaUnicaPorDominio` em app/src/lib/crm/resolver-empresa.ts): empresas do
 * domínio = site cadastrado OU e-mail de quem já está nela; provedor público
 * nunca casa; ambíguo fica para decisão humana. A decisão é de
 * `dominioCorporativo` / `empresaUnicaDoDominio` (app/src/lib/crm/dominio-empresa.ts).
 * A escrita passa pela porta `vincularPessoaEmpresa` (vínculo principal +
 * pessoas.empresa_id + evento PersonLinkedToCompany).
 *
 *   cd app
 *   ALVO_PERMITIDO='127.0.0.1:58434/callface_crm_mz' \
 *   pnpm tsx --env-file=<arquivo com DATABASE_URL> ../scripts/vincular-empresa-por-dominio.ts --org <uuid>              # dry-run (padrão)
 *   ... ../scripts/vincular-empresa-por-dominio.ts --org <uuid> [--excluir dom1,dom2] --aplicar
 *
 * Trava: DATABASE_URL tem de conter ALVO_PERMITIDO (evita rodar no banco errado).
 * Backup: tabela `_vinculo_dominio_<AAAAMMDD>` (uma linha por pessoa ligada).
 * Desfazer: ver o final da saída do --aplicar.
 */
import { sql } from "../app/node_modules/drizzle-orm"; // resolve a partir de scripts/ (a dependência mora em app/)
import { db, fecharConexao } from "../app/src/lib/db";
import { dominioCorporativo, empresaUnicaDoDominio } from "../app/src/lib/crm/dominio-empresa";
import { vincularPessoaEmpresa } from "../app/src/lib/vendas/identidade";
import { ATOR_SISTEMA } from "../app/src/lib/vendas/dominio";

const ARG = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const EXCLUIR = new Set((ARG("--excluir") ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)); // domínios que vão para decisão humana
const APLICAR = process.argv.includes("--aplicar");
const ORG = ARG("--org");
const ALVO = process.env.ALVO_PERMITIDO;
if (!ORG || !/^[0-9a-f-]{36}$/.test(ORG)) { console.error("--org <uuid> é obrigatório"); process.exit(2); }
if (!ALVO || !(process.env.DATABASE_URL ?? "").includes(ALVO)) { console.error("ALVO_PERMITIDO ausente ou não bate com DATABASE_URL. Abortado."); process.exit(2); }

const REF = "vincular-empresa-por-dominio";
const dia = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
const BKP = `_vinculo_dominio_${dia}`;

async function main() {
  const [{ db: banco }] = await db.execute<{ db: string }>(sql`SELECT current_database() AS db`);
  console.log(`${APLICAR ? "APLICAR" : "DRY-RUN"} em ${banco} (org ${ORG})`);

  // 1. Candidatas por domínio: site da empresa + e-mail de quem já está nela (texto idêntico ao resolvedor).
  const cand = new Map<string, string[]>();
  const add = (d: string, id: string) => cand.set(d, [...(cand.get(d) ?? []), id]);
  for (const r of await db.execute<{ d: string; id: string }>(sql`
    SELECT regexp_replace(lower(coalesce(e.website, '')), '^(https?://)?(www\\.)?|/.*$', '', 'g') AS d, e.id::text AS id
      FROM empresas e WHERE e.organizacao_id = ${ORG}::uuid AND coalesce(e.website, '') <> ''`)) add(r.d, r.id);
  for (const r of await db.execute<{ d: string; id: string }>(sql`
    SELECT DISTINCT lower(split_part(p.email, '@', 2)) AS d, p.empresa_id::text AS id
      FROM pessoas p WHERE p.organizacao_id = ${ORG}::uuid AND p.empresa_id IS NOT NULL AND position('@' in coalesce(p.email,'')) > 0`)) add(r.d, r.id);

  // 2. Pessoas sem empresa (nem pessoas.empresa_id nem vínculo ativo) com e-mail.
  const sem = await db.execute<{ id: string; email: string }>(sql`
    SELECT p.id::text AS id, p.email FROM pessoas p
     WHERE p.organizacao_id = ${ORG}::uuid AND p.empresa_id IS NULL AND position('@' in coalesce(p.email,'')) > 0
       AND NOT EXISTS (SELECT 1 FROM pessoa_empresa_vinculos v WHERE v.pessoa_id = p.id AND v.encerrado_em IS NULL)`);
  const alias = new Set((await db.execute<{ id: string }>(sql`
    SELECT id::text FROM empresas WHERE organizacao_id = ${ORG}::uuid AND canonical_empresa_id IS NOT NULL`)).map((r) => r.id));

  const c = { sem_empresa_com_email: sem.length, dominio_publico_ou_invalido: 0, sem_candidata: 0, ambigua: 0, alvo_e_alias: 0, excluido_a_mao: 0 };
  const alvo: { pessoa: string; empresa: string; dominio: string }[] = [];
  for (const p of sem) {
    const d = dominioCorporativo(p.email);
    if (!d) { c.dominio_publico_ou_invalido++; continue; }
    if (EXCLUIR.has(d)) { c.excluido_a_mao++; continue; }
    const ids = [...new Set(cand.get(d) ?? [])];
    if (ids.length === 0) { c.sem_candidata++; continue; }
    const unica = empresaUnicaDoDominio(d, ids);
    if (!unica) { c.ambigua++; continue; }
    if (alias.has(unica)) { c.alvo_e_alias++; continue; }   // ponytail: alias de empresa mesclada fica para humano
    alvo.push({ pessoa: p.id, empresa: unica, dominio: d });
  }
  console.log(JSON.stringify({ ...c, seriam_vinculadas: alvo.length }, null, 2));
  const porDominio = new Map<string, { n: number; empresa: string }>();
  for (const a of alvo) porDominio.set(a.dominio, { n: (porDominio.get(a.dominio)?.n ?? 0) + 1, empresa: a.empresa });
  const nomes = new Map((await db.execute<{ id: string; nome: string }>(sql`SELECT id::text, nome FROM empresas WHERE organizacao_id = ${ORG}::uuid`)).map((r) => [r.id, r.nome]));
  console.log("Maiores domínios:", [...porDominio].sort((x, y) => y[1].n - x[1].n).slice(0, 15)
    .map(([d, v]) => `${d} -> ${nomes.get(v.empresa)} (${v.n})`).join("\n  "));
  if (!APLICAR) { console.log("Dry-run: nada foi gravado."); return; }

  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${BKP} (
    pessoa_id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, empresa_id uuid NOT NULL, dominio text NOT NULL,
    feito_em timestamptz NOT NULL DEFAULT now())`));
  const inicio = new Date().toISOString();
  let feitas = 0;
  for (let i = 0; i < alvo.length; i += 50) {
    const lote = alvo.slice(i, i + 50);
    await db.transaction(async (tx) => {
      for (const a of lote) {
        // reconfere dentro da transação: quem ganhou empresa nesse meio-tempo não é tocada
        const ok = await tx.execute(sql`
          SELECT 1 FROM pessoas p WHERE p.id = ${a.pessoa}::uuid AND p.organizacao_id = ${ORG}::uuid AND p.empresa_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM pessoa_empresa_vinculos v WHERE v.pessoa_id = p.id AND v.encerrado_em IS NULL)`);
        if (ok.length === 0) continue;
        await tx.execute(sql`INSERT INTO ${sql.raw(BKP)} (pessoa_id, organizacao_id, empresa_id, dominio)
                             VALUES (${a.pessoa}::uuid, ${ORG}::uuid, ${a.empresa}::uuid, ${a.dominio}) ON CONFLICT DO NOTHING`);
        await vincularPessoaEmpresa({ organizacaoId: ORG!, pessoaId: a.pessoa, empresaId: a.empresa, papel: "contato_principal",
          principal: true, ator: { ...ATOR_SISTEMA, ref: REF } }, tx);
        feitas++;
      }
    });
  }
  console.log(`Vinculadas: ${feitas}. Backup: tabela ${BKP}.`);
  console.log(`DESFAZER (uma transação):
  DELETE FROM vendas_eventos WHERE organizacao_id='${ORG}' AND tipo='PersonLinkedToCompany' AND ator_ref='${REF}' AND ocorrido_em >= '${inicio}';
  DELETE FROM pessoa_empresa_vinculos v USING ${BKP} b WHERE v.pessoa_id=b.pessoa_id AND v.empresa_id=b.empresa_id AND v.organizacao_id=b.organizacao_id;
  UPDATE pessoas p SET empresa_id=NULL, updated_at=now() FROM ${BKP} b WHERE p.id=b.pessoa_id AND p.empresa_id=b.empresa_id AND p.organizacao_id=b.organizacao_id;`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => fecharConexao());
