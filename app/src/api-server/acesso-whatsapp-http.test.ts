/**
 * Ponta a ponta pelas ROTAS REAIS (Hono em processo, sem servidor), contra o banco, com dados sintéticos:
 * admin, closer, super admin e "ver como" tentando abrir uma conversa pessoal PRIVADA por id direto, por
 * lista, por busca, por viewAs e por rota de escrita. Nenhum conteúdo real; a organização de QA é apagada.
 *
 * DATABASE_URL=... NEXTAUTH_SECRET=... node --import tsx --env-file=.env --test src/api-server/acesso-whatsapp-http.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { encode } from "@auth/core/jwt";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { Hono } from "hono";
import { whatsappRoutes } from "@/api-server/routes/whatsapp";
import { atendimentoRoutes } from "@/api-server/routes/atendimento";
import { contatosRoutes } from "@/api-server/routes/contatos";

const T = `[E2E ${Date.now().toString(36)}]`;
const app = new Hono();
app.route("/", whatsappRoutes); app.route("/", atendimentoRoutes); app.route("/", contatosRoutes);
let org = ""; const u: Record<string,string> = {}; let falhas = 0;
const limpar = async () => { if (!org) return; for (const q of [sql`DELETE FROM whatsapp_mensagens WHERE contato_id IN (SELECT id FROM contatos WHERE organizacao_id=${org}::uuid)`, sql`DELETE FROM audit_log WHERE organizacao_id=${org}::uuid`, sql`DELETE FROM whatsapp_supervisao WHERE organizacao_id=${org}::uuid`, sql`DELETE FROM contatos WHERE organizacao_id=${org}::uuid`, sql`DELETE FROM whatsapp_sessao WHERE organizacao_id=${org}::uuid`, sql`DELETE FROM usuarios WHERE organizacao_id=${org}::uuid`, sql`DELETE FROM organizacoes WHERE id=${org}::uuid`]) await db.execute(q); };
const ok = (c: boolean, m: string) => { if (!c) falhas++; assert.ok(c, m); };
async function user(n: string, role: string) { const [r] = await db.execute<{id:string}>(sql`INSERT INTO usuarios (organizacao_id,nome,email,senha_hash,role,tipo,ativo) VALUES (${org}::uuid,${T+n},${`${T}-${n}@qa.local`},'x',${role},'humano',true) RETURNING id::text`); return r.id; }
async function cookie(id: string, role: string, extra = "") { return `authjs.session-token=${await encode({ token: { id, name: id, email: `${id}@qa.local`, role, organizacaoId: org, organizacaoSlug: "qa" }, secret: process.env.NEXTAUTH_SECRET || "", salt: "authjs.session-token" })}${extra}`; }
const get = async (p: string, ck: string) => app.request(p, { headers: { cookie: ck } });
const post = async (p: string, ck: string, body: unknown) => app.request(p, { method: "POST", headers: { cookie: ck, "content-type": "application/json" }, body: JSON.stringify(body) });
test("conversa pessoal privada pelas rotas reais, por papel", async () => {
  try {
    const [o] = await db.execute<{id:string}>(sql`INSERT INTO organizacoes (nome,slug) VALUES (${T+" org"},${"e2e-"+Date.now().toString(36)}) RETURNING id::text`); org = o.id;
    u.dono = await user("dono","super_admin"); u.outroSuper = await user("super2","super_admin"); u.admin = await user("admin","admin"); u.closer = await user("closer","closer");
    const [sp] = await db.execute<{id:string}>(sql`INSERT INTO whatsapp_sessao (organizacao_id,usuario_id,session_name,label,status,tipo,privado) VALUES (${org}::uuid,${u.dono}::uuid,${T+"s"},${T+" pessoal"},'connected','pessoal',true) RETURNING id::text`);
    const [ct] = await db.execute<{id:string}>(sql`INSERT INTO contatos (organizacao_id,canal,nome,telefone,sessao_id,responsavel_id,status) VALUES (${org}::uuid,'whatsapp',${T+" Fulano"},'5500000000001',${sp.id}::uuid,NULL,'open') RETURNING id::text`);
    await db.execute(sql`INSERT INTO whatsapp_mensagens (contato_id,sessao_id,telefone,direcao,tipo,conteudo,status) VALUES (${ct.id}::uuid,${sp.id}::uuid,'5500000000001','in','text','CONTEUDO-SINTETICO','received')`);
    const cAdmin = await cookie(u.admin,"admin"), cCloser = await cookie(u.closer,"closer"), cDono = await cookie(u.dono,"super_admin"), cSuper2 = await cookie(u.outroSuper,"super_admin");
    const cVerComo = await cookie(u.outroSuper,"super_admin",`; mcrm-view-as=${u.closer}`);

    for (const [n, ck] of [["admin", cAdmin], ["closer", cCloser], ["super2 ver como closer", cVerComo]] as const) {
      ok((await get(`/whatsapp/messages/${ct.id}`, ck)).status === 404, `${n}: mensagens por id direto -> 404`);
      ok((await get(`/atendimento/conversas/${ct.id}/tags`, ck)).status === 404, `${n}: tags por id -> 404`);
      ok((await get(`/atendimento/conversas/${ct.id}/ia`, ck)).status === 404, `${n}: estado da IA por id -> 404`);
      ok((await post(`/atendimento/conversas/${ct.id}/acao`, ck, { acao: "claim" })).status !== 200, `${n}: assumir por id nao passa`);
      ok((await post(`/contatos/${ct.id}/atribuir`, ck, {})).status === 404 || (await post(`/contatos/${ct.id}/atribuir`, ck, {})).status === 403, `${n}: atribuir por id nao passa`);
      const lista = await (await get(`/whatsapp/conversations?view=todos`, ck)).text();
      ok(!lista.includes(ct.id), `${n}: lista 'todos' nao contem a conversa privada`);
      const at = await (await get(`/atendimento/conversas?view=todos&canal=whatsapp`, ck)).text();
      ok(!at.includes(ct.id), `${n}: Atendimento 'todos' nao contem`);
      const porLead = await (await get(`/atendimento/conversas?canal=whatsapp&search=Fulano`, ck)).text();
      ok(!porLead.includes(ct.id), `${n}: busca por nome nao acha`);
      const nums = await (await get(`/whatsapp/numeros`, ck)).text();
      ok(!nums.includes(sp.id), `${n}: lista de numeros nao mostra o privado`);
      const st = await (await get(`/whatsapp/status`, ck)).text();
      ok(!st.includes(sp.id), `${n}: status nao mostra o privado`);
      ok((await get(`/whatsapp/conversations?viewAs=${u.dono}`, ck)).status === 400, `${n}: viewAs por parametro -> 400`);
      ok((await get(`/whatsapp/unread-count?viewAs=${u.dono}`, ck)).status === 400, `${n}: unread viewAs -> 400`);
    }
    ok((await post(`/whatsapp/send`, cVerComo, { contatoId: ct.id, conteudo: "x", tipo: "text" })).status === 403, "ver como nao envia");
    const r = await get(`/whatsapp/messages/${ct.id}`, cDono); const j = await r.text();
    ok(r.status === 200 && j.includes("CONTEUDO-SINTETICO"), "dono abre a propria conversa");
    const cd = await (await get(`/whatsapp/conversations?view=meus`, cDono)).text(); ok(cd.includes(ct.id), "dono ve na lista");
    const r2 = await get(`/whatsapp/messages/${ct.id}`, cSuper2);
    ok(r2.status === 200, "super admin alheio abre por id (excepcional)");
    const [aud] = await db.execute<{n:number}>(sql`SELECT count(*)::int n FROM audit_log WHERE organizacao_id=${org}::uuid AND action='whatsapp.acesso_excepcional' AND actor_id=${u.outroSuper}::uuid AND entity_id=${ct.id}::uuid`);
    ok(aud.n === 1, "...e deixou rastro na auditoria");
    const l2 = await (await get(`/whatsapp/conversations?view=todos`, cSuper2)).text(); ok(!l2.includes(ct.id), "super admin: lista 'todos' sem o privado");
    // supervisão: só o super admin concede
    ok((await post(`/whatsapp/supervisao`, cAdmin, { supervisorId: u.admin, alvoUsuarioId: u.closer })).status === 403, "admin nao concede supervisao");
    ok((await post(`/whatsapp/supervisao`, cDono, { supervisorId: u.admin, alvoUsuarioId: u.closer })).status === 200, "super admin concede supervisao");
    ok((await get(`/whatsapp/conversations?view=todos`, cAdmin)).status === 200, "admin com supervisao lista 'todos'");
  } finally {
    await limpar();
  }
  // O módulo de fila abre conexão ao importar: encerra o processo de teste quando acabar.
  setTimeout(() => process.exit(falhas ? 1 : 0), 300).unref();
});
