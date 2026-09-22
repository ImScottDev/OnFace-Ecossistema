/**
 * As portas HTTP de entrada põem o registro no modelo canônico, em runtime.
 *
 * `smoke-ponte-canonica` prova que a PONTE funciona quando chamada. Não prova
 * que as rotas a chamam, nem que a chamada chega ao fim: as cinco rotas de
 * cutover usam `void garantirEntradaCanonica(...)`, de propósito, para que uma
 * falha na entrada canônica não derrube a criação do lead. O efeito colateral é
 * que **ninguém fica sabendo quando falha** — o retorno `{ ok: false }` do
 * domínio não levanta exceção e não é logado.
 *
 * O banco não responde essa pergunta, e a tentativa de perguntar a ele foi o
 * que motivou este smoke. Medido em 22/09: **zero** dos 3.989 leads está sem
 * aquisição, o que parece prova de que tudo funciona. Não é. O lead mais
 * recente do banco é de 18/09 e o backfill da fase 06 rodou em 21/09, gravando
 * a aquisição com `created_at` COPIADO do lead — o que faz 400 registros
 * parecerem criados "junto com o lead, em menos de 60s". Nenhum deles publicou
 * `AcquisitionCreated`: 0 de 400.
 *
 * Fica a regra, que vale para qualquer medição futura nesta base: **presença de
 * aquisição não distingue runtime de backfill.** O sinal que só o runtime
 * produz é o evento.
 *
 * Por isso este smoke exercita a rota HTTP de verdade, com sessão real, e cobra
 * as três coisas juntas: o lead nasce, a aquisição aparece e o evento sai.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-portas-de-entrada.ts
 */
import { encode } from "@auth/core/jwt";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { app } from "@/api-server/server";

const MARCA = "smoke-porta-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  for (const q of [
    sql`DELETE FROM pontos_contato WHERE pessoa_id IN (SELECT id FROM pessoas WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM atividades WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM vendas_eventos WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM status_changes WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM domain_events WHERE aggregate_id IN (
          SELECT id FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"}))`,
    sql`DELETE FROM backfill_provenance WHERE id_canonico IN (
          SELECT id FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"}))`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    // `POST /api/leads` não cria só o lead: sai com oportunidade e negócio
    // junto, e as duas seguram a pessoa e o lead pela FK. Descoberto pelo
    // resíduo, não pela leitura do handler.
    sql`DELETE FROM oportunidades WHERE pessoa_id IN (SELECT id FROM pessoas WHERE nome LIKE ${MARCA + "%"})
           OR negocio_id_legado IN (SELECT id FROM negocios WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"}))`,
    sql`DELETE FROM negocios WHERE lead_id IN (SELECT id FROM leads WHERE nome LIKE ${MARCA + "%"})`,
    sql`DELETE FROM pessoas WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM leads WHERE nome LIKE ${MARCA + "%"}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${MARCA + "%"}`,
    // O catch NÃO é mudo, de propósito. A limpeza anterior engolia o erro, e
    // por isso a violação de FK que deixava lead, pessoa e empresa para trás
    // só apareceu na contagem final, sem dizer a causa. É o mesmo defeito que
    // custou três testes de reconciliação no CP49.
  ]) await db.execute(q).catch((e) => console.log(`  (limpeza) ${e instanceof Error ? e.message : e}`));
}

/**
 * Espera a entrada canônica aparecer, porque `void` a solta depois da resposta.
 *
 * A rota responde ANTES de a ponte terminar — é o que `void` significa. Medir
 * no instante seguinte ao `await app.request(...)` daria falso vermelho. O que
 * este laço mede, de quebra, é o tamanho da janela em que o registro existe no
 * legado e ainda não existe no canônico.
 */
async function esperarAquisicao(leadId: string, limiteMs = 5000) {
  const inicio = Date.now();
  for (;;) {
    const [r] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid LIMIT 1`);
    if (r) return { aquisicaoId: r.id, esperouMs: Date.now() - inicio };
    if (Date.now() - inicio > limiteMs) return { aquisicaoId: null, esperouMs: Date.now() - inicio };
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function conferir(porta: string, leadId: string) {
  const { aquisicaoId, esperouMs } = await esperarAquisicao(leadId);
  ok(Boolean(aquisicaoId), `${porta} — a aquisição canônica apareceu (${esperouMs}ms depois da resposta)`);
  if (!aquisicaoId) return;

  // O evento é o que dispara automação. Aquisição sem evento é o defeito
  // "569 ganhos renderam 33 eventos" na porta de entrada.
  const [ev] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM domain_events
     WHERE aggregate_id = ${aquisicaoId}::uuid AND event_type = 'AcquisitionCreated'`);
  ok(ev.n >= 1, `${porta} — AcquisitionCreated publicado (${ev.n})`);

  // E no outbox, que é quem entrega para fora. Evento sem outbox fica no banco
  // e não sai.
  // O outbox não guarda o id do evento: ele repete `aggregate_id` e
  // `event_type`, e é por esse par que se acha a linha correspondente.
  const [ob] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM event_outbox
     WHERE aggregate_id = ${aquisicaoId}::uuid AND event_type = 'AcquisitionCreated'`);
  ok(ob.n >= 1, `${porta} — e entrou no outbox para entrega (${ob.n})`);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string; slug: string }>(sql`
    SELECT id::text, coalesce(slug,'') AS slug FROM organizacoes ORDER BY created_at LIMIT 1`);
  const [u] = await db.execute<{ id: string; nome: string; email: string; role: string }>(sql`
    SELECT id::text, nome, email, role FROM usuarios
     WHERE organizacao_id = ${org.id}::uuid AND role = 'admin' AND ativo = true LIMIT 1`);
  const cookie = `authjs.session-token=${await encode({
    token: { id: u.id, name: u.nome, email: u.email, role: u.role, organizacaoId: org.id, organizacaoSlug: org.slug },
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
    salt: "authjs.session-token",
  })}`;
  const api = async (metodo: string, caminho: string, corpo?: unknown) => {
    const r = await app.request(`http://local${caminho}`, {
      method: metodo, headers: { cookie, "content-type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await r.text();
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(texto) as Record<string, unknown>; } catch { /* resposta não-JSON */ }
    return { status: r.status, body: json, texto };
  };

  const marca = `${MARCA}${Date.now()}`;

  console.log("═══ POST /api/leads — a maior porta de escrita de lead ═══");
  const r1 = await api("POST", "/api/leads", {
    organizacaoId: org.id, nome: `${marca}-leads`,
    email: `${marca}-leads@exemplo.invalid`, telefone: "11977770001",
    empresa: `${marca} Ltda`, origem: "smoke",
  });
  ok(r1.status === 200 || r1.status === 201, `respondeu ${r1.status}`);
  const lead1 = String((r1.body?.lead as Record<string, unknown> | undefined)?.id ?? r1.body?.id ?? "");
  ok(Boolean(lead1), `lead criado (${lead1.slice(0, 8)}…)`);
  if (lead1) await conferir("POST /api/leads", lead1);

  console.log("\n═══ POST /api/contatos-unified — a porta do drawer de contatos ═══");
  const r2 = await api("POST", "/api/contatos-unified", {
    nome: `${marca}-unified`, email: `${marca}-unified@exemplo.invalid`,
    telefone: "11977770002", empresa: `${marca} Ltda`, origem: "smoke",
  });
  ok(r2.status === 200 || r2.status === 201, `respondeu ${r2.status}`);
  const lead2 = String((r2.body?.contato as Record<string, unknown> | undefined)?.id ?? r2.body?.id ?? "");
  ok(Boolean(lead2), `contato criado (${lead2.slice(0, 8)}…)`);
  if (lead2) await conferir("POST /api/contatos-unified", lead2);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM leads WHERE nome LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM pessoas WHERE nome LIKE ${MARCA + "%"})
          + (SELECT count(*) FROM empresas WHERE nome LIKE ${MARCA + "%"}))::int AS n`);
  ok(resto.n === 0, `o smoke não deixa resíduo em nenhuma das tabelas que cria (${resto.n})`);

  console.log(saida === 0 ? "\nportas de entrada: ok\n" : "\nportas de entrada: FALHOU\n");
}

main().then(() => process.exit(saida)).catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
