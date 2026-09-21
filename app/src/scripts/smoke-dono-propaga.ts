/**
 * O que se escreve pelo legado tem que chegar no canônico (SPEC §5, §16).
 *
 * O board de pré-vendas conta "sem responsável" a partir de
 * `aquisicoes.responsavel_id`, e a Empresa 360 mostra o dono da oportunidade a
 * partir de `oportunidades.responsavel_id`. Se a troca só escreve no legado, a
 * tela segue mostrando o dono antigo: o usuário reatribui, recarrega e nada
 * muda. É o mesmo formato do bug do card que voltava para a coluna anterior.
 *
 * Hoje a divergência é ZERO porque o backfill sincronizou os dois lados. Isso
 * esconde o problema: ele só aparece na primeira reatribuição depois da carga.
 * Por isso este smoke não mede a divergência existente, ele PROVOCA uma troca
 * pela rota de verdade e checa se o canônico acompanhou.
 *
 * Roda sobre dado de produção e restaura o estado original.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-dono-propaga.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { leadsRoutes } from "@/api-server/routes/leads";
import { negociosRoutes } from "@/api-server/routes/negocios";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

async function main() {
  const s = await sessaoDeSmoke();
  const [outro] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${s.organizacaoId}::uuid AND ativo = true
       AND id <> ${s.usuarioId}::uuid LIMIT 1`);
  if (!outro) throw new Error("preciso de um segundo usuário para trocar o dono");

  console.log(`\nsessão: ${s.usuarioId}\nnovo dono do teste: ${outro.nome}\n`);

  // ── Lead → aquisição ────────────────────────────────────────────────────
  const [lead] = await db.execute<{ id: string; responsavel_id: string | null }>(sql`
    SELECT l.id::text, l.responsavel_id::text
      FROM leads l JOIN aquisicoes a ON a.lead_legado_id = l.id
     WHERE l.organizacao_id = ${s.organizacaoId}::uuid
       AND l.responsavel_id IS DISTINCT FROM ${outro.id}::uuid
     LIMIT 1`);
  const donoOriginalLead = lead?.responsavel_id ?? null;

  const donoDaAquisicao = async () => {
    const [r] = await db.execute<{ id: string | null }>(sql`
      SELECT responsavel_id::text AS id FROM aquisicoes WHERE lead_legado_id = ${lead.id}::uuid`);
    return r?.id ?? null;
  };

  try {
    const res = await leadsRoutes.request(`http://local/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: s.cookie },
      body: JSON.stringify({ responsavelId: outro.id }),
    });
    ok(res.status === 200, `trocar o dono do lead devolve 200 (status ${res.status})`);

    const [legado] = await db.execute<{ id: string | null }>(sql`
      SELECT responsavel_id::text AS id FROM leads WHERE id = ${lead.id}::uuid`);
    ok(legado?.id === outro.id, "o legado gravou o dono novo");

    const canonico = await donoDaAquisicao();
    ok(canonico === outro.id,
       `a AQUISIÇÃO canônica acompanhou (${canonico === outro.id ? "sim" : `não: ${canonico ?? "nulo"}`})`);
  } finally {
    await db.execute(sql`
      UPDATE leads SET responsavel_id = ${donoOriginalLead}::uuid WHERE id = ${lead.id}::uuid`);
    await db.execute(sql`
      UPDATE aquisicoes SET responsavel_id = ${donoOriginalLead}::uuid
       WHERE lead_legado_id = ${lead.id}::uuid`);
    await db.execute(sql`
      DELETE FROM audit_log WHERE action = 'lead.responsavel_alterado'
        AND entity_id = ${lead.id}::uuid`);
  }

  // ── Negócio → oportunidade ──────────────────────────────────────────────
  const [neg] = await db.execute<{ id: string; responsavel_id: string | null }>(sql`
    SELECT n.id::text, n.responsavel_id::text
      FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE n.organizacao_id = ${s.organizacaoId}::uuid
       AND n.status NOT IN ('ganho','perdido')
       AND n.responsavel_id IS DISTINCT FROM ${outro.id}::uuid
     LIMIT 1`);
  const donoOriginalNeg = neg?.responsavel_id ?? null;

  try {
    const res = await negociosRoutes.request(`http://local/negocios/${neg.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: s.cookie },
      body: JSON.stringify({ responsavelId: outro.id }),
    });
    ok(res.status === 200, `trocar o dono do negócio devolve 200 (status ${res.status})`);

    const [canon] = await db.execute<{ id: string | null }>(sql`
      SELECT responsavel_id::text AS id FROM oportunidades WHERE negocio_id_legado = ${neg.id}::uuid`);
    ok(canon?.id === outro.id,
       `a OPORTUNIDADE canônica acompanhou (${canon?.id === outro.id ? "sim" : `não: ${canon?.id ?? "nulo"}`})`);
  } finally {
    await db.execute(sql`
      UPDATE negocios SET responsavel_id = ${donoOriginalNeg}::uuid WHERE id = ${neg.id}::uuid`);
    await db.execute(sql`
      UPDATE oportunidades SET responsavel_id = ${donoOriginalNeg}::uuid
       WHERE negocio_id_legado = ${neg.id}::uuid`);
    await db.execute(sql`
      DELETE FROM audit_log WHERE action = 'negocio.responsavel_alterado'
        AND entity_id = ${neg.id}::uuid`);
  }

  // ── Identidade: editar o lead tem que chegar na pessoa canônica ─────────
  //
  // `pessoas` é a identidade canônica (SPEC §5) e a tela de pessoa lê de lá.
  // Se editar o contato no lead não propagar, passam a existir dois nomes para
  // a mesma pessoa e ninguém sabe qual está certo.
  const [alvoId] = await db.execute<{ id: string; nome: string; email: string | null }>(sql`
    SELECT l.id::text, l.nome, l.email
      FROM leads l JOIN pessoas p ON p.lead_id_legado = l.id
     WHERE l.organizacao_id = ${s.organizacaoId}::uuid LIMIT 1`);
  const nomeOriginal = alvoId.nome;
  const emailOriginal = alvoId.email;
  const nomeNovo = `${nomeOriginal} ${Date.now() % 100000}`;

  try {
    const res = await leadsRoutes.request(`http://local/leads/${alvoId.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: s.cookie },
      body: JSON.stringify({ nome: nomeNovo }),
    });
    ok(res.status === 200, `editar o nome do lead devolve 200 (status ${res.status})`);

    const [pessoa] = await db.execute<{ nome: string }>(sql`
      SELECT nome FROM pessoas WHERE lead_id_legado = ${alvoId.id}::uuid`);
    ok(pessoa?.nome === nomeNovo,
       `a PESSOA canônica acompanhou (${pessoa?.nome === nomeNovo ? "sim" : `não: "${pessoa?.nome}"`})`);
  } finally {
    await db.execute(sql`
      UPDATE leads SET nome = ${nomeOriginal}, email = ${emailOriginal}
       WHERE id = ${alvoId.id}::uuid`);
    await db.execute(sql`
      UPDATE pessoas SET nome = ${nomeOriginal} WHERE lead_id_legado = ${alvoId.id}::uuid`);
  }

  // Estado restaurado: isto roda sobre dado real.
  const [div] = await db.execute<{ n: number }>(sql`
    SELECT (
      (SELECT count(*) FROM leads l JOIN aquisicoes a ON a.lead_legado_id=l.id
        WHERE a.responsavel_id IS DISTINCT FROM l.responsavel_id)
    + (SELECT count(*) FROM negocios n JOIN oportunidades o ON o.negocio_id_legado=n.id
        WHERE o.responsavel_id IS DISTINCT FROM n.responsavel_id))::int AS n`);
  ok(div?.n === 0, `nenhuma divergência de dono fica para trás (${div?.n})`);

  console.log(process.exitCode ? "\nsmoke de dono: FALHOU\n" : "\nsmoke de dono: ok\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
