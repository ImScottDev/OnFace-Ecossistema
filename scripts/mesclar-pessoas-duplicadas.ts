/**
 * Mescla de PESSOAS duplicadas, só com prova forte, com backup e log de cada linha repontada.
 * Regra de desempate = a do diagnóstico (scripts/diagnostico-contatos-duplicados.sql, seção 1:
 * colunas `sugestao`/`porque`); esta script LÊ os pares dessa mesma consulta, não tem regra própria.
 *
 *   cd app
 *   ALVO_PERMITIDO='127.0.0.1:58434/callface_crm_mz' \
 *   pnpm tsx --env-file=<arquivo com DATABASE_URL> ../scripts/mesclar-pessoas-duplicadas.ts --org <uuid>                # dry-run (padrão)
 *   ... --org <uuid> --aplicar [--limite N]     grava (lotes de 50 pares em transação)
 *   ... --org <uuid> --desfazer [--limite N]    devolve os últimos N pares mesclados (mais recentes primeiro)
 *
 * PROVA FORTE (executa):
 *   A. `mescla_de_leads`: o lead de uma das pessoas já foi mesclado no da outra (decisão de 13/10).
 *   B. e-mail E telefone iguais (e primeiro nome compatível). Sem pseudo-e-mail, sem central (5+ pessoas).
 * Tudo o mais (só telefone, só e-mail, primeiro nome diferente, corrente A-B-C, lead sem par) FICA
 * LISTADO para decisão humana e nunca é executado.
 *
 * Backup (mesmo banco; criadas na 1ª gravação):
 *   _mescla_homolog_<AAAAMMDD>            uma linha por par (pessoa que saiu e a que fica ANTES, lead, aquisições)
 *   _mescla_homolog_<AAAAMMDD>_refs       uma linha por linha repontada (tabela, coluna, id da linha)
 *   _mescla_homolog_<AAAAMMDD>_descartes  linhas que colidiram com índice único (ex.: vínculo repetido), inteiras em jsonb
 * Trava: DATABASE_URL tem de conter ALVO_PERMITIDO.
 */
import { readFileSync } from "node:fs";
import { sql, type SQL } from "../app/node_modules/drizzle-orm"; // resolve a partir de scripts/ (a dependência mora em app/)
import { db, fecharConexao } from "../app/src/lib/db";

const ARG = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const APLICAR = process.argv.includes("--aplicar");
const DESFAZER = process.argv.includes("--desfazer");
const LIMITE = ARG("--limite") ? parseInt(ARG("--limite")!, 10) : Infinity;
const ORG = ARG("--org");
const ALVO = process.env.ALVO_PERMITIDO;
if (!ORG || !/^[0-9a-f-]{36}$/.test(ORG)) { console.error("--org <uuid> é obrigatório"); process.exit(2); }
if (!ALVO || !(process.env.DATABASE_URL ?? "").includes(ALVO)) { console.error("ALVO_PERMITIDO ausente ou não bate com DATABASE_URL. Abortado."); process.exit(2); }

const dia = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
const BK = `_mescla_homolog_${dia}`, REFS = `${BK}_refs`, DESC = `${BK}_descartes`;
const id = (s: string) => { if (!/^[a-z_0-9]+$/.test(s)) throw new Error(`identificador suspeito: ${s}`); return sql.raw(`"${s}"`); };
const codigo = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

type Par = { id_a: string; id_b: string; motivos: string; sugestao: "A" | "B"; porque: string; nome_a: string; nome_b: string; email_a: string | null; email_b: string | null; tel_a: string | null; tel_b: string | null };
type Escolhido = { fica: string; sai: string; cat: "mescla_de_leads" | "email+telefone"; porque: string; par: Par };
type Spec = { tabela: string; coluna: string; pk: string; temOrg: boolean; extra?: SQL };

/* ── pares: a MESMA consulta da seção 1 do diagnóstico ───────────────────── */
async function pares(): Promise<Par[]> {
  const txt = readFileSync(new URL("./diagnostico-contatos-duplicados.sql", import.meta.url), "utf8");
  const ini = txt.indexOf("WITH\npes AS (");
  const fim = txt.indexOf("pa.nome;", ini);
  if (ini < 0 || fim < 0) throw new Error("não achei a consulta da seção 1 no diagnóstico");
  const q = txt.slice(ini, fim + "pa.nome".length).replaceAll(":'org'", `'${ORG}'`);
  return [...(await db.execute(sql.raw(q)))] as unknown as Par[];
}
const sem = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().split(/\s+/)[0] ?? "";
const nomeCompativel = (a: string, b: string) => { const x = sem(a), y = sem(b); return x.length > 1 && y.length > 1 && (x.startsWith(y) || y.startsWith(x)); };

async function classificar(ps: Par[]) {
  const uso = new Map<string, number>();
  for (const p of ps) for (const i of [p.id_a, p.id_b]) uso.set(i, (uso.get(i) ?? 0) + 1);
  const leads = new Map((await db.execute<{ id: string; lead: string | null }>(sql`
    SELECT id::text, lead_id_legado::text AS lead FROM pessoas WHERE organizacao_id = ${ORG}::uuid`)).map((r) => [r.id, r.lead]));
  const ok: Escolhido[] = [];
  const revisao: { par: Par; motivo: string }[] = [];
  for (const p of ps) {
    const m = p.motivos;
    const fica = p.sugestao === "A" ? p.id_a : p.id_b, sai = p.sugestao === "A" ? p.id_b : p.id_a;
    const base = { fica, sai, par: p, porque: p.porque };
    if ((uso.get(p.id_a) ?? 0) > 1 || (uso.get(p.id_b) ?? 0) > 1) { revisao.push({ par: p, motivo: "corrente: pessoa em mais de um par" }); continue; }
    const cat = m.includes("mescla_de_leads") ? "mescla_de_leads" : m.includes("email") && m.includes("telefone") ? "email+telefone" : null;
    if (!cat) { revisao.push({ par: p, motivo: m.includes("email") ? "só e-mail" : "só telefone" }); continue; }
    if (cat === "email+telefone" && !nomeCompativel(p.nome_a, p.nome_b)) { revisao.push({ par: p, motivo: "primeiro nome diferente" }); continue; }
    if (leads.get(sai) && !leads.get(fica)) { revisao.push({ par: p, motivo: "quem fica não tem lead e quem sai tem" }); continue; }
    ok.push({ ...base, cat });
  }
  return { ok, revisao };
}

/* ── FKs para pessoas, lidas do catálogo (pega FK nova sozinho) ─────────── */
async function specs(): Promise<Spec[]> {
  const rs = await db.execute<{ tabela: string; coluna: string; pk: string | null; tem_org: boolean }>(sql`
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna,
           (SELECT pa.attname FROM pg_constraint p JOIN pg_attribute pa ON pa.attrelid = p.conrelid AND pa.attnum = p.conkey[1]
             WHERE p.conrelid = c.conrelid AND p.contype = 'p' AND array_length(p.conkey, 1) = 1) AS pk,
           EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema='public' AND k.table_name = c.conrelid::regclass::text AND k.column_name='organizacao_id') AS tem_org
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'pessoas'::regclass AND array_length(c.conkey, 1) = 1 AND c.conrelid <> 'pessoas'::regclass`);
  const out: Spec[] = rs.map((r) => {
    if (!r.pk) throw new Error(`${r.tabela} sem chave primária simples: não sei registrar a linha`);
    return { tabela: r.tabela, coluna: r.coluna, pk: r.pk, temOrg: r.tem_org };
  });
  // polimórficos (sem FK): o id da pessoa aparece em coluna genérica
  out.push({ tabela: "backfill_provenance", coluna: "id_canonico", pk: "id", temOrg: true, extra: sql`AND entidade_canonica = 'pessoa'` });
  out.push({ tabela: "file_links", coluna: "entity_id", pk: "id", temOrg: true, extra: sql`AND entity_type = 'pessoa'` });
  return out;
}
const onde = (s: Spec, sai: string) => sql`${id(s.coluna)} = ${sai}::uuid ${s.temOrg ? sql`AND organizacao_id = ${ORG}::uuid` : sql``} ${s.extra ?? sql``}`;

/* ── dry-run ─────────────────────────────────────────────────────────────── */
async function relatorio(ok: Escolhido[], revisao: { par: Par; motivo: string }[], total: number) {
  const por = (xs: string[]) => xs.reduce<Record<string, number>>((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {});
  console.log(JSON.stringify({ pares_no_diagnostico: total, executaria: ok.length, por_categoria: por(ok.map((o) => o.cat)),
    fica_para_decisao_humana: revisao.length, por_motivo: por(revisao.map((r) => r.motivo)) }, null, 2));
  const arr = `{${ok.map((o) => o.sai).join(",")}}`;
  const linhas: Record<string, number> = {};
  for (const s of await specs()) {
    const [{ n }] = await db.execute<{ n: string }>(sql`SELECT count(*) AS n FROM ${id(s.tabela)} WHERE ${id(s.coluna)} = ANY(${arr}::uuid[]) ${s.extra ?? sql``}`);
    if (Number(n) > 0) linhas[`${s.tabela}.${s.coluna}`] = Number(n);
  }
  console.log("Linhas que seriam repontadas (por tabela.coluna):", JSON.stringify(linhas, null, 2));
}

/* ── um par ──────────────────────────────────────────────────────────────── */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function repontar(tx: Tx, s: Spec, fica: string, sai: string) {
  try {
    await tx.transaction(async (sp) => {
      await sp.execute(sql`
        WITH mv AS (UPDATE ${id(s.tabela)} SET ${id(s.coluna)} = ${fica}::uuid WHERE ${onde(s, sai)} RETURNING ${id(s.pk)}::text AS pk)
        INSERT INTO ${id(REFS)} (organizacao_id, fica, sai, tabela, coluna, pk, linha_id)
        SELECT ${ORG}::uuid, ${fica}::uuid, ${sai}::uuid, ${s.tabela}, ${s.coluna}, ${s.pk}, pk FROM mv`);
    });
  } catch (e) {
    if (codigo(e) !== "23505") throw e;
    // colidiu com índice único (a pessoa que fica já tem a mesma linha): linha a linha; a repetida vai inteira para o backup e sai
    const linhas = await tx.execute<{ pk: string }>(sql`SELECT ${id(s.pk)}::text AS pk FROM ${id(s.tabela)} WHERE ${onde(s, sai)}`);
    for (const { pk } of linhas) {
      try {
        await tx.transaction(async (sp) => {
          await sp.execute(sql`UPDATE ${id(s.tabela)} SET ${id(s.coluna)} = ${fica}::uuid WHERE ${id(s.pk)}::text = ${pk}`);
          await sp.execute(sql`INSERT INTO ${id(REFS)} (organizacao_id, fica, sai, tabela, coluna, pk, linha_id) VALUES (${ORG}::uuid, ${fica}::uuid, ${sai}::uuid, ${s.tabela}, ${s.coluna}, ${s.pk}, ${pk})`);
        });
      } catch (e2) {
        if (codigo(e2) !== "23505") throw e2;
        await tx.execute(sql`INSERT INTO ${id(DESC)} (organizacao_id, fica, sai, tabela, coluna, pk, linha_id, linha)
          SELECT ${ORG}::uuid, ${fica}::uuid, ${sai}::uuid, ${s.tabela}, ${s.coluna}, ${s.pk}, ${pk}, to_jsonb(t.*) FROM ${id(s.tabela)} t WHERE ${id(s.pk)}::text = ${pk}`);
        await tx.execute(sql`DELETE FROM ${id(s.tabela)} WHERE ${id(s.pk)}::text = ${pk}`);
      }
    }
  }
}

async function mesclarPar(tx: Tx, e: Escolhido, ss: Spec[]) {
  const [duas] = await tx.execute<{ n: string }>(sql`SELECT count(*) AS n FROM pessoas WHERE organizacao_id = ${ORG}::uuid AND id IN (${e.fica}::uuid, ${e.sai}::uuid)`);
  if (Number(duas.n) !== 2) throw new Error("uma das pessoas não existe mais nesta organização");

  // backup do par, ANTES de qualquer mudança
  await tx.execute(sql`
    INSERT INTO ${id(BK)} (organizacao_id, fica, sai, categoria, porque, pessoa_sai, pessoa_fica_antes, lead_sai, aquisicoes_sai, lead_fica_antes, pontos_contato_fica_antes)
    SELECT ${ORG}::uuid, f.id, s.id, ${e.cat}, ${e.porque}, to_jsonb(s.*), to_jsonb(f.*),
           (SELECT to_jsonb(l.*) FROM leads l WHERE l.id = s.lead_id_legado),
           (SELECT jsonb_agg(to_jsonb(a.*)) FROM aquisicoes a WHERE a.lead_legado_id = s.lead_id_legado),
           (SELECT to_jsonb(l.*) FROM leads l WHERE l.id = f.lead_id_legado),
           (SELECT jsonb_agg(jsonb_build_object('id', pc.id, 'first', pc.is_first_touch, 'last', pc.is_last_touch)) FROM pontos_contato pc WHERE pc.pessoa_id IN (f.id, s.id))
      FROM pessoas f, pessoas s WHERE f.id = ${e.fica}::uuid AND s.id = ${e.sai}::uuid
    ON CONFLICT (sai) DO UPDATE SET fica = EXCLUDED.fica, categoria = EXCLUDED.categoria, porque = EXCLUDED.porque, pessoa_sai = EXCLUDED.pessoa_sai,
      pessoa_fica_antes = EXCLUDED.pessoa_fica_antes, lead_sai = EXCLUDED.lead_sai, aquisicoes_sai = EXCLUDED.aquisicoes_sai,
      lead_fica_antes = EXCLUDED.lead_fica_antes, pontos_contato_fica_antes = EXCLUDED.pontos_contato_fica_antes, feito_em = now(), desfeito_em = NULL`);

  // lead: quem sai some da lista; o lead dela passa a apontar para o de quem fica (convenção do script de 13/10)
  const [{ lf, ls, canon }] = await tx.execute<{ lf: string | null; ls: string | null; canon: string | null }>(sql`
    SELECT f.lead_id_legado::text AS lf, s.lead_id_legado::text AS ls, l.canonical_lead_id::text AS canon
      FROM pessoas f, pessoas s LEFT JOIN leads l ON l.id = s.lead_id_legado
     WHERE f.id = ${e.fica}::uuid AND s.id = ${e.sai}::uuid`);
  if (ls && lf && ls !== lf && !canon) {
    await tx.execute(sql`UPDATE leads f SET campos_custom = coalesce(s.campos_custom,'{}') || coalesce(f.campos_custom,'{}'), updated_at = now()
                          FROM leads s WHERE f.id = ${lf}::uuid AND s.id = ${ls}::uuid AND f.organizacao_id = ${ORG}::uuid`);
    await tx.execute(sql`
      WITH mv AS (UPDATE leads SET canonical_lead_id = ${lf}::uuid, updated_at = now()
                   WHERE organizacao_id = ${ORG}::uuid AND (id = ${ls}::uuid OR canonical_lead_id = ${ls}::uuid) RETURNING id::text AS pk)
      INSERT INTO ${id(REFS)} (organizacao_id, fica, sai, tabela, coluna, pk, linha_id)
      SELECT ${ORG}::uuid, ${e.fica}::uuid, ${e.sai}::uuid, 'leads', 'canonical_lead_id', 'id', pk FROM mv`);
    await tx.execute(sql`
      WITH mv AS (UPDATE aquisicoes SET closed_at = now(), motivo_desqualificacao = 'duplicada: mesclada no lead ' || ${lf}, updated_at = now()
                   WHERE organizacao_id = ${ORG}::uuid AND lead_legado_id = ${ls}::uuid AND closed_at IS NULL RETURNING id::text AS pk)
      INSERT INTO ${id(REFS)} (organizacao_id, fica, sai, tabela, coluna, pk, linha_id)
      SELECT ${ORG}::uuid, ${e.fica}::uuid, ${e.sai}::uuid, 'aquisicoes', 'closed_at', 'id', pk FROM mv`);
  }

  // campos vazios de quem fica são completados com os de quem sai (preenchido nos dois NÃO é sobrescrito)
  await tx.execute(sql`
    UPDATE pessoas f SET sobrenome = coalesce(nullif(f.sobrenome,''), s.sobrenome), email = coalesce(nullif(f.email,''), s.email),
           telefone = coalesce(nullif(f.telefone,''), s.telefone), whatsapp = coalesce(nullif(f.whatsapp,''), s.whatsapp),
           cargo = coalesce(nullif(f.cargo,''), s.cargo), empresa_id = coalesce(f.empresa_id, s.empresa_id), updated_at = now()
      FROM pessoas s WHERE f.id = ${e.fica}::uuid AND s.id = ${e.sai}::uuid AND f.organizacao_id = ${ORG}::uuid`);

  for (const s of ss) await repontar(tx, s, e.fica, e.sai);

  // um só vínculo principal ativo por pessoa: o que veio de quem saiu perde a marca se quem fica já tinha
  await tx.execute(sql`
    UPDATE pessoa_empresa_vinculos v SET principal = false, updated_at = now()
     WHERE v.pessoa_id = ${e.fica}::uuid AND v.principal AND v.encerrado_em IS NULL
       AND v.id::text IN (SELECT linha_id FROM ${id(REFS)} WHERE sai = ${e.sai}::uuid AND tabela = 'pessoa_empresa_vinculos')
       AND EXISTS (SELECT 1 FROM pessoa_empresa_vinculos o WHERE o.pessoa_id = v.pessoa_id AND o.principal AND o.encerrado_em IS NULL
                      AND o.id::text NOT IN (SELECT linha_id FROM ${id(REFS)} WHERE sai = ${e.sai}::uuid AND tabela = 'pessoa_empresa_vinculos'))`);
  // primeiro/último contato recalculados sobre o conjunto junto
  await tx.execute(sql`
    UPDATE pontos_contato pc SET is_first_touch = (pc.id = x.primeiro), is_last_touch = (pc.id = x.ultimo)
      FROM (SELECT (array_agg(id ORDER BY ocorrido_em ASC, id))[1] AS primeiro, (array_agg(id ORDER BY ocorrido_em DESC, id))[1] AS ultimo
              FROM pontos_contato WHERE pessoa_id = ${e.fica}::uuid) x
     WHERE pc.pessoa_id = ${e.fica}::uuid`);

  await tx.execute(sql`DELETE FROM pessoas WHERE id = ${e.sai}::uuid AND organizacao_id = ${ORG}::uuid`);
}

async function criarBackup() {
  const T = (n: string) => sql.raw(`"${n}"`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ${T(BK)} (
    organizacao_id uuid NOT NULL, fica uuid NOT NULL, sai uuid PRIMARY KEY, categoria text NOT NULL, porque text,
    pessoa_sai jsonb NOT NULL, pessoa_fica_antes jsonb NOT NULL, lead_sai jsonb, aquisicoes_sai jsonb, lead_fica_antes jsonb,
    pontos_contato_fica_antes jsonb, feito_em timestamptz NOT NULL DEFAULT now(), desfeito_em timestamptz)`);
  const log = `organizacao_id uuid NOT NULL, fica uuid NOT NULL, sai uuid NOT NULL, tabela text NOT NULL, coluna text NOT NULL, pk text NOT NULL, linha_id text NOT NULL`;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ${T(REFS)} (${sql.raw(log)}, feito_em timestamptz NOT NULL DEFAULT now())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS ${T(DESC)} (${sql.raw(log)}, linha jsonb NOT NULL, feito_em timestamptz NOT NULL DEFAULT now())`);
}

async function aplicar(ok: Escolhido[]) {
  await criarBackup();
  const ss = await specs();
  const alvo = ok.slice(0, LIMITE);
  let feitos = 0; const falhas: { sai: string; erro: string }[] = [];
  for (let i = 0; i < alvo.length; i += 50) {
    await db.transaction(async (tx) => {
      for (const e of alvo.slice(i, i + 50)) {
        try { await tx.transaction((sp) => mesclarPar(sp, e, ss)); feitos++; }
        catch (err) { falhas.push({ sai: e.sai, erro: String((err as Error).message).slice(0, 200) }); }  // o par volta inteiro (savepoint)
      }
    });
    console.log(`lote ${i / 50 + 1}: acumulado ${feitos} mesclados, ${falhas.length} falhas`);
  }
  console.log(`Mesclados: ${feitos}. Falhas (pares intactos): ${JSON.stringify(falhas)}`);
  console.log(`Backup: ${BK}, ${REFS}, ${DESC}. Desfazer: --desfazer [--limite N].`);
}

/* ── desfazer: devolve os últimos N pares (mais recentes primeiro) ───────── */
async function desfazer() {
  const R = sql.raw(`"${REFS}"`), B = sql.raw(`"${BK}"`), D = sql.raw(`"${DESC}"`);
  const lista = await db.execute<{ sai: string; fica: string }>(sql`SELECT sai::text, fica::text FROM ${B} WHERE desfeito_em IS NULL AND organizacao_id = ${ORG}::uuid ORDER BY feito_em DESC LIMIT ${Number.isFinite(LIMITE) ? LIMITE : 1000000}`);
  let n = 0;
  for (const { sai, fica } of lista) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO pessoas SELECT (jsonb_populate_record(NULL::pessoas, pessoa_sai)).* FROM ${B} WHERE sai = ${sai}::uuid`);
      for (const r of await tx.execute<{ tabela: string; coluna: string; pk: string }>(sql`SELECT DISTINCT tabela, coluna, pk FROM ${R} WHERE sai = ${sai}::uuid`)) {
        if (r.tabela === "leads") {   // o lead que saiu volta sem canônico; os que apontavam para ele voltam a apontar
          await tx.execute(sql`UPDATE leads l SET canonical_lead_id = CASE WHEN l.id = ls.id THEN NULL ELSE ls.id END, updated_at = now()
                                FROM ${R} x, (SELECT (lead_sai->>'id')::uuid AS id FROM ${B} WHERE sai = ${sai}::uuid) ls
                               WHERE x.sai = ${sai}::uuid AND x.tabela = 'leads' AND l.id::text = x.linha_id`);
        } else if (r.tabela === "aquisicoes" && r.coluna === "closed_at") {
          await tx.execute(sql`UPDATE aquisicoes a SET closed_at = NULL, motivo_desqualificacao = NULL, updated_at = now() FROM ${R} x WHERE x.sai = ${sai}::uuid AND x.tabela='aquisicoes' AND x.coluna='closed_at' AND a.id::text = x.linha_id`);
        } else {
          await tx.execute(sql`UPDATE ${id(r.tabela)} t SET ${id(r.coluna)} = ${sai}::uuid FROM ${R} x
                                WHERE x.sai = ${sai}::uuid AND x.tabela = ${r.tabela} AND x.coluna = ${r.coluna} AND t.${id(r.pk)}::text = x.linha_id`);
        }
      }
      for (const d of await tx.execute<{ tabela: string }>(sql`SELECT DISTINCT tabela FROM ${D} WHERE sai = ${sai}::uuid`)) {
        await tx.execute(sql`INSERT INTO ${id(d.tabela)} SELECT (jsonb_populate_record(NULL::${id(d.tabela)}, linha)).* FROM ${D} WHERE sai = ${sai}::uuid AND tabela = ${d.tabela}`);
      }
      await tx.execute(sql`UPDATE leads l SET campos_custom = nullif(b.lead_fica_antes->'campos_custom', 'null'::jsonb) FROM ${B} b WHERE b.sai = ${sai}::uuid AND l.id = (b.lead_fica_antes->>'id')::uuid AND b.lead_sai IS NOT NULL AND (b.lead_sai->>'canonical_lead_id') IS NULL AND EXISTS (SELECT 1 FROM ${R} x WHERE x.sai = b.sai AND x.tabela = 'leads')`);
      await tx.execute(sql`UPDATE pessoas f SET sobrenome = a.sobrenome, email = a.email, telefone = a.telefone, whatsapp = a.whatsapp, cargo = a.cargo, empresa_id = a.empresa_id, updated_at = a.updated_at
                            FROM ${B} b, jsonb_populate_record(NULL::pessoas, b.pessoa_fica_antes) a WHERE b.sai = ${sai}::uuid AND f.id = ${fica}::uuid`);
      await tx.execute(sql`UPDATE pontos_contato pc SET is_first_touch = (e->>'first')::boolean, is_last_touch = (e->>'last')::boolean
                            FROM ${B} b, jsonb_array_elements(b.pontos_contato_fica_antes) e WHERE b.sai = ${sai}::uuid AND pc.id = (e->>'id')::uuid`);
      await tx.execute(sql`UPDATE ${B} SET desfeito_em = now() WHERE sai = ${sai}::uuid`);
      await tx.execute(sql`DELETE FROM ${R} WHERE sai = ${sai}::uuid`);
      await tx.execute(sql`DELETE FROM ${D} WHERE sai = ${sai}::uuid`);
    });
    n++;
  }
  console.log(`Desfeitos: ${n} pares.`);
}

async function main() {
  const [{ banco }] = await db.execute<{ banco: string }>(sql`SELECT current_database() AS banco`);
  console.log(`${DESFAZER ? "DESFAZER" : APLICAR ? "APLICAR" : "DRY-RUN"} em ${banco} (org ${ORG})`);
  if (DESFAZER) return desfazer();
  const ps = await pares();
  const { ok, revisao } = await classificar(ps);
  await relatorio(ok, revisao, ps.length);
  console.log("REVISAO_HUMANA_CSV_INICIO\npar,motivo_da_revisao,nome_a,email_a,tel_a,nome_b,email_b,tel_b,id_a,id_b");
  for (const r of revisao) { const p = r.par; console.log([r.motivo, p.motivos, p.nome_a, p.email_a, p.tel_a, p.nome_b, p.email_b, p.tel_b, p.id_a, p.id_b].map((x) => `"${String(x ?? "").replaceAll('"', "'")}"`).join(",")); }
  console.log("REVISAO_HUMANA_CSV_FIM");
  if (APLICAR) await aplicar(ok); else console.log("Dry-run: nada foi gravado.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => fecharConexao());
