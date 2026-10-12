/**
 * Prova no NAVEGADOR (Chrome headless, sessão real por cookie) do NEXO na casca:
 *  1. pergunta com tabela: a resposta aparece desenhada em blocos (tabela real no DOM);
 *  2. envio de WhatsApp: cria conversa de QA, pede ao NEXO, o rascunho aparece
 *     editável, a pessoa edita, confirma, e a mensagem gravada é a editada.
 * Evidências em .tmp-nexo/*.png. Dados de QA apagados no fim.
 *
 * BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-nexo-navegador.ts
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
const OUT = ".tmp-nexo";
const SESSAO = "qa-nexo-navegador";

async function limpar() {
  await db.execute(sql`DELETE FROM whatsapp_mensagens WHERE contato_id IN (SELECT id FROM contatos WHERE nome LIKE '[QA nexo]%')`);
  await db.execute(sql`DELETE FROM contatos WHERE nome LIKE '[QA nexo]%'`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE session_name = ${SESSAO}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const s = await sessaoDeSmoke({ role: "admin" });
  await limpar();
  const [{ id: sessaoId }] = await db.execute<{ id: string }>(sql`
    INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, usuario_id) VALUES (${s.organizacaoId}::uuid, ${SESSAO}, '[QA nexo] número', 'connected', ${s.usuarioId}::uuid) RETURNING id::text`);
  const [{ id: contatoId }] = await db.execute<{ id: string }>(sql`
    INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, responsavel_id, status) VALUES (${s.organizacaoId}::uuid, 'whatsapp', '[QA nexo] Cliente Navegador', '5511999990001', ${sessaoId}::uuid, ${s.usuarioId}::uuid, 'open') RETURNING id::text`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();
  const falhas: string[] = [];
  try {
    await page.goto(`${BASE}/inicio`, { waitUntil: "networkidle", timeout: 60000 });

    // 1. pergunta com tabela
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("onface:nexo-abrir", { detail: { pergunta: "Quantos leads entraram nos últimos 7 dias, por campanha? Responda com uma tabela." } })));
    // O painel do NEXO é o que contém o campo de pergunta; tabelas da tela de fundo não contam.
    const nexo = page.locator('input[placeholder="Pergunte ou peça algo ao NEXO"]').locator("xpath=ancestor::div[.//table or .//textarea][1]");
    await page.locator('input[placeholder="Pergunte ou peça algo ao NEXO"]').waitFor({ timeout: 30000 });
    await nexo.locator("table").first().waitFor({ timeout: 180000 }).catch(() => falhas.push("resposta sem tabela desenhada"));
    const linhasTabela = await nexo.locator("table tbody tr").count();
    await page.screenshot({ path: `${OUT}/1-tabela.png`, fullPage: false });
    console.log(`1. tabela desenhada com ${linhasTabela} linhas`);

    // 2. WhatsApp: rascunho editável + confirmar
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("onface:nexo-abrir", { detail: { pergunta: "Responda a conversa de WhatsApp do contato [QA nexo] Cliente Navegador dizendo que retorno amanhã às 10h." } })));
    const caixa = page.locator('textarea[aria-label="Mensagem de WhatsApp a enviar"]');
    await caixa.waitFor({ timeout: 180000 }).catch(() => falhas.push("rascunho de WhatsApp não apareceu"));
    if (falhas.length) { console.log("DOM do NEXO:", (await page.locator("body").innerText()).slice(-1500)); throw new Error(falhas.join("; ")); }
    const rascunho = await caixa.inputValue().catch(() => "");
    console.log(`2. rascunho do NEXO: ${JSON.stringify(rascunho)}`);
    await page.screenshot({ path: `${OUT}/2-rascunho.png` });
    const editado = "[QA nexo] Oi! Retorno amanhã às 10h, combinado?";
    await caixa.fill(editado);
    const antes = (await db.execute(sql`SELECT 1 FROM whatsapp_mensagens WHERE contato_id=${contatoId}::uuid`)).length;
    if (antes !== 0) falhas.push("mensagem saiu antes do Confirmar");
    await page.getByRole("button", { name: /^Confirmar: Enviar WhatsApp/ }).first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/3-confirmado.png` });
    const [m] = await db.execute<{ conteudo: string; status: string; dados: { via?: string } }>(sql`SELECT conteudo, status, dados FROM whatsapp_mensagens WHERE contato_id=${contatoId}::uuid`);
    if (!m) falhas.push("mensagem não gravada após Confirmar");
    else if (m.conteudo !== editado) falhas.push(`gravou ${JSON.stringify(m.conteudo)}, esperado o texto editado`);
    else console.log(`3. gravado o texto EDITADO, status=${m.status}, via=${m.dados?.via}`);
  } finally {
    await browser.close();
    await limpar();
  }
  if (falhas.length) { console.error("FALHAS:", falhas); process.exit(1); }
  console.log("OK: provas em", OUT);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
