/**
 * Consolida linhas duplicadas de `email_contas` (13/10/2026).
 *
 * Contexto: o callback OAuth fazia INSERT a cada conexão; a mesma caixa chegou a
 * 6 linhas ativas (Kauã, kaua.araujo@callface.ai). Ver lib/email/conta-oauth.ts.
 *
 * Para cada grupo (organizacao_id, usuario_id, tipo, lower(email)) com mais de
 * uma conta não mesclada:
 *   1. escolhe a conta CANÔNICA (lib/email/consolidar-contas.ts: a de
 *      reunioes.calendar_conta_id; senão token válido + sync recente; desempate
 *      pela mais antiga);
 *   2. apaga e-mails importados em dobro ENTRE contas do grupo (mesma
 *      organização, message-id, direção, remetente, destinatário e assunto;
 *      fica o da canônica). Duplicata dentro da MESMA conta não é tocada;
 *   3. reaponta TODA FK que aponta para email_contas (descobertas em
 *      pg_constraint, não listadas à mão) das extras para a canônica;
 *      calendario_assinaturas tem a conta como PK: a linha da canônica fica e as
 *      das extras são removidas (com backup), então a assinatura do Outlook
 *      deixa de ser renovada em duplicata;
 *   4. marca as extras com sync_status = 'mesclada'. O worker só sincroniza
 *      `active` (worker/index.ts: syncStatus = 'active'), e calendário/agenda
 *      também filtram `active`, então a conta sai de todos os fluxos;
 *   5. ao fim cria uq_email_contas_caixa (índice da migration 0113).
 *
 * Backup: tabela `_consolidacao_email_contas_20261013` (uma linha por registro
 * alterado ou removido, com a linha inteira em jsonb). Nada é apagado sem backup.
 * Reversão: ver o fim do arquivo.
 *
 *   npx tsx --env-file=.env src/scripts/consolidar-email-contas.ts            # simula (SOMENTE LEITURA)
 *   npx tsx --env-file=.env src/scripts/consolidar-email-contas.ts --aplicar  # escreve
 *
 * Idempotente: depois de aplicar, as extras estão 'mesclada' e não formam mais
 * grupo; rodar de novo não encontra nada.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { escolherCanonica, type ContaCandidata } from "@/lib/email/consolidar-contas";

const TABELA_BACKUP = "_consolidacao_email_contas_20261013";
const bk = sql.identifier(TABELA_BACKUP);

type Tx = Pick<typeof db, "execute">;
type Linha = Record<string, unknown>;

interface FkRef { tabela: string; coluna: string; pk: boolean }
interface Grupo {
  chave: string;
  organizacaoId: string;
  usuarioId: string;
  tipo: string;
  email: string;
  canonicaId: string;
  motivo: string;
  extras: string[];
  todas: string[];
}

export interface Contagens {
  grupos: number;
  contasExtras: number;
  reapontar: Record<string, number>;
  assinaturasRemovidas: number;
  assinaturasMovidas: number;
  emailsDuplicados: number;
}

/** Todas as FKs que apontam para email_contas, lidas do catálogo. */
async function descobrirFks(tx: Tx): Promise<FkRef[]> {
  const rows = await tx.execute<{ tabela: string; coluna: string; pk: boolean }>(sql`
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna,
           EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indisprimary
                    AND i.indkey::text = a.attnum::text) AS pk
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'email_contas'::regclass
     ORDER BY 1, 2`);
  return [...rows].map((r) => ({ tabela: r.tabela, coluna: r.coluna, pk: r.pk }));
}

/** Colunas que parecem apontar para conta mas não têm FK: só alerta, não toca. */
async function colunasSemFk(tx: Tx, fks: FkRef[]): Promise<string[]> {
  const rows = await tx.execute<{ t: string; c: string }>(sql`
    SELECT table_name AS t, column_name AS c FROM information_schema.columns
     WHERE table_schema = current_schema() AND column_name ~ '(^|_)conta(_email)?_id$'`);
  const conhecidas = new Set(fks.map((f) => `${f.tabela}.${f.coluna}`));
  return [...rows].map((r) => `${r.t}.${r.c}`).filter((k) => !conhecidas.has(k));
}

async function carregarGrupos(tx: Tx): Promise<Grupo[]> {
  const brutos = await tx.execute<Linha>(sql`
    SELECT ec.id, ec.organizacao_id, ec.usuario_id, ec.tipo, lower(ec.email) AS email,
           ec.created_at, ec.sync_status, ec.last_sync_at, ec.last_error, ec.token_expiry,
           (ec.refresh_token IS NOT NULL) AS tem_rt,
           (SELECT count(*) FROM reunioes r WHERE r.calendar_conta_id = ec.id)::int AS refs_cal
      FROM email_contas ec
     WHERE ec.sync_status <> 'mesclada'
       AND (ec.organizacao_id, ec.usuario_id, ec.tipo, lower(ec.email)) IN (
             SELECT organizacao_id, usuario_id, tipo, lower(email) FROM email_contas
              WHERE sync_status <> 'mesclada'
              GROUP BY 1, 2, 3, 4 HAVING count(*) > 1)
     ORDER BY ec.organizacao_id, ec.usuario_id, ec.tipo, lower(ec.email), ec.created_at, ec.id`);

  const mapa = new Map<string, { base: Linha; contas: ContaCandidata[] }>();
  for (const r of brutos) {
    const chave = `${r.organizacao_id}|${r.usuario_id}|${r.tipo}|${r.email}`;
    const g = mapa.get(chave) ?? { base: r, contas: [] };
    g.contas.push({
      id: String(r.id),
      createdAt: new Date(r.created_at as string),
      syncStatus: String(r.sync_status),
      lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at as string) : null,
      lastError: (r.last_error as string | null) ?? null,
      temRefreshToken: Boolean(r.tem_rt),
      tokenExpiry: r.token_expiry ? new Date(r.token_expiry as string) : null,
      refsCalendario: Number(r.refs_cal),
    });
    mapa.set(chave, g);
  }
  return [...mapa.entries()].map(([chave, { base, contas }]) => {
    const { id, motivo } = escolherCanonica(contas);
    return {
      chave,
      organizacaoId: String(base.organizacao_id),
      usuarioId: String(base.usuario_id),
      tipo: String(base.tipo),
      email: String(base.email),
      canonicaId: id,
      motivo,
      extras: contas.filter((c) => c.id !== id).map((c) => c.id),
      todas: contas.map((c) => c.id),
    };
  });
}

const uuids = (ids: string[]): SQL => sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);

/**
 * Linhas de `emails` duplicadas ENTRE contas do grupo. O ranking é total
 * (canônica primeiro, depois a mais antiga, depois id): em cada chave sobra
 * exatamente a melhor linha; só são candidatas as que têm uma melhor em OUTRA
 * conta do grupo.
 */
function emailsDuplicadosSql(g: Grupo): SQL {
  return sql`
    WITH c AS (
      SELECT e.id, e.conta_id,
             row_number() OVER (
               PARTITION BY e.organizacao_id, e.message_id, e.direcao, e.de, e.para, e.assunto
               ORDER BY (e.conta_id = ${g.canonicaId}::uuid) DESC, e.created_at ASC, e.id ASC) AS rn,
             first_value(e.conta_id) OVER (
               PARTITION BY e.organizacao_id, e.message_id, e.direcao, e.de, e.para, e.assunto
               ORDER BY (e.conta_id = ${g.canonicaId}::uuid) DESC, e.created_at ASC, e.id ASC) AS conta_mantida
        FROM emails e
       WHERE e.conta_id IN (${uuids(g.todas)})
         AND e.message_id IS NOT NULL AND e.message_id <> '')
    SELECT id FROM c WHERE rn > 1 AND conta_id <> conta_mantida`;
}

async function contar(tx: Tx, q: SQL): Promise<number> {
  const [r] = await tx.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM (${q}) x`);
  return Number(r.n);
}

/** Conta o que a consolidação faria. Só SELECT. */
async function simular(tx: Tx, grupos: Grupo[], fks: FkRef[]): Promise<Contagens> {
  const out: Contagens = { grupos: grupos.length, contasExtras: 0, reapontar: {}, assinaturasRemovidas: 0, assinaturasMovidas: 0, emailsDuplicados: 0 };
  for (const g of grupos) {
    out.contasExtras += g.extras.length;
    const dups = await contar(tx, emailsDuplicadosSql(g));
    out.emailsDuplicados += dups;
    out.reapontar["emails.conta_id"] = (out.reapontar["emails.conta_id"] ?? 0) - dups; // os duplicados são removidos antes de reapontar
    for (const fk of fks) {
      const k = `${fk.tabela}.${fk.coluna}`;
      if (fk.pk) {
        const t = sql.identifier(fk.tabela), col = sql.identifier(fk.coluna);
        const temCanon = await contar(tx, sql`SELECT 1 FROM ${t} WHERE ${col} = ${g.canonicaId}::uuid`);
        const nExtras = await contar(tx, sql`SELECT 1 FROM ${t} WHERE ${col} IN (${uuids(g.extras)})`);
        if (temCanon) out.assinaturasRemovidas += nExtras;
        else if (nExtras > 0) { out.assinaturasMovidas += 1; out.assinaturasRemovidas += nExtras - 1; }
        continue;
      }
      const qtd = await contar(tx, sql`SELECT 1 FROM ${sql.identifier(fk.tabela)} WHERE ${sql.identifier(fk.coluna)} IN (${uuids(g.extras)})`);
      out.reapontar[k] = (out.reapontar[k] ?? 0) + qtd;
    }
  }
  return out;
}

async function aplicar(tx: Tx, grupos: Grupo[], fks: FkRef[]): Promise<Contagens> {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS ${bk} (
      id          bigserial PRIMARY KEY,
      criado_em   timestamptz NOT NULL DEFAULT now(),
      grupo       text NOT NULL,
      conta_canonica uuid NOT NULL,
      acao        text NOT NULL,      -- conta_mesclada | reapontada | email_removido | assinatura_removida | assinatura_movida
      tabela      text NOT NULL,
      registro_id text,
      dados       jsonb NOT NULL      -- linha inteira ANTES da mudança
    )`);

  const out: Contagens = { grupos: grupos.length, contasExtras: 0, reapontar: {}, assinaturasRemovidas: 0, assinaturasMovidas: 0, emailsDuplicados: 0 };

  for (const g of grupos) {
    const canon = sql`${g.canonicaId}::uuid`;
    const grupoTxt = g.chave;
    const extras = uuids(g.extras);
    out.contasExtras += g.extras.length;

    // 1) backup das contas extras (linha inteira, tokens continuam cifrados como estavam)
    await tx.execute(sql`
      INSERT INTO ${bk} (grupo, conta_canonica, acao, tabela, registro_id, dados)
      SELECT ${grupoTxt}, ${canon}, 'conta_mesclada', 'email_contas', id::text, to_jsonb(ec)
        FROM email_contas ec WHERE id IN (${extras})`);

    // 2) e-mails em dobro entre contas do grupo: backup completo e remoção
    const dup = emailsDuplicadosSql(g);
    await tx.execute(sql`
      INSERT INTO ${bk} (grupo, conta_canonica, acao, tabela, registro_id, dados)
      SELECT ${grupoTxt}, ${canon}, 'email_removido', 'emails', e.id::text, to_jsonb(e)
        FROM emails e WHERE e.id IN (${dup})`);
    const apagados = await tx.execute<{ id: string }>(sql`DELETE FROM emails WHERE id IN (${dup}) RETURNING id`);
    out.emailsDuplicados += apagados.length;

    // 3) reapontar todas as FKs
    for (const fk of fks) {
      const t = sql.identifier(fk.tabela), col = sql.identifier(fk.coluna);
      if (fk.pk) {
        // calendario_assinaturas: a conta é a PK
        const [{ n: temCanon }] = await tx.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM ${t} WHERE ${col} = ${canon}`);
        const extrasRows = await tx.execute<Linha>(sql`SELECT to_jsonb(x) AS j, ${col} AS conta FROM ${t} x WHERE ${col} IN (${extras}) ORDER BY ${col}`);
        let manter: string | null = null;
        if (Number(temCanon) === 0 && extrasRows.length > 0) manter = String(extrasRows[0].conta);
        for (const r of extrasRows) {
          const conta = String(r.conta);
          const acao = conta === manter ? "assinatura_movida" : "assinatura_removida";
          await tx.execute(sql`INSERT INTO ${bk} (grupo, conta_canonica, acao, tabela, registro_id, dados)
            VALUES (${grupoTxt}, ${canon}, ${acao}, ${fk.tabela}, ${conta}, ${JSON.stringify(r.j)}::jsonb)`);
          if (conta === manter) {
            await tx.execute(sql`UPDATE ${t} SET ${col} = ${canon} WHERE ${col} = ${conta}::uuid`);
            out.assinaturasMovidas += 1;
          } else {
            await tx.execute(sql`DELETE FROM ${t} WHERE ${col} = ${conta}::uuid`);
            out.assinaturasRemovidas += 1;
          }
        }
        continue;
      }
      const guarda = fk.tabela === "emails"
        ? sql`jsonb_build_object('id', x.id, '${sql.raw(fk.coluna)}', x.${col})`   // 789 linhas: só o necessário para reverter
        : sql`to_jsonb(x)`;
      await tx.execute(sql`
        INSERT INTO ${bk} (grupo, conta_canonica, acao, tabela, registro_id, dados)
        SELECT ${grupoTxt}, ${canon}, 'reapontada', ${`${fk.tabela}.${fk.coluna}`}, x.id::text, ${guarda}
          FROM ${t} x WHERE x.${col} IN (${extras})`);
      const mudou = await tx.execute<{ id: string }>(sql`UPDATE ${t} SET ${col} = ${canon} WHERE ${col} IN (${extras}) RETURNING 1 AS id`);
      const k = `${fk.tabela}.${fk.coluna}`;
      out.reapontar[k] = (out.reapontar[k] ?? 0) + mudou.length;
    }

    // 4) a canônica herda o que as extras tinham e ela não: padrão, assinatura, "enviar como", nome
    await tx.execute(sql`
      UPDATE email_contas c SET
        is_default = c.is_default OR EXISTS (SELECT 1 FROM email_contas x WHERE x.id IN (${extras}) AND x.is_default),
        assinatura = COALESCE(c.assinatura, (SELECT x.assinatura FROM email_contas x WHERE x.id IN (${extras}) AND x.assinatura IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        envio_como = COALESCE(c.envio_como, (SELECT x.envio_como FROM email_contas x WHERE x.id IN (${extras}) AND x.envio_como IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        nome       = COALESCE(c.nome, (SELECT x.nome FROM email_contas x WHERE x.id IN (${extras}) AND x.nome IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        updated_at = now()
      WHERE c.id = ${canon}`);

    // 5) extras saem do sync: o worker só pega 'active'
    await tx.execute(sql`
      UPDATE email_contas SET sync_status = 'mesclada', is_default = false,
             last_error = ${`Mesclada em ${g.canonicaId} (consolidação 13/10/2026; backup em ${TABELA_BACKUP})`},
             updated_at = now()
       WHERE id IN (${extras})`);
  }

  // 6) trava no banco (mesmo índice da migration 0113), agora que não há duplicata
  await tx.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_email_contas_caixa
      ON email_contas (organizacao_id, usuario_id, tipo, lower(email))
      WHERE sync_status <> 'mesclada'`);
  return out;
}

async function main() {
  const modoAplicar = process.argv.includes("--aplicar");
  console.log(modoAplicar ? "MODO: --aplicar (ESCREVE no banco)" : "MODO: --simular (somente leitura)");

  await db.transaction(async (tx) => {
    if (!modoAplicar) await tx.execute(sql`SET TRANSACTION READ ONLY`);
    else await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('consolidar-email-contas', 0))`);

    const fks = await descobrirFks(tx);
    console.log("\nFKs que apontam para email_contas (descobertas em pg_constraint):");
    for (const f of fks) console.log(`  - ${f.tabela}.${f.coluna}${f.pk ? "  (PK: tratada à parte)" : ""}`);
    const soltas = await colunasSemFk(tx, fks);
    if (soltas.length) console.log(`  ATENCAO colunas *conta_id sem FK (não tocadas): ${soltas.join(", ")}`);

    const grupos = await carregarGrupos(tx);
    console.log(`\nGrupos de caixa duplicada: ${grupos.length}`);
    for (const g of grupos) {
      console.log(`  ${g.tipo} ${g.email} (usuario ${g.usuarioId}): ${g.todas.length} contas`);
      console.log(`    canônica ${g.canonicaId}  motivo=${g.motivo}`);
      console.log(`    extras   ${g.extras.join(", ")}`);
    }

    const res = modoAplicar ? await aplicar(tx, grupos, fks) : await simular(tx, grupos, fks);
    console.log(`\n${modoAplicar ? "APLICADO" : "SIMULAÇÃO"}:`);
    console.log(`  contas por grupo: ${grupos.map((g) => g.todas.length).join(", ") || "-"}`);
    console.log(`  contas extras a marcar 'mesclada': ${res.contasExtras}`);
    console.log("  referências a reapontar por tabela.coluna:");
    for (const f of fks.filter((x) => !x.pk)) console.log(`    ${f.tabela}.${f.coluna}: ${res.reapontar[`${f.tabela}.${f.coluna}`] ?? 0}`);
    console.log(`  calendario_assinaturas: ${res.assinaturasMovidas} movida(s), ${res.assinaturasRemovidas} removida(s)`);
    console.log(`  e-mails duplicados entre contas (remover, com backup): ${res.emailsDuplicados}`);
    if (!modoAplicar) console.log("\nNada foi escrito. Para aplicar: --aplicar (faça antes um backup do banco).");
  });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

/*
 * REVERSÃO (a partir de _consolidacao_email_contas_20261013), por acao:
 *   conta_mesclada      UPDATE email_contas SET sync_status = dados->>'sync_status', is_default = (dados->>'is_default')::bool,
 *                         last_error = dados->>'last_error' WHERE id = registro_id::uuid;
 *   reapontada          UPDATE <tabela> SET <coluna> = (dados->><coluna>)::uuid WHERE id = registro_id::uuid;
 *   email_removido      INSERT INTO emails SELECT * FROM jsonb_populate_record(NULL::emails, dados);
 *   assinatura_removida INSERT INTO calendario_assinaturas SELECT * FROM jsonb_populate_record(NULL::calendario_assinaturas, dados);
 *   assinatura_movida   UPDATE calendario_assinaturas SET conta_id = registro_id::uuid WHERE conta_id = conta_canonica;
 *   (e DROP INDEX uq_email_contas_caixa antes de reverter contas.)
 */
