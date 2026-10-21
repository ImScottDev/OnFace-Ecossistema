/**
 * Números de WhatsApp (Ajustes e seletor do Atendimento), pela rota e pelo navegador.
 *
 * Monta na organização real: Ana (closer, 2 números), Lia (agente, 1 número),
 * Bia (closer, autorizada num compartilhado), Caio (closer, nada), cada número
 * com uma conversa. Prova, chamando o produto:
 *  - Ana vê só os 2 dela; Caio nada; Bia só o compartilhado;
 *  - admin abre "Equipe" (API e tela) e os filtros usuario/status/compartilhado recortam no servidor;
 *  - Caio não envia pelo número de Ana nem define padrão (404/403);
 *  - vincular Ana 2 → Caio persiste e muda o que cada um vê depois de recarregar;
 *  - no Atendimento (escopo Equipe), o seletor agrupa por pessoa/agente e escolher um
 *    número deixa só as conversas daquele número.
 *
 * BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-numeros-whatsapp.ts
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PW = process.env.PLAYWRIGHT_CORE || join(homedir(), ".npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = createRequire(`${process.cwd()}/`)(PW) as any;
const OUT = ".tmp-numeros";
const T = "[QA num]";
const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => { if (!cond) falhas.push(msg); console.log(`${cond ? "ok " : "FAIL"} ${msg}`); };

async function limpar(org: string) {
  await db.execute(sql`DELETE FROM contatos WHERE organizacao_id = ${org}::uuid AND nome LIKE ${`${T}%`}`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE organizacao_id = ${org}::uuid AND label LIKE ${`${T}%`}`);
  await db.execute(sql`DELETE FROM usuarios WHERE organizacao_id = ${org}::uuid AND nome LIKE ${`${T}%`}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const admin = await sessaoDeSmoke({ role: "super_admin" });
  const org = admin.organizacaoId;
  await limpar(org);

  const usuario = async (nome: string, role: string, tipo = "humano") => (await db.execute<{ id: string }>(sql`
    INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, role, tipo, ativo)
    VALUES (${org}::uuid, ${`${T} ${nome}`}, ${`qa-num-${nome.toLowerCase()}-${Date.now()}@qa.local`}, 'x', ${role}, ${tipo}, true) RETURNING id::text`))[0].id;
  const sessao = async (nome: string, dono: string | null) => (await db.execute<{ id: string }>(sql`
    INSERT INTO whatsapp_sessao (organizacao_id, usuario_id, session_name, label, status, tipo, phone_number)
    VALUES (${org}::uuid, ${dono}, ${`qa-num-${nome.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`}, ${`${T} ${nome}`}, 'disconnected', ${dono ? "pessoal" : "compartilhada"}, ${`5511${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}:1`}) RETURNING id::text`))[0].id;
  const contato = async (nome: string, sessaoId: string, resp: string | null) => (await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, responsavel_id, status, ultima_msg, ultima_msg_at)
    VALUES (${org}::uuid, 'whatsapp', ${`${T} ${nome}`}, ${`5511${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`}, ${sessaoId}, ${resp}, 'open', 'oi', now()) RETURNING id::text`))[0].id;

  const ana = await usuario("Ana", "closer"), bia = await usuario("Bia", "closer"), caio = await usuario("Caio", "closer"), lia = await usuario("Lia", "sdr", "agente");
  const ana1 = await sessao("Ana 1", ana), ana2 = await sessao("Ana 2", ana), sLia = await sessao("Lia", lia), comp = await sessao("Compartilhado", null);
  await db.execute(sql`INSERT INTO whatsapp_sessao_acesso (sessao_id, usuario_id, concedido_por) VALUES (${comp}::uuid, ${bia}::uuid, ${admin.usuarioId}::uuid)`);
  const cAna1 = await contato("Cliente de Ana 1", ana1, ana);
  await contato("Cliente de Ana 2", ana2, ana);
  await contato("Cliente da Lia", sLia, lia);
  await contato("Cliente do compartilhado", comp, null);

  const como = async (usuarioId: string) => (await sessaoDeSmoke({ usuarioId })).cookie;
  const api = async (cookie: string, path: string, init: RequestInit = {}) => {
    const r = await fetch(`${BASE}/api${path}`, { ...init, headers: { cookie, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const ids = (b: { numeros?: Array<{ id: string }> }) => new Set((b.numeros ?? []).map((n) => n.id));
  const igual = (a: Set<string>, b: string[]) => a.size === b.length && b.every((x) => a.has(x));

  try {
    const [ckAna, ckBia, ckCaio, ckAdmin] = await Promise.all([como(ana), como(bia), como(caio), Promise.resolve(admin.cookie)]);

    // 1. Usuário comum vê só os números autorizados; um usuário pode ter mais de um.
    let r = await api(ckAna, "/whatsapp/numeros");
    ok(r.status === 200 && r.body.gestao === null && igual(ids(r.body), [ana1, ana2]), "Ana vê exatamente os 2 números dela, sem gestão");
    r = await api(ckCaio, "/whatsapp/numeros");
    ok(igual(ids(r.body), []), "Caio não vê número nenhum");
    r = await api(ckBia, "/whatsapp/numeros");
    ok(igual(ids(r.body), [comp]), "Bia vê só o compartilhado em que está autorizada");

    // 2. Admin abre a equipe; filtros recortam no servidor.
    r = await api(ckAdmin, "/whatsapp/numeros");
    const todos = ids(r.body);
    ok(r.body.gestao === "organizacao" && [ana1, ana2, sLia, comp].every((x) => todos.has(x)), "admin vê os números de Ana, da agente Lia e o compartilhado");
    const liaRow = (r.body.numeros as Array<{ id: string; usuario: { tipo: string } | null }>).find((n) => n.id === sLia);
    ok(liaRow?.usuario?.tipo === "agente", "o número da Lia vem com dono do tipo agente");
    r = await api(ckAdmin, `/whatsapp/numeros?usuario=${ana}`);
    ok(igual(ids(r.body), [ana1, ana2]), "filtro usuario=Ana devolve só os 2 dela");
    r = await api(ckAdmin, `/whatsapp/numeros?usuario=${lia}`);
    ok(igual(ids(r.body), [sLia]), "filtro usuario=Lia (agente) devolve só o número dela");
    r = await api(ckAdmin, `/whatsapp/numeros?compartilhado=1&busca=${encodeURIComponent(T)}`);
    ok(igual(ids(r.body), [comp]), "filtro compartilhado=1 + busca devolve só o compartilhado de QA");
    r = await api(ckAdmin, `/whatsapp/numeros?status=connected&busca=${encodeURIComponent(T)}`);
    ok(igual(ids(r.body), []), "filtro status=connected não devolve nenhum de QA (todos desconectados)");

    // 3. Segurança no servidor: enviar e configurar número alheio.
    r = await api(ckCaio, "/whatsapp/send", { method: "POST", body: JSON.stringify({ contatoId: cAna1, conteudo: "oi", sessaoId: ana1 }) });
    ok(r.status === 404, `Caio enviando pelo número de Ana recebe 404 (recebeu ${r.status})`);
    r = await api(ckCaio, "/whatsapp/status", { method: "POST", body: JSON.stringify({ action: "set-default", sessionId: ana1 }) });
    ok(r.status === 404, `Caio definindo padrão no número de Ana recebe 404 (recebeu ${r.status})`);
    r = await api(ckAna, "/whatsapp/status", { method: "POST", body: JSON.stringify({ action: "vincular", sessionId: ana1, usuarioId: caio }) });
    ok(r.status === 403, `Ana trocando o dono do próprio número recebe 403, só gestão (recebeu ${r.status})`);
    r = await api(ckAna, `/whatsapp/status?sessionId=${sLia}`);
    ok(r.status === 404, `Ana lendo o estado do número da Lia recebe 404 (recebeu ${r.status})`);
    r = await api(ckCaio, `/whatsapp/status?sessionId=${comp}`);
    ok(r.status === 404, `Caio lendo o estado do compartilhado em que não está recebe 404 (recebeu ${r.status})`);
    // Número SEM DONO HUMANO (compartilhado sem dono, dono agente): quem o
    // administra consulta e pareia. Sem isto ele fica preso em "Pareamento
    // incompleto" sem ninguém no mundo capaz de mexer, e a tela entra em laço
    // de 404.
    r = await api(ckAdmin, `/whatsapp/status?sessionId=${comp}`);
    ok(r.status === 200 && r.body.podeParear === true, `admin consulta e pareia o compartilhado sem dono (${r.status}, podeParear=${r.body.podeParear})`);
    r = await api(ckAdmin, `/whatsapp/status?sessionId=${sLia}`);
    ok(r.status === 200 && r.body.podeParear === true, `admin consulta e pareia o número da agente Lia (${r.status}, podeParear=${r.body.podeParear})`);
    r = await api(ckBia, `/whatsapp/status?sessionId=${comp}`);
    ok(r.status === 200 && r.body.podeParear === true, `Bia, autorizada no compartilhado, consulta e pareia (${r.status}, podeParear=${r.body.podeParear})`);

    // 4. Vínculo persiste e muda o que cada um vê.
    r = await api(ckAdmin, "/whatsapp/status", { method: "POST", body: JSON.stringify({ action: "vincular", sessionId: ana2, usuarioId: caio, finalidade: "suporte" }) });
    ok(r.status === 200, `admin vincula Ana 2 a Caio com finalidade suporte (${r.status})`);
    r = await api(ckAdmin, `/whatsapp/numeros?usuario=${caio}`);
    const deCaio = (r.body.numeros as Array<{ id: string; finalidade: string | null; usuario: { id: string } | null }>);
    ok(deCaio.length === 1 && deCaio[0].id === ana2 && deCaio[0].finalidade === "suporte" && deCaio[0].usuario?.id === caio, "relido pela rota: Ana 2 agora é de Caio, finalidade suporte");
    r = await api(ckAna, "/whatsapp/numeros");
    ok(igual(ids(r.body), [ana1]), "Ana passou a ver só Ana 1");
    r = await api(ckCaio, "/whatsapp/numeros");
    ok(igual(ids(r.body), [ana2]), "Caio passou a ver Ana 2");
    const [audit] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM audit_log WHERE entity_id = ${ana2}::uuid AND action = 'whatsapp.numero_vinculado'`);
    ok(audit.n === 1, "o vínculo ficou no audit_log");

    // 5. Navegador.
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const abrir = async (cookie: string, w = 1440) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      await ctx.addCookies([{ name: "authjs.session-token", value: cookie.split("=").slice(1).join("="), url: BASE }]);
      return ctx.newPage();
    };
    try {
      let page = await abrir(ckAdmin);
      await page.goto(`${BASE}/ajustes/whatsapp`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByRole("tab", { name: /Equipe/ }).waitFor({ timeout: 30000 });
      await page.screenshot({ path: `${OUT}/1-ajustes-admin-meus.png`, fullPage: true });
      await page.getByRole("tab", { name: /Equipe/ }).click();
      await page.locator(".aj-linha-titulo", { hasText: `${T} Ana` }).first().waitFor({ timeout: 10000 });
      await page.screenshot({ path: `${OUT}/2-ajustes-admin-equipe.png`, fullPage: true });
      await page.getByRole("tab", { name: /Agentes/ }).click();
      await page.locator(".aj-linha-titulo", { hasText: `${T} Lia` }).first().waitFor({ timeout: 10000 });
      ok(true, "tela: admin abre Equipe e Agentes e vê Ana e Lia");
      await page.getByRole("tab", { name: /Equipe/ }).click();
      await page.getByRole("button", { name: `${T} Ana 1` }).click();
      await page.getByRole("button", { name: "Salvar vínculo" }).waitFor({ timeout: 10000 });
      await page.waitForTimeout(700); // fim da animação da gaveta
      await page.screenshot({ path: `${OUT}/3-ajustes-admin-gaveta.png` });
      await page.close();

      page = await abrir(ckAna);
      await page.goto(`${BASE}/ajustes/whatsapp`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator(".aj-linha-titulo", { hasText: `${T} Ana 1` }).first().waitFor({ timeout: 30000 });
      const abasAna: string[] = await page.getByRole("tab").allInnerTexts();
      ok(!abasAna.some((t) => /Equipe|Agentes/.test(t)), `tela: Ana não tem aba Equipe nem Agentes (${abasAna.join(" / ")})`);
      const linhas = await page.locator(".aj-numero").count();
      ok(linhas === 1, `tela: Ana vê 1 linha depois do vínculo (viu ${linhas})`);
      await page.screenshot({ path: `${OUT}/4-ajustes-ana.png`, fullPage: true });
      await page.close();

      page = await abrir(ckAna, 390);
      await page.goto(`${BASE}/ajustes/whatsapp`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator(".aj-linha-titulo", { hasText: `${T} Ana 1` }).first().waitFor({ timeout: 30000 });
      const largo = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!largo, "tela: em 390px não há rolagem horizontal");
      await page.screenshot({ path: `${OUT}/5-ajustes-ana-390.png`, fullPage: true });
      await page.close();

      // Atendimento, escopo Equipe: seletor agrupado e filtro por número.
      page = await abrir(ckAdmin);
      await page.goto(`${BASE}/atendimento?escopo=equipe`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByText(`${T} Cliente de Ana 1`).first().waitFor({ timeout: 30000 });
      await page.locator("button[data-of-atpop]").first().click();
      await page.waitForTimeout(400);
      const pop = (await page.locator("[data-of-atpop]").allInnerTexts()).join("\n");
      ok(pop.includes(`${T} Ana`) && pop.includes(`${T} Lia · agente`) && pop.includes("Compartilhados"), "atendimento: seletor agrupa por pessoa, agente e compartilhados");
      await page.screenshot({ path: `${OUT}/6-atendimento-seletor.png` });
      await page.getByRole("button", { name: new RegExp(`^${T.replace(/[[\]]/g, "\\$&")} Ana 1`) }).first().click();
      await page.waitForTimeout(500);
      const corpo = await page.locator("body").innerText();
      ok(corpo.includes(`${T} Cliente de Ana 1`) && !corpo.includes(`${T} Cliente de Ana 2`) && !corpo.includes(`${T} Cliente da Lia`), "atendimento: escolher Ana 1 deixa só as conversas daquele número");
      await page.screenshot({ path: `${OUT}/7-atendimento-filtrado.png` });
      await page.close();
    } finally { await browser.close(); }
  } finally { await limpar(org); }

  if (falhas.length) { console.error("\nFALHAS:", falhas); process.exit(1); }
  console.log("\nOK: tudo provado"); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
