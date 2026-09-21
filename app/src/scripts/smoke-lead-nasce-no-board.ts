/**
 * Lead criado pela TELA aparece no board da tela (SPEC §16, §17).
 *
 * `preVendas.criarLead` é a função que as duas server actions do CRM2 usam:
 * criar lead na tela de pré-vendas e criar lead a partir da empresa. Ela não
 * criava a aquisição canônica, e o board lê `aquisicoes` — então o lead nascia
 * e não aparecia no board onde acabou de ser criado.
 *
 * Por que nenhum smoke pegou isso antes: `smoke-prevendas-leitura` cria o lead
 * chamando `garantirEntradaCanonica` DIRETO. Ele testava a porta, não o caminho
 * que a tela percorre. Testar o caminho feliz pelo atalho é como o buraco
 * sobreviveu a uma fase inteira de cutover.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-lead-nasce-no-board.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { criarLead } from "@/lib/vendas/pre-vendas";
import { boardPreVendas, empresa360 } from "@/lib/vendas/consultas";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

const marca = `smoke-nasce-${Date.now()}`;
let leadId: string | null = null;
let empresaId: string | null = null;

async function limpar() {
  if (!leadId) return;
  for (const q of [
    sql`DELETE FROM pontos_contato WHERE lead_id_legado = ${leadId}::uuid`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid`,
    sql`DELETE FROM vendas_eventos WHERE lead_id = ${leadId}::uuid`,
    sql`DELETE FROM atividades WHERE lead_id = ${leadId}::uuid`,
    sql`DELETE FROM status_changes WHERE lead_id = ${leadId}::uuid`,
    sql`DELETE FROM tarefas WHERE lead_id = ${leadId}::uuid`,
    sql`DELETE FROM event_outbox WHERE payload ->> 'lead_legado_id' = ${leadId}`,
    sql`DELETE FROM domain_events WHERE payload ->> 'lead_legado_id' = ${leadId}`,
    sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id IN (SELECT id FROM pessoas WHERE lead_id_legado = ${leadId}::uuid)`,
    sql`DELETE FROM pessoas WHERE lead_id_legado = ${leadId}::uuid`,
    sql`DELETE FROM leads WHERE id = ${leadId}::uuid`,
    sql`DELETE FROM empresas WHERE nome LIKE ${marca + "%"}`,
  ]) await db.execute(q).catch(() => undefined);

  // Rede de segurança: a proveniência de runtime não pode sobrar apontando
  // para aquisição que já não existe.
  await db.execute(sql`
    DELETE FROM backfill_provenance bp WHERE bp.metodo = 'PONTE_CUTOVER'
      AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = bp.id_canonico)`).catch(() => undefined);
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE ativo = true LIMIT 1`);

  const antes = await boardPreVendas(org.id, { aba: "ativos" });
  const totalAntes = antes.resumo.ativos;

  // O caminho da TELA, não o atalho pela porta canônica.
  const criado = await criarLead({
    organizacaoId: org.id,
    empresa: { nome: `${marca} Ltda` },
    pessoa: { nome: marca, email: `${marca}@teste.local` },
    touchpoint: { tipoOrigem: "organica", source: "smoke" },
    origem: "site",
    responsavelId: u.id,
  } as never, { tipo: "HUMAN", usuarioId: u.id });
  leadId = criado.leadId;
  empresaId = criado.empresaId ?? null;
  ok(Boolean(leadId), `o lead é criado (${leadId?.slice(0, 8)})`);

  // 1. A aquisição canônica existe, e existe LIGADA ao lead.
  const [aq] = await db.execute<{ id: string; emp: string | null }>(sql`
    SELECT id::text, empresa_id::text AS emp FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid`);
  ok(Boolean(aq), "a aquisição canônica nasce junto");
  ok(Boolean(aq?.emp), `e já carrega a empresa (${aq?.emp ? "sim" : "não"})`);

  // 2. O board da tela mostra o lead. É a pergunta que importa.
  const depois = await boardPreVendas(org.id, { aba: "ativos" });
  ok(depois.resumo.ativos === totalAntes + 1,
     `o board conta um a mais (${totalAntes} → ${depois.resumo.ativos})`);

  const cards = Object.values(depois.colunas).flatMap((c) => c.cards);
  ok(cards.some((c) => c.leadId === leadId),
     "e o card do lead aparece no board, com o id do LEAD, não o da aquisição");

  // 3. A conta dele também o lista.
  if (empresaId) {
    const v = await empresa360(org.id, empresaId);
    ok((v?.leads.length ?? 0) > 0, `a Empresa 360 lista o lead (${v?.leads.length ?? 0})`);
    ok(v?.leads.some((l) => l.id === leadId) ?? false, "e com o id do lead");
  }

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM leads WHERE nome LIKE 'smoke-nasce-%')
          + (SELECT count(*) FROM aquisicoes a WHERE a.lead_legado_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = a.lead_legado_id)))::int AS n`);
  ok(resto.n === 0, "o smoke não deixa resíduo");

  console.log(process.exitCode ? "\nsmoke de nascimento: FALHOU\n" : "\nsmoke de nascimento: ok\n");
}

main().catch(async (e) => {
  console.error(e);
  await limpar().catch(() => undefined);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
