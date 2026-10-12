/**
 * Atendimento no navegador: controles sem porta de domínio não aparecem.
 * Confere que "Aguardando time" não está no popup de status, que o painel não
 * mostra "PRIORIDADE" e que a transferência só tem a aba "Pessoas".
 *
 * BASE=http://localhost:3000 npx tsx --env-file=.env src/scripts/provar-atendimento-portas.ts
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
const OUT = ".tmp-nexo"; const SESSAO = "qa-nexo-portas";

async function limpar() {
  await db.execute(sql`DELETE FROM contatos WHERE nome LIKE '[QA nexo]%'`);
  await db.execute(sql`DELETE FROM whatsapp_sessao WHERE session_name = ${SESSAO}`);
}
async function main() {
  mkdirSync(OUT, { recursive: true });
  const s = await sessaoDeSmoke({ role: "admin" });
  await limpar();
  const [{ id: sessaoId }] = await db.execute<{ id: string }>(sql`INSERT INTO whatsapp_sessao (organizacao_id, session_name, label, status, usuario_id) VALUES (${s.organizacaoId}::uuid, ${SESSAO}, '[QA nexo] número', 'connected', ${s.usuarioId}::uuid) RETURNING id::text`);
  const [{ id }] = await db.execute<{ id: string }>(sql`INSERT INTO contatos (organizacao_id, canal, nome, telefone, sessao_id, responsavel_id, status) VALUES (${s.organizacaoId}::uuid, 'whatsapp', '[QA nexo] Portas', '5511999990003', ${sessaoId}::uuid, ${s.usuarioId}::uuid, 'open') RETURNING id::text`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: s.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();
  const falhas: string[] = [];
  try {
    await page.goto(`${BASE}/atendimento?contatoId=${id}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByText("[QA nexo] Portas").first().waitFor({ timeout: 30000 });
    const corpo = await page.locator("body").innerText();
    if (/PRIORIDADE/.test(corpo)) falhas.push("painel ainda mostra PRIORIDADE");
    // popup de status: botão do cabeçalho da conversa com o status atual
    const chip = page.locator("button", { hasText: /^(Em atendimento|Aguardando cliente|Novo|Retornar|Resolvida)/ }).first();
    await chip.click();
    await page.waitForTimeout(300);
    const popup = await page.locator("[data-of-atpop]").allInnerTexts();
    if (popup.join("\n").includes("Aguardando time")) falhas.push("popup de status ainda oferece Aguardando time");
    await page.screenshot({ path: `${OUT}/4-status.png` });
    await page.keyboard.press("Escape");
    // transferir: só Pessoas
    await page.locator('button[title="Transferir"]').click();
    await page.waitForTimeout(300);
    const abas = await page.getByRole("button", { name: /^(Meus números|Agentes NEXO|Pessoas)$/ }).count();
    if (abas) falhas.push("transferência ainda mostra abas (Pessoas / Meus números / Agentes NEXO)");
    await page.getByText("Transferir conversa").waitFor({ timeout: 5000 });
    await page.screenshot({ path: `${OUT}/5-transferir.png` });
    console.log("status popup:", popup.join(" | ").replace(/\n/g, " / ").slice(0, 300));
  } finally { await browser.close(); await limpar(); }
  if (falhas.length) { console.error("FALHAS:", falhas); process.exit(1); }
  console.log("OK"); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
